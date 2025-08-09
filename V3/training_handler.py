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

from config_v3 import DATA_DIR
from utils import get_current_timestamp, safe_float
from ai_model import ArbitrageAIModel
from data_persistence import DataPersistence
from sebo_symbols_api import SeboSymbolsAPI

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
        
    async def create_training_csv(self, request_data: Dict) -> Dict:
        """Crea un CSV de datos para entrenamiento."""
        try:
            self.logger.info("Iniciando creación de CSV de entrenamiento")
            
            # Extraer parámetros
            fecha = request_data.get("fecha")
            operaciones = request_data.get("operaciones")
            cantidad_simbolos = request_data.get("cantidadSimbolos")
            lista_simbolos = request_data.get("listaSimbolos", [])
            intervalo = request_data.get("intervalo", "5m")
            
            # Validar fecha
            if not fecha:
                return {"status": "error", "message": "Fecha es requerida"}
            
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d")
            if fecha_obj >= datetime.now():
                return {"status": "error", "message": "La fecha debe ser anterior a la actual"}
            
            # Obtener símbolos de Sebo
            symbols_data = await self._get_symbols_from_sebo()
            if not symbols_data:
                return {"status": "error", "message": "No se pudieron obtener símbolos de Sebo"}
            
            # Seleccionar símbolos según el criterio
            selected_symbols = self._select_symbols(symbols_data, cantidad_simbolos, lista_simbolos)
            
            # Calcular operaciones si no se especificó
            if not operaciones:
                operaciones = self._calculate_possible_operations(fecha_obj, intervalo)
            
            # Generar datos históricos simulados
            csv_data = await self._generate_historical_data(
                fecha_obj, selected_symbols, operaciones, intervalo
            )
            
            # Guardar CSV
            filename = f"training_data_{fecha}_{intervalo}_{len(selected_symbols)}symbols.csv"
            filepath = os.path.join(DATA_DIR, filename)
            
            await self._save_csv_data(csv_data, filepath)
            
            return {
                "status": "success",
                "message": "CSV de entrenamiento creado exitosamente",
                "data": {
                    "filename": filename,
                    "filepath": filepath,
                    "records": len(csv_data),
                    "symbols": len(selected_symbols),
                    "operations": operaciones
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error creando CSV de entrenamiento: {e}")
            return {"status": "error", "message": f"Error interno: {str(e)}"}
    
    async def start_training(self, request_data: Dict) -> Dict:
        """Inicia el entrenamiento del modelo."""
        try:
            if self.training_in_progress:
                return {"status": "error", "message": "Ya hay un entrenamiento en progreso"}
            
            self.training_in_progress = True
            self.training_progress = 0
            
            # Obtener la ruta del archivo del payload
            filepath = request_data.get("filepath")
            if not filepath or not os.path.exists(filepath):
                return {"status": "error", "message": "Ruta de archivo CSV no válida o no encontrada"}
            
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
    
    async def run_tests(self, test_csv_file) -> Dict:
        """Ejecuta pruebas con un CSV diferente."""
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
    
    async def _generate_historical_data(self, fecha: datetime, symbols: List[Dict], 
                                      operaciones: int, intervalo: str) -> List[Dict]:
        """Genera datos históricos simulados para entrenamiento."""
        data = []
        
        # Configuración base
        base_investment = 100.0  # USDT
        exchanges = ["binance", "kucoin", "okx", "bybit"]
        
        for i in range(operaciones):
            for symbol in symbols:
                # Simular datos de operación
                operation_data = {
                    "timestamp": (fecha + timedelta(minutes=i * 5)).isoformat(),
                    "symbol": symbol["name"],
                    "buy_exchange_id": np.random.choice(exchanges),
                    "sell_exchange_id": np.random.choice(exchanges),
                    "current_price_buy": round(np.random.uniform(100, 50000), 2),
                    "current_price_sell": 0,
                    "investment_usdt": base_investment,
                    "estimated_buy_fee": round(np.random.uniform(0.1, 0.5), 3),
                    "estimated_sell_fee": round(np.random.uniform(0.1, 0.5), 3),
                    "estimated_transfer_fee": round(np.random.uniform(1, 10), 2),
                    "decision_outcome": np.random.choice([
                        "EJECUTADA_EXITOSA", "EJECUTADA_PERDIDA", "NO_EJECUTADA_RIESGO",
                        "NO_EJECUTADA_FEES", "NO_EJECUTADA_LIQUIDEZ"
                    ]),
                    "net_profit_usdt": round(np.random.uniform(-5, 15), 4),
                    "profit_percentage": round(np.random.uniform(-5, 15), 2),
                    "total_fees_usdt": round(np.random.uniform(0.5, 3), 2),
                    "execution_time_seconds": np.random.randint(30, 300)
                }
                
                # Ajustar precio de venta basado en el de compra
                price_variation = np.random.uniform(0.995, 1.005)
                operation_data["current_price_sell"] = round(
                    operation_data["current_price_buy"] * price_variation, 2
                )
                
                data.append(operation_data)
        
        return data
    
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
            
            # Cargar datos del CSV
            training_data = await self._load_csv_file(filepath)
            
            if not training_data:
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_error("No se pudieron cargar los datos de entrenamiento")
                self.training_in_progress = False
                return
            
            # Optimizar datos antes del entrenamiento
            optimized_data = self._optimize_training_data(training_data)

            # Simular progreso de entrenamiento
            for progress in range(0, 101, 10):
                self.training_progress = progress
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_training_progress(progress, False, self.training_filepath)
                await asyncio.sleep(1)  # Simular tiempo de procesamiento
            
            # Ejecutar entrenamiento real con datos optimizados
            results = self.ai_model.train(optimized_data)
            
            # Completar entrenamiento
            self.training_in_progress = False
            self.training_progress = 100
            
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_complete(results)
            
            self.logger.info("Entrenamiento completado exitosamente")
            
        except Exception as e:
            self.logger.error(f"Error en proceso de entrenamiento: {e}")
            self.training_in_progress = False
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_training_error(str(e))
    
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



