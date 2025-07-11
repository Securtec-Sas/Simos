# Simos/V3/config_example.py

"""
Archivo de configuración de ejemplo para V3.
Copia este archivo como config_v3.py y modifica los valores según tus necesidades.
"""

import os
from pathlib import Path

# Directorios base
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
MODELS_DIR = BASE_DIR / "models"

# Configuración de logging
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR
LOG_FILE_PATH = LOGS_DIR / "v3.log"
LOG_MAX_SIZE = 10 * 1024 * 1024  # 10MB
LOG_BACKUP_COUNT = 5

# Configuración de la aplicación
SIMULATION_MODE = True  # True para simulación, False para trading real
SIMULATION_DELAY = 0.1  # Delay en simulación (segundos)

# Configuración de trading
MIN_PROFIT_PERCENTAGE = 0.5  # Mínimo 0.5% de ganancia
MIN_PROFIT_USDT = 1.0  # Mínimo 1 USDT de ganancia
MIN_OPERATIONAL_USDT = 10.0  # Mínimo 10 USDT para operar

# Configuración de inversión por defecto
DEFAULT_INVESTMENT_MODE = "PERCENTAGE"  # "PERCENTAGE" o "FIXED"
DEFAULT_INVESTMENT_PERCENTAGE = 10.0  # 10% del balance
DEFAULT_FIXED_INVESTMENT_USDT = 100.0  # 100 USDT fijos

# Configuración del modelo de IA
AI_MODEL_PATH = MODELS_DIR / "arbitrage_model.joblib"
AI_CONFIDENCE_THRESHOLD = 0.6  # Umbral de confianza mínimo (0-1)

# Configuración de exchanges
SUPPORTED_EXCHANGES = [
    "binance",
    "okx", 
    "kucoin",
    "bybit",
    "huobi",
    "gate"
]

# Configuración de APIs (EJEMPLO - NO USAR EN PRODUCCIÓN)
# IMPORTANTE: Nunca hardcodees las API keys en el código
# Usa variables de entorno o archivos de configuración seguros
API_KEYS = {
    "binance": {
        "apiKey": os.getenv("BINANCE_API_KEY", ""),
        "secret": os.getenv("BINANCE_SECRET", ""),
        "sandbox": True  # Usar sandbox para pruebas
    },
    "okx": {
        "apiKey": os.getenv("OKX_API_KEY", ""),
        "secret": os.getenv("OKX_SECRET", ""),
        "passphrase": os.getenv("OKX_PASSPHRASE", ""),
        "sandbox": True
    },
    "kucoin": {
        "apiKey": os.getenv("KUCOIN_API_KEY", ""),
        "secret": os.getenv("KUCOIN_SECRET", ""),
        "passphrase": os.getenv("KUCOIN_PASSPHRASE", ""),
        "sandbox": True
    },
    "bybit": {
        "apiKey": os.getenv("BYBIT_API_KEY", ""),
        "secret": os.getenv("BYBIT_SECRET", ""),
        "sandbox": True
    }
}

# Configuración de red para transferencias
PREFERRED_NETWORKS = {
    "USDT": ["TRC20", "ERC20", "BSC"],  # Preferencia de redes para USDT
    "BTC": ["BTC"],
    "ETH": ["ERC20"],
    "BNB": ["BSC", "BEP2"],
    "ADA": ["ADA"],
    "SOL": ["SOL"],
    "DOT": ["DOT"],
    "AVAX": ["AVAX"]
}

# Configuración de WebSocket
WEBSOCKET_CONFIG = {
    "v3_port": 3002,
    "sebo_url": "ws://localhost:3031",
    "sebo_namespace": "/api/spot/arb",
    "reconnect_attempts": 5,
    "reconnect_delay": 3  # segundos
}

# Configuración de base de datos (si se usa)
DATABASE_CONFIG = {
    "type": "sqlite",  # sqlite, postgresql, mysql
    "path": DATA_DIR / "v3_database.db",  # Para SQLite
    # Para PostgreSQL/MySQL:
    # "host": "localhost",
    # "port": 5432,
    # "database": "v3_arbitrage",
    # "username": os.getenv("DB_USERNAME", ""),
    # "password": os.getenv("DB_PASSWORD", "")
}

