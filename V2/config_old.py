# config.py
WEBSOCKET_URL = "ws://localhost:3001"  # URL base del servidor Socket.IO de Node.js
NODEJS_NAMESPACE = "/api/spot/arb"     # Namespace para la conexión Socket.IO
UI_WEBSOCKET_URL = "ws://localhost:8000/api/spot/ui" # URL para el servidor WebSocket de UI de Python
TOP_OPPORTUNITY_URL = "http://localhost:3000/api/spot/top" # Endpoint HTTP en Node.js
API_KEYS = {
    'BINANCE_API_KEY': 'tu_api_key_binance',
    'BINANCE_SECRET_KEY': 'tu_secret_key_binance',
    'OKX_API_KEY': 'tu_api_key_okx',
    'OKX_SECRET_KEY': 'tu_secret_key_okx',
    # ... otras claves de API
}
MIN_PROFIT_PERCENTAGE = 1.0 # Porcentaje mínimo de ganancia para considerar una oportunidad
