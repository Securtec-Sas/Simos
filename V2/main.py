# V2/main.py (anteriormente principal.py)
#
# Descripción General de Cambios Recientes (referente a la tarea de refactorización):
# 1. Flujo de Datos de Oportunidades:
#    - V2 recibe datos de oportunidades de arbitraje (top_20_data) desde el servicio Sebo vía Socket.IO.
#    - IMPORTANTE: V2 ya NO procesa estas oportunidades automáticamente para tomar decisiones de trading internas.
#    - En su lugar, V2 transmite la lista completa de 'top_20_data' directamente a cualquier cliente UI conectado.
#      La lógica de visualización, selección y posible inicio de operaciones recae ahora en la UI o en el modelo de IA (si es invocado por la UI).
#
# 2. Gestión de Balances:
#    - V2 ahora recibe actualizaciones de balance exclusivamente a través del evento de Socket.IO 'balances-update' emitido por Sebo.
#    - La solicitud periódica de balances vía HTTP que existía anteriormente ha sido eliminada.
#    - Los balances recibidos se almacenan en `app.latest_balances_from_sebo` y se transmiten a la UI.
#    - Es CRUCIAL que Sebo emita estos eventos 'balances-update' con la información completa y en el formato que V2 espera.
#
# 3. Modelo de IA (`model.py`):
#    - La clase `ArbitrageIntelligenceModel` ha sido refactorizada para ser una PLANTILLA o clase base.
#    - El usuario DEBE implementar la lógica específica de su modelo de IA (arquitectura, entrenamiento, predicción, guardado/carga)
#      sobrescribiendo los métodos correspondientes en `model.py`.
#    - El entrenamiento del modelo, iniciado desde la UI, ahora intentará cargar datos desde el archivo CSV
#      definido en `config.OPERATIONS_LOG_CSV_PATH`.
#
# 4. Simulación de Oportunidades:
#    - La funcionalidad para simular una oportunidad específica (si es activada desde la UI)
#      aún existe, pero el procesamiento automático de lotes para trading ha sido desactivado.

import asyncio
from datetime import datetime, timezone
from socketio.async_client import AsyncClient 
import websockets
import socketio
from socketio.exceptions import ConnectionError
import json
import os
# ccxt, aiohttp, urllib.parse, os, numpy, pandas, uuid son importados por los módulos delegados si los necesitan directamente.
# Si CryptoArbitrageApp necesita alguno directamente, se pueden añadir aquí.
import urllib.parse # Usado para SEBO_API_BASE_URL

# --- Importar clases de los nuevos módulos ---
from sio_event_handlers import SIOEventHandlers
from ui_command_handlers import UICommandHandlers
from v2_helpers import V2Helpers
from opportunity_processor import OpportunityProcessor
import aiohttp
from model import ArbitrageIntelligenceModel # Modelo de ML

# --- Importar variables de configuración ---
from config import (
    WEBSOCKET_URL, UI_WEBSOCKET_URL, # URLs principales
    DEFAULT_USDT_HOLDER_EXCHANGE_ID, DEFAULT_MODEL_PATH # Defaults para la app
    # Otras configs son usadas directamente por los módulos que las necesitan
)

# Definición global de SEBO_API_BASE_URL para que v2_helpers pueda importarlo si es necesario
# o se podría pasar la instancia de app que lo tiene como atributo.
parsed_sebo_url = urllib.parse.urlparse(WEBSOCKET_URL)
SEBO_BASE_HTTP_URL = f"http://{parsed_sebo_url.hostname}:{parsed_sebo_url.port}"
SEBO_API_BASE_URL = f"{SEBO_BASE_HTTP_URL}/api"


