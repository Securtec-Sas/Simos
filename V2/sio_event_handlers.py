# V2/sio_event_handlers.py
import asyncio
import json # broadcast_to_ui uses json.dumps
from opportunity_processor import OpportunityProcessor
class SIOEventHandlers:
    def __init__(self, app_instance):
        self.app = app_instance
        self.opportunity_processor = OpportunityProcessor(app_instance)

    async def on_enable_processing(self, status: bool):
        self.opportunity_processor.enable_processing(status)
        
    async def on_top_20_data_received(self, data):
        # print(f"SIOEventHandler: Received 'top_20_data': {len(data) if isinstance(data, list) else 'Invalid data type'} items")
        # 1. Validar datos de entrada
        if not isinstance(data, list):
            print(f"SIOEventHandler: Invalid 'top_20_data' type: {type(data)}")
            self.app.current_top_20_list = []
            await self.app.broadcast_to_ui({
                "type": "top_20_update", "payload": [],
                "error": "Received invalid data type for top_20_data from Sebo"
            })
            return

        # 2. Actualizar el estado y notificar a la UI
        self.app.current_top_20_list = data
        ui_message = {"type": "top_20_update", "payload": self.app.current_top_20_list}
        await self.app.broadcast_to_ui(ui_message)

        # 3. Decidir si se procesa el nuevo lote de oportunidades
        if not self.app.opp_processor.is_processing_enabled:
            # print("SIOEventHandler: Processing is disabled. Not starting batch.") # Opcional para depuración
            return

        if self.app.is_processing_opportunity_batch:
            # print("SIOEventHandler: Batch processing already in progress.") # Opcional para depuración
            return
        
        # 4. Iniciar el procesamiento
        print("SIOEventHandler: Scheduling new opportunity batch processing.")
        self.app.is_processing_opportunity_batch = True
        asyncio.create_task(self.app.opp_processor.process_opportunity_batch())

    async def on_balances_update_from_sebo(self, data):
        print(f"SIOEventHandler: Received 'balances-update' from Sebo: {data}") # Can be verbose
        self.app.latest_balances_from_sebo = data
        print(f"SIOEventHandler: Received 'balances-update' from Sebo: {self.app.latest_balances_from_sebo}")
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
