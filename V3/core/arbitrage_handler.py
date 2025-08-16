# V3/core/arbitrage_handler.py

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Callable
import json

from shared.config_v3 import MIN_PROFIT_USDT, MIN_PROFIT_PERCENTAGE
from shared.utils import safe_float, get_current_timestamp, create_symbol_dict
from core.ai_model import ArbitrageAIModel
from core.arbitrage_calculator import calculate_net_profitability
from core.arbitrage_executor import evaluate_and_simulate_arbitrage
from adapters.persistence.data_persistence import DataPersistence

class ArbitrageHandler:
    """Manejador principal para operaciones de arbitraje automático."""
    
    def __init__(self, ai_model: ArbitrageAIModel, data_persistence: DataPersistence, ui_broadcaster=None):
        self.logger = logging.getLogger('V3.ArbitrageHandler')
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        self.ui_broadcaster = ui_broadcaster
        
        # Estado del trading automático
        self.is_trading_active = False
        self.current_operations = {}  # Operaciones en curso
        self.trading_stats = {
            'total_operations': 0,
            'successful_operations': 0,
            'failed_operations': 0,
            'total_profit_usdt': 0.0,
            'total_loss_usdt': 0.0,
            'current_balance': 1000.0,  # Balance inicial por defecto
            'start_time': None
        }
        
        # Configuración de trading
        self.trading_config = {
            'usdt_holder_exchange_id': 'binance',
            'investment_mode': 'PERCENTAGE',
            'investment_percentage': 10,
            'fixed_investment_usdt': 100,
            'max_concurrent_operations': 3,
            'min_profit_threshold': MIN_PROFIT_USDT,
            'stop_loss_percentage': 50.0,
            'take_profit_percentage': None
        }
        
        # Queue para procesar oportunidades
        self.opportunity_queue = asyncio.Queue()
        self.processing_task = None
    
    async def initialize(self):
        """Inicializa el handler de arbitraje."""
        try:
            self.logger.info("Inicializando ArbitrageHandler...")
            
            # Cargar estado previo si existe
            await self._load_trading_state()
            
            self.logger.info("ArbitrageHandler inicializado correctamente")
            
        except Exception as e:
            self.logger.error(f"Error inicializando ArbitrageHandler: {e}")
            raise
    
    async def cleanup(self):
        """Limpia recursos del handler."""
        try:
            # Detener trading si está activo
            if self.is_trading_active:
                await self.stop_trading()
            
            # Cancelar tarea de procesamiento
            if self.processing_task and not self.processing_task.done():
                self.processing_task.cancel()
                try:
                    await self.processing_task
                except asyncio.CancelledError:
                    pass
            
            # Guardar estado
            await self._save_trading_state()
            
            self.logger.info("ArbitrageHandler limpiado correctamente")
            
        except Exception as e:
            self.logger.error(f"Error en cleanup de ArbitrageHandler: {e}")
    
    async def start_trading(self, config: Dict = None) -> Dict:
        """Inicia el trading automático."""
        try:
            if self.is_trading_active:
                return {
                    'success': False,
                    'message': 'Trading ya está activo'
                }
            
            # Actualizar configuración si se proporciona
            if config:
                self.trading_config.update(config)
            
            # Verificar que el modelo AI esté entrenado
            if not self.ai_model.is_trained:
                return {
                    'success': False,
                    'message': 'El modelo AI no está entrenado'
                }
            
            # Inicializar estado
            self.is_trading_active = True
            self.trading_stats['start_time'] = get_current_timestamp()
            self.current_operations.clear()
            
            # Iniciar tarea de procesamiento
            self.processing_task = asyncio.create_task(self._process_opportunities())
            
            await self._save_trading_state()
            
            self.logger.info(f"Trading automático iniciado con configuración: {self.trading_config}")
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'trading_started',
                    'payload': {
                        'config': self.trading_config,
                        'stats': self.trading_stats
                    }
                })
            
            return {
                'success': True,
                'message': 'Trading automático iniciado',
                'config': self.trading_config
            }
            
        except Exception as e:
            self.is_trading_active = False
            error_msg = f"Error iniciando trading: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def stop_trading(self) -> Dict:
        """Detiene el trading automático."""
        try:
            if not self.is_trading_active:
                return {
                    'success': False,
                    'message': 'Trading no está activo'
                }
            
            self.is_trading_active = False
            
            # Cancelar tarea de procesamiento
            if self.processing_task and not self.processing_task.done():
                self.processing_task.cancel()
                try:
                    await self.processing_task
                except asyncio.CancelledError:
                    pass
            
            # Esperar a que las operaciones activas se completen
            await self._wait_for_operations_completion()
            
            await self._save_trading_state()
            
            self.logger.info("Trading automático detenido")
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'trading_stopped',
                    'payload': {
                        'stats': self.trading_stats,
                        'final_balance': self.trading_stats['current_balance']
                    }
                })
            
            return {
                'success': True,
                'message': 'Trading automático detenido',
                'final_stats': self.trading_stats
            }
            
        except Exception as e:
            error_msg = f"Error deteniendo trading: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def process_opportunity(self, opportunity_data: Dict) -> Dict:
        """Procesa una oportunidad de arbitraje."""
        try:
            if not self.is_trading_active:
                return {
                    'success': False,
                    'message': 'Trading no está activo'
                }
            
            # Verificar límite de operaciones concurrentes
            active_ops = len([op for op in self.current_operations.values() 
                            if op['status'] in ['PROCESSING', 'EXECUTING']])
            
            if active_ops >= self.trading_config['max_concurrent_operations']:
                return {
                    'success': False,
                    'message': 'Límite de operaciones concurrentes alcanzado'
                }
            
            # Agregar a la cola de procesamiento
            await self.opportunity_queue.put(opportunity_data)
            
            return {
                'success': True,
                'message': 'Oportunidad agregada a la cola de procesamiento'
            }
            
        except Exception as e:
            error_msg = f"Error procesando oportunidad: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def _process_opportunities(self):
        """Procesa oportunidades de la cola."""
        try:
            while self.is_trading_active:
                try:
                    # Obtener oportunidad de la cola con timeout
                    opportunity_data = await asyncio.wait_for(
                        self.opportunity_queue.get(), 
                        timeout=1.0
                    )
                    
                    # Procesar la oportunidad
                    await self._execute_arbitrage_operation(opportunity_data)
                    
                except asyncio.TimeoutError:
                    # Timeout normal, continuar
                    continue
                except asyncio.CancelledError:
                    # Tarea cancelada, salir
                    break
                except Exception as e:
                    self.logger.error(f"Error procesando oportunidad: {e}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Error en proceso de oportunidades: {e}")
    
    async def _execute_arbitrage_operation(self, opportunity_data: Dict):
        """Ejecuta una operación de arbitraje completa."""
        operation_id = f"op_{int(datetime.now().timestamp() * 1000)}"
        
        try:
            # Crear símbolo dict
            symbol_dict = create_symbol_dict(opportunity_data)
            symbol = symbol_dict.get('symbol', 'UNKNOWN')
            
            # Crear registro de operación
            operation = {
                'id': operation_id,
                'symbol': symbol,
                'symbol_dict': symbol_dict,
                'opportunity_data': opportunity_data,
                'status': 'PROCESSING',
                'start_time': get_current_timestamp(),
                'end_time': None,
                'profit_loss': 0.0,
                'steps': []
            }
            
            self.current_operations[operation_id] = operation
            
            self.logger.info(f"Iniciando operación de arbitraje: {operation_id} - {symbol}")
            
            # Paso 1: Preparar datos para AI
            ai_input_data = await self._prepare_ai_data(symbol_dict, opportunity_data)
            operation['ai_input_data'] = ai_input_data
            operation['steps'].append({
                'step': 'AI_DATA_PREPARED',
                'timestamp': get_current_timestamp(),
                'description': 'Datos preparados para análisis AI'
            })
            
            # Paso 2: Decisión del modelo AI
            ai_decision = self.ai_model.predict(ai_input_data)
            operation['ai_decision'] = ai_decision
            operation['steps'].append({
                'step': 'AI_DECISION',
                'timestamp': get_current_timestamp(),
                'description': f"Decisión AI: {ai_decision.get('should_execute', False)} (confianza: {ai_decision.get('confidence', 0):.3f})"
            })
            
            self.logger.info(f"Decisión AI para {symbol}: {ai_decision.get('should_execute', False)} (confianza: {ai_decision.get('confidence', 0):.3f})")
            
            if not ai_decision.get('should_execute', False):
                # AI decidió no ejecutar
                operation['status'] = 'REJECTED_BY_AI'
                operation['end_time'] = get_current_timestamp()
                operation['steps'].append({
                    'step': 'REJECTED',
                    'timestamp': get_current_timestamp(),
                    'description': f"Operación rechazada por AI: {ai_decision.get('reason', 'No rentable')}"
                })
                
                await self._finalize_operation(operation)
                return
            
            # Paso 3: Calcular rentabilidad
            investment_amount = self._calculate_investment_amount()
            profitability_results = calculate_net_profitability(ai_input_data, investment_amount)
            
            operation['profitability_results'] = profitability_results
            operation['investment_amount'] = investment_amount
            operation['steps'].append({
                'step': 'PROFITABILITY_CALCULATED',
                'timestamp': get_current_timestamp(),
                'description': f"Rentabilidad calculada: {profitability_results.get('net_profit_usdt', 0):.4f} USDT"
            })
            
            if profitability_results.get('error_message'):
                operation['status'] = 'CALCULATION_ERROR'
                operation['end_time'] = get_current_timestamp()
                operation['error_message'] = profitability_results['error_message']
                await self._finalize_operation(operation)
                return
            
            # Paso 4: Evaluar y simular arbitraje
            operation['status'] = 'EXECUTING'
            
            # Preparar datos completos para evaluación
            complete_ai_data = {
                **ai_input_data,
                'net_profitability_results': profitability_results,
                'current_balance_config_v2': {
                    'stop_loss_percentage_operation': self.trading_config['stop_loss_percentage'],
                    'take_profit_percentage_operation': self.trading_config['take_profit_percentage']
                },
                'determined_investment_usdt_v2': investment_amount
            }
            
            # Ejecutar simulación/operación
            execution_results = await evaluate_and_simulate_arbitrage(complete_ai_data, None)
            
            operation['execution_results'] = execution_results
            operation['profit_loss'] = execution_results.get('final_simulated_profit_usdt', 0.0)
            operation['status'] = 'COMPLETED'
            operation['end_time'] = get_current_timestamp()
            
            operation['steps'].append({
                'step': 'EXECUTION_COMPLETED',
                'timestamp': get_current_timestamp(),
                'description': f"Operación completada: {execution_results.get('decision_outcome', 'UNKNOWN')} - Profit: {operation['profit_loss']:.4f} USDT"
            })
            
            # Actualizar estadísticas
            await self._update_trading_stats(operation)
            
            # Finalizar operación
            await self._finalize_operation(operation)
            
            self.logger.info(f"Operación {operation_id} completada: {execution_results.get('decision_outcome', 'UNKNOWN')} - Profit: {operation['profit_loss']:.4f} USDT")
            
        except Exception as e:
            error_msg = f"Error ejecutando operación {operation_id}: {e}"
            self.logger.error(error_msg)
            
            if operation_id in self.current_operations:
                operation = self.current_operations[operation_id]
                operation['status'] = 'ERROR'
                operation['end_time'] = get_current_timestamp()
                operation['error_message'] = str(e)
                operation['steps'].append({
                    'step': 'ERROR',
                    'timestamp': get_current_timestamp(),
                    'description': f"Error en operación: {str(e)}"
                })
                
                await self._finalize_operation(operation)
    
    async def _prepare_ai_data(self, symbol_dict: Dict, opportunity_data: Dict) -> Dict:
        """Prepara los datos para el análisis del modelo AI."""
        try:
            # Obtener precios actuales
            buy_price = safe_float(opportunity_data.get('sell_price', 0))  # Precio donde compramos
            sell_price = safe_float(opportunity_data.get('buy_price', 0))  # Precio donde vendemos
            
            # Calcular monto de inversión
            investment_amount = self._calculate_investment_amount()
            
            # Estimar fees
            estimated_buy_fee = 0.001  # 0.1% fee estimado
            estimated_sell_fee = 0.001  # 0.1% fee estimado
            estimated_transfer_fee = 1.0  # 1 USDT fee de transferencia estimado
            
            return {
                'symbol': symbol_dict.get('symbol', 'UNKNOWN'),
                'symbol_name': symbol_dict.get('symbol_name', symbol_dict.get('symbol', 'UNKNOWN')),
                'buy_exchange_id': symbol_dict.get('exchange_sell', 'unknown'),
                'sell_exchange_id': symbol_dict.get('exchange_buy', 'unknown'),
                'current_price_buy': buy_price,
                'current_price_sell': sell_price,
                'investment_usdt': investment_amount,
                'estimated_buy_fee': estimated_buy_fee,
                'estimated_sell_fee': estimated_sell_fee,
                'estimated_transfer_fee': estimated_transfer_fee,
                'balance_config': {
                    'balance_usdt': self.trading_stats['current_balance']
                },
                'timestamp': get_current_timestamp()
            }
            
        except Exception as e:
            self.logger.error(f"Error preparando datos AI: {e}")
            return {}
    
    def _calculate_investment_amount(self) -> float:
        """Calcula el monto a invertir basado en la configuración."""
        current_balance = self.trading_stats['current_balance']
        
        if self.trading_config['investment_mode'] == 'FIXED':
            amount = self.trading_config['fixed_investment_usdt']
        else:  # PERCENTAGE
            percentage = self.trading_config['investment_percentage']
            amount = current_balance * (percentage / 100.0)
        
        # Asegurar que no exceda el balance disponible
        return min(amount, current_balance * 0.9)  # Máximo 90% del balance
    
    async def _update_trading_stats(self, operation: Dict):
        """Actualiza las estadísticas de trading."""
        try:
            self.trading_stats['total_operations'] += 1
            
            profit_loss = operation.get('profit_loss', 0.0)
            execution_results = operation.get('execution_results', {})
            decision_outcome = execution_results.get('decision_outcome', '')
            
            if 'EJECUTADA' in decision_outcome and profit_loss > 0:
                self.trading_stats['successful_operations'] += 1
                self.trading_stats['total_profit_usdt'] += profit_loss
                self.trading_stats['current_balance'] += profit_loss
            else:
                self.trading_stats['failed_operations'] += 1
                if profit_loss < 0:
                    self.trading_stats['total_loss_usdt'] += abs(profit_loss)
                    self.trading_stats['current_balance'] += profit_loss  # Restar pérdida
            
            await self._save_trading_state()
            
        except Exception as e:
            self.logger.error(f"Error actualizando estadísticas: {e}")
    
    async def _finalize_operation(self, operation: Dict):
        """Finaliza una operación y la guarda en la base de datos."""
        try:
            # Guardar en base de datos
            await self.data_persistence.save_arbitrage_operation(operation)
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'arbitrage_operation_result',
                    'payload': {
                        'operation_id': operation['id'],
                        'symbol': operation['symbol'],
                        'status': operation['status'],
                        'profit_loss': operation.get('profit_loss', 0.0),
                        'execution_time': operation.get('end_time', '') if operation.get('end_time') else '',
                        'decision_outcome': operation.get('execution_results', {}).get('decision_outcome', ''),
                        'current_balance': self.trading_stats['current_balance'],
                        'stats': self.trading_stats
                    }
                })
            
            # Remover de operaciones activas
            if operation['id'] in self.current_operations:
                del self.current_operations[operation['id']]
            
        except Exception as e:
            self.logger.error(f"Error finalizando operación: {e}")
    
    async def _wait_for_operations_completion(self, timeout: int = 60):
        """Espera a que las operaciones activas se completen."""
        try:
            start_time = asyncio.get_event_loop().time()
            
            while self.current_operations and (asyncio.get_event_loop().time() - start_time) < timeout:
                await asyncio.sleep(1)
            
            # Si aún hay operaciones activas después del timeout, marcarlas como canceladas
            for operation in self.current_operations.values():
                if operation['status'] in ['PROCESSING', 'EXECUTING']:
                    operation['status'] = 'CANCELLED'
                    operation['end_time'] = get_current_timestamp()
                    operation['steps'].append({
                        'step': 'CANCELLED',
                        'timestamp': get_current_timestamp(),
                        'description': 'Operación cancelada por detención de trading'
                    })
                    await self._finalize_operation(operation)
            
        except Exception as e:
            self.logger.error(f"Error esperando finalización de operaciones: {e}")
    
    async def _load_trading_state(self):
        """Carga el estado previo del trading."""
        try:
            state = await self.data_persistence.load_arbitrage_state()
            if state:
                self.trading_stats = state.get('trading_stats', self.trading_stats)
                self.trading_config = state.get('trading_config', self.trading_config)
                self.logger.info("Estado de trading cargado desde base de datos")
        except Exception as e:
            self.logger.error(f"Error cargando estado de trading: {e}")
    
    async def _save_trading_state(self):
        """Guarda el estado actual del trading."""
        try:
            state = {
                'trading_stats': self.trading_stats,
                'trading_config': self.trading_config,
                'is_trading_active': self.is_trading_active,
                'saved_at': get_current_timestamp()
            }
            await self.data_persistence.save_arbitrage_state(state)
        except Exception as e:
            self.logger.error(f"Error guardando estado de trading: {e}")
    
    def get_trading_status(self) -> Dict:
        """Retorna el estado actual del trading."""
        return {
            'is_active': self.is_trading_active,
            'stats': self.trading_stats,
            'config': self.trading_config,
            'active_operations': len(self.current_operations),
            'queue_size': self.opportunity_queue.qsize()
        }
    
    def get_active_operations(self) -> List[Dict]:
        """Retorna las operaciones activas."""
        return list(self.current_operations.values())