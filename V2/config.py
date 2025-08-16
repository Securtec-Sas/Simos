# Simo/V2/config.py

API_KEYS = {
    "BINANCE_API_KEY": "your_binance_api_key",
    "BINANCE_SECRET_KEY": "your_binance_secret_key",
    "OKX_API_KEY": "your_okx_api_key",
    "OKX_SECRET_KEY": "your_okx_secret_key",
    # Agrega aquí las claves de API para otros exchanges que vayas a usar
}

WEBSOCKET_URL = "ws://localhost:3031/api/spot/arb" # WebSocket de sebo (now on 3031)
UI_WEBSOCKET_URL = "ws://localhost:3001/api/spot/ui" # WebSocket para la UI de V2 (now on 3001)
TOP_OPPORTUNITY_URL = "http://localhost:3031/api/spot/top-opportunit" # Sebo API endpoint (now on 3031)
OPERATIONS_LOG_CSV_PATH = "logs/v2_operations_log.csv" # Path for CSV logging of operations
# Parámetros para la lógica de arbitraje
MIN_PROFIT_PERCENTAGE = 0.6 # Porcentaje mínimo de ganancia para realizar una operación (overall threshold)


# Parámetros para el ajuste de inversión iterativo
MIN_PROFIT_FOR_ADJUSTMENT_USDT = 0.10 # Mínima ganancia en USDT para considerar la inversión inicial aceptable sin ajustar.
INVESTMENT_ADJUSTMENT_STEP_USDT = 20  # Incremento en USDT para cada intento de ajuste.
MAX_INVESTMENT_ADJUSTMENT_ATTEMPTS = 5 # Número máximo de intentos de ajuste.
MAX_INVESTMENT_PERCENTAGE_OF_BALANCE = 50.0 # No invertir más de este % del balance actual mediante ajustes.

# V2 Application settings
DEFAULT_USDT_HOLDER_EXCHANGE_ID = "binance" # Default exchange ID holding USDT
DEFAULT_MODEL_PATH = "trained_arbitrage_model.joblib" # Path for saving/loading the AI model
OPERATIONS_LOG_CSV_PATH = "logs/v2_operation_logs.csv" # Path for CSV logging of operations

# Simulation and Model Training defaults
SIMULATED_DATA_SAMPLES_TRAIN = 300 # Default number of samples for simulated training data
SIMULATED_DATA_SAMPLES_TEST = 150  # Default number of samples for simulated test data

# Real Trading defaults
REAL_TRADE_MIN_OPERATIONAL_USDT = 10.0  # Minimum USDT for a real trade operation
REAL_TRADE_DEFAULT_INVESTMENT_USDT = 10.0 # Default investment for a real trade if not specified by UI and balance > 100

# Batch Processing settings
BATCH_PRACTICAL_MIN_INVESTMENT = 50.0 # Practical minimum investment for an opportunity considered in batch processing if balance allows


