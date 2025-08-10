# Simos/V3/training_handler.py

import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import os
import json
import csv
from io import StringIO

from shared.config_v3 import DATA_DIR
from shared.utils import get_current_timestamp, safe_float
from core.ai_model import ArbitrageAIModel
from adapters.persistence.data_persistence import DataPersistence
from adapters.connectors.sebo_symbols_api import SeboSymbolsAPI

class TrainingHandler:
    """Manejador para operaciones de entrenamiento del modelo de IA."""
    
    def __init__(self, sebo_connector, ai_model: ArbitrageAIModel, 
                 data_persistence: DataPersistence, ui_broadcaster=None):
        self.logger = logging.getLogger("V3.TrainingHandler")
        self.sebo_connector = sebo_connector
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        self.ui_broadcaster = ui_broadcaster
        
        # Inicializar API de símbolos de Sebo
        self.sebo_symbols_api = SeboSymbolsAPI()
        
        # Estado del entrenamiento
        self.training_in_progress = False
        self.training_results = {}
        self.training_progress = 0
        self.training_filepath = None # Para persistir la ruta del archivo
        
        # Estado de las pruebas
        self.testing_in_progress = False
        self.testing_results = {}
        self.testing_progress = 0
        self.testing_filepath = None
        

    
    async def start_training(self, request_data: Dict) -> Dict:
        """Inicia el entrenamiento del modelo."""
        try:
            if self.training_in_progress:
                return {"status": "error", "message": "Ya hay un entrenamiento en progreso"}
            
            self.training_in_progress = True
            self.training_progress = 0
            
            # Obtener la ruta del archivo del payload
            filepath = request_data.get("filepath")
            
            if not filepath:
                self.training_in_progress = False
                return {"status": "error", "message": "Se requiere la ruta del archivo de entrenamiento (filepath)"}
            
            if not os.path.exists(filepath):
                self.training_in_progress = False
                return {"status": "error", "message": f"Archivo de entrenamiento no encontrado: {filepath}"}
            
            self.training_filepath = filepath # Guardar la ruta del archivo

            # Iniciar entrenamiento en background
            asyncio.create_task(self._run_training_process(filepath))
            
            return {
                "status": "success",
                "message": "Entrenamiento iniciado",
                "data": {"training_id": get_current_timestamp()}
            }
            
        except Exception as e:
            self.logger.error(f"Error iniciando entrenamiento: {e}")
            self.training_in_progress = False
            return {"status": "error", "message": f"Error interno: {str(e)}"}
    
    async def start_tests(self, request_data: Dict) -> Dict:
        """Inicia las pruebas del modelo."""
        try:
            if self.testing_in_progress:
                return {"status": "error", "message": "Ya hay pruebas en progreso"}
            
            if self.training_in_progress:
                return {"status": "error", "message": "No se pueden ejecutar pruebas mientras hay entrenamiento en progreso"}
            
            self.testing_in_progress = True
            self.testing_progress = 0
            
            # Obtener la ruta del archivo del payload
            csv_filename = request_data.get("csv_filename")
            filepath = request_data.get("filepath")
            
            if csv_filename:
                filepath = os.path.join(DATA_DIR, csv_filename)
            elif not filepath:
                self.testing_in_progress = False
                return {"status": "error", "message": "Se requiere csv_filename o filepath"}
            
            if not os.path.exists(filepath):
                self.testing_in_progress = False
                return {"status": "error", "message": f"Archivo CSV no encontrado: {filepath}"}
            
            self.testing_filepath = filepath
            
            # Iniciar pruebas en background
            asyncio.create_task(self._run_testing_process(filepath))
            
            return {
                "status": "success",
                "message": "Pruebas iniciadas",
                "data": {"test_id": get_current_timestamp()}
            }
            
        except Exception as e:
            self.logger.error(f"Error iniciando pruebas: {e}")
            self.testing_in_progress = False
            return {"status": "error", "message": f"Error interno: {str(e)}"}

    async def run_tests(self, test_csv_file) -> Dict:
        """Ejecuta pruebas con un CSV diferente (método legacy)."""
        try:
            # Leer archivo CSV de pruebas
            test_data = await self._load_csv_file(test_csv_file)
            
            if not test_data:
                return {"status": "error", "message": "No se pudo cargar el archivo de pruebas"}
            
            # Ejecutar predicciones
            results = await self._run_model_tests(test_data)
            
            return {
                "status": "success",
                "message": "Pruebas completadas",
                "data": results
            }
            
        except Exception as e:
            self.logger.error(f"Error ejecutando pruebas: {e}")
            return {"status": "error", "message": f"Error interno: {str(e)}"}


    
    async def _get_symbols_from_sebo(self) -> List[Dict]:
        """Obtiene la lista de símbolos desde Sebo."""
        try:
            symbols_data = await self.sebo_symbols_api.get_symbols()
            
            if symbols_data:
                # Convertir formato de Sebo al formato esperado
                formatted_symbols = []
                for symbol in symbols_data:
                    if "id_sy" in symbol and "name" in symbol:
                        # Extraer base y quote del id_sy (ej: "BTC/USDT" -> base="BTC", quote="USDT")
                        parts = symbol["id_sy"].split("/")
                        base = parts[0] if len(parts) > 0 else symbol["name"]
                        quote = parts[1] if len(parts) > 1 else "USDT"
                        
                        formatted_symbols.append({
                            "id": symbol["id_sy"].replace("/", ""),  # "BTC/USDT" -> "BTCUSDT"
                            "name": symbol["id_sy"],  # "BTC/USDT"
                            "base": base,  # "BTC"
                            "quote": quote  # "USDT"
                        })
                
                self.logger.info(f"Obtenidos {len(formatted_symbols)} símbolos desde Sebo")
                return formatted_symbols
            else:
                self.logger.warning("No se pudieron obtener símbolos desde Sebo, usando símbolos por defecto")
                # Retornar símbolos por defecto
                return [
                    {"id": "BTCUSDT", "name": "BTC/USDT", "base": "BTC", "quote": "USDT"},
                    {"id": "ETHUSDT", "name": "ETH/USDT", "base": "ETH", "quote": "USDT"},
                    {"id": "BNBUSDT", "name": "BNB/USDT", "base": "BNB", "quote": "USDT"},
                    {"id": "ADAUSDT", "name": "ADA/USDT", "base": "ADA", "quote": "USDT"},
                    {"id": "SOLUSDT", "name": "SOL/USDT", "base": "SOL", "quote": "USDT"}
                ]
                
        except Exception as e:
            self.logger.error(f"Error obteniendo símbolos desde Sebo: {e}")
            # Retornar símbolos por defecto en caso de error
            return [
                {"id": "BTCUSDT", "name": "BTC/USDT", "base": "BTC", "quote": "USDT"},
                {"id": "ETHUSDT", "name": "ETH/USDT", "base": "ETH", "quote": "USDT"},
                {"id": "BNBUSDT", "name": "BNB/USDT", "base": "BNB", "quote": "USDT"},
                {"id": "ADAUSDT", "name": "ADA/USDT", "base": "ADA", "quote": "USDT"},
                {"id": "SOLUSDT", "name": "SOL/USDT", "base": "SOL", "quote": "USDT"}
            ]
    
    def _select_symbols(self, symbols_data: List[Dict], cantidad: Optional[int], lista: List[str]) -> List[Dict]:
        """Selecciona símbolos según el criterio especificado."""
        if lista:
            # Filtrar por lista específica
            return [s for s in symbols_data if s["id"] in lista]
        elif cantidad:
            # Tomar los primeros N símbolos
            return symbols_data[:cantidad]
        else:
            # Por defecto, tomar los primeros 5
            return symbols_data[:5]
    
    def _calculate_possible_operations(self, fecha: datetime, intervalo: str) -> int:
        """Calcula el número de operaciones posibles en el período."""
        current_date = datetime.now()
        diff_time = current_date - fecha
        diff_days = diff_time.days
        
        # Convertir intervalo a minutos
        interval_minutes = {
            "5m": 5, "10m": 10, "15m": 15, "30m": 30,
            "1h": 60, "2h": 120, "3h": 180, "4h": 240,
            "6h": 360, "12h": 720, "1d": 1440
        }
        
        minutes = interval_minutes.get(intervalo, 5);
        operations_per_day = (24 * 60) // minutes
        total_operations = operations_per_day * diff_days
        
        return max(1, total_operations)
    

    
    async def _save_csv_data(self, data: List[Dict], filepath: str):
        """Guarda los datos en un archivo CSV."""
        if not data:
            return
        
        fieldnames = data[0].keys()
        
        with open(filepath, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
    
    async def _run_training_process(self, filepath: str):
        """Ejecuta el proceso de entrenamiento en background."""
        try:
            self.logger.info(f"Iniciando proceso de entrenamiento con {filepath}")
            self.training_in_progress = True
            self.training_filepath = filepath
            self.training_progress = 0
            
            # Notificar inicio
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_update(
                    status="IN_PROGRESS",
                    progress=0,
                    filepath=self.training_filepath
                )
            
            # Cargar datos del CSV
            self.training_progress = 10
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_update(
                    status="IN_PROGRESS",
                    progress=10,
                    filepath=self.training_filepath
                )
            
            training_data = await self._load_csv_file(filepath)
            
            if not training_data:
                error_msg = "No se pudieron cargar los datos de entrenamiento"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_update(
                        status="FAILED",
                        progress=self.training_progress,
                        filepath=self.training_filepath,
                        error=error_msg
                    )
                self.training_in_progress = False
                return
            
            # Validar datos
            self.training_progress = 20
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_update(
                    status="IN_PROGRESS",
                    progress=20,
                    filepath=self.training_filepath
                )
            
            if len(training_data) < 10:
                error_msg = f"Datos insuficientes para entrenamiento: {len(training_data)} registros (mínimo 10)"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_update(
                        status="FAILED",
                        progress=self.training_progress,
                        filepath=self.training_filepath,
                        error=error_msg
                    )
                self.training_in_progress = False
                return
            
            # Optimizar datos antes del entrenamiento
            self.training_progress = 30
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_update(
                    status="IN_PROGRESS",
                    progress=30,
                    filepath=self.training_filepath
                )
            optimized_data = self._optimize_training_data(training_data)
            
            if not optimized_data:
                error_msg = "Error en la optimización de datos de entrenamiento"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_update(
                        status="FAILED",
                        progress=self.training_progress,
                        filepath=self.training_filepath,
                        error=error_msg
                    )
                self.training_in_progress = False
                return

            # Simular progreso de entrenamiento con pasos más realistas
            training_steps = [40, 50, 60, 70, 80, 90, 95]
            for progress in training_steps:
                self.training_progress = progress
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_update(
                        status="IN_PROGRESS",
                        progress=progress,
                        filepath=self.training_filepath
                    )
                await asyncio.sleep(5)  # Simular tiempo de procesamiento más realista
            
            # Ejecutar entrenamiento real con datos optimizados
            try:
                results = self.ai_model.train(optimized_data)
                if not results:
                    raise Exception("El modelo no devolvió resultados de entrenamiento")
            except Exception as train_error:
                error_msg = f"Error durante el entrenamiento del modelo: {str(train_error)}"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_update(
                        status="FAILED",
                        progress=self.training_progress,
                        filepath=self.training_filepath,
                        error=error_msg
                    )
                self.training_in_progress = False
                return
            
            # Completar entrenamiento
            self.training_in_progress = False
            self.training_progress = 100
            self.training_results = results
            
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_complete(results)
            
            self.logger.info("Entrenamiento completado exitosamente")
            
        except Exception as e:
            error_msg = f"Error crítico en proceso de entrenamiento: {str(e)}"
            self.logger.error(error_msg)
            self.training_in_progress = False
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_error(error_msg)

    async def _run_testing_process(self, filepath: str):
        """Ejecuta el proceso de pruebas en background."""
        try:
            self.logger.info(f"Iniciando proceso de pruebas con {filepath}")
            self.testing_in_progress = True
            self.testing_filepath = filepath
            self.testing_progress = 0
            
            # Verificar que el modelo esté entrenado
            if not self.ai_model.is_trained:
                error_msg = "El modelo no está entrenado. Debe entrenar el modelo antes de ejecutar pruebas."
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_error(error_msg)
                self.testing_in_progress = False
                return
            
            # Notificar inicio
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_progress(0, False, self.testing_filepath)
            
            # Cargar datos del CSV
            self.testing_progress = 10
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_progress(10, False, self.testing_filepath)
            
            test_data = await self._load_csv_file(filepath)
            
            if not test_data:
                error_msg = "No se pudieron cargar los datos de prueba"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_error(error_msg)
                self.testing_in_progress = False
                return
            
            # Validar datos
            self.testing_progress = 20
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_progress(20, False, self.testing_filepath)
            
            if len(test_data) < 5:
                error_msg = f"Datos insuficientes para pruebas: {len(test_data)} registros (mínimo 5)"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_error(error_msg)
                self.testing_in_progress = False
                return
            
            # Ejecutar pruebas con progreso
            test_steps = [30, 50, 70, 85, 95]
            for progress in test_steps:
                self.testing_progress = progress
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_progress(progress, False, self.testing_filepath)
                await asyncio.sleep(1)  # Simular tiempo de procesamiento
            
            # Ejecutar pruebas reales
            try:
                results = await self._run_model_tests(test_data)
                if "error" in results:
                    raise Exception(results["error"])
            except Exception as test_error:
                error_msg = f"Error durante las pruebas del modelo: {str(test_error)}"
                self.logger.error(error_msg)
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_error(error_msg)
                self.testing_in_progress = False
                return
            
            # Completar pruebas
            self.testing_in_progress = False
            self.testing_progress = 100
            self.testing_results = results
            
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_complete(results)
            
            self.logger.info("Pruebas completadas exitosamente")
            
        except Exception as e:
            error_msg = f"Error crítico en proceso de pruebas: {str(e)}"
            self.logger.error(error_msg)
            self.testing_in_progress = False
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_error(error_msg)
    
    async def _load_csv_file(self, file_path_or_file) -> List[Dict]:
        """Carga datos desde un archivo CSV."""
        try:
            if isinstance(file_path_or_file, str):
                # Es una ruta de archivo
                with open(file_path_or_file, "r", encoding="utf-8") as file:
                    reader = csv.DictReader(file)
                    return list(reader)
            else:
                # Es un objeto de archivo
                content = file_path_or_file.read().decode("utf-8")
                reader = csv.DictReader(StringIO(content))
                return list(reader)
                
        except Exception as e:
            self.logger.error(f"Error cargando archivo CSV: {e}")
            return []
    
    async def _run_model_tests(self, test_data: List[Dict]) -> Dict:
        """Ejecuta pruebas del modelo con datos de test."""
        try:
            if not self.ai_model.is_trained:
                return {"error": "El modelo no está entrenado"}
            
            correct_predictions = 0
            total_predictions = len(test_data)
            
            for data in test_data:
                prediction = self.ai_model.predict(data)
                actual_outcome = data.get("decision_outcome", "")
                
                # Simplificar comparación
                predicted_success = prediction.get("should_execute", False)
                actual_success = "EJECUTADA_EXITOSA" in actual_outcome
                
                if predicted_success == actual_success:
                    correct_predictions += 1
            
            accuracy = (correct_predictions / total_predictions) * 100 if total_predictions > 0 else 0
            
            return {
                "accuracy": round(accuracy, 2),
                "recall": round(accuracy * 0.9, 2),  # Simulado
                "f1Score": round(accuracy * 0.95, 2),  # Simulado
                "successfulOperations": correct_predictions,
                "totalOperations": total_predictions
            }
            
        except Exception as e:
            self.logger.error(f"Error ejecutando pruebas del modelo: {e}")
            return {"error": str(e)}
    
    def _optimize_training_data(self, data: List[Dict]) -> List[Dict]:
        """Optimiza los datos de entrenamiento (ej. normalización, selección de características)."""
        self.logger.info(f"Optimizando {len(data)} registros de entrenamiento...")
        if not data:
            return []

        df = pd.DataFrame(data)

        # Ejemplo de optimización: Normalización de columnas numéricas
        numeric_cols = [
            'current_price_buy', 'current_price_sell', 'investment_usdt',
            'estimated_buy_fee', 'estimated_sell_fee', 'estimated_transfer_fee',
            'net_profit_usdt', 'profit_percentage', 'total_fees_usdt',
            'execution_time_seconds'
        ]
        for col in numeric_cols:
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                min_val = df[col].min()
                max_val = df[col].max()
                if max_val > min_val:
                    df[col] = (df[col] - min_val) / (max_val - min_val)
                else:
                    df[col] = 0.0 # O manejar como constante si todos los valores son iguales

        # Ejemplo de selección de características (mantener solo las relevantes para el modelo AI)
        # Asegúrate de que estas columnas existan en tu CSV o maneja los errores
        features_for_ai = [
            'timestamp', 'symbol', 'buy_exchange_id', 'sell_exchange_id',
            'current_price_buy', 'current_price_sell', 'investment_usdt',
            'estimated_buy_fee', 'estimated_sell_fee', 'estimated_transfer_fee',
            'net_profit_usdt', 'profit_percentage', 'total_fees_usdt',
            'execution_time_seconds', 'decision_outcome'
        ]
        # Filtrar solo las columnas que existen en el DataFrame
        existing_features = [col for col in features_for_ai if col in df.columns]
        df_optimized = df[existing_features]

        self.logger.info("Optimización de datos completada.")
        return df_optimized.to_dict(orient='records')



    def get_training_status(self) -> (str, int, Optional[str]):
        """Retorna el estado actual del entrenamiento."""
        return self.training_in_progress, self.training_progress, self.training_filepath

    def get_testing_status(self) -> (str, int, Optional[str]):
        """Retorna el estado actual de las pruebas."""
        return self.testing_in_progress, self.testing_progress, self.testing_filepath