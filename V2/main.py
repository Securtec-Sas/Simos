# main.py

import asyncio
from datetime import datetime, timezone # Añadir timezone
import websockets # Ensure this is imported for the UI server
# import websockets.uri # This should remain commented or removed
import socketio # Ensure this is imported
from socketio import ConnectionError
from typing import Union, Optional, Dict, Any # Added Union for type hints
import json
import ccxt.async_support as ccxt
import aiohttp
from arbitrage_executor import evaluate_and_simulate_arbitrage # Import the executor
from data_logger import log_operation_to_csv # Import the CSV logger
from config import WEBSOCKET_URL, UI_WEBSOCKET_URL # Updated config imports
# from model import ArbitrageModel # Keep for when model is used - Temporarily commented due to ImportError
from arbitrage_calculator import calculate_net_profitability
# Removed duplicate evaluate_and_simulate_arbitrage import

SEBO_API_BASE_URL = "http://localhost:3000/api"

class CryptoArbitrageApp:
    def __init__(self):
        self.exchanges = {}
        # self.model = ArbitrageModel() # Assuming model.py and class exist, can be uncommented later
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False) # Reduce verbosity
        self.ui_clients = set()
        self.ccxt_instances = {} # For caching CCXT instances
        self.current_balance_config = None # Will store Balance config from Sebo
        self.usdt_holder_exchange_id = "binance" # Placeholder, V2 needs to set this
        self.global_sl_active_flag = False # Flag for global stop-loss
        self.http_session = None # Added for shared aiohttp session
        self.latest_balances_from_sebo = None # To store balances received from Sebo
        self._register_sio_handlers()
        # self.load_exchanges() # Call removed
        # Cargar el modelo de IA si ya está entrenado
        # try:
        #     # self.model = ArbitrageModel() # Ensure this remains commented if not ready
        #     self.model.load_model() # Assuming model.py and class exist
        # except FileNotFoundError:
        #     print("Modelo de IA no encontrado. Por favor, entrene el modelo primero.")
        # except AttributeError: # If self.model is None
        #     print("Atributo de modelo no encontrado, posible problema con inicialización de modelo.")

    async def _ensure_http_session(self):
        if self.http_session is None or self.http_session.closed:
            self.http_session = aiohttp.ClientSession()

    def _register_sio_handlers(self):
        @self.sio.event
        async def connect():
            print("Socket.IO connected to Sebo")
            # No need to emit 'join_room' unless Sebo server expects it for namespaces

        @self.sio.event
        async def disconnect():
            print("Socket.IO disconnected from Sebo")

        # Register event handlers
        self.sio.on('spot-arb', self.on_spot_arb_data_method, namespace='/api/spot/arb')

        # For 'balances-update', if we need to launch it as a task directly from the handler
        # and the handler itself needs to be async with `data`
        async def balances_update_handler(data):
            asyncio.create_task(self.on_balances_update_from_sebo(data))
        self.sio.on('balances-update', balances_update_handler, namespace='/api/spot/arb')


    async def on_balances_update_from_sebo(self, data: Dict[str, Any]): # Added type hint for data
        print(f"V2: Recibido 'balances-update' de Sebo: {data}")
        self.latest_balances_from_sebo = data # Store the received balances

        # Retransmit to UI clients
        ui_message = {
            "type": "full_balance_update_from_v2",
            "payload": self.latest_balances_from_sebo
        }
        await self.broadcast_to_ui(ui_message)
        print(f"V2: 'balances-update' retransmitido a clientes UI.")

    async def get_ccxt_exchange_instance(self, exchange_id: str):
        if exchange_id not in self.ccxt_instances:
            try:
                exchange_class = getattr(ccxt, exchange_id)
                instance = exchange_class({'enableRateLimit': True})
                self.ccxt_instances[exchange_id] = instance
            except AttributeError:
                print(f"V2: Error: Exchange CCXT '{exchange_id}' no soportado o nombre incorrecto.")
                return None
            except Exception as e:
                print(f"V2: Error creando instancia CCXT para {exchange_id}: {e}")
                return None
        return self.ccxt_instances[exchange_id]

    async def get_current_market_prices(self, exchange_id: str, symbol: str):
        exchange = await self.get_ccxt_exchange_instance(exchange_id)
        if not exchange:
            return None, None
        try:
            ticker = await exchange.fetch_ticker(symbol)
            return ticker.get('ask'), ticker.get('bid')
        except ccxt.NetworkError as e:
            print(f"V2: CCXT NetworkError Ticker {symbol}@{exchange_id}: {e}")
        except ccxt.ExchangeError as e:
            print(f"V2: CCXT ExchangeError Ticker {symbol}@{exchange_id}: {e}")
        except Exception as e:
            print(f"V2: CCXT Generic Error Ticker {symbol}@{exchange_id}: {e}")
        return None, None

    async def get_usdt_withdrawal_info(self, from_exchange_id: str):
        # (Contenido del método get_usdt_withdrawal_info como estaba antes)
        usdt_withdrawal_info = {
            "selected_network": None, "selected_fee": float('inf'), "all_networks": []
        }
        if not from_exchange_id: return usdt_withdrawal_info # Return early if no id
        api_url = f"{SEBO_API_BASE_URL}/exchanges/{from_exchange_id}/withdrawal-fees/USDT"
        try:
            await self._ensure_http_session()
            async with self.http_session.get(api_url) as response: # Use shared session
                    if response.status == 200:
                        data = await response.json()
                        if data and data.get('networks'):
                            usdt_withdrawal_info["all_networks"] = data['networks']
                            for net_info in data['networks']: # Corrected variable name
                                if net_info.get('active') and net_info.get('withdraw') and net_info.get('fee') is not None:
                                    fee = float(net_info['fee'])
                                    if fee < usdt_withdrawal_info["selected_fee"]:
                                        usdt_withdrawal_info["selected_fee"] = fee
                                        usdt_withdrawal_info["selected_network"] = net_info['network']
                            if usdt_withdrawal_info["selected_fee"] == float('inf'):
                                usdt_withdrawal_info["selected_fee"] = None # Set to None if no suitable fee found
                        else:
                            print(f"V2: No network info for USDT@{from_exchange_id} from Sebo.")
                    else:
                        print(f"V2: Error Sebo API USDT fees: {response.status} - {await response.text()}")
        except Exception as e:
            print(f"V2: Exception Sebo API USDT fees: {e}")
        return usdt_withdrawal_info

    async def load_balance_config(self, exchange_id: str):
        if not exchange_id:
            self.current_balance_config = None
            return False

        api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        try:
            await self._ensure_http_session()
            if self.http_session is None:
                print("V2: Error - http_session is None before GET request.")
                self.current_balance_config = None
                return False
            async with self.http_session.get(api_url) as response: # Use shared session
                    if response.status == 200:
                        self.current_balance_config = await response.json()
                        print(f"V2: Config Balance para {exchange_id} cargada: {self.current_balance_config.get('balance_usdt')} USDT")
                        return True
                    else: # Manejar 404 u otros errores
                        print(f"V2: Error cargando config Balance para {exchange_id} de Sebo: {response.status}")
                        self.current_balance_config = None # Asegurar que no haya config vieja
                        # Si es 404, V2 podría intentar crear un doc Balance con defaults via API
                        # if response.status == 404:
                        #    await self.create_default_balance_config_on_sebo(exchange_id)
                        return False
        except Exception as e:
            print(f"V2: Excepción al cargar config Balance para {exchange_id}: {e}")
            self.current_balance_config = None
            return False

    async def update_balance_on_sebo(self, exchange_id: str, new_balance_usdt: float, full_config_to_upsert: dict):
        if not exchange_id:
            print("V2_UpdateBalance: No exchange_id para actualizar balance en Sebo.")
            return False

        api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"

        payload = {**full_config_to_upsert}
        payload['balance_usdt'] = new_balance_usdt
        payload['id_exchange'] = exchange_id
        payload['timestamp'] = datetime.now(timezone.utc).isoformat()

        payload.pop('_id', None)
        payload.pop('__v', None)

        try:
            await self._ensure_http_session()
            async with self.http_session.put(api_url, json=payload) as response: # Use shared session
                    if response.status == 200:
                        updated_balance_doc = await response.json()
                        print(f"V2_UpdateBalance: Balance en Sebo para {exchange_id} actualizado. Nuevo balance: {updated_balance_doc.get('balance_usdt')}")
                        if exchange_id == self.usdt_holder_exchange_id:
                            self.current_balance_config = updated_balance_doc
                        return True
                    else:
                        print(f"V2_UpdateBalance: Error API Sebo actualizando balance para {exchange_id}: {response.status} - {await response.text()}")
                        return False
        except Exception as e:
            print(f"V2_UpdateBalance: Excepción actualizando balance para {exchange_id}: {e}")
            return False

    async def load_balance_config_for_exchange(self, exchange_id: str) -> Union[dict, None]: # Changed to Union
        if not exchange_id: return None
        api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
        try:
            await self._ensure_http_session()
            async with self.http_session.get(api_url) as response: # Use shared session
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        print(f"V2: No existe config de Balance para {exchange_id} en Sebo. Se usarán defaults para el primer registro.")
                        return {
                            "id_exchange": exchange_id,
                            "balance_usdt": 0,
                        }
                    else:
                        print(f"V2: Error API Sebo cargando config Balance para {exchange_id} (helper): {response.status}")
                        return None
        except Exception as e:
            print(f"V2: Excepción cargando config Balance para {exchange_id} (helper): {e}")
            return None

    async def on_spot_arb_data_method(self, data):
        symbol_str = data.get('symbol', 'N/A')
        ai_input_dict = {'symbol': symbol_str} # Initialize early for logging potential premature exits

        try:
            if not self.usdt_holder_exchange_id:
                raise Exception(f"V2: {symbol_str} | Abortado: usdt_holder_exchange_id no configurado.")

            config_loaded = await self.load_balance_config(self.usdt_holder_exchange_id)
            if not config_loaded or not self.current_balance_config:
                raise Exception(f"V2: {symbol_str} | Abortado: No se pudo cargar config de Balance para {self.usdt_holder_exchange_id}.")

            ai_input_dict['current_balance_config_before_op'] = self.current_balance_config

            if self.global_sl_active_flag:
                ai_input_dict['global_sl_active_prevented_op'] = True
                raise Exception(f"V2: {symbol_str} | SL GLOBAL ACTIVO. No se procesa.")

            current_bal_usdt = float(self.current_balance_config.get('balance_usdt', 0))
            initial_cap_sl = float(self.current_balance_config.get('initial_capital_for_global_sl', 0))
            sl_global_perc = float(self.current_balance_config.get('stop_loss_percentage_global', 50))

            if initial_cap_sl > 0:
                sl_threshold = initial_cap_sl * (1 - (sl_global_perc / 100.0))
                if current_bal_usdt < sl_threshold:
                    self.global_sl_active_flag = True
                    ai_input_dict['global_sl_triggered_now'] = True
                    ai_input_dict['sl_threshold_calculated'] = sl_threshold
                    raise Exception(f"V2: ALERTA STOP LOSS GLOBAL! Balance: {current_bal_usdt} < Umbral: {sl_threshold}.")

            amount_to_invest_usdt = 0.0
            investment_mode = self.current_balance_config.get('investment_mode', "FIXED")
            min_operational_usdt = 10.0

            if current_bal_usdt < min_operational_usdt:
                ai_input_dict['insufficient_balance_for_min_op'] = True
                raise Exception(f"V2: {symbol_str} | Balance USDT ({current_bal_usdt:.2f}) demasiado bajo para operar (min: {min_operational_usdt:.2f}).")

            if current_bal_usdt < 150: amount_to_invest_usdt = current_bal_usdt
            else:
                if investment_mode == "FIXED": amount_to_invest_usdt = float(self.current_balance_config.get('fixed_investment_usdt', 50))
                elif investment_mode == "PERCENTAGE":
                    percent = float(self.current_balance_config.get('investment_percentage', 10))
                    amount_to_invest_usdt = current_bal_usdt * (percent / 100.0)
                else: amount_to_invest_usdt = float(self.current_balance_config.get('fixed_investment_usdt', 50))

            practical_min_investment = 50.0
            if current_bal_usdt >= 150 and amount_to_invest_usdt < practical_min_investment:
                amount_to_invest_usdt = practical_min_investment
            amount_to_invest_usdt = min(amount_to_invest_usdt, current_bal_usdt)

            if amount_to_invest_usdt < min_operational_usdt:
                ai_input_dict['investment_amount_too_low'] = True
                raise Exception(f"V2: {symbol_str} | Monto a invertir ({amount_to_invest_usdt:.2f}) bajo mínimo operacional ({min_operational_usdt:.2f}).")

            usdt_withdrawal_info = await self.get_usdt_withdrawal_info(self.usdt_holder_exchange_id)

            # Populate ai_input_dict with all data points
            ai_input_dict.update({
                'analysis_id': data.get('analysis_id'), 'symbol': symbol_str, 'symbol_name': data.get('symbol_name'),
                'fetch_timestamp_sebo': data.get('timestamp'), 'ex_min_id_sebo': data.get('exchange_min_id'),
                'ex_min_name_sebo': data.get('exchange_min_name'), 'price_ex_min_buy_asset_sebo': data.get('price_at_exMin_to_buy_asset'),
                'ex_min_taker_fee_rate_sebo': data.get('fees_exMin', {}).get('taker_fee'),
                'ex_min_maker_fee_rate_sebo': data.get('fees_exMin', {}).get('maker_fee'),
                'asset_withdrawal_fee_from_ex_min_sebo': data.get('fees_exMin', {}).get('withdrawal_fee_asset'),
                'asset_withdrawal_network_from_ex_min_sebo': data.get('fees_exMin', {}).get('withdrawal_network'),
                'ex_max_id_sebo': data.get('exchange_max_id'), 'ex_max_name_sebo': data.get('exchange_max_name'),
                'price_ex_max_sell_asset_sebo': data.get('price_at_exMax_to_sell_asset'),
                'ex_max_taker_fee_rate_sebo': data.get('fees_exMax', {}).get('taker_fee'),
                'ex_max_maker_fee_rate_sebo': data.get('fees_exMax', {}).get('maker_fee'),
                # 'gross_percentage_diff_sebo': float(data.get('percentage_difference', '0%').replace('%','')) if data.get('percentage_difference') else 0.0, # Replaced by robust logic below
                'initial_usdt_holder_exchange_id': self.usdt_holder_exchange_id,
                'initial_usdt_withdrawal_selected_fee': usdt_withdrawal_info.get('selected_fee'),
                'initial_usdt_withdrawal_selected_network': usdt_withdrawal_info.get('selected_network'),
                'initial_usdt_all_networks_info': usdt_withdrawal_info.get('all_networks'),
                'processing_timestamp_v2_start': asyncio.get_event_loop().time(),
                'current_balance_config_v2': self.current_balance_config,
                'determined_investment_usdt_v2': amount_to_invest_usdt
            })

            current_price_ex_min_buy, current_price_ex_max_sell = None, None
            if ai_input_dict['ex_min_id_sebo']: ask_price, _ = await self.get_current_market_prices(ai_input_dict['ex_min_id_sebo'], symbol_str); current_price_ex_min_buy = ask_price
            if ai_input_dict['ex_max_id_sebo']: _, bid_price = await self.get_current_market_prices(ai_input_dict['ex_max_id_sebo'], symbol_str); current_price_ex_max_sell = bid_price
            ai_input_dict.update({'current_price_ex_min_buy_asset': current_price_ex_min_buy, 'current_price_ex_max_sell_asset': current_price_ex_max_sell})

            # Robust parsing for gross_percentage_diff_sebo
            percentage_str = data.get('percentage_difference')
            gross_percentage_diff_val = 0.0
            if isinstance(percentage_str, str):
                cleaned_percentage_str = percentage_str.replace('%', '').strip()
                if cleaned_percentage_str:
                    try:
                        gross_percentage_diff_val = float(cleaned_percentage_str)
                    except ValueError:
                        print(f"V2: {symbol_str} | Advertencia: No se pudo convertir percentage_difference ('{percentage_str}') a float.")
            elif isinstance(percentage_str, (int, float)):
                gross_percentage_diff_val = float(percentage_str)
            ai_input_dict['gross_percentage_diff_sebo'] = gross_percentage_diff_val

            if current_price_ex_min_buy and current_price_ex_max_sell and current_price_ex_min_buy > 0:
                ai_input_dict['current_percentage_difference'] = ((current_price_ex_max_sell - current_price_ex_min_buy) / current_price_ex_min_buy) * 100
            else: ai_input_dict['current_percentage_difference'] = None

            if ai_input_dict.get('initial_usdt_withdrawal_selected_fee') is None:
                raise Exception(f"V2: {symbol_str} | Abortado: Falta comisión de retiro inicial de USDT para {self.usdt_holder_exchange_id}.")

            profitability_results = calculate_net_profitability(ai_input_dict, amount_to_invest_usdt)

            if profitability_results is None:
                error_msg = f"V2: {ai_input_dict.get('symbol', 'N/A')} | calculate_net_profitability devolvió None."
                print(error_msg)
                ai_input_dict['net_profitability_results'] = {"error_message": "calculate_net_profitability returned None", "net_profit_usdt": 0, "net_profit_percentage": 0}
                raise Exception(error_msg)

            ai_input_dict['net_profitability_results'] = profitability_results
            if profitability_results.get("error_message"):
                # El error ya está en profitability_results, simplemente lo relanzamos
                raise Exception(f"Profitability calculation error: {profitability_results.get('error_message')}")

            print(f"V2: {symbol_str} | Rentabilidad Neta: {profitability_results.get('net_profit_percentage'):.4f}% ({profitability_results.get('net_profit_usdt'):.4f} USDT) para inversión de {amount_to_invest_usdt:.2f} USDT.")

            simulation_results = await evaluate_and_simulate_arbitrage(ai_input_dict, self)
            ai_input_dict['simulation_results'] = simulation_results
            print(f"V2: {symbol_str} | Decisión: {simulation_results.get('decision_outcome')}, Ganancia Final Sim: {simulation_results.get('final_simulated_profit_usdt'):.4f} USDT")

            decision = simulation_results.get('decision_outcome')
            if decision in ["EJECUTADA_SIMULADA", "EJECUTADA_SIMULADA_TP_INICIAL", "EJECUTADA_SIMULADA_TP_FINAL"]:
                profit_loss_this_op = simulation_results.get('final_simulated_profit_usdt', 0.0)
                original_holder_id = ai_input_dict.get('initial_usdt_holder_exchange_id')
                final_usdt_destination_exchange_id = ai_input_dict.get('ex_max_id_sebo')
                investment_for_this_op = float(ai_input_dict.get('determined_investment_usdt_v2', 0.0))

                if original_holder_id:
                    config_original_holder = await self.load_balance_config_for_exchange(original_holder_id)
                    if config_original_holder:
                        new_balance_original_holder = float(config_original_holder.get('balance_usdt', 0)) - investment_for_this_op
                        await self.update_balance_on_sebo(original_holder_id, new_balance_original_holder, config_original_holder)
                    else: print(f"V2: {symbol_str} | No se pudo cargar config de balance para {original_holder_id} (origen), no se actualiza balance.")

                if final_usdt_destination_exchange_id:
                    config_final_holder = await self.load_balance_config_for_exchange(final_usdt_destination_exchange_id)
                    if not config_final_holder: config_final_holder = {"id_exchange": final_usdt_destination_exchange_id, "balance_usdt": 0}
                    new_balance_final_holder = float(config_final_holder.get('balance_usdt', 0)) + (investment_for_this_op + profit_loss_this_op)
                    if not config_final_holder.get('initial_capital_for_global_sl') or config_final_holder.get('initial_capital_for_global_sl') == 0 :
                        config_final_holder['initial_capital_for_global_sl'] = new_balance_final_holder
                    await self.update_balance_on_sebo(final_usdt_destination_exchange_id, new_balance_final_holder, config_final_holder)
                    if original_holder_id != final_usdt_destination_exchange_id:
                        self.usdt_holder_exchange_id = final_usdt_destination_exchange_id
                        await self.load_balance_config(self.usdt_holder_exchange_id)

        except Exception as e:
            error_message_for_log = f"Error durante procesamiento V2 para {symbol_str}: {e}"
            print(error_message_for_log)
            if 'net_profitability_results' not in ai_input_dict: ai_input_dict['net_profitability_results'] = {}
            if 'simulation_results' not in ai_input_dict: ai_input_dict['simulation_results'] = {}
            ai_input_dict['net_profitability_results']['error_message'] = ai_input_dict['net_profitability_results'].get('error_message', str(e))
            ai_input_dict['simulation_results']['error_message'] = ai_input_dict['simulation_results'].get('error_message', str(e))
            ai_input_dict['simulation_results']['decision_outcome'] = ai_input_dict['simulation_results'].get('decision_outcome', "ERROR_PROCESAMIENTO_V2")

        # Final logging for the operation, including any errors caught
        try:
            await log_operation_to_csv(ai_input_dict, "logs/v2_operation_logs.csv")
            log_status_msg = ai_input_dict.get('simulation_results',{}).get('decision_outcome','N/A_SIM_RESULT')
            if not log_status_msg or log_status_msg == 'N/A_SIM_RESULT': # If simulation_results was not populated due to early exit
                log_status_msg = ai_input_dict.get('net_profitability_results',{}).get('error_message','N/A_PROFIT_ERROR')
            if not log_status_msg : log_status_msg = "N/A_ERROR_STATUS"
            print(f"V2: {symbol_str} | Log de operación guardado (estado: {log_status_msg}).")
        except Exception as log_e:
            print(f"V2: {symbol_str} | Error al intentar guardar log final: {log_e}")

        print(f"V2: {symbol_str} | Procesamiento completo finalizado.")

    # async def store_training_data(self, data_dict): # This was a placeholder, actual logging is now log_operation_to_csv
    #     pass

    # Old methods to be removed are below this line in the original file
    # The connect_and_process method is kept as it's essential for Socket.IO connection.
    # Methods like load_exchanges, fetch_spot_prices, _fetch_single_price, process_arb_data,
    # analyze_and_act, execute_arbitrage, request_top_opportunities will be removed.

    async def connect_and_process(self):
        # WEBSOCKET_URL is "ws://localhost:3000/api/spot/arb"
        # For python-socketio, the main URL is ws://localhost:3000
        # The namespace is /api/spot/arb
        sebo_url = "ws://localhost:3001" # Base URL for Socket.IO connection (V2 recibe en 3001)
        try:
            # The handlers are already registered in __init__ via _register_sio_handlers
            await self.sio.connect(sebo_url, namespaces=['/api/spot/arb'])
            await self.sio.wait() # Keep the client running and listening for events
        except ConnectionError as e:
            print(f"Error de conexión Socket.IO con Sebo: {e}")
        except Exception as e: # Catch other potential exceptions
            print(f"Error en la conexión Socket.IO con Sebo: {e}")
            print(f"Error en la conexión Socket.IO con Sebo: {e}")
        finally:
            if self.sio.connected:
                print("Desconectando Socket.IO...")
                await self.sio.disconnect()

    async def broadcast_to_ui(self, message_data):
        if not self.ui_clients:
            # print("No UI clients connected, not broadcasting.") # Optional log
            return

        # print(f"Broadcasting to {len(self.ui_clients)} UI client(s): {message_data}") # Can be noisy
        message_json = json.dumps(message_data)

        disconnected_clients = set()
        for client in self.ui_clients:
            try:
                await client.send(message_json)
            except websockets.exceptions.ConnectionClosed:
                print("Failed to send to a UI client, connection closed.")
                disconnected_clients.add(client)
            except Exception as e:
                print(f"Error sending to UI client: {e}")
                disconnected_clients.add(client)

        for client in disconnected_clients:
            self.ui_clients.discard(client) # Use discard to avoid KeyError if already removed

    async def start_ui_websocket_server(self):
        # Extraer el puerto de UI_WEBSOCKET_URL (ej. ws://localhost:3001/api/ui -> 3001)
        try:
            # Example: "ws://localhost:3031/api/spot/ui" -> 3031
            ui_port = int(UI_WEBSOCKET_URL.split(":")[-1].split("/")[0])
        except ValueError:
            print(f"Error al parsear puerto de UI_WEBSOCKET_URL: '{UI_WEBSOCKET_URL}'. Usando puerto por defecto 3031.")
            ui_port = 3031
        except Exception as e: # Catch other potential parsing errors
            print(f"Error inesperado al parsear UI_WEBSOCKET_URL ('{UI_WEBSOCKET_URL}'): {e}. Usando puerto por defecto 3031.")
            ui_port = 3031

        async def ui_websocket_handler(websocket_client):
            print(f"Cliente UI conectado")
            self.ui_clients.add(websocket_client)
            try:
                # Keep connection alive and handle incoming messages if any
                async for message in websocket_client:
                    # Process messages from UI if needed
                    print(f"Received message from UI client: {message}")
                    # Example: await self.handle_ui_message(message)
                    pass
            except websockets.exceptions.ConnectionClosed:
                print("Cliente UI desconectado.")
            except Exception as e:
                print(f"Error en el handler del WebSocket de UI: {e}")
            finally:
                self.ui_clients.discard(websocket_client) # Use discard

        print(f"Iniciando servidor WebSocket para UI en ws://localhost:{ui_port}")
        # This relies on `import websockets` being active at the top of the file.
        # websockets.serve returns a Server object which can be awaited to keep it running,
        # but asyncio.gather will manage its task.
        await websockets.serve(ui_websocket_handler, "localhost", ui_port)

    async def close_http_session(self):
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
            print("V2: Sesión aiohttp cerrada.")

    async def close_ccxt_instances(self):
        print("V2: Cerrando instancias CCXT...")
        for exchange_id, instance in self.ccxt_instances.items():
            try:
                if hasattr(instance, 'close') and asyncio.iscoroutinefunction(instance.close):
                    await instance.close()
                # print(f"V2: Conexión CCXT cerrada para {exchange_id}")
            except Exception as e:
                print(f"V2: Error cerrando conexión CCXT para {exchange_id}: {e}")
        self.ccxt_instances.clear()
        print("V2: Todas las instancias CCXT programadas para cierre.")

async def main():
    app = CryptoArbitrageApp()
    try:
        await asyncio.gather(
            app.connect_and_process(),
            app.start_ui_websocket_server()
        )
    except KeyboardInterrupt:
        print("V2: Aplicación interrumpida.")
    finally:
        await app.close_http_session() # Close aiohttp session
        await app.close_ccxt_instances()

if __name__ == "__main__":
    asyncio.run(main())