# Simos/V3/simulation_engine.py

import asyncio
import logging
import random
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

from config_v3 import SIMULATION_DELAY, MIN_PROFIT_USDT, MIN_PROFIT_PERCENTAGE
from utils import safe_float, safe_dict_get, get_current_timestamp, create_symbol_dict
from ai_model import ArbitrageAIModel
from data_persistence import DataPersistence

class SimulationEngine:
    """Motor de simulación para entrenamiento y testing del modelo de IA."""
    
    def __init__(self, ai_model: ArbitrageAIModel, data_persistence: DataPersistence):
        self.logger = logging.getLogger('V3.SimulationEngine')
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        
        # Estado de simulación
        self.is_simulation_running = False
        self.simulation_stats = {
            'total_operations': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None,
            'end_time': None
        }
        

        # Configuración de simulación
        self.simulation_config = {
            'initial_balance': 1000.0,
            'max_operations': 100,
            'time_acceleration': 1.0,  # Factor de aceleración temporal
            'market_volatility': 0.1,  # Volatilidad del mercado (0-1)
            'network_delay_range': (0.1, 2.0),  # Rango de delay de red en segundos
            'slippage_range': (0.001, 0.01)  # Rango de slippage (0.1% - 1%)
        }
    
    """
    datos de entrenamiento se obtienen de el hsitorico de la tabla analisis de la bd a 
    travez de sebo por el endPoint ...... 
    """
    async def generate_training_data(
        self, 
        num_samples: int = 1000,
        save_to_file: bool = True
    ) -> List[Dict]:
        """Genera datos sintéticos para entrenamiento del modelo."""
        try:
            self.logger.info(f"Generando {num_samples} muestras de entrenamiento...")
            
            training_data = []
            
            # Símbolos populares para simulación
            symbols = [
                'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
                'XRP/USDT', 'DOT/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT'
            ]
            
            # Exchanges populares
            """
            los exchangas se obtienen de el endPoint /api/exchanges/configured retorna lista de exchanges
            configurados
            """
            exchanges = ['binance', 'okx', 'kucoin', 'bybit', 'huobi', 'gate']
            
            for i in range(num_samples):
                try:
                    # Generar datos de oportunidad sintética
                    sample = self._generate_synthetic_opportunity(symbols, exchanges)
                    
                    # Simular ejecución
                    result = await self._simulate_operation_execution(sample)
                    
                    # Combinar datos
                    training_sample = {**sample, **result}
                    training_data.append(training_sample)
                    
                    if (i + 1) % 100 == 0:
                        self.logger.info(f"Generadas {i + 1}/{num_samples} muestras")
                    
                except Exception as e:
                    self.logger.warning(f"Error generando muestra {i}: {e}")
                    continue
            
            if save_to_file:
                await self.data_persistence.save_training_data(training_data)
            
            self.logger.info(f"Generación completada: {len(training_data)} muestras válidas")
            return training_data
            
        except Exception as e:
            self.logger.error(f"Error generando datos de entrenamiento: {e}")
            return []
    
    def _generate_synthetic_opportunity(self, symbols: List[str], exchanges: List[str]) -> Dict:
        """Genera una oportunidad de arbitraje sintética."""
        symbol = random.choice(symbols)
        buy_exchange = random.choice(exchanges)
        sell_exchange = random.choice([ex for ex in exchanges if ex != buy_exchange])
        
        # Precios base realistas
        base_prices = {
            'BTC/USDT': 45000, 'ETH/USDT': 3000, 'BNB/USDT': 300,
            'ADA/USDT': 0.5, 'SOL/USDT': 100, 'XRP/USDT': 0.6,
            'DOT/USDT': 7, 'AVAX/USDT': 40, 'MATIC/USDT': 1.2, 'LINK/USDT': 15
        }
        
        base_price = base_prices.get(symbol, 10.0)
        
        # Añadir variación aleatoria
        price_variation = random.uniform(-0.1, 0.1)  # ±10%
        buy_price = base_price * (1 + price_variation)
        
        # Diferencia de arbitraje (puede ser negativa)
        arbitrage_diff = random.uniform(-0.02, 0.05)  # -2% a +5%
        sell_price = buy_price * (1 + arbitrage_diff)
        
        # Datos de fees realistas
        fee_ranges = {
            'binance': (0.001, 0.001), 'okx': (0.0008, 0.001),
            'kucoin': (0.001, 0.001), 'bybit': (0.001, 0.001),
            'huobi': (0.002, 0.002), 'gate': (0.002, 0.002)
        }
        
        buy_fee = random.uniform(*fee_ranges.get(buy_exchange, (0.001, 0.002)))
        sell_fee = random.uniform(*fee_ranges.get(sell_exchange, (0.001, 0.002)))
        
        # Configuración de balance sintética
        balance_config = {
            'balance_usdt': random.uniform(100, 5000),
            'investment_mode': random.choice(['FIXED', 'PERCENTAGE']),
            'investment_percentage': random.uniform(5, 20),
            'fixed_investment_usdt': random.uniform(50, 500)
        }
        
        investment_usdt = min(
            balance_config['balance_usdt'],
            random.uniform(50, 1000)
        )
        
        return {
            'symbol': symbol,
            'symbol_name': symbol.replace('/', ''),
            'buy_exchange_id': buy_exchange,
            'sell_exchange_id': sell_exchange,
            'current_price_buy': buy_price,
            'current_price_sell': sell_price,
            'investment_usdt': investment_usdt,
            'balance_config': balance_config,
            'market_data': {
                'buy_fees': {'taker': buy_fee},
                'sell_fees': {'taker': sell_fee}
            },
            'timestamp': get_current_timestamp(),
            'percentage_difference': ((sell_price - buy_price) / buy_price) * 100
        }
    
    async def _simulate_operation_execution(self, opportunity_data: Dict) -> Dict:
        """Simula la ejecución de una operación de arbitraje."""
        try:
            buy_price = opportunity_data['current_price_buy']
            sell_price = opportunity_data['current_price_sell']
            investment = opportunity_data['investment_usdt']
            
            # Simular fees
            buy_fee_rate = opportunity_data['market_data']['buy_fees']['taker']
            sell_fee_rate = opportunity_data['market_data']['sell_fees']['taker']
            
            # Simular slippage
            buy_slippage = random.uniform(*self.simulation_config['slippage_range'])
            sell_slippage = random.uniform(*self.simulation_config['slippage_range'])
            
            actual_buy_price = buy_price * (1 + buy_slippage)
            actual_sell_price = sell_price * (1 - sell_slippage)
            
            # Simular delay de red y volatilidad
            network_delay = random.uniform(*self.simulation_config['network_delay_range'])
            await asyncio.sleep(network_delay * SIMULATION_DELAY)
            
            # Volatilidad durante la ejecución
            volatility_factor = random.uniform(
                1 - self.simulation_config['market_volatility'],
                1 + self.simulation_config['market_volatility']
            )
            actual_sell_price *= volatility_factor
            
            # Calcular resultado
            # 1. Compra
            usdt_after_withdrawal_fee = investment * 0.999  # Fee de retiro USDT
            asset_bought_gross = usdt_after_withdrawal_fee / actual_buy_price
            asset_bought_net = asset_bought_gross * (1 - buy_fee_rate)
            
            # 2. Transferencia (fee de retiro del asset)
            withdrawal_fee_asset = asset_bought_net * 0.001  # 0.1% fee típico
            asset_to_sell = asset_bought_net - withdrawal_fee_asset
            
            # 3. Venta
            usdt_from_sale_gross = asset_to_sell * actual_sell_price
            usdt_final = usdt_from_sale_gross * (1 - sell_fee_rate)
            
            # Ganancia neta
            net_profit = usdt_final - investment
            
            # Determinar resultado
            if net_profit >= MIN_PROFIT_USDT:
                decision = "EJECUTADA_SIMULADA"
                success = True
            elif net_profit >= 0:
                decision = "EJECUTADA_SIMULADA_MARGINAL"
                success = True
            else:
                decision = "PERDIDA_SIMULADA"
                success = False
            
            # Simular algunos fallos aleatorios
            failure_chance = 0.05  # 5% de fallos
            if random.random() < failure_chance:
                decision = random.choice([
                    "ERROR_COMPRA", "ERROR_TRANSFERENCIA", "ERROR_VENTA",
                    "TIMEOUT_OPERACION", "PRECIO_CAMBIO_DRASTICO"
                ])
                success = False
                net_profit = -random.uniform(1, 10)  # Pérdida por fallo
            
            return {
                'decision_outcome': decision,
                'net_profit_usdt': net_profit,
                'success': success,
                'actual_buy_price': actual_buy_price,
                'actual_sell_price': actual_sell_price,
                'slippage_buy': buy_slippage,
                'slippage_sell': sell_slippage,
                'network_delay': network_delay,
                'volatility_factor': volatility_factor,
                'execution_time_ms': network_delay * 1000
            }
            
        except Exception as e:
            return {
                'decision_outcome': 'ERROR_SIMULACION',
                'net_profit_usdt': -5.0,
                'success': False,
                'error_message': str(e)
            }
    
    async def run_backtest(
        self, 
        historical_data: List[Dict],
        initial_balance: float = 1000.0
    ) -> Dict:
        """Ejecuta un backtest con datos históricos."""
        try:
            self.logger.info(f"Iniciando backtest con {len(historical_data)} registros")
            
            backtest_results = {
                'initial_balance': initial_balance,
                'final_balance': initial_balance,
                'total_operations': 0,
                'successful_operations': 0,
                'failed_operations': 0,
                'total_profit': 0.0,
                'max_drawdown': 0.0,
                'sharpe_ratio': 0.0,
                'win_rate': 0.0,
                'operations_log': []
            }
            
            current_balance = initial_balance
            peak_balance = initial_balance
            daily_returns = []
            
            for i, data in enumerate(historical_data):
                try:
                    # Simular decisión del modelo
                    if self.ai_model.is_trained:
                        prediction = self.ai_model.predict(data)
                        should_execute = prediction['should_execute']
                    else:
                        # Lógica básica para backtest sin modelo entrenado
                        percentage_diff = safe_float(data.get('percentage_difference', 0))
                        should_execute = percentage_diff >= MIN_PROFIT_PERCENTAGE
                    
                    if should_execute and current_balance >= 50:  # Mínimo para operar
                        # Calcular inversión
                        investment = min(current_balance * 0.1, 100)  # 10% del balance, máx 100
                        
                        # Simular ejecución
                        execution_result = await self._simulate_operation_execution({
                            **data,
                            'investment_usdt': investment
                        })
                        
                        # Actualizar balance
                        profit = execution_result['net_profit_usdt']
                        current_balance += profit
                        
                        # Estadísticas
                        backtest_results['total_operations'] += 1
                        if execution_result['success']:
                            backtest_results['successful_operations'] += 1
                        else:
                            backtest_results['failed_operations'] += 1
                        
                        backtest_results['total_profit'] += profit
                        
                        # Tracking de drawdown
                        if current_balance > peak_balance:
                            peak_balance = current_balance
                        
                        drawdown = (peak_balance - current_balance) / peak_balance
                        if drawdown > backtest_results['max_drawdown']:
                            backtest_results['max_drawdown'] = drawdown
                        
                        # Log de operación
                        operation_log = {
                            'index': i,
                            'symbol': data.get('symbol', 'N/A'),
                            'investment': investment,
                            'profit': profit,
                            'balance_after': current_balance,
                            'decision': execution_result['decision_outcome']
                        }
                        backtest_results['operations_log'].append(operation_log)
                        
                        # Retorno diario (simplificado)
                        daily_return = profit / investment if investment > 0 else 0
                        daily_returns.append(daily_return)
                    
                    if (i + 1) % 100 == 0:
                        self.logger.info(f"Backtest progreso: {i + 1}/{len(historical_data)}")
                
                except Exception as e:
                    self.logger.warning(f"Error en backtest registro {i}: {e}")
                    continue
            
            # Calcular métricas finales
            backtest_results['final_balance'] = current_balance
            
            if backtest_results['total_operations'] > 0:
                backtest_results['win_rate'] = (
                    backtest_results['successful_operations'] / backtest_results['total_operations']
                ) * 100
            
            # Sharpe ratio simplificado
            if daily_returns:
                returns_array = np.array(daily_returns)
                if returns_array.std() > 0:
                    backtest_results['sharpe_ratio'] = returns_array.mean() / returns_array.std()
            
            self.logger.info(f"Backtest completado. Balance final: {current_balance:.2f} USDT")
            
            return backtest_results
            
        except Exception as e:
            self.logger.error(f"Error en backtest: {e}")
            return {'error': str(e)}
    
    async def run_live_simulation(
        self, 
        duration_minutes: int = 60,
        operations_per_minute: float = 0.5
    ) -> Dict:
        """Ejecuta una simulación en vivo con datos sintéticos."""
        try:
            self.logger.info(f"Iniciando simulación en vivo por {duration_minutes} minutos")
            
            self.is_simulation_running = True
            self.simulation_stats = {
                'total_operations': 0,
                'successful_operations': 0,
                'total_profit_usdt': 0.0,
                'start_time': get_current_timestamp(),
                'end_time': None
            }
            
            current_balance = self.simulation_config['initial_balance']
            end_time = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
            
            symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT']
            exchanges = ['binance', 'okx', 'kucoin', 'bybit']
            
            while datetime.now(timezone.utc) < end_time and self.is_simulation_running:
                try:
                    # Generar oportunidad sintética
                    opportunity = self._generate_synthetic_opportunity(symbols, exchanges)
                    opportunity['investment_usdt'] = min(current_balance * 0.1, 100)
                    
                    # Decisión del modelo
                    if self.ai_model.is_trained:
                        prediction = self.ai_model.predict(opportunity)
                        should_execute = prediction['should_execute']
                    else:
                        # Decisión básica
                        percentage_diff = opportunity['percentage_difference']
                        should_execute = percentage_diff >= MIN_PROFIT_PERCENTAGE
                    
                    if should_execute and current_balance >= 50:
                        # Ejecutar operación simulada
                        result = await self._simulate_operation_execution(opportunity)
                        
                        # Actualizar balance y estadísticas
                        profit = result['net_profit_usdt']
                        current_balance += profit
                        
                        self.simulation_stats['total_operations'] += 1
                        if result['success']:
                            self.simulation_stats['successful_operations'] += 1
                        
                        self.simulation_stats['total_profit_usdt'] += profit
                        
                        # Log de operación
                        self.logger.info(
                            f"Simulación: {opportunity['symbol']} | "
                            f"Profit: {profit:.4f} USDT | "
                            f"Balance: {current_balance:.2f} USDT"
                        )
                        
                        # Retroalimentación al modelo
                        if self.ai_model.is_trained:
                            self.ai_model.update_with_feedback(opportunity, result)
                    
                    # Esperar hasta la próxima operación
                    wait_time = 60 / operations_per_minute  # Segundos entre operaciones
                    await asyncio.sleep(wait_time * self.simulation_config['time_acceleration'])
                    
                except Exception as e:
                    self.logger.error(f"Error en simulación en vivo: {e}")
                    await asyncio.sleep(5)
            
            self.simulation_stats['end_time'] = get_current_timestamp()
            self.is_simulation_running = False
            
            # Resultados finales
            final_results = {
                **self.simulation_stats,
                'final_balance': current_balance,
                'roi_percentage': ((current_balance - self.simulation_config['initial_balance']) / 
                                 self.simulation_config['initial_balance']) * 100,
                'win_rate': (self.simulation_stats['successful_operations'] / 
                           max(self.simulation_stats['total_operations'], 1)) * 100
            }
            
            self.logger.info(f"Simulación completada: {final_results}")
            
            return final_results
            
        except Exception as e:
            self.logger.error(f"Error en simulación en vivo: {e}")
            self.is_simulation_running = False
            return {'error': str(e)}
    
    def stop_simulation(self):
        """Detiene la simulación en curso."""
        self.is_simulation_running = False
        self.logger.info("Simulación detenida por solicitud del usuario")
    
    async def train_model_with_simulation(
        self, 
        training_samples: int = 1000,
        validation_split: float = 0.2
    ) -> Dict:
        """Entrena el modelo usando datos de simulación."""
        try:
            self.logger.info("Iniciando entrenamiento con datos de simulación")
            
            # Generar datos de entrenamiento
            training_data = await self.generate_training_data(training_samples, save_to_file=True)
            
            if len(training_data) < 10:
                raise ValueError("Datos de entrenamiento insuficientes")
            
            # Dividir en entrenamiento y validación
            split_index = int(len(training_data) * (1 - validation_split))
            train_data = training_data[:split_index]
            validation_data = training_data[split_index:]
            
            # Entrenar modelo
            training_results = self.ai_model.train(train_data)
            
            # Validar con datos de validación
            if validation_data:
                validation_results = await self._validate_model(validation_data)
                training_results['validation'] = validation_results
            
            self.logger.info("Entrenamiento completado exitosamente")
            
            return training_results
            
        except Exception as e:
            self.logger.error(f"Error en entrenamiento con simulación: {e}")
            return {'error': str(e)}
    
    async def _validate_model(self, validation_data: List[Dict]) -> Dict:
        """Valida el modelo con datos de validación."""
        try:
            correct_predictions = 0
            total_predictions = 0
            total_profit_predicted = 0.0
            total_profit_actual = 0.0
            
            for data in validation_data:
                try:
                    # Predicción del modelo
                    prediction = self.ai_model.predict(data)
                    
                    # Resultado real
                    actual_success = data.get('success', False)
                    actual_profit = safe_float(data.get('net_profit_usdt', 0))
                    
                    # Comparar predicción con realidad
                    predicted_success = prediction['should_execute']
                    predicted_profit = prediction['predicted_profit_usdt']
                    
                    if predicted_success == actual_success:
                        correct_predictions += 1
                    
                    total_predictions += 1
                    total_profit_predicted += predicted_profit
                    total_profit_actual += actual_profit
                    
                except Exception as e:
                    self.logger.warning(f"Error validando muestra: {e}")
                    continue
            
            accuracy = correct_predictions / max(total_predictions, 1)
            profit_error = abs(total_profit_predicted - total_profit_actual)
            
            return {
                'accuracy': accuracy,
                'total_samples': total_predictions,
                'correct_predictions': correct_predictions,
                'profit_prediction_error': profit_error,
                'predicted_total_profit': total_profit_predicted,
                'actual_total_profit': total_profit_actual
            }
            
        except Exception as e:
            self.logger.error(f"Error en validación: {e}")
            return {'error': str(e)}
    
    def get_simulation_status(self) -> Dict:
        """Retorna el estado actual de la simulación."""
        return {
            'is_running': self.is_simulation_running,
            'stats': self.simulation_stats,
            'config': self.simulation_config
        }
    
    def update_simulation_config(self, config: Dict):
        """Actualiza la configuración de simulación."""
        self.simulation_config.update(config)
        self.logger.info(f"Configuración de simulación actualizada: {config}")
    
    async def export_simulation_results(self, filepath: str) -> bool:
        """Exporta los resultados de simulación a un archivo."""
        try:
            results = {
                'simulation_stats': self.simulation_stats,
                'simulation_config': self.simulation_config,
                'model_info': self.ai_model.get_model_info(),
                'exported_at': get_current_timestamp()
            }
            
            with open(filepath, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            self.logger.info(f"Resultados de simulación exportados a {filepath}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error exportando resultados: {e}")
            return False

