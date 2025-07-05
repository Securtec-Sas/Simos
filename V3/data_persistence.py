# Simos/V3/data_persistence.py

import asyncio
import logging
import csv
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
# Importar solo CSV_LOG_PATH si se mantiene. TRADING_STATE_FILE y BALANCE_CACHE_FILE se eliminarán.
from config_v3 import CSV_LOG_PATH
from utils import save_json_file, load_json_file, get_current_timestamp, safe_float

# Ruta fija para datos de entrenamiento generados por simulación, si se mantiene esta funcionalidad local
DEFAULT_TRAINING_DATA_PATH = os.path.join("data", "training_data.json") # Usar os.path.join para compatibilidad
# Rutas fijas para directorios, si las constantes de config_v3.py se eliminan por completo para rutas
LOGS_DIR = "logs"
DATA_DIR = "data"

class DataPersistence:
    """Maneja la persistencia de datos para V3 (principalmente logs y datos de entrenamiento locales)."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.DataPersistence')
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Asegura que los directorios necesarios para logs y datos locales existan."""
        directories_to_check = []
        
        # Directorio para CSV_LOG_PATH (si se mantiene desde config_v3.py)
        # o un path de log por defecto si CSV_LOG_PATH se elimina de config_v3.py
        csv_log_dir = os.path.dirname(CSV_LOG_PATH) if CSV_LOG_PATH and os.path.dirname(CSV_LOG_PATH) else LOGS_DIR
        if csv_log_dir:
            directories_to_check.append(csv_log_dir)

        # Directorio para datos de entrenamiento
        training_data_dir = os.path.dirname(DEFAULT_TRAINING_DATA_PATH)
        if training_data_dir: # Debería ser "data"
            directories_to_check.append(training_data_dir)
        elif DATA_DIR: # Fallback si DEFAULT_TRAINING_DATA_PATH fuera solo un nombre de archivo
            directories_to_check.append(DATA_DIR)

        # Eliminar duplicados y asegurar creación
        for directory in list(set(d for d in directories_to_check if d)):
            if not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                self.logger.info(f"Directorio para persistencia local creado: {directory}")
    
    # Logging de operaciones en CSV (Mantenido si se desea auditoría local)
    
    async def log_operation_to_csv(self, operation_data: Dict, csv_path: str = None):
        """Registra una operación en el archivo CSV."""
        current_csv_path = csv_path or CSV_LOG_PATH # Asume que CSV_LOG_PATH sigue en config_v3.py
        
        try:
            # Preparar datos para CSV
            csv_data = self._prepare_csv_data(operation_data)
            
            # Verificar si el archivo existe para escribir headers
            file_exists = os.path.exists(csv_path)
            
            # Escribir al CSV
            with open(csv_path, 'a', newline='', encoding='utf-8') as csvfile:
                fieldnames = list(csv_data.keys())
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                if not file_exists:
                    writer.writeheader()
                
                writer.writerow(csv_data)
            
            self.logger.debug(f"Operación registrada en CSV: {operation_data.get('symbol', 'N/A')}")
            
        except Exception as e:
            self.logger.error(f"Error registrando operación en CSV: {e}")
    
    def _prepare_csv_data(self, operation_data: Dict) -> Dict[str, Any]:
        """Prepara los datos de operación para el formato CSV."""
        timestamp = get_current_timestamp()
        
        # Extraer datos principales
        symbol = operation_data.get('symbol', 'N/A')
        decision = operation_data.get('decision_outcome', 'N/A')
        
        # Datos de rentabilidad
        profitability = operation_data.get('net_profitability_results', {})
        net_profit_usdt = safe_float(profitability.get('net_profit_usdt', 0))
        net_profit_percentage = safe_float(profitability.get('net_profit_percentage', 0))
        investment_usdt = safe_float(profitability.get('initial_investment_usdt', 0))
        
        # Datos de simulación
        simulation = operation_data.get('simulation_results', {})
        final_profit = safe_float(simulation.get('final_simulated_profit_usdt', 0))
        
        # Datos de exchanges
        buy_exchange = operation_data.get('buy_exchange_id', 'N/A')
        sell_exchange = operation_data.get('sell_exchange_id', 'N/A')
        
        # Precios
        buy_price = safe_float(operation_data.get('current_price_ex_min_buy_asset', 0))
        sell_price = safe_float(operation_data.get('current_price_ex_max_sell_asset', 0))
        
        # Datos de balance
        balance_config = operation_data.get('current_balance_config_v2', {})
        initial_balance = safe_float(balance_config.get('balance_usdt', 0))
        
        return {
            'timestamp': timestamp,
            'symbol': symbol,
            'decision_outcome': decision,
            'net_profit_usdt': net_profit_usdt,
            'net_profit_percentage': net_profit_percentage,
            'investment_usdt': investment_usdt,
            'final_simulated_profit_usdt': final_profit,
            'buy_exchange_id': buy_exchange,
            'sell_exchange_id': sell_exchange,
            'buy_price': buy_price,
            'sell_price': sell_price,
            'initial_balance_usdt': initial_balance,
            'percentage_difference': safe_float(operation_data.get('current_percentage_difference', 0)),
            'analysis_id': operation_data.get('analysis_id', 'N/A'),
            'error_message': operation_data.get('error_message', ''),
            'ai_confidence': safe_float(operation_data.get('ai_confidence', 0)),
            'execution_time_ms': safe_float(operation_data.get('execution_time_ms', 0))
        }
    
    # Estado del trading y Cache de balances - MÉTODOS ELIMINADOS
    # async def save_trading_state(self, state_data: Dict) -> bool: ...
    # async def load_trading_state(self) -> Optional[Dict]: ...
    # async def save_balance_cache(self, balance_data: Dict) -> bool: ...
    # async def load_balance_cache(self) -> Optional[Dict]: ...
    
    # Datos de entrenamiento (Mantenido para datos de simulación local)
    
    async def save_training_data(self, training_data: List[Dict], filepath: str = None) -> bool:
        """Guarda datos de entrenamiento."""
        current_filepath = filepath or DEFAULT_TRAINING_DATA_PATH
        
        try:
            # Asegurar que el directorio existe
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            data_to_save = {
                'training_data': training_data,
                'created_at': get_current_timestamp(),
                'count': len(training_data)
            }
            
            success = save_json_file(data_to_save, filepath)
            
            if success:
                self.logger.info(f"Datos de entrenamiento guardados: {len(training_data)} registros")
            else:
                self.logger.error("Error guardando datos de entrenamiento")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error guardando datos de entrenamiento: {e}")
            return False
    
    async def load_training_data(self, filepath: str = None) -> Optional[List[Dict]]:
        """Carga datos de entrenamiento."""
        if filepath is None:
            filepath = "data/training_data.json"
        
        try:
            data = load_json_file(filepath)
            
            if data and 'training_data' in data:
                training_data = data['training_data']
                self.logger.info(f"Datos de entrenamiento cargados: {len(training_data)} registros")
                return training_data
            else:
                self.logger.info("No se encontraron datos de entrenamiento")
                return None
            
        except Exception as e:
            self.logger.error(f"Error cargando datos de entrenamiento: {e}")
            return None
    
    # Análisis de logs
    
    async def get_operation_statistics(self, days: int = 7) -> Dict[str, Any]:
        """Obtiene estadísticas de operaciones de los últimos días."""
        try:
            if not os.path.exists(CSV_LOG_PATH):
                return self._empty_statistics()
            
            stats = {
                'total_operations': 0,
                'successful_operations': 0,
                'failed_operations': 0,
                'total_profit_usdt': 0.0,
                'total_investment_usdt': 0.0,
                'average_profit_percentage': 0.0,
                'symbols_traded': set(),
                'exchanges_used': set(),
                'success_rate': 0.0
            }
            
            # Leer CSV y calcular estadísticas
            with open(CSV_LOG_PATH, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                for row in reader:
                    stats['total_operations'] += 1
                    
                    # Determinar si fue exitosa
                    decision = row.get('decision_outcome', '')
                    if 'EJECUTADA' in decision:
                        stats['successful_operations'] += 1
                    else:
                        stats['failed_operations'] += 1
                    
                    # Acumular profits e inversiones
                    profit = safe_float(row.get('net_profit_usdt', 0))
                    investment = safe_float(row.get('investment_usdt', 0))
                    
                    stats['total_profit_usdt'] += profit
                    stats['total_investment_usdt'] += investment
                    
                    # Recopilar símbolos y exchanges
                    symbol = row.get('symbol', '').strip()
                    if symbol and symbol != 'N/A':
                        stats['symbols_traded'].add(symbol)
                    
                    buy_ex = row.get('buy_exchange_id', '').strip()
                    sell_ex = row.get('sell_exchange_id', '').strip()
                    if buy_ex and buy_ex != 'N/A':
                        stats['exchanges_used'].add(buy_ex)
                    if sell_ex and sell_ex != 'N/A':
                        stats['exchanges_used'].add(sell_ex)
            
            # Calcular métricas derivadas
            if stats['total_operations'] > 0:
                stats['success_rate'] = (stats['successful_operations'] / stats['total_operations']) * 100
            
            if stats['total_investment_usdt'] > 0:
                stats['average_profit_percentage'] = (stats['total_profit_usdt'] / stats['total_investment_usdt']) * 100
            
            # Convertir sets a listas para serialización
            stats['symbols_traded'] = list(stats['symbols_traded'])
            stats['exchanges_used'] = list(stats['exchanges_used'])
            
            self.logger.debug(f"Estadísticas calculadas: {stats['total_operations']} operaciones")
            return stats
            
        except Exception as e:
            self.logger.error(f"Error calculando estadísticas: {e}")
            return self._empty_statistics()
    
    def _empty_statistics(self) -> Dict[str, Any]:
        """Retorna estadísticas vacías."""
        return {
            'total_operations': 0,
            'successful_operations': 0,
            'failed_operations': 0,
            'total_profit_usdt': 0.0,
            'total_investment_usdt': 0.0,
            'average_profit_percentage': 0.0,
            'symbols_traded': [],
            'exchanges_used': [],
            'success_rate': 0.0
        }
    
    # Limpieza de datos
    
    async def cleanup_old_logs(self, days_to_keep: int = 30):
        """Limpia logs antiguos."""
        try:
            # Esta función podría implementar lógica para archivar o eliminar logs antiguos
            # Por ahora, solo registra la intención
            self.logger.info(f"Limpieza de logs programada: mantener {days_to_keep} días")
            
        except Exception as e:
            self.logger.error(f"Error en limpieza de logs: {e}")
    
    async def export_data(self, export_path: str, data_type: str = "operations") -> bool:
        """Exporta datos a un archivo específico."""
        try:
            if data_type == "operations" and os.path.exists(CSV_LOG_PATH):
                # Copiar archivo CSV de operaciones
                import shutil
                shutil.copy2(CSV_LOG_PATH, export_path)
                self.logger.info(f"Datos de operaciones exportados a: {export_path}")
                return True
            else:
                self.logger.warning(f"Tipo de datos no soportado o archivo no encontrado: {data_type}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error exportando datos: {e}")
            return False

