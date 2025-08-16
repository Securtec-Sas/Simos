# V2/controllera/testController.py

import asyncio
import aiohttp
import json
import os
import csv
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from config import SEBO_API_BASE_URL

class TestController:
    """Controlador para operaciones de pruebas y generación de datos de test."""
    
    def __init__(self):
        self.http_session = None
        self.base_url = SEBO_API_BASE_URL
        self.data_dir = './data'
    
    async def _ensure_http_session(self):
        """Asegura que la sesión HTTP esté inicializada."""
        if not self.http_session or self.http_session.closed:
            self.http_session = aiohttp.ClientSession()
    
    async def create_test_file(self, days_back: int = 59, num_analysis: int = 100, 
                              frame_time: str = "5m") -> Dict[str, Any]:
        """
        Crea un archivo de pruebas con datos históricos simulados.
        
        Args:
            days_back: Número de días hacia atrás para generar datos (default: 59)
            num_analysis: Número de análisis a generar (default: 100)
            frame_time: Intervalo de tiempo entre análisis (default: "5m")
        
        Returns:
            Dict con el resultado de la operación
        """
        try:
            await self._ensure_http_session()
            
            # Calcular fechas
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Generar nombre de archivo
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_data_{days_back}days_{num_analysis}analysis_{frame_time}_{timestamp}.csv"
            
            # Determinar directorio de salida (misma carpeta que entrenamiento)
            training_dir = os.path.join(self.data_dir, "training")
            if not os.path.exists(training_dir):
                os.makedirs(training_dir, exist_ok=True)
            
            filepath = os.path.join(training_dir, filename)
            
            print(f"🚀 Iniciando creación de archivo de pruebas")
            print(f"📅 Período: {start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}")
            print(f"📊 Análisis a generar: {num_analysis}")
            print(f"⏱️ Intervalo: {frame_time}")
            print(f"📁 Archivo: {filepath}")
            
            # Obtener símbolos disponibles
            symbols = await self._get_available_symbols()
            if not symbols:
                symbols = self._get_default_symbols()
            
            # Generar datos de prueba
            test_data = await self._generate_test_data(
                symbols, start_date, end_date, num_analysis, frame_time
            )
            
            if not test_data:
                return {
                    "success": False,
                    "message": "No se pudieron generar datos de prueba",
                    "filepath": None
                }
            
            # Guardar archivo CSV
            await self._save_csv_file(test_data, filepath)
            
            print(f"✅ Archivo de pruebas creado exitosamente")
            print(f"📁 Ubicación: {filepath}")
            print(f"📊 Registros generados: {len(test_data)}")
            
            return {
                "success": True,
                "message": f"Archivo de pruebas creado exitosamente con {len(test_data)} registros",
                "filepath": filepath,
                "filename": filename,
                "records_count": len(test_data),
                "parameters": {
                    "days_back": days_back,
                    "num_analysis": num_analysis,
                    "frame_time": frame_time,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
            
        except Exception as e:
            error_msg = f"Error creando archivo de pruebas: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "message": error_msg,
                "filepath": None
            }
    
    async def _get_available_symbols(self) -> List[Dict]:
        """Obtiene la lista de símbolos disponibles desde la API de Sebo."""
        try:
            url = f"{self.base_url}/symbols"
            async with self.http_session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Convertir formato de respuesta
                    symbols = []
                    if isinstance(data, list):
                        for item in data:
                            if "id_sy" in item:
                                symbols.append({
                                    "id": item["id_sy"].replace("/", ""),
                                    "name": item["id_sy"],
                                    "base": item["id_sy"].split("/")[0] if "/" in item["id_sy"] else item["id_sy"],
                                    "quote": item["id_sy"].split("/")[1] if "/" in item["id_sy"] else "USDT"
                                })
                    
                    print(f"✅ Obtenidos {len(symbols)} símbolos desde API")
                    return symbols
                else:
                    print(f"⚠️ Error obteniendo símbolos: HTTP {response.status}")
                    return []
                    
        except Exception as e:
            print(f"⚠️ Error conectando con API de símbolos: {e}")
            return []
    
    def _get_default_symbols(self) -> List[Dict]:
        """Retorna una lista de símbolos por defecto."""
        return [
            {"id": "BTCUSDT", "name": "BTC/USDT", "base": "BTC", "quote": "USDT"},
            {"id": "ETHUSDT", "name": "ETH/USDT", "base": "ETH", "quote": "USDT"},
            {"id": "BNBUSDT", "name": "BNB/USDT", "base": "BNB", "quote": "USDT"},
            {"id": "ADAUSDT", "name": "ADA/USDT", "base": "ADA", "quote": "USDT"},
            {"id": "SOLUSDT", "name": "SOL/USDT", "base": "SOL", "quote": "USDT"},
            {"id": "XRPUSDT", "name": "XRP/USDT", "base": "XRP", "quote": "USDT"},
            {"id": "DOTUSDT", "name": "DOT/USDT", "base": "DOT", "quote": "USDT"},
            {"id": "AVAXUSDT", "name": "AVAX/USDT", "base": "AVAX", "quote": "USDT"},
            {"id": "MATICUSDT", "name": "MATIC/USDT", "base": "MATIC", "quote": "USDT"},
            {"id": "LINKUSDT", "name": "LINK/USDT", "base": "LINK", "quote": "USDT"}
        ]
    
    async def _generate_test_data(self, symbols: List[Dict], start_date: datetime, 
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
            
            print(f"📊 Generando {num_analysis} análisis distribuidos en {total_intervals} intervalos")
            
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
                        
                        if generated_count % 10 == 0:
                            print(f"   📈 Progreso: {generated_count}/{num_analysis} análisis generados")
                
                # Avanzar al siguiente intervalo
                current_date += timedelta(minutes=interval_minutes)
            
            print(f"✅ Generación completada: {len(test_data)} registros")
            return test_data
            
        except Exception as e:
            print(f"❌ Error generando datos sintéticos de prueba: {e}")
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
        transfer_fee = 1.0  # 1 USDT por transferencia
        total_fees = (investment_usdt * buy_fee) + (investment_usdt * sell_fee) + transfer_fee
        
        # Calcular ganancia neta estimada
        percentage_diff = ((sell_price - buy_price) / buy_price) * 100
        gross_profit = investment_usdt * (percentage_diff / 100)
        estimated_profit = gross_profit - total_fees
        
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
            'current_price_buy': round(buy_price, 8),
            'current_price_sell': round(sell_price, 8),
            'investment_usdt': round(investment_usdt, 2),
            'estimated_buy_fee': round(buy_fee, 6),
            'estimated_sell_fee': round(sell_fee, 6),
            'estimated_transfer_fee': transfer_fee,
            'total_fees_usdt': round(total_fees, 4),
            'net_profit_usdt': round(net_profit, 4),
            'profit_percentage': round((net_profit / investment_usdt) * 100, 4),
            'execution_time_seconds': round(np.random.uniform(30, 300), 2),
            'decision_outcome': decision_outcome,
            'percentage_difference': round(percentage_diff, 4)
        }

    def _get_interval_minutes(self, frame_time: str) -> int:
        """Convierte el frame_time a minutos."""
        interval_minutes = {
            "5m": 5, "10m": 10, "15m": 15, "30m": 30,
            "1h": 60, "2h": 120, "3h": 180, "4h": 240,
            "6h": 360, "12h": 720, "1d": 1440
        }
        return interval_minutes.get(frame_time, 5)

    async def _save_csv_file(self, data: List[Dict], filepath: str):
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
        
        print(f"💾 Archivo CSV guardado: {filepath}")

    async def get_test_files_list(self) -> Dict[str, Any]:
        """Obtiene la lista de archivos de prueba disponibles."""
        try:
            training_dir = os.path.join(self.data_dir, "training")
            
            if not os.path.exists(training_dir):
                return {
                    "success": True,
                    "files": [],
                    "message": "No hay archivos de prueba disponibles"
                }
            
            files = []
            for filename in os.listdir(training_dir):
                if filename.startswith("test_data_") and filename.endswith(".csv"):
                    filepath = os.path.join(training_dir, filename)
                    file_stats = os.stat(filepath)
                    
                    files.append({
                        "filename": filename,
                        "filepath": filepath,
                        "size": file_stats.st_size,
                        "created": datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                        "modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat()
                    })
            
            # Ordenar por fecha de creación (más reciente primero)
            files.sort(key=lambda x: x["created"], reverse=True)
            
            return {
                "success": True,
                "files": files,
                "count": len(files),
                "message": f"Se encontraron {len(files)} archivos de prueba"
            }
            
        except Exception as e:
            return {
                "success": False,
                "files": [],
                "message": f"Error obteniendo lista de archivos: {str(e)}"
            }

    async def cleanup(self):
        """Limpia recursos del controlador."""
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()


# Instancia global del controlador
test_controller = TestController()


# Funciones de utilidad para usar en rutas
async def create_test_file_handler(days_back: int = 59, num_analysis: int = 100, 
                                  frame_time: str = "5m") -> Dict[str, Any]:
    """Handler para crear archivo de pruebas."""
    return await test_controller.create_test_file(days_back, num_analysis, frame_time)


async def get_test_files_handler() -> Dict[str, Any]:
    """Handler para obtener lista de archivos de prueba."""
    return await test_controller.get_test_files_list()