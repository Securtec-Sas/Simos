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
        self.logger = logging.getLogger("V3.TradingLogic")
        self.exchange_manager = exchange_manager
        self.data_persistence = data_persistence
        self.ai_model = ai_model or ArbitrageAIModel()
        
        # Estado del trading
        self.is_trading_active = False
        self.current_operation = None
        self.trading_stats = {
            "operations_count": 0,
            "successful_operations": 0,
            "total_profit_usdt": 0.0,
            "start_time": None
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
                self.is_trading_active = state.get("is_trading_active", False)
                self.usdt_holder_exchange_id = state.get("usdt_holder_exchange_id", "binance")
                self.global_sl_active_flag = state.get("global_sl_active_flag", False)
                self.trading_stats = state.get("trading_stats", self.trading_stats)
                
                self.logger.info(f"Estado de trading cargado - Activo: {self.is_trading_active}")
        except Exception as e:
            self.logger.error(f"Error cargando estado de trading: {e}")
    
    async def _save_trading_state(self):
        """Guarda el estado actual del trading."""
        try:
            state = {
                "is_trading_active": self.is_trading_active,
                "usdt_holder_exchange_id": self.usdt_holder_exchange_id,
                "global_sl_active_flag": self.global_sl_active_flag,
                "trading_stats": self.trading_stats,
                "current_operation": self.current_operation
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
        self.trading_stats["start_time"] = get_current_timestamp()
        
        # Aplicar configuración si se proporciona
        if config:
            self.usdt_holder_exchange_id = config.get("usdt_holder_exchange_id", self.usdt_holder_exchange_id)
        
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
        symbol = safe_dict_get(opportunity_data, "symbol", "N/A")
        
        try:
            self.current_operation = {
                "symbol": symbol,
                "start_time": operation_start_time,
                "status": "PROCESSING"
            }
            
            self.logger.info(f"Procesando oportunidad: {symbol}")
            
            # Crear diccionario de símbolo
            symbol_dict = create_symbol_dict(opportunity_data)
            
            # Validaciones iniciales
            validation_result = await self._validate_opportunity(symbol_dict)
            if not validation_result["valid"]:
                return self._create_operation_result("VALIDATION_FAILED", validation_result["reason"])
            
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
            if not market_data["valid"]:
                return self._create_operation_result("MARKET_DATA_ERROR", market_data["reason"])
            
            # Preparar datos para la IA
            ai_input_data = self._prepare_ai_input_data(
                symbol_dict, balance_config, investment_amount, market_data
            )
            
            # Decisión de la IA
            ai_decision = self.ai_model.predict(ai_input_data)
            ai_input_data["ai_decision"] = ai_decision
            
            self.logger.info(f"Decisión IA para {symbol}: {ai_decision["should_execute"]} (confianza: {ai_decision["confidence"]:.3f})")
            
            # Ejecutar operación si es rentable
            if ai_decision.get("should_execute", False):
                if SIMULATION_MODE:
                    execution_result = await self._simulate_operation(ai_input_data)
                else:
                    execution_result = await self._execute_real_operation(ai_input_data)
            else:
                execution_result = self._create_operation_result(
                    "NOT_PROFITABLE", 
                    ai_decision.get("reason", "Operación no rentable según IA")
                )
            
            # Retroalimentación al modelo de IA
            if execution_result.get("success", False) or execution_result.get("decision_outcome") == "NOT_PROFITABLE":
                self.ai_model.update_with_feedback(ai_input_data, execution_result)
            
            # Actualizar estadísticas
            await self._update_trading_stats(execution_result)
            
            # Registrar operación
            operation_log_data = {**ai_input_data, **execution_result}
            operation_log_data["execution_time_ms"] = (asyncio.get_event_loop().time() - operation_start_time) * 1000
            operation_log_data["ai_confidence"] = ai_decision.get("confidence", 0.0)
            
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
        buy_exchange = symbol_dict.get("buy_exchange_id")
        sell_exchange = symbol_dict.get("sell_exchange_id")
        
        if not buy_exchange or not sell_exchange:
            return {"valid": False, "reason": "Exchanges no especificados"}
        
        if buy_exchange == sell_exchange:
            return {"valid": False, "reason": "Exchanges de compra y venta son iguales"}
        
        # Verificar que los exchanges estén disponibles
        if not await self.exchange_manager.test_exchange_connection(buy_exchange):
            return {"valid": False, "reason": f"Exchange de compra no disponible: {buy_exchange}"}
        
        if not await self.exchange_manager.test_exchange_connection(sell_exchange):
            return {"valid": False, "reason": f"Exchange de venta no disponible: {sell_exchange}"}
        
        # Verificar que el símbolo exista en ambos exchanges
        symbol = symbol_dict.get("symbol")
        if not await self.exchange_manager.check_symbol_exists(buy_exchange, symbol):
            return {"valid": False, "reason": f"Símbolo {symbol} no existe en {buy_exchange}"}
        
        if not await self.exchange_manager.check_symbol_exists(sell_exchange, symbol):
            return {"valid": False, "reason": f"Símbolo {symbol} no existe en {sell_exchange}"}
        
        return {"valid": True, "reason": "Validación exitosa"}
    
    async def _get_balance_config(self) -> Optional[Dict]:
        """Obtiene la configuración de balance del exchange principal."""
        # Aquí se integraría con sebo_connector para obtener la configuración
        # Por ahora, retornamos una configuración por defecto
        return {
            "id_exchange": self.usdt_holder_exchange_id,
            "balance_usdt": 1000.0,  # Placeholder
            "investment_mode": DEFAULT_INVESTMENT_MODE,
            "investment_percentage": DEFAULT_INVESTMENT_PERCENTAGE,
            "fixed_investment_usdt": DEFAULT_FIXED_INVESTMENT_USDT,
            "stop_loss_percentage_global": 50.0,
            "initial_capital_for_global_sl": 1000.0
        }
    
    async def _check_global_stop_loss(self, balance_config: Dict) -> bool:
        """Verifica si el stop loss global está activado."""
        if self.global_sl_active_flag:
            return True
        
        current_balance = safe_float(balance_config.get("balance_usdt", 0))
        initial_capital = safe_float(balance_config.get("initial_capital_for_global_sl", 0))
        sl_percentage = safe_float(balance_config.get("stop_loss_percentage_global", 50))
        
        if initial_capital > 0:
            sl_threshold = initial_capital * (1 - (sl_percentage / 100.0))
            if current_balance < sl_threshold:
                self.global_sl_active_flag = True
                self.logger.warning(f"Stop loss global activado: {current_balance} < {sl_threshold}")
                return True
        
        return False
    
    def _calculate_investment_amount(self, balance_config: Dict) -> float:
        """Calcula el monto a invertir basado en la configuración."""
        current_balance = safe_float(balance_config.get("balance_usdt", 0))
        investment_mode = balance_config.get("investment_mode", DEFAULT_INVESTMENT_MODE)
        
        if current_balance < MIN_OPERATIONAL_USDT:
            return 0.0
        
        if current_balance < 150:
            return current_balance
        
        if investment_mode == "FIXED":
            amount = safe_float(balance_config.get("fixed_investment_usdt", DEFAULT_FIXED_INVESTMENT_USDT))
        elif investment_mode == "PERCENTAGE":
            percentage = safe_float(balance_config.get("investment_percentage", DEFAULT_INVESTMENT_PERCENTAGE))
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
            symbol = symbol_dict["symbol"]
            buy_exchange = symbol_dict["buy_exchange_id"]
            sell_exchange = symbol_dict["sell_exchange_id"]
            
            # Obtener precios actuales
            buy_ask, _ = await self.exchange_manager.get_current_prices(buy_exchange, symbol)
            _, sell_bid = await self.exchange_manager.get_current_prices(sell_exchange, symbol)
            
            if not buy_ask or not sell_bid:
                return {"valid": False, "reason": "No se pudieron obtener precios actuales"}
            
            # Obtener tarifas de trading
            buy_fees = await self.exchange_manager.get_trading_fees(buy_exchange, symbol)
            sell_fees = await self.exchange_manager.get_trading_fees(sell_exchange, symbol)
            
            # Obtener información de retiro (para el activo)
            base_currency = symbol.split("/")[0]  # Ej: BTC/USDT -> BTC
            withdrawal_info = await self.exchange_manager.get_withdrawal_fees(buy_exchange, base_currency)
            
            return {
                "valid": True,
                "buy_price": buy_ask,
                "sell_price": sell_bid,
                "buy_fees": buy_fees,
                "sell_fees": sell_fees,
                "withdrawal_info": withdrawal_info
            }
            
        except Exception as e:
            return {"valid": False, "reason": f"Error obteniendo datos de mercado: {e}"}
    
    def _prepare_ai_input_data(
        self, 
        symbol_dict: Dict, 
        balance_config: Dict, 
        investment_amount: float, 
        market_data: Dict
    ) -> Dict:
        """Prepara los datos de entrada para la IA."""
        return {
            "symbol": symbol_dict["symbol"],
            "symbol_name": symbol_dict.get("symbol_name", symbol_dict["symbol"]),
            "buy_exchange_id": symbol_dict["buy_exchange_id"],
            "sell_exchange_id": symbol_dict["sell_exchange_id"],
            "current_price_buy": market_data["buy_price"],
            "current_price_sell": market_data["sell_price"],
            "investment_usdt": investment_amount,
            "estimated_buy_fee": market_data["buy_fees"].get("percentage", 0.001),
            "estimated_sell_fee": market_data["sell_fees"].get("percentage", 0.001),
            "estimated_transfer_fee": find_cheapest_network(market_data["withdrawal_info"])
        }

    def get_current_operation(self) -> Optional[Dict]:
        """Retorna la operación actual en curso."""
        return self.current_operation

    def get_trading_stats(self) -> Dict:
        """Retorna las estadísticas de trading."""
        return self.trading_stats

    def _create_operation_result(self, outcome: str, reason: str, data: Dict = None) -> Dict:
        """Crea un diccionario de resultado de operación estandarizado."""
        result = {
            "decision_outcome": outcome,
            "reason": reason,
            "success": "EJECUTADA" in outcome,
            "timestamp": get_current_timestamp()
        }
        if data:
            result.update(data)
        return result

    async def _simulate_operation(self, ai_input_data: Dict) -> Dict:
        """Simula una operación de arbitraje."""
        await asyncio.sleep(SIMULATION_DELAY)
        # Simulación simple de éxito/fracaso
        success = np.random.choice([True, False], p=[0.8, 0.2])
        if success:
            profit = np.random.uniform(0.5, 5.0)
            return self._create_operation_result("EJECUTADA_EXITOSA_SIMULADA", "Simulación exitosa", {"net_profit_usdt": profit})
        else:
            loss = np.random.uniform(-1.0, -0.1)
            return self._create_operation_result("EJECUTADA_PERDIDA_SIMULADA", "Simulación fallida", {"net_profit_usdt": loss})

    async def _execute_real_operation(self, ai_input_data: Dict) -> Dict:
        """Ejecuta una operación de arbitraje real."""
        # Lógica para ejecutar la operación real
        # ...
        return self._create_operation_result("NOT_IMPLEMENTED", "La ejecución real no está implementada")

    async def _update_trading_stats(self, operation_result: Dict):
        """Actualiza las estadísticas de trading."""
        self.trading_stats["operations_count"] += 1
        if operation_result.get("success", False):
            self.trading_stats["successful_operations"] += 1
            profit = safe_float(operation_result.get("net_profit_usdt", 0.0))
            self.trading_stats["total_profit_usdt"] += profit
        await self._save_trading_state()

    def set_operation_complete_callback(self, callback: Callable):
        """Establece el callback para operación completada."""
        self.on_operation_complete_callback = callback

    def set_trading_status_change_callback(self, callback: Callable):
        """Establece el callback para cambio de estado de trading."""
        self.on_trading_status_change_callback = callback


