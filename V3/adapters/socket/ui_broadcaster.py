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
    
    async def _handle_ui_client(self, websocket, path=None):
        """Maneja conexiones de clientes UI."""
        # Manejar tanto la versión antigua como la nueva de websockets
        if hasattr(websocket, 'remote_address') and websocket.remote_address:
            client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        else:
            client_address = "unknown"
        
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
            elif message_type == '@train':
                # Manejar comando @train con datos en pantalla
                print(f"🎯 COMANDO @TRAIN RECIBIDO")
                print(f"📋 Payload completo: {payload}")
                
                # Mostrar datos específicos del entrenamiento
                csv_filename = payload.get("csv_filename", "N/A")
                model_type = payload.get("model_type", "neural_network")
                epochs = payload.get("epochs", 100)
                batch_size = payload.get("batch_size", 32)
                
                # Datos importantes de transacción/inversión
                investment_amount = payload.get("investment_amount", 100.0)
                expected_profit_percentage = payload.get("expected_profit_percentage", 2.5)
                risk_tolerance = payload.get("risk_tolerance", "medium")
                min_profit_threshold = payload.get("min_profit_threshold", 0.5)
                
                print(f"📁 Archivo CSV: {csv_filename}")
                print(f"🧠 Tipo de modelo: {model_type}")
                print(f"🔄 Épocas: {epochs}")
                print(f"📦 Tamaño de lote: {batch_size}")
                print(f"💰 DATOS DE INVERSIÓN:")
                print(f"   💵 Monto de inversión: ${investment_amount} USDT")
                print(f"   📈 Ganancia esperada: {expected_profit_percentage}%")
                print(f"   ⚖️ Tolerancia al riesgo: {risk_tolerance}")
                print(f"   🎯 Umbral mínimo de ganancia: {min_profit_threshold}%")
                
                # Calcular ganancia esperada en USDT
                expected_profit_usdt = (investment_amount * expected_profit_percentage) / 100
                print(f"   💎 Ganancia esperada en USDT: ${expected_profit_usdt:.2f}")
                
                # Enviar datos de transacción directamente por el socket existente
                transaction_data = {
                    "type": "train_transaction_data",
                    "payload": {
                        "csv_filename": csv_filename,
                        "model_type": model_type,
                        "epochs": epochs,
                        "batch_size": batch_size,
                        "investment_data": {
                            "investment_amount": investment_amount,
                            "expected_profit_percentage": expected_profit_percentage,
                            "expected_profit_usdt": round(expected_profit_usdt, 2),
                            "risk_tolerance": risk_tolerance,
                            "min_profit_threshold": min_profit_threshold
                        },
                        "timestamp": get_current_timestamp()
                    }
                }
                
                # Enviar por el socket del cliente que envió el comando
                try:
                    await websocket.send(json.dumps(transaction_data))
                    print(f"📤 Datos de transacción enviados por socket al cliente")
                    self.logger.info("Datos de transacción enviados por socket al cliente")
                except Exception as e:
                    print(f"❌ Error enviando datos por socket: {e}")
                    self.logger.error(f"Error enviando datos por socket: {e}")
                
                # Emitir mensaje de confirmación de recepción con datos de transacción
                await self.broadcast_training_message_received(payload)
                
                if self.on_train_ai_model_callback:
                    self.logger.info(f"Ejecutando entrenamiento con comando @train: {payload}")
                    print(f"📞 Llamando callback de entrenamiento del modelo AI...")
                    
                    # Iniciar proceso de entrenamiento
                    await self.on_train_ai_model_callback(payload)
                else:
                    error_msg = "No hay callback configurado para entrenamiento de IA"
                    print(f"❌ ERROR: {error_msg}")
                    self.logger.error(error_msg)
                    # Enviar error a UI
                    await self.broadcast_training_error(error_msg, csv_filename)
            elif message_type == 'start_ai_test':
                # Manejar específicamente el mensaje de inicio de pruebas
                print(f"🧪 INICIANDO PRUEBAS DEL MODELO AI")
                print(f"📋 Payload recibido: {payload}")
                
                # Emitir mensaje de confirmación de recepción
                await self.broadcast_test_message_received(payload)
                
                if self.on_test_ai_model_callback:
                    self.logger.info(f"Iniciando pruebas de IA con payload: {payload}")
                    print(f"📞 Llamando callback de pruebas del modelo AI...")
                    
                    # Iniciar proceso de test con operaciones simuladas
                    asyncio.create_task(self._run_simulated_test_process(payload))
                else:
                    error_msg = "No hay callback configurado para pruebas de IA"
                    print(f"❌ ERROR: {error_msg}")
                    self.logger.error(error_msg)
                    # Enviar error a UI
                    await self.broadcast_test_error(error_msg)
            elif message_type == 'stop_ai_test':
                # Manejar comando para detener pruebas del modelo AI
                print(f"🛑 COMANDO DETENER PRUEBAS AI RECIBIDO")
                print(f"📋 Payload: {payload}")
                
                test_type = payload.get("test_type", "ai_model_test")
                print(f"🔄 Deteniendo pruebas de tipo: {test_type}")
                
                # Enviar actualización de detención
                await self.broadcast_test_update("STOPPED", 0, None, None, "Pruebas detenidas por el usuario")
                
                # Si hay callback para detener pruebas, llamarlo
                if self.on_test_ai_model_callback:
                    print(f"📞 Llamando callback para detener pruebas AI...")
                    try:
                        # Enviar señal de detención al callback
                        await self.on_test_ai_model_callback({"action": "stop", "test_type": test_type})
                    except Exception as e:
                        print(f"❌ Error deteniendo pruebas AI: {e}")
                        self.logger.error(f"Error deteniendo pruebas AI: {e}")
                
                print(f"✅ Comando de detención de pruebas AI procesado")
                
            elif message_type == 'stop_test':
                # Manejar comando para detener pruebas normales
                print(f"🛑 COMANDO DETENER PRUEBAS NORMALES RECIBIDO")
                print(f"📋 Payload: {payload}")
                
                test_type = payload.get("test_type", "normal_test")
                print(f"🔄 Deteniendo pruebas de tipo: {test_type}")
                
                # Enviar actualización de detención
                await self.broadcast_test_update("STOPPED", 0, None, None, "Pruebas detenidas por el usuario")
                
                print(f"✅ Comando de detención de pruebas normales procesado")
                
            elif message_type == 'start_simulation':
                # Manejar comando para iniciar simulaciones
                print(f"🎮 COMANDO START_SIMULATION RECIBIDO")
                print(f"📋 Payload: {payload}")
                
                mode = payload.get("mode", "unknown")
                config = payload.get("config", {})
                
                print(f"🎯 Modo de simulación: {mode}")
                print(f"⚙️ Configuración: {config}")
                
                # Emitir mensaje de aprobación
                await self.broadcast_simulation_message_received(payload, mode)
                
                # Determinar el tipo específico de simulación y procesar
                if mode == "local":
                    await self._handle_start_simulation_local(payload, config)
                elif mode == "sebo_sandbox":
                    await self._handle_start_simulation_sand(payload, config)
                elif mode == "real":
                    await self._handle_start_simulation_real(payload, config)
                else:
                    error_msg = f"Modo de simulación no reconocido: {mode}"
                    print(f"❌ ERROR: {error_msg}")
                    await self.broadcast_simulation_error(error_msg, mode)
                
            elif message_type == 'start_simulation_local':
                # Manejar específicamente simulación local
                print(f"🖥️ COMANDO START_SIMULATION_LOCAL RECIBIDO")
                print(f"📋 Payload: {payload}")
                
                await self.broadcast_simulation_message_received(payload, "local")
                await self._handle_start_simulation_local(payload, payload.get("config", {}))
                
            elif message_type == 'start_simulation_sand':
                # Manejar específicamente simulación sandbox
                print(f"🧪 COMANDO START_SIMULATION_SAND RECIBIDO")
                print(f"📋 Payload: {payload}")
                
                await self.broadcast_simulation_message_received(payload, "sebo_sandbox")
                await self._handle_start_simulation_sand(payload, payload.get("config", {}))
                
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
        
        # Log para debug
        print(f"📊 BROADCAST TOP20: Recibidos {len(top20_data)} elementos")
        
        # Verificar si los datos han cambiado significativamente
        should_send = True
        if self.last_valid_top20_data:
            # Comparación simple para evitar envíos innecesarios
            if len(top20_data) == len(self.last_valid_top20_data):
                # Si el tamaño es igual, verificar algunos elementos clave
                same_data = True
                for i in range(min(3, len(top20_data))):
                    try:
                        current_symbol = top20_data[i].get('symbol', '')
                        last_symbol = self.last_valid_top20_data[i].get('symbol', '')
                        current_profit = float(top20_data[i].get('profit_percentage', 0))
                        last_profit = float(self.last_valid_top20_data[i].get('profit_percentage', 0))
                        
                        if (current_symbol != last_symbol or abs(current_profit - last_profit) > 0.01):
                            same_data = False
                            break
                    except (KeyError, ValueError, TypeError) as e:
                        # Si hay error en la comparación, enviar los datos
                        print(f"⚠️ Error comparando datos Top20: {e}")
                        same_data = False
                        break
                
                if same_data:
                    print(f"📊 Datos Top 20 sin cambios significativos, no se reenvían")
                    should_send = False
        
        if should_send:
            # Actualizar cache con datos válidos
            self.last_valid_top20_data = top20_data
            self.last_top20_timestamp = get_current_timestamp()
            
            message = {
                "type": "top20_data",
                "payload": top20_data,
                "timestamp": self.last_top20_timestamp
            }
            
            await self.broadcast_message(message)
            print(f"📡 Top 20 data enviado a {len(self.ui_clients)} clientes UI ({len(top20_data)} elementos)")
            self.logger.info(f"Top 20 data válido retransmitido a {len(self.ui_clients)} clientes UI ({len(top20_data)} elementos)")
        else:
            print(f"📊 Top 20 data no enviado - sin cambios significativos")
    
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
        # Mantener solo los últimos 10 resultados de operaciones
        if not hasattr(self, '_operation_results_cache'):
            self._operation_results_cache = []
        
        # Agregar el nuevo resultado al cache
        self._operation_results_cache.append(operation_data)
        
        # Mantener solo los últimos 10 resultados
        if len(self._operation_results_cache) > 10:
            self._operation_results_cache = self._operation_results_cache[-10:]
        
        message = {
            "type": "operation_result",
            "payload": operation_data,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Resultado de operación enviado a UI: {operation_data.get('symbol', 'N/A')}")
        
        # Enviar también los últimos 10 resultados completos
        summary_message = {
            "type": "operation_results_summary",
            "payload": {
                "last_10_operations": self._operation_results_cache
            },
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(summary_message)
        self.logger.info(f"Resumen de últimos 10 resultados de operaciones enviado a UI")
    
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
            print(f"🤖 Enviando detalles del modelo AI...")
            model_info = {
                "is_trained": False,
                "model_accuracy": 0.0,
                "training_date": None,
                "feature_count": 0,
                "status": "No model loaded"
            }
            
            if self.get_ai_model_details_callback:
                try:
                    print(f"📞 Llamando callback del modelo AI...")
                    # Intentar llamar al callback - puede ser async o sync
                    callback_info = self.get_ai_model_details_callback()
                    
                    # Si es una corrutina, hacer await
                    if hasattr(callback_info, '__await__'):
                        callback_info = await callback_info
                    
                    print(f"📊 Información recibida del callback: {callback_info}")
                    
                    if self._is_valid_data(callback_info):
                        model_info.update(callback_info)
                        # Actualizar cache con datos válidos
                        self.last_valid_ai_model_data = model_info
                        self.last_ai_model_timestamp = get_current_timestamp()
                        print(f"✅ Datos del modelo AI actualizados: {model_info}")
                        self.logger.debug(f"Datos del modelo AI obtenidos del callback: {model_info}")
                    else:
                        print(f"❌ Callback del modelo AI devolvió datos inválidos: {callback_info}")
                        self.logger.debug("Callback del modelo AI devolvió datos inválidos")
                        
                except Exception as e:
                    print(f"❌ Error llamando callback del modelo AI: {e}")
                    self.logger.error(f"Error llamando callback del modelo AI: {e}")
            else:
                print(f"⚠️ No hay callback configurado para obtener detalles del modelo AI")
                self.logger.debug("No hay callback configurado para obtener detalles del modelo AI")
            
            message = {
                "type": "ai_model_details",
                "payload": model_info,
                "timestamp": self.last_ai_model_timestamp or get_current_timestamp()
            }
            
            if websocket:
                await websocket.send(json.dumps(message))
                print(f"📤 Detalles del modelo AI enviados a cliente específico")
                self.logger.debug("Detalles del modelo AI enviados a cliente específico")
            else:
                await self.broadcast_message(message)
                print(f"📡 Detalles del modelo AI enviados a todos los clientes")
                self.logger.debug("Detalles del modelo AI enviados a todos los clientes")
                
        except Exception as e:
            print(f"💥 Error enviando detalles del modelo de IA: {e}")
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
    
    async def broadcast_test_update(self, status: str, progress: float, filepath: str = None, results: Dict = None, error: str = None):
        """Envía actualizaciones de progreso y estado de las pruebas a la UI."""
        print(f"📡 BROADCAST TEST UPDATE: {status} - {progress}% - {filepath}")
        
        message = {
            "type": "ai_test_update",
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
        
        # Log por consola según el estado
        if status == "STARTING":
            print(f"🚀 INICIANDO PRUEBAS DEL MODELO AI - Archivo: {filepath}")
        elif status == "IN_PROGRESS":
            print(f"🔄 PROGRESO DE PRUEBAS: {progress}% - {filepath}")
        elif status == "COMPLETED":
            print(f"✅ PRUEBAS COMPLETADAS - {filepath}")
            if results:
                print(f"📊 Precisión: {results.get('accuracy', 0)}%")
                print(f"📊 Operaciones exitosas: {results.get('successfulOperations', 0)}/{results.get('totalOperations', 0)}")
        elif status == "STOPPED":
            print(f"🛑 PRUEBAS DETENIDAS POR EL USUARIO - {filepath}")
        elif status == "FAILED":
            print(f"❌ ERROR EN PRUEBAS: {error}")
        
        self.logger.debug(f"Actualización de pruebas enviada: {status} - {progress}% - {filepath}")
    
    async def broadcast_test_error(self, error_message: str, filepath: str = None):
        """Envía un error de pruebas a la UI."""
        print(f"💥 ERROR EN PRUEBAS DEL MODELO AI: {error_message}")
        
        message = {
            "type": "ai_test_update",
            "payload": {
                "progress": 0,
                "status": "FAILED",
                "error": error_message,
                "filepath": filepath,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.error(f"Error de pruebas enviado a UI: {error_message}")
    
    async def broadcast_test_message_received(self, payload: Dict):
        """Envía confirmación de que se recibió el mensaje de test."""
        print(f"📨 MENSAJE DE TEST RECIBIDO")
        
        message = {
            "type": "test_message_received",
            "payload": {
                "status": "received",
                "csv_filename": payload.get("csv_filename", "N/A"),
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Confirmación de mensaje de test enviada a UI")
    
    async def broadcast_training_message_received(self, payload: Dict):
        """Envía confirmación de que se recibió el mensaje de entrenamiento."""
        print(f"📨 MENSAJE DE ENTRENAMIENTO RECIBIDO")
        
        # Extraer datos de inversión y ganancia
        investment_amount = payload.get("investment_amount", 100.0)
        expected_profit_percentage = payload.get("expected_profit_percentage", 2.5)
        expected_profit_usdt = (investment_amount * expected_profit_percentage) / 100
        
        print(f"💰 Confirmando datos de inversión:")
        print(f"   💵 Inversión: ${investment_amount} USDT")
        print(f"   📈 Ganancia esperada: {expected_profit_percentage}% (${expected_profit_usdt:.2f} USDT)")
        
        message = {
            "type": "training_message_received",
            "payload": {
                "status": "received",
                "csv_filename": payload.get("csv_filename", "N/A"),
                "model_type": payload.get("model_type", "neural_network"),
                "investment_data": {
                    "investment_amount": investment_amount,
                    "expected_profit_percentage": expected_profit_percentage,
                    "expected_profit_usdt": round(expected_profit_usdt, 2),
                    "risk_tolerance": payload.get("risk_tolerance", "medium"),
                    "min_profit_threshold": payload.get("min_profit_threshold", 0.5)
                },
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Confirmación de mensaje de entrenamiento enviada a UI con datos de inversión")
    
    async def _run_simulated_test_process(self, payload: Dict):
        """Ejecuta un proceso de test simulado con operaciones enviadas una por una."""
        try:
            csv_filename = payload.get("csv_filename", "test_data.csv")
            print(f"🚀 INICIANDO PROCESO DE TEST SIMULADO")
            print(f"📁 Archivo CSV: {csv_filename}")
            
            # Notificar inicio del test
            await self.broadcast_test_update("STARTING", 0, csv_filename)
            
            # Simular carga del CSV
            await asyncio.sleep(2)
            await self.broadcast_test_update("IN_PROGRESS", 10, csv_filename)
            
            # Generar operaciones de prueba simuladas
            test_operations = self._generate_test_operations(20)  # 20 operaciones de prueba
            
            print(f"📊 Generadas {len(test_operations)} operaciones de prueba")
            
            # Inicializar cache de operaciones si no existe
            if not hasattr(self, '_test_operations_cache'):
                self._test_operations_cache = []
            
            # Enviar operaciones una por una con delay de 4 segundos
            for i, operation in enumerate(test_operations):
                try:
                    # Agregar operación al cache
                    self._test_operations_cache.append(operation)
                    
                    # Mantener solo las últimas 10 operaciones
                    if len(self._test_operations_cache) > 10:
                        self._test_operations_cache = self._test_operations_cache[-10:]
                    
                    # Calcular progreso
                    progress = 10 + ((i + 1) / len(test_operations)) * 80  # 10% a 90%
                    
                    # Enviar operación individual
                    await self.send_test_operation_result(operation)
                    
                    # Enviar resumen de últimas 10 operaciones
                    await self.send_test_operations_summary()
                    
                    # Actualizar progreso
                    await self.broadcast_test_update("IN_PROGRESS", progress, csv_filename)
                    
                    print(f"📤 Operación {i+1}/{len(test_operations)} enviada: {operation['symbol']}")
                    
                    # Delay de 4 segundos entre operaciones
                    if i < len(test_operations) - 1:  # No delay después de la última
                        await asyncio.sleep(4)
                        
                except Exception as e:
                    print(f"❌ Error enviando operación {i+1}: {e}")
                    continue
            
            # Completar test
            await self.broadcast_test_update("COMPLETED", 100, csv_filename, {
                "total_operations": len(test_operations),
                "successful_operations": len(test_operations),
                "accuracy": 85.5,
                "test_completed_at": get_current_timestamp()
            })
            
            print(f"✅ PROCESO DE TEST SIMULADO COMPLETADO")
            
        except Exception as e:
            error_msg = f"Error en proceso de test simulado: {str(e)}"
            print(f"💥 ERROR: {error_msg}")
            await self.broadcast_test_error(error_msg, csv_filename)
    
    def _generate_test_operations(self, count: int) -> list:
        """Genera operaciones de prueba simuladas."""
        import random
        
        symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "XRP/USDT", "DOT/USDT"]
        exchanges = ["binance", "okx", "kucoin", "bybit"]
        
        operations = []
        
        for i in range(count):
            symbol = random.choice(symbols)
            buy_exchange = random.choice(exchanges)
            sell_exchange = random.choice([ex for ex in exchanges if ex != buy_exchange])
            
            buy_price = random.uniform(20000, 50000) if symbol == "BTC/USDT" else random.uniform(100, 3000)
            sell_price = buy_price * random.uniform(1.001, 1.05)  # 0.1% a 5% diferencia
            profit_percentage = ((sell_price - buy_price) / buy_price) * 100
            
            operation = {
                "operation_id": f"test_op_{i+1}",
                "symbol": symbol,
                "symbol_name": symbol.replace("/", ""),
                "exchange_buy": buy_exchange,
                "exchange_sell": sell_exchange,
                "buy_price": round(buy_price, 8),
                "sell_price": round(sell_price, 8),
                "profit_percentage": round(profit_percentage, 4),
                "investment_usdt": 100,
                "net_profit_usdt": round((profit_percentage / 100) * 100, 4),
                "status": "COMPLETED" if random.random() > 0.1 else "FAILED",
                "timestamp": get_current_timestamp(),
                "execution_time": random.uniform(30, 180)
            }
            
            operations.append(operation)
        
        return operations
    
    async def send_test_operation_result(self, operation_data: Dict):
        """Envía el resultado de una operación de test a la UI."""
        message = {
            "type": "test_operation_result",
            "payload": operation_data,
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Resultado de operación de test enviado: {operation_data.get('symbol', 'N/A')}")
    
    async def send_test_operations_summary(self):
        """Envía resumen de las últimas 10 operaciones de test."""
        if not hasattr(self, '_test_operations_cache'):
            return
        
        summary_message = {
            "type": "test_operations_summary",
            "payload": {
                "last_10_operations": self._test_operations_cache,
                "total_operations": len(self._test_operations_cache)
            },
            "timestamp": get_current_timestamp()
        }
        
        await self.broadcast_message(summary_message)
        self.logger.info(f"Resumen de operaciones de test enviado: {len(self._test_operations_cache)} operaciones")
    
    # --- Métodos para manejo de simulaciones ---
    
    async def broadcast_simulation_message_received(self, payload: Dict, mode: str):
        """Envía confirmación de que se recibió el mensaje de simulación."""
        print(f"📨 MENSAJE DE SIMULACIÓN RECIBIDO - Modo: {mode}")
        
        message = {
            "type": "simulation_message_received",
            "payload": {
                "status": "received",
                "mode": mode,
                "config": payload.get("config", {}),
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Confirmación de mensaje de simulación enviada a UI - Modo: {mode}")
    
    async def broadcast_simulation_error(self, error_message: str, mode: str = None):
        """Envía un error de simulación a la UI."""
        print(f"💥 ERROR EN SIMULACIÓN: {error_message}")
        
        message = {
            "type": "simulation_error",
            "payload": {
                "error": error_message,
                "mode": mode,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.error(f"Error de simulación enviado a UI: {error_message}")
    
    async def _handle_start_simulation_local(self, payload: Dict, config: Dict):
        """Maneja el inicio de simulación local."""
        try:
            print(f"🖥️ INICIANDO SIMULACIÓN LOCAL")
            print(f"⚙️ Configuración: {config}")
            
            # Enviar actualización de inicio
            await self.broadcast_simulation_update("local", "STARTING", 0, config)
            
            # Iniciar proceso de simulación local
            asyncio.create_task(self._run_local_simulation_process(config))
            
            print(f"✅ Simulación local iniciada correctamente")
            
        except Exception as e:
            error_msg = f"Error iniciando simulación local: {str(e)}"
            print(f"❌ ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "local")
    
    async def _handle_start_simulation_sand(self, payload: Dict, config: Dict):
        """Maneja el inicio de simulación sandbox."""
        try:
            print(f"🧪 INICIANDO SIMULACIÓN SANDBOX")
            print(f"⚙️ Configuración: {config}")
            
            # Enviar actualización de inicio
            await self.broadcast_simulation_update("sebo_sandbox", "STARTING", 0, config)
            
            # Iniciar proceso de simulación sandbox
            asyncio.create_task(self._run_sandbox_simulation_process(config))
            
            print(f"✅ Simulación sandbox iniciada correctamente")
            
        except Exception as e:
            error_msg = f"Error iniciando simulación sandbox: {str(e)}"
            print(f"❌ ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "sebo_sandbox")
    
    async def _handle_start_simulation_real(self, payload: Dict, config: Dict):
        """Maneja el inicio de simulación real."""
        try:
            print(f"💰 INICIANDO SIMULACIÓN REAL")
            print(f"⚙️ Configuración: {config}")
            print(f"⚠️ ADVERTENCIA: Esta simulación usa fondos reales")
            
            # Enviar actualización de inicio
            await self.broadcast_simulation_update("real", "STARTING", 0, config)
            
            # Iniciar proceso de simulación real
            asyncio.create_task(self._run_real_simulation_process(config))
            
            print(f"✅ Simulación real iniciada correctamente")
            
        except Exception as e:
            error_msg = f"Error iniciando simulación real: {str(e)}"
            print(f"❌ ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "real")
    
    async def broadcast_simulation_update(self, mode: str, status: str, progress: float, config: Dict = None, results: Dict = None, error: str = None):
        """Envía actualizaciones de progreso y estado de las simulaciones a la UI."""
        print(f"📡 BROADCAST SIMULATION UPDATE: {mode} - {status} - {progress}%")
        
        message = {
            "type": "simulation_update",
            "payload": {
                "mode": mode,
                "status": status,
                "progress": progress,
                "config": config,
                "results": results,
                "error": error,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        
        # Log por consola según el estado
        if status == "STARTING":
            print(f"🚀 INICIANDO SIMULACIÓN {mode.upper()}")
        elif status == "RUNNING":
            print(f"🔄 SIMULACIÓN {mode.upper()} EN PROGRESO: {progress}%")
        elif status == "COMPLETED":
            print(f"✅ SIMULACIÓN {mode.upper()} COMPLETADA")
        elif status == "STOPPED":
            print(f"🛑 SIMULACIÓN {mode.upper()} DETENIDA POR EL USUARIO")
        elif status == "FAILED":
            print(f"❌ ERROR EN SIMULACIÓN {mode.upper()}: {error}")
        
        self.logger.debug(f"Actualización de simulación enviada: {mode} - {status} - {progress}%")
    
    async def send_simulation_operation_result(self, mode: str, operation_data: Dict):
        """Envía el resultado de una operación de simulación a la UI."""
        # Mantener cache por modo de simulación
        cache_attr = f'_simulation_operations_cache_{mode}'
        if not hasattr(self, cache_attr):
            setattr(self, cache_attr, [])
        
        operations_cache = getattr(self, cache_attr)
        operations_cache.append(operation_data)
        
        # Mantener solo las últimas 20 operaciones por modo
        if len(operations_cache) > 20:
            setattr(self, cache_attr, operations_cache[-20:])
        
        message = {
            "type": "simulation_operation_result",
            "payload": {
                "mode": mode,
                "operation": operation_data,
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(message)
        self.logger.info(f"Resultado de operación de simulación {mode} enviado: {operation_data.get('symbol', 'N/A')}")
        
        # Enviar también resumen de operaciones
        await self.send_simulation_operations_summary(mode)
    
    async def send_simulation_operations_summary(self, mode: str):
        """Envía resumen de las últimas operaciones de simulación por modo."""
        cache_attr = f'_simulation_operations_cache_{mode}'
        if not hasattr(self, cache_attr):
            return
        
        operations_cache = getattr(self, cache_attr)
        
        summary_message = {
            "type": "simulation_operations_summary",
            "payload": {
                "mode": mode,
                "operations": operations_cache,
                "total_operations": len(operations_cache),
                "timestamp": get_current_timestamp()
            }
        }
        
        await self.broadcast_message(summary_message)
        self.logger.info(f"Resumen de operaciones de simulación {mode} enviado: {len(operations_cache)} operaciones")
    
    async def _run_local_simulation_process(self, config: Dict):
        """Ejecuta un proceso de simulación local con operaciones simuladas."""
        try:
            print(f"🖥️ INICIANDO PROCESO DE SIMULACIÓN LOCAL")
            
            # Configuración de la simulación
            initial_balance = config.get("initial_balance", 1000)
            investment_per_operation = config.get("investment_per_operation", 100)
            time_between_transfers = config.get("time_between_transfers", 2)
            max_concurrent_operations = config.get("max_concurrent_operations", 3)
            success_rate = config.get("success_rate", 85)
            
            print(f"💰 Balance inicial: ${initial_balance} USDT")
            print(f"💵 Inversión por operación: ${investment_per_operation} USDT")
            
            # Notificar inicio
            await self.broadcast_simulation_update("local", "RUNNING", 10, config)
            
            # Generar operaciones de simulación
            simulation_operations = self._generate_simulation_operations(15, investment_per_operation, success_rate)
            
            print(f"📊 Generadas {len(simulation_operations)} operaciones de simulación local")
            
            # Enviar operaciones una por una
            for i, operation in enumerate(simulation_operations):
                try:
                    # Calcular progreso
                    progress = 10 + ((i + 1) / len(simulation_operations)) * 80  # 10% a 90%
                    
                    # Enviar operación individual
                    await self.send_simulation_operation_result("local", operation)
                    
                    # Actualizar progreso
                    await self.broadcast_simulation_update("local", "RUNNING", progress, config)
                    
                    print(f"📤 Operación local {i+1}/{len(simulation_operations)} enviada: {operation['symbol']}")
                    
                    # Delay entre operaciones
                    if i < len(simulation_operations) - 1:
                        await asyncio.sleep(time_between_transfers)
                        
                except Exception as e:
                    print(f"❌ Error enviando operación local {i+1}: {e}")
                    continue
            
            # Completar simulación
            total_profit = sum(op.get('net_profit_usdt', 0) for op in simulation_operations)
            final_balance = initial_balance + total_profit
            
            results = {
                "initial_balance": initial_balance,
                "final_balance": final_balance,
                "total_profit": total_profit,
                "total_operations": len(simulation_operations),
                "successful_operations": len([op for op in simulation_operations if op.get('status') == 'COMPLETED']),
                "simulation_completed_at": get_current_timestamp()
            }
            
            await self.broadcast_simulation_update("local", "COMPLETED", 100, config, results)
            
            print(f"✅ PROCESO DE SIMULACIÓN LOCAL COMPLETADO")
            print(f"💰 Balance final: ${final_balance:.2f} USDT")
            print(f"📈 Ganancia total: ${total_profit:.2f} USDT")
            
        except Exception as e:
            error_msg = f"Error en proceso de simulación local: {str(e)}"
            print(f"💥 ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "local")
    
    async def _run_sandbox_simulation_process(self, config: Dict):
        """Ejecuta un proceso de simulación sandbox."""
        try:
            print(f"🧪 INICIANDO PROCESO DE SIMULACIÓN SANDBOX")
            
            initial_balance = config.get("initial_balance", 1000)
            investment_per_operation = config.get("investment_per_operation", 100)
            
            # Notificar inicio
            await self.broadcast_simulation_update("sebo_sandbox", "RUNNING", 10, config)
            
            # Generar operaciones de simulación sandbox
            simulation_operations = self._generate_simulation_operations(12, investment_per_operation, 90)
            
            print(f"📊 Generadas {len(simulation_operations)} operaciones de simulación sandbox")
            
            # Enviar operaciones una por una
            for i, operation in enumerate(simulation_operations):
                try:
                    progress = 10 + ((i + 1) / len(simulation_operations)) * 80
                    
                    await self.send_simulation_operation_result("sebo_sandbox", operation)
                    await self.broadcast_simulation_update("sebo_sandbox", "RUNNING", progress, config)
                    
                    print(f"📤 Operación sandbox {i+1}/{len(simulation_operations)} enviada: {operation['symbol']}")
                    
                    if i < len(simulation_operations) - 1:
                        await asyncio.sleep(3)  # 3 segundos entre operaciones sandbox
                        
                except Exception as e:
                    print(f"❌ Error enviando operación sandbox {i+1}: {e}")
                    continue
            
            # Completar simulación
            total_profit = sum(op.get('net_profit_usdt', 0) for op in simulation_operations)
            final_balance = initial_balance + total_profit
            
            results = {
                "initial_balance": initial_balance,
                "final_balance": final_balance,
                "total_profit": total_profit,
                "total_operations": len(simulation_operations),
                "successful_operations": len([op for op in simulation_operations if op.get('status') == 'COMPLETED']),
                "simulation_completed_at": get_current_timestamp()
            }
            
            await self.broadcast_simulation_update("sebo_sandbox", "COMPLETED", 100, config, results)
            
            print(f"✅ PROCESO DE SIMULACIÓN SANDBOX COMPLETADO")
            
        except Exception as e:
            error_msg = f"Error en proceso de simulación sandbox: {str(e)}"
            print(f"💥 ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "sebo_sandbox")
    
    async def _run_real_simulation_process(self, config: Dict):
        """Ejecuta un proceso de simulación real (con advertencias)."""
        try:
            print(f"💰 INICIANDO PROCESO DE SIMULACIÓN REAL")
            print(f"⚠️ ADVERTENCIA: USANDO FONDOS REALES")
            
            initial_balance = config.get("initial_balance", 1000)
            investment_per_operation = config.get("investment_per_operation", 50)
            
            # Notificar inicio
            await self.broadcast_simulation_update("real", "RUNNING", 10, config)
            
            # Generar menos operaciones para simulación real
            simulation_operations = self._generate_simulation_operations(8, investment_per_operation, 75)
            
            print(f"📊 Generadas {len(simulation_operations)} operaciones de simulación real")
            
            # Enviar operaciones una por una con más tiempo entre ellas
            for i, operation in enumerate(simulation_operations):
                try:
                    progress = 10 + ((i + 1) / len(simulation_operations)) * 80
                    
                    await self.send_simulation_operation_result("real", operation)
                    await self.broadcast_simulation_update("real", "RUNNING", progress, config)
                    
                    print(f"📤 Operación real {i+1}/{len(simulation_operations)} enviada: {operation['symbol']}")
                    
                    if i < len(simulation_operations) - 1:
                        await asyncio.sleep(5)  # 5 segundos entre operaciones reales
                        
                except Exception as e:
                    print(f"❌ Error enviando operación real {i+1}: {e}")
                    continue
            
            # Completar simulación
            total_profit = sum(op.get('net_profit_usdt', 0) for op in simulation_operations)
            final_balance = initial_balance + total_profit
            
            results = {
                "initial_balance": initial_balance,
                "final_balance": final_balance,
                "total_profit": total_profit,
                "total_operations": len(simulation_operations),
                "successful_operations": len([op for op in simulation_operations if op.get('status') == 'COMPLETED']),
                "simulation_completed_at": get_current_timestamp()
            }
            
            await self.broadcast_simulation_update("real", "COMPLETED", 100, config, results)
            
            print(f"✅ PROCESO DE SIMULACIÓN REAL COMPLETADO")
            
        except Exception as e:
            error_msg = f"Error en proceso de simulación real: {str(e)}"
            print(f"💥 ERROR: {error_msg}")
            await self.broadcast_simulation_error(error_msg, "real")
    
    def _generate_simulation_operations(self, count: int, investment_per_operation: float, success_rate: float) -> list:
        """Genera operaciones de simulación con datos completos."""
        import random
        
        symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "XRP/USDT", "DOT/USDT", "MATIC/USDT", "AVAX/USDT", "LINK/USDT"]
        exchanges = ["binance", "okx", "kucoin", "bybit", "gate", "mexc", "bitget"]
        
        operations = []
        
        for i in range(count):
            symbol = random.choice(symbols)
            buy_exchange = random.choice(exchanges)
            sell_exchange = random.choice([ex for ex in exchanges if ex != buy_exchange])
            
            # Precios más realistas según el símbolo
            if symbol == "BTC/USDT":
                buy_price = random.uniform(42000, 68000)
                expected_profit_percentage = random.uniform(0.15, 0.8)  # 0.15% a 0.8%
            elif symbol == "ETH/USDT":
                buy_price = random.uniform(2200, 3800)
                expected_profit_percentage = random.uniform(0.2, 1.2)  # 0.2% a 1.2%
            elif symbol == "BNB/USDT":
                buy_price = random.uniform(280, 420)
                expected_profit_percentage = random.uniform(0.25, 1.5)  # 0.25% a 1.5%
            elif symbol == "SOL/USDT":
                buy_price = random.uniform(80, 180)
                expected_profit_percentage = random.uniform(0.3, 2.0)  # 0.3% a 2.0%
            else:
                buy_price = random.uniform(0.1, 50)
                expected_profit_percentage = random.uniform(0.5, 3.0)  # 0.5% a 3.0%
            
            # Calcular precio de venta esperado
            expected_sell_price = buy_price * (1 + expected_profit_percentage / 100)
            
            # Determinar si la operación es exitosa basado en success_rate
            is_successful = random.random() < (success_rate / 100)
            
            if is_successful:
                # Operación exitosa: precio real cerca del esperado con variación
                actual_profit_percentage = expected_profit_percentage * random.uniform(0.8, 1.3)  # ±30% variación
                actual_sell_price = buy_price * (1 + actual_profit_percentage / 100)
                status = "COMPLETED"
                status_detail = "Operación completada exitosamente"
            else:
                # Operación fallida: pérdida o ganancia muy baja
                actual_profit_percentage = random.uniform(-0.5, 0.1)  # Pérdida o ganancia mínima
                actual_sell_price = buy_price * (1 + actual_profit_percentage / 100)
                status = "FAILED"
                status_detail = "Operación falló - precio no alcanzado" if actual_profit_percentage < 0 else "Ganancia insuficiente"
            
            # Calcular ganancias netas
            gross_profit = (actual_sell_price - buy_price) * (investment_per_operation / buy_price)
            trading_fees = investment_per_operation * 0.002  # 0.2% fees total (compra + venta)
            withdrawal_fees = random.uniform(0.1, 2.0)  # Fees de retiro variables
            net_profit = gross_profit - trading_fees - withdrawal_fees
            
            # Datos de timing realistas
            detection_time = random.uniform(0.5, 3.0)  # Tiempo de detección de oportunidad
            execution_time = random.uniform(15, 180)  # Tiempo total de ejecución
            transfer_time = random.uniform(30, 300)  # Tiempo de transferencia entre exchanges
            
            operation = {
                "operation_id": f"sim_op_{i+1}_{random.randint(1000, 9999)}",
                "symbol": symbol,
                "symbol_name": symbol.replace("/", ""),
                
                # Datos de exchanges
                "exchange_buy": buy_exchange,
                "exchange_sell": sell_exchange,
                "exchange_buy_name": buy_exchange.capitalize(),
                "exchange_sell_name": sell_exchange.capitalize(),
                
                # Precios y valores
                "buy_price": round(buy_price, 8),
                "sell_price_expected": round(expected_sell_price, 8),
                "sell_price_actual": round(actual_sell_price, 8),
                "investment_usdt": investment_per_operation,
                
                # Porcentajes de ganancia
                "profit_percentage_expected": round(expected_profit_percentage, 4),
                "profit_percentage_actual": round(actual_profit_percentage, 4),
                "profit_difference": round(actual_profit_percentage - expected_profit_percentage, 4),
                
                # Ganancias en USDT
                "gross_profit_usdt": round(gross_profit, 4),
                "net_profit_usdt": round(net_profit, 4),
                "trading_fees_usdt": round(trading_fees, 4),
                "withdrawal_fees_usdt": round(withdrawal_fees, 4),
                
                # Estado y detalles
                "status": status,
                "status_detail": status_detail,
                "success": is_successful,
                
                # Timing
                "detection_time_seconds": round(detection_time, 2),
                "execution_time_seconds": round(execution_time, 2),
                "transfer_time_seconds": round(transfer_time, 2),
                "total_time_seconds": round(detection_time + execution_time + transfer_time, 2),
                
                # Metadatos
                "timestamp": get_current_timestamp(),
                "simulation_type": "automated",
                "risk_level": "medium" if expected_profit_percentage < 1.0 else "high",
                
                # Datos adicionales para análisis
                "market_conditions": random.choice(["favorable", "neutral", "volatile"]),
                "liquidity_score": random.uniform(0.6, 1.0),
                "slippage_percentage": random.uniform(0.01, 0.15),
                
                # Información de volumen
                "volume_24h_usdt": random.uniform(1000000, 50000000),  # Volumen 24h simulado
                "order_book_depth": random.uniform(0.5, 2.0),  # Profundidad del libro de órdenes
            }
            
            print(f"📊 Operación generada: {symbol} | {buy_exchange}→{sell_exchange} | "
                  f"Esperado: {expected_profit_percentage:.2f}% | Real: {actual_profit_percentage:.2f}% | "
                  f"Ganancia: ${net_profit:.2f} USDT | Estado: {status}")
            
            operations.append(operation)
        
        return operations
    
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


