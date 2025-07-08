# Simos/V3/trading_logic.py

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable
from config_v3 import (
    MIN_PROFIT_PERCENTAGE, MIN_PROFIT_USDT, MIN_OPERATIONAL_USDT,
    DEFAULT_INVESTMENT_MODE, DEFAULT_INVESTMENT_PERCENTAGE, DEFAULT_FIXED_INVESTMENT_USDT,
    SIMULATION_MODE, SIMULATION_DELAY, PREFERRED_NETWORKS
)
from utils import (
    create_symbol_dict, safe_float, safe_dict_get, get_current_timestamp,
    is_profitable_operation, format_operation_summary, find_cheapest_network
)
from exchange_manager import ExchangeManager
from data_persistence import DataPersistence
from ai_model import ArbitrageAIModel

class TradingLogic:
    """Maneja la lógica central de trading y arbitraje."""
    
    def __init__(self, exchange_manager: ExchangeManager, data_persistence: DataPersistence, ai_model: ArbitrageAIModel = None):
        self.logger = logging.getLogger('V3.TradingLogic')
        self.exchange_manager = exchange_manager
        self.data_persistence = data_persistence
        self.ai_model = ai_model or ArbitrageAIModel()
        
        # Estado del trading
        self.is_trading_active = False
        self.current_operation = None
        self.trading_stats = {
            'operations_count': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None
        }
        
        # Configuración de trading
        self.usdt_holder_exchange_id = "binance"  # Exchange principal para USDT
        self.global_sl_active_flag = False
        
        # Callbacks
        self.on_operation_complete_callback: Optional[Callable] = None
        self.on_trading_status_change_callback: Optional[Callable] = None
    
    async def initialize(self):
        """Inicializa el módulo de trading logic."""
        self.logger.info("Inicializando TradingLogic...")
        
        # Cargar estado previo si existe
        await self._load_trading_state()
        
        self.logger.info("TradingLogic inicializado")
    
    async def cleanup(self):
        """Limpia recursos y guarda estado."""
        await self._save_trading_state()
        self.logger.info("TradingLogic limpiado")
    
    # Gestión de estado
    
    async def _load_trading_state(self):
        """Carga el estado previo del trading."""
        try:
            state = await self.data_persistence.load_trading_state()
            if state:
                self.is_trading_active = state.get('is_trading_active', False)
                self.usdt_holder_exchange_id = state.get('usdt_holder_exchange_id', 'binance')
                self.global_sl_active_flag = state.get('global_sl_active_flag', False)
                self.trading_stats = state.get('trading_stats', self.trading_stats)
                
                self.logger.info(f"Estado de trading cargado - Activo: {self.is_trading_active}")
        except Exception as e:
            self.logger.error(f"Error cargando estado de trading: {e}")
    
    async def _save_trading_state(self):
        """Guarda el estado actual del trading."""
        try:
            state = {
                'is_trading_active': self.is_trading_active,
                'usdt_holder_exchange_id': self.usdt_holder_exchange_id,
                'global_sl_active_flag': self.global_sl_active_flag,
                'trading_stats': self.trading_stats,
                'current_operation': self.current_operation
            }
            
            await self.data_persistence.save_trading_state(state)
        except Exception as e:
            self.logger.error(f"Error guardando estado de trading: {e}")
    
    # Control de trading
    
    async def start_trading(self, config: Dict = None):
        """Inicia el trading automatizado."""
        if self.is_trading_active:
            self.logger.warning("Trading ya está activo")
            return
        
        self.is_trading_active = True
        self.trading_stats['start_time'] = get_current_timestamp()
        
        # Aplicar configuración si se proporciona
        if config:
            self.usdt_holder_exchange_id = config.get('usdt_holder_exchange_id', self.usdt_holder_exchange_id)
        
        await self._save_trading_state()
        
        self.logger.info(f"Trading iniciado - Exchange principal: {self.usdt_holder_exchange_id}")
        
        if self.on_trading_status_change_callback:
            await self.on_trading_status_change_callback(True)
    
    async def stop_trading(self):
        """Detiene el trading automatizado."""
        if not self.is_trading_active:
            self.logger.warning("Trading ya está inactivo")
            return
        
        self.is_trading_active = False
        await self._save_trading_state()
        
        self.logger.info("Trading detenido")
        
        if self.on_trading_status_change_callback:
            await self.on_trading_status_change_callback(False)
    
    # Procesamiento de oportunidades
    
    async def process_arbitrage_opportunity(self, opportunity_data: Dict) -> Dict:
        """Procesa una oportunidad de arbitraje."""
        if not self.is_trading_active:
            return self._create_operation_result("TRADING_INACTIVE", "Trading no está activo")
        
        if self.current_operation:
            return self._create_operation_result("OPERATION_IN_PROGRESS", "Operación en progreso")
        
        operation_start_time = asyncio.get_event_loop().time()
        symbol = safe_dict_get(opportunity_data, 'symbol', 'N/A')
        
        try:
            self.current_operation = {
                'symbol': symbol,
                'start_time': operation_start_time,
                'status': 'PROCESSING'
            }
            
            self.logger.info(f"Procesando oportunidad: {symbol}")
            
            # Crear diccionario de símbolo
            symbol_dict = create_symbol_dict(opportunity_data)
            
            # Validaciones iniciales
            validation_result = await self._validate_opportunity(symbol_dict)
            if not validation_result['valid']:
                return self._create_operation_result("VALIDATION_FAILED", validation_result['reason'])
            
            # Obtener configuración de balance
            balance_config = await self._get_balance_config()
            if not balance_config:
                return self._create_operation_result("BALANCE_CONFIG_ERROR", "No se pudo obtener configuración de balance")
            
            # Verificar stop loss global
            if await self._check_global_stop_loss(balance_config):
                return self._create_operation_result("GLOBAL_STOP_LOSS", "Stop loss global activado")
            
            # Calcular monto de inversión
            investment_amount = self._calculate_investment_amount(balance_config)
            if investment_amount < MIN_OPERATIONAL_USDT:
                return self._create_operation_result("INSUFFICIENT_BALANCE", f"Balance insuficiente: {investment_amount} USDT")
            
            # Obtener precios actuales y tarifas
            market_data = await self._get_market_data(symbol_dict)
            if not market_data['valid']:
                return self._create_operation_result("MARKET_DATA_ERROR", market_data['reason'])
            
            # Preparar datos para la IA
            ai_input_data = self._prepare_ai_input_data(
                symbol_dict, balance_config, investment_amount, market_data
            )
            
            # Decisión de la IA
            ai_decision = self.ai_model.predict(ai_input_data)
            ai_input_data['ai_decision'] = ai_decision
            
            self.logger.info(f"Decisión IA para {symbol}: {ai_decision['should_execute']} (confianza: {ai_decision['confidence']:.3f})")
            
            # Ejecutar operación si es rentable
            if ai_decision.get('should_execute', False):
                if SIMULATION_MODE:
                    execution_result = await self._simulate_operation(ai_input_data)
                else:
                    execution_result = await self._execute_real_operation(ai_input_data)
            else:
                execution_result = self._create_operation_result(
                    "NOT_PROFITABLE", 
                    ai_decision.get('reason', 'Operación no rentable según IA')
                )
            
            # Retroalimentación al modelo de IA
            if execution_result.get('success', False) or execution_result.get('decision_outcome') == 'NOT_PROFITABLE':
                self.ai_model.update_with_feedback(ai_input_data, execution_result)
            
            # Actualizar estadísticas
            await self._update_trading_stats(execution_result)
            
            # Registrar operación
            operation_log_data = {**ai_input_data, **execution_result}
            operation_log_data['execution_time_ms'] = (asyncio.get_event_loop().time() - operation_start_time) * 1000
            operation_log_data['ai_confidence'] = ai_decision.get('confidence', 0.0)
            
            await self.data_persistence.log_operation_to_csv(operation_log_data)
            
            # Callback de operación completada
            if self.on_operation_complete_callback:
                await self.on_operation_complete_callback(execution_result)
            
            self.logger.info(f"Operación completada: {format_operation_summary(execution_result)}")
            
            return execution_result
            
        except Exception as e:
            error_msg = f"Error procesando oportunidad {symbol}: {e}"
            self.logger.error(error_msg)
            return self._create_operation_result("PROCESSING_ERROR", error_msg)
        
        finally:
            self.current_operation = None
    
    async def _validate_opportunity(self, symbol_dict: Dict) -> Dict:
        """Valida una oportunidad de arbitraje."""
        # Verificar que los exchanges estén soportados
        buy_exchange = symbol_dict.get('buy_exchange_id')
        sell_exchange = symbol_dict.get('sell_exchange_id')
        
        if not buy_exchange or not sell_exchange:
            return {'valid': False, 'reason': 'Exchanges no especificados'}
        
        if buy_exchange == sell_exchange:
            return {'valid': False, 'reason': 'Exchanges de compra y venta son iguales'}
        
        # Verificar que los exchanges estén disponibles
        if not await self.exchange_manager.test_exchange_connection(buy_exchange):
            return {'valid': False, 'reason': f'Exchange de compra no disponible: {buy_exchange}'}
        
        if not await self.exchange_manager.test_exchange_connection(sell_exchange):
            return {'valid': False, 'reason': f'Exchange de venta no disponible: {sell_exchange}'}
        
        # Verificar que el símbolo exista en ambos exchanges
        symbol = symbol_dict.get('symbol')
        if not await self.exchange_manager.check_symbol_exists(buy_exchange, symbol):
            return {'valid': False, 'reason': f'Símbolo {symbol} no existe en {buy_exchange}'}
        
        if not await self.exchange_manager.check_symbol_exists(sell_exchange, symbol):
            return {'valid': False, 'reason': f'Símbolo {symbol} no existe en {sell_exchange}'}
        
        return {'valid': True, 'reason': 'Validación exitosa'}
    
    async def _get_balance_config(self) -> Optional[Dict]:
        """Obtiene la configuración de balance del exchange principal."""
        # Aquí se integraría con sebo_connector para obtener la configuración
        # Por ahora, retornamos una configuración por defecto
        return {
            'id_exchange': self.usdt_holder_exchange_id,
            'balance_usdt': 1000.0,  # Placeholder
            'investment_mode': DEFAULT_INVESTMENT_MODE,
            'investment_percentage': DEFAULT_INVESTMENT_PERCENTAGE,
            'fixed_investment_usdt': DEFAULT_FIXED_INVESTMENT_USDT,
            'stop_loss_percentage_global': 50.0,
            'initial_capital_for_global_sl': 1000.0
        }
    
    async def _check_global_stop_loss(self, balance_config: Dict) -> bool:
        """Verifica si el stop loss global está activado."""
        if self.global_sl_active_flag:
            return True
        
        current_balance = safe_float(balance_config.get('balance_usdt', 0))
        initial_capital = safe_float(balance_config.get('initial_capital_for_global_sl', 0))
        sl_percentage = safe_float(balance_config.get('stop_loss_percentage_global', 50))
        
        if initial_capital > 0:
            sl_threshold = initial_capital * (1 - (sl_percentage / 100.0))
            if current_balance < sl_threshold:
                self.global_sl_active_flag = True
                self.logger.warning(f"Stop loss global activado: {current_balance} < {sl_threshold}")
                return True
        
        return False
    
    def _calculate_investment_amount(self, balance_config: Dict) -> float:
        """Calcula el monto a invertir basado en la configuración."""
        current_balance = safe_float(balance_config.get('balance_usdt', 0))
        investment_mode = balance_config.get('investment_mode', DEFAULT_INVESTMENT_MODE)
        
        if current_balance < MIN_OPERATIONAL_USDT:
            return 0.0
        
        if current_balance < 150:
            return current_balance
        
        if investment_mode == "FIXED":
            amount = safe_float(balance_config.get('fixed_investment_usdt', DEFAULT_FIXED_INVESTMENT_USDT))
        elif investment_mode == "PERCENTAGE":
            percentage = safe_float(balance_config.get('investment_percentage', DEFAULT_INVESTMENT_PERCENTAGE))
            amount = current_balance * (percentage / 100.0)
        else:
            amount = DEFAULT_FIXED_INVESTMENT_USDT
        
        # Asegurar monto mínimo práctico
        if current_balance >= 150 and amount < 50.0:
            amount = 50.0
        
        return min(amount, current_balance)
    
    async def _get_market_data(self, symbol_dict: Dict) -> Dict:
        """Obtiene datos de mercado actuales."""
        try:
            symbol = symbol_dict['symbol']
            buy_exchange = symbol_dict['buy_exchange_id']
            sell_exchange = symbol_dict['sell_exchange_id']
            
            # Obtener precios actuales
            buy_ask, _ = await self.exchange_manager.get_current_prices(buy_exchange, symbol)
            _, sell_bid = await self.exchange_manager.get_current_prices(sell_exchange, symbol)
            
            if not buy_ask or not sell_bid:
                return {'valid': False, 'reason': 'No se pudieron obtener precios actuales'}
            
            # Obtener tarifas de trading
            buy_fees = await self.exchange_manager.get_trading_fees(buy_exchange, symbol)
            sell_fees = await self.exchange_manager.get_trading_fees(sell_exchange, symbol)
            
            # Obtener información de retiro (para el activo)
            base_currency = symbol.split('/')[0]  # Ej: BTC/USDT -> BTC
            withdrawal_info = await self.exchange_manager.get_withdrawal_fees(buy_exchange, base_currency)
            
            return {
                'valid': True,
                'buy_price': buy_ask,
                'sell_price': sell_bid,
                'buy_fees': buy_fees,
                'sell_fees': sell_fees,
                'withdrawal_info': withdrawal_info
            }
            
        except Exception as e:
            return {'valid': False, 'reason': f'Error obteniendo datos de mercado: {e}'}
    
    def _prepare_ai_input_data(
        self, 
        symbol_dict: Dict, 
        balance_config: Dict, 
        investment_amount: float, 
        market_data: Dict
    ) -> Dict:
        """Prepara los datos de entrada para la IA."""
        return {
            'symbol': symbol_dict['symbol'],
            'symbol_name': symbol_dict.get('symbol_name', symbol_dict['symbol']),
            'buy_exchange_id': symbol_dict['buy_exchange_id'],
            'sell_exchange_id': symbol_dict['sell_exchange_id'],
            'current_price_buy': market_data['buy_price'],
            'current_price_sell': market_data['sell_price'],
            'investment_usdt': investment_amount,
            'balance_config': balance_config,
            'market_data': market_data,
            'timestamp': get_current_timestamp(),
            'usdt_holder_exchange_id': self.usdt_holder_exchange_id
        }
    
    async def _get_ai_decision(self, ai_model, input_data: Dict) -> Dict:
        """Obtiene la decisión de la IA."""
        try:
            # Aquí se integraría con el modelo de IA real
            # Por ahora, usamos lógica básica
            return await self._basic_profitability_decision(input_data)
        except Exception as e:
            self.logger.error(f"Error en decisión de IA: {e}")
            return {
                'should_execute': False,
                'reason': f'Error en IA: {e}',
                'confidence': 0.0
            }
    
    async def _basic_profitability_decision(self, input_data: Dict) -> Dict:
        """Lógica básica de decisión de rentabilidad."""
        try:
            buy_price = input_data['current_price_buy']
            sell_price = input_data['current_price_sell']
            investment = input_data['investment_usdt']
            
            # Calcular diferencia porcentual
            if buy_price <= 0:
                return {'should_execute': False, 'reason': 'Precio de compra inválido', 'confidence': 0.0}
            
            percentage_diff = ((sell_price - buy_price) / buy_price) * 100
            
            # Estimar fees (simplificado)
            estimated_fees_percentage = 0.2  # 0.2% total estimado
            net_percentage = percentage_diff - estimated_fees_percentage
            
            # Verificar rentabilidad
            is_profitable = (
                net_percentage >= MIN_PROFIT_PERCENTAGE and
                (investment * net_percentage / 100) >= MIN_PROFIT_USDT
            )
            
            return {
                'should_execute': is_profitable,
                'reason': f'Rentabilidad neta: {net_percentage:.4f}%' if is_profitable else f'No rentable: {net_percentage:.4f}%',
                'confidence': min(net_percentage / MIN_PROFIT_PERCENTAGE, 1.0) if is_profitable else 0.0,
                'estimated_profit_percentage': net_percentage,
                'estimated_profit_usdt': investment * net_percentage / 100
            }
            
        except Exception as e:
            return {'should_execute': False, 'reason': f'Error en cálculo: {e}', 'confidence': 0.0}
    
    async def _simulate_operation(self, input_data: Dict) -> Dict:
        """Simula una operación de arbitraje."""
        await asyncio.sleep(SIMULATION_DELAY)
        
        ai_decision = input_data.get('ai_decision', {})
        estimated_profit = ai_decision.get('estimated_profit_usdt', 0.0)
        
        # Simular pequeña variación en el resultado
        import random
        actual_profit = estimated_profit * random.uniform(0.8, 1.2)
        
        return self._create_operation_result(
            "EXECUTED_SIMULATED",
            "Operación simulada exitosa",
            {
                'net_profit_usdt': actual_profit,
                'investment_usdt': input_data['investment_usdt'],
                'success': True
            }
        )
    
    async def _execute_real_operation(self, input_data: Dict) -> Dict:
        """Ejecuta una operación real de arbitraje."""
        try:
            symbol = input_data['symbol']
            buy_exchange = input_data['buy_exchange_id']
            sell_exchange = input_data['sell_exchange_id']
            investment_usdt = input_data['investment_usdt']
            
            self.logger.info(f"Ejecutando operación real: {symbol} ({buy_exchange} -> {sell_exchange})")
            
            # Paso 1: Transferir USDT al exchange de compra (si es necesario)
            if self.usdt_holder_exchange_id != buy_exchange:
                transfer_result = await self._transfer_usdt_between_exchanges(
                    self.usdt_holder_exchange_id, buy_exchange, investment_usdt
                )
                if not transfer_result['success']:
                    return self._create_operation_result("TRANSFER_FAILED", transfer_result['reason'])
            
            # Paso 2: Comprar el activo
            buy_result = await self.exchange_manager.create_market_buy_order(
                buy_exchange, symbol, investment_usdt
            )
            if not buy_result:
                return self._create_operation_result("BUY_FAILED", "Error en orden de compra")
            
            # Extraer cantidad comprada
            filled_amount = safe_float(buy_result.get('filled', 0))
            if filled_amount <= 0:
                return self._create_operation_result("BUY_FAILED", "Cantidad comprada inválida")
            
            # Paso 3: Transferir activo al exchange de venta
            base_currency = symbol.split('/')[0]
            transfer_result = await self._transfer_asset_between_exchanges(
                buy_exchange, sell_exchange, base_currency, filled_amount
            )
            if not transfer_result['success']:
                return self._create_operation_result("ASSET_TRANSFER_FAILED", transfer_result['reason'])
            
            received_amount = transfer_result['received_amount']
            
            # Paso 4: Vender el activo
            sell_result = await self.exchange_manager.create_market_sell_order(
                sell_exchange, symbol, received_amount
            )
            if not sell_result:
                return self._create_operation_result("SELL_FAILED", "Error en orden de venta")
            
            # Calcular ganancia
            usdt_received = safe_float(sell_result.get('cost', 0))
            net_profit = usdt_received - investment_usdt
            
            # Paso 5: Devolver USDT al exchange principal (si es diferente)
            if sell_exchange != self.usdt_holder_exchange_id:
                return_result = await self._transfer_usdt_between_exchanges(
                    sell_exchange, self.usdt_holder_exchange_id, usdt_received
                )
                # Nota: Este paso es opcional y puede fallar sin afectar la operación principal
            
            return self._create_operation_result(
                "EXECUTED_REAL",
                "Operación real exitosa",
                {
                    'net_profit_usdt': net_profit,
                    'investment_usdt': investment_usdt,
                    'usdt_received': usdt_received,
                    'success': True,
                    'buy_order': buy_result,
                    'sell_order': sell_result
                }
            )
            
        except Exception as e:
            error_msg = f"Error ejecutando operación real: {e}"
            self.logger.error(error_msg)
            return self._create_operation_result("EXECUTION_ERROR", error_msg)
    
    async def _transfer_usdt_between_exchanges(
        self, 
        from_exchange: str, 
        to_exchange: str, 
        amount: float
    ) -> Dict:
        """Transfiere USDT entre exchanges."""
        try:
            # Obtener dirección de depósito del exchange destino
            deposit_address = await self.exchange_manager.get_deposit_address(to_exchange, 'USDT')
            if not deposit_address:
                return {'success': False, 'reason': 'No se pudo obtener dirección de depósito'}
            
            # Determinar la red más económica
            withdrawal_fees = await self.exchange_manager.get_withdrawal_fees(from_exchange, 'USDT')
            cheapest_network = find_cheapest_network(
                withdrawal_fees.get('USDT', {}).get('networks', []),
                PREFERRED_NETWORKS.get('USDT', [])
            )
            
            if not cheapest_network:
                return {'success': False, 'reason': 'No se encontró red de transferencia disponible'}
            
            # Realizar retiro
            withdrawal = await self.exchange_manager.withdraw(
                from_exchange,
                'USDT',
                amount,
                deposit_address['address'],
                cheapest_network['network'],
                deposit_address.get('tag')
            )
            
            if withdrawal:
                self.logger.info(f"Transferencia USDT iniciada: {amount} USDT de {from_exchange} a {to_exchange}")
                return {'success': True, 'withdrawal_id': withdrawal.get('id')}
            else:
                return {'success': False, 'reason': 'Error en retiro de USDT'}
                
        except Exception as e:
            return {'success': False, 'reason': f'Error en transferencia USDT: {e}'}
    
    async def _transfer_asset_between_exchanges(
        self, 
        from_exchange: str, 
        to_exchange: str, 
        currency: str, 
        amount: float
    ) -> Dict:
        """Transfiere un activo entre exchanges."""
        try:
            # Similar a _transfer_usdt_between_exchanges pero para otros activos
            deposit_address = await self.exchange_manager.get_deposit_address(to_exchange, currency)
            if not deposit_address:
                return {'success': False, 'reason': f'No se pudo obtener dirección de depósito para {currency}'}
            
            withdrawal_fees = await self.exchange_manager.get_withdrawal_fees(from_exchange, currency)
            cheapest_network = find_cheapest_network(
                withdrawal_fees.get(currency, {}).get('networks', []),
                PREFERRED_NETWORKS.get(currency, [])
            )
            
            if not cheapest_network:
                return {'success': False, 'reason': f'No se encontró red de transferencia para {currency}'}
            
            # Calcular cantidad después de fees
            withdrawal_fee = safe_float(cheapest_network.get('fee', 0))
            received_amount = amount - withdrawal_fee
            
            if received_amount <= 0:
                return {'success': False, 'reason': f'Cantidad insuficiente después de fees: {received_amount}'}
            
            withdrawal = await self.exchange_manager.withdraw(
                from_exchange,
                currency,
                amount,
                deposit_address['address'],
                cheapest_network['network'],
                deposit_address.get('tag')
            )
            
            if withdrawal:
                self.logger.info(f"Transferencia {currency} iniciada: {amount} de {from_exchange} a {to_exchange}")
                return {
                    'success': True, 
                    'withdrawal_id': withdrawal.get('id'),
                    'received_amount': received_amount
                }
            else:
                return {'success': False, 'reason': f'Error en retiro de {currency}'}
                
        except Exception as e:
            return {'success': False, 'reason': f'Error en transferencia {currency}: {e}'}
    
    def _create_operation_result(self, decision: str, reason: str, data: Dict = None) -> Dict:
        """Crea un resultado de operación estandarizado."""
        result = {
            'decision_outcome': decision,
            'reason': reason,
            'timestamp': get_current_timestamp(),
            'success': decision.startswith('EXECUTED')
        }
        
        if data:
            result.update(data)
        
        return result
    
    async def _update_trading_stats(self, operation_result: Dict):
        """Actualiza las estadísticas de trading."""
        self.trading_stats['operations_count'] += 1
        
        if operation_result.get('success', False):
            self.trading_stats['successful_operations'] += 1
            profit = safe_float(operation_result.get('net_profit_usdt', 0))
            self.trading_stats['total_profit_usdt'] += profit
        
        await self._save_trading_state()
    
    # Callbacks y getters
    
    def set_operation_complete_callback(self, callback: Callable):
        """Establece el callback para operaciones completadas."""
        self.on_operation_complete_callback = callback
    
    def set_trading_status_change_callback(self, callback: Callable):
        """Establece el callback para cambios de estado de trading."""
        self.on_trading_status_change_callback = callback
    
    def get_trading_stats(self) -> Dict:
        """Retorna las estadísticas de trading."""
        return self.trading_stats.copy()
    
    def is_trading_active(self) -> bool:
        """Retorna si el trading está activo."""
        return self.is_trading_active
    
    def get_current_operation(self) -> Optional[Dict]:
        """Retorna la operación actual si existe."""
        return self.current_operation

