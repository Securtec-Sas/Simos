import asyncio
from socketio.async_client import AsyncClient
from socketio.exceptions import ConnectionError

class SoketMidlle:
    def __init__(self, app, sebo_url="ws://localhost:3001"):
        self.app = app
        self.sio = AsyncClient(logger=False, engineio_logger=False)
        self.sebo_url = sebo_url
        self._register_sio_handlers()

    def _register_sio_handlers(self):
        @self.sio.event
        async def connect():
            print("Socket.IO connected to Sebo")

        @self.sio.event
        async def disconnect():
            print("Socket.IO disconnected from Sebo")

        self.sio.on('spot-arb', self.app.on_spot_arb_data_method, namespace='/api/spot/arb')

        async def balances_update_handler(data):
            asyncio.create_task(self.app.on_balances_update_from_sebo(data))
        self.sio.on('balances-update', balances_update_handler, namespace='/api/spot/arb')

    async def connect_and_process(self):
        try:
            await self.sio.connect(self.sebo_url, namespaces=['/api/spot/arb'])
            await self.sio.wait()
        except ConnectionError as e:
            print(f"Error de conexión Socket.IO con Sebo: {e}")
        except Exception as e:
            print(f"Error en la conexión Socket.IO con Sebo: {e}")
        finally:
            if self.sio.connected:
                print("Desconectando Socket.IO...")
                await self.sio.disconnect()