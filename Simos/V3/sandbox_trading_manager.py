# Simos/V3/sandbox_trading_manager.py

import asyncio
import logging
import json
import ccxt
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import random

from config_v3 import SIMULATION_DELAY, MIN_PROFIT_USDT, MIN_PROFIT_PERCENTAGE
from ai_model import ArbitrageAIModel
from utils import get_current_timestamp, safe_float, safe_dict_get

class SandboxTradingManager:
    """Gestor de trading simulado en sandbox de exchanges reales."""
    
    def __init__(self, ai_model: ArbitrageAIModel, ui_broadcaster=None):
        self.logger = logging.getLogger('V3.SandboxTradingManager')
        self.ai_model = ai_model
        self.ui_broadcaster = ui_broadcaster
        
        # Estado de la simulación
        self.is_simulation_running = False
        self.simulation_stats = {
            'total_operations': 0,
            'successful_operations': 0,
            'failed_operations': 0,
            'total_profit_usdt': 0.0,
            'total_fees_paid': 0.0,
            'start_time': None,
            'end_time': None,
            'current_balance': 1000.0,  # Balance inicial simulado
            'operations_log': []
        }
        
        # Configuración de sandbox
        self.sandbox_config = {
            'initial_balance': 1000.0,
            'max_operations': 50,
            'operation_interval': 30,  # segundos entre operaciones
            'min_profit_threshold': 0.1,  # 0.1% mínimo
            'max_investment_per_operation': 100.0,  # USDT máximo por operación
            'slippage_simulation': True,
            'network_delay_simulation': True
        }
        
        # Instancias de exchanges en modo sandbox
        self.sandbox_exchanges = {}
        self._initialize_sandbox_exchanges()
    
    def _initialize_sandbox_exchanges(self):
        """Inicializa las instancias de exchanges en modo sandbox."""
        try:
            # Configurar exchanges principales en modo sandbox
            exchange_configs = {
                'binance': {
                    'sandbox': True,
                    'apiKey': 'test_api_key',
                    'secret': 'test_secret',
                    'enableRateLimit': True,
                },
                'okx': {
                    'sandbox': True,
                    'apiKey': 'test_api_key',
                    'secret': 'test_secret',
                    'password': 'test_passphrase',
                    'enableRateLimit': True,
                },
                'bybit': {
                    'sandbox': True,
                    'apiKey': 'test_api_key',
                    'secret': 'test_secret',
                    'enableRateLimit': True,
                },
                'kucoin': {
                    'sandbox': True,
                    'apiKey': 'test_api_key',
                    'secret': 'test_secret',
                    'password': 'test_passphrase',
                    'enableRateLimit': True,
                }
            }
            
            for exchange_id, config in exchange_configs.items():
                try:
                    if hasattr(ccxt, exchange_id):
                        exchange_class = getattr(ccxt, exchange_id)
                        exchange_instance = exchange_class(config)
                        self.sandbox_exchanges[exchange_id] = exchange_instance
                        self.logger.info(f"Exchange {exchange_id} configurado en modo sandbox")
                    else:
                        self.logger.warning(f"Exchange {exchange_id} no disponible en CCXT")
                except Exception as e:
                    self.logger.error(f"Error configurando exchange {exchange_id}: {e}")
            
            self.logger.info(f"Configurados {len(self.sandbox_exchanges)} exchanges en modo sandbox")
            
        except Exception as e:
            self.logger.error(f"Error inicializando exchanges sandbox: {e}")
    
    async def start_sandbox_simulation(self, simulation_params: Dict) -> Dict:
        """Inicia la simulación de trading en sandbox."""
        if self.is_simulation_running:
            return {"error": "La simulación ya está en progreso"}
        
        if not self.ai_model.is_trained:
            return {"error": "El modelo debe estar entrenado antes de iniciar la simulación"}
        
        try:
            self.is_simulation_running = True
            self.simulation_stats['start_time'] = get_current_timestamp()
            
            # Configurar parámetros de simulación
            duration_minutes = simulation_params.get('duration_minutes', 30)
            max_operations = simulation_params.get('max_operations', 20)
            investment_per_operation = simulation_params.get('investment_per_operation', 50.0)
            
            self.sandbox_config['max_operations'] = max_operations
            self.sandbox_config['max_investment_per_operation'] = investment_per_operation
            
            self.logger.info(f"Iniciando simulación sandbox por {duration_minutes} minutos")
            
            # Emitir estado inicial a la UI
            await self._emit_simulation_update("Iniciando simulación en sandbox...")
            
            # Ejecutar simulación
            await self._run_sandbox_simulation(duration_minutes)
            
            # Finalizar simulación
            self.simulation_stats['end_time'] = get_current_timestamp()
            
            # Calcular estadísticas finales
            final_stats = self._calculate_final_stats()
            
            await self._emit_simulation_update("Simulación completada", final_stats)
            
            self.logger.info(f"Simulación completada. Operaciones: {self.simulation_stats['total_operations']}, Ganancia: {self.simulation_stats['total_profit_usdt']:.2f} USDT")
            
            return {
                "success": True,
                "message": "Simulación completada exitosamente",
                "stats": self.simulation_stats,
                "final_stats": final_stats
            }
            
        except Exception as e:
            self.logger.error(f"Error durante la simulación: {e}")
            await self._emit_simulation_update(f"Error en la simulación: {str(e)}")
            
            return {
                "success": False,
                "error": str(e),
                "stats": self.simulation_stats
            }
        finally:
            self.is_simulation_running = False
    
    async def _run_sandbox_simulation(self, duration_minutes: int):
        """Ejecuta la simulación principal."""
        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        operation_count = 0
        
        while (datetime.now() < end_time and 
               operation_count < self.sandbox_config['max_operations'] and 
               self.is_simulation_running):
            
            try:
                # Obtener oportunidades de arbitraje simuladas
                opportunities = await self._get_simulated_opportunities()
                
                if opportunities:
                    # Seleccionar la mejor oportunidad
                    best_opportunity = self._select_best_opportunity(opportunities)
                    
                    if best_opportunity:
                        # Ejecutar operación simulada
                        operation_result = await self._execute_sandbox_operation(best_opportunity)
                        
                        # Registrar resultado
                        self._record_operation_result(operation_result)
                        
                        operation_count += 1
                        
                        # Emitir actualización
                        await self._emit_simulation_update(
                            f"Operación {operation_count} completada",
                            {
                                'operation_result': operation_result,
                                'current_stats': self.simulation_stats
                            }
                        )
                
                # Esperar antes de la siguiente operación
                await asyncio.sleep(self.sandbox_config['operation_interval'])
                
            except Exception as e:
                self.logger.error(f"Error en iteración de simulación: {e}")
                await asyncio.sleep(5)  # Esperar antes de continuar
    
    async def _get_simulated_opportunities(self) -> List[Dict]:
        """Obtiene oportunidades de arbitraje simuladas usando datos reales de exchanges."""
        opportunities = []
        
        try:
            # Símbolos para probar
            test_symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT']
            
            for symbol in test_symbols:
                try:
                    # Obtener precios de diferentes exchanges
                    prices = await self._fetch_symbol_prices(symbol)
                    
                    if len(prices) >= 2:
                        # Encontrar mejor oportunidad de arbitraje
                        opportunity = self._analyze_arbitrage_opportunity(symbol, prices)
                        
                        if opportunity and opportunity['profit_percentage'] > self.sandbox_config['min_profit_threshold']:
                            opportunities.append(opportunity)
                
                except Exception as e:
                    self.logger.warning(f"Error obteniendo precios para {symbol}: {e}")
                    continue
            
            return opportunities
            
        except Exception as e:
            self.logger.error(f"Error obteniendo oportunidades simuladas: {e}")
            return []
    
    async def _fetch_symbol_prices(self, symbol: str) -> Dict[str, Dict]:
        """Obtiene precios de un símbolo de diferentes exchanges."""
        prices = {}
        
        for exchange_id, exchange in self.sandbox_exchanges.items():
            try:
                # En modo sandbox, simular precios con pequeñas variaciones
                base_price = self._get_base_price(symbol)
                variation = random.uniform(-0.02, 0.02)  # ±2% de variación
                
                simulated_price = base_price * (1 + variation)
                
                prices[exchange_id] = {
                    'bid': simulated_price * 0.999,  # Precio de venta
                    'ask': simulated_price * 1.001,  # Precio de compra
                    'last': simulated_price,
                    'timestamp': datetime.now().timestamp()
                }
                
            except Exception as e:
                self.logger.warning(f"Error obteniendo precio de {symbol} en {exchange_id}: {e}")
                continue
        
        return prices
    
    def _get_base_price(self, symbol: str) -> float:
        """Obtiene un precio base simulado para un símbolo."""
        # Precios base simulados (aproximados a precios reales)
        base_prices = {
            'BTC/USDT': 45000.0,
            'ETH/USDT': 3000.0,
            'BNB/USDT': 300.0,
            'ADA/USDT': 0.5,
            'SOL/USDT': 100.0,
            'XRP/USDT': 0.6,
            'DOT/USDT': 7.0,
            'AVAX/USDT': 25.0
        }
        
        return base_prices.get(symbol, 100.0)
    
    def _analyze_arbitrage_opportunity(self, symbol: str, prices: Dict) -> Optional[Dict]:
        """Analiza una oportunidad de arbitraje entre exchanges."""
        try:
            if len(prices) < 2:
                return None
            
            # Encontrar el precio más bajo (para comprar) y más alto (para vender)
            buy_exchange = None
            sell_exchange = None
            lowest_ask = float('inf')
            highest_bid = 0
            
            for exchange_id, price_data in prices.items():
                ask_price = price_data['ask']
                bid_price = price_data['bid']
                
                if ask_price < lowest_ask:
                    lowest_ask = ask_price
                    buy_exchange = exchange_id
                
                if bid_price > highest_bid:
                    highest_bid = bid_price
                    sell_exchange = exchange_id
            
            # Verificar que sean exchanges diferentes
            if buy_exchange == sell_exchange or buy_exchange is None or sell_exchange is None:
                return None
            
            # Calcular ganancia potencial
            profit_percentage = ((highest_bid - lowest_ask) / lowest_ask) * 100
            
            # Estimar fees (simulados)
            buy_fee = 0.1  # 0.1%
            sell_fee = 0.1  # 0.1%
            total_fees = buy_fee + sell_fee
            
            net_profit_percentage = profit_percentage - total_fees
            
            if net_profit_percentage <= 0:
                return None
            
            return {
                'symbol': symbol,
                'buy_exchange_id': buy_exchange,
                'sell_exchange_id': sell_exchange,
                'current_price_buy': lowest_ask,
                'current_price_sell': highest_bid,
                'profit_percentage': profit_percentage,
                'net_profit_percentage': net_profit_percentage,
                'estimated_fees': total_fees,
                'investment_usdt': min(self.sandbox_config['max_investment_per_operation'], 
                                     self.simulation_stats['current_balance'] * 0.1),
                'timestamp': get_current_timestamp()
            }
            
        except Exception as e:
            self.logger.error(f"Error analizando oportunidad de arbitraje: {e}")
            return None
    
    def _select_best_opportunity(self, opportunities: List[Dict]) -> Optional[Dict]:
        """Selecciona la mejor oportunidad usando el modelo de IA."""
        try:
            if not opportunities:
                return None
            
            best_opportunity = None
            best_score = 0
            
            for opportunity in opportunities:
                # Usar el modelo de IA para evaluar la oportunidad
                prediction = self.ai_model.predict_arbitrage_opportunity(opportunity)
                
                if prediction.get('is_profitable', False):
                    confidence = prediction.get('confidence', 0)
                    expected_profit = prediction.get('expected_profit_percentage', 0)
                    
                    # Calcular score combinado
                    score = confidence * expected_profit
                    
                    if score > best_score:
                        best_score = score
                        best_opportunity = opportunity
                        best_opportunity['ai_prediction'] = prediction
            
            return best_opportunity
            
        except Exception as e:
            self.logger.error(f"Error seleccionando mejor oportunidad: {e}")
            return opportunities[0] if opportunities else None
    
    async def _execute_sandbox_operation(self, opportunity: Dict) -> Dict:
        """Ejecuta una operación de arbitraje simulada."""
        try:
            operation_start = datetime.now()
            
            # Simular delays de red
            if self.sandbox_config.get('network_delay_simulation', True):
                delay = random.uniform(0.1, 1.0)
                await asyncio.sleep(delay)
            
            # Simular slippage
            slippage = 0
            if self.sandbox_config.get('slippage_simulation', True):
                slippage = random.uniform(0.001, 0.005)  # 0.1% - 0.5%
            
            # Calcular precios finales con slippage
            buy_price = opportunity['current_price_buy'] * (1 + slippage)
            sell_price = opportunity['current_price_sell'] * (1 - slippage)
            
            investment = opportunity['investment_usdt']
            
            # Verificar si aún es rentable después del slippage
            gross_profit = ((sell_price - buy_price) / buy_price) * 100
            net_profit = gross_profit - opportunity['estimated_fees']
            
            success = net_profit > 0.05  # Mínimo 0.05% después de todo
            
            if success:
                # Calcular ganancia real
                profit_usdt = (investment * net_profit) / 100
                
                # Actualizar balance
                self.simulation_stats['current_balance'] += profit_usdt
                self.simulation_stats['total_profit_usdt'] += profit_usdt
                self.simulation_stats['successful_operations'] += 1
            else:
                # Operación fallida - pérdida por fees
                loss_usdt = (investment * opportunity['estimated_fees']) / 100
                self.simulation_stats['current_balance'] -= loss_usdt
                self.simulation_stats['total_profit_usdt'] -= loss_usdt
                self.simulation_stats['failed_operations'] += 1
            
            self.simulation_stats['total_operations'] += 1
            self.simulation_stats['total_fees_paid'] += (investment * opportunity['estimated_fees']) / 100
            
            operation_result = {
                'symbol': opportunity['symbol'],
                'buy_exchange': opportunity['buy_exchange_id'],
                'sell_exchange': opportunity['sell_exchange_id'],
                'investment_usdt': investment,
                'buy_price': buy_price,
                'sell_price': sell_price,
                'gross_profit_percentage': gross_profit,
                'net_profit_percentage': net_profit,
                'profit_usdt': profit_usdt if success else -loss_usdt,
                'success': success,
                'slippage_applied': slippage,
                'execution_time_ms': (datetime.now() - operation_start).total_seconds() * 1000,
                'timestamp': get_current_timestamp(),
                'ai_prediction': opportunity.get('ai_prediction', {})
            }
            
            return operation_result
            
        except Exception as e:
            self.logger.error(f"Error ejecutando operación sandbox: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': get_current_timestamp()
            }
    
    def _record_operation_result(self, result: Dict):
        """Registra el resultado de una operación."""
        self.simulation_stats['operations_log'].append(result)
        
        # Mantener solo los últimos 50 resultados
        if len(self.simulation_stats['operations_log']) > 50:
            self.simulation_stats['operations_log'] = self.simulation_stats['operations_log'][-50:]
    
    def _calculate_final_stats(self) -> Dict:
        """Calcula estadísticas finales de la simulación."""
        total_ops = self.simulation_stats['total_operations']
        successful_ops = self.simulation_stats['successful_operations']
        
        return {
            'total_operations': total_ops,
            'successful_operations': successful_ops,
            'failed_operations': self.simulation_stats['failed_operations'],
            'success_rate': (successful_ops / total_ops * 100) if total_ops > 0 else 0,
            'total_profit_usdt': self.simulation_stats['total_profit_usdt'],
            'total_fees_paid': self.simulation_stats['total_fees_paid'],
            'final_balance': self.simulation_stats['current_balance'],
            'roi_percentage': ((self.simulation_stats['current_balance'] - self.sandbox_config['initial_balance']) / self.sandbox_config['initial_balance']) * 100,
            'avg_profit_per_operation': (self.simulation_stats['total_profit_usdt'] / total_ops) if total_ops > 0 else 0,
            'duration_minutes': self._calculate_duration_minutes(),
            'operations_per_minute': (total_ops / self._calculate_duration_minutes()) if self._calculate_duration_minutes() > 0 else 0
        }
    
    def _calculate_duration_minutes(self) -> float:
        """Calcula la duración de la simulación en minutos."""
        if self.simulation_stats['start_time'] and self.simulation_stats['end_time']:
            start = datetime.fromisoformat(self.simulation_stats['start_time'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(self.simulation_stats['end_time'].replace('Z', '+00:00'))
            return (end - start).total_seconds() / 60
        return 0
    
    async def _emit_simulation_update(self, message: str, data: Dict = None):
        """Emite actualizaciones de la simulación a la UI."""
        if self.ui_broadcaster:
            update_data = {
                'message': message,
                'stats': self.simulation_stats,
                'timestamp': get_current_timestamp()
            }
            
            if data:
                update_data['data'] = data
            
            try:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'ai_simulation_update',
                    'payload': update_data
                })
            except Exception as e:
                self.logger.warning(f"Error emitiendo actualización de simulación: {e}")
    
    def get_simulation_status(self) -> Dict:
        """Retorna el estado actual de la simulación."""
        return {
            'is_simulation_running': self.is_simulation_running,
            'stats': self.simulation_stats
        }
    
    async def stop_simulation(self):
        """Detiene la simulación en curso."""
        if self.is_simulation_running:
            self.is_simulation_running = False
            await self._emit_simulation_update("Simulación detenida por el usuario")
            self.logger.info("Simulación detenida por el usuario")

