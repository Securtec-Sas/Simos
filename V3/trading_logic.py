
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
from data_persistence import DataPersistence # Aún necesario para log_operation_to_csv
from ai_model import ArbitrageAIModel
from sebo_connector import SeboConnector # Importar SeboConnector

class TradingLogic:
    """Maneja la lógica central de trading y arbitraje."""
    
    # Añadir sebo_connector a __init__
    def __init__(self, exchange_manager: ExchangeManager, data_persistence: DataPersistence, ai_model: ArbitrageAIModel, sebo_connector: SeboConnector):
        self.logger = logging.getLogger('V3.TradingLogic')
        self.exchange_manager = exchange_manager
        self.data_persistence = data_persistence # Para logs CSV
        self.ai_model = ai_model or ArbitrageAIModel()
        self.sebo_connector = sebo_connector # Guardar instancia de SeboConnector
        
        # Estado del trading - estos son los valores por defecto si no se carga nada de Sebo
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
        """Inicializa el módulo de trading logic, cargando el estado desde Sebo API."""
        self.logger.info("Inicializando TradingLogic...")
        await self._load_state_from_sebo_api()
        self.logger.info(f"TradingLogic inicializado. Estado activo: {self.is_trading_active}")
    
    async def cleanup(self):
        """Limpia recursos y guarda el estado final en Sebo API."""
        self.logger.info("Limpiando TradingLogic y guardando estado final en Sebo API...")
        await self._save_state_to_sebo_api()
        self.logger.info("TradingLogic limpiado y estado guardado.")
    
    # Gestión de estado con Sebo API
    
    async def _load_state_from_sebo_api(self):
        """Carga el estado de trading desde Sebo API."""
        self.logger.debug("Cargando estado de trading desde Sebo API...")
        state = await self.sebo_connector.get_v3_trading_state()
        if state:
            self.is_trading_active = state.get('is_trading_active', False)
            self.usdt_holder_exchange_id = state.get('usdt_holder_exchange_id', "binance")
            self.global_sl_active_flag = state.get('global_sl_active_flag', False)
            # trading_stats podría ser más complejo de sincronizar,
            # por ahora se reinicia o se podría considerar obtenerlo también si Sebo lo guarda.
            # self.trading_stats = state.get('trading_stats', self.trading_stats)
            self.logger.info(f"Estado de V3 cargado desde Sebo API: trading_active={self.is_trading_active}")
        else:
            self.logger.warning("No se pudo cargar el estado de V3 desde Sebo API. Usando valores por defecto.")
            # Los valores por defecto ya están establecidos en __init__

    async def _save_state_to_sebo_api(self):
        """Guarda el estado actual del trading en Sebo API."""
        self.logger.debug("Guardando estado de trading en Sebo API...")
        state_to_save = {
            'is_trading_active': self.is_trading_active,
            'usdt_holder_exchange_id': self.usdt_holder_exchange_id,
            'global_sl_active_flag': self.global_sl_active_flag,
            # 'trading_stats': self.trading_stats, # Decidir si esto se guarda centralizadamente
            # 'current_operation': self.current_operation # current_operation es efímero
        }
        success = await self.sebo_connector.update_v3_trading_state(state_to_save)
        if success:
            self.logger.info("Estado de V3 guardado exitosamente en Sebo API.")
        else:
            self.logger.error("Error guardando estado de V3 en Sebo API.")
    
    # Control de trading
    
    async def start_trading(self, config: Dict = None):
        """Inicia el trading automatizado y guarda el nuevo estado."""
        if self.is_trading_active:
            self.logger.warning("Trading ya está activo.")
            if self.on_trading_status_change_callback: # Notificar a UI de todas formas
                await self.on_trading_status_change_callback(self.is_trading_active)
            return

        self.is_trading_active = True
        self.logger.info("Trading activado.")

        # Aplicar configuraciones específicas si se proporcionan
        if config:
            self.usdt_holder_exchange_id = config.get('usdt_holder_exchange_id', self.usdt_holder_exchange_id)
            # ... otras configuraciones ...
            self.logger.info(f"Configuración de trading aplicada: {config}")

        await self._save_state_to_sebo_api() # Guardar el nuevo estado activo
        if self.on_trading_status_change_callback:
            await self.on_trading_status_change_callback(self.is_trading_active)

    async def stop_trading(self):
        """Detiene el trading automatizado y guarda el nuevo estado."""
        if not self.is_trading_active:
            self.logger.warning("Trading ya está inactivo.")
            if self.on_trading_status_change_callback: # Notificar a UI de todas formas
                await self.on_trading_status_change_callback(self.is_trading_active)
            return

        self.is_trading_active = False
        self.logger.info("Trading desactivado.")
        # Aquí podrías añadir lógica para cancelar órdenes abiertas si es necesario

        await self._save_state_to_sebo_api() # Guardar el nuevo estado inactivo
        if self.on_trading_status_change_callback:
            await self.on_trading_status_change_callback(self.is_trading_active)

    def is_trading_active(self) -> bool:
        """Retorna si el trading está activo."""
        return self.is_trading_active

    def get_trading_stats(self) -> Dict:
        """Retorna las estadísticas actuales de trading."""
        return self.trading_stats.copy()

    def get_current_operation(self) -> Optional[Dict]:
        """Retorna la operación actual en curso, si existe."""
        return self.current_operation

    # Callbacks
    def set_operation_complete_callback(self, callback: Callable):
        self.on_operation_complete_callback = callback

    def set_trading_status_change_callback(self, callback: Callable):
        self.on_trading_status_change_callback = callback

    # Lógica de procesamiento de oportunidades (placeholder, requiere implementación completa)
    async def process_arbitrage_opportunity(self, opportunity_data: Dict) -> Dict:
        """
        Procesa una oportunidad de arbitrage. Esta es una función crítica
        que contendrá la lógica de decisión, ejecución de órdenes, etc.
        """
        start_time = get_current_timestamp(ms=True)
        self.current_operation = opportunity_data
        self.logger.info(f"Procesando oportunidad: {opportunity_data.get('symbol')}")

        # 0. Crear un diccionario de resultado para esta operación
        operation_result = create_symbol_dict(opportunity_data.get('symbol', 'UNKNOWN'))
        operation_result.update(opportunity_data) # Copiar datos iniciales

        # 1. Validaciones Previas
        if not self.is_trading_active:
            operation_result['decision_outcome'] = "NO_EJECUTADA_TRADING_INACTIVO"
            self.logger.warning("Trading inactivo, no se procesa oportunidad.")
            await self._finalize_operation(operation_result, start_time)
            return operation_result

        # (Aquí irían más validaciones: balance suficiente, configuración, etc.)
        # balance_ok = await self._check_balance_for_operation(opportunity_data)
        # if not balance_ok:
        #     return self._prepare_result(opportunity_data, "NO_EJECUTADA_BALANCE_INSUFICIENTE")

        # 2. Decisión con Modelo AI (si está disponible y entrenado)
        ai_prediction = None
        if self.ai_model and self.ai_model.is_trained:
            # Enriquecer opportunity_data con lo que necesite prepare_features
            # ej. opportunity_data['investment_usdt'] = self._calculate_investment_amount(...)
            # ej. opportunity_data['balance_config'] = await self._get_balance_config_for_exchanges(...)

            # Simulación simple de datos necesarios para el modelo AI
            opportunity_data_for_ai = {**opportunity_data}
            if 'investment_usdt' not in opportunity_data_for_ai: # Asegurar que exista
                 # Calcular inversión basada en configuración por defecto y balance (simulado o real)
                current_usdt_balance = await self._get_current_usdt_balance()
                opportunity_data_for_ai['investment_usdt'] = self._calculate_investment_amount(current_usdt_balance)
            if 'balance_config' not in opportunity_data_for_ai: # Placeholder
                 opportunity_data_for_ai['balance_config'] = {'balance_usdt': current_usdt_balance}


            ai_prediction = self.ai_model.predict(opportunity_data_for_ai)
            operation_result['ai_prediction'] = ai_prediction
            self.logger.info(f"Predicción AI: {ai_prediction}")
            if not ai_prediction.get('should_execute', False):
                operation_result['decision_outcome'] = f"NO_EJECUTADA_AI_NO_RECOMIENDA ({ai_prediction.get('reason', '')})"
                await self._finalize_operation(operation_result, start_time)
                return operation_result
        else:
            # Lógica fallback si no hay AI o no está entrenado
            if not is_profitable_operation(opportunity_data, MIN_PROFIT_PERCENTAGE, MIN_PROFIT_USDT):
                operation_result['decision_outcome'] = "NO_EJECUTADA_NO_RENTABLE_BASICO"
                await self._finalize_operation(operation_result, start_time)
                return operation_result
            self.logger.info("Modelo AI no disponible o no entrenado, usando lógica básica de rentabilidad.")

        # 3. Ejecución de la Operación (Simulada o Real)
        # Esta parte es compleja y requiere manejo de errores detallado.
        # Por ahora, un placeholder que asume éxito si la AI lo recomienda o es rentable.

        if SIMULATION_MODE:
            self.logger.info(f"MODO SIMULACIÓN: Ejecutando operación para {opportunity_data.get('symbol')}")
            await asyncio.sleep(SIMULATION_DELAY) # Simular tiempo de ejecución
            # En simulación, podríamos estimar un profit basado en la oportunidad
            # y añadir algo de aleatoriedad para simular slippage/fees no perfectos.
            sim_profit = (opportunity_data.get('investment_usdt', 10) *
                          (safe_float(opportunity_data.get('percentage_difference', 0)) / 100))
            sim_profit *= random.uniform(0.7, 0.95) # Simular fees y slippage

            operation_result['decision_outcome'] = "EJECUTADA_SIMULACION"
            operation_result['net_profit_usdt'] = sim_profit
            operation_result['success'] = True
        else:
            # LÓGICA DE TRADING REAL IRÍA AQUÍ
            # - Calcular montos exactos de compra/venta
            # - Verificar balances en exchanges
            # - Colocar orden de compra en exchange_min
            # - Monitorear ejecución de orden de compra
            # - Transferir activo a exchange_max (si son diferentes y necesario)
            # - Monitorear transferencia
            # - Colocar orden de venta en exchange_max
            # - Monitorear ejecución de orden de venta
            # - Calcular profit/loss real
            self.logger.warning(f"TRADING REAL NO IMPLEMENTADO COMPLETAMENTE para {opportunity_data.get('symbol')}")
            operation_result['decision_outcome'] = "NO_EJECUTADA_TRADING_REAL_NO_IMPL"
            operation_result['net_profit_usdt'] = 0.0 # Placeholder
            operation_result['success'] = False # Asumir no exitoso hasta que se implemente

        await self._finalize_operation(operation_result, start_time)
        return operation_result

    async def _finalize_operation(self, result: Dict, start_time_ms: float):
        """Finaliza una operación, calcula métricas y loguea."""
        end_time_ms = get_current_timestamp(ms=True)
        result['execution_time_ms'] = end_time_ms - start_time_ms
        
        if result.get('success', False):
            self.trading_stats['successful_operations'] += 1
            self.trading_stats['total_profit_usdt'] += result.get('net_profit_usdt', 0)

        self.trading_stats['operations_count'] += 1

        self.logger.info(format_operation_summary(result))
        await self.data_persistence.log_operation_to_csv(result) # Loguear a CSV

        self.current_operation = None # Limpiar operación actual
        if self.on_operation_complete_callback:
            await self.on_operation_complete_callback(result)

    async def _get_current_usdt_balance(self) -> float:
        """Obtiene el balance USDT actual del exchange principal. Placeholder."""
        # En una implementación real, esto consultaría ExchangeManager
        # o un caché de balances mantenido por SeboConnector/DataPersistence.
        # Por ahora, un valor fijo o de la configuración de TradingLogic.

        # Intenta obtenerlo del sebo_connector si está disponible y tiene balances
        if self.sebo_connector and self.sebo_connector.latest_balances:
            holder_balance_info = self.sebo_connector.latest_balances.get(self.usdt_holder_exchange_id)
            if holder_balance_info and 'USDT' in holder_balance_info:
                return safe_float(holder_balance_info['USDT'].get('free', 0.0))

        self.logger.warning(f"No se pudo obtener balance USDT real para {self.usdt_holder_exchange_id}, usando {MIN_OPERATIONAL_USDT} como fallback.")
        return MIN_OPERATIONAL_USDT # Fallback a un mínimo operacional

    def _calculate_investment_amount(self, available_usdt_balance: float) -> float:
        """Calcula el monto de inversión basado en la configuración y el balance."""
        investment_amount = 0.0
        if DEFAULT_INVESTMENT_MODE == "PERCENTAGE":
            investment_amount = available_usdt_balance * (DEFAULT_INVESTMENT_PERCENTAGE / 100.0)
        elif DEFAULT_INVESTMENT_MODE == "FIXED":
            investment_amount = DEFAULT_FIXED_INVESTMENT_USDT

        # Asegurar que no exceda el balance disponible y que sea al menos el mínimo operacional
        investment_amount = min(investment_amount, available_usdt_balance)
        investment_amount = max(investment_amount, MIN_OPERATIONAL_USDT if available_usdt_balance >= MIN_OPERATIONAL_USDT else 0)

        return investment_amount

    # Aquí podrían ir más métodos privados para:
    # - _calculate_fees(exchange_id, symbol, amount, price, side)
    # - _execute_buy_leg(...)
    # - _execute_sell_leg(...)
    # - _handle_transfer_between_exchanges(...)
    # - _check_slippage_and_price_changes(...)
    # - etc.