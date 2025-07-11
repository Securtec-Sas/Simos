# Simos/V3/ai_test_manager.py

import asyncio
import logging
import json
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

from config_v3 import SEBO_API_BASE_URL
from ai_model import ArbitrageAIModel
from utils import get_current_timestamp, safe_float, safe_dict_get

class AITestManager:
    """Gestor de pruebas del modelo de IA con datos reales de Sebo."""
    
    def __init__(self, ai_model: ArbitrageAIModel, ui_broadcaster=None):
        self.logger = logging.getLogger('V3.AITestManager')
        self.ai_model = ai_model
        self.ui_broadcaster = ui_broadcaster
        
        # Estado de las pruebas
        self.is_testing = False
        self.test_progress = 0
        self.test_stats = {
            'total_samples': 0,
            'processed_samples': 0,
            'correct_predictions': 0,
            'start_time': None,
            'end_time': None,
            'current_phase': 'idle'
        }
        
        # Configuración
        self.sebo_base_url = SEBO_API_BASE_URL
        
    async def start_test(self, test_params: Dict) -> Dict:
        """Inicia el proceso de prueba del modelo con datos reales de Sebo."""
        if self.is_testing:
            return {"error": "Las pruebas ya están en progreso"}
        
        if not self.ai_model.is_trained:
            return {"error": "El modelo debe estar entrenado antes de realizar pruebas"}
        
        try:
            self.is_testing = True
            self.test_stats['start_time'] = get_current_timestamp()
            self.test_stats['current_phase'] = 'fetching_test_data'
            
            self.logger.info("Iniciando pruebas del modelo de IA")
            
            # Emitir estado inicial a la UI
            await self._emit_test_update("Iniciando pruebas del modelo...")
            
            # 1. Obtener datos de prueba de Sebo (datos más recientes)
            test_data = await self._fetch_test_data(test_params)
            
            if not test_data:
                raise ValueError("No se pudieron obtener datos de prueba de Sebo")
            
            self.test_stats['total_samples'] = len(test_data)
            await self._emit_test_update(f"Obtenidos {len(test_data)} registros para prueba")
            
            # 2. Procesar datos de prueba
            self.test_stats['current_phase'] = 'processing_test_data'
            processed_test_data = await self._process_test_data(test_data)
            
            await self._emit_test_update(f"Procesados {len(processed_test_data)} registros válidos")
            
            # 3. Ejecutar pruebas del modelo
            self.test_stats['current_phase'] = 'testing_model'
            test_results = await self._run_model_tests(processed_test_data)
            
            # 4. Finalizar pruebas
            self.test_stats['end_time'] = get_current_timestamp()
            self.test_stats['current_phase'] = 'completed'
            
            await self._emit_test_update("Pruebas completadas exitosamente", test_results)
            
            self.logger.info(f"Pruebas completadas. Precisión: {test_results.get('accuracy', 0):.2%}")
            
            return {
                "success": True,
                "message": "Pruebas completadas exitosamente",
                "stats": self.test_stats,
                "results": test_results
            }
            
        except Exception as e:
            self.logger.error(f"Error durante las pruebas: {e}")
            self.test_stats['current_phase'] = 'error'
            await self._emit_test_update(f"Error en las pruebas: {str(e)}")
            
            return {
                "success": False,
                "error": str(e),
                "stats": self.test_stats
            }
        finally:
            self.is_testing = False
    
    async def _fetch_test_data(self, params: Dict) -> List[Dict]:
        """Obtiene datos recientes del análisis de Sebo para pruebas."""
        try:
            # Parámetros de consulta (datos más recientes para pruebas)
            days_back = params.get('days_back', 7)  # Menos días para datos más recientes
            limit = params.get('limit', 500)  # Menos datos para pruebas
            
            # Calcular fecha de inicio (datos más recientes)
            start_date = datetime.now() - timedelta(days=days_back)
            
            # URL del endpoint de análisis de Sebo
            url = f"{self.sebo_base_url}/analysis/historical"
            
            # Parámetros de la consulta
            query_params = {
                'start_date': start_date.isoformat(),
                'limit': limit,
                'include_fees': True
            }
            
            self.logger.info(f"Obteniendo datos de prueba desde {start_date.strftime('%Y-%m-%d')}")
            
            # Realizar petición HTTP
            response = requests.get(url, params=query_params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.logger.info(f"Obtenidos {len(data)} registros para prueba")
                return data
            else:
                self.logger.error(f"Error obteniendo datos de prueba: {response.status_code}")
                return []
                
        except Exception as e:
            self.logger.error(f"Error en _fetch_test_data: {e}")
            return []
    
    async def _process_test_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Procesa y limpia los datos para las pruebas."""
        processed_data = []
        
        for i, record in enumerate(raw_data):
            try:
                # Actualizar progreso
                self.test_progress = (i / len(raw_data)) * 50  # 50% para procesamiento
                
                if i % 50 == 0:  # Emitir actualización cada 50 registros
                    await self._emit_test_update(f"Procesando registro de prueba {i+1}/{len(raw_data)}")
                
                # Extraer datos relevantes (mismo formato que entrenamiento)
                processed_record = {
                    'symbol': record.get('id_exchsymbol', {}).get('sy_id', 'UNKNOWN'),
                    'buy_exchange_id': record.get('id_exdataMax', 'unknown'),
                    'sell_exchange_id': record.get('id_exdataMin', 'unknown'),
                    'current_price_buy': safe_float(record.get('Val_max_buy', 0)),
                    'current_price_sell': safe_float(record.get('Val_min_sell', 0)),
                    'price_difference_percentage': safe_float(record.get('promedio', 0)),
                    'buy_taker_fee': safe_float(record.get('taker_fee_exMax', 0.001)),
                    'buy_maker_fee': safe_float(record.get('maker_fee_exMax', 0.001)),
                    'sell_taker_fee': safe_float(record.get('taker_fee_exMin', 0.001)),
                    'sell_maker_fee': safe_float(record.get('maker_fee_exMin', 0.001)),
                    'timestamp': record.get('timestamp', get_current_timestamp()),
                    'investment_usdt': 100,  # Inversión estándar para pruebas
                }
                
                # Calcular rentabilidad real (ground truth)
                buy_price = processed_record['current_price_buy']
                sell_price = processed_record['current_price_sell']
                
                if buy_price > 0 and sell_price > 0:
                    # Calcular ganancia bruta
                    gross_profit_percentage = ((sell_price - buy_price) / buy_price) * 100
                    
                    # Restar fees
                    total_fees = (processed_record['buy_taker_fee'] + processed_record['sell_taker_fee']) * 100
                    net_profit_percentage = gross_profit_percentage - total_fees
                    
                    # Determinar si fue rentable (ground truth)
                    is_profitable = net_profit_percentage > 0.1
                    
                    processed_record['net_profit_percentage'] = net_profit_percentage
                    processed_record['is_profitable'] = is_profitable
                    processed_record['risk_level'] = self._calculate_risk_level(processed_record)
                    
                    # Solo incluir registros válidos
                    if buy_price > 0 and sell_price > 0:
                        processed_data.append(processed_record)
                
            except Exception as e:
                self.logger.warning(f"Error procesando registro de prueba {i}: {e}")
                continue
        
        self.logger.info(f"Procesados {len(processed_data)} registros válidos de {len(raw_data)} totales para prueba")
        return processed_data
    
    def _calculate_risk_level(self, record: Dict) -> str:
        """Calcula el nivel de riesgo de una operación."""
        try:
            profit_percentage = record.get('net_profit_percentage', 0)
            price_difference = record.get('price_difference_percentage', 0)
            
            # Factores de riesgo
            if profit_percentage < 0.1:
                return 'high'
            elif profit_percentage < 0.5:
                return 'medium'
            elif price_difference > 5:  # Diferencias muy altas pueden ser riesgosas
                return 'medium'
            else:
                return 'low'
                
        except Exception:
            return 'high'
    
    async def _run_model_tests(self, test_data: List[Dict]) -> Dict:
        """Ejecuta las pruebas del modelo con los datos procesados."""
        try:
            self.logger.info(f"Iniciando pruebas del modelo con {len(test_data)} registros")
            
            # Preparar datos para predicción
            predictions = []
            ground_truth = []
            detailed_results = []
            
            for i, record in enumerate(test_data):
                try:
                    # Actualizar progreso
                    self.test_progress = 50 + (i / len(test_data)) * 50  # 50% base + 50% para pruebas
                    
                    if i % 25 == 0:  # Emitir actualización cada 25 registros
                        await self._emit_test_update(f"Probando registro {i+1}/{len(test_data)}")
                    
                    # Realizar predicción con el modelo
                    prediction_result = self.ai_model.predict_arbitrage_opportunity(record)
                    
                    # Extraer predicción y ground truth
                    predicted_profitable = prediction_result.get('is_profitable', False)
                    actual_profitable = record.get('is_profitable', False)
                    
                    predictions.append(predicted_profitable)
                    ground_truth.append(actual_profitable)
                    
                    # Guardar resultado detallado
                    detailed_result = {
                        'symbol': record.get('symbol'),
                        'predicted_profitable': predicted_profitable,
                        'actual_profitable': actual_profitable,
                        'predicted_profit': prediction_result.get('expected_profit_percentage', 0),
                        'actual_profit': record.get('net_profit_percentage', 0),
                        'confidence': prediction_result.get('confidence', 0),
                        'correct': predicted_profitable == actual_profitable
                    }
                    detailed_results.append(detailed_result)
                    
                    # Actualizar estadísticas
                    self.test_stats['processed_samples'] += 1
                    if predicted_profitable == actual_profitable:
                        self.test_stats['correct_predictions'] += 1
                    
                except Exception as e:
                    self.logger.warning(f"Error probando registro {i}: {e}")
                    continue
            
            # Calcular métricas de rendimiento
            if len(predictions) > 0:
                accuracy = accuracy_score(ground_truth, predictions)
                precision = precision_score(ground_truth, predictions, average='binary', zero_division=0)
                recall = recall_score(ground_truth, predictions, average='binary', zero_division=0)
                f1 = f1_score(ground_truth, predictions, average='binary', zero_division=0)
                
                # Matriz de confusión
                cm = confusion_matrix(ground_truth, predictions)
                
                # Estadísticas adicionales
                total_tested = len(predictions)
                correct_predictions = sum(1 for p, g in zip(predictions, ground_truth) if p == g)
                
                # Análisis por rentabilidad
                profitable_predicted = sum(predictions)
                profitable_actual = sum(ground_truth)
                
                test_results = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'total_tested': total_tested,
                    'correct_predictions': correct_predictions,
                    'profitable_predicted': profitable_predicted,
                    'profitable_actual': profitable_actual,
                    'confusion_matrix': {
                        'true_negative': int(cm[0][0]) if cm.shape == (2, 2) else 0,
                        'false_positive': int(cm[0][1]) if cm.shape == (2, 2) else 0,
                        'false_negative': int(cm[1][0]) if cm.shape == (2, 2) else 0,
                        'true_positive': int(cm[1][1]) if cm.shape == (2, 2) else 0
                    },
                    'detailed_results': detailed_results[-20],  # Últimos 20 resultados detallados
                    'test_summary': {
                        'avg_predicted_profit': np.mean([r['predicted_profit'] for r in detailed_results]),
                        'avg_actual_profit': np.mean([r['actual_profit'] for r in detailed_results]),
                        'avg_confidence': np.mean([r['confidence'] for r in detailed_results])
                    }
                }
                
                self.logger.info(f"Pruebas completadas - Precisión: {accuracy:.2%}, F1: {f1:.2%}")
                
            else:
                test_results = {
                    'error': 'No se pudieron procesar datos de prueba',
                    'total_tested': 0
                }
            
            # Actualizar progreso final
            self.test_progress = 100
            
            return test_results
            
        except Exception as e:
            self.logger.error(f"Error ejecutando pruebas del modelo: {e}")
            raise
    
    async def _emit_test_update(self, message: str, data: Dict = None):
        """Emite actualizaciones de las pruebas a la UI."""
        if self.ui_broadcaster:
            update_data = {
                'message': message,
                'progress': self.test_progress,
                'stats': self.test_stats,
                'timestamp': get_current_timestamp()
            }
            
            if data:
                update_data['data'] = data
            
            try:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'ai_test_update',
                    'payload': update_data
                })
            except Exception as e:
                self.logger.warning(f"Error emitiendo actualización de prueba: {e}")
    
    def get_test_status(self) -> Dict:
        """Retorna el estado actual de las pruebas."""
        return {
            'is_testing': self.is_testing,
            'progress': self.test_progress,
            'stats': self.test_stats
        }
    
    async def stop_test(self):
        """Detiene las pruebas en curso."""
        if self.is_testing:
            self.is_testing = False
            self.test_stats['current_phase'] = 'stopped'
            await self._emit_test_update("Pruebas detenidas por el usuario")
            self.logger.info("Pruebas detenidas por el usuario")

