# Simos/V3/core/advanced_simulation_engine.py

import asyncio
import logging
import random
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple, Callable
import pandas as pd
import numpy as np
from enum import Enum

from shared.config_v3 import (
    SIMULATION_DELAY, MIN_PROFIT_USDT, MIN_PROFIT_PERCENTAGE,
    SEBO_API_BASE_URL, PREFERRED_NETWORKS
)
from shared.utils import (
    safe_float, safe_dict_get, get_current_timestamp, 
    create_symbol_dict, find_cheapest_network, make_http_request
)
from core.ai_model import ArbitrageAIModel
from adapters.persistence.data_persistence import DataPersistence
from adapters.exchanges.exchange_manager import ExchangeManager

class SimulationMode(Enum):
    """Modos de simulación disponibles."""
    LOCAL = "local"  # Simulación local con datos del socket
    SEBO_SANDBOX = "sebo_sandbox"  # Simulación usando API sandbox de Sebo
    REAL = "real"  # Operaciones reales en exchanges

class TransactionStep(Enum):
    """Pasos de una transacción de arbitraje."""
    PENDING = "pending"
    WITHDRAWING_USDT = "withdrawing_usdt"
    BUYING_ASSET = "buying_asset"
    TRANSFERRING_ASSET = "transferring_asset"
    SELLING_ASSET = "selling_asset"
    COMPLETED = "completed"
    FAILED = "failed"

