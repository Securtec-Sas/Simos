# Simos/V3/ui_broadcaster.py (Merged with socketio)

import asyncio
import logging
import json
import urllib.parse
from typing import Dict, Any, Optional, Callable
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

        # Callbacks
        self.on_trading_start_callback: Optional[Callable] = None
        self.on_trading_stop_callback: Optional[Callable] = None
        self.on_ui_message_callback: Optional[Callable] = None
        self.on_get_ai_model_details_callback: Optional[Callable] = None
        self.on_train_ai_model_callback: Optional[Callable] = None
        self.on_test_ai_model_callback: Optional[Callable] = None
        self.on_start_ai_simulation_callback: Optional[Callable] = None
        self.on_get_latest_balance_callback: Optional[Callable] = None
        self.on_get_training_status_callback: Optional[Callable] = None

        # State
        self.trading_active = False
        self.trading_stats = {
            'operations_count': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None,
            'last_operation_time': None
        }
        self.training_status = "idle"
        self.training_progress = 0
        self.training_filepath = None

        self._setup_event_handlers()

    def _setup_event_handlers(self):
        @self.sio.event
        async def connect(sid, environ):
            self.logger.info(f"Cliente UI conectado: {sid}")
            await self._send_initial_state(sid)
            if self.on_get_latest_balance_callback:
                balance_data = self.on_get_latest_balance_callback()
                if balance_data:
                    await self.broadcast_balances_update(balance_data)
            if self.on_get_training_status_callback:
                status, progress, filepath = self.on_get_training_status_callback()
                await self.sio.emit('training_status', {'status': status, 'progress': progress, 'filepath': filepath}, room=sid)

        @self.sio.event
        async def disconnect(sid):
            self.logger.info(f"Cliente UI desconectado: {sid}")

        @self.sio.event
        async def ui_message(sid, data):
            if self.on_ui_message_callback:
                await self.on_ui_message_callback(data.get('type'), data.get('payload', {}))

        @self.sio.event
        async def get_training_status(sid, data):
            if self.on_get_training_status_callback:
                status, progress, filepath = self.on_get_training_status_callback()
                await self.sio.emit('training_status', {'status': status, 'progress': progress, 'filepath': filepath}, room=sid)

    async def start_server(self):
        try:
            parsed_url = urllib.parse.urlparse(UI_WEBSOCKET_URL)
            port = parsed_url.port or 3001
            host = parsed_url.hostname or "0.0.0.0"
            self.logger.info(f"Iniciando servidor Socket.IO UI en {host}:{port}")
            from socketio import ASGIApp
            self.app = ASGIApp(self.sio)
            import uvicorn
            config = uvicorn.Config(app=self.app, host=host, port=port, log_level="warning")
            server = uvicorn.Server(config)
            self.server_task = asyncio.create_task(server.serve())
            self.is_running = True
            self.logger.info(f"Servidor Socket.IO UI iniciado en http://{host}:{port}")
        except Exception as e:
            self.logger.error(f"Error iniciando servidor Socket.IO UI: {e}")
            raise

    async def stop_server(self):
        if self.server_task:
            self.server_task.cancel()
            try:
                await self.server_task
            except asyncio.CancelledError:
                pass
            self.is_running = False
            self.logger.info("Servidor Socket.IO UI detenido")

    async def _send_initial_state(self, sid):
        initial_state = {
            "trading_active": self.trading_active,
            "trading_stats": self.trading_stats,
            "timestamp": get_current_timestamp()
        }
        await self.sio.emit('initial_state', initial_state, room=sid)

    async def broadcast_message(self, event_name: str, data: Dict):
        await self.sio.emit(event_name, data)

    async def broadcast_top20_data(self, top20_data: list):
        await self.broadcast_message('top_20_data', {'data': top20_data, 'timestamp': get_current_timestamp()})

    async def broadcast_balances_update(self, balance_data: Dict):
        await self.broadcast_message('balance_update', {'payload': balance_data, 'timestamp': get_current_timestamp()})

    async def broadcast_trading_status_change(self, is_active: bool):
        self.trading_active = is_active
        await self.broadcast_message('trading_status_change', {'trading_active': is_active, 'trading_stats': self.trading_stats, 'timestamp': get_current_timestamp()})

    async def broadcast_log_message(self, level: str, message: str, data: Dict = None):
        await self.broadcast_message('log_message', {'level': level, 'message': message, 'data': data, 'timestamp': get_current_timestamp()})

    async def broadcast_training_progress(self, progress: int, completed: bool, filepath: Optional[str] = None):
        self.update_training_status("training" if not completed else "completed", progress, filepath)
        await self.broadcast_message('training_progress', {'progress': progress, 'completed': completed, 'filepath': filepath})

    async def broadcast_training_complete(self, results: Dict):
        self.update_training_status("completed", 100, self.training_filepath)
        await self.broadcast_message('training_complete', {'payload': results})

    async def broadcast_training_error(self, error_message: str):
        self.update_training_status("error", 0, self.training_filepath)
        await self.broadcast_message('training_error', {'payload': {"message": error_message}})

    # Callback setters
    def set_trading_start_callback(self, callback: Callable): self.on_trading_start_callback = callback
    def set_trading_stop_callback(self, callback: Callable): self.on_trading_stop_callback = callback
    def set_ui_message_callback(self, callback: Callable): self.on_ui_message_callback = callback
    def set_get_ai_model_details_callback(self, callback: Callable): self.on_get_ai_model_details_callback = callback
    def set_train_ai_model_callback(self, callback: Callable): self.on_train_ai_model_callback = callback
    def set_get_latest_balance_callback(self, callback: Callable): self.on_get_latest_balance_callback = callback
    def set_get_training_status_callback(self, callback: Callable): self.on_get_training_status_callback = callback

    # State management
    def update_trading_stats(self, operation_result: Dict):
        self.trading_stats["operations_count"] += 1
        self.trading_stats["last_operation_time"] = get_current_timestamp()
        if operation_result.get("success", False):
            self.trading_stats["successful_operations"] += 1
            profit = operation_result.get("net_profit_usdt", 0.0)
            self.trading_stats["total_profit_usdt"] += profit

    def update_training_status(self, status: str, progress: int, filepath: Optional[str] = None):
        self.training_status = status
        self.training_progress = progress
        self.training_filepath = filepath

    def get_training_status(self): return self.training_status, self.training_progress, self.training_filepath
    def get_connected_clients_count(self) -> int: return len(self.sio.manager.rooms.get('/', {}))
    def is_trading_active(self) -> bool: return self.trading_active
    def is_server_running(self) -> bool: return self.is_running
