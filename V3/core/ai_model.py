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

# To disable oneDNN custom operations and ensure deterministic results,
# you can set this environment variable before importing TensorFlow.
# This addresses the informational message you are seeing in the logs.
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Importar TensorFlow/Keras para red neuronal
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, optimizers, callbacks
    from tensorflow.keras.regularizers import l2
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow no está disponible. Se usarán solo modelos sklearn.")

from shared.config_v3 import AI_MODEL_PATH, AI_CONFIDENCE_THRESHOLD, MIN_PROFIT_PERCENTAGE, MIN_PROFIT_USDT
from shared.utils import safe_float, safe_dict_get, get_current_timestamp

class ArbitrageAIModel:
    """Modelo de IA para análisis y decisiones de arbitraje con red neuronal."""
    
    def __init__(self, model_path: Optional[str] = None, use_neural_network: bool = True):
        self.logger = logging.getLogger('V3.ArbitrageAIModel')
        self.model_path = model_path or AI_MODEL_PATH.replace('.pkl', '.keras')
        self.use_neural_network = use_neural_network and TENSORFLOW_AVAILABLE
        
        # Modelos tradicionales
        self.profitability_classifier = None
        self.profit_regressor = None
        self.risk_classifier = None
        
        # Red neuronal
        self.neural_network = None
        self.nn_scaler = StandardScaler()
        self.feature_scaler = StandardScaler()
        self.label_encoders = {}
        
        # Metadatos del modelo
        self.feature_names = []
        self.is_trained = False
        self.training_history = {}
        
        # Configuración del modelo
        self.confidence_threshold = AI_CONFIDENCE_THRESHOLD
        
        # Configuración optimizada de red neuronal para arbitraje
        self.nn_config = {
            'hidden_layers': [256, 128, 64, 32],
            'dropout_rate': 0.4,
            'l2_reg': 0.0005,
            'learning_rate': 0.0005,
            'batch_size': 64,
            'epochs': 25,
            'early_stopping_patience': 20,
            'validation_split': 0.25
        }
        
        if not self.use_neural_network:
            self.logger.info("Usando modelos sklearn tradicionales")
        else:
            self.logger.info("Usando red neuronal con TensorFlow")
        
        # Intentar cargar modelo existente
        self._load_model()
    
    def _load_model(self):
        """Carga un modelo previamente entrenado."""
        try:
            # Cargar modelo .keras para red neuronal
            keras_path = self.model_path
            if os.path.exists(keras_path):
                try:
                    self.neural_network = tf.keras.models.load_model(keras_path)
                    self.logger.info("Red neuronal cargada exitosamente")
                except Exception as e:
                    self.logger.warning(f"Error cargando red neuronal .keras: {e}")
                    self.neural_network = None
            
            # Cargar modelo .pkl para compatibilidad hacia atrás
            pkl_path = self.model_path.replace('.keras', '.pkl')
            if os.path.exists(pkl_path):
                model_data = joblib.load(pkl_path)
                
                self.profitability_classifier = model_data.get('profitability_classifier')
                self.profit_regressor = model_data.get('profit_regressor')
                self.risk_classifier = model_data.get('risk_classifier')
                self.feature_scaler = model_data.get('feature_scaler', StandardScaler())
                self.nn_scaler = model_data.get('nn_scaler', StandardScaler())
                self.label_encoders = model_data.get('label_encoders', {})
                self.feature_names = model_data.get('feature_names', [])
                self.training_history = model_data.get('training_history', {})
                self.nn_config = model_data.get('nn_config', self.nn_config)
                
                # Cargar red neuronal si existe
                if self.use_neural_network:
                    h5_path = self.model_path.replace('.keras', '_neural_network.h5')
                    if os.path.exists(h5_path):
                        try:
                            self.neural_network = tf.keras.models.load_model(h5_path)
                            self.logger.info("Red neuronal cargada exitosamente desde .h5")
                        except Exception as e:
                            self.logger.warning(f"Error cargando red neuronal .h5: {e}")
                            self.neural_network = None
                
                # Verificar si está entrenado
                if self.use_neural_network:
                    self.is_trained = self.neural_network is not None
                else:
                    self.is_trained = all([
                        self.profitability_classifier is not None,
                        self.profit_regressor is not None,
                        self.risk_classifier is not None
                    ])
                
                if self.is_trained:
                    model_type = "Red Neuronal" if self.use_neural_network else "Modelos sklearn"
                    self.logger.info(f"Modelo de IA ({model_type}) cargado desde {pkl_path}")
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
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            
            model_data = {
                'profitability_classifier': self.profitability_classifier,
                'profit_regressor': self.profit_regressor,
                'risk_classifier': self.risk_classifier,
                'feature_scaler': self.feature_scaler,
                'nn_scaler': self.nn_scaler,
                'label_encoders': self.label_encoders,
                'feature_names': self.feature_names,
                'training_history': self.training_history,
                'nn_config': self.nn_config,
                'use_neural_network': self.use_neural_network,
                'saved_at': get_current_timestamp()
            }
            
            joblib.dump(model_data, self.model_path.replace('.keras', '.pkl'))
            
            if self.use_neural_network and self.neural_network is not None:
                self.neural_network.save(self.model_path)
                self.logger.info(f"Modelo guardado en {self.model_path}")
                
        except Exception as e:
            self.logger.error(f"Error guardando modelo: {e}")

    def prepare_features(self, operation_data: Dict) -> np.ndarray:
        """Prepara las características para el modelo incluyendo todas las transacciones y fees."""
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
            
            # Características de inversión y volumen
            features['investment_usdt'] = safe_float(operation_data.get('investment_usdt', 0))
            
            # Características detalladas de fees y comisiones
            features['estimated_buy_fee'] = safe_float(operation_data.get('estimated_buy_fee', 0))
            features['estimated_sell_fee'] = safe_float(operation_data.get('estimated_sell_fee', 0))
            features['estimated_transfer_fee'] = safe_float(operation_data.get('estimated_transfer_fee', 0))
            features['total_fees_usdt'] = safe_float(operation_data.get('total_fees_usdt', 0))
            
            # Calcular fees totales si no están disponibles
            if features['total_fees_usdt'] == 0:
                features['total_fees_usdt'] = (
                    features['estimated_buy_fee'] + 
                    features['estimated_sell_fee'] + 
                    features['estimated_transfer_fee']
                )
            
            # Características de rentabilidad
            features['net_profit_usdt'] = safe_float(operation_data.get('net_profit_usdt', 0))
            features['profit_percentage'] = safe_float(operation_data.get('profit_percentage', 0))
            features['profit_to_investment_ratio'] = (
                features['net_profit_usdt'] / max(features['investment_usdt'], 1)
            )
            
            # Características de tiempo de ejecución
            features['execution_time_seconds'] = safe_float(operation_data.get('execution_time_seconds', 0))
            features['execution_efficiency'] = (
                features['net_profit_usdt'] / max(features['execution_time_seconds'], 1)
            )
            
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
                features['buy_exchange_encoded'] = -1
            
            try:
                features['sell_exchange_encoded'] = self.label_encoders['sell_exchange'].transform([sell_exchange])[0]
            except ValueError:
                features['sell_exchange_encoded'] = -1
            
            # Características de diversificación de exchanges
            features['same_exchange'] = 1 if buy_exchange == sell_exchange else 0
            features['exchange_pair_risk'] = 1 if buy_exchange == sell_exchange else 0
            
            # Características de fees por exchange
            market_data = operation_data.get('market_data', {})
            buy_fees = market_data.get('buy_fees', {})
            sell_fees = market_data.get('sell_fees', {})
            
            features['buy_fee_percentage'] = safe_float(buy_fees.get('taker', 0.001)) * 100
            features['sell_fee_percentage'] = safe_float(sell_fees.get('taker', 0.001)) * 100
            features['total_fee_percentage'] = features['buy_fee_percentage'] + features['sell_fee_percentage']
            
            # Características temporales
            timestamp = operation_data.get('timestamp')
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    features['hour_of_day'] = dt.hour
                    features['day_of_week'] = dt.weekday()
                    features['is_weekend'] = 1 if dt.weekday() >= 5 else 0
                    features['is_business_hours'] = 1 if 9 <= dt.hour <= 17 else 0
                except:
                    now = datetime.now(timezone.utc)
                    features['hour_of_day'] = now.hour
                    features['day_of_week'] = now.weekday()
                    features['is_weekend'] = 1 if now.weekday() >= 5 else 0
                    features['is_business_hours'] = 1 if 9 <= now.hour <= 17 else 0
            else:
                now = datetime.now(timezone.utc)
                features['hour_of_day'] = now.hour
                features['day_of_week'] = now.weekday()
                features['hour_of_day'] = now.hour
                features['day_of_week'] = now.weekday()
                features['is_weekend'] = 1 if now.weekday() >= 5 else 0
                features['is_business_hours'] = 1 if 9 <= now.hour <= 17 else 0
            
            # Características del símbolo
            symbol = operation_data.get('symbol', 'UNKNOWN/USDT')
            base_currency = symbol.split('/')[0] if '/' in symbol else 'UNKNOWN'
            
            # Características específicas de monedas populares
            popular_currencies = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'AVAX']
            features['is_popular_currency'] = 1 if base_currency in popular_currencies else 0
            features['is_btc'] = 1 if base_currency == 'BTC' else 0
            features['is_eth'] = 1 if base_currency == 'ETH' else 0
            features['is_stablecoin'] = 1 if base_currency in ['USDT', 'USDC', 'BUSD', 'DAI'] else 0
            
            # Características de balance
            balance_config = operation_data.get('balance_config', {})
            current_balance = safe_float(balance_config.get('balance_usdt', 0))
            features['current_balance_usdt'] = current_balance
            features['investment_to_balance_ratio'] = features['investment_usdt'] / max(current_balance, 1)
            features['balance_after_investment'] = current_balance - features['investment_usdt']
            features['balance_utilization'] = features['investment_usdt'] / max(current_balance, 1)
            
            # Características de riesgo
            features['risk_score'] = self._calculate_risk_score(features)
            features['profit_potential'] = max(0, features['price_difference_percentage'] - features['total_fee_percentage'])
            features['fee_to_profit_ratio'] = (
                features['total_fee_percentage'] / max(abs(features['price_difference_percentage']), 0.01)
            )
            
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
            return np.zeros((1, len(self.feature_names) if self.feature_names else 20))
    
    def _calculate_risk_score(self, features: Dict) -> float:
        """Calcula un score de riesgo basado en múltiples factores."""
        risk_score = 0.0
        
        # Riesgo por fees altos
        if features.get('total_fee_percentage', 0) > 1.0:
            risk_score += 0.3
        
        # Riesgo por mismo exchange
        if features.get('same_exchange', 0) == 1:
            risk_score += 0.2
        
        # Riesgo por baja diferencia de precio
        if features.get('price_difference_percentage', 0) < 0.5:
            risk_score += 0.4
        
        # Riesgo por alta utilización de balance
        if features.get('balance_utilization', 0) > 0.8:
            risk_score += 0.3
        
        # Riesgo por horario
        if features.get('is_weekend', 0) == 1:
            risk_score += 0.1
        
        return min(risk_score, 1.0)
    
    def _create_neural_network(self, input_dim: int) -> 'tf.keras.Model':
        """Crea la arquitectura optimizada de la red neuronal para arbitraje."""
        if not TENSORFLOW_AVAILABLE:
            raise ValueError("TensorFlow no está disponible para crear red neuronal")
        
        # Configurar semilla para reproducibilidad
        tf.random.set_seed(42)
        
        model = tf.keras.Sequential()
        
        # Capa de entrada con normalización por lotes
        model.add(layers.Dense(
            self.nn_config['hidden_layers'][0],
            input_dim=input_dim,
            activation='relu',
            kernel_regularizer=l2(self.nn_config['l2_reg']),
            kernel_initializer='he_normal'
        ))
        model.add(layers.BatchNormalization())
        model.add(layers.Dropout(self.nn_config['dropout_rate']))
        
        # Capas ocultas con normalización por lotes
        for i, units in enumerate(self.nn_config['hidden_layers'][1:]):
            model.add(layers.Dense(
                units,
                activation='relu',
                kernel_regularizer=l2(self.nn_config['l2_reg']),
                kernel_initializer='he_normal'
            ))
            model.add(layers.BatchNormalization())
            # Dropout progresivo (menos dropout en capas más profundas)
            dropout_rate = self.nn_config['dropout_rate'] * (0.8 ** (i + 1))
            model.add(layers.Dropout(dropout_rate))
        
        # Capa de salida (3 salidas: probabilidad_exito, ganancia_predicha, riesgo)
        # Usar activaciones específicas para cada salida
        model.add(layers.Dense(3, activation='linear', name='output_layer'))
        
        # Compilar modelo con optimizador mejorado
        optimizer = optimizers.Adam(
            learning_rate=self.nn_config['learning_rate'],
            beta_1=0.9,
            beta_2=0.999,
            epsilon=1e-7
        )
        
        # Función de pérdida personalizada para múltiples salidas
        model.compile(
            optimizer=optimizer,
            loss='mse',
            metrics=['mae', 'mse']
        )
        
        return model
    
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
            
            training_results = {}
            
            if self.use_neural_network:
                # Entrenar red neuronal
                training_results = self._train_neural_network(X, y_profit, y_success, y_risk)
            else:
                # Entrenar modelos sklearn tradicionales
                training_results = self._train_sklearn_models(X, y_profit, y_success, y_risk)

            self.is_trained = True
            self.training_history = {
                "last_training": get_current_timestamp(),
                "num_records": len(training_data),
                "results": training_results,
                "model_type": "neural_network" if self.use_neural_network else "sklearn"
            }
            self.save_model()
            
            model_type = "Red Neuronal" if self.use_neural_network else "Modelos sklearn"
            self.logger.info(f"Entrenamiento de {model_type} completado y modelo guardado.")
            return {"success": True, "message": f"{model_type} entrenado exitosamente", "results": training_results}

        except Exception as e:
            self.logger.error(f"Error durante el entrenamiento del modelo: {e}")
            self.is_trained = False
            return {"success": False, "message": f"Error durante el entrenamiento: {e}"}
    
    def _train_neural_network(self, X: np.ndarray, y_profit: np.ndarray, y_success: np.ndarray, y_risk: np.ndarray) -> Dict:
        """Entrena la red neuronal optimizada para arbitraje."""
        try:
            self.logger.info("🧠 Iniciando entrenamiento de red neuronal TensorFlow")
            
            # Dividir datos con estratificación
            X_train, X_test, y_profit_train, y_profit_test, y_success_train, y_success_test, y_risk_train, y_risk_test = train_test_split(
                X, y_profit, y_success, y_risk, test_size=0.2, random_state=42, stratify=y_success
            )
            
            self.logger.info(f"📊 Datos divididos - Entrenamiento: {X_train.shape[0]}, Prueba: {X_test.shape[0]}")
            
            # Escalar características para red neuronal
            X_train_scaled = self.nn_scaler.fit_transform(X_train)
            X_test_scaled = self.nn_scaler.transform(X_test)
            
            # Normalizar etiquetas de ganancia para mejor convergencia
            profit_mean = np.mean(y_profit_train)
            profit_std = np.std(y_profit_train) + 1e-8
            y_profit_train_norm = (y_profit_train - profit_mean) / profit_std
            y_profit_test_norm = (y_profit_test - profit_mean) / profit_std
            
            # Preparar etiquetas combinadas (probabilidad_exito, ganancia_normalizada, riesgo)
            y_train_combined = np.column_stack([y_success_train, y_profit_train_norm, y_risk_train])
            y_test_combined = np.column_stack([y_success_test, y_profit_test_norm, y_risk_test])
            
            self.logger.info(f"🔧 Características escaladas - Dimensiones: {X_train_scaled.shape[1]}")
            
            # Crear red neuronal
            self.neural_network = self._create_neural_network(X_train_scaled.shape[1])
            self.logger.info(f"🏗️ Red neuronal creada con {len(self.nn_config['hidden_layers'])} capas ocultas")
            
            # Callbacks mejorados
            early_stopping = callbacks.EarlyStopping(
                monitor='val_loss',
                patience=self.nn_config['early_stopping_patience'],
                restore_best_weights=True,
                verbose=1
            )
            
            reduce_lr = callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.7,
                patience=8,
                min_lr=1e-8,
                verbose=1
            )
            
            # Callback para guardar el mejor modelo
            model_checkpoint = callbacks.ModelCheckpoint(
                filepath=self.model_path.replace('.pkl', '_best_neural_network.h5'),
                monitor='val_loss',
                save_best_only=True,
                verbose=1
            )
            
            # Entrenar con callbacks mejorados
            self.logger.info(f"🚀 Iniciando entrenamiento - Épocas máximas: {self.nn_config['epochs']}")
            history = self.neural_network.fit(
                X_train_scaled, y_train_combined,
                batch_size=self.nn_config['batch_size'],
                epochs=self.nn_config['epochs'],
                validation_split=self.nn_config['validation_split'],
                callbacks=[early_stopping, reduce_lr, model_checkpoint],
                verbose=1
            )
            
            # Evaluar modelo
            self.logger.info("📈 Evaluando modelo entrenado...")
            y_pred_combined = self.neural_network.predict(X_test_scaled, verbose=0)
            
            # Desnormalizar predicciones de ganancia
            y_profit_pred = y_pred_combined[:, 1] * profit_std + profit_mean
            
            # Extraer predicciones con umbrales optimizados
            y_success_pred = (y_pred_combined[:, 0] > 0.5).astype(int)
            y_risk_pred = (y_pred_combined[:, 2] > 0.5).astype(int)
            
            # Calcular métricas detalladas
            training_results = {
                'model_type': 'neural_network',
                'profitability_accuracy': accuracy_score(y_success_test, y_success_pred),
                'profitability_precision': precision_score(y_success_test, y_success_pred, average='weighted', zero_division=0),
                'profitability_recall': recall_score(y_success_test, y_success_pred, average='weighted', zero_division=0),
                'profitability_f1': f1_score(y_success_test, y_success_pred, average='weighted', zero_division=0),
                'profit_mse': mean_squared_error(y_profit_test, y_profit_pred),
                'profit_rmse': np.sqrt(mean_squared_error(y_profit_test, y_profit_pred)),
                'profit_mae': np.mean(np.abs(y_profit_test - y_profit_pred)),
                'risk_accuracy': accuracy_score(y_risk_test, y_risk_pred),
                'risk_precision': precision_score(y_risk_test, y_risk_pred, average='weighted', zero_division=0),
                'final_loss': history.history['loss'][-1],
                'final_val_loss': history.history['val_loss'][-1],
                'best_val_loss': min(history.history['val_loss']),
                'epochs_trained': len(history.history['loss']),
                'early_stopped': len(history.history['loss']) < self.nn_config['epochs'],
                'learning_rate_final': float(self.neural_network.optimizer.learning_rate.numpy()),
                'total_parameters': self.neural_network.count_params()
            }
            
            # Guardar metadatos de normalización
            self.training_history['profit_normalization'] = {
                'mean': float(profit_mean),
                'std': float(profit_std)
            }
            
            self.logger.info(f"✅ Entrenamiento completado - Épocas: {training_results['epochs_trained']}")
            self.logger.info(f"📊 Precisión de rentabilidad: {training_results['profitability_accuracy']:.4f}")
            self.logger.info(f"💰 RMSE de ganancia: {training_results['profit_rmse']:.6f}")
            
            return training_results
            
        except Exception as e:
            self.logger.error(f"Error entrenando red neuronal: {e}")
            raise
    
    def _train_sklearn_models(self, X: np.ndarray, y_profit: np.ndarray, y_success: np.ndarray, y_risk: np.ndarray) -> Dict:
        """Entrena los modelos sklearn tradicionales."""
        # Dividir datos
        X_train, X_test, y_profit_train, y_profit_test, y_success_train, y_success_test, y_risk_train, y_risk_test = train_test_split(
            X, y_profit, y_success, y_risk, test_size=0.2, random_state=42, stratify=y_success
        )
        
        # Escalar características
        X_train_scaled = self.feature_scaler.fit_transform(X_train)
        X_test_scaled = self.feature_scaler.transform(X_test)
        
        training_results = {'model_type': 'sklearn'}
        
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
        training_results["profitability_cv_mean"] = np.mean(cv_scores)
        training_results["profitability_cv_std"] = np.std(cv_scores)
        
        return training_results

    def _prepare_training_data(self, training_data: List[Dict]) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Prepara los datos de entrenamiento a partir de la lista de diccionarios."""
        features_list = []
        profit_list = []
        success_list = []
        risk_list = []

        # Recopilar todos los nombres de características posibles
        all_feature_keys = set()
        for data in training_data:
            temp_features = self.prepare_features(data)
            if self.feature_names:
                all_feature_keys.update(self.feature_names)
            else:
                # Si feature_names aún no está definido, inferir de la primera data
                # Esto es un fallback, idealmente feature_names se define antes
                all_feature_keys.update(temp_features.flatten())

        # Asegurar que self.feature_names esté establecido antes de procesar todos los datos
        if not self.feature_names:
            self.feature_names = sorted(list(all_feature_keys))

        for data in training_data:
            try:
                # Asegurarse de que prepare_features use el self.feature_names ya establecido
                features_vector = self.prepare_features(data).flatten()
                
                # Asegurar que el vector de características tenga la longitud correcta
                if len(features_vector) != len(self.feature_names):
                    self.logger.warning(f"Longitud de características inconsistente para un registro. Esperado: {len(self.feature_names)}, Obtenido: {len(features_vector)}")
                    continue # Saltar este registro si es inconsistente

                features_list.append(features_vector)

                # Etiquetas
                net_profit_usdt = safe_float(data.get("net_profit_usdt", 0))
                profit_list.append(net_profit_usdt)

                # Definir éxito: ganancia neta > umbral mínimo
                is_successful = 1 if net_profit_usdt >= MIN_PROFIT_USDT else 0
                success_list.append(is_successful)

                # Definir riesgo: usar el score de riesgo calculado
                # Asegurarse de que _calculate_risk_score reciba las características correctas
                # Para simplificar, asumimos que un score > 0.5 es 'riesgoso'
                current_risk_score = self._calculate_risk_score(dict(zip(self.feature_names, features_vector))) # Pasar un diccionario de características
                is_risky = 1 if current_risk_score > 0.5 else 0
                risk_list.append(is_risky)
            except Exception as e:
                self.logger.error(f"Error preparando un registro de entrenamiento: {e}")
                continue

        if not features_list:
            raise ValueError("No se pudieron extraer características válidas de los datos de entrenamiento.")

        X = np.array(features_list)
        y_profit = np.array(profit_list)
        y_success = np.array(success_list)
        y_risk = np.array(risk_list)

        return X, y_profit, y_success, y_risk

    def predict(self, operation_data: Dict) -> Dict:
        """Realiza una predicción para una operación de arbitraje."""
        try:
            if not self.is_trained:
                return self._fallback_prediction(operation_data)
            
            # Preparar características
            X = self.prepare_features(operation_data)
            
            if self.use_neural_network and self.neural_network is not None:
                return self._predict_neural_network(X, operation_data)
            else:
                return self._predict_sklearsn(X, operation_data)
            
        except Exception as e:
            self.logger.error(f"Error en predicción: {e}")
            return self._fallback_prediction(operation_data)
    
    def _predict_neural_network(self, X: np.ndarray, operation_data: Dict) -> Dict:
        """Realiza predicción usando la red neuronal."""
        try:
            # Escalar características
            X_scaled = self.nn_scaler.transform(X)
            
            # Predicción
            predictions = self.neural_network.predict(X_scaled, verbose=0)[0]
            
            # Extraer predicciones
            success_probability = float(predictions[0])
            profit_prediction = float(predictions[1])
            high_risk_probability = float(predictions[2])
            
            # Asegurar que las probabilidades estén en rango [0, 1]
            success_probability = max(0.0, min(1.0, success_probability))
            high_risk_probability = max(0.0, min(1.0, high_risk_probability))
            
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
                reason = f"Predicción NN favorable: {success_probability:.3f} éxito, {profit_prediction:.4f} USDT"
            
            return {
                'should_execute': should_execute,
                'confidence': confidence,
                'predicted_profit_usdt': profit_prediction,
                'success_probability': success_probability,
                'high_risk_probability': high_risk_probability,
                'reason': reason,
                'model_version': f"neural_network_{self.training_history.get('last_training', 'unknown')}",
                'model_type': 'neural_network'
            }
            
        except Exception as e:
            self.logger.error(f"Error en predicción de red neuronal: {e}")
            return self._fallback_prediction(operation_data)
    
    def _predict_sklearn(self, X: np.ndarray, operation_data: Dict) -> Dict:
        """Realiza predicción usando modelos sklearn."""
        try:
            # Escalar características
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
                reason = f"Predicción sklearn favorable: {success_probability:.3f} éxito, {profit_prediction:.4f} USDT"
            
            return {
                'should_execute': should_execute,
                'confidence': confidence,
                'predicted_profit_usdt': profit_prediction,
                'success_probability': success_probability,
                'high_risk_probability': high_risk_probability,
                'reason': reason,
                'model_version': self.training_history.get('last_training', 'unknown'),
                'model_type': 'sklearn'
            }
            
        except Exception as e:
            self.logger.error(f"Error en predicción sklearn: {e}")
            return self._fallback_prediction(operation_data)

    def get_model_details(self) -> Dict:
        """Retorna detalles del modelo para la UI."""
        return {
            "is_trained": self.is_trained,
            "feature_count": len(self.feature_names),
            "last_updated": self.training_history.get("last_training", "N/A"),
            "confidence_threshold": self.confidence_threshold,
            "training_history": self.training_history,
            "model_type": "neural_network" if self.use_neural_network else "sklearn",
            "use_neural_network": self.use_neural_network
        }
    
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