# Configuración de persistencia de datos
DATA_PERSISTENCE_CONFIG = {
    "operations_csv": DATA_DIR / "operations.csv",
    "balance_cache_json": DATA_DIR / "balance_cache.json",
    "trading_state_json": DATA_DIR / "trading_state.json",
    "training_data_json": DATA_DIR / "training_data.json",
    "backup_interval_hours": 24,
    "max_csv_rows": 10000  # Rotar CSV después de 10k filas
}

# Configuración de monitoreo y alertas
MONITORING_CONFIG = {
    "enable_email_alerts": False,
    "email_smtp_server": "smtp.gmail.com",
    "email_smtp_port": 587,
    "email_username": os.getenv("EMAIL_USERNAME", ""),
    "email_password": os.getenv("EMAIL_PASSWORD", ""),
    "alert_recipients": ["admin@example.com"],
    "alert_on_large_loss": True,
    "large_loss_threshold_usdt": 50.0,
    "alert_on_system_errors": True
}

# Configuración de seguridad
SECURITY_CONFIG = {
    "max_daily_loss_usdt": 100.0,  # Máxima pérdida diaria permitida
    "max_single_operation_usdt": 500.0,  # Máximo por operación
    "enable_ip_whitelist": False,
    "allowed_ips": ["127.0.0.1", "localhost"],
    "api_rate_limit_per_minute": 60,
    "enable_2fa": False  # Para futuras implementaciones
}

# Configuración de desarrollo y debug
DEBUG_CONFIG = {
    "enable_debug_mode": False,
    "log_all_websocket_messages": False,
    "save_debug_data": False,
    "debug_data_dir": DATA_DIR / "debug",
    "enable_profiling": False,
    "mock_exchange_responses": False  # Para testing
}

# Configuración de optimización
OPTIMIZATION_CONFIG = {
    "max_concurrent_operations": 3,
    "operation_timeout_seconds": 300,  # 5 minutos
    "price_cache_duration_seconds": 30,
    "balance_cache_duration_seconds": 60,
    "enable_operation_queue": True,
    "queue_max_size": 100
}

# Validación de configuración
def validate_config():
    """Valida la configuración y crea directorios necesarios."""
    # Crear directorios
    for directory in [DATA_DIR, LOGS_DIR, MODELS_DIR]:
        directory.mkdir(exist_ok=True)
    
    # Validar configuración crítica
    if not SIMULATION_MODE:
        # En modo real, verificar que hay al menos una API key configurada
        has_api_key = False
        for exchange, config in API_KEYS.items():
            if config.get("apiKey") and config.get("secret"):
                has_api_key = True
                break
        
        if not has_api_key:
            raise ValueError(
                "En modo real se requiere al menos una API key configurada. "
                "Configura las variables de entorno o cambia a SIMULATION_MODE = True"
            )
    
    # Validar umbrales
    if MIN_PROFIT_PERCENTAGE <= 0:
        raise ValueError("MIN_PROFIT_PERCENTAGE debe ser mayor que 0")
    
    if AI_CONFIDENCE_THRESHOLD < 0 or AI_CONFIDENCE_THRESHOLD > 1:
        raise ValueError("AI_CONFIDENCE_THRESHOLD debe estar entre 0 y 1")
    
    return True

# Ejecutar validación al importar
if __name__ != "__main__":
    try:
        validate_config()
    except Exception as e:
        print(f"ERROR DE CONFIGURACIÓN: {e}")
        print("Revisa el archivo config_v3.py")

# Función para obtener configuración de exchange
def get_exchange_config(exchange_id):
    """Obtiene la configuración de un exchange específico."""
    return API_KEYS.get(exchange_id, {})

# Función para verificar si un exchange está configurado
def is_exchange_configured(exchange_id):
    """Verifica si un exchange tiene API keys configuradas."""
    config = get_exchange_config(exchange_id)
    return bool(config.get("apiKey") and config.get("secret"))

# Función para obtener exchanges configurados
def get_configured_exchanges():
    """Retorna lista de exchanges que tienen API keys configuradas."""
    configured = []
    for exchange_id in SUPPORTED_EXCHANGES:
        if is_exchange_configured(exchange_id):
            configured.append(exchange_id)
    return configured

