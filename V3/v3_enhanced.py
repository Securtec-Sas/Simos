# Simos/V3/v3_enhanced.py

import asyncio
import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Callable, Tuple
import socketio
import aiohttp
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, mean_squared_error
import joblib
import os

# Configuración
WEBSOCKET_URL = "ws://localhost:3031/api/spot/arb"
SEBO_API_BASE_URL = "http://localhost:3031/api"
AI_MODEL_PATH = "models/arbitrage_ai_model.pkl"
MIN_PROFIT_PERCENTAGE = 0.6
MIN_PROFIT_USDT = 0.01
AI_CONFIDENCE_THRESHOLD = 0.7
SIMULATION_MODE = True  # Cambiar a False para trading real

class ArbitrageAI:
    """Sistema de IA para análisis y decisiones de arbitraje."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.ArbitrageAI')
        self.profitability_model = None
        self.profit_predictor = None
        self.risk_assessor = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.training_data = []
        
        # Cargar modelo si existe
        self._load_model()
    
    def _load_model(self):
        """Carga el modelo entrenado si existe."""
        try:
            if os.path.exists(AI_MODEL_PATH):
                model_data = joblib.load(AI_MODEL_PATH)
                self.profitability_model = model_data.get('profitability_model')
                self.profit_predictor = model_data.get('profit_predictor')
                self.risk_assessor = model_data.get('risk_assessor')
                self.scaler = model_data.get('scaler', StandardScaler())
                self.is_trained = all([self.profitability_model, self.profit_predictor, self.risk_assessor])
                
                if self.is_trained:
                    self.logger.info("Modelo de IA cargado exitosamente")
                else:
                    self.logger.warning("Modelo cargado pero incompleto")
            else:
                self.logger.info("No se encontró modelo previo, se creará uno nuevo")
        except Exception as e:
            self.logger.error(f"Error cargando modelo: {e}")
            self.is_trained = False
    
    def save_model(self):
        """Guarda el modelo entrenado."""
        try:
            os.makedirs(os.path.dirname(AI_MODEL_PATH), exist_ok=True)
            model_data = {
                'profitability_model': self.profitability_model,
                'profit_predictor': self.profit_predictor,
                'risk_assessor': self.risk_assessor,
                'scaler': self.scaler,
                'trained_at': datetime.now().isoformat()
            }
            joblib.dump(model_data, AI_MODEL_PATH)
            self.logger.info(f"Modelo guardado en {AI_MODEL_PATH}")
        except Exception as e:
            self.logger.error(f"Error guardando modelo: {e}")
    
    def extract_features(self, opportunity: Dict) -> np.ndarray:
        """Extrae características de una oportunidad de arbitraje."""
        try:
            features = []
            
            # Características de precio
            buy_price = float(opportunity.get('price_at_exMin_to_buy_asset', 0))
            sell_price = float(opportunity.get('price_at_exMax_to_sell_asset', 0))
            
            if buy_price > 0:
                price_diff_pct = ((sell_price - buy_price) / buy_price) * 100
                price_ratio = sell_price / buy_price
            else:
                price_diff_pct = 0
                price_ratio = 1
            
            features.extend([buy_price, sell_price, price_diff_pct, price_ratio])
            
            # Características de fees
            fees_min = opportunity.get('fees_exMin', {})
            fees_max = opportunity.get('fees_exMax', {})
            
            taker_fee_min = float(fees_min.get('taker_fee', 0.001))
            maker_fee_min = float(fees_min.get('maker_fee', 0.001))
            taker_fee_max = float(fees_max.get('taker_fee', 0.001))
            maker_fee_max = float(fees_max.get('maker_fee', 0.001))
            
            total_fees = (taker_fee_min + taker_fee_max) * 100  # Convertir a porcentaje
            
            features.extend([taker_fee_min * 100, maker_fee_min * 100, 
                           taker_fee_max * 100, maker_fee_max * 100, total_fees])
            
            # Características temporales
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            
            features.extend([hour, day_of_week])
            
            # Características del símbolo
            symbol = opportunity.get('symbol', 'UNKNOWN/USDT')
            base_currency = symbol.split('/')[0] if '/' in symbol else 'UNKNOWN'
            
            # Codificar monedas populares
            popular_currencies = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP']
            is_popular = 1 if base_currency in popular_currencies else 0
            is_btc = 1 if base_currency == 'BTC' else 0
            is_eth = 1 if base_currency == 'ETH' else 0
            
            features.extend([is_popular, is_btc, is_eth])
            
            # Características de exchanges
            exchange_min = opportunity.get('exchange_min_id', 'unknown')
            exchange_max = opportunity.get('exchange_max_id', 'unknown')
            
            # Codificar exchanges principales
            major_exchanges = ['binance', 'okx', 'kucoin', 'bybit']
            min_is_major = 1 if exchange_min in major_exchanges else 0
            max_is_major = 1 if exchange_max in major_exchanges else 0
            same_exchange = 1 if exchange_min == exchange_max else 0
            
            features.extend([min_is_major, max_is_major, same_exchange])
            
            return np.array(features).reshape(1, -1)
            
        except Exception as e:
            self.logger.error(f"Error extrayendo características: {e}")
            return np.zeros((1, 16))  # Vector de ceros como fallback
    
    def train(self, training_data: List[Dict]) -> Dict:
        """Entrena los modelos de IA con datos históricos."""
        try:
            if len(training_data) < 20:
                raise ValueError("Se necesitan al menos 20 registros para entrenar")
            
            self.logger.info(f"Iniciando entrenamiento con {len(training_data)} registros")
            
            # Preparar datos
            X = []
            y_profitable = []
            y_profit = []
            y_risk = []
            
            for data in training_data:
                features = self.extract_features(data).flatten()
                X.append(features)
                
                # Etiquetas
                actual_profit = float(data.get('actual_profit_usdt', 0))
                was_executed = data.get('was_executed', False)
                
                # Rentabilidad (binaria)
                profitable = 1 if was_executed and actual_profit > 0 else 0
                y_profitable.append(profitable)
                
                # Ganancia real
                y_profit.append(actual_profit)
                
                # Riesgo (alta pérdida)
                high_risk = 1 if actual_profit < -1.0 else 0
                y_risk.append(high_risk)
            
            X = np.array(X)
            y_profitable = np.array(y_profitable)
            y_profit = np.array(y_profit)
            y_risk = np.array(y_risk)
            
            # Dividir datos
            X_train, X_test, y_prof_train, y_prof_test, y_profit_train, y_profit_test, y_risk_train, y_risk_test = train_test_split(
                X, y_profitable, y_profit, y_risk, test_size=0.2, random_state=42
            )
            
            # Escalar características
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Entrenar modelos
            self.profitability_model = RandomForestClassifier(n_estimators=100, random_state=42)
            self.profitability_model.fit(X_train_scaled, y_prof_train)
            
            self.profit_predictor = GradientBoostingRegressor(n_estimators=100, random_state=42)
            self.profit_predictor.fit(X_train_scaled, y_profit_train)
            
            self.risk_assessor = RandomForestClassifier(n_estimators=100, random_state=42)
            self.risk_assessor.fit(X_train_scaled, y_risk_train)
            
            # Evaluar modelos
            y_prof_pred = self.profitability_model.predict(X_test_scaled)
            y_profit_pred = self.profit_predictor.predict(X_test_scaled)
            y_risk_pred = self.risk_assessor.predict(X_test_scaled)
            
            results = {
                'profitability_accuracy': accuracy_score(y_prof_test, y_prof_pred),
                'profit_mse': mean_squared_error(y_profit_test, y_profit_pred),
                'risk_accuracy': accuracy_score(y_risk_test, y_risk_pred),
                'training_samples': len(training_data)
            }
            
            self.is_trained = True
            self.save_model()
            
            self.logger.info(f"Entrenamiento completado. Precisión: {results['profitability_accuracy']:.4f}")
            return results
            
        except Exception as e:
            self.logger.error(f"Error durante entrenamiento: {e}")
            raise
    
    def predict(self, opportunity: Dict) -> Dict:
        """Realiza predicción para una oportunidad de arbitraje."""
        try:
            if not self.is_trained:
                return self._fallback_prediction(opportunity)
            
            # Extraer características
            X = self.extract_features(opportunity)
            X_scaled = self.scaler.transform(X)
            
            # Predicciones
            profit_proba = self.profitability_model.predict_proba(X_scaled)[0]
            predicted_profit = self.profit_predictor.predict(X_scaled)[0]
            risk_proba = self.risk_assessor.predict_proba(X_scaled)[0]
            
            # Probabilidades
            success_prob = profit_proba[1] if len(profit_proba) > 1 else 0.5
            risk_prob = risk_proba[1] if len(risk_proba) > 1 else 0.5
            
            # Confianza general
            confidence = (success_prob * 0.6 + (1 - risk_prob) * 0.4)
            
            # Decisión
            should_execute = (
                success_prob >= AI_CONFIDENCE_THRESHOLD and
                risk_prob < 0.3 and
                predicted_profit >= MIN_PROFIT_USDT and
                confidence >= AI_CONFIDENCE_THRESHOLD
            )
            
            return {
                'should_execute': should_execute,
                'confidence': confidence,
                'predicted_profit': predicted_profit,
                'success_probability': success_prob,
                'risk_probability': risk_prob,
                'reason': self._get_decision_reason(should_execute, success_prob, risk_prob, predicted_profit)
            }
            
        except Exception as e:
            self.logger.error(f"Error en predicción: {e}")
            return self._fallback_prediction(opportunity)
    
    def _fallback_prediction(self, opportunity: Dict) -> Dict:
        """Predicción básica cuando el modelo no está disponible."""
        try:
            buy_price = float(opportunity.get('price_at_exMin_to_buy_asset', 0))
            sell_price = float(opportunity.get('price_at_exMax_to_sell_asset', 0))
            
            if buy_price <= 0:
                return {
                    'should_execute': False,
                    'confidence': 0.0,
                    'predicted_profit': 0.0,
                    'success_probability': 0.0,
                    'risk_probability': 1.0,
                    'reason': 'Precio de compra inválido'
                }
            
            # Cálculo básico
            percentage_diff = ((sell_price - buy_price) / buy_price) * 100
            estimated_fees = 0.2  # 0.2% estimado
            net_percentage = percentage_diff - estimated_fees
            
            is_profitable = net_percentage >= MIN_PROFIT_PERCENTAGE
            confidence = min(net_percentage / MIN_PROFIT_PERCENTAGE, 1.0) if is_profitable else 0.0
            
            return {
                'should_execute': is_profitable,
                'confidence': confidence,
                'predicted_profit': net_percentage * 100 / 100,  # Estimación básica
                'success_probability': confidence,
                'risk_probability': 1.0 - confidence,
                'reason': f'Análisis básico: {net_percentage:.4f}% ganancia neta'
            }
            
        except Exception as e:
            return {
                'should_execute': False,
                'confidence': 0.0,
                'predicted_profit': 0.0,
                'success_probability': 0.0,
                'risk_probability': 1.0,
                'reason': f'Error en análisis: {e}'
            }
    
    def _get_decision_reason(self, should_execute: bool, success_prob: float, risk_prob: float, predicted_profit: float) -> str:
        """Genera la razón de la decisión."""
        if should_execute:
            return f"Predicción favorable: {success_prob:.3f} éxito, {predicted_profit:.4f} USDT"
        else:
            if success_prob < AI_CONFIDENCE_THRESHOLD:
                return f"Baja probabilidad de éxito: {success_prob:.3f}"
            elif risk_prob >= 0.3:
                return f"Alto riesgo: {risk_prob:.3f}"
            elif predicted_profit < MIN_PROFIT_USDT:
                return f"Ganancia predicha insuficiente: {predicted_profit:.4f} USDT"
            else:
                return "Condiciones no favorables"
    
    def add_training_data(self, opportunity: Dict, result: Dict):
        """Añade datos de entrenamiento basados en resultados reales."""
        training_record = {
            **opportunity,
            'actual_profit_usdt': result.get('actual_profit_usdt', 0),
            'was_executed': result.get('was_executed', False),
            'timestamp': datetime.now().isoformat()
        }
        self.training_data.append(training_record)
        
        # Reentrenar si tenemos suficientes datos nuevos
        if len(self.training_data) >= 50:
            self.train(self.training_data)
            self.training_data = []  # Limpiar después del entrenamiento

class V3TradingEngine:
    """Motor principal de trading V3 con IA integrada."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.TradingEngine')
        self.ai = ArbitrageAI()
        self.sio = socketio.AsyncClient()
        self.http_session = None
        self.is_connected = False
        self.is_trading_active = False
        
        # Estadísticas
        self.stats = {
            'operations_analyzed': 0,
            'operations_executed': 0,
            'total_profit': 0.0,
            'successful_operations': 0,
            'start_time': None
        }
        
        # Cache de datos
        self.latest_top20 = []
        self.latest_balances = {}
        
        self._setup_socket_handlers()
    
    def _setup_socket_handlers(self):
        """Configura los manejadores de eventos del socket."""
        
        @self.sio.event
        async def connect():
            self.logger.info("Conectado a Sebo")
            self.is_connected = True
        
        @self.sio.event
        async def disconnect():
            self.logger.warning("Desconectado de Sebo")
            self.is_connected = False
        
        @self.sio.on('top_20_data', namespace='/api/spot/arb')
        async def on_top20_data(data):
            if isinstance(data, list):
                self.latest_top20 = data
                self.logger.info(f"Recibidos {len(data)} datos del top 20")
                
                if self.is_trading_active:
                    await self._process_opportunities(data)
        
        @self.sio.on('balances-update', namespace='/api/spot/arb')
        async def on_balances_update(data):
            self.latest_balances = data
            self.logger.debug("Balances actualizados")
        
        @self.sio.on('spot-arb', namespace='/api/spot/arb')
        async def on_spot_arb(data):
            if self.is_trading_active:
                await self._analyze_single_opportunity(data)
    
    async def initialize(self):
        """Inicializa el motor de trading."""
        self.logger.info("Inicializando V3 Trading Engine...")
        
        # Crear sesión HTTP
        self.http_session = aiohttp.ClientSession()
        
        # Conectar a Sebo
        await self._connect_to_sebo()
        
        self.logger.info("V3 Trading Engine inicializado")
    
    async def _connect_to_sebo(self):
        """Conecta al servidor Sebo."""
        try:
            import urllib.parse
            parsed_url = urllib.parse.urlparse(WEBSOCKET_URL)
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
            namespace = parsed_url.path
            
            await self.sio.connect(base_url, namespaces=[namespace])
            self.logger.info(f"Conectado a {base_url} (namespace: {namespace})")
            
        except Exception as e:
            self.logger.error(f"Error conectando a Sebo: {e}")
    
    async def start_trading(self):
        """Inicia el trading automatizado."""
        if self.is_trading_active:
            self.logger.warning("Trading ya está activo")
            return
        
        self.is_trading_active = True
        self.stats['start_time'] = datetime.now()
        
        self.logger.info("Trading iniciado - Modo: " + ("SIMULACIÓN" if SIMULATION_MODE else "REAL"))
        
        # Procesar oportunidades actuales si las hay
        if self.latest_top20:
            await self._process_opportunities(self.latest_top20)
    
    async def stop_trading(self):
        """Detiene el trading automatizado."""
        self.is_trading_active = False
        self.logger.info("Trading detenido")
    
    async def _process_opportunities(self, opportunities: List[Dict]):
        """Procesa una lista de oportunidades de arbitraje."""
        for opportunity in opportunities:
            if not self.is_trading_active:
                break
            
            await self._analyze_single_opportunity(opportunity)
            await asyncio.sleep(0.1)  # Pequeña pausa entre análisis
    
    async def _analyze_single_opportunity(self, opportunity: Dict):
        """Analiza una sola oportunidad de arbitraje."""
        try:
            self.stats['operations_analyzed'] += 1
            
            symbol = opportunity.get('symbol', 'N/A')
            self.logger.debug(f"Analizando oportunidad: {symbol}")
            
            # Predicción de IA
            prediction = self.ai.predict(opportunity)
            
            # Log de la decisión
            should_execute = prediction['should_execute']
            confidence = prediction['confidence']
            reason = prediction['reason']
            
            self.logger.info(f"{symbol}: {'EJECUTAR' if should_execute else 'OMITIR'} "
                           f"(Confianza: {confidence:.3f}) - {reason}")
            
            if should_execute:
                result = await self._execute_arbitrage(opportunity, prediction)
                
                # Añadir datos de entrenamiento
                self.ai.add_training_data(opportunity, result)
                
                # Actualizar estadísticas
                if result.get('was_executed', False):
                    self.stats['operations_executed'] += 1
                    profit = result.get('actual_profit_usdt', 0)
                    self.stats['total_profit'] += profit
                    
                    if profit > 0:
                        self.stats['successful_operations'] += 1
            
        except Exception as e:
            self.logger.error(f"Error analizando oportunidad: {e}")
    
    async def _execute_arbitrage(self, opportunity: Dict, prediction: Dict) -> Dict:
        """Ejecuta una operación de arbitraje."""
        try:
            symbol = opportunity.get('symbol', 'N/A')
            buy_exchange = opportunity.get('exchange_min_id', 'unknown')
            sell_exchange = opportunity.get('exchange_max_id', 'unknown')
            buy_price = float(opportunity.get('price_at_exMin_to_buy_asset', 0))
            sell_price = float(opportunity.get('price_at_exMax_to_sell_asset', 0))
            predicted_profit = prediction.get('predicted_profit', 0)
            
            self.logger.info(f"EJECUTANDO: {symbol} | Comprar en {buy_exchange} @ {buy_price} | "
                           f"Vender en {sell_exchange} @ {sell_price} | "
                           f"Ganancia predicha: {predicted_profit:.4f} USDT")
            
            if SIMULATION_MODE:
                # Simulación
                await asyncio.sleep(0.5)  # Simular tiempo de ejecución
                
                # Simular resultado (con algo de variabilidad)
                import random
                success_rate = prediction.get('success_probability', 0.5)
                was_successful = random.random() < success_rate
                
                if was_successful:
                    # Ganancia con algo de ruido
                    actual_profit = predicted_profit * (0.8 + random.random() * 0.4)
                else:
                    # Pérdida pequeña
                    actual_profit = -abs(predicted_profit) * 0.1
                
                result = {
                    'was_executed': True,
                    'was_successful': was_successful,
                    'actual_profit_usdt': actual_profit,
                    'execution_time': 0.5,
                    'mode': 'simulation'
                }
                
                self.logger.info(f"SIMULACIÓN COMPLETADA: {symbol} | "
                               f"Resultado: {'ÉXITO' if was_successful else 'FALLO'} | "
                               f"Ganancia real: {actual_profit:.4f} USDT")
                
            else:
                # Trading real (implementar aquí la lógica real)
                self.logger.warning("Trading real no implementado aún")
                result = {
                    'was_executed': False,
                    'was_successful': False,
                    'actual_profit_usdt': 0.0,
                    'execution_time': 0.0,
                    'mode': 'real',
                    'error': 'Trading real no implementado'
                }
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error ejecutando arbitraje: {e}")
            return {
                'was_executed': False,
                'was_successful': False,
                'actual_profit_usdt': 0.0,
                'execution_time': 0.0,
                'error': str(e)
            }
    
    def get_stats(self) -> Dict:
        """Retorna las estadísticas actuales."""
        stats = self.stats.copy()
        
        if stats['start_time']:
            runtime = datetime.now() - stats['start_time']
            stats['runtime_minutes'] = runtime.total_seconds() / 60
            
            if stats['operations_executed'] > 0:
                stats['success_rate'] = stats['successful_operations'] / stats['operations_executed']
                stats['avg_profit_per_operation'] = stats['total_profit'] / stats['operations_executed']
            else:
                stats['success_rate'] = 0.0
                stats['avg_profit_per_operation'] = 0.0
        
        return stats
    
    async def cleanup(self):
        """Limpia recursos."""
        if self.sio.connected:
            await self.sio.disconnect()
        
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
        
        self.logger.info("V3 Trading Engine limpiado")

async def main():
    """Función principal."""
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Crear y ejecutar motor de trading
    engine = V3TradingEngine()
    
    try:
        await engine.initialize()
        
        # Iniciar trading
        await engine.start_trading()
        
        # Mantener ejecutándose
        while True:
            await asyncio.sleep(10)
            
            # Mostrar estadísticas cada 10 segundos
            stats = engine.get_stats()
            if stats['start_time']:
                print(f"\n=== ESTADÍSTICAS V3 ===")
                print(f"Tiempo ejecutándose: {stats.get('runtime_minutes', 0):.1f} minutos")
                print(f"Oportunidades analizadas: {stats['operations_analyzed']}")
                print(f"Operaciones ejecutadas: {stats['operations_executed']}")
                print(f"Operaciones exitosas: {stats['successful_operations']}")
                print(f"Tasa de éxito: {stats.get('success_rate', 0):.2%}")
                print(f"Ganancia total: {stats['total_profit']:.4f} USDT")
                print(f"Ganancia promedio: {stats.get('avg_profit_per_operation', 0):.4f} USDT")
                print("========================\n")
    
    except KeyboardInterrupt:
        print("\nDeteniendo V3...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await engine.stop_trading()
        await engine.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

