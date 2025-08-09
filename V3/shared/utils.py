# Simos/V3/utils.py

import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import aiohttp

def setup_logging(log_level: str = "INFO", log_file: str = None):
    """Configura el sistema de logging para V3."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Configurar formato
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Logger principal
    logger = logging.getLogger('V3')
    logger.setLevel(level)
    
    # Handler para consola
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Handler para archivo si se especifica
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

def get_current_timestamp() -> str:
    """Retorna el timestamp actual en formato ISO."""
    return datetime.now(timezone.utc).isoformat()

def safe_float(value: Any, default: float = 0.0) -> float:
    """Convierte un valor a float de forma segura."""
    try:
        if value is None:
            return default
        if isinstance(value, str):
            # Remover caracteres no numéricos como '%'
            value = value.replace('%', '').strip()
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_dict_get(dictionary: Dict, key: str, default: Any = None) -> Any:
    """Obtiene un valor de un diccionario de forma segura."""
    try:
        return dictionary.get(key, default)
    except (AttributeError, TypeError):
        return default

def format_currency(amount: float, decimals: int = 4) -> str:
    """Formatea un monto de moneda con el número especificado de decimales."""
    return f"{amount:.{decimals}f}"

def calculate_percentage_difference(price_buy: float, price_sell: float) -> float:
    """Calcula el porcentaje de diferencia entre precio de compra y venta."""
    if price_buy <= 0:
        return 0.0
    return ((price_sell - price_buy) / price_buy) * 100

def find_cheapest_network(networks: List[Dict], preferred_networks: List[str] = None) -> Optional[Dict]:
    """Encuentra la red más barata para transferencias."""
    if not networks:
        return None
    
    # Filtrar redes activas
    active_networks = [
        net for net in networks 
        if net.get('active', False) and net.get('withdraw', False)
    ]
    
    if not active_networks:
        return None
    
    # Si hay redes preferidas, buscar la más barata entre ellas
    if preferred_networks:
        preferred_active = [
            net for net in active_networks 
            if net.get('network') in preferred_networks
        ]
        if preferred_active:
            active_networks = preferred_active
    
    # Encontrar la red con menor fee
    cheapest = min(
        active_networks, 
        key=lambda x: safe_float(x.get('fee', float('inf')))
    )
    
    return cheapest

def validate_exchange_id(exchange_id: str, supported_exchanges: List[str]) -> bool:
    """Valida si un exchange ID está soportado."""
    return exchange_id.lower() in [ex.lower() for ex in supported_exchanges]

def create_symbol_dict(top20_item: Dict) -> Dict[str, Any]:
    """Crea un diccionario de símbolo a partir de un item del top 20."""
    return {
        'symbol': safe_dict_get(top20_item, 'symbol'),
        'symbol_name': safe_dict_get(top20_item, 'symbol_name'),
        'buy_exchange_id': safe_dict_get(top20_item, 'exchange_min_id'),
        'sell_exchange_id': safe_dict_get(top20_item, 'exchange_max_id'),
        'buy_price_sebo': safe_float(safe_dict_get(top20_item, 'price_at_exMin_to_buy_asset')),
        'sell_price_sebo': safe_float(safe_dict_get(top20_item, 'price_at_exMax_to_sell_asset')),
        'percentage_difference': safe_float(safe_dict_get(top20_item, 'percentage_difference', '0%').replace('%', '')),
        'buy_exchange_fees': safe_dict_get(top20_item, 'fees_exMin', {}),
        'sell_exchange_fees': safe_dict_get(top20_item, 'fees_exMax', {}),
        'analysis_id': safe_dict_get(top20_item, 'analysis_id'),
        'timestamp': safe_dict_get(top20_item, 'timestamp')
    }

async def make_http_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    timeout: int = 30,
    **kwargs
) -> Optional[Dict]:
    """Realiza una petición HTTP de forma segura."""
    try:
        async with session.request(
            method, url, timeout=aiohttp.ClientTimeout(total=timeout), **kwargs
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                logging.getLogger('V3').warning(
                    f"HTTP {method} {url} returned status {response.status}"
                )
                return None
    except asyncio.TimeoutError:
        logging.getLogger('V3').error(f"Timeout en petición HTTP {method} {url}")
        return None
    except Exception as e:
        logging.getLogger('V3').error(f"Error en petición HTTP {method} {url}: {e}")
        return None

def save_json_file(data: Dict, filepath: str) -> bool:
    """Guarda datos en un archivo JSON."""
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        return True
    except Exception as e:
        logging.getLogger('V3').error(f"Error guardando archivo JSON {filepath}: {e}")
        return False

def load_json_file(filepath: str) -> Optional[Dict]:
    """Carga datos desde un archivo JSON."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.getLogger('V3').info(f"Archivo JSON no encontrado: {filepath}")
        return None
    except Exception as e:
        logging.getLogger('V3').error(f"Error cargando archivo JSON {filepath}: {e}")
        return None

def is_profitable_operation(
    net_profit_usdt: float,
    min_profit_usdt: float,
    min_profit_percentage: float,
    investment_usdt: float
) -> bool:
    """Determina si una operación es rentable según los criterios establecidos."""
    if net_profit_usdt < min_profit_usdt:
        return False
    
    if investment_usdt > 0:
        profit_percentage = (net_profit_usdt / investment_usdt) * 100
        return profit_percentage >= min_profit_percentage
    
    return False

def format_operation_summary(operation_data: Dict) -> str:
    """Formatea un resumen de operación para logging."""
    symbol = operation_data.get('symbol', 'N/A')
    decision = operation_data.get('decision', 'N/A')
    profit = safe_float(operation_data.get('net_profit_usdt', 0))
    investment = safe_float(operation_data.get('investment_usdt', 0))
    
    return f"[{symbol}] {decision} | Profit: {format_currency(profit)} USDT | Investment: {format_currency(investment)} USDT"