class AdvancedSimulationEngine:
    """Motor de simulación avanzado con dos modalidades: local y sandbox."""
    
    def __init__(
        self, 
        ai_model: ArbitrageAIModel, 
        data_persistence: DataPersistence,
        exchange_manager: ExchangeManager = None,
        ui_broadcaster = None
    ):
        self.logger = logging.getLogger('V3.AdvancedSimulationEngine')
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        self.exchange_manager = exchange_manager
        self.ui_broadcaster = ui_broadcaster
        
        # Estado de simulación
        self.is_simulation_running = False
        self.current_mode = SimulationMode.LOCAL
        self.active_transactions: Dict[str, Dict] = {}
        
        # Configuración de simulación
        self.simulation_config = {
            'initial_balance': 1000.0,
            'time_between_transfers': 2.0,  # segundos entre transferencias
            'simulation_duration': 3600,  # duración en segundos (1 hora por defecto)
            'max_concurrent_operations': 3,
            'network_delay_range': (0.5, 3.0),
            'slippage_range': (0.001, 0.01),
            'success_rate': 0.85,  # 85% de éxito por defecto
            'commission_rates': {
                'usdt_withdrawal': 1.0,  # 1 USDT fijo
                'asset_withdrawal_percentage': 0.001,  # 0.1%
                'trading_fee_percentage': 0.001  # 0.1%
            }
        }
        
        # Estadísticas
        self.simulation_stats = {
            'total_operations': 0,
            'successful_operations': 0,
            'failed_operations': 0,
            'total_profit_usdt': 0.0,
            'total_loss_usdt': 0.0,
            'current_balance': 0.0,
            'start_time': None,
            'end_time': None,
            'transactions_log': []
        }
        
        # HTTP session para API calls
        self.http_session = None
    
    async def initialize(self):
        """Inicializa el motor de simulación."""
        try:
            self.logger.info("Inicializando AdvancedSimulationEngine...")
            
            # Inicializar sesión HTTP si no existe
            if not self.http_session:
                import aiohttp
                self.http_session = aiohttp.ClientSession()
            
            self.logger.info("AdvancedSimulationEngine inicializado correctamente")
            
        except Exception as e:
            self.logger.error(f"Error inicializando AdvancedSimulationEngine: {e}")
            raise
    
    async def cleanup(self):
        """Limpia recursos del motor de simulación."""
        try:
            # Detener simulación si está corriendo
            if self.is_simulation_running:
                await self.stop_simulation()
            
            # Cerrar sesión HTTP
            if self.http_session and not self.http_session.closed:
                await self.http_session.close()
            
            self.logger.info("AdvancedSimulationEngine limpiado correctamente")
            
        except Exception as e:
            self.logger.error(f"Error en cleanup de AdvancedSimulationEngine: {e}")
    
    def update_simulation_config(self, config: Dict):
        """Actualiza la configuración de simulación."""
        self.simulation_config.update(config)
        self.logger.info(f"Configuración de simulación actualizada: {config}")
    
    async def start_simulation(
        self, 
        mode: SimulationMode = SimulationMode.LOCAL,
        config: Dict = None
    ) -> Dict:
        """Inicia una simulación en el modo especificado."""
        if self.is_simulation_running:
            return {
                'success': False,
                'message': 'Ya hay una simulación en curso'
            }
        
        try:
            # Actualizar configuración si se proporciona
            if config:
                self.update_simulation_config(config)
            
            # Establecer modo de simulación
            self.current_mode = mode
            self.is_simulation_running = True
            
            # Inicializar estadísticas
            self.simulation_stats = {
                'total_operations': 0,
                'successful_operations': 0,
                'failed_operations': 0,
                'total_profit_usdt': 0.0,
                'total_loss_usdt': 0.0,
                'current_balance': self.simulation_config['initial_balance'],
                'start_time': get_current_timestamp(),
                'end_time': None,
                'transactions_log': []
            }
            
            self.active_transactions.clear()
            
            self.logger.info(f"Simulación iniciada en modo {mode.value}")
            
            # Notificar a UI si está disponible
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'simulation_started',
                    'payload': {
                        'mode': mode.value,
                        'config': self.simulation_config,
                        'initial_balance': self.simulation_stats['current_balance']
                    }
                })
            
            return {
                'success': True,
                'message': f'Simulación iniciada en modo {mode.value}',
                'simulation_id': f"sim_{int(time.time())}",
                'config': self.simulation_config
            }
            
        except Exception as e:
            self.is_simulation_running = False
            error_msg = f"Error iniciando simulación: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def stop_simulation(self, force_stop: bool = False) -> Dict:
        """Detiene la simulación actual."""
        if not self.is_simulation_running:
            return {
                'success': False,
                'message': 'No hay simulación en curso'
            }
        
        try:
            # Marcar que se está deteniendo para evitar nuevas operaciones
            self.is_simulation_running = False
            
            if not force_stop:
                # Esperar a que las transacciones activas se completen
                self.logger.info("Esperando a que las transacciones activas se completen...")
                
                # Notificar a UI que se está deteniendo
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_message({
                        'type': 'simulation_stopping',
                        'payload': {
                            'message': 'Esperando a que las operaciones activas se completen...',
                            'active_transactions': len([tx for tx in self.active_transactions.values() 
                                                      if tx['step'] not in [TransactionStep.COMPLETED, TransactionStep.FAILED]])
                        }
                    })
                
                # Esperar hasta que todas las transacciones se completen o timeout
                timeout = 60  # 60 segundos máximo
                start_wait = time.time()
                
                while time.time() - start_wait < timeout:
                    active_count = len([tx for tx in self.active_transactions.values() 
                                      if tx['step'] not in [TransactionStep.COMPLETED, TransactionStep.FAILED]])
                    
                    if active_count == 0:
                        break
                    
                    await asyncio.sleep(1)  # Esperar 1 segundo antes de verificar de nuevo
                
                # Si aún hay transacciones activas después del timeout, marcarlas como fallidas
                remaining_active = [tx for tx in self.active_transactions.values() 
                                  if tx['step'] not in [TransactionStep.COMPLETED, TransactionStep.FAILED]]
                
                if remaining_active:
                    self.logger.warning(f"Timeout alcanzado. Marcando {len(remaining_active)} transacciones como fallidas")
                    for tx_data in remaining_active:
                        tx_data['step'] = TransactionStep.FAILED
                        tx_data['end_time'] = get_current_timestamp()
                        tx_data['failure_reason'] = 'Timeout en detención de simulación'
            else:
                # Detención forzada: marcar todas las transacciones pendientes como fallidas
                for tx_id, tx_data in self.active_transactions.items():
                    if tx_data['step'] not in [TransactionStep.COMPLETED, TransactionStep.FAILED]:
                        tx_data['step'] = TransactionStep.FAILED
                        tx_data['end_time'] = get_current_timestamp()
                        tx_data['failure_reason'] = 'Simulación detenida forzadamente'
            
            self.simulation_stats['end_time'] = get_current_timestamp()
            self.logger.info("Simulación detenida")
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'simulation_stopped',
                    'payload': {
                        'stats': self.simulation_stats,
                        'final_balance': self.simulation_stats['current_balance'],
                        'forced_stop': force_stop
                    }
                })
            
            return {
                'success': True,
                'message': 'Simulación detenida' + (' forzadamente' if force_stop else ''),
                'final_stats': self.simulation_stats
            }
            
        except Exception as e:
            error_msg = f"Error deteniendo simulación: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def process_arbitrage_opportunity(self, opportunity_data: Dict) -> Dict:
        """Procesa una oportunidad de arbitraje según el modo de simulación."""
        if not self.is_simulation_running:
            return {
                'success': False,
                'message': 'Simulación no está activa'
            }
        
        # Verificar límite de operaciones concurrentes
        active_count = len([tx for tx in self.active_transactions.values() 
                           if tx['step'] not in [TransactionStep.COMPLETED, TransactionStep.FAILED]])
        
        if active_count >= self.simulation_config['max_concurrent_operations']:
            return {
                'success': False,
                'message': 'Límite de operaciones concurrentes alcanzado'
            }
        
        try:
            # Crear diccionario de símbolo
            symbol_dict = create_symbol_dict(opportunity_data)
            symbol = symbol_dict.get('symbol', 'UNKNOWN')
            
            # Generar ID único para la transacción
            tx_id = f"tx_{symbol}_{int(time.time() * 1000)}"
            
            # Preparar datos para la IA
            ai_input_data = await self._prepare_ai_input_data(symbol_dict, opportunity_data)
            
            # Decisión de la IA
            ai_decision = self.ai_model.predict(ai_input_data)
            
            self.logger.info(f"Decisión IA para {symbol}: {ai_decision['should_execute']} (confianza: {ai_decision['confidence']:.3f})")
            
            if not ai_decision.get('should_execute', False):
                return {
                    'success': False,
                    'message': f"IA decidió no ejecutar: {ai_decision.get('reason', 'No rentable')}",
                    'ai_decision': ai_decision
                }
            
            # Crear transacción
            transaction = {
                'id': tx_id,
                'symbol': symbol,
                'symbol_dict': symbol_dict,
                'ai_input_data': ai_input_data,
                'ai_decision': ai_decision,
                'step': TransactionStep.PENDING,
                'start_time': get_current_timestamp(),
                'end_time': None,
                'current_step_start': get_current_timestamp(),
                'steps_log': [],
                'profit_loss': 0.0,
                'success': False
            }
            
            self.active_transactions[tx_id] = transaction
            
            # Ejecutar según el modo
            if self.current_mode == SimulationMode.LOCAL:
                result = await self._execute_local_simulation(tx_id)
            elif self.current_mode == SimulationMode.SEBO_SANDBOX:
                result = await self._execute_sebo_sandbox_simulation(tx_id)
            elif self.current_mode == SimulationMode.REAL:
                result = await self._execute_real_transaction(tx_id)
            
            return resultsaction = self.active_transactions[tx_id]
        
        try:
            # Iniciar tarea asíncrona para procesar la transacción
            asyncio.create_task(self._process_sebo_sandbox_transaction(tx_id))
            
            return {
                'success': True,
                'message': 'Transacción Sandbox iniciada',
                'transaction_id': tx_id,
                'symbol': transaction['symbol']
            }
            
        except Exception as e:
            error_msg = f"Error en simulación Sandbox: {e}"
            self.logger.error(error_msg)
            transaction['step'] = TransactionStep.FAILED
            transaction['end_time'] = get_current_timestamp()
            return {
                'success': False,
                'message': error_msg,
                'transaction_id': tx_id
            }
            
        except Exception as e:
            error_msg = f"Error procesando oportunidad: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    async def _prepare_ai_input_data(self, symbol_dict: Dict, opportunity_data: Dict) -> Dict:
        """Prepara los datos de entrada para la IA."""
        # Calcular monto de inversión basado en balance actual
        current_balance = self.simulation_stats['current_balance']
        investment_percentage = 10.0  # 10% del balance
        investment_amount = min(current_balance * (investment_percentage / 100), 100.0)
        
        # Obtener precios actuales si están disponibles
        buy_price = safe_float(opportunity_data.get('price_at_exMin_to_buy_asset', 0))
        sell_price = safe_float(opportunity_data.get('price_at_exMax_to_sell_asset', 0))
        
        # Estimar fees
        estimated_buy_fee = 0.001  # 0.1%
        estimated_sell_fee = 0.001  # 0.1%
        estimated_transfer_fee = 1.0  # 1 USDT para USDT + 0.1% para asset
        
        return {
            'symbol': symbol_dict['symbol'],
            'symbol_name': symbol_dict.get('symbol_name', symbol_dict['symbol']),
            'buy_exchange_id': symbol_dict['buy_exchange_id'],
            'sell_exchange_id': symbol_dict['sell_exchange_id'],
            'current_price_buy': buy_price,
            'current_price_sell': sell_price,
            'investment_usdt': investment_amount,
            'estimated_buy_fee': estimated_buy_fee,
            'estimated_sell_fee': estimated_sell_fee,
            'estimated_transfer_fee': estimated_transfer_fee,
            'current_balance': current_balance,
            'timestamp': get_current_timestamp()
        }
    
    async def _execute_local_simulation(self, tx_id: str) -> Dict:
        """Ejecuta una simulación local paso a paso."""
        transaction = self.active_transactions[tx_id]
        
        try:
            # Iniciar tarea asíncrona para procesar la transacción
            asyncio.create_task(self._process_local_transaction(tx_id))
            
            return {
                'success': True,
                'message': 'Transacción local iniciada',
                'transaction_id': tx_id,
                'symbol': transaction['symbol']
            }
            
        except Exception as e:
            error_msg = f"Error en simulación local: {e}"
            self.logger.error(error_msg)
            transaction['step'] = TransactionStep.FAILED
            transaction['end_time'] = get_current_timestamp()
            return {
                'success': False,
                'message': error_msg,
                'transaction_id': tx_id
            }
    
    async def _process_local_transaction(self, tx_id: str):
        """Procesa una transacción local paso a paso."""
        transaction = self.active_transactions[tx_id]
        
        try:
            symbol = transaction['symbol']
            ai_data = transaction['ai_input_data']
            investment = ai_data['investment_usdt']
            
            # Paso 1: Retirar USDT
            await self._simulate_step(
                transaction, 
                TransactionStep.WITHDRAWING_USDT,
                f"Retirando {investment:.2f} USDT para comprar {symbol}"
            )
            
            # Simular tiempo de retiro
            await asyncio.sleep(self.simulation_config['time_between_transfers'])
            
            # Paso 2: Comprar asset
            await self._simulate_step(
                transaction,
                TransactionStep.BUYING_ASSET,
                f"Comprando {symbol} en {ai_data['buy_exchange_id']}"
            )
            
            # Simular tiempo de compra
            await asyncio.sleep(self.simulation_config['time_between_transfers'])
            
            # Paso 3: Transferir asset
            await self._simulate_step(
                transaction,
                TransactionStep.TRANSFERRING_ASSET,
                f"Transfiriendo {symbol} a {ai_data['sell_exchange_id']}"
            )
            
            # Simular tiempo de transferencia (más largo)
            await asyncio.sleep(self.simulation_config['time_between_transfers'] * 2)
            
            # Paso 4: Vender asset
            await self._simulate_step(
                transaction,
                TransactionStep.SELLING_ASSET,
                f"Vendiendo {symbol} en {ai_data['sell_exchange_id']}"
            )
            
            # Simular tiempo de venta
            await asyncio.sleep(self.simulation_config['time_between_transfers'])
            
            # Calcular resultado final
            profit_loss = await self._calculate_final_result(transaction)
            
            # Completar transacción
            transaction['step'] = TransactionStep.COMPLETED
            transaction['end_time'] = get_current_timestamp()
            transaction['profit_loss'] = profit_loss
            transaction['success'] = profit_loss > 0
            
            # Actualizar balance y estadísticas
            self.simulation_stats['current_balance'] += profit_loss
            self.simulation_stats['total_operations'] += 1
            
            if profit_loss > 0:
                self.simulation_stats['successful_operations'] += 1
                self.simulation_stats['total_profit_usdt'] += profit_loss
            else:
                self.simulation_stats['failed_operations'] += 1
                self.simulation_stats['total_loss_usdt'] += abs(profit_loss)
            
            # Notificar a UI
            await self._notify_transaction_update(tx_id)
            
            self.logger.info(f"Transacción {tx_id} completada: {profit_loss:.4f} USDT")
            
        except Exception as e:
            self.logger.error(f"Error procesando transacción local {tx_id}: {e}")
            transaction['step'] = TransactionStep.FAILED
            transaction['end_time'] = get_current_timestamp()
            transaction['failure_reason'] = str(e)
            await self._notify_transaction_update(tx_id)
    
    async def _execute_sebo_sandbox_simulation(self, tx_id: str) -> Dict:
        """Ejecuta una simulación usando la API sandbox de Sebo."""
        transaction = self.active_transactions[tx_id]
        
        try:
            # Iniciar tarea asíncrona para procesar con API de Sebo
            asyncio.create_task(self._process_sebo_sandbox_transaction(tx_id))
            
            return {
                'success': True,
                'message': 'Transacción sandbox iniciada',
                'transaction_id': tx_id,
                'symbol': transaction['symbol']
            }
            
        except Exception as e:
            error_msg = f"Error en simulación sandbox: {e}"
            self.logger.error(error_msg)
            transaction['step'] = TransactionStep.FAILED
            transaction['end_time'] = get_current_timestamp()
            return {
                'success': False,
                'message': error_msg,
                'transaction_id': tx_id
            }
    
    async def _process_sebo_sandbox_transaction(self, tx_id: str):
        """Procesa una transacción usando las rutas sandbox de Sebo."""
        transaction = self.active_transactions[tx_id]
        
        try:
            symbol = transaction['symbol']
            ai_data = transaction['ai_input_data']
            
            # Paso 1: Llamar a API sandbox para retirar USDT
            await self._simulate_step(
                transaction,
                TransactionStep.WITHDRAWING_USDT,
                f"Llamando API sandbox para retirar USDT"
            )
            
            withdraw_result = await self._call_sebo_sandbox_api(
                'withdraw_usdt',
                {
                    'exchange_id': ai_data['buy_exchange_id'],
                    'amount': ai_data['investment_usdt'],
                    'transaction_id': tx_id
                }
            )
            
            if not withdraw_result.get('success', False):
                raise Exception(f"Error en retiro USDT: {withdraw_result.get('message', 'Unknown error')}")
            
            await asyncio.sleep(2)
            
            # Paso 2: Llamar a API sandbox para comprar
            await self._simulate_step(
                transaction,
                TransactionStep.BUYING_ASSET,
                f"Llamando API sandbox para comprar {symbol}"
            )
            
            buy_result = await self._call_sebo_sandbox_api(
                'buy_asset',
                {
                    'exchange_id': ai_data['buy_exchange_id'],
                    'symbol': symbol,
                    'amount_usdt': ai_data['investment_usdt'],
                    'transaction_id': tx_id
                }
            )
            
            if not buy_result.get('success', False):
                raise Exception(f"Error en compra: {buy_result.get('message', 'Unknown error')}")
            
            await asyncio.sleep(2)
            
            # Paso 3: Llamar a API sandbox para transferir
            await self._simulate_step(
                transaction,
                TransactionStep.TRANSFERRING_ASSET,
                f"Llamando API sandbox para transferir {symbol}"
            )
            
            transfer_result = await self._call_sebo_sandbox_api(
                'transfer_asset',
                {
                    'from_exchange': ai_data['buy_exchange_id'],
                    'to_exchange': ai_data['sell_exchange_id'],
                    'symbol': symbol,
                    'amount': buy_result.get('asset_amount', 0),
                    'transaction_id': tx_id
                }
            )
            
            if not transfer_result.get('success', False):
                raise Exception(f"Error en transferencia: {transfer_result.get('message', 'Unknown error')}")
            
            await asyncio.sleep(3)  # Transferencias toman más tiempo
            
            # Paso 4: Llamar a API sandbox para vender
            await self._simulate_step(
                transaction,
                TransactionStep.SELLING_ASSET,
                f"Llamando API sandbox para vender {symbol}"
            )
            
            sell_result = await self._call_sebo_sandbox_api(
                'sell_asset',
                {
                    'exchange_id': ai_data['sell_exchange_id'],
                    'symbol': symbol,
                    'amount': transfer_result.get('received_amount', 0),
                    'transaction_id': tx_id
                }
            )
            
            if not sell_result.get('success', False):
                raise Exception(f"Error en venta: {sell_result.get('message', 'Unknown error')}")
            
            # Calcular resultado final basado en respuesta de API
            profit_loss = sell_result.get('final_usdt', 0) - ai_data['investment_usdt']
            
            # Completar transacción
            transaction['step'] = TransactionStep.COMPLETED
            transaction['end_time'] = get_current_timestamp()
            transaction['profit_loss'] = profit_loss
            transaction['success'] = profit_loss > 0
            
            # Actualizar balance y estadísticas
            self.simulation_stats['current_balance'] += profit_loss
            self.simulation_stats['total_operations'] += 1
            
            if profit_loss > 0:
                self.simulation_stats['successful_operations'] += 1
                self.simulation_stats['total_profit_usdt'] += profit_loss
            else:
                self.simulation_stats['failed_operations'] += 1
                self.simulation_stats['total_loss_usdt'] += abs(profit_loss)
            
            # Notificar a UI
            await self._notify_transaction_update(tx_id)
            
            self.logger.info(f"Transacción sandbox {tx_id} completada: {profit_loss:.4f} USDT")
            
        except Exception as e:
            self.logger.error(f"Error procesando transacción sandbox {tx_id}: {e}")
            transaction['step'] = TransactionStep.FAILED
            transaction['end_time'] = get_current_timestamp()
            transaction['failure_reason'] = str(e)
            await self._notify_transaction_update(tx_id)
    
    async def _call_sebo_sandbox_api(self, endpoint: str, data: Dict) -> Dict:
        """Llama a la API sandbox de Sebo."""
        try:
            url = f"{SEBO_API_BASE_URL}/sandbox/{endpoint}"
            
            result = await make_http_request(
                self.http_session,
                'POST',
                url,
                timeout=30,
                json=data
            )
            
            if result:
                self.logger.debug(f"API sandbox call successful: {endpoint}")
                return result
            else:
                return {
                    'success': False,
                    'message': f'Error calling sandbox API: {endpoint}'
                }
                
        except Exception as e:
            self.logger.error(f"Error calling sandbox API {endpoint}: {e}")
            return {
                'success': False,
                'message': str(e)
            }
    
    async def _simulate_step(self, transaction: Dict, step: TransactionStep, description: str):
        """Simula un paso de la transacción."""
        transaction['step'] = step
        transaction['current_step_start'] = get_current_timestamp()
        
        # Agregar al log de pasos
        step_log = {
            'step': step.value,
            'description': description,
            'timestamp': get_current_timestamp()
        }
        transaction['steps_log'].append(step_log)
        
        self.logger.info(f"[{transaction['id']}] {description}")
        
        # Notificar a UI sobre el cambio de paso
        await self._notify_transaction_update(transaction['id'])
    
    async def _calculate_final_result(self, transaction: Dict) -> float:
        """Calcula el resultado final de una transacción local."""
        try:
            ai_data = transaction['ai_input_data']
            investment = ai_data['investment_usdt']
            buy_price = ai_data['current_price_buy']
            sell_price = ai_data['current_price_sell']
            
            # Simular variabilidad en precios
            buy_slippage = random.uniform(*self.simulation_config['slippage_range'])
            sell_slippage = random.uniform(*self.simulation_config['slippage_range'])
            
            actual_buy_price = buy_price * (1 + buy_slippage)
            actual_sell_price = sell_price * (1 - sell_slippage)
            
            # Calcular paso a paso
            # 1. Retirar USDT (fee fijo)
            usdt_after_withdrawal = investment - self.simulation_config['commission_rates']['usdt_withdrawal']
            
            # 2. Comprar asset
            asset_bought_gross = usdt_after_withdrawal / actual_buy_price
            trading_fee = asset_bought_gross * self.simulation_config['commission_rates']['trading_fee_percentage']
            asset_bought_net = asset_bought_gross - trading_fee
            
            # 3. Transferir asset (fee porcentual)
            transfer_fee = asset_bought_net * self.simulation_config['commission_rates']['asset_withdrawal_percentage']
            asset_to_sell = asset_bought_net - transfer_fee
            
            # 4. Vender asset
            usdt_from_sale_gross = asset_to_sell * actual_sell_price
            sell_trading_fee = usdt_from_sale_gross * self.simulation_config['commission_rates']['trading_fee_percentage']
            final_usdt = usdt_from_sale_gross - sell_trading_fee
            
            # Simular posibilidad de fallo
            success_chance = random.random()
            if success_chance > self.simulation_config['success_rate']:
                # Simular fallo con pérdida parcial
                loss_percentage = random.uniform(0.05, 0.15)  # 5-15% de pérdida
                final_usdt = investment * (1 - loss_percentage)
            
            return final_usdt - investment
            
        except Exception as e:
            self.logger.error(f"Error calculando resultado final: {e}")
            # En caso de error, simular pérdida pequeña
            return -random.uniform(1.0, 5.0)
    
    async def _notify_transaction_update(self, tx_id: str):
        """Notifica a la UI sobre actualizaciones de transacción."""
        if not self.ui_broadcaster:
            return
        
        try:
            transaction = self.active_transactions.get(tx_id)
            if not transaction:
                return
            
            # Preparar datos para UI
            ui_data = {
                'transaction_id': tx_id,
                'symbol': transaction['symbol'],
                'step': transaction['step'].value,
                'step_description': self._get_step_description(transaction['step']),
                'start_time': transaction['start_time'],
                'current_step_start': transaction.get('current_step_start'),
                'profit_loss': transaction.get('profit_loss', 0.0),
                'success': transaction.get('success', False),
                'steps_log': transaction.get('steps_log', []),
                'ai_confidence': transaction['ai_decision'].get('confidence', 0.0)
            }
            
            # Si está completada, agregar estadísticas actualizadas
            if transaction['step'] in [TransactionStep.COMPLETED, TransactionStep.FAILED]:
                ui_data['final_stats'] = {
                    'current_balance': self.simulation_stats['current_balance'],
                    'total_operations': self.simulation_stats['total_operations'],
                    'successful_operations': self.simulation_stats['successful_operations'],
                    'total_profit': self.simulation_stats['total_profit_usdt']
                }
            
            await self.ui_broadcaster.broadcast_message({
                'type': 'transaction_update',
                'payload': ui_data
            })
            
        except Exception as e:
            self.logger.error(f"Error notificando actualización de transacción: {e}")
    
    def _get_step_description(self, step: TransactionStep) -> str:
        """Obtiene la descripción legible de un paso."""
        descriptions = {
            TransactionStep.PENDING: "Pendiente",
            TransactionStep.WITHDRAWING_USDT: "Retirando USDT",
            TransactionStep.BUYING_ASSET: "Comprando activo",
            TransactionStep.TRANSFERRING_ASSET: "Transfiriendo activo",
            TransactionStep.SELLING_ASSET: "Vendiendo activo",
            TransactionStep.COMPLETED: "Completada",
            TransactionStep.FAILED: "Fallida"
        }
        return descriptions.get(step, "Desconocido")
    
    def get_simulation_status(self) -> Dict:
        """Obtiene el estado actual de la simulación."""
        return {
            'is_running': self.is_simulation_running,
            'mode': self.current_mode.value if self.current_mode else None,
            'stats': self.simulation_stats,
            'config': self.simulation_config,
            'active_transactions': len(self.active_transactions),
            'active_transactions_details': [
                {
                    'id': tx_id,
                    'symbol': tx_data['symbol'],
                    'step': tx_data['step'].value,
                    'start_time': tx_data['start_time']
                }
                for tx_id, tx_data in self.active_transactions.items()
            ]
        }
    
    def get_transaction_details(self, tx_id: str) -> Optional[Dict]:
        """Obtiene los detalles de una transacción específica."""
        transaction = self.active_transactions.get(tx_id)
        if not transaction:
            return None
        
        return {
            'id': transaction['id'],
            'symbol': transaction['symbol'],
            'step': transaction['step'].value,
            'step_description': self._get_step_description(transaction['step']),
            'start_time': transaction['start_time'],
            'end_time': transaction.get('end_time'),
            'profit_loss': transaction.get('profit_loss', 0.0),
            'success': transaction.get('success', False),
            'steps_log': transaction.get('steps_log', []),
            'ai_decision': transaction['ai_decision'],
            'failure_reason': transaction.get('failure_reason')
        }
    
    async def get_simulation_summary(self) -> Dict:
        """Obtiene un resumen completo de la simulación."""
        try:
            # Calcular métricas adicionales
            runtime_seconds = 0
            if self.simulation_stats['start_time']:
                start_time = datetime.fromisoformat(self.simulation_stats['start_time'].replace('Z', '+00:00'))
                if self.simulation_stats['end_time']:
                    end_time = datetime.fromisoformat(self.simulation_stats['end_time'].replace('Z', '+00:00'))
                else:
                    end_time = datetime.now(timezone.utc)
                runtime_seconds = (end_time - start_time).total_seconds()
            
            success_rate = 0.0
            if self.simulation_stats['total_operations'] > 0:
                success_rate = (self.simulation_stats['successful_operations'] /
                              self.simulation_stats['total_operations']) * 100
            
            roi = 0.0
            if self.simulation_config['initial_balance'] > 0:
                roi = ((self.simulation_stats['current_balance'] - self.simulation_config['initial_balance']) /
                      self.simulation_config['initial_balance']) * 100
            
            return {
                'mode': self.current_mode.value if self.current_mode else None,
                'is_running': self.is_simulation_running,
                'runtime_seconds': runtime_seconds,
                'runtime_minutes': runtime_seconds / 60,
                'initial_balance': self.simulation_config['initial_balance'],
                'current_balance': self.simulation_stats['current_balance'],
                'total_profit_loss': self.simulation_stats['current_balance'] - self.simulation_config['initial_balance'],
                'roi_percentage': roi,
                'total_operations': self.simulation_stats['total_operations'],
                'successful_operations': self.simulation_stats['successful_operations'],
                'failed_operations': self.simulation_stats['failed_operations'],
                'success_rate_percentage': success_rate,
                'total_profit_usdt': self.simulation_stats['total_profit_usdt'],
                'total_loss_usdt': self.simulation_stats['total_loss_usdt'],
                'active_transactions': len(self.active_transactions),
                'config': self.simulation_config,
                'start_time': self.simulation_stats['start_time'],
                'end_time': self.simulation_stats['end_time']
            }
            
        except Exception as e:
            self.logger.error(f"Error generando resumen de simulación: {e}")
            return {
                'error': str(e),
                'is_running': self.is_simulation_running
            }
    
    async def export_simulation_results(self, filepath: str = None) -> Dict:
        """Exporta los resultados de la simulación."""
        try:
            if not filepath:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filepath = f"simulation_results_{timestamp}.json"
            
            # Preparar datos para exportar
            export_data = {
                'simulation_summary': await self.get_simulation_summary(),
                'transactions': [
                    self.get_transaction_details(tx_id)
                    for tx_id in self.active_transactions.keys()
                ],
                'exported_at': get_current_timestamp()
            }
            
            # Guardar archivo
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"Resultados de simulación exportados a: {filepath}")
            
            return {
                'success': True,
                'filepath': filepath,
                'transactions_count': len(export_data['transactions'])
            }
            
        except Exception as e:
            error_msg = f"Error exportando resultados: {e}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
            

    async def _process_sebo_sandbox_transaction(self, tx_id: str):
        """Procesa una transacción en modo Sandbox de Sebo paso a paso."""
        transaction = self.active_transactions[tx_id]
        
        try:
            symbol = transaction["symbol"]
            ai_data = transaction["ai_input_data"]
            investment = ai_data["investment_usdt"]
            
            # Paso 1: Retirar USDT (simulado en sandbox)
            await self._simulate_step(
                transaction, 
                TransactionStep.WITHDRAWING_USDT,
                f"Retirando {investment:.2f} USDT para comprar {symbol} en Sandbox"
            )
            
            # Simular tiempo de retiro
            await asyncio.sleep(self.simulation_config["time_between_transfers"])
            
            # Paso 2: Comprar asset (simulado en sandbox)
            await self._simulate_step(
                transaction,
                TransactionStep.BUYING_ASSET,
                f"Comprando {symbol} en {ai_data["buy_exchange_id"]} en Sandbox"
            )
            
            # Simular tiempo de compra
            await asyncio.sleep(self.simulation_config["time_between_transfers"])
            
            # Paso 3: Transferir asset (simulado en sandbox)
            await self._simulate_step(
                transaction,
                TransactionStep.TRANSFERRING_ASSET,
                f"Transfiriendo {symbol} a {ai_data["sell_exchange_id"]} en Sandbox"
            )
            
            # Simular tiempo de transferencia (más largo)
            await asyncio.sleep(self.simulation_config["time_between_transfers"] * 2)
            
            # Paso 4: Vender asset (simulado en sandbox)
            await self._simulate_step(
                transaction,
                TransactionStep.SELLING_ASSET,
                f"Vendiendo {symbol} en {ai_data["sell_exchange_id"]} en Sandbox"
            )
            
            # Simular tiempo de venta
            await asyncio.sleep(self.simulation_config["time_between_transfers"])
            
            # Calcular resultado final (simulado)
            profit_loss = await self._calculate_final_result(transaction)
            
            transaction["profit_loss"] = profit_loss
            transaction["success"] = True
            transaction["step"] = TransactionStep.COMPLETED
            transaction["end_time"] = get_current_timestamp()
            
            self.simulation_stats["successful_operations"] += 1
            self.simulation_stats["total_profit_usdt"] += profit_loss
            self.simulation_stats["current_balance"] += profit_loss
            
            self.logger.info(f"Transacción Sandbox {tx_id} completada. Ganancia: {profit_loss:.4f} USDT")
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_transaction_completed",
                    "payload": {
                        "transaction_id": tx_id,
                        "symbol": symbol,
                        "profit_loss": profit_loss,
                        "final_balance": self.simulation_stats["current_balance"],
                        "mode": self.current_mode.value
                    }
                })
                
        except Exception as e:
            error_msg = f"Error procesando transacción Sandbox {tx_id}: {e}"
            self.logger.error(error_msg)
            transaction["step"] = TransactionStep.FAILED
            transaction["end_time"] = get_current_timestamp()
            transaction["failure_reason"] = str(e)
            
            self.simulation_stats["failed_operations"] += 1
            self.simulation_stats["total_loss_usdt"] += transaction["ai_input_data"]["investment_usdt"]
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_transaction_failed",
                    "payload": {
                        "transaction_id": tx_id,
                        "symbol": symbol,
                        "error": error_msg,
                        "mode": self.current_mode.value
                    }
                })
        finally:
            self.simulation_stats["total_operations"] += 1
            self.simulation_stats["transactions_log"].append(transaction)
            
            # Notificar actualización de estadísticas generales
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_stats_update",
                    "payload": self.simulation_stats
                })





    async def _execute_real_transaction(self, tx_id: str) -> Dict:
        """Ejecuta una transacción en modo Real."""
        transaction = self.active_transactions[tx_id]
        
        if not self.exchange_manager:
            raise ValueError("ExchangeManager no está inicializado para operaciones reales.")

        try:
            symbol = transaction["symbol"]
            symbol_dict = transaction["symbol_dict"]
            ai_data = transaction["ai_input_data"]
            investment = ai_data["investment_usdt"]
            
            buy_exchange_id = symbol_dict["buy_exchange_id"]
            sell_exchange_id = symbol_dict["sell_exchange_id"]
            
            # Paso 1: Retirar USDT del exchange de origen (donde está el balance)
            # Asumimos que el balance inicial está en el exchange de compra (id_exDatamin)
            # En un escenario real, esto implicaría una transferencia interna o que el balance ya esté allí.
            # Por simplicidad, simulamos que el USDT ya está disponible en el exchange de compra.
            self.logger.info(f"[REAL] Preparando {investment:.2f} USDT para comprar {symbol} en {buy_exchange_id}")
            await self._simulate_step(
                transaction, 
                TransactionStep.WITHDRAWING_USDT,
                f"[REAL] Retirando {investment:.2f} USDT para comprar {symbol}"
            )
            
            # Paso 2: Comprar asset en el exchange de compra
            self.logger.info(f"[REAL] Comprando {symbol} en {buy_exchange_id} con {investment:.2f} USDT")
            buy_order_result = await self.exchange_manager.create_order(
                exchange_id=buy_exchange_id,
                symbol=symbol,
                side=\'buy\',
                amount=investment, # Asumimos que es un monto en USDT para una orden de mercado
                price=ai_data["current_price_buy"], # Precio de referencia, la orden de mercado usará el precio actual
                order_type=\'market\'
            )
            
            if not buy_order_result or not buy_order_result.get("success"):
                raise Exception(f"Fallo al comprar {symbol}: {buy_order_result.get("message", "Desconocido")}")
            
            bought_amount = buy_order_result.get("filled_amount", 0)
            bought_price = buy_order_result.get("price", ai_data["current_price_buy"])
            buy_fee = buy_order_result.get("fee", 0)

            await self._simulate_step(
                transaction,
                TransactionStep.BUYING_ASSET,
                f"[REAL] Comprado {bought_amount:.4f} {symbol} @ {bought_price:.4f} en {buy_exchange_id}. Fee: {buy_fee:.4f}"
            )
            
            # Paso 3: Transferir asset al exchange de venta
            self.logger.info(f"[REAL] Transfiriendo {bought_amount:.4f} {symbol} de {buy_exchange_id} a {sell_exchange_id}")
            transfer_result = await self.exchange_manager.transfer_asset(
                from_exchange_id=buy_exchange_id,
                to_exchange_id=sell_exchange_id,
                symbol=symbol,
                amount=bought_amount
            )
            
            if not transfer_result or not transfer_result.get("success"):
                raise Exception(f"Fallo al transferir {symbol}: {transfer_result.get("message", "Desconocido")}")
            
            transfer_fee = transfer_result.get("fee", 0)

            await self._simulate_step(
                transaction,
                TransactionStep.TRANSFERRING_ASSET,
                f"[REAL] Transferido {bought_amount:.4f} {symbol}. Fee: {transfer_fee:.4f}"
            )
            
            # Simular tiempo de transferencia (puede ser largo en real)
            await asyncio.sleep(self.simulation_config["time_between_transfers"] * 5) # Mayor delay para real
            
            # Paso 4: Vender asset en el exchange de venta
            self.logger.info(f"[REAL] Vendiendo {bought_amount:.4f} {symbol} en {sell_exchange_id}")
            sell_order_result = await self.exchange_manager.create_order(
                exchange_id=sell_exchange_id,
                symbol=symbol,
                side=\'sell\',
                amount=bought_amount,
                price=ai_data["current_price_sell"], # Precio de referencia
                order_type=\'market\'
            )
            
            if not sell_order_result or not sell_order_result.get("success"):
                raise Exception(f"Fallo al vender {symbol}: {sell_order_result.get("message", "Desconocido")}")
            
            sold_amount_usdt = sell_order_result.get("filled_amount_usdt", 0)
            sell_fee = sell_order_result.get("fee", 0)

            await self._simulate_step(
                transaction,
                TransactionStep.SELLING_ASSET,
                f"[REAL] Vendido {bought_amount:.4f} {symbol} por {sold_amount_usdt:.4f} USDT en {sell_exchange_id}. Fee: {sell_fee:.4f}"
            )
            
            # Calcular ganancia/pérdida real
            # profit_loss = (sold_amount_usdt - investment) - (buy_fee + transfer_fee + sell_fee)
            # La ganancia ya está implícita en sold_amount_usdt si se compara con investment inicial
            # y las fees ya fueron aplicadas por el exchange_manager
            profit_loss = sold_amount_usdt - investment # Esto es una simplificación, la lógica de cálculo de ganancia debe ser más robusta
            
            transaction["profit_loss"] = profit_loss
            transaction["success"] = True
            transaction["step"] = TransactionStep.COMPLETED
            transaction["end_time"] = get_current_timestamp()
            
            self.simulation_stats["successful_operations"] += 1
            self.simulation_stats["total_profit_usdt"] += profit_loss
            self.simulation_stats["current_balance"] += profit_loss # Actualizar balance simulado para estadísticas
            
            self.logger.info(f"Transacción REAL {tx_id} completada. Ganancia: {profit_loss:.4f} USDT")
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_transaction_completed",
                    "payload": {
                        "transaction_id": tx_id,
                        "symbol": symbol,
                        "profit_loss": profit_loss,
                        "final_balance": self.simulation_stats["current_balance"],
                        "mode": self.current_mode.value
                    }
                })
                
        except Exception as e:
            error_msg = f"Error procesando transacción REAL {tx_id}: {e}"
            self.logger.error(error_msg)
            transaction["step"] = TransactionStep.FAILED
            transaction["end_time"] = get_current_timestamp()
            transaction["failure_reason"] = str(e)
            
            self.simulation_stats["failed_operations"] += 1
            self.simulation_stats["total_loss_usdt"] += transaction["ai_input_data"]["investment_usdt"]
            
            # Notificar a UI
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_transaction_failed",
                    "payload": {
                        "transaction_id": tx_id,
                        "symbol": symbol,
                        "error": error_msg,
                        "mode": self.current_mode.value
                    }
                })
        finally:
            self.simulation_stats["total_operations"] += 1
            self.simulation_stats["transactions_log"].append(transaction)
            
            # Notificar actualización de estadísticas generales
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_message({
                    "type": "simulation_stats_update",
                    "payload": self.simulation_stats
                })



