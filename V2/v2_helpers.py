# V2/v2_helpers.py
import asyncio
import json
from datetime import datetime, timezone
import ccxt.async_support as ccxt
# SEBO_API_BASE_URL will be accessed via self.app.SEBO_API_BASE_URL (which is defined in principal.py)

class V2Helpers:
    def __init__(self, app_instance):
        self.app = app_instance # To access app attributes like http_session, ccxt_instances, sio, config values etc.

    async def get_ccxt_exchange_instance(self, exchange_id: str):
        # This method was already part of the skeleton in principal.py,
        # but its logic belongs here.
        # It accesses self.app.ccxt_instances
        if exchange_id not in self.app.ccxt_instances:
            try:
                exchange_class = getattr(ccxt, exchange_id)
                instance = exchange_class({'enableRateLimit': True})
                self.app.ccxt_instances[exchange_id] = instance
            except AttributeError:
                print(f"V2Helpers: Error: Exchange CCXT '{exchange_id}' no soportado o nombre incorrecto.")
                return None
            except Exception as e:
                print(f"V2Helpers: Error creando instancia CCXT para {exchange_id}: {e}")
                return None
        return self.app.ccxt_instances[exchange_id]

    # async def get_current_market_prices(self, exchange_id: str, symbol: str):
    #     exchange = await self.get_ccxt_exchange_instance(exchange_id) # Uses helper method above
    #     if not exchange:
    #         return None, None
    #     try:
    #         ticker = await exchange.fetch_ticker(symbol)
    #         return ticker.get('ask'), ticker.get('bid')
    #     except ccxt.NetworkError as e:
    #         print(f"V2Helpers: CCXT NetworkError Ticker {symbol}@{exchange_id}: {e}")
    #     except ccxt.ExchangeError as e:
    #         print(f"V2Helpers: CCXT ExchangeError Ticker {symbol}@{exchange_id}: {e}")
    #     except Exception as e:
    #         print(f"V2Helpers: CCXT Generic Error Ticker {symbol}@{exchange_id}: {e}")
    #     return None, None

    async def get_usdt_withdrawal_info(self, from_exchange_id: str):
        usdt_withdrawal_info = {
            "selected_network": None, "selected_fee": float('inf'), "all_networks": []
        }
        if not from_exchange_id: return usdt_withdrawal_info

        # Access SEBO_API_BASE_URL via the app instance, assuming it's defined there
        # or directly import from config if it's globally available and correctly set up.
        # For now, assuming it's accessible via self.app (e.g. self.app.SEBO_API_BASE_URL)
        # This requires SEBO_API_BASE_URL to be an attribute of the app instance or a global in principal.py
<<<<<<< HEAD
<<<<<<< HEAD
        # Accessing via self.app.SEBO_API_BASE_URL which is set in CryptoArbitrageApp's __init__
        if not hasattr(self.app, 'SEBO_API_BASE_URL') or not self.app.SEBO_API_BASE_URL:
            print("V2Helpers: SEBO_API_BASE_URL no está configurado en la instancia de la app para get_usdt_withdrawal_info.")
            return usdt_withdrawal_info
=======
=======
        # Let's assume principal.py defines it globally for now, or we pass it.
        # For simplicity, re-importing it here if it's not passed via app.
        from main import SEBO_API_BASE_URL # Relative import assuming principal.py sets it globally
