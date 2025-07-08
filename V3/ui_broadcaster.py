# Simos/V3/ui_broadcaster.py

import asyncio
import logging
import json
import urllib.parse
from typing import Dict, Any, Set, Optional, Callable
import websockets
from websockets.exceptions import ConnectionClosed
from config_v3 import UI_WEBSOCKET_URL
from utils import get_current_timestamp

class UIBroadcaster:
    """Maneja la comunicación WebSocket con la interfaz de usuario."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.UIBroadcaster')
        self.ui_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.server = None
        self.is_running = False
        
        # Callbacks para mensajes de la UI
        self.on_trading_start_callback: Optional[Callable] = None
        self.on_trading_stop_callback: Optional[Callable] = None
        self.on_ui_message_callback: Optional[Callable] = None
        self.on_get_ai_model_details_callback: Optional[Callable] = None
        
        # Estado del trading
        self.trading_active = False
        self.trading_stats = {
            'operations_count': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None,
            'last_operation_time': None
        }
    
    
    async def start_server(self):
        """Inicia el servidor WebSocket para la UI."""
        try:
            # Extraer puerto de UI_WEBSOCKET_URL
            parsed_url = urllib.parse.urlparse(UI_WEBSOCKET_URL)
            port = parsed_url.port or 3001
            host = parsed_url.hostname or "localhost"
            
            self.logger.info(f"Iniciando servidor WebSocket UI en {host}:{port}")
            
            self.server = await websockets.serve(
                self._handle_ui_client,
                host,
                port
            )
            
            self.is_running = True
            self.logger.info(f"Servidor WebSocket UI iniciado en ws://{host}:{port}")
            
        except Exception as e:
            self.logger.error(f"Error iniciando servidor WebSocket UI: {e}")
            raise
    
    async def stop_server(self):
        """Detiene el servidor WebSocket."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.is_running = False
            self.logger.info("Servidor WebSocket UI detenido")
    
    async def _handle_ui_client(self, websocket, path):
        """Maneja conexiones de clientes UI."""
        client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self.logger.info(f"Cliente UI conectado: {client_address} (path: {path})")
        
        self.ui_clients.add(websocket)
        
        try:
            # Enviar estado inicial al cliente
            await self._send_initial_state(websocket)
            
            # Escuchar mensajes del cliente
            async for message in websocket:
                await self._process_ui_message(websocket, message)
                
        except ConnectionClosed:
            self.logger.info(f"Cliente UI desconectado: {client_address}")
        except Exception as e:
            self.logger.error(f"Error en cliente UI {client_address}: {e}")
        finally:
            self.ui_clients.discard(websocket)
    
    async def _send_initial_state(self, websocket):
        """Envía el estado inicial a un cliente UI recién conectado."""
        initial_state = {
            "type": "initial_state",
            "payload": {
                "trading_active": self.trading_active,
                "trading_stats": self.trading_stats,
                "timestamp": get_current_timestamp()
            }
        }
        
        try:
            await websocket.send(json.dumps(initial_state))
        except Exception as e:
            self.logger.error(f"Error enviando estado inicial: {e}")
    
    async def _process_ui_message(self, websocket, message: str):
        """Procesa mensajes recibidos de la UI."""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            payload = data.get('payload', {})
            
            self.logger.debug(f"Mensaje UI recibido: {message_type}")
            
            if message_type == 'start_trading':
                await self._handle_start_trading(payload)
            elif message_type == 'stop_trading':
                await self._handle_stop_trading(payload)
            elif message_type == 'get_trading_status':
                await self._send_trading_status(websocket)
            elif message_type == 'get_ai_model_details':
                if self.on_get_ai_model_details_callback:
                    await self.on_get_ai_model_details_callback()
            elif message_type == 'ping':
                await self._send_pong(websocket)
            else:
                # Callback genérico para otros mensajes
                if self.on_ui_message_callback:
                    await self.on_ui_message_callback(message_type, payload)
            
        except json.JSONDecodeError:
            self.logger.error(f"Mensaje UI con formato JSON inválido: {message}")
        except Exception as e:
            self.logger.error(f"Error procesando mensaje UI: {e}")
    
    async def _handle_start_trading(self, payload: Dict):
        """Maneja la solicitud de inicio de trading."""
        if not self.trading_active:
            self.trading_active = True
            self.trading_stats['start_time'] = get_current_timestamp()
            
            self.logger.info("Trading iniciado desde UI")
            
            # Notificar a todos los clientes
            await self.broadcast_trading_status_change(True)
            
            # Callback para lógica de trading
            if self.on_trading_start_callback:
                await self.on_trading_start_callback(payload)
    
    async def _handle_stop_trading(self, payload: Dict):
        """Maneja la solicitud de detención de trading."""
        if self.trading_active:
            self.trading_active = False
            
            self.logger.info("Trading detenido desde UI")
            
            # Notificar a todos los clientes
            await self.broadcast_trading_status_change(False)
            
            # Callback para lógica de trading
            if self.on_trading_stop_callback:
                await self.on_trading_stop_callback(payload)
    
    async def _send_trading_status(self, websocket):
        """Envía el estado actual del trading a un cliente específico."""
        status_message = {
            "type": "trading_status",
            "payload": {
                "trading_active": self.trading_active,
                "trading_stats": self.trading_stats,
                "timestamp": get_current_timestamp()
            }
        }
        
        try:
            await websocket.send(json.dumps(status_message))
        except Exception as e:
            self.logger.error(f"Error enviando estado de trading: {e}")
    
    async def _send_pong(self, websocket):
        """Responde a un ping de la UI."""
        pong_message = {
            "type": "pong",
            "payload": {"timestamp": get_current_timestamp()}
        }
        
        try:
            await websocket.send(json.dumps(pong_message))
        except Exception as e:
            self.logger.error(f"Error enviando pong: {e}")
    
    # Métodos públicos para broadcasting
    
    async def broadcast_message(self, message_data: Dict):
        """Envía un mensaje a todos los clientes UI conectados."""
        if not self.ui_clients:
            return
        
        message_json = json.dumps(message_data)
        disconnected_clients = set()
        
        for client in self.ui_clients:
            try:
                await client.send(message_json)
            except ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                self.logger.error(f"Error enviando mensaje a cliente UI: {e}")
                disconnected_clients.add(client)
        
        # Remover clientes desconectados
        for client in disconnected_clients:
            self.ui_clients.discard(client)
    
    async def broadcast_top20_data(self, top20_data: list):
        """Retransmite datos del top 20 a la UI."""
        message = {
            "type": "top20_data",
            "payload": top20_data,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Top 20 data retransmitido a {len(self.ui_clients)} clientes UI")
    
    async def broadcast_balance_update(self, balance_data: Dict):
        """Retransmite actualizaciones de balance a la UI."""
        message = {
            "type": "balance_update",
            "payload": balance_data,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Balance update retransmitido a {len(self.ui_clients)} clientes UI")
    
    async def broadcast_operation_result(self, operation_data: Dict):
        """Envía el resultado de una operación a la UI."""
        message = {
            "type": "operation_result",
            "payload": operation_data,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Resultado de operación enviado a UI: {operation_data.get('symbol', 'N/A')}")
    
    async def broadcast_trading_status_change(self, is_active: bool):
        """Notifica cambio en el estado del trading."""
        message = {
            "type": "trading_status_change",
            "payload": {
                "trading_active": is_active,
                "trading_stats": self.trading_stats,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Estado de trading cambiado: {'ACTIVO' if is_active else 'INACTIVO'}")
    
    async def broadcast_log_message(self, level: str, message: str, data: Dict = None):
        """Envía un mensaje de log a la UI."""
        log_message = {
            "type": "log_message",
            "payload": {
                "level": level,
                "message": message,
                "data": data,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(log_message)
    
    # Callback setters
    
    def set_trading_start_callback(self, callback: Callable):
        """Establece el callback para inicio de trading."""
        self.on_trading_start_callback = callback
    
    def set_trading_stop_callback(self, callback: Callable):
        """Establece el callback para detención de trading."""
        self.on_trading_stop_callback = callback
    
    def set_ui_message_callback(self, callback: Callable):
        """Establece el callback para mensajes genéricos de la UI."""
        self.on_ui_message_callback = callback
    
    def set_get_ai_model_details_callback(self, callback: Callable):
        """Establece el callback para solicitar detalles del modelo de IA."""
        self.on_get_ai_model_details_callback = callback

    # Métodos para actualizar estadísticas
    
    def update_trading_stats(self, operation_result: Dict):
        """Actualiza las estadísticas de trading."""
        self.trading_stats['operations_count'] += 1
        self.trading_stats['last_operation_time'] = get_current_timestamp()
        
        if operation_result.get('success', False):
            self.trading_stats['successful_operations'] += 1
            profit = operation_result.get('net_profit_usdt', 0.0)
            self.trading_stats['total_profit_usdt'] += profit
    
    def get_connected_clients_count(self) -> int:
        """Retorna el número de clientes UI conectados."""
        return len(self.ui_clients)
    
    def is_trading_active(self) -> bool:
        """Retorna si el trading está activo."""
        return self.trading_active
