# V3/core/ai_model_test.py

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import json
import os
import sys

# Agregar el directorio padre al path para importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_model import ArbitrageAIModel
from shared.utils import safe_float, get_current_timestamp

class AIModelTester:
    """Clase para probar y evaluar el modelo de IA de arbitraje."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.AIModelTester')
        self.ai_model = ArbitrageAIModel()
        self.test_results = {}
        
    def generate_test_data(self, num_samples: int = 100, days_back: int = 30) -> List[Dict]:
        """Genera datos de prueba sintéticos para el modelo."""
        try:
            test_data = []
            base_date = datetime.now(timezone.utc) - timedelta(days=days_back)
            
            # Símbolos de prueba
            symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT']
            exchanges = ['binance', 'kucoin', 'okx', 'bybit', 'gate']
            
            for i in range(num_samples):
                # Generar timestamp aleatorio
                random_hours = np.random.randint(0, days_back * 24)
                timestamp = base_date + timedelta(hours=random_hours)
                
                # Generar precios base
                base_price = np.random.uniform(0.1, 50000)  # Precio base aleatorio
                price_variation = np.random.uniform(-0.05, 0.05)  # Variación de ±5%
                
                buy_price = base_price
                sell_price = base_price * (1 + price_variation)
                
                # Generar datos de operación
                investment_usdt = np.random.uniform(10, 1000)
                
                # Calcular fees estimados
                buy_fee_rate = np.random.uniform(0.001, 0.002)  # 0.1% - 0.2%
                sell_fee_rate = np.random.uniform(0.001, 0.002)
                transfer_fee = np.random.uniform(0.5, 5.0)  # Fee fijo de transferencia
                
                estimated_buy_fee = investment_usdt * buy_fee_rate
                estimated_sell_fee = (investment_usdt / buy_price * sell_price) * sell_fee_rate
                estimated_transfer_fee = transfer_fee
                total_fees_usdt = estimated_buy_fee + estimated_sell_fee + estimated_transfer_fee
                
                # Calcular ganancia neta
                gross_profit = (investment_usdt / buy_price) * sell_price - investment_usdt
                net_profit_usdt = gross_profit - total_fees_usdt
                profit_percentage = (net_profit_usdt / investment_usdt) * 100
                
                # Determinar resultado de la operación
                execution_time = np.random.uniform(5, 300)  # 5 segundos a 5 minutos
                
                # Simular decisión basada en rentabilidad
                if net_profit_usdt > 0.5 and profit_percentage > 0.1:
                    decision_outcome = 'EJECUTADA_EXITOSA'
                elif net_profit_usdt < -1.0:
                    decision_outcome = 'EJECUTADA_PERDIDA'
                else:
                    decision_outcome = 'NO_EJECUTADA'
                
                # Crear registro de prueba
                test_record = {
                    'timestamp': timestamp.isoformat(),
                    'symbol': np.random.choice(symbols),
                    'buy_exchange_id': np.random.choice(exchanges),
                    'sell_exchange_id': np.random.choice(exchanges),
                    'current_price_buy': buy_price,
                    'current_price_sell': sell_price,
                    'investment_usdt': investment_usdt,
                    'estimated_buy_fee': estimated_buy_fee,
                    'estimated_sell_fee': estimated_sell_fee,
                    'estimated_transfer_fee': estimated_transfer_fee,
                    'total_fees_usdt': total_fees_usdt,
                    'net_profit_usdt': net_profit_usdt,
                    'profit_percentage': profit_percentage,
                    'execution_time_seconds': execution_time,
                    'decision_outcome': decision_outcome,
                    'market_data': {
                        'buy_fees': {'taker': buy_fee_rate},
                        'sell_fees': {'taker': sell_fee_rate}
                    },
                    'balance_config': {
                        'balance_usdt': np.random.uniform(100, 5000)
                    }
                }
                
                test_data.append(test_record)
            
            self.logger.info(f"Generados {len(test_data)} registros de prueba")
            return test_data
            
        except Exception as e:
            self.logger.error(f"Error generando datos de prueba: {e}")
            return []
    
    def test_model_training(self, training_data: List[Dict] = None, num_samples: int = 200) -> Dict:
        """Prueba el entrenamiento del modelo."""
        try:
            self.logger.info("Iniciando prueba de entrenamiento del modelo")
            
            # Usar datos proporcionados o generar nuevos
            if training_data is None:
                training_data = self.generate_test_data(num_samples=num_samples)
            
            if not training_data:
                return {"success": False, "error": "No hay datos de entrenamiento"}
            
            # Entrenar el modelo
            training_result = self.ai_model.train(training_data)
            
            # Evaluar resultados
            test_result = {
                "training_success": training_result.get("success", False),
                "training_message": training_result.get("message", ""),
                "model_trained": self.ai_model.is_trained,
                "feature_count": len(self.ai_model.feature_names),
                "training_data_count": len(training_data),
                "timestamp": get_current_timestamp()
            }
            
            if training_result.get("results"):
                test_result["training_metrics"] = training_result["results"]
            
            self.test_results["training"] = test_result
            self.logger.info(f"Prueba de entrenamiento completada: {test_result['training_success']}")
            
            return test_result
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "timestamp": get_current_timestamp()
            }
            self.test_results["training"] = error_result
            self.logger.error(f"Error en prueba de entrenamiento: {e}")
            return error_result
    
    def test_model_prediction(self, test_cases: List[Dict] = None, num_cases: int = 10) -> Dict:
        """Prueba las predicciones del modelo."""
        try:
            self.logger.info("Iniciando prueba de predicciones del modelo")
            
            # Generar casos de prueba si no se proporcionan
            if test_cases is None:
                test_cases = self.generate_test_data(num_samples=num_cases, days_back=1)
            
            predictions = []
            successful_predictions = 0
            
            for i, test_case in enumerate(test_cases):
                try:
                    # Realizar predicción
                    prediction = self.ai_model.predict(test_case)
                    
                    # Agregar información del caso de prueba
                    prediction_result = {
                        "case_id": i + 1,
                        "symbol": test_case.get("symbol", "N/A"),
                        "buy_price": test_case.get("current_price_buy", 0),
                        "sell_price": test_case.get("current_price_sell", 0),
                        "investment_usdt": test_case.get("investment_usdt", 0),
                        "actual_profit": test_case.get("net_profit_usdt", 0),
                        "prediction": prediction
                    }
                    
                    predictions.append(prediction_result)
                    
                    if prediction.get("should_execute") is not None:
                        successful_predictions += 1
                        
                except Exception as e:
                    self.logger.warning(f"Error en predicción del caso {i + 1}: {e}")
                    predictions.append({
                        "case_id": i + 1,
                        "error": str(e)
                    })
            
            # Calcular estadísticas
            total_cases = len(test_cases)
            success_rate = (successful_predictions / total_cases) * 100 if total_cases > 0 else 0
            
            # Analizar predicciones exitosas
            execute_recommendations = sum(1 for p in predictions 
                                        if p.get("prediction", {}).get("should_execute", False))
            
            test_result = {
                "success": True,
                "total_cases": total_cases,
                "successful_predictions": successful_predictions,
                "success_rate": success_rate,
                "execute_recommendations": execute_recommendations,
                "predictions": predictions,
                "model_info": self.ai_model.get_model_info(),
                "timestamp": get_current_timestamp()
            }
            
            self.test_results["prediction"] = test_result
            self.logger.info(f"Prueba de predicciones completada: {success_rate:.1f}% éxito")
            
            return test_result
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "timestamp": get_current_timestamp()
            }
            self.test_results["prediction"] = error_result
            self.logger.error(f"Error en prueba de predicciones: {e}")
            return error_result
    
    def test_feature_preparation(self, sample_data: Dict = None) -> Dict:
        """Prueba la preparación de características."""
        try:
            self.logger.info("Iniciando prueba de preparación de características")
            
            # Usar datos de muestra o generar uno
            if sample_data is None:
                sample_data = self.generate_test_data(num_samples=1)[0]
            
            # Preparar características
            features = self.ai_model.prepare_features(sample_data)
            
            test_result = {
                "success": True,
                "feature_shape": features.shape,
                "feature_count": features.shape[1] if len(features.shape) > 1 else len(features),
                "feature_names": self.ai_model.feature_names,
                "sample_features": features.flatten().tolist()[:10],  # Primeras 10 características
                "input_data_keys": list(sample_data.keys()),
                "timestamp": get_current_timestamp()
            }
            
            self.test_results["feature_preparation"] = test_result
            self.logger.info(f"Prueba de características completada: {test_result['feature_count']} características")
            
            return test_result
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "timestamp": get_current_timestamp()
            }
            self.test_results["feature_preparation"] = error_result
            self.logger.error(f"Error en prueba de características: {e}")
            return error_result
    
    def run_comprehensive_test(self, training_samples: int = 200, prediction_samples: int = 20) -> Dict:
        """Ejecuta una prueba completa del modelo."""
        try:
            self.logger.info("Iniciando prueba completa del modelo de IA")
            
            comprehensive_results = {
                "test_started": get_current_timestamp(),
                "tests": {}
            }
            
            # 1. Prueba de preparación de características
            self.logger.info("Ejecutando prueba de características...")
            feature_test = self.test_feature_preparation()
            comprehensive_results["tests"]["feature_preparation"] = feature_test
            
            # 2. Prueba de entrenamiento
            self.logger.info("Ejecutando prueba de entrenamiento...")
            training_test = self.test_model_training(num_samples=training_samples)
            comprehensive_results["tests"]["training"] = training_test
            
            # 3. Prueba de predicciones (solo si el entrenamiento fue exitoso)
            if training_test.get("training_success", False):
                self.logger.info("Ejecutando prueba de predicciones...")
                prediction_test = self.test_model_prediction(num_cases=prediction_samples)
                comprehensive_results["tests"]["prediction"] = prediction_test
            else:
                self.logger.warning("Saltando prueba de predicciones debido a fallo en entrenamiento")
                comprehensive_results["tests"]["prediction"] = {
                    "skipped": True,
                    "reason": "Training failed"
                }
            
            # 4. Resumen general
            comprehensive_results["test_completed"] = get_current_timestamp()
            comprehensive_results["overall_success"] = all([
                feature_test.get("success", False),
                training_test.get("training_success", False),
                comprehensive_results["tests"]["prediction"].get("success", True)  # True si se saltó
            ])
            
            # 5. Información del modelo
            comprehensive_results["model_info"] = self.ai_model.get_model_info()
            
            self.test_results["comprehensive"] = comprehensive_results
            self.logger.info(f"Prueba completa finalizada: {comprehensive_results['overall_success']}")
            
            return comprehensive_results
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "test_started": get_current_timestamp(),
                "test_completed": get_current_timestamp()
            }
            self.test_results["comprehensive"] = error_result
            self.logger.error(f"Error en prueba completa: {e}")
            return error_result
    
    def get_test_summary(self) -> Dict:
        """Retorna un resumen de todas las pruebas ejecutadas."""
        return {
            "test_results": self.test_results,
            "model_status": {
                "is_trained": self.ai_model.is_trained,
                "feature_count": len(self.ai_model.feature_names),
                "confidence_threshold": self.ai_model.confidence_threshold
            },
            "summary_generated": get_current_timestamp()
        }
    
    def export_test_results(self, filepath: str = None) -> str:
        """Exporta los resultados de las pruebas a un archivo JSON."""
        try:
            if filepath is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filepath = f"V3/data/ai_model_test_results_{timestamp}.json"
            
            # Crear directorio si no existe
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # Exportar resultados
            export_data = self.get_test_summary()
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info(f"Resultados de prueba exportados a: {filepath}")
            return filepath
            
        except Exception as e:
            self.logger.error(f"Error exportando resultados: {e}")
            return ""

# Función principal para ejecutar desde la UI
def run_ai_model_test(test_type: str = "comprehensive", **kwargs) -> Dict:
    """
    Función principal para ejecutar pruebas del modelo de IA.
    
    Args:
        test_type: Tipo de prueba ('training', 'prediction', 'features', 'comprehensive')
        **kwargs: Parámetros adicionales para las pruebas
    
    Returns:
        Dict con los resultados de la prueba
    """
    try:
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        tester = AIModelTester()
        
        if test_type == "training":
            return tester.test_model_training(
                num_samples=kwargs.get("training_samples", 200)
            )
        elif test_type == "prediction":
            return tester.test_model_prediction(
                num_cases=kwargs.get("prediction_samples", 20)
            )
        elif test_type == "features":
            return tester.test_feature_preparation()
        elif test_type == "comprehensive":
            return tester.run_comprehensive_test(
                training_samples=kwargs.get("training_samples", 200),
                prediction_samples=kwargs.get("prediction_samples", 20)
            )
        else:
            return {
                "success": False,
                "error": f"Tipo de prueba no reconocido: {test_type}",
                "available_types": ["training", "prediction", "features", "comprehensive"]
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Error ejecutando prueba: {e}",
            "timestamp": get_current_timestamp()
        }

# Función para obtener información del modelo
def get_model_status() -> Dict:
    """Retorna el estado actual del modelo de IA."""
    try:
        model = ArbitrageAIModel()
        return {
            "success": True,
            "model_info": model.get_model_info(),
            "timestamp": get_current_timestamp()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": get_current_timestamp()
        }

if __name__ == "__main__":
    # Ejecutar prueba completa si se ejecuta directamente
    print("Ejecutando prueba completa del modelo de IA...")
    result = run_ai_model_test("comprehensive")
    print(json.dumps(result, indent=2, default=str))