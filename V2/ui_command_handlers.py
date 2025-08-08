# V2/ui_command_handlers.py
import asyncio
import json
import uuid # For trade_id in trigger_real_trade
import os # For log file path in trigger_model_training (though currently simulated)
import numpy as np # For simulated data in training/evaluation
import pandas as pd # Potentially for data handling if reading from CSV for training

# Assuming these are accessible correctly. If V2 is a package, relative imports like .config are better.
# For now, direct import might work if PYTHONPATH is set or if these files are in the same root for execution.
from config import (
    OPERATIONS_LOG_CSV_PATH, SIMULATED_DATA_SAMPLES_TRAIN, SIMULATED_DATA_SAMPLES_TEST,
    REAL_TRADE_MIN_OPERATIONAL_USDT, REAL_TRADE_DEFAULT_INVESTMENT_USDT, DEFAULT_USDT_HOLDER_EXCHANGE_ID
)
from arbitrage_executor import execute_real_arbitrage # Placeholder for real trading logic
# calculate_net_profitability and evaluate_and_simulate_arbitrage are used by opportunity_processor,
# but trigger_arbitrage_simulation might call them directly via app.opp_processor or helpers.

class UICommandHandlers:
    def __init__(self, app_instance):
        self.app = app_instance # Reference to CryptoArbitrageApp instance

    async def handle_ui_message(self, websocket_client, message_json: str):
        try:
            message = json.loads(message_json)
            msg_type = message.get("type")
            payload = message.get("payload", {})
            client_id = id(websocket_client) # Simple way to identify client

            # print(f"UICommandHandlers: Received from UI (ID:{client_id}): Type={msg_type}") # Verbose

            if msg_type == "start_processing":
                print("UICommandHandlers: Comando 'start_processing' recibido.")
                self.app.opp_processor.enable_processing(True)
                await self.app.broadcast_to_ui({"type": "processing_status_update", "payload": {"is_processing": True}})
            elif msg_type == "stop_processing":
                print("UICommandHandlers: Comando 'stop_processing' recibido.")
                self.app.opp_processor.enable_processing(False)
                await self.app.broadcast_to_ui({"type": "processing_status_update", "payload": {"is_processing": False}})
            elif msg_type == "train_model":
                asyncio.create_task(self.trigger_model_training(payload, websocket_client))
            elif msg_type == "test_model":
                asyncio.create_task(self.trigger_model_evaluation(payload, websocket_client))
            elif msg_type == "get_model_status":
                await self.send_model_status(websocket_client)
            elif msg_type == "start_real_trade":
                asyncio.create_task(self.trigger_real_trade(payload, websocket_client))
            elif msg_type == "simulate_arbitrage_scenario":
                # This now calls the method on the opportunity processor instance
                asyncio.create_task(self.app.opp_processor.trigger_arbitrage_simulation_from_ui(payload, websocket_client))
            elif msg_type == "stop_real_trade":
                asyncio.create_task(self.stop_real_trade_task(payload, websocket_client))
            else:
                print(f"UICommandHandlers: Unknown message type from UI: {msg_type}")
                await websocket_client.send(json.dumps({"type": "error", "message": "Unknown command", "original_type": msg_type}))

        except json.JSONDecodeError:
            print("UICommandHandlers: Invalid JSON from UI.")
            await websocket_client.send(json.dumps({"type": "error", "message": "Invalid JSON"}))
        except Exception as e:
            print(f"UICommandHandlers: Error processing UI message: {e}")
            await websocket_client.send(json.dumps({"type": "error", "message": f"Server error: {str(e)}"}))

    async def send_model_status(self, websocket_client=None, status_override=None):
        if status_override:
            status_info = status_override
        else:
            status_info = {
                "is_trained": self.app.model.model_trained if self.app.model else False,
                "model_path": self.app.model.model_path if self.app.model else "N/A",
                "hyperparameters": self.app.model.hyperparameters if self.app.model else {},
                "summary": self.app.model.get_model_summary() if self.app.model and self.app.model.model_trained else "Model not trained."
            }
        message = {"type": "model_status_update", "payload": status_info}

        if websocket_client:
            try: await websocket_client.send(json.dumps(message))
            except Exception as e: print(f"UICommandHandlers: Error sending model status to client {id(websocket_client)}: {e}")
        else: await self.app.broadcast_to_ui(message) # Uses app's broadcast method

    async def trigger_model_training(self, payload: dict, websocket_client):
        client_id = id(websocket_client)
        await self.app.broadcast_to_ui({"type": "model_training_update", "payload": {"status": "starting_training", "client_id": client_id, "params": payload}})
        try:
            X_raw_list, y_raw_list = [], []
            # Currently, model training data loading from CSV is a placeholder in model.py or here.
            # For now, using simulated data.
            print("UICommandHandlers: Using simulated data for model training (CSV parsing placeholder).")
            num_samples = payload.get("num_simulated_samples", SIMULATED_DATA_SAMPLES_TRAIN)
            # Simplified feature set for example
            sim_X = [{'gross_percentage_diff_sebo': np.random.uniform(0,5),
                        'price_ex_min_buy_asset_sebo': np.random.uniform(10000,60000),
                        # ... (add all features model expects) ...
                        'ex_min_id_sebo': np.random.choice(['binance','kraken']),
                        'ex_max_id_sebo': np.random.choice(['binance','gemini']),
                        'symbol_name': np.random.choice(['BTC','ETH'])} for _ in range(num_samples)]
            sim_y = np.random.randint(0, 2, num_samples).tolist()
            X_raw_list, y_raw_list = sim_X, sim_y

            if not self.app.model: raise Exception("Model not initialized in app.")
            training_results = self.app.model.train(X_raw_list, y_raw_list) # Call model's train

            status_msg, final_status = (f"Training failed: {training_results.get('error', 'Unknown')}", "failed") if not training_results or "error" in training_results else ("Training completed.", "success")
            if final_status == "success": self.app.model.save_model()
            await self.app.broadcast_to_ui({"type": "model_training_update", "payload": {"status": final_status, "message": status_msg, "results": training_results, "client_id": client_id}})
        except Exception as e:
            print(f"UICommandHandlers: Error in trigger_model_training: {e}")
            await self.app.broadcast_to_ui({"type": "model_training_update", "payload": {"status": "failed", "error": str(e), "client_id": client_id}})
        finally:
            await self.send_model_status() # Send updated status to all

    async def trigger_model_evaluation(self, payload: dict, websocket_client):
        client_id = id(websocket_client)
        await self.app.broadcast_to_ui({"type": "model_evaluation_update", "payload": {"status": "starting_evaluation", "client_id": client_id, "params": payload}})
        if not self.app.model or not self.app.model.model_trained:
            await self.app.broadcast_to_ui({"type": "model_evaluation_update", "payload": {"status": "failed", "error": "Model not trained.", "client_id": client_id}}); return
        try:
            num_samples = payload.get("num_simulated_samples", SIMULATED_DATA_SAMPLES_TEST)
            sim_X = [{'gross_percentage_diff_sebo': np.random.uniform(0,5),
                        # ... (all features) ...
                        'ex_min_id_sebo': np.random.choice(['binance','kraken']),
                        'ex_max_id_sebo': np.random.choice(['binance','gemini']),
                        'symbol_name': np.random.choice(['BTC','ETH'])} for _ in range(num_samples)]
            sim_y = np.random.randint(0, 2, num_samples).tolist()
            eval_metrics = self.app.model.evaluate(sim_X, sim_y) # Call model's evaluate
            status_msg, final_status = (f"Evaluation failed: {eval_metrics.get('error', 'Unknown')}", "failed") if not eval_metrics or "error" in eval_metrics else ("Evaluation completed.", "success")
            await self.app.broadcast_to_ui({"type": "model_evaluation_update", "payload": {"status": final_status, "message": status_msg, "metrics": eval_metrics, "client_id": client_id}})
        except Exception as e:
            print(f"UICommandHandlers: Error in trigger_model_evaluation: {e}")
            await self.app.broadcast_to_ui({"type": "model_evaluation_update", "payload": {"status": "failed", "error": str(e), "client_id": client_id}})

    async def trigger_real_trade(self, payload: dict, websocket_client):
        client_id = id(websocket_client); opportunity_data = payload.get("opportunity"); trade_id = str(uuid.uuid4())
        if not opportunity_data or not isinstance(opportunity_data, dict):
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload": {"trade_id":trade_id, "status":"failed", "error":"Invalid opportunity data", "client_id":client_id}}); return

        symbol = opportunity_data.get('symbol', 'N/A')
        print(f"UICommandHandlers: Real trade (ID:{trade_id}) triggered for {symbol}")

        if not self.app.usdt_holder_exchange_id:
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload": {"trade_id":trade_id, "status":"failed", "error":"USDT holder not set in app", "client_id":client_id}}); return

        # Use helper to get balance config
        balance_config = await self.app.helpers.load_balance_config_for_exchange(self.app.usdt_holder_exchange_id)
        if not balance_config or balance_config.get('balance_usdt') is None:
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload": {"trade_id":trade_id, "status":"failed", "error":"Could not load balance via helpers", "client_id":client_id}}); return

        current_usdt_balance = float(balance_config.get('balance_usdt', 0))
        investment_usdt = payload.get("investment_amount_usdt", float(balance_config.get('fixed_investment_usdt', REAL_TRADE_DEFAULT_INVESTMENT_USDT)))
        if current_usdt_balance < 100.0: investment_usdt = current_usdt_balance / 2
        investment_usdt = min(investment_usdt, current_usdt_balance)

        if investment_usdt < REAL_TRADE_MIN_OPERATIONAL_USDT:
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload": {"trade_id":trade_id, "status":"failed", "error":f"Investment < min op ({REAL_TRADE_MIN_OPERATIONAL_USDT:.2f}): {investment_usdt:.2f}", "client_id":client_id}}); return

        await self.app.broadcast_to_ui({"type":"real_trading_update", "payload": {"trade_id":trade_id, "status":"starting_real_trade", "opportunity":opportunity_data, "investment_amount_usdt":investment_usdt, "client_id":client_id}})
        task = asyncio.create_task(self._run_and_manage_real_trade(trade_id, opportunity_data, investment_usdt, client_id))
        self.app.active_real_trades[trade_id] = task

    async def _run_and_manage_real_trade(self, trade_id: str, opportunity_data: dict, investment_usdt: float, client_id: int):
        symbol = opportunity_data.get('symbol', 'N/A')
        try:
            results = await execute_real_arbitrage(opportunity_data, self.app, investment_usdt) # Pass app instance
            payload = {"trade_id":trade_id, "status":results.get("status","unknown"), "message":results.get("message",""), "results":results, "opportunity":opportunity_data, "client_id":client_id}
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload":payload})
        except Exception as e:
            print(f"UICommandHandlers: Error in _run_and_manage_real_trade for {trade_id}: {e}")
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload":{"trade_id":trade_id, "status":"failed", "error":str(e), "opportunity":opportunity_data, "client_id":client_id}})
        finally:
            if trade_id in self.app.active_real_trades: del self.app.active_real_trades[trade_id]; print(f"UICommandHandlers: Trade {trade_id} removed from active.")

    async def stop_real_trade_task(self, payload: dict, websocket_client):
        client_id = id(websocket_client); trade_id = payload.get("trade_id")
        if not trade_id:
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload":{"trade_id":None, "status":"stop_failed", "error":"No trade_id for stop.", "client_id":client_id}}); return

        task = self.app.active_real_trades.get(trade_id)
        status_msg = ""
        if task:
            if not task.done():
                task.cancel()
                try: await task
                except asyncio.CancelledError: status_msg = "Trade task cancelled."
                except Exception as e: status_msg = f"Task ended with error: {e}"
            else: status_msg = "Trade task already done."
            if trade_id in self.app.active_real_trades: del self.app.active_real_trades[trade_id]
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload":{"trade_id":trade_id, "status":"stop_attempted", "message":status_msg, "client_id":client_id}})
        else:
            await self.app.broadcast_to_ui({"type":"real_trading_update", "payload":{"trade_id":trade_id, "status":"stop_failed", "error":"Trade task not found.", "client_id":client_id}})

    # trigger_arbitrage_simulation is now primarily handled by OpportunityProcessor via a UI command.
    # If UICommandHandlers needs to trigger it directly for some reason, it would call self.app.opp_processor.trigger_arbitrage_simulation_from_ui
    # For now, the call from handle_ui_message goes directly to the opp_processor instance.
