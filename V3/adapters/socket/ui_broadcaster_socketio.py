# Simos/V3/ui_broadcaster_socketio.py

import asyncio
import logging
import json
import urllib.parse
from typing import Dict, Any, Set, Optional, Callable
import socketio
from shared.config_v3 import UI_WEBSOCKET_URL
from shared.utils import get_current_timestamp

class UIBroadcaster:
    """Maneja la comunicación Socket.IO con la interfaz de usuario."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.UIBroadcaster')
        self.sio = socketio.AsyncServer(
            cors_allowed_origins="*",
            logger=False,
            engineio_logger=False
        )
        self.app = None
        self.server_task = None
        self.is_running = False
        
        # Callbacks para mensajes de la UI
        self.on_trading_start_callback: Optional[Callable] = None
        self.on_trading_stop_callback: Optional[Callable] = None
        self.on_ui_message_callback: Optional[Callable] = None
        self.on_get_ai_model_details_callback: Optional[Callable] = None
        self.on_train_ai_model_callback: Optional[Callable] = None
        self.on_test_ai_model_callback: Optional[Callable] = None
        self.on_start_ai_simulation_callback: Optional[Callable] = None
        self.on_get_latest_balance_callback: Optional[Callable] = None
        
        # Estado del trading
        self.trading_active = False
        self.trading_stats = {
            'operations_count': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None,
            'last_operation_time': None
        }
        
        # Configurar event handlers
        self._setup_event_handlers()
    
    def _setup_event_handlers(self):
        """Configura los manejadores de eventos de Socket.IO."""
        
        @self.sio.event
        async def connect(sid, environ):
            self.logger.info(f"Cliente UI conectado: {sid}")
            # Enviar estado inicial al cliente
            await self._send_initial_state(sid)

            # Enviar último balance cacheado al conectar
            if self.on_get_latest_balance_callback:
                try:
                    balance_data = self.on_get_latest_balance_callback()
                    if balance_data:
                        # Usar el método broadcast_balances_update para consistencia
                        await self.broadcast_balances_update(balance_data)
                        self.logger.info(f"Último balance enviado a {sid} en conexión.")
                except Exception as e:
                    self.logger.error(f"Error enviando el último balance en conexión: {e}")
        
        @self.sio.event
        async def disconnect(sid):
            self.logger.info(f"Cliente UI desconectado: {sid}")
        
        @self.sio.event
        async def start_trading(sid, data):
            """Maneja solicitud de inicio de trading."""
            self.logger.info(f"Solicitud de inicio de trading desde {sid}")
            await self._handle_start_trading(data or {})
        
        @self.sio.event
        async def stop_trading(sid, data):
            """Maneja solicitud de detención de trading."""
            self.logger.info(f"Solicitud de detención de trading desde {sid}")
            await self._handle_stop_trading(data or {})
        
        @self.sio.event
        async def get_trading_status(sid, data):
            """Envía el estado actual del trading."""
            await self._send_trading_status(sid)
        
        @self.sio.event
        async def get_ai_model_details(sid, data):
            """Solicita detalles del modelo de IA."""
            if self.on_get_ai_model_details_callback:
                await self.on_get_ai_model_details_callback()
        
        @self.sio.event
        async def train_ai_model(sid, data):
            """Solicita entrenamiento del modelo de IA."""
            self.logger.info(f"Solicitud de entrenamiento de IA desde {sid}: {data}")
            if self.on_train_ai_model_callback:
                await self.on_train_ai_model_callback(data or {})
        
        @self.sio.event
        async def test_ai_model(sid, data):
            """Solicita prueba del modelo de IA."""
            self.logger.info(f"Solicitud de prueba de IA desde {sid}: {data}")
            if self.on_test_ai_model_callback:
                await self.on_test_ai_model_callback(data or {})
        
        @self.sio.event
        async def start_ai_simulation(sid, data):
            """Solicita inicio de simulación de IA."""
            self.logger.info(f"Solicitud de simulación de IA desde {sid}: {data}")
            if self.on_start_ai_simulation_callback:
                await self.on_start_ai_simulation_callback(data or {})
        
        @self.sio.event
        async def ping(sid, data):
            """Responde a ping de la UI."""
            await self.sio.emit('pong', {
                'timestamp': get_current_timestamp()
            }, room=sid)
        
        @self.sio.event
        async def get_system_status(sid, data):
            """Envía el estado del sistema."""
            status = {
                'v3_running': self.is_running,
                'trading_active': self.trading_active,
                'connected_clients': len(self.sio.manager.rooms.get('/', {})),
                'timestamp': get_current_timestamp()
            }
            await self.sio.emit('system_status', status, room=sid)
    
    async def start_server(self):
        """Inicia el servidor Socket.IO para la UI."""
        try:
            # Extraer puerto de UI_WEBSOCKET_URL
            parsed_url = urllib.parse.urlparse(UI_WEBSOCKET_URL)
            port = parsed_url.port or 3001
            host = parsed_url.hostname or "0.0.0.0"  # Usar 0.0.0.0 para permitir conexiones externas
            
            self.logger.info(f"Iniciando servidor Socket.IO UI en {host}:{port}")
            
            # Crear aplicación ASGI simple
            from socketio import ASGIApp
            self.app = ASGIApp(self.sio)
            
            # Iniciar servidor usando uvicorn
            import uvicorn
            config = uvicorn.Config(
                app=self.app,
                host=host,
                port=port,
                log_level="warning"  # Reducir logs de uvicorn
            )
            server = uvicorn.Server(config)
            
            # Ejecutar servidor en tarea separada
            self.server_task = asyncio.create_task(server.serve())
            
            self.is_running = True
            self.logger.info(f"Servidor Socket.IO UI iniciado en http://{host}:{port}")
            
        except Exception as e:
            self.logger.error(f"Error iniciando servidor Socket.IO UI: {e}")
            raise
    
    async def stop_server(self):
        """Detiene el servidor Socket.IO."""
        if self.server_task:
            self.server_task.cancel()
            try:
                await self.server_task
            except asyncio.CancelledError:
                pass
            self.is_running = False
            self.logger.info("Servidor Socket.IO UI detenido")
    
    async def _send_initial_state(self, sid):
        """Envía el estado inicial a un cliente UI recién conectado."""
        initial_state = {
            "trading_active": self.trading_active,
            "trading_stats": self.trading_stats,
            "timestamp": get_current_timestamp()
        }
        
        try:
            await self.sio.emit('initial_state', initial_state, room=sid)
        except Exception as e:
            self.logger.error(f"Error enviando estado inicial: {e}")
    
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
    
    async def _send_trading_status(self, sid):
        """Envía el estado actual del trading a un cliente específico."""
        status_data = {
            "trading_active": self.trading_active,
            "trading_stats": self.trading_stats,
            "timestamp": get_current_timestamp()
        }
        
        try:
            await self.sio.emit('trading_status', status_data, room=sid)
        except Exception as e:
            self.logger.error(f"Error enviando estado de trading: {e}")
    
    # Métodos públicos para broadcasting
    
    async def broadcast_message(self, event_name: str, data: Dict):
        """Envía un mensaje a todos los clientes UI conectados."""
        try:
            await self.sio.emit(event_name, data)
            self.logger.debug(f"Mensaje '{event_name}' enviado a todos los clientes UI")
        except Exception as e:
            self.logger.error(f"Error enviando mensaje '{event_name}': {e}")
    
    async def broadcast_top20_data(self, top20_data: list):
        """Retransmite datos del top 20 a la UI."""
        await self.broadcast_message('top_20_data', {
            'data': top20_data,
            'timestamp': get_current_timestamp()
        })
        self.logger.debug(f"Top 20 data retransmitido a clientes UI")
    
    async def broadcast_balances_update(self, balance_data: Dict):
        """Retransmite actualizaciones de balance a la UI."""
        await self.broadcast_message('balances-update', {
            'data': balance_data,
            'timestamp': get_current_timestamp()
        })
        self.logger.debug(f"Balance update retransmitido a clientes UI")
    
    async def broadcast_operation_result(self, operation_data: Dict):
        """Envía el resultado de una operación a la UI."""
        await self.broadcast_message('operation_result', {
            'data': operation_data,
            'timestamp': get_current_timestamp()
        })
        self.logger.info(f"Resultado de operación enviado a UI: {operation_data.get('symbol', 'N/A')}")
    
    async def broadcast_trading_status_change(self, is_active: bool):
        """Notifica cambio en el estado del trading."""
        await self.broadcast_message('trading_status_change', {
            'trading_active': is_active,
            'trading_stats': self.trading_stats,
            'timestamp': get_current_timestamp()
        })
        self.logger.info(f"Estado de trading cambiado: {'ACTIVO' if is_active else 'INACTIVO'}")
    
    async def broadcast_log_message(self, level: str, message: str, data: Dict = None):
        """Envía un mensaje de log a la UI."""
        await self.broadcast_message('log_message', {
            'level': level,
            'message': message,
            'data': data,
            'timestamp': get_current_timestamp()
        })
    
    async def broadcast_ai_training_progress(self, progress_data: Dict):
        """Envía progreso de entrenamiento de IA a la UI."""
        await self.broadcast_message('ai_training_progress', {
            'data': progress_data,
            'timestamp': get_current_timestamp()
        })
    
    async def broadcast_ai_test_results(self, test_results: Dict):
        """Envía resultados de pruebas de IA a la UI."""
        await self.broadcast_message('ai_test_results', {
            'data': test_results,
            'timestamp': get_current_timestamp()
        })
    
    async def broadcast_ai_simulation_update(self, simulation_data: Dict):
        """Envía actualizaciones de simulación de IA a la UI."""
        await self.broadcast_message('ai_simulation_update', {
            'data': simulation_data,
            'timestamp': get_current_timestamp()
        })
    
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

    def set_train_ai_model_callback(self, callback: Callable):
        """Establece el callback para la solicitud de entrenamiento del modelo de IA."""
        self.on_train_ai_model_callback = callback
    
    def set_test_ai_model_callback(self, callback: Callable):
        """Establece el callback para la solicitud de prueba del modelo de IA."""
        self.on_test_ai_model_callback = callback
    
    def set_start_ai_simulation_callback(self, callback: Callable):
        """Establece el callback para la solicitud de simulación de IA."""
        self.on_start_ai_simulation_callback = callback

    def set_get_latest_balance_callback(self, callback: Callable):
        """Establece el callback para obtener el último balance cacheado."""
        self.on_get_latest_balance_callback = callback

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
        return len(self.sio.manager.rooms.get('/', {}))
    
    def is_trading_active(self) -> bool:
        """Retorna si el trading está activo."""
        return self.trading_active
    
    def is_server_running(self) -> bool:
        """Retorna si el servidor está corriendo."""
        return self.is_running

