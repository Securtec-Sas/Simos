# Simos/V3/ai_training_manager.py

import asyncio
import logging
import json
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

from config_v3 import SEBO_API_BASE_URL
from ai_model import ArbitrageAIModel
from utils import get_current_timestamp, safe_float, safe_dict_get

class AITrainingManager:
    """Gestor de entrenamiento del modelo de IA con datos reales de Sebo."""
    
    def __init__(self, ai_model: ArbitrageAIModel, ui_broadcaster=None):
        self.logger = logging.getLogger('V3.AITrainingManager')
        self.ai_model = ai_model
        self.ui_broadcaster = ui_broadcaster
        
        # Estado del entrenamiento
        self.is_training = False
        self.training_progress = 0
        self.training_stats = {
            'total_records': 0,
            'processed_records': 0,
            'valid_records': 0,
            'training_accuracy': 0,
            'start_time': None,
            'end_time': None,
            'current_phase': 'idle'
        }
        
        # Configuración
        self.sebo_base_url = SEBO_API_BASE_URL
        
    async def start_training(self, training_params: Dict) -> Dict:
        """Inicia el proceso de entrenamiento con datos de Sebo."""
        if self.is_training:
            return {"error": "El entrenamiento ya está en progreso"}
        
        try:
            self.is_training = True
            self.training_stats['start_time'] = get_current_timestamp()
            self.training_stats['current_phase'] = 'fetching_data'
            
            self.logger.info("Iniciando entrenamiento del modelo de IA")
            
            # Emitir estado inicial a la UI
            await self._emit_training_update("Iniciando entrenamiento...")
            
            # 1. Obtener datos históricos de Sebo
            historical_data = await self._fetch_historical_data(training_params)
            
            if not historical_data:
                raise ValueError("No se pudieron obtener datos históricos de Sebo")
            
            self.training_stats['total_records'] = len(historical_data)
            await self._emit_training_update(f"Obtenidos {len(historical_data)} registros históricos")
            
            # 2. Procesar y limpiar datos
            self.training_stats['current_phase'] = 'processing_data'
            processed_data = await self._process_training_data(historical_data)
            
            self.training_stats['valid_records'] = len(processed_data)
            await self._emit_training_update(f"Procesados {len(processed_data)} registros válidos")
            
            # 3. Entrenar el modelo
            self.training_stats['current_phase'] = 'training_model'
            training_results = await self._train_model(processed_data)
            
            # 4. Guardar modelo entrenado
            self.ai_model.save_model()
            
            # 5. Finalizar entrenamiento
            self.training_stats['end_time'] = get_current_timestamp()
            self.training_stats['current_phase'] = 'completed'
            self.training_stats['training_accuracy'] = training_results.get('accuracy', 0)
            
            await self._emit_training_update("Entrenamiento completado exitosamente", training_results)
            
            self.logger.info(f"Entrenamiento completado. Precisión: {training_results.get('accuracy', 0):.2%}")
            
            return {
                "success": True,
                "message": "Entrenamiento completado exitosamente",
                "stats": self.training_stats,
                "results": training_results
            }
            
        except Exception as e:
            self.logger.error(f"Error durante el entrenamiento: {e}")
            self.training_stats['current_phase'] = 'error'
            await self._emit_training_update(f"Error en el entrenamiento: {str(e)}")
            
            return {
                "success": False,
                "error": str(e),
                "stats": self.training_stats
            }
        finally:
            self.is_training = False
    
    async def _fetch_historical_data(self, params: Dict) -> List[Dict]:
        """Obtiene datos históricos del análisis de Sebo."""
        try:
            # Parámetros de consulta
            days_back = params.get('days_back', 30)
            limit = params.get('limit', 1000)
            
            # Calcular fecha de inicio
            start_date = datetime.now() - timedelta(days=days_back)
            
            # URL del endpoint de análisis de Sebo
            url = f"{self.sebo_base_url}/analysis/historical"
            
            # Parámetros de la consulta
            query_params = {
                'start_date': start_date.isoformat(),
                'limit': limit,
                'include_fees': True
            }
            
            self.logger.info(f"Obteniendo datos históricos desde {start_date.strftime('%Y-%m-%d')}")
            
            # Realizar petición HTTP
            response = requests.get(url, params=query_params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.logger.info(f"Obtenidos {len(data)} registros históricos")
                return data
            else:
                self.logger.error(f"Error obteniendo datos históricos: {response.status_code}")
                return []
                
        except Exception as e:
            self.logger.error(f"Error en _fetch_historical_data: {e}")
            return []
    
    async def _process_training_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Procesa y limpia los datos para el entrenamiento."""
        processed_data = []
        
        for i, record in enumerate(raw_data):
            try:
                # Actualizar progreso
                self.training_progress = (i / len(raw_data)) * 50  # 50% para procesamiento
                
                if i % 100 == 0:  # Emitir actualización cada 100 registros
                    await self._emit_training_update(f"Procesando registro {i+1}/{len(raw_data)}")
                
                # Extraer datos relevantes
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
                    'investment_usdt': 100,  # Inversión estándar para entrenamiento
                }
                
                # Calcular rentabilidad real (considerando fees)
                buy_price = processed_record['current_price_buy']
                sell_price = processed_record['current_price_sell']
                
                if buy_price > 0 and sell_price > 0:
                    # Calcular ganancia bruta
                    gross_profit_percentage = ((sell_price - buy_price) / buy_price) * 100
                    
                    # Restar fees
                    total_fees = (processed_record['buy_taker_fee'] + processed_record['sell_taker_fee']) * 100
                    net_profit_percentage = gross_profit_percentage - total_fees
                    
                    # Determinar si fue rentable (umbral mínimo 0.1%)
                    is_profitable = net_profit_percentage > 0.1
                    
                    processed_record['net_profit_percentage'] = net_profit_percentage
                    processed_record['is_profitable'] = is_profitable
                    processed_record['risk_level'] = self._calculate_risk_level(processed_record)
                    
                    # Solo incluir registros válidos
                    if buy_price > 0 and sell_price > 0:
                        processed_data.append(processed_record)
                
            except Exception as e:
                self.logger.warning(f"Error procesando registro {i}: {e}")
                continue
        
        self.logger.info(f"Procesados {len(processed_data)} registros válidos de {len(raw_data)} totales")
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
    
    async def _train_model(self, training_data: List[Dict]) -> Dict:
        """Entrena el modelo de IA con los datos procesados."""
        try:
            self.logger.info(f"Iniciando entrenamiento del modelo con {len(training_data)} registros")
            
            # Entrenar el modelo
            training_results = self.ai_model.train(training_data)
            
            # Actualizar progreso
            self.training_progress = 100
            
            return training_results
            
        except Exception as e:
            self.logger.error(f"Error entrenando modelo: {e}")
            raise
    
    async def _emit_training_update(self, message: str, data: Dict = None):
        """Emite actualizaciones del entrenamiento a la UI."""
        if self.ui_broadcaster:
            update_data = {
                'message': message,
                'progress': self.training_progress,
                'stats': self.training_stats,
                'timestamp': get_current_timestamp()
            }
            
            if data:
                update_data['data'] = data
            
            try:
                await self.ui_broadcaster.broadcast_message({
                    'type': 'ai_training_update',
                    'payload': update_data
                })
            except Exception as e:
                self.logger.warning(f"Error emitiendo actualización de entrenamiento: {e}")
    
    def get_training_status(self) -> Dict:
        """Retorna el estado actual del entrenamiento."""
        return {
            'is_training': self.is_training,
            'progress': self.training_progress,
            'stats': self.training_stats
        }
    
    async def stop_training(self):
        """Detiene el entrenamiento en curso."""
        if self.is_training:
            self.is_training = False
            self.training_stats['current_phase'] = 'stopped'
            await self._emit_training_update("Entrenamiento detenido por el usuario")
            self.logger.info("Entrenamiento detenido por el usuario")

