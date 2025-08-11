# Simos/V3/ui_broadcaster.py

import asyncio
import logging
import json
import urllib.parse
from typing import Dict, Any, Set, Optional, Callable
import websockets
from websockets.exceptions import ConnectionClosed
from shared.config_v3 import UI_WEBSOCKET_URL
from shared.utils import get_current_timestamp

class UIBroadcaster:
    """Maneja la comunicación WebSocket con la interfaz de usuario."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.UIBroadcaster')
        self.ui_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.server = None
        self.is_running = False
        
        # Cache para evitar envío de datos vacíos
        self.last_valid_top20_data = None
        self.last_valid_balance_data = None
        self.last_top20_timestamp = None
        self.last_balance_timestamp = None
        
        # Cache para datos del modelo AI
        self.last_valid_ai_model_data = None
        self.last_ai_model_timestamp = None
        
        # Callbacks para mensajes de la UI
        self.on_trading_start_callback: Optional[Callable] = None
        self.on_trading_stop_callback: Optional[Callable] = None
        self.on_ui_message_callback: Optional[Callable] = None
        self.on_train_ai_model_callback: Optional[Callable] = None
        self.on_test_ai_model_callback: Optional[Callable] = None
        self.get_latest_balance_callback: Optional[Callable] = None
        self.on_get_training_status_callback: Optional[Callable] = None
        self.on_get_test_status_callback: Optional[Callable] = None
        self.get_ai_model_details_callback: Optional[Callable] = None
        
        # Estado del trading
        self.trading_active = False
        self.trading_stats = {
            'operations_count': 0,
            'successful_operations': 0,
            'total_profit_usdt': 0.0,
            'start_time': None,
            'last_operation_time': None
        }
    
    async def initialize(self):
        """Inicializa el broadcaster UI."""
        try:
            await self.start_server()
            self.logger.info("UIBroadcaster inicializado correctamente")
        except Exception as e:
            self.logger.error(f"Error inicializando UIBroadcaster: {e}")
            raise
    
    async def start_server(self):
        """Inicia el servidor WebSocket para la UI."""
        try:
            # Configurar puerto y host
            port = 3002
            host = "0.0.0.0"  # Permitir conexiones desde cualquier IP
            
            self.logger.info(f"Iniciando servidor WebSocket UI en {host}:{port}")
            
            self.server = await websockets.serve(
                self._handle_ui_client,
                host,
                port,
                ping_interval=30,  # Envía un ping cada 30 segundos
                ping_timeout=20,   # Espera 20 segundos por el pong
                close_timeout=35,  # Tiempo para cerrar la conexión
                max_size=2**20,    # 1MB max message size
                max_queue=32       # Max queue size
            )
            
            self.is_running = True
            self.logger.info(f"Servidor WebSocket UI iniciado en ws://{host}:{port}")
            
            # Iniciar tarea de limpieza periódica
            asyncio.create_task(self._periodic_cleanup())
            
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
        
        # Verificar si ya existe una conexión desde la misma IP
        existing_connections = [
            client for client in self.ui_clients
            if hasattr(client, 'remote_address') and
            client.remote_address[0] == websocket.remote_address[0]
        ]
        
        if existing_connections:
            self.logger.warning(f"Detectada conexión duplicada desde {client_address}. "
                              f"Conexiones existentes: {len(existing_connections)}")
            # Cerrar conexiones anteriores de la misma IP
            for old_client in existing_connections:
                try:
                    await old_client.close(code=1000, reason="Nueva conexión desde la misma IP")
                    self.ui_clients.discard(old_client)
                    self.logger.info(f"Conexión anterior cerrada: {old_client.remote_address[0]}:{old_client.remote_address[1]}")
                except Exception as e:
                    self.logger.error(f"Error cerrando conexión anterior: {e}")
        
        self.logger.info(f"Cliente UI conectado: {client_address} (path: {path}) - Total clientes: {len(self.ui_clients) + 1}")
        
        self.ui_clients.add(websocket)
        
        try:
            # Enviar solo estado inicial al conectarse
            await self._send_initial_state(websocket)
            await self.send_latest_top20(websocket)
            
            # Enviar datos del modelo AI si están disponibles
            await self.send_latest_ai_model_details(websocket)
            
            # Enviar balance una sola vez después de 2 segundos
            asyncio.create_task(self._send_delayed_balance(websocket))
            
            # Escuchar mensajes del cliente
            async for message in websocket:
                await self._process_ui_message(websocket, message)
                
        except ConnectionClosed:
            self.logger.info(f"Cliente UI desconectado: {client_address} - Total clientes: {len(self.ui_clients) - 1}")
        except Exception as e:
            self.logger.error(f"Error en cliente UI {client_address}: {e}")
        finally:
            self.ui_clients.discard(websocket)
            self.logger.debug(f"Cliente removido del conjunto: {client_address} - Total clientes: {len(self.ui_clients)}")
    
    async def _send_initial_state(self, websocket):
        """Envía el estado inicial a un cliente UI recién conectado."""
        initial_state = {
            "type": "initial_state",
            "payload": {
                "trading_active": self.trading_active,
                "trading_stats": self.trading_stats,
                "sebo_connection_status": True,  # Asumir conectado por defecto
                "v3_status": "running",
                "timestamp": get_current_timestamp()
            }
        }
        
        try:
            await websocket.send(json.dumps(initial_state))
            self.logger.debug(f"Estado inicial enviado a cliente UI")
        except Exception as e:
            self.logger.error(f"Error enviando estado inicial: {e}")
    
    async def _send_delayed_balance(self, websocket):
        """Envía el balance después de 2 segundos de la conexión inicial."""
        try:
            await asyncio.sleep(2)  # Esperar 2 segundos
            # Verificar que el websocket sigue conectado
            if websocket in self.ui_clients:
                await self.send_latest_balance(websocket)
                self.logger.debug("Balance inicial enviado después de 2 segundos")
        except Exception as e:
            self.logger.error(f"Error enviando balance inicial retrasado: {e}")
    
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
            elif message_type == 'get_system_status':
                await self._send_system_status(websocket)
            elif message_type == 'get_ai_model_details':
                await self.send_ai_model_details(websocket)
            elif message_type == 'get_latest_balance':
                await self.send_latest_balance(websocket)
            elif message_type == 'train_ai_model':
                if self.on_train_ai_model_callback:
                    await self.on_train_ai_model_callback(payload)
            elif message_type == 'start_ai_training':
                # Manejar específicamente el mensaje de inicio de entrenamiento
                if self.on_train_ai_model_callback:
                    self.logger.info(f"Iniciando entrenamiento de IA con payload: {payload}")
                    await self.on_train_ai_model_callback(payload)
                else:
                    self.logger.error("No hay callback configurado para entrenamiento de IA")
            elif message_type == 'start_ai_test':
                # Manejar específicamente el mensaje de inicio de pruebas
                if self.on_test_ai_model_callback:
                    self.logger.info(f"Iniciando pruebas de IA con payload: {payload}")
                    await self.on_test_ai_model_callback(payload)
                else:
                    self.logger.error("No hay callback configurado para pruebas de IA")
            elif message_type == 'get_training_status':
                await self._send_training_status_response(websocket)
            elif message_type == 'get_test_status':
                await self._send_test_status_response(websocket)
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
    
    async def _send_system_status(self, websocket):
        """Envía el estado del sistema a un cliente específico."""
        system_status = {
            "type": "system_status",
            "payload": {
                "v3_status": "running",
                "sebo_connection": True,
                "ui_clients_count": len(self.ui_clients),
                "trading_active": self.trading_active,
                "timestamp": get_current_timestamp()
            }
        }
        
        try:
            await websocket.send(json.dumps(system_status))
        except Exception as e:
            self.logger.error(f"Error enviando estado del sistema: {e}")
    
    def _is_valid_data(self, data: Any, min_size: int = 1) -> bool:
        """Valida que los datos no estén vacíos."""
        try:
            if not data:
                return False
            
            if isinstance(data, list):
                return len(data) >= min_size and all(item is not None for item in data[:min_size])
            elif isinstance(data, dict):
                return len(data) > 0 and any(value is not None for value in data.values())
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error validando datos: {e}")
            return False
    
    # --- Métodos para configurar Callbacks ---

    def set_trading_start_callback(self, callback: Callable):
        """Establece el callback para la solicitud de inicio de trading."""
        self.on_trading_start_callback = callback

    def set_trading_stop_callback(self, callback: Callable):
        """Establece el callback para la solicitud de detención de trading."""
        self.on_trading_stop_callback = callback

    def set_train_ai_model_callback(self, callback: Callable):
        """Establece el callback para la solicitud de entrenamiento del modelo de IA."""
        self.on_train_ai_model_callback = callback

    def set_test_ai_model_callback(self, callback: Callable):
        """Establece el callback para la solicitud de pruebas del modelo de IA."""
        self.on_test_ai_model_callback = callback

    def set_get_training_status_callback(self, callback: Callable):
        """Establece el callback para la solicitud del estado de entrenamiento."""
        self.on_get_training_status_callback = callback

    def set_get_test_status_callback(self, callback: Callable):
        """Establece el callback para la solicitud del estado de pruebas."""
        self.on_get_test_status_callback = callback

    def set_get_ai_model_details_callback(self, callback: Callable):
        """Establece el callback para obtener los detalles del modelo de IA."""
        self.get_ai_model_details_callback = callback

    def set_get_latest_balance_callback(self, callback: Callable):
        """Establece el callback para obtener el último balance."""
        self.get_latest_balance_callback = callback

    def set_ui_message_callback(self, callback: Callable):
        """Establece el callback para mensajes genéricos de la UI."""
        self.on_ui_message_callback = callback

    # Métodos públicos para broadcasting
    
    async def broadcast_message(self, message_data: Dict):
        """Envía un mensaje a todos los clientes UI conectados."""
        if not self.ui_clients:
            self.logger.debug("No hay clientes UI conectados para enviar mensaje")
            return
        
        message_json = json.dumps(message_data)
        disconnected_clients = set()
        successful_sends = 0
        
        for client in self.ui_clients.copy():  # Usar copia para evitar modificación durante iteración
            try:
                if client.open:  # Verificar que la conexión esté abierta
                    await client.send(message_json)
                    successful_sends += 1
                else:
                    disconnected_clients.add(client)
            except ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                self.logger.error(f"Error enviando mensaje a cliente UI: {e}")
                disconnected_clients.add(client)
        
        # Remover clientes desconectados
        for client in disconnected_clients:
            self.ui_clients.discard(client)
        
        if disconnected_clients:
            self.logger.info(f"Removidos {len(disconnected_clients)} clientes desconectados. "
                           f"Mensajes enviados exitosamente: {successful_sends}")
        else:
            self.logger.debug(f"Mensaje enviado a {successful_sends} clientes UI")
    
    async def broadcast_top20_data(self, top20_data: list):
        """Retransmite datos del Top 20 a la UI solo si son válidos y han cambiado."""
        # Validar que los datos no estén vacíos
        if not self._is_valid_data(top20_data, min_size=1):
            self.logger.debug("Datos Top 20 vacíos o inválidos, no se envían a la UI")
            return
        
        # Verificar si los datos han cambiado significativamente
        if self.last_valid_top20_data:
            # Comparación simple para evitar envíos innecesarios
            if len(top20_data) == len(self.last_valid_top20_data):
                # Si el tamaño es igual, verificar algunos elementos clave
                same_data = True
                for i in range(min(3, len(top20_data))):
                    if (top20_data[i].get('symbol') != self.last_valid_top20_data[i].get('symbol') or
                        abs(top20_data[i].get('promedio', 0) - self.last_valid_top20_data[i].get('promedio', 0)) > 0.01):
                        same_data = False
                        break
                
                if same_data:
                    self.logger.debug("Datos Top 20 sin cambios significativos, no se reenvían")
                    return
        
        # Actualizar cache con datos válidos
        self.last_valid_top20_data = top20_data
        self.last_top20_timestamp = get_current_timestamp()
        
        message = {
            "type": "top20_data",
            "payload": top20_data,
            "timestamp": self.last_top20_timestamp
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Top 20 data válido retransmitido a {len(self.ui_clients)} clientes UI ({len(top20_data)} elementos)")
    
    async def broadcast_balance_update(self, balance_data: Dict):
        """Retransmite actualizaciones de balance a la UI solo si son válidas y han cambiado."""
        # Validar que los datos no estén vacíos
        if not self._is_valid_data(balance_data):
            self.logger.debug("Datos de balance vacíos o inválidos, no se envían a la UI")
            return
        
        # Verificar si los datos han cambiado
        if self.last_valid_balance_data:
            # Comparación de campos clave
            current_total = balance_data.get('total_usdt', 0)
            last_total = self.last_valid_balance_data.get('total_usdt', 0)
            
            if abs(current_total - last_total) < 0.01:  # Cambio menor a 1 centavo
                self.logger.debug("Balance sin cambios significativos, no se reenvía")
                return
        
        # Actualizar cache con datos válidos
        self.last_valid_balance_data = balance_data
        self.last_balance_timestamp = get_current_timestamp()
        
        message = {
            "type": "balance_update",
            "payload": balance_data,
            "timestamp": self.last_balance_timestamp
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Balance update válido retransmitido a {len(self.ui_clients)} clientes UI")
    
    async def send_operation_result(self, operation_data: Dict):
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
    
    async def send_log_message(self, level: str, message: str, data: Dict = None):
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

    async def send_ai_model_details(self, websocket=None):
        """Envía los detalles del modelo de IA a un cliente específico o a todos."""
        try:
            model_info = {
                "model_loaded": False,
                "model_accuracy": 0.0,
                "training_date": None,
                "features_count": 0,
                "status": "No model loaded"
            }
            
            if self.get_ai_model_details_callback:
                try:
                    # Intentar llamar al callback - puede ser async o sync
                    callback_info = self.get_ai_model_details_callback()
                    
                    # Si es una corrutina, hacer await
                    if hasattr(callback_info, '__await__'):
                        callback_info = await callback_info
                    
                    if self._is_valid_data(callback_info):
                        model_info.update(callback_info)
                        # Actualizar cache con datos válidos
                        self.last_valid_ai_model_data = model_info
                        self.last_ai_model_timestamp = get_current_timestamp()
                        self.logger.debug(f"Datos del modelo AI obtenidos del callback: {model_info}")
                    else:
                        self.logger.debug("Callback del modelo AI devolvió datos inválidos")
                        
                except Exception as e:
                    self.logger.error(f"Error llamando callback del modelo AI: {e}")
            else:
                self.logger.debug("No hay callback configurado para obtener detalles del modelo AI")
            
            message = {
                "type": "ai_model_details",
                "payload": model_info,
                "timestamp": self.last_ai_model_timestamp or get_current_timestamp()
            }
            
            if websocket:
                await websocket.send(json.dumps(message))
                self.logger.debug("Detalles del modelo AI enviados a cliente específico")
            else:
                await self.broadcast_message(message)
                self.logger.debug("Detalles del modelo AI enviados a todos los clientes")
                
        except Exception as e:
            self.logger.error(f"Error enviando detalles del modelo de IA: {e}")

    async def send_latest_ai_model_details(self, websocket=None):
        """Envía los últimos datos del modelo AI cacheados a un cliente específico o a todos."""
        try:
            if self.last_valid_ai_model_data:
                message = {
                    "type": "ai_model_details",
                    "payload": self.last_valid_ai_model_data,
                    "timestamp": self.last_ai_model_timestamp or get_current_timestamp()
                }
                
                if websocket:
                    await websocket.send(json.dumps(message))
                    self.logger.debug("Datos del modelo AI cacheados enviados a cliente específico")
                else:
                    await self.broadcast_message(message)
                    self.logger.debug("Datos del modelo AI cacheados enviados a todos los clientes")
            else:
                # Si no hay datos cacheados, intentar obtenerlos
                await self.send_ai_model_details(websocket)
                
        except Exception as e:
            self.logger.error(f"Error enviando los últimos datos del modelo AI: {e}")

    async def send_latest_balance(self, websocket=None):
        """Envía el último balance cacheado a un cliente específico o a todos."""
        try:
            balance_data = None
            
            # Usar cache si está disponible
            if self.last_valid_balance_data:
                balance_data = self.last_valid_balance_data
            # Si no hay cache, intentar obtener desde callback
            elif self.get_latest_balance_callback:
                callback_balance = await self.get_latest_balance_callback()
                if self._is_valid_data(callback_balance):
                    balance_data = callback_balance
                    self.last_valid_balance_data = balance_data
                    self.last_balance_timestamp = get_current_timestamp()
            
            if balance_data:
                message = {
                    "type": "balance_update",
                    "payload": balance_data,
                    "timestamp": self.last_balance_timestamp or get_current_timestamp()
                }
                
                if websocket:
                    await websocket.send(json.dumps(message))
                else:
                    await self.broadcast_message(message)
            else:
                self.logger.debug("No hay datos de balance disponibles para enviar")
                
        except Exception as e:
            self.logger.error(f"Error enviando el último balance: {e}")

    async def send_latest_top20(self, websocket=None):
        """Envía los últimos datos del top 20 cacheados a un cliente específico o a todos."""
        try:
            if self.last_valid_top20_data:
                message = {
                    "type": "top20_data",
                    "payload": self.last_valid_top20_data,
                    "timestamp": self.last_top20_timestamp or get_current_timestamp()
                }
                
                if websocket:
                    await websocket.send(json.dumps(message))
                else:
                    await self.broadcast_message(message)
            else:
                self.logger.debug("No hay datos Top 20 cacheados para enviar")
                
        except Exception as e:
            self.logger.error(f"Error enviando los últimos datos Top 20: {e}")
    
    async def send_heartbeat(self):
        """Envía un heartbeat a todos los clientes conectados."""
        if not self.ui_clients:
            return
            
        heartbeat_message = {
            "type": "heartbeat",
            "payload": {
                "timestamp": get_current_timestamp(),
                "clients_count": len(self.ui_clients),
                "server_status": "running"
            }
        }
        
        await self.broadcast_message(heartbeat_message)
    
    async def send_csv_creation_result(self, result: Dict):
        """Envía el resultado de la creación de CSV a la UI."""
        message = {
            "type": "csv_creation_result",
            "payload": result,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
    
    async def send_training_result(self, result: Dict):
        """Envía el resultado del entrenamiento a la UI."""
        message = {
            "type": "training_result",
            "payload": result,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
    
    async def send_simulation_result(self, result: Dict):
        """Envía el resultado de la simulación a la UI."""
        message = {
            "type": "simulation_result",
            "payload": result,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
    
    async def broadcast_training_progress(self, progress: float, completed: bool, filepath: str = None):
        """Envía el progreso del entrenamiento a la UI."""
        status = "COMPLETED" if completed else ("IN_PROGRESS" if progress > 0 else "STARTING")
        
        message = {
            "type": "ai_training_update",
            "payload": {
                "progress": progress,
                "status": status,
                "filepath": filepath,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Progreso de entrenamiento enviado: {progress}% - {status}")
    
    async def broadcast_training_complete(self, results: Dict, filepath: str = None):
        """Envía el resultado del entrenamiento completado a la UI."""
        message = {
            "type": "ai_training_update",
            "payload": {
                "progress": 100,
                "status": "COMPLETED",
                "results": results,
                "filepath": filepath,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Entrenamiento completado - resultado enviado a UI: {filepath}")
        
        # Actualizar datos del modelo AI después de completar entrenamiento
        try:
            await self.send_ai_model_details()
            self.logger.debug("Datos del modelo AI actualizados después del entrenamiento")
        except Exception as e:
            self.logger.error(f"Error actualizando datos del modelo AI después del entrenamiento: {e}")
    
    async def broadcast_training_error(self, error_message: str, filepath: str = None):
        """Envía un error de entrenamiento a la UI."""
        message = {
            "type": "ai_training_update",
            "payload": {
                "progress": 0,
                "status": "FAILED",
                "error": error_message,
                "filepath": filepath,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.error(f"Error de entrenamiento enviado a UI: {error_message} - Archivo: {filepath}")
    
    async def broadcast_test_progress(self, progress: float, completed: bool, filepath: str = None):
        """Envía el progreso de las pruebas a la UI."""
        status = "COMPLETED" if completed else ("IN_PROGRESS" if progress > 0 else "STARTING")
        
        message = {
            "type": "ai_test_update",
            "payload": {
                "progress": progress,
                "status": status,
                "filepath": filepath,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Progreso de pruebas enviado: {progress}% - {status}")
    
    async def broadcast_test_complete(self, results: Dict):
        """Envía el resultado de las pruebas completadas a la UI."""
        message = {
            "type": "ai_test_update",
            "payload": {
                "progress": 100,
                "status": "COMPLETED",
                "results": results,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info("Pruebas completadas - resultado enviado a UI")
    
    async def broadcast_test_error(self, error_message: str):
        """Envía un error de pruebas a la UI."""
        message = {
            "type": "ai_test_update",
            "payload": {
                "progress": 0,
                "status": "FAILED",
                "error": error_message,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.error(f"Error de pruebas enviado a UI: {error_message}")
    
    def set_callbacks(self, **callbacks):
        """Configura los callbacks para diferentes eventos."""
        for callback_name, callback_func in callbacks.items():
            if hasattr(self, callback_name):
                setattr(self, callback_name, callback_func)
                self.logger.debug(f"Callback configurado: {callback_name}")
    
    async def cleanup(self):
        """Limpia recursos antes del cierre."""
        try:
            self.logger.info("Limpiando UIBroadcaster...")
            
            # Cerrar todas las conexiones de clientes
            if self.ui_clients:
                close_tasks = []
                for client in self.ui_clients.copy():
                    try:
                        if client.open:
                            close_tasks.append(client.close(code=1001, reason="Server shutdown"))
                    except Exception as e:
                        self.logger.error(f"Error preparando cierre de cliente: {e}")
                
                # Esperar a que se cierren todas las conexiones
                if close_tasks:
                    await asyncio.gather(*close_tasks, return_exceptions=True)
                
                self.ui_clients.clear()
            
            # Detener servidor
            await self.stop_server()
            
            self.logger.info("UIBroadcaster limpiado correctamente")
            
        except Exception as e:
            self.logger.error(f"Error en limpieza de UIBroadcaster: {e}")
    
    async def _periodic_cleanup(self):
        """Limpieza periódica de conexiones muertas."""
        while self.is_running:
            try:
                await asyncio.sleep(60)  # Ejecutar cada minuto
                
                if not self.ui_clients:
                    continue
                
                dead_clients = set()
                for client in self.ui_clients.copy():
                    try:
                        if not client.open:
                            dead_clients.add(client)
                        else:
                            # Enviar ping para verificar conexión
                            await client.ping()
                    except Exception:
                        dead_clients.add(client)
                
                if dead_clients:
                    for client in dead_clients:
                        self.ui_clients.discard(client)
                    self.logger.info(f"Limpieza periódica: removidos {len(dead_clients)} clientes muertos")
                
            except Exception as e:
                self.logger.error(f"Error en limpieza periódica: {e}")
    
    def get_connected_clients_count(self) -> int:
        """Retorna el número de clientes UI conectados."""
        return self.client_count

    @property
    def client_count(self) -> int:
        """Retorna el número de clientes conectados."""
        return len(self.ui_clients)
    
    @property
    def is_server_running(self) -> bool:
        """Retorna si el servidor está ejecutándose."""
        return self.is_running and self.server is not None


    async def broadcast_training_update(self, status: str, progress: float, filepath: str = None, results: Dict = None, error: str = None):
        """Envía actualizaciones de progreso y estado del entrenamiento a la UI."""
        message = {
            "type": "ai_training_update",
            "payload": {
                "status": status,
                "progress": progress,
                "filepath": filepath,
                "results": results,
                "error": error,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.debug(f"Actualización de entrenamiento enviada: {status} - {progress}% - {filepath}")
        
        # Si el entrenamiento se completó exitosamente, actualizar datos del modelo AI
        if status == "COMPLETED" and results:
            try:
                await self.send_ai_model_details()
                self.logger.debug("Datos del modelo AI actualizados después de completar entrenamiento")
            except Exception as e:
                self.logger.error(f"Error actualizando datos del modelo AI: {e}")

    async def _send_training_status_response(self, websocket):
        """Envía el estado actual del entrenamiento a un cliente específico."""
        try:
            training_status = {
                "status": "idle",
                "progress": 0,
                "filepath": None,
                "results": None,
                "error": None
            }
            
            # Obtener estado del entrenamiento desde el callback si está disponible
            if self.on_get_training_status_callback:
                try:
                    # Llamar al callback sin parámetros - no usar await ya que puede devolver tupla
                    status_data = self.on_get_training_status_callback()
                    if status_data:
                        # Si es una tupla (método legacy), convertir a diccionario
                        if isinstance(status_data, tuple) and len(status_data) >= 3:
                            in_progress, progress, filepath = status_data[:3]
                            training_status.update({
                                "status": "IN_PROGRESS" if in_progress else "idle",
                                "progress": progress,
                                "filepath": filepath
                            })
                        # Si es un diccionario (método nuevo), usar directamente
                        elif isinstance(status_data, dict):
                            training_status.update(status_data)
                except Exception as e:
                    self.logger.error(f"Error obteniendo estado de entrenamiento: {e}")
            
            message = {
                "type": "training_status",
                "payload": training_status,
                "timestamp": get_current_timestamp()
            }
            
            await websocket.send(json.dumps(message))
            self.logger.debug("Estado de entrenamiento enviado a cliente UI")
            
        except Exception as e:
            self.logger.error(f"Error enviando estado de entrenamiento: {e}")

    async def _send_test_status_response(self, websocket):
        """Envía el estado actual de las pruebas a un cliente específico."""
        try:
            test_status = {
                "status": "idle",
                "progress": 0,
                "filepath": None,
                "results": None,
                "error": None
            }
            
            # Obtener estado de las pruebas desde el callback si está disponible
            if self.on_get_test_status_callback:
                try:
                    # Llamar al callback sin parámetros - no usar await ya que puede devolver tupla
                    status_data = self.on_get_test_status_callback()
                    if status_data:
                        # Si es una tupla (método legacy), convertir a diccionario
                        if isinstance(status_data, tuple) and len(status_data) >= 3:
                            in_progress, progress, filepath = status_data[:3]
                            test_status.update({
                                "status": "IN_PROGRESS" if in_progress else "idle",
                                "progress": progress,
                                "filepath": filepath
                            })
                        # Si es un diccionario (método nuevo), usar directamente
                        elif isinstance(status_data, dict):
                            test_status.update(status_data)
                except Exception as e:
                    self.logger.error(f"Error obteniendo estado de pruebas: {e}")
            
            message = {
                "type": "test_status",
                "payload": test_status,
                "timestamp": get_current_timestamp()
            }
            
            await websocket.send(json.dumps(message))
            self.logger.debug("Estado de pruebas enviado a cliente UI")
            
        except Exception as e:
            self.logger.error(f"Error enviando estado de pruebas: {e}")