>>>>>>> 28ee198576a3e43b01eaaac38733271a92d54358

        api_url = f"{SEBO_API_BASE_URL}/exchanges/{from_exchange_id}/withdrawal-fees/USDT"
        try:
            await self.app._ensure_http_session() # Accessing app's method
            async with self.app.http_session.get(api_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        networks = data.get('networks', [])
                        usdt_withdrawal_info["all_networks"] = networks

                        # Find the best network using a generator expression and min()
                        active_networks = (
                            net for net in networks
                            if net.get('active') and net.get('withdraw') and net.get('fee') is not None
                        )
                        best_network = min(active_networks, key=lambda net: float(net['fee']), default=None)

                        if best_network:
                            usdt_withdrawal_info["selected_fee"] = float(best_network['fee'])
                            usdt_withdrawal_info["selected_network"] = best_network['network']
                        else:
                            print(f"V2Helpers: No network info for USDT@{from_exchange_id} from Sebo.")
                    else:
                        print(f"V2Helpers: Error Sebo API USDT fees: {response.status} - {await response.text()}")
        except Exception as e:
            print(f"V2Helpers: Exception Sebo API USDT fees: {e}")
        return usdt_withdrawal_info

    async def load_balance_config(self, exchange_id: str):
        # This method directly manipulates self.app.current_balance_config
        if not exchange_id:
            self.app.current_balance_config = None
            return False

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        from config import SEBO_BASE
=======
=======
        from main import SEBO_API_BASE_URL
>>>>>>> 28ee198576a3e43b01eaaac38733271a92d54358

        api_url = f"{SEBO_BASE}/api/balances/exchange/{exchange_id}"
=======
>>>>>>> 28ee198 (cambios para MAnus)
        from main import SEBO_API_BASE_URL

        api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        try:
            await self.app._ensure_http_session()
            async with self.app.http_session.get(api_url) as response:
                    if response.status == 200:
                        self.app.current_balance_config = await response.json()
                        print(f"V2Helpers: Config Balance para {exchange_id} cargada: {self.app.current_balance_config.get('balance_usdt')} USDT")
                        return True
                    else:
                        print(f"V2Helpers: Error cargando config Balance para {exchange_id} de Sebo: {response.status}")
                        self.app.current_balance_config = None
                        return False
        except Exception as e:
            print(f"V2Helpers: Excepción al cargar config Balance para {exchange_id}: {e}")
            self.app.current_balance_config = None
            return False

    async def update_balance_on_sebo(self, exchange_id: str, new_balance_usdt: float, full_config_to_upsert: dict):
        # This method manipulates self.app.current_balance_config and uses self.app.sio
        if not exchange_id:
            print("V2Helpers_UpdateBalance: No exchange_id para actualizar balance en Sebo.")
            return False

<<<<<<< HEAD
<<<<<<< HEAD
        if not hasattr(self.app, 'SEBO_API_BASE_URL') or not self.app.SEBO_API_BASE_URL:
            print(f"V2Helpers: SEBO_API_BASE_URL no configurado en app para update_balance_on_sebo({exchange_id}).")
            return False
=======
=======
        from main import SEBO_API_BASE_URL
>>>>>>> 28ee198576a3e43b01eaaac38733271a92d54358

        api_url = f"{self.app.SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        payload = {**full_config_to_upsert}
        payload['balance_usdt'] = new_balance_usdt
        payload['id_exchange'] = exchange_id
        payload['timestamp'] = datetime.now(timezone.utc).isoformat()
        payload.pop('_id', None); payload.pop('__v', None)

        try:
            await self.app._ensure_http_session()
            async with self.app.http_session.put(api_url, json=payload) as response:
                    if response.status == 200:
                        updated_balance_doc = await response.json()
                        print(f"V2Helpers: Balance en Sebo para {exchange_id} actualizado vía HTTP.")

                        if self.app.sio and self.app.sio.connected: # Check if sio client exists and is connected
                            try:
                                await self.app.sio.emit('v2_last_balance_update', updated_balance_doc, namespace='/api/spot/arb')
                                print(f"V2Helpers: Emitido 'v2_last_balance_update' a Sebo vía socket para {exchange_id}.")
                            except Exception as e_emit:
                                print(f"V2Helpers: Error emitiendo 'v2_last_balance_update' a Sebo vía socket: {e_emit}")
                        else:
                            print("V2Helpers: SIO client no conectado, no se pudo emitir 'v2_last_balance_update'.")

                        if exchange_id == self.app.usdt_holder_exchange_id: # Access via self.app
                            self.app.current_balance_config = updated_balance_doc
                        return True
                    else:
                        print(f"V2Helpers: Error API Sebo actualizando balance para {exchange_id}: {response.status} - {await response.text()}")
                        return False
        except Exception as e:
            print(f"V2Helpers: Excepción actualizando balance para {exchange_id}: {e}")
            return False

    from typing import Optional

    async def load_balance_config_for_exchange(self, exchange_id: str) -> Optional[dict]:
        if not exchange_id: return None
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
        from config import SEBO_BASE
        SEBO_API_BASE_URL = f"{SEBO_BASE}/api"
=======
=======
        from main import SEBO_API_BASE_URL
>>>>>>> 28ee198576a3e43b01eaaac38733271a92d54358
        api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        try:
            await self.app._ensure_http_session()
            async with self.app.http_session.get(api_url) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        print(f"V2Helpers: No existe config de Balance para {exchange_id} en Sebo.")
                        return {"id_exchange": exchange_id, "balance_usdt": 0 } # Return default structure
                    else:
                        print(f"V2Helpers: Error API Sebo cargando config Balance (específico) para {exchange_id}: {response.status}")
                        return None
        except Exception as e:
            print(f"V2Helpers: Excepción cargando config Balance (específico) para {exchange_id}: {e}")
            return None

    async def close_ccxt_instances(self): # Moved from principal.py
        print("V2Helpers: Closing CCXT instances...")
        for ex_id, instance in self.app.ccxt_instances.items(): # Access via self.app
            try:
                if hasattr(instance, 'close') and asyncio.iscoroutinefunction(instance.close):
                    await instance.close()
            except Exception as e:
                print(f"V2Helpers: Error closing CCXT for {ex_id}: {e}")
        self.app.ccxt_instances.clear()
        print("V2Helpers: CCXT instances cleared.")

    # _ensure_http_session could also be here if only helpers use it,
    # but it's fine in app_core if app_core also makes direct http calls.
    # For now, helpers will call self.app._ensure_http_session()

    # La función get_balances_from_sebo ha sido eliminada ya que V2
    # ahora depende de las actualizaciones de balance por Socket.IO desde Sebo.