class CryptoArbitrageApp:
    def __init__(self):
        # --- Core Attributes ---
        self.sio = AsyncClient(logger=False, engineio_logger=False)
        self.ui_clients = set()
        self.http_session = None # Será inicializado por _ensure_http_session en V2Helpers
        self.SEBO_API_BASE_URL = SEBO_API_BASE_URL # Hacer accesible a helpers

        # --- Configuration & State (accesible por los manejadores/procesadores vía self.app) ---
        self.model = ArbitrageIntelligenceModel(model_path=DEFAULT_MODEL_PATH)
        self.ccxt_instances = {}
        self.active_real_trades = {}
        self.current_balance_config = None
        self.usdt_holder_exchange_id = DEFAULT_USDT_HOLDER_EXCHANGE_ID
        self.global_sl_active_flag = False
        self.latest_balances_from_sebo = None
        self.current_top_20_list = []
        self.is_processing_opportunity_batch = False

        # --- Instanciar clases de ayuda y manejadores ---
        # Estas clases contienen la lógica que antes estaba directamente en CryptoArbitrageApp
        self.helpers = V2Helpers(self)
        self.sio_handlers = SIOEventHandlers(self)
        self.ui_commands = UICommandHandlers(self)
        self.opp_processor = OpportunityProcessor(self)

        self._register_sio_handlers()

    async def _ensure_http_session(self):
        # Este método es llamado por helpers cuando necesitan la sesión.
        if self.http_session is None or self.http_session.closed:
            print(f"V2 ({os.path.basename(__file__)}): Creando nueva sesión aiohttp.")
            self.http_session = aiohttp.ClientSession()

    def _register_sio_handlers(self):
        @self.sio.event
        async def connect(): print(f"V2 ({os.path.basename(__file__)}): Socket.IO conectado a Sebo")

        @self.sio.event
        async def disconnect(): print(f"V2 ({os.path.basename(__file__)}): Socket.IO desconectado de Sebo")

        # Delegar a los manejadores en SIOEventHandlers
        self.sio.on('spot-arb', namespace='/api/spot/arb', handler=self.sio_handlers.on_spot_arb_data_method)
        self.sio.on('balances-update', namespace='/api/spot/arb', handler=self.sio_handlers.on_balances_update_from_sebo)
        self.sio.on('top_20_data', namespace='/api/spot/arb', handler=self.sio_handlers.on_top_20_data_received)

    async def connect_and_process(self):
        # Utiliza WEBSOCKET_URL de config.py
        parsed_url = urllib.parse.urlparse(WEBSOCKET_URL)
        sebo_base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        namespace = parsed_url.path if parsed_url.path else '/'
        try:
            print(f"V2 ({os.path.basename(__file__)}): Conectando a Sebo Socket.IO en {sebo_base_url} con namespace {namespace}")
            await self.sio.connect(sebo_base_url, namespaces=[namespace], transports=['websocket'])
            await self.sio.wait() # Bloquea para mantener la conexión activa
        except ConnectionError as e: print(f"Error de conexión Socket.IO con Sebo: {e}")
        except Exception as e: print(f"Error general de Socket.IO con Sebo: {e}")
        finally:
            if self.sio and self.sio.connected:
                print(f"V2 ({os.path.basename(__file__)}): Desconectando Socket.IO de Sebo...");
                await self.sio.disconnect()

    async def broadcast_to_ui(self, message_data):
        if not self.ui_clients: return
        message_json = json.dumps(message_data) # json debe estar importado
        disconnected_clients = set()
        for client in self.ui_clients:
            try: await client.send(message_json)
            except websockets.exceptions.ConnectionClosed: disconnected_clients.add(client)
            except Exception as e: print(f"Error enviando a cliente UI: {e}"); disconnected_clients.add(client)
        for client in disconnected_clients: self.ui_clients.discard(client)

    async def start_ui_websocket_server(self):
        try: ui_port = int(UI_WEBSOCKET_URL.split(":")[-1].split("/")[0]) # UI_WEBSOCKET_URL de config.py
        except: print(f"Error parseando UI_WEBSOCKET_URL: '{UI_WEBSOCKET_URL}'. Usando 3001."); ui_port = 3001

        async def ui_websocket_handler(websocket_client):
            client_id = id(websocket_client); print(f"Cliente UI conectado, ID: {client_id}")
            self.ui_clients.add(websocket_client)
            try:
                await self.ui_commands.send_model_status(websocket_client) # Delegar a UICommandHandlers
                async for message_json_str in websocket_client:
                    await self.ui_commands.handle_ui_message(websocket_client, message_json_str) # Delegar
            except websockets.exceptions.ConnectionClosed: print(f"Cliente UI desconectado (ID: {client_id}).")
            except Exception as e: print(f"Error en manejador WebSocket UI: {e}")
            finally: self.ui_clients.discard(websocket_client)
        print(f"Iniciando servidor WebSocket para UI en ws://localhost:{ui_port}")
        await websockets.serve(ui_websocket_handler, "localhost", ui_port) # websockets debe estar importado

    async def close_http_session(self):
        if self.http_session and not self.http_session.closed:
            await self.http_session.close(); print("V2: Sesión HTTP cerrada.")

    # close_ccxt_instances es ahora parte de V2Helpers, se llamará vía self.helpers.close_ccxt_instances

    # La función request_balances_periodically ha sido eliminada.
    # V2 ahora dependerá de las actualizaciones de balance enviadas por Sebo
    # a través del evento de Socket.IO 'balances-update'.
    # El manejador on_balances_update_from_sebo en sio_event_handlers.py
    # se encarga de procesar estos eventos.

async def main_entry_point():
    app = CryptoArbitrageApp()
    try:
        # La tarea app.request_balances_periodically() ha sido eliminada.
        await asyncio.gather(
            app.connect_and_process(),
            app.start_ui_websocket_server()
            # app.request_balances_periodically() # Eliminada
        )
    except KeyboardInterrupt: print("Aplicación V2 interrumpida.")
    finally:
        await app.close_http_session()
        if hasattr(app, 'helpers') and app.helpers: # Comprobar si helpers está inicializado
            await app.helpers.close_ccxt_instances() # Llamar vía helpers

        if app.sio and app.sio.connected:
            print("Asegurando desconexión del cliente SIO...")
            await app.sio.disconnect()

if __name__ == "__main__":
    # Esta estructura asume que V2 es un paquete o que la ruta de búsqueda de módulos de Python
    # está configurada para encontrar módulos hermanos como sio_event_handlers.
    # Para ejecución directa (python V2/principal.py), asegúrate de que el directorio V2 esté en PYTHONPATH
    # o ajusta las importaciones para que sean relativas si se ejecuta como `python -m V2.principal`.
    asyncio.run(main_entry_point())
