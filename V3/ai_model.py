# Simos/V3/ai_model.py

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error
import os

from config_v3 import AI_MODEL_PATH, AI_CONFIDENCE_THRESHOLD, MIN_PROFIT_PERCENTAGE, MIN_PROFIT_USDT
from utils import safe_float, safe_dict_get, get_current_timestamp

class ArbitrageAIModel:
    """Modelo de IA para análisis y decisiones de arbitraje."""
    
    def __init__(self, model_path: str = None):
        self.logger = logging.getLogger('V3.ArbitrageAIModel')
        self.model_path = model_path or AI_MODEL_PATH
        
        # Modelos
        self.profitability_classifier = None  # Clasifica si será rentable
        self.profit_regressor = None  # Predice la ganancia exacta
        self.risk_classifier = None  # Evalúa el riesgo de la operación
        
        # Preprocesadores
        self.feature_scaler = StandardScaler()
        self.label_encoders = {}
        
        # Metadatos del modelo
        self.feature_names = []
        self.is_trained = False
        self.training_history = {}
        
        # Configuración del modelo
        self.confidence_threshold = AI_CONFIDENCE_THRESHOLD
        
        # Intentar cargar modelo existente
        self._load_model()
    
    def _load_model(self):
        """Carga un modelo previamente entrenado."""
        try:
            if os.path.exists(self.model_path):
                model_data = joblib.load(self.model_path)
                
                self.profitability_classifier = model_data.get('profitability_classifier')
                self.profit_regressor = model_data.get('profit_regressor')
                self.risk_classifier = model_data.get('risk_classifier')
                self.feature_scaler = model_data.get('feature_scaler', StandardScaler())
                self.label_encoders = model_data.get('label_encoders', {})
                self.feature_names = model_data.get('feature_names', [])
                self.training_history = model_data.get('training_history', {})
                
                self.is_trained = all([
                    self.profitability_classifier is not None,
                    self.profit_regressor is not None,
                    self.risk_classifier is not None
                ])
                
                if self.is_trained:
                    self.logger.info(f"Modelo de IA cargado desde {self.model_path}")
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
            # Crear directorio si no existe
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            
            model_data = {
                'profitability_classifier': self.profitability_classifier,
                'profit_regressor': self.profit_regressor,
                'risk_classifier': self.risk_classifier,
                'feature_scaler': self.feature_scaler,
                'label_encoders': self.label_encoders,
                'feature_names': self.feature_names,
                'training_history': self.training_history,
                'saved_at': get_current_timestamp()
            }
            
            joblib.dump(model_data, self.model_path)
            self.logger.info(f"Modelo guardado en {self.model_path}")
            
        except Exception as e:
            self.logger.error(f"Error guardando modelo: {e}")
    
    def prepare_features(self, operation_data: Dict) -> np.ndarray:
        """Prepara las características para el modelo."""
        try:
            features = {}
            
            # Características de precios
            buy_price = safe_float(operation_data.get('current_price_buy', 0))
            sell_price = safe_float(operation_data.get('current_price_sell', 0))
            
            if buy_price > 0:
                features['price_difference_percentage'] = ((sell_price - buy_price) / buy_price) * 100
                features['price_ratio'] = sell_price / buy_price
            else:
                features['price_difference_percentage'] = 0
                features['price_ratio'] = 1
            
            features['buy_price'] = buy_price
            features['sell_price'] = sell_price
            
            # Características de volumen e inversión
            features['investment_usdt'] = safe_float(operation_data.get('investment_usdt', 0))
            
            # Características de exchanges
            buy_exchange = operation_data.get('buy_exchange_id', 'unknown')
            sell_exchange = operation_data.get('sell_exchange_id', 'unknown')
            
            # Codificar exchanges (usar label encoding)
            if 'buy_exchange' not in self.label_encoders:
                self.label_encoders['buy_exchange'] = LabelEncoder()
            if 'sell_exchange' not in self.label_encoders:
                self.label_encoders['sell_exchange'] = LabelEncoder()
            
            # Para predicción, manejar exchanges no vistos
            try:
                features['buy_exchange_encoded'] = self.label_encoders['buy_exchange'].transform([buy_exchange])[0]
            except ValueError:
                features['buy_exchange_encoded'] = -1  # Exchange no conocido
            
            try:
                features['sell_exchange_encoded'] = self.label_encoders['sell_exchange'].transform([sell_exchange])[0]
            except ValueError:
                features['sell_exchange_encoded'] = -1  # Exchange no conocido
            
            # Características de fees (estimadas)
            market_data = operation_data.get('market_data', {})
            buy_fees = market_data.get('buy_fees', {})
            sell_fees = market_data.get('sell_fees', {})
            
            features['estimated_buy_fee_percentage'] = safe_float(buy_fees.get('taker', 0.001)) * 100
            features['estimated_sell_fee_percentage'] = safe_float(sell_fees.get('taker', 0.001)) * 100
            features['total_estimated_fees'] = features['estimated_buy_fee_percentage'] + features['estimated_sell_fee_percentage']
            
            # Características temporales
            now = datetime.now(timezone.utc)
            features['hour_of_day'] = now.hour
            features['day_of_week'] = now.weekday()
            
            # Características del símbolo
            symbol = operation_data.get('symbol', 'UNKNOWN/USDT')
            base_currency = symbol.split('/')[0] if '/' in symbol else 'UNKNOWN'
            
            # Características específicas de monedas populares
            popular_currencies = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'AVAX']
            features['is_popular_currency'] = 1 if base_currency in popular_currencies else 0
            features['is_btc'] = 1 if base_currency == 'BTC' else 0
            features['is_eth'] = 1 if base_currency == 'ETH' else 0
            
            # Características de balance
            balance_config = operation_data.get('balance_config', {})
            current_balance = safe_float(balance_config.get('balance_usdt', 0))
            features['current_balance_usdt'] = current_balance
            features['investment_to_balance_ratio'] = features['investment_usdt'] / max(current_balance, 1)
            
            # Convertir a array numpy
            if not self.feature_names:
                self.feature_names = sorted(features.keys())
            
            # Asegurar que todas las características estén presentes
            feature_vector = []
            for feature_name in self.feature_names:
                feature_vector.append(features.get(feature_name, 0))
            
            return np.array(feature_vector).reshape(1, -1)
            
        except Exception as e:
            self.logger.error(f"Error preparando características: {e}")
            # Retornar vector de ceros como fallback
            return np.zeros((1, len(self.feature_names) if self.feature_names else 10))
    
    def train(self, training_data: List[Dict]) -> Dict:
        """Entrena el modelo con datos históricos."""
        try:
            if len(training_data) < 10:
                raise ValueError("Se necesitan al menos 10 registros para entrenar")
            
            self.logger.info(f"Iniciando entrenamiento con {len(training_data)} registros")
            
            # Preparar datos
            X, y_profit, y_success, y_risk = self._prepare_training_data(training_data)
            
            if X.shape[0] == 0:
                raise ValueError("No se pudieron preparar datos de entrenamiento válidos")
            
            # Dividir datos
            X_train, X_test, y_profit_train, y_profit_test, y_success_train, y_success_test, y_risk_train, y_risk_test = train_test_split(
                X, y_profit, y_success, y_risk, test_size=0.2, random_state=42, stratify=y_success
            )
            
            # Escalar características
            X_train_scaled = self.feature_scaler.fit_transform(X_train)
            X_test_scaled = self.feature_scaler.transform(X_test)
            
            # Entrenar modelos
            training_results = {}
            
            # 1. Clasificador de rentabilidad
            self.profitability_classifier = RandomForestClassifier(
                n_estimators=100, random_state=42, class_weight='balanced'
            )
            self.profitability_classifier.fit(X_train_scaled, y_success_train)
            
            # Evaluar clasificador de rentabilidad
            y_success_pred = self.profitability_classifier.predict(X_test_scaled)
            training_results['profitability_accuracy'] = accuracy_score(y_success_test, y_success_pred)
            training_results['profitability_precision'] = precision_score(y_success_test, y_success_pred, average='weighted')
            training_results['profitability_recall'] = recall_score(y_success_test, y_success_pred, average='weighted')
            training_results['profitability_f1'] = f1_score(y_success_test, y_success_pred, average='weighted')
            
            # 2. Regresor de ganancia
            self.profit_regressor = GradientBoostingRegressor(
                n_estimators=100, random_state=42, learning_rate=0.1
            )
            self.profit_regressor.fit(X_train_scaled, y_profit_train)
            
            # Evaluar regresor de ganancia
            y_profit_pred = self.profit_regressor.predict(X_test_scaled)
            training_results['profit_mse'] = mean_squared_error(y_profit_test, y_profit_pred)
            training_results['profit_rmse'] = np.sqrt(training_results['profit_mse'])
            
            # 3. Clasificador de riesgo
            self.risk_classifier = RandomForestClassifier(
                n_estimators=100, random_state=42, class_weight='balanced'
            )
            self.risk_classifier.fit(X_train_scaled, y_risk_train)
            
            # Evaluar clasificador de riesgo
            y_risk_pred = self.risk_classifier.predict(X_test_scaled)
            training_results['risk_accuracy'] = accuracy_score(y_risk_test, y_risk_pred)
            
            # Validación cruzada
            cv_scores = cross_val_score(self.profitability_classifier, X_train_scaled, y_success_train, cv=5)
            training_results['cv_mean_accuracy'] = cv_scores.mean()
            training_results['cv_std_accuracy'] = cv_scores.std()
            
            # Importancia de características
            feature_importance = self.profitability_classifier.feature_importances_
            training_results['feature_importance'] = dict(zip(self.feature_names, feature_importance))
            
            # Guardar historial
            self.training_history = {
                'last_training': get_current_timestamp(),
                'training_samples': len(training_data),
                'results': training_results
            }
            
            self.is_trained = True
            self.save_model()
            
            self.logger.info(f"Entrenamiento completado. Precisión: {training_results['profitability_accuracy']:.4f}")
            
            return training_results
            
        except Exception as e:
            self.logger.error(f"Error durante entrenamiento: {e}")
            raise
    
    def _prepare_training_data(self, training_data: List[Dict]) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Prepara los datos de entrenamiento."""
        X_list = []
        y_profit_list = []
        y_success_list = []
        y_risk_list = []
        
        # Primero, recopilar todos los exchanges para el label encoding
        all_buy_exchanges = []
        all_sell_exchanges = []
        
        for data in training_data:
            all_buy_exchanges.append(data.get('buy_exchange_id', 'unknown'))
            all_sell_exchanges.append(data.get('sell_exchange_id', 'unknown'))
        
        # Ajustar label encoders
        self.label_encoders['buy_exchange'] = LabelEncoder()
        self.label_encoders['sell_exchange'] = LabelEncoder()
        self.label_encoders['buy_exchange'].fit(all_buy_exchanges)
        self.label_encoders['sell_exchange'].fit(all_sell_exchanges)
        
        # Procesar cada registro
        for data in training_data:
            try:
                # Preparar características
                features = self.prepare_features(data).flatten()
                
                # Extraer etiquetas
                decision = data.get('decision_outcome', 'NO_EJECUTADA')
                net_profit = safe_float(data.get('net_profit_usdt', 0))
                
                # Etiqueta de éxito (binaria)
                success = 1 if 'EJECUTADA' in decision and net_profit > 0 else 0
                
                # Etiqueta de riesgo (basada en pérdidas)
                risk = 1 if net_profit < -1.0 else 0  # Alto riesgo si pérdida > 1 USDT
                
                X_list.append(features)
                y_profit_list.append(net_profit)
                y_success_list.append(success)
                y_risk_list.append(risk)
                
            except Exception as e:
                self.logger.warning(f"Error procesando registro de entrenamiento: {e}")
                continue
        
        if not X_list:
            return np.array([]), np.array([]), np.array([]), np.array([])
        
        # Establecer nombres de características si no están definidos
        if not self.feature_names:
            sample_features = self.prepare_features(training_data[0])
            self.feature_names = [f'feature_{i}' for i in range(sample_features.shape[1])]
        
        return (
            np.array(X_list),
            np.array(y_profit_list),
            np.array(y_success_list),
            np.array(y_risk_list)
        )
    
    def predict(self, operation_data: Dict) -> Dict:
        """Realiza una predicción para una operación de arbitraje."""
        try:
            if not self.is_trained:
                return self._fallback_prediction(operation_data)
            
            # Preparar características
            X = self.prepare_features(operation_data)
            X_scaled = self.feature_scaler.transform(X)
            
            # Predicciones
            profitability_proba = self.profitability_classifier.predict_proba(X_scaled)[0]
            profit_prediction = self.profit_regressor.predict(X_scaled)[0]
            risk_proba = self.risk_classifier.predict_proba(X_scaled)[0]
            
            # Probabilidad de éxito
            success_probability = profitability_proba[1] if len(profitability_proba) > 1 else 0.5
            
            # Probabilidad de riesgo alto
            high_risk_probability = risk_proba[1] if len(risk_proba) > 1 else 0.5
            
            # Calcular confianza general
            confidence = self._calculate_confidence(success_probability, high_risk_probability, profit_prediction)
            
            # Decisión final
            should_execute = (
                success_probability >= self.confidence_threshold and
                high_risk_probability < 0.7 and
                profit_prediction >= MIN_PROFIT_USDT and
                confidence >= self.confidence_threshold
            )
            
            # Razón de la decisión
            if not should_execute:
                if success_probability < self.confidence_threshold:
                    reason = f"Baja probabilidad de éxito: {success_probability:.3f}"
                elif high_risk_probability >= 0.7:
                    reason = f"Alto riesgo: {high_risk_probability:.3f}"
                elif profit_prediction < MIN_PROFIT_USDT:
                    reason = f"Ganancia predicha insuficiente: {profit_prediction:.4f} USDT"
                else:
                    reason = f"Baja confianza general: {confidence:.3f}"
            else:
                reason = f"Predicción favorable: {success_probability:.3f} éxito, {profit_prediction:.4f} USDT"
            
            return {
                'should_execute': should_execute,
                'confidence': confidence,
                'predicted_profit_usdt': profit_prediction,
                'success_probability': success_probability,
                'high_risk_probability': high_risk_probability,
                'reason': reason,
                'model_version': self.training_history.get('last_training', 'unknown')
            }
            
        except Exception as e:
            self.logger.error(f"Error en predicción: {e}")
            return self._fallback_prediction(operation_data)
    
    def _calculate_confidence(self, success_prob: float, risk_prob: float, predicted_profit: float) -> float:
        """Calcula la confianza general de la predicción."""
        try:
            # Factores de confianza
            success_factor = success_prob
            risk_factor = 1 - risk_prob
            profit_factor = min(predicted_profit / MIN_PROFIT_USDT, 2.0) / 2.0  # Normalizar
            
            # Promedio ponderado
            confidence = (success_factor * 0.4 + risk_factor * 0.3 + profit_factor * 0.3)
            
            return max(0.0, min(1.0, confidence))
            
        except Exception:
            return 0.5
    
    def _fallback_prediction(self, operation_data: Dict) -> Dict:
        """Predicción de respaldo cuando el modelo no está entrenado."""
        try:
            # Lógica básica de rentabilidad
            buy_price = safe_float(operation_data.get('current_price_buy', 0))
            sell_price = safe_float(operation_data.get('current_price_sell', 0))
            investment = safe_float(operation_data.get('investment_usdt', 0))
            
            if buy_price <= 0:
                return {
                    'should_execute': False,
                    'confidence': 0.0,
                    'predicted_profit_usdt': 0.0,
                    'success_probability': 0.0,
                    'high_risk_probability': 1.0,
                    'reason': 'Precio de compra inválido',
                    'model_version': 'fallback'
                }
            
            # Calcular diferencia porcentual
            percentage_diff = ((sell_price - buy_price) / buy_price) * 100
            
            # Estimar fees
            estimated_fees = 0.2  # 0.2% total estimado
            net_percentage = percentage_diff - estimated_fees
            estimated_profit = investment * net_percentage / 100
            
            # Decisión básica
            is_profitable = (
                net_percentage >= MIN_PROFIT_PERCENTAGE and
                estimated_profit >= MIN_PROFIT_USDT
            )
            
            confidence = min(net_percentage / MIN_PROFIT_PERCENTAGE, 1.0) if is_profitable else 0.0
            
            return {
                'should_execute': is_profitable,
                'confidence': confidence,
                'predicted_profit_usdt': estimated_profit,
                'success_probability': confidence,
                'high_risk_probability': 1.0 - confidence,
                'reason': f'Análisis básico: {net_percentage:.4f}% ganancia neta',
                'model_version': 'fallback'
            }
            
        except Exception as e:
            return {
                'should_execute': False,
                'confidence': 0.0,
                'predicted_profit_usdt': 0.0,
                'success_probability': 0.0,
                'high_risk_probability': 1.0,
                'reason': f'Error en análisis: {e}',
                'model_version': 'fallback'
            }
    
    def update_with_feedback(self, operation_data: Dict, actual_result: Dict):
        """Actualiza el modelo con retroalimentación de operaciones reales."""
        try:
            # Preparar datos de retroalimentación
            feedback_data = {**operation_data, **actual_result}
            
            # Agregar a datos de entrenamiento (esto podría implementarse
            # guardando en un archivo para reentrenamiento posterior)
            self.logger.info(f"Retroalimentación recibida para {operation_data.get('symbol', 'N/A')}")
            
            # En una implementación completa, aquí se podría:
            # 1. Guardar el feedback en una base de datos
            # 2. Reentrenar el modelo periódicamente
            # 3. Ajustar parámetros dinámicamente
            
        except Exception as e:
            self.logger.error(f"Error procesando retroalimentación: {e}")
    
    def get_model_info(self) -> Dict:
        """Retorna información sobre el modelo."""
        return {
            'is_trained': self.is_trained,
            'feature_count': len(self.feature_names),
            'feature_names': self.feature_names,
            'training_history': self.training_history,
            'confidence_threshold': self.confidence_threshold,
            'model_path': self.model_path
        }
    
    def set_confidence_threshold(self, threshold: float):
        """Establece el umbral de confianza."""
        self.confidence_threshold = max(0.0, min(1.0, threshold))
        self.logger.info(f"Umbral de confianza actualizado: {self.confidence_threshold}")
    
    def get_feature_importance(self) -> Optional[Dict]:
        """Retorna la importancia de las características."""
        if self.is_trained and hasattr(self.profitability_classifier, 'feature_importances_'):
            return dict(zip(self.feature_names, self.profitability_classifier.feature_importances_))
        return None

