# Simos/V3/core/test_handler.py

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

class TestHandler:
    """Manejador para operaciones de pruebas del modelo de IA."""
    
    def __init__(self, sebo_connector, ai_model: ArbitrageAIModel, 
                 data_persistence: DataPersistence, ui_broadcaster=None):
        self.logger = logging.getLogger("V3.TestHandler")
        self.sebo_connector = sebo_connector
        self.ai_model = ai_model
        self.data_persistence = data_persistence
        self.ui_broadcaster = ui_broadcaster
        
        # Inicializar API de símbolos de Sebo
        self.sebo_symbols_api = SeboSymbolsAPI()
        
        # Estado de las pruebas
        self.testing_in_progress = False
        self.testing_results = {}
        self.testing_progress = 0
        self.testing_filepath = None
        
        # Estado de generación de datos de prueba
        self.test_data_generation_in_progress = False
        self.test_data_generation_progress = 0
        self.test_data_generation_filepath = None

    async def generate_test_data(self, request_data: Dict) -> Dict:
        """Genera datos de prueba para el modelo."""
        try:
            if self.test_data_generation_in_progress:
                return {"status": "error", "message": "Ya hay generación de datos de prueba en progreso"}
            
            self.test_data_generation_in_progress = True
            self.test_data_generation_progress = 0
            
            # Parámetros por defecto
            days_back = request_data.get("days_back", 59)
            num_analysis = request_data.get("num_analysis", 100)
            frame_time = request_data.get("frame_time", "5m")
            
            # Obtener directorio de entrenamiento para guardar en la misma carpeta
            training_dir = request_data.get("training_dir", DATA_DIR)
            
            # Generar nombre de archivo
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_data_{days_back}days_{num_analysis}analysis_{frame_time}_{timestamp}.csv"
            filepath = os.path.join(training_dir, filename)
            
            self.test_data_generation_filepath = filepath
            
            # Iniciar generación en background
            asyncio.create_task(self._run_test_data_generation_process(
                days_back, num_analysis, frame_time, filepath
            ))
            
            return {
                "status": "success",
                "message": "Generación de datos de prueba iniciada",
                "data": {
                    "generation_id": get_current_timestamp(),
                    "filepath": filepath,
                    "parameters": {
                        "days_back": days_back,
                        "num_analysis": num_analysis,
                        "frame_time": frame_time
                    }
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error iniciando generación de datos de prueba: {e}")
            self.test_data_generation_in_progress = False
            return {"status": "error", "message": f"Error interno: {str(e)}"}

    async def _run_test_data_generation_process(self, days_back: int, num_analysis: int, 
                                              frame_time: str, filepath: str):
        """Ejecuta el proceso de generación de datos de prueba en background."""
        try:
            print(f"🚀 INICIANDO GENERACIÓN DE DATOS DE PRUEBA")
            print(f"📅 Días hacia atrás: {days_back}")
            print(f"📊 Número de análisis: {num_analysis}")
            print(f"⏱️ Intervalo de tiempo: {frame_time}")
            print(f"📁 Archivo de salida: {filepath}")
            
            self.logger.info(f"Iniciando generación de datos de prueba: {days_back} días, {num_analysis} análisis, {frame_time}")
            
            # Notificar inicio
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="IN_PROGRESS",
                    progress=0,
                    filepath=self.test_data_generation_filepath
                )
            
            # Calcular fecha de inicio
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            print(f"📅 Período de datos: {start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}")
            
            # Obtener símbolos desde Sebo
            print(f"🔍 OBTENIENDO SÍMBOLOS DESDE SEBO...")
            self.test_data_generation_progress = 10
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="IN_PROGRESS",
                    progress=10,
                    filepath=self.test_data_generation_filepath
                )
            
            symbols_data = await self._get_symbols_from_sebo()
            selected_symbols = self._select_symbols(symbols_data, 10, [])  # Seleccionar 10 símbolos
            
            print(f"✅ SÍMBOLOS OBTENIDOS: {len(selected_symbols)} símbolos seleccionados")
            
            # Generar datos de prueba
            print(f"🔄 GENERANDO DATOS DE PRUEBA...")
            self.test_data_generation_progress = 30
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="IN_PROGRESS",
                    progress=30,
                    filepath=self.test_data_generation_filepath
                )
            
            test_data = await self._generate_synthetic_test_data(
                selected_symbols, start_date, end_date, num_analysis, frame_time
            )
            
            if not test_data:
                error_msg = "No se pudieron generar datos de prueba"
                print(f"❌ ERROR: {error_msg}")
                self.logger.error(error_msg)
                self.test_data_generation_in_progress = False
                if self.ui_broadcaster:
                    await self.ui_broadcaster.broadcast_test_data_generation_update(
                        status="FAILED",
                        progress=self.test_data_generation_progress,
                        filepath=self.test_data_generation_filepath,
                        error=error_msg
                    )
                return
            
            print(f"✅ DATOS GENERADOS: {len(test_data)} registros de prueba")
            
            # Guardar datos en CSV
            print(f"💾 GUARDANDO DATOS EN ARCHIVO CSV...")
            self.test_data_generation_progress = 80
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="IN_PROGRESS",
                    progress=80,
                    filepath=self.test_data_generation_filepath
                )
            
            await self._save_csv_data(test_data, filepath)
            
            # Completar generación
            self.test_data_generation_in_progress = False
            self.test_data_generation_progress = 100
            
            print(f"🎉 GENERACIÓN DE DATOS DE PRUEBA COMPLETADA!")
            print(f"📁 Archivo guardado en: {filepath}")
            print(f"📊 Total de registros: {len(test_data)}")
            
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="COMPLETED",
                    progress=100,
                    filepath=self.test_data_generation_filepath,
                    results={
                        "total_records": len(test_data),
                        "filepath": filepath,
                        "parameters": {
                            "days_back": days_back,
                            "num_analysis": num_analysis,
                            "frame_time": frame_time
                        }
                    }
                )
            
            self.logger.info("Generación de datos de prueba completada exitosamente")
            
        except Exception as e:
            error_msg = f"Error crítico en generación de datos de prueba: {str(e)}"
            print(f"💥 ERROR CRÍTICO: {error_msg}")
            self.logger.error(error_msg)
            self.test_data_generation_in_progress = False
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_data_generation_update(
                    status="FAILED",
                    progress=self.test_data_generation_progress,
                    filepath=self.test_data_generation_filepath,
                    error=error_msg
                )

    async def _generate_synthetic_test_data(self, symbols: List[Dict], start_date: datetime, 
                                          end_date: datetime, num_analysis: int, frame_time: str) -> List[Dict]:
        """Genera datos sintéticos de prueba basados en los parámetros especificados."""
        try:
            test_data = []
            
            # Calcular intervalo en minutos
            interval_minutes = self._get_interval_minutes(frame_time)
            
            # Calcular número total de intervalos posibles
            total_minutes = int((end_date - start_date).total_seconds() / 60)
            total_intervals = total_minutes // interval_minutes
            
            # Distribuir análisis a lo largo del período
            analysis_per_interval = max(1, num_analysis // min(total_intervals, num_analysis))
            
            # Exchanges disponibles
            exchanges = ["binance", "okx", "kucoin", "bybit", "huobi", "gate"]
            
            current_date = start_date
            generated_count = 0
            
            while current_date < end_date and generated_count < num_analysis:
                for symbol in symbols:
                    if generated_count >= num_analysis:
                        break
                    
                    # Generar múltiples análisis para este símbolo en este intervalo
                    for _ in range(analysis_per_interval):
                        if generated_count >= num_analysis:
                            break
                        
                        # Seleccionar exchanges aleatorios
                        buy_exchange = np.random.choice(exchanges)
                        sell_exchange = np.random.choice([ex for ex in exchanges if ex != buy_exchange])
                        
                        # Generar datos sintéticos realistas
                        test_record = self._generate_synthetic_analysis_record(
                            symbol, buy_exchange, sell_exchange, current_date
                        )
                        
                        test_data.append(test_record)
                        generated_count += 1
                
                # Avanzar al siguiente intervalo
                current_date += timedelta(minutes=interval_minutes)
            
            return test_data
            
        except Exception as e:
            self.logger.error(f"Error generando datos sintéticos de prueba: {e}")
            return []

    def _generate_synthetic_analysis_record(self, symbol: Dict, buy_exchange: str, 
                                          sell_exchange: str, timestamp: datetime) -> Dict:
        """Genera un registro sintético de análisis de arbitraje."""
        
        # Precios base realistas según el símbolo
        base_prices = {
            "BTCUSDT": 45000, "ETHUSDT": 3000, "BNBUSDT": 300,
            "ADAUSDT": 0.5, "SOLUSDT": 100, "XRPUSDT": 0.6,
            "DOTUSDT": 7, "AVAXUSDT": 40, "MATICUSDT": 1.2, "LINKUSDT": 15
        }
        
        symbol_id = symbol.get("id", "BTCUSDT")
        base_price = base_prices.get(symbol_id, 10.0)
        
        # Añadir variación aleatoria
        price_variation = np.random.uniform(-0.1, 0.1)  # ±10%
        buy_price = base_price * (1 + price_variation)
        
        # Diferencia de arbitraje (puede ser negativa)
        arbitrage_diff = np.random.uniform(-0.02, 0.05)  # -2% a +5%
        sell_price = buy_price * (1 + arbitrage_diff)
        
        # Datos de fees realistas
        fee_ranges = {
            'binance': (0.001, 0.001), 'okx': (0.0008, 0.001),
            'kucoin': (0.001, 0.001), 'bybit': (0.001, 0.001),
            'huobi': (0.002, 0.002), 'gate': (0.002, 0.002)
        }
        
        buy_fee = np.random.uniform(*fee_ranges.get(buy_exchange, (0.001, 0.002)))
        sell_fee = np.random.uniform(*fee_ranges.get(sell_exchange, (0.001, 0.002)))
        
        # Monto de inversión
        investment_usdt = np.random.uniform(50, 500)
        
        # Calcular fees totales
        total_fees = buy_fee + sell_fee + 1.0  # +1 USDT por transferencia
        
        # Calcular ganancia neta estimada
        percentage_diff = ((sell_price - buy_price) / buy_price) * 100
        estimated_profit = investment_usdt * (percentage_diff / 100) - total_fees
        
        # Determinar resultado basado en rentabilidad
        if estimated_profit > 1.0:
            decision_outcome = "EJECUTADA_SIMULADA"
            net_profit = estimated_profit * np.random.uniform(0.8, 1.2)  # Variación realista
        elif estimated_profit > 0:
            decision_outcome = "EJECUTADA_SIMULADA_MARGINAL"
            net_profit = estimated_profit * np.random.uniform(0.5, 1.0)
        else:
            decision_outcome = "NO_VIABLE_UMBRAL_PROFIT"
            net_profit = estimated_profit
        
        # Simular algunos fallos aleatorios
        if np.random.random() < 0.05:  # 5% de fallos
            decision_outcome = np.random.choice([
                "ERROR_COMPRA", "ERROR_TRANSFERENCIA", "ERROR_VENTA",
                "TIMEOUT_OPERACION", "PRECIO_CAMBIO_DRASTICO"
            ])
            net_profit = -np.random.uniform(1, 10)
        
        return {
            'timestamp': timestamp.isoformat(),
            'symbol': symbol.get("name", "BTC/USDT"),
            'symbol_name': symbol.get("name", "BTC/USDT").replace("/", ""),
            'buy_exchange_id': buy_exchange,
            'sell_exchange_id': sell_exchange,
            'current_price_buy': buy_price,
            'current_price_sell': sell_price,
            'investment_usdt': investment_usdt,
            'estimated_buy_fee': buy_fee,
            'estimated_sell_fee': sell_fee,
            'estimated_transfer_fee': 1.0,
            'total_fees_usdt': total_fees,
            'net_profit_usdt': net_profit,
            'profit_percentage': (net_profit / investment_usdt) * 100,
            'execution_time_seconds': np.random.uniform(30, 300),
            'decision_outcome': decision_outcome
        }

    def _get_interval_minutes(self, frame_time: str) -> int:
        """Convierte el frame_time a minutos."""
        interval_minutes = {
            "5m": 5, "10m": 10, "15m": 15, "30m": 30,
            "1h": 60, "2h": 120, "3h": 180, "4h": 240,
            "6h": 360, "12h": 720, "1d": 1440
        }
        return interval_minutes.get(frame_time, 5)

    async def _get_symbols_from_sebo(self) -> List[Dict]:
        """Obtiene la lista de símbolos desde Sebo."""
        try:
            symbols_data = await self.sebo_symbols_api.get_symbols()
            
            if symbols_data:
                # Convertir formato de Sebo al formato esperado
                formatted_symbols = []
                for symbol in symbols_data:
                    if "id_sy" in symbol and "name" in symbol:
                        # Extraer base y quote del id_sy
                        parts = symbol["id_sy"].split("/")
                        base = parts[0] if len(parts) > 0 else symbol["name"]
                        quote = parts[1] if len(parts) > 1 else "USDT"
                        
                        formatted_symbols.append({
                            "id": symbol["id_sy"].replace("/", ""),
                            "name": symbol["id_sy"],
                            "base": base,
                            "quote": quote
                        })
                
                self.logger.info(f"Obtenidos {len(formatted_symbols)} símbolos desde Sebo")
                return formatted_symbols
            else:
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
            return [s for s in symbols_data if s["id"] in lista]
        elif cantidad:
            return symbols_data[:cantidad]
        else:
            return symbols_data[:5]

    async def _save_csv_data(self, data: List[Dict], filepath: str):
        """Guarda los datos en un archivo CSV."""
        if not data:
            return
        
        # Crear directorio si no existe
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        fieldnames = data[0].keys()
        
        with open(filepath, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

    async def run_model_tests(self, csv_filename: str) -> Dict:
        """Ejecuta pruebas del modelo cargando datos desde archivo CSV de entrenamiento."""
        try:
            if self.testing_in_progress:
                return {"status": "error", "message": "Ya hay pruebas en progreso"}
            
            self.testing_in_progress = True
            self.testing_progress = 0
            self.testing_results = {}
            self.testing_filepath = csv_filename
            
            # Notificar inicio
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="STARTING",
                    progress=0,
                    filepath=csv_filename
                )
            
            # Iniciar proceso de pruebas en background
            asyncio.create_task(self._run_model_tests_process(csv_filename))
            
            return {
                "status": "success",
                "message": "Pruebas del modelo iniciadas",
                "data": {
                    "test_id": get_current_timestamp(),
                    "csv_filename": csv_filename
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error iniciando pruebas del modelo: {e}")
            self.testing_in_progress = False
            return {"status": "error", "message": f"Error interno: {str(e)}"}

    async def _run_model_tests_process(self, csv_filename: str):
        """Ejecuta el proceso completo de pruebas del modelo en background."""
        try:
            print(f"🧪 INICIANDO PRUEBAS DEL MODELO AI")
            print(f"📁 Archivo CSV: {csv_filename}")
            
            self.logger.info(f"Iniciando pruebas del modelo con archivo: {csv_filename}")
            
            # Notificar progreso inicial
            self.testing_progress = 10
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="IN_PROGRESS",
                    progress=10,
                    filepath=csv_filename
                )
            
            # 1. Cargar datos del archivo CSV
            print(f"📂 CARGANDO DATOS DEL ARCHIVO CSV...")
            test_data = await self._load_csv_training_data(csv_filename)
            
            if not test_data:
                error_msg = f"No se pudo cargar el archivo CSV: {csv_filename}"
                print(f"❌ ERROR: {error_msg}")
                await self._handle_test_error(error_msg)
                return
            
            print(f"✅ DATOS CARGADOS: {len(test_data)} registros")
            
            # 2. Depurar y preparar datos para el modelo
            self.testing_progress = 30
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="IN_PROGRESS",
                    progress=30,
                    filepath=csv_filename
                )
            
            print(f"🔧 DEPURANDO DATOS PARA EL MODELO...")
            cleaned_data = await self._clean_and_prepare_test_data(test_data)
            
            if not cleaned_data:
                error_msg = "No se pudieron depurar los datos para el modelo"
                print(f"❌ ERROR: {error_msg}")
                await self._handle_test_error(error_msg)
                return
            
            print(f"✅ DATOS DEPURADOS: {len(cleaned_data)} registros válidos")
            
            # 3. Verificar que el modelo esté entrenado
            self.testing_progress = 40
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="IN_PROGRESS",
                    progress=40,
                    filepath=csv_filename
                )
            
            if not self.ai_model.is_trained:
                error_msg = "El modelo no está entrenado. Debe entrenar el modelo antes de ejecutar pruebas."
                print(f"❌ ERROR: {error_msg}")
                await self._handle_test_error(error_msg)
                return
            
            print(f"✅ MODELO VERIFICADO: Entrenado y listo para pruebas")
            
            # 4. Ejecutar pruebas del modelo
            self.testing_progress = 60
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="IN_PROGRESS",
                    progress=60,
                    filepath=csv_filename
                )
            
            print(f"🤖 EJECUTANDO PRUEBAS DEL MODELO...")
            test_results = await self._execute_model_predictions(cleaned_data)
            
            if "error" in test_results:
                error_msg = f"Error en las pruebas del modelo: {test_results['error']}"
                print(f"❌ ERROR: {error_msg}")
                await self._handle_test_error(error_msg)
                return
            
            print(f"✅ PRUEBAS COMPLETADAS")
            
            # 5. Calcular métricas finales
            self.testing_progress = 90
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="IN_PROGRESS",
                    progress=90,
                    filepath=csv_filename
                )
            
            print(f"📊 CALCULANDO MÉTRICAS FINALES...")
            final_results = await self._calculate_final_metrics(test_results, cleaned_data)
            
            # 6. Completar pruebas
            self.testing_in_progress = False
            self.testing_progress = 100
            self.testing_results = final_results
            
            print(f"🎉 PRUEBAS DEL MODELO COMPLETADAS!")
            print(f"📊 Precisión: {final_results.get('accuracy', 0)}%")
            print(f"📊 Operaciones exitosas: {final_results.get('successfulOperations', 0)}/{final_results.get('totalOperations', 0)}")
            
            if self.ui_broadcaster:
                await self.ui_broadcaster.broadcast_test_update(
                    status="COMPLETED",
                    progress=100,
                    filepath=csv_filename,
                    results=final_results
                )
            
            self.logger.info("Pruebas del modelo completadas exitosamente")
            
        except Exception as e:
            error_msg = f"Error crítico en pruebas del modelo: {str(e)}"
            print(f"💥 ERROR CRÍTICO: {error_msg}")
            await self._handle_test_error(error_msg)

    async def _load_csv_training_data(self, csv_filename: str) -> List[Dict]:
        """Carga datos desde el archivo CSV de entrenamiento."""
        try:
            # Construir rutas posibles para el archivo
            possible_paths = [
                os.path.join(DATA_DIR, csv_filename),
                os.path.join(DATA_DIR, f"{csv_filename}.csv"),
                os.path.join("sebo", "src", "data", "csv_exports", csv_filename),
                os.path.join("sebo", "src", "data", "csv_exports", f"{csv_filename}.csv"),
                csv_filename  # Ruta absoluta
            ]
            
            csv_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    csv_path = path
                    break
            
            if not csv_path:
                self.logger.error(f"Archivo CSV no encontrado: {csv_filename}")
                self.logger.error(f"Rutas buscadas: {possible_paths}")
                return []
            
            print(f"📂 Cargando archivo: {csv_path}")
            
            # Cargar CSV usando pandas
            df = pd.read_csv(csv_path)
            
            if df.empty:
                self.logger.error(f"El archivo CSV está vacío: {csv_path}")
                return []
            
            print(f"📊 Archivo cargado: {len(df)} filas, {len(df.columns)} columnas")
            print(f"📋 Columnas disponibles: {list(df.columns)}")
            
            # Convertir DataFrame a lista de diccionarios
            data_list = df.to_dict('records')
            
            self.logger.info(f"Datos cargados exitosamente desde {csv_path}: {len(data_list)} registros")
            return data_list
            
        except Exception as e:
            self.logger.error(f"Error cargando archivo CSV {csv_filename}: {e}")
            return []

    async def _clean_and_prepare_test_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Depura y prepara los datos para el modelo."""
        try:
            cleaned_data = []
            
            required_fields = [
                'current_price_buy', 'current_price_sell', 'investment_usdt',
                'net_profit_usdt', 'symbol', 'buy_exchange_id', 'sell_exchange_id'
            ]
            
            for i, record in enumerate(raw_data):
                try:
                    # Verificar campos requeridos
                    missing_fields = [field for field in required_fields if field not in record or record[field] is None]
                    if missing_fields:
                        print(f"⚠️ Registro {i+1} omitido - campos faltantes: {missing_fields}")
                        continue
                    
                    # Limpiar y convertir datos numéricos
                    cleaned_record = {}
                    for key, value in record.items():
                        if key in ['current_price_buy', 'current_price_sell', 'investment_usdt',
                                  'net_profit_usdt', 'profit_percentage', 'execution_time_seconds',
                                  'estimated_buy_fee', 'estimated_sell_fee', 'estimated_transfer_fee', 'total_fees_usdt']:
                            cleaned_record[key] = safe_float(value)
                        else:
                            cleaned_record[key] = str(value) if value is not None else ''
                    
                    # Validar datos básicos
                    if (cleaned_record['current_price_buy'] <= 0 or
                        cleaned_record['current_price_sell'] <= 0 or
                        cleaned_record['investment_usdt'] <= 0):
                        print(f"⚠️ Registro {i+1} omitido - valores inválidos")
                        continue
                    
                    # Asegurar que tenga timestamp
                    if 'timestamp' not in cleaned_record or not cleaned_record['timestamp']:
                        cleaned_record['timestamp'] = datetime.now().isoformat()
                    
                    # Asegurar que tenga decision_outcome
                    if 'decision_outcome' not in cleaned_record or not cleaned_record['decision_outcome']:
                        # Inferir outcome basado en profit
                        if cleaned_record['net_profit_usdt'] > 0:
                            cleaned_record['decision_outcome'] = 'EJECUTADA_EXITOSA'
                        else:
                            cleaned_record['decision_outcome'] = 'NO_EJECUTADA'
                    
                    cleaned_data.append(cleaned_record)
                    
                except Exception as e:
                    print(f"⚠️ Error procesando registro {i+1}: {e}")
                    continue
            
            print(f"🔧 Datos depurados: {len(cleaned_data)}/{len(raw_data)} registros válidos")
            return cleaned_data
            
        except Exception as e:
            self.logger.error(f"Error depurando datos: {e}")
            return []

    async def _execute_model_predictions(self, test_data: List[Dict]) -> Dict:
        """Ejecuta predicciones del modelo sobre los datos de prueba."""
        try:
            correct_predictions = 0
            total_predictions = len(test_data)
            predictions_log = []
            
            print(f"🤖 Ejecutando {total_predictions} predicciones...")
            
            for i, data in enumerate(test_data):
                try:
                    # Realizar predicción
                    prediction = self.ai_model.predict(data)
                    actual_outcome = data.get("decision_outcome", "")
                    
                    # Comparación de predicción vs resultado real
                    predicted_success = prediction.get("should_execute", False)
                    actual_success = "EJECUTADA" in actual_outcome and "EXITOSA" in actual_outcome
                    
                    is_correct = predicted_success == actual_success
                    if is_correct:
                        correct_predictions += 1
                    
                    predictions_log.append({
                        "symbol": data.get("symbol", "N/A"),
                        "predicted": predicted_success,
                        "actual": actual_success,
                        "correct": is_correct,
                        "confidence": prediction.get("confidence", 0.0),
                        "predicted_profit": prediction.get("predicted_profit_usdt", 0.0),
                        "actual_profit": data.get("net_profit_usdt", 0.0),
                        "decision_outcome": actual_outcome
                    })
                    
                    # Actualizar progreso cada 10%
                    if (i + 1) % max(1, total_predictions // 10) == 0:
                        progress = 60 + int(((i + 1) / total_predictions) * 20)  # 60-80%
                        if self.ui_broadcaster:
                            await self.ui_broadcaster.broadcast_test_update(
                                status="IN_PROGRESS",
                                progress=progress,
                                filepath=self.testing_filepath
                            )
                    
                except Exception as e:
                    print(f"⚠️ Error en predicción {i+1}: {e}")
                    continue
            
            return {
                "correct_predictions": correct_predictions,
                "total_predictions": total_predictions,
                "predictions_log": predictions_log
            }
            
        except Exception as e:
            self.logger.error(f"Error ejecutando predicciones: {e}")
            return {"error": str(e)}

    async def _calculate_final_metrics(self, test_results: Dict, test_data: List[Dict]) -> Dict:
        """Calcula métricas finales de las pruebas."""
        try:
            predictions_log = test_results.get("predictions_log", [])
            correct_predictions = test_results.get("correct_predictions", 0)
            total_predictions = test_results.get("total_predictions", 0)
            
            accuracy = (correct_predictions / total_predictions) * 100 if total_predictions > 0 else 0
            
            # Calcular métricas adicionales
            true_positives = sum(1 for p in predictions_log if p["predicted"] and p["actual"])
            false_positives = sum(1 for p in predictions_log if p["predicted"] and not p["actual"])
            false_negatives = sum(1 for p in predictions_log if not p["predicted"] and p["actual"])
            true_negatives = sum(1 for p in predictions_log if not p["predicted"] and not p["actual"])
            
            precision = (true_positives / (true_positives + false_positives)) * 100 if (true_positives + false_positives) > 0 else 0
            recall = (true_positives / (true_positives + false_negatives)) * 100 if (true_positives + false_negatives) > 0 else 0
            f1_score = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
            
            # Métricas de profit
            predicted_profits = [p["predicted_profit"] for p in predictions_log]
            actual_profits = [p["actual_profit"] for p in predictions_log]
            
            avg_predicted_profit = np.mean(predicted_profits) if predicted_profits else 0
            avg_actual_profit = np.mean(actual_profits) if actual_profits else 0
            
            return {
                "accuracy": round(accuracy, 2),
                "precision": round(precision, 2),
                "recall": round(recall, 2),
                "f1Score": round(f1_score, 2),
                "successfulOperations": correct_predictions,
                "totalOperations": total_predictions,
                "truePositives": true_positives,
                "falsePositives": false_positives,
                "falseNegatives": false_negatives,
                "trueNegatives": true_negatives,
                "avgPredictedProfit": round(avg_predicted_profit, 4),
                "avgActualProfit": round(avg_actual_profit, 4),
                "totalTestRecords": len(test_data),
                "validPredictions": len(predictions_log),
                "predictions_sample": predictions_log[:10],  # Muestra de las primeras 10 predicciones
                "test_completed_at": get_current_timestamp()
            }
            
        except Exception as e:
            self.logger.error(f"Error calculando métricas finales: {e}")
            return {"error": str(e)}

    async def _handle_test_error(self, error_msg: str):
        """Maneja errores durante las pruebas."""
        self.testing_in_progress = False
        self.testing_results = {"error": error_msg}
        
        if self.ui_broadcaster:
            await self.ui_broadcaster.broadcast_test_update(
                status="FAILED",
                progress=self.testing_progress,
                filepath=self.testing_filepath,
                error=error_msg
            )
        
        self.logger.error(error_msg)

    def get_test_data_generation_status(self) -> Dict:
        """Retorna el estado actual de la generación de datos de prueba."""
        return {
            "in_progress": self.test_data_generation_in_progress,
            "progress": self.test_data_generation_progress,
            "filepath": self.test_data_generation_filepath
        }

    def get_testing_status(self) -> Dict:
        """Retorna el estado actual de las pruebas."""
        return {
            "in_progress": self.testing_in_progress,
            "progress": self.testing_progress,
            "filepath": self.testing_filepath,
            "results": self.testing_results
        }