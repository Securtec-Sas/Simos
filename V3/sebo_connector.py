# Simos/V3/sebo_connector.py

import asyncio
import logging
import json
import urllib.parse
from typing import Dict, Any, Optional, List, Callable
import socketio
import aiohttp
from config_v3 import WEBSOCKET_URL, SEBO_API_BASE_URL, REQUEST_TIMEOUT
from utils import make_http_request, safe_dict_get, get_current_timestamp

class SeboConnector:
    """Maneja la conexión con el servidor Sebo (Socket.IO y API REST)."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.SeboConnector')
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self.http_session: Optional[aiohttp.ClientSession] = None
        self.is_connected = False
        
        # Callbacks para eventos
        self.on_spot_arb_callback: Optional[Callable] = None
        self.on_balances_update_callback: Optional[Callable] = None
        self.on_top20_data_callback: Optional[Callable] = None
        
        # Cache de datos
        self.latest_top20_data: List[Dict] = []
        self.latest_balances: Optional[Dict] = None
        
        self._register_sio_handlers()
    
    async def initialize(self):
        """Inicializa la sesión HTTP."""
        if self.http_session is None or self.http_session.closed:
            self.http_session = aiohttp.ClientSession()
    
    async def cleanup(self):
        """Limpia recursos."""
        if self.sio.connected:
            await self.sio.disconnect()
        
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
    
    def _register_sio_handlers(self):
        """Registra los handlers para eventos de Socket.IO."""
        
        @self.sio.event
        async def connect():
            self.logger.info("Conectado a Sebo Socket.IO")
            self.is_connected = True
        
        @self.sio.event
        async def disconnect():
            self.logger.warning("Desconectado de Sebo Socket.IO")
            self.is_connected = False
        
        # Handler para datos de arbitraje spot
        self.sio.on('spot-arb', namespace='/api/spot/arb')(self._on_spot_arb_data)
        
        # Handler para actualizaciones de balance
        self.sio.on('balances-update', namespace='/api/spot/arb')(self._on_balances_update)
        
        # Handler para datos del top 20
        self.sio.on('top_20_data', namespace='/api/spot/arb')(self._on_top20_data)
    
    async def _on_spot_arb_data(self, data: Dict):
        """Maneja datos de arbitraje spot recibidos de Sebo."""
        try:
            symbol = safe_dict_get(data, 'symbol', 'N/A')
            self.logger.debug(f"Recibido spot-arb para {symbol}")
            
            if self.on_spot_arb_callback:
                await self.on_spot_arb_callback(data)
        except Exception as e:
            self.logger.error(f"Error procesando spot-arb data: {e}")
    
    async def _on_balances_update(self, data: Dict):
        """Maneja actualizaciones de balance recibidas de Sebo."""
        try:
            self.logger.info(f"Recibida actualización de balances: {len(data) if isinstance(data, (list, dict)) else 'Invalid'}")
            self.latest_balances = data
            
            if self.on_balances_update_callback:
                await self.on_balances_update_callback(data)
        except Exception as e:
            self.logger.error(f"Error procesando balances-update: {e}")
    
    async def _on_top20_data(self, data: List[Dict]):
        """Maneja datos del top 20 recibidos de Sebo."""
        try:
            if isinstance(data, list):
                self.logger.info(f"Recibidos datos top 20: {len(data)} items")
                self.latest_top20_data = data
                
                if self.on_top20_data_callback:
                    await self.on_top20_data_callback(data)
            else:
                self.logger.warning(f"Datos top 20 con formato inesperado: {type(data)}")
        except Exception as e:
            self.logger.error(f"Error procesando top_20_data: {e}")
    
    async def connect_to_sebo(self) -> bool:
        """Conecta al servidor Sebo via Socket.IO."""
        try:
            parsed_url = urllib.parse.urlparse(WEBSOCKET_URL)
            sebo_base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
            namespace = parsed_url.path if parsed_url.path else '/'
            
            self.logger.info(f"Conectando a Sebo Socket.IO: {sebo_base_url} (namespace: {namespace})")
            
            await self.sio.connect(sebo_base_url, namespaces=[namespace])
            return True
            
        except Exception as e:
            self.logger.error(f"Error conectando a Sebo Socket.IO: {e}")
            return False
    
    async def disconnect_from_sebo(self):
        """Desconecta del servidor Sebo."""
        if self.sio.connected:
            await self.sio.disconnect()
            self.logger.info("Desconectado de Sebo Socket.IO")
    
    # API REST methods
    
    async def get_balance_config(self, exchange_id: str) -> Optional[Dict]:
        """Obtiene la configuración de balance para un exchange."""
        if not exchange_id:
            return None
        
        await self.initialize()
        url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        
        result = await make_http_request(
            self.http_session, 'GET', url, timeout=REQUEST_TIMEOUT
        )
        
        if result:
            self.logger.debug(f"Balance config obtenida para {exchange_id}")
        else:
            self.logger.warning(f"No se pudo obtener balance config para {exchange_id}")
        
        return result
    
    async def update_balance_config(self, exchange_id: str, balance_data: Dict) -> bool:
        """Actualiza la configuración de balance para un exchange."""
        if not exchange_id:
            return False
        
        await self.initialize()
        url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        
        # Preparar payload
        payload = {**balance_data}
        payload['id_exchange'] = exchange_id
        payload['timestamp'] = get_current_timestamp()
        
        # Remover campos internos de MongoDB
        payload.pop('_id', None)
        payload.pop('__v', None)
        
        result = await make_http_request(
            self.http_session, 'PUT', url, timeout=REQUEST_TIMEOUT, json=payload
        )
        
        if result:
            self.logger.info(f"Balance actualizado para {exchange_id}: {result.get('balance_usdt')} USDT")
            return True
        else:
            self.logger.error(f"Error actualizando balance para {exchange_id}")
            return False
    
    async def get_withdrawal_fees(self, exchange_id: str, symbol: str) -> Optional[Dict]:
        """Obtiene las tarifas de retiro para un símbolo en un exchange."""
        if not exchange_id or not symbol:
            return None
        
        await self.initialize()
        url = f"{SEBO_API_BASE_URL}/exchanges/{exchange_id}/withdrawal-fees/{symbol}"
        
        result = await make_http_request(
            self.http_session, 'GET', url, timeout=REQUEST_TIMEOUT
        )
        
        if result:
            self.logger.debug(f"Tarifas de retiro obtenidas para {symbol}@{exchange_id}")
        else:
            self.logger.warning(f"No se pudieron obtener tarifas de retiro para {symbol}@{exchange_id}")
        
        return result
    
    async def get_top_opportunities(self, limit: int = 20) -> Optional[List[Dict]]:
        """Obtiene las principales oportunidades de arbitraje."""
        await self.initialize()
        url = f"{SEBO_API_BASE_URL}/spot/top-opportunities"
        
        params = {'limit': limit} if limit else {}
        
        result = await make_http_request(
            self.http_session, 'GET', url, timeout=REQUEST_TIMEOUT, params=params
        )
        
        if result and isinstance(result, list):
            self.logger.info(f"Obtenidas {len(result)} oportunidades principales")
            return result
        else:
            self.logger.warning("No se pudieron obtener oportunidades principales")
            return None
    
    # Callback setters
    
    def set_spot_arb_callback(self, callback: Callable):
        """Establece el callback para datos de arbitraje spot."""
        self.on_spot_arb_callback = callback
    
    def set_balances_update_callback(self, callback: Callable):
        """Establece el callback para actualizaciones de balance."""
        self.on_balances_update_callback = callback
    
    def set_top20_data_callback(self, callback: Callable):
        """Establece el callback para datos del top 20."""
        self.on_top20_data_callback = callback
    
    # Getters para datos cacheados
    
    def get_latest_top20_data(self) -> List[Dict]:
        """Retorna los últimos datos del top 20."""
        return self.latest_top20_data.copy()
    
    def get_latest_balances(self) -> Optional[Dict]:
        """Retorna los últimos datos de balances."""
        return self.latest_balances
    
    async def wait_for_connection(self):
        """Mantiene la conexión Socket.IO activa."""
        try:
            await self.sio.wait()
        except Exception as e:
            self.logger.error(f"Error en conexión Socket.IO: {e}")
            raise

