# Simos/V3/simulation_handler.py

import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json

from config_v3 import DATA_DIR
from utils import get_current_timestamp, safe_float
from ai_model import ArbitrageAIModel
from data_persistence import DataPersistence

class SimulationHandler:
    """Manejador para simulaciones del modelo de IA."""
    
    def __init__(self, ai_model: ArbitrageAIModel, data_persistence: DataPersistence, 
                 ui_broadcaster=None):
        self.logger = logging.getLogger('V3.SimulationHandler')
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        self.ui_broadcaster = ui_broadcaster
        
        # Estado de la simulación
        self.simulation_in_progress = False
        self.simulation_results = {}
        
    async def start_simulation(self, request_data: Dict) -> Dict:
        """Inicia una simulación del modelo."""
        try:
            if self.simulation_in_progress:
                return {"status": "error", "message": "Ya hay una simulación en progreso"}
            
            if not self.ai_model.is_trained:
                return {"status": "error", "message": "El modelo debe estar entrenado antes de simular"}
            
            self.simulation_in_progress = True
            
            # Extraer parámetros de simulación
            simulation_config = {
                'duration_days': request_data.get('duration_days', 7),
                'initial_balance': request_data.get('initial_balance', 1000.0),
                'symbols': request_data.get('symbols', ['BTC/USDT', 'ETH/USDT']),
                'interval': request_data.get('interval', '1h'),
                'risk_tolerance': request_data.get('risk_tolerance', 'medium')
            }
            
            # Iniciar simulación en background
            asyncio.create_task(self._run_simulation_process(simulation_config))
            
            return {
                "status": "success",
                "message": "Simulación iniciada",
                "data": {"simulation_id": get_current_timestamp()}
            }
            
        except Exception as e:
            self.logger.error(f"Error iniciando simulación: {e}")
            self.simulation_in_progress = False
            return {"status": "error", "message": f"Error interno: {str(e)}"}
    
    async def get_simulation_status(self) -> Dict:
        """Obtiene el estado actual de la simulación."""
        return {
            "in_progress": self.simulation_in_progress,
            "results": self.simulation_results
        }
    
    async def stop_simulation(self) -> Dict:
        """Detiene la simulación actual."""
        try:
            self.simulation_in_progress = False
            
            return {
                "status": "success",
                "message": "Simulación detenida",
                "data": self.simulation_results
            }
            
        except Exception as e:
            self.logger.error(f"Error deteniendo simulación: {e}")
            return {"status": "error", "message": f"Error interno: {str(e)}"}
    
    async def _run_simulation_process(self, config: Dict):
        """Ejecuta el proceso de simulación en background."""
        try:
            self.logger.info(f"Iniciando simulación con configuración: {config}")
            
            # Inicializar variables de simulación
            current_balance = config['initial_balance']
            operations_log = []
            daily_balances = []
            
            start_date = datetime.now()
            end_date = start_date + timedelta(days=config['duration_days'])
            
            # Simular operaciones día por día
            current_date = start_date
            day_count = 0
            
            while current_date < end_date and self.simulation_in_progress:
                day_count += 1
                
                # Simular operaciones para este día
                daily_operations = await self._simulate_daily_operations(
                    current_date, config, current_balance
                )
                
                # Procesar operaciones del día
                daily_profit = 0
                for operation in daily_operations:
                    # Usar el modelo para decidir si ejecutar
                    prediction = self.ai_model.predict(operation)
                    
                    if prediction.get('should_execute', False):
                        # Simular ejecución de la operación
                        operation_result = await self._execute_simulated_operation(
                            operation, current_balance
                        )
                        
                        if operation_result['success']:
                            profit = operation_result['net_profit']
                            current_balance += profit
                            daily_profit += profit
                            
                            operations_log.append({
                                'date': current_date.isoformat(),
                                'symbol': operation['symbol'],
                                'profit': profit,
                                'balance_after': current_balance,
                                'prediction_confidence': prediction.get('confidence', 0)
                            })
                
                # Registrar balance diario
                daily_balances.append({
                    'date': current_date.isoformat(),
                    'balance': current_balance,
                    'daily_profit': daily_profit,
                    'operations_count': len([op for op in operations_log 
                                           if op['date'].startswith(current_date.strftime('%Y-%m-%d'))])
                })
                
                # Enviar progreso
                progress = (day_count / config['duration_days']) * 100
                await self._broadcast_simulation_progress(progress, {
                    'current_balance': current_balance,
                    'daily_profit': daily_profit,
                    'total_operations': len(operations_log)
                })
                
                # Avanzar al siguiente día
                current_date += timedelta(days=1)
                await asyncio.sleep(0.1)  # Pequeña pausa para no bloquear
            
            # Calcular resultados finales
            final_results = self._calculate_simulation_results(
                config, operations_log, daily_balances
            )
            
            self.simulation_results = final_results
            self.simulation_in_progress = False
            
            await self._broadcast_simulation_complete(final_results)
            
            self.logger.info("Simulación completada exitosamente")
            
        except Exception as e:
            self.logger.error(f"Error en proceso de simulación: {e}")
            self.simulation_in_progress = False
            await self._broadcast_simulation_error(str(e))
    
    async def _simulate_daily_operations(self, date: datetime, config: Dict, 
                                       current_balance: float) -> List[Dict]:
        """Simula las operaciones posibles para un día."""
        operations = []
        
        # Número de operaciones por día basado en el intervalo
        interval_operations = {
            '5m': 288, '15m': 96, '30m': 48, '1h': 24, '4h': 6, '1d': 1
        }
        
        ops_per_day = interval_operations.get(config['interval'], 24)
        
        # Generar operaciones simuladas
        for i in range(min(ops_per_day, 50)):  # Limitar para performance
            for symbol in config['symbols']:
                # Simular datos de mercado
                base_price = np.random.uniform(100, 50000)
                price_variation = np.random.uniform(0.995, 1.005)
                
                operation = {
                    'timestamp': (date + timedelta(hours=i)).isoformat(),
                    'symbol': symbol,
                    'buy_exchange_id': np.random.choice(['binance', 'kucoin', 'okx']),
                    'sell_exchange_id': np.random.choice(['binance', 'kucoin', 'okx']),
                    'current_price_buy': base_price,
                    'current_price_sell': base_price * price_variation,
                    'investment_usdt': min(current_balance * 0.1, 100),  # 10% del balance o 100 USDT
                    'estimated_buy_fee': np.random.uniform(0.1, 0.5),
                    'estimated_sell_fee': np.random.uniform(0.1, 0.5),
                    'estimated_transfer_fee': np.random.uniform(1, 5),
                    'balance_config': {'balance_usdt': current_balance}
                }
                
                operations.append(operation)
        
        return operations
    
    async def _execute_simulated_operation(self, operation: Dict, 
                                         current_balance: float) -> Dict:
        """Simula la ejecución de una operación."""
        try:
            investment = operation['investment_usdt']
            
            if investment > current_balance:
                return {'success': False, 'reason': 'Insufficient balance'}
            
            # Calcular fees
            total_fees = (
                operation['estimated_buy_fee'] + 
                operation['estimated_sell_fee'] + 
                operation['estimated_transfer_fee']
            )
            
            # Calcular ganancia/pérdida
            buy_price = operation['current_price_buy']
            sell_price = operation['current_price_sell']
            
            if buy_price > 0:
                price_diff_pct = ((sell_price - buy_price) / buy_price) * 100
                gross_profit = investment * (price_diff_pct / 100)
                net_profit = gross_profit - total_fees
                
                # Agregar algo de variabilidad (slippage, timing, etc.)
                variability = np.random.uniform(0.95, 1.05)
                net_profit *= variability
                
                return {
                    'success': True,
                    'net_profit': net_profit,
                    'gross_profit': gross_profit,
                    'total_fees': total_fees,
                    'price_diff_pct': price_diff_pct
                }
            else:
                return {'success': False, 'reason': 'Invalid price data'}
                
        except Exception as e:
            self.logger.error(f"Error ejecutando operación simulada: {e}")
            return {'success': False, 'reason': str(e)}
    
    def _calculate_simulation_results(self, config: Dict, operations_log: List[Dict], 
                                    daily_balances: List[Dict]) -> Dict:
        """Calcula los resultados finales de la simulación."""
        try:
            initial_balance = config['initial_balance']
            final_balance = daily_balances[-1]['balance'] if daily_balances else initial_balance
            
            total_profit = final_balance - initial_balance
            total_operations = len(operations_log)
            successful_operations = len([op for op in operations_log if op['profit'] > 0])
            
            # Calcular métricas
            roi_percentage = (total_profit / initial_balance) * 100
            success_rate = (successful_operations / max(total_operations, 1)) * 100
            avg_profit_per_operation = total_profit / max(total_operations, 1)
            
            # Calcular drawdown máximo
            max_balance = initial_balance
            max_drawdown = 0
            
            for day_data in daily_balances:
                balance = day_data['balance']
                if balance > max_balance:
                    max_balance = balance
                
                drawdown = ((max_balance - balance) / max_balance) * 100
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            
            return {
                'initial_balance': initial_balance,
                'final_balance': final_balance,
                'total_profit': total_profit,
                'roi_percentage': round(roi_percentage, 2),
                'total_operations': total_operations,
                'successful_operations': successful_operations,
                'success_rate': round(success_rate, 2),
                'avg_profit_per_operation': round(avg_profit_per_operation, 4),
                'max_drawdown': round(max_drawdown, 2),
                'duration_days': config['duration_days'],
                'daily_balances': daily_balances,
                'operations_log': operations_log[-100:],  # Últimas 100 operaciones
                'simulation_config': config
            }
            
        except Exception as e:
            self.logger.error(f"Error calculando resultados de simulación: {e}")
            return {'error': str(e)}
    
    async def _broadcast_simulation_progress(self, progress: float, data: Dict):
        """Envía progreso de simulación vía WebSocket."""
        if self.ui_broadcaster:
            await self.ui_broadcaster.broadcast_message({
                "type": "simulation_progress",
                "payload": {
                    "progress": progress,
                    "data": data,
                    "completed": False
                }
            })
    
    async def _broadcast_simulation_complete(self, results: Dict):
        """Envía notificación de simulación completada."""
        if self.ui_broadcaster:
            await self.ui_broadcaster.broadcast_message({
                "type": "simulation_complete",
                "payload": {
                    "progress": 100,
                    "completed": True,
                    "results": results
                }
            })
    
    async def _broadcast_simulation_error(self, error_message: str):
        """Envía notificación de error en simulación."""
        if self.ui_broadcaster:
            await self.ui_broadcaster.broadcast_message({
                "type": "simulation_error",
                "payload": {
                    "error": error_message
                }
            })

