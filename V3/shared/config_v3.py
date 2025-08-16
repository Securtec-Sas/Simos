# Simos/V3/config_v3.py

# NOTA: Las API keys y configuraciones de sandbox ahora se manejan desde la base de datos
# a través del sistema Sebo. Este archivo solo contiene configuraciones estáticas del sistema.

DATA_DIR = './data'

# URLs de conexión
WEBSOCKET_URL = "ws://localhost:3031/api/spot/arb"  # WebSocket de sebo
UI_WEBSOCKET_URL = "ws://localhost:3002"  # WebSocket para la UI
SEBO_API_BASE_URL = "http://localhost:3031/api"  # API base de Sebo

# Parámetros para la lógica de arbitraje
MIN_PROFIT_PERCENTAGE = 0.6  # Porcentaje mínimo de ganancia para realizar una operación
MIN_PROFIT_USDT = 0.01  # Ganancia mínima absoluta en USDT
MIN_OPERATIONAL_USDT = 10.0  # Balance mínimo para operar

# Parámetros de la IA
AI_MODEL_PATH = "models/arbitrage_model.pkl"
AI_TRAINING_DATA_PATH = "data/training_data.csv"
AI_CONFIDENCE_THRESHOLD = 0.7  # Umbral de confianza para ejecutar operaciones

# Parámetros de trading
DEFAULT_INVESTMENT_MODE = "PERCENTAGE"  # "FIXED" o "PERCENTAGE"
DEFAULT_INVESTMENT_PERCENTAGE = 10.0  # Porcentaje del balance a invertir
DEFAULT_FIXED_INVESTMENT_USDT = 50.0  # Monto fijo a invertir
DEFAULT_STOP_LOSS_PERCENTAGE_GLOBAL = 50.0  # Stop loss global
DEFAULT_STOP_LOSS_PERCENTAGE_OPERATION = 50.0  # Stop loss por operación
DEFAULT_TAKE_PROFIT_PERCENTAGE_OPERATION = None  # Take profit por operación

# Configuración de logging
LOG_LEVEL = "INFO"
LOG_FILE_PATH = "logs/v3_operations.log"
CSV_LOG_PATH = "logs/v3_operation_logs.csv"

# Configuración de simulación
SIMULATION_MODE = False  # True para modo simulación, False para trading real
SIMULATION_DELAY = 0.1  # Delay en segundos para simular tiempo de ejecución

# Configuración de simulación avanzada
ADVANCED_SIMULATION_CONFIG = {
    # Configuraciones principales requeridas por el motor de simulación
    'initial_balance': 10000.0,
    'time_between_transfers_seconds': 30,
    'simulation_duration_minutes': 60,
    'max_concurrent_operations': 3,
    'ai_confidence_threshold': 0.7,
    
    # Configuraciones por defecto (compatibilidad)
    'default_initial_balance': 1000.0,
    'default_time_between_transfers': 2.0,
    'default_simulation_duration': 3600,  # 1 hora
    'default_max_concurrent_operations': 3,
    'default_success_rate': 0.85,
    
    # Configuración de comisiones y fees
    'commission_rates': {
        'usdt_withdrawal': 1.0,  # 1 USDT fijo
        'asset_withdrawal_percentage': 0.001,  # 0.1%
        'trading_fee_percentage': 0.001  # 0.1%
    },
    
    # Rangos de simulación
    'network_delay_range': (0.5, 3.0),
    'slippage_range': (0.001, 0.01),
    
    # Configuración de modos
    'modes': {
        'local': {
            'name': 'Simulación Local',
            'description': 'Simulación usando datos del socket y procesamiento local',
            'uses_real_prices': True,
            'uses_sebo_api': False
        },
        'sebo_sandbox': {
            'name': 'Simulación Sandbox',
            'description': 'Simulación usando API sandbox de Sebo',
            'uses_real_prices': True,
            'uses_sebo_api': True
        }
    }
}

# Configuración de persistencia
TRADING_STATE_FILE = "data/trading_state.json"
BALANCE_CACHE_FILE = "data/balance_cache.json"

# Configuración de red y timeouts
REQUEST_TIMEOUT = 30  # Timeout para requests HTTP en segundos
WEBSOCKET_RECONNECT_DELAY = 5  # Delay para reconexión de WebSocket
MAX_RECONNECT_ATTEMPTS = 10  # Máximo número de intentos de reconexión

# Configuración de exchanges soportados
SUPPORTED_EXCHANGES = [
    "binance", "okx", "kucoin", "bybit", "huobi", "gate", "mexc"
]

# Configuración de redes de transferencia preferidas (por costo)
PREFERRED_NETWORKS = {
    "USDT": ["TRC20", "BSC", "POLYGON", "ERC20"],
    "BTC": ["BTC", "BSC", "POLYGON"],
    "ETH": ["BSC", "POLYGON", "ERC20"],
    "BNB": ["BSC", "BEP2"],
}

