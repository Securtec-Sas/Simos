# Simos/V3/exchange_manager.py

import asyncio
import logging
from typing import Dict, Any, Optional, Tuple, List
import ccxt.async_support as ccxt
from shared.config_v3 import SUPPORTED_EXCHANGES, PREFERRED_NETWORKS, REQUEST_TIMEOUT
from shared.utils import safe_float, find_cheapest_network, validate_exchange_id
import requests

class ExchangeManager:
    """Maneja las interacciones con exchanges usando CCXT."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.ExchangeManager')
        self.ccxt_instances: Dict[str, ccxt.Exchange] = {}
        self.exchange_info_cache: Dict[str, Dict] = {}
        self.config_cache: Dict[str, Any] = {}
        self.config_api_url = "http://localhost:3000/api/config"
    
    async def initialize(self):
        """Inicializa las instancias de CCXT para exchanges soportados."""
        self.logger.info("Inicializando ExchangeManager...")
        
        # Cargar configuración desde la base de datos
        await self._load_config_from_db()
        
        for exchange_id in SUPPORTED_EXCHANGES:
            try:
                await self._create_exchange_instance(exchange_id)
            except Exception as e:
                self.logger.warning(f"No se pudo inicializar {exchange_id}: {e}")
        
        self.logger.info(f"ExchangeManager inicializado con {len(self.ccxt_instances)} exchanges")
    
    async def cleanup(self):
        """Limpia recursos de CCXT."""
        self.logger.info("Cerrando instancias CCXT...")
        
        for exchange_id, instance in self.ccxt_instances.items():
            try:
                if hasattr(instance, 'close') and asyncio.iscoroutinefunction(instance.close):
                    await instance.close()
                self.logger.debug(f"Conexión CCXT cerrada para {exchange_id}")
            except Exception as e:
                self.logger.error(f"Error cerrando conexión CCXT para {exchange_id}: {e}")
        
        self.ccxt_instances.clear()
        self.logger.info("Todas las instancias CCXT cerradas")
    
    async def _load_config_from_db(self):
        """Carga la configuración desde la base de datos."""
        try:
            response = requests.get(self.config_api_url, timeout=5)
            if response.status_code == 200:
                self.config_cache = response.json()
                self.logger.info("Configuración cargada desde la base de datos")
            else:
                self.logger.warning(f"No se pudo cargar configuración: HTTP {response.status_code}")
                self.config_cache = {}
        except Exception as e:
            self.logger.error(f"Error cargando configuración desde DB: {e}")
            self.config_cache = {}

    async def _create_exchange_instance(self, exchange_id: str) -> Optional[ccxt.Exchange]:
        """Crea una instancia CCXT para un exchange específico."""
        if not validate_exchange_id(exchange_id, SUPPORTED_EXCHANGES):
            self.logger.error(f"Exchange no soportado: {exchange_id}")
            return None
        
        try:
            # Obtener clase del exchange
            exchange_class = getattr(ccxt, exchange_id.lower())
            
            # Obtener configuración de sandbox desde la base de datos
            sandbox_mode = self.config_cache.get('system', {}).get('sandboxMode', False)
            
            # Configuración básica
            config = {
                'enableRateLimit': True,
                'timeout': REQUEST_TIMEOUT * 1000,  # CCXT usa milisegundos
                'sandbox': sandbox_mode,
            }
            
            # Obtener API keys desde la configuración de la base de datos
            api_keys_config = self.config_cache.get('apiKeys', {})
            key_type_log = "SANDBOX" if sandbox_mode else "PRODUCTION"

            # Nombres de las keys
            api_key_name = f"{exchange_id.lower()}ApiKey"
            secret_key_name = f"{exchange_id.lower()}SecretKey"
            passphrase_name = f"{exchange_id.lower()}Passphrase"

            api_key = api_keys_config.get(api_key_name)
            secret_key = api_keys_config.get(secret_key_name)
            
            # Placeholder para evitar usar keys de ejemplo
            api_key_placeholder = f"your_{exchange_id.lower()}{'_testnet' if sandbox_mode else ''}_api_key"
            passphrase_placeholder = f"your_{exchange_id.lower()}{'_testnet' if sandbox_mode else ''}_passphrase"

            if api_key and secret_key and api_key != api_key_placeholder:
                config['apiKey'] = api_key
                config['secret'] = secret_key
                
                # Algunos exchanges requieren passphrase (e.g., KuCoin, OKX sandbox)
                passphrase = api_keys_config.get(passphrase_name)
                if passphrase and passphrase != passphrase_placeholder:
                    config['password'] = passphrase
                
                self.logger.info(f"{key_type_log} API keys configuradas para {exchange_id}")
            else:
                self.logger.warning(f"{key_type_log} API keys no configuradas o son placeholders para {exchange_id} - solo lectura")
            
            # Crear instancia
            instance = exchange_class(config)
            self.ccxt_instances[exchange_id] = instance
            
            self.logger.debug(f"Instancia CCXT creada para {exchange_id}")
            return instance
            
        except AttributeError:
            self.logger.error(f"Exchange CCXT no soportado: {exchange_id}")
            return None
        except Exception as e:
            self.logger.error(f"Error creando instancia CCXT para {exchange_id}: {e}")
            return None
    
    async def get_exchange_instance(self, exchange_id: str) -> Optional[ccxt.Exchange]:
        """Obtiene una instancia CCXT, creándola si no existe."""
        if exchange_id not in self.ccxt_instances:
            await self._create_exchange_instance(exchange_id)
        
        return self.ccxt_instances.get(exchange_id)
    
    # Métodos para obtener precios de mercado
    
    async def get_ticker(self, exchange_id: str, symbol: str) -> Optional[Dict]:
        """Obtiene el ticker de un símbolo en un exchange."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            ticker = await exchange.fetch_ticker(symbol)
            self.logger.debug(f"Ticker obtenido: {symbol}@{exchange_id}")
            return ticker
        except ccxt.NetworkError as e:
            self.logger.error(f"Error de red obteniendo ticker {symbol}@{exchange_id}: {e}")
        except ccxt.ExchangeError as e:
            self.logger.error(f"Error de exchange obteniendo ticker {symbol}@{exchange_id}: {e}")
        except Exception as e:
            self.logger.error(f"Error genérico obteniendo ticker {symbol}@{exchange_id}: {e}")
        
        return None
    
    async def get_current_prices(self, exchange_id: str, symbol: str) -> Tuple[Optional[float], Optional[float]]:
        """Obtiene los precios ask (compra) y bid (venta) actuales."""
        ticker = await self.get_ticker(exchange_id, symbol)
        
        if ticker:
            ask_price = safe_float(ticker.get('ask'))
            bid_price = safe_float(ticker.get('bid'))
            return ask_price, bid_price
        
        return None, None
    
    async def get_order_book(self, exchange_id: str, symbol: str, limit: int = 5) -> Optional[Dict]:
        """Obtiene el order book de un símbolo."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            order_book = await exchange.fetch_order_book(symbol, limit)
            self.logger.debug(f"Order book obtenido: {symbol}@{exchange_id}")
            return order_book
        except Exception as e:
            self.logger.error(f"Error obteniendo order book {symbol}@{exchange_id}: {e}")
            return None
    
    # Métodos para trading (requieren API keys)
    
    async def get_balance(self, exchange_id: str) -> Optional[Dict]:
        """Obtiene el balance de un exchange."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            balance = await exchange.fetch_balance()
            self.logger.debug(f"Balance obtenido para {exchange_id}")
            return balance
        except ccxt.AuthenticationError as e:
            self.logger.error(f"Error de autenticación obteniendo balance {exchange_id}: {e}")
        except Exception as e:
            self.logger.error(f"Error obteniendo balance {exchange_id}: {e}")
        
        return None
    
    async def create_market_buy_order(
        self, 
        exchange_id: str, 
        symbol: str, 
        amount_usdt: float
    ) -> Optional[Dict]:
        """Crea una orden de compra de mercado."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            # Verificar que el exchange soporte órdenes de mercado
            if not exchange.has['createMarketOrder']:
                self.logger.error(f"Exchange {exchange_id} no soporta órdenes de mercado")
                return None
            
            # Crear orden de compra por valor en USDT (quoteOrderQty)
            order = await exchange.create_market_buy_order(symbol, None, None, amount_usdt)
            
            self.logger.info(f"Orden de compra creada: {symbol}@{exchange_id} por {amount_usdt} USDT")
            return order
            
        except ccxt.InsufficientFunds as e:
            self.logger.error(f"Fondos insuficientes para compra {symbol}@{exchange_id}: {e}")
        except ccxt.ExchangeError as e:
            self.logger.error(f"Error de exchange en compra {symbol}@{exchange_id}: {e}")
        except Exception as e:
            self.logger.error(f"Error genérico en compra {symbol}@{exchange_id}: {e}")
        
        return None
    
    async def create_market_sell_order(
        self, 
        exchange_id: str, 
        symbol: str, 
        amount: float
    ) -> Optional[Dict]:
        """Crea una orden de venta de mercado."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            # Verificar que el exchange soporte órdenes de mercado
            if not exchange.has['createMarketOrder']:
                self.logger.error(f"Exchange {exchange_id} no soporta órdenes de mercado")
                return None
            
            # Crear orden de venta
            order = await exchange.create_market_sell_order(symbol, amount)
            
            self.logger.info(f"Orden de venta creada: {amount} {symbol}@{exchange_id}")
            return order
            
        except ccxt.InsufficientFunds as e:
            self.logger.error(f"Fondos insuficientes para venta {symbol}@{exchange_id}: {e}")
        except ccxt.ExchangeError as e:
            self.logger.error(f"Error de exchange en venta {symbol}@{exchange_id}: {e}")
        except Exception as e:
            self.logger.error(f"Error genérico en venta {symbol}@{exchange_id}: {e}")
        
        return None
    
    async def withdraw(
        self, 
        exchange_id: str, 
        currency: str, 
        amount: float, 
        address: str, 
        network: str = None,
        tag: str = None
    ) -> Optional[Dict]:
        """Realiza un retiro a una dirección externa."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            # Verificar que el exchange soporte retiros
            if not exchange.has['withdraw']:
                self.logger.error(f"Exchange {exchange_id} no soporta retiros")
                return None
            
            # Preparar parámetros
            params = {}
            if network:
                params['network'] = network
            if tag:
                params['tag'] = tag
            
            # Realizar retiro
            withdrawal = await exchange.withdraw(currency, amount, address, tag, params)
            
            self.logger.info(f"Retiro iniciado: {amount} {currency} desde {exchange_id}")
            return withdrawal
            
        except ccxt.InsufficientFunds as e:
            self.logger.error(f"Fondos insuficientes para retiro {currency}@{exchange_id}: {e}")
        except ccxt.ExchangeError as e:
            self.logger.error(f"Error de exchange en retiro {currency}@{exchange_id}: {e}")
        except Exception as e:
            self.logger.error(f"Error genérico en retiro {currency}@{exchange_id}: {e}")
        
        return None
    
    # Métodos para información de fees y redes
    
    async def get_trading_fees(self, exchange_id: str, symbol: str = None) -> Optional[Dict]:
        """Obtiene las tarifas de trading de un exchange."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            if symbol:
                fees = await exchange.fetch_trading_fees([symbol])
            else:
                fees = await exchange.fetch_trading_fees()
            
            self.logger.debug(f"Tarifas de trading obtenidas para {exchange_id}")
            return fees
            
        except Exception as e:
            self.logger.error(f"Error obteniendo tarifas de trading {exchange_id}: {e}")
            return None
    
    async def get_withdrawal_fees(self, exchange_id: str, currency: str = None) -> Optional[Dict]:
        """Obtiene las tarifas de retiro de un exchange."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            # Algunos exchanges requieren cargar markets primero
            if not exchange.markets:
                await exchange.load_markets()
            
            if hasattr(exchange, 'fetch_deposit_withdraw_fees'):
                fees = await exchange.fetch_deposit_withdraw_fees([currency] if currency else None)
            elif hasattr(exchange, 'fetch_currencies'):
                currencies = await exchange.fetch_currencies()
                fees = {curr: info.get('fees', {}) for curr, info in currencies.items()}
            else:
                # Fallback: usar información estática de markets
                fees = {}
                for market_symbol, market_info in exchange.markets.items():
                    base = market_info.get('base')
                    if base and (not currency or base == currency):
                        fees[base] = market_info.get('fees', {})
            
            self.logger.debug(f"Tarifas de retiro obtenidas para {exchange_id}")
            return fees
            
        except Exception as e:
            self.logger.error(f"Error obteniendo tarifas de retiro {exchange_id}: {e}")
            return None
    
    async def get_deposit_address(self, exchange_id: str, currency: str, network: str = None) -> Optional[Dict]:
        """Obtiene la dirección de depósito para una moneda."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            params = {}
            if network:
                params['network'] = network
            
            address_info = await exchange.fetch_deposit_address(currency, params)
            
            self.logger.debug(f"Dirección de depósito obtenida: {currency}@{exchange_id}")
            return address_info
            
        except Exception as e:
            self.logger.error(f"Error obteniendo dirección de depósito {currency}@{exchange_id}: {e}")
            return None
    
    # Métodos de utilidad
    
    async def check_symbol_exists(self, exchange_id: str, symbol: str) -> bool:
        """Verifica si un símbolo existe en un exchange."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return False
        
        try:
            if not exchange.markets:
                await exchange.load_markets()
            
            return symbol in exchange.markets
            
        except Exception as e:
            self.logger.error(f"Error verificando símbolo {symbol}@{exchange_id}: {e}")
            return False
    
    async def get_minimum_order_amount(self, exchange_id: str, symbol: str) -> Optional[float]:
        """Obtiene el monto mínimo de orden para un símbolo."""
        exchange = await self.get_exchange_instance(exchange_id)
        if not exchange:
            return None
        
        try:
            if not exchange.markets:
                await exchange.load_markets()
            
            market = exchange.markets.get(symbol)
            if market and 'limits' in market:
                min_amount = market['limits'].get('amount', {}).get('min')
                return safe_float(min_amount) if min_amount else None
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error obteniendo monto mínimo {symbol}@{exchange_id}: {e}")
            return None
    
    def get_supported_exchanges(self) -> List[str]:
        """Retorna la lista de exchanges soportados."""
        return SUPPORTED_EXCHANGES.copy()
    
    def get_active_exchanges(self) -> List[str]:
        """Retorna la lista de exchanges con instancias activas."""
        return list(self.ccxt_instances.keys())
    
    async def test_exchange_connection(self, exchange_id: str) -> bool:
        """Prueba la conexión con un exchange."""
        try:
            exchange = await self.get_exchange_instance(exchange_id)
            if not exchange:
                return False
            
            # Intentar cargar markets como test básico
            await exchange.load_markets()
            self.logger.debug(f"Conexión exitosa con {exchange_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error probando conexión con {exchange_id}: {e}")
            return False

