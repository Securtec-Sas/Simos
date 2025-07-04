
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
        
        # Cargar estado previo si existe - Comentado según nuevos requisitos para inicio limpio
        # await self._load_trading_state()
        
        self.logger.info("TradingLogic inicializado (sin cargar estado previo).")
    
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