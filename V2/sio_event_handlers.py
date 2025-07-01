# V2/sio_event_handlers.py
import asyncio
import json # broadcast_to_ui uses json.dumps

class SIOEventHandlers:
    def __init__(self, app_instance):
        self.app = app_instance # Reference to the main CryptoArbitrageApp instance

    async def on_top_20_data_received(self, data):
        print(f"SIOEventHandler: Received 'top_20_data': {len(data) if isinstance(data, list) else 'Invalid data type'} items")
        if isinstance(data, list):
            self.app.current_top_20_list = data
            # Broadcast the updated Top 20 list to UI clients
            ui_message = {
                "type": "top_20_update",
                "payload": self.app.current_top_20_list
            }
            await self.app.broadcast_to_ui(ui_message) # Call app's broadcast method

            if not self.app.is_processing_opportunity_batch:
                print("SIOEventHandler: Scheduling new opportunity batch processing.") # Can be verbose
            if  self.app.is_processing_opportunity_batch == True:
                # process_opportunity_batch will be on opp_processor instance
                #debe llevar como parametro la lista de top20Analisis
                asyncio.create_task(self.app.opp_processor.process_opportunity_batch())
            else:
                print("SIOEventHandler: Already processing an opportunity batch.") # Can be verbose
        else:
            print(f"SIOEventHandler: Invalid 'top_20_data': {type(data)}")
            self.app.current_top_20_list = []
            await self.app.broadcast_to_ui({
                "type": "top_20_update",
                "payload": [],
                "error": "Received invalid data type for top_20_data from Sebo"
            })

    async def on_balances_update_from_sebo(self, data):
        print(f"SIOEventHandler: Received 'balances-update' from Sebo: {data}") # Can be verbose
        self.app.latest_balances_from_sebo = data

        ui_message = {
            "type": "full_balance_update_from_v2",
            "payload": self.app.latest_balances_from_sebo
        }
        await self.app.broadcast_to_ui(ui_message) # Call app's broadcast method

    async def on_spot_arb_data_method(self, data):
        """
        Handler for individual 'spot-arb' events from Sebo.
        With 'process_opportunity_batch' as the primary decision driver,
        this method is now mainly for logging or potential lightweight updates,
        not for initiating full analysis or trades.
        """
        # symbol = data.get('symbol', 'N/A_INDIV_EVENT')
        # analysis_id = data.get('analysis_id', 'N/A_INDIV_EVENT')
        # print(f"SIOEventHandler: Received individual 'spot-arb': ID={analysis_id}, Symbol={symbol}. Batch processor is primary.")
        pass
