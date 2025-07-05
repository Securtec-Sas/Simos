# V2/opportunity_processor.py
import asyncio
import json
from datetime import datetime, timezone
import numpy as np # Para características de modelo, si es necesario
import pandas as pd # Para características de modelo, si es necesario

from arbitrage_calculator import calculate_net_profitability
from arbitrage_executor import evaluate_and_simulate_arbitrage
from data_logger import log_operation_to_csv
from config import (
    MIN_PROFIT_PERCENTAGE, MIN_PROFIT_FOR_ADJUSTMENT_USDT,
    INVESTMENT_ADJUSTMENT_STEP_USDT, MAX_INVESTMENT_ADJUSTMENT_ATTEMPTS,
    MAX_INVESTMENT_PERCENTAGE_OF_BALANCE, OPERATIONS_LOG_CSV_PATH,
    REAL_TRADE_MIN_OPERATIONAL_USDT, BATCH_PRACTICAL_MIN_INVESTMENT,
    DEFAULT_USDT_HOLDER_EXCHANGE_ID # Necesario si app.usdt_holder_exchange_id es None
)

class OpportunityProcessor:
    def __init__(self, app_instance):
        self.app = app_instance # Reference to the main CryptoArbitrageApp instance in principal.py
        self.is_processing_enabled = False
    def enable_processing(self, status: bool):
        self.is_processing_enabled = status
        print(f"OpportunityProcessor: Processing enabled -> {self.is_processing_enabled}")
        
    async def process_opportunity_batch(self):
        if not self.is_processing_enabled:
            return
        else:
            print(f"OpportunityProcessor: Iniciando procesamiento de lote de {len(self.app.current_top_20_list)} oportunidades.")
            opportunities_to_process = list(self.app.current_top_20_list) # Make a copy
            acted_in_batch = False

            # Ensure main balance config is loaded once before starting batch, if needed often
            # This assumes self.app.usdt_holder_exchange_id is set.
            # The individual opportunity processing will also check/load if necessary for the specific holder.
            if self.app.usdt_holder_exchange_id and \
               (not self.app.current_balance_config or \
                self.app.usdt_holder_exchange_id != self.app.current_balance_config.get("id_exchange")):
                print(f"OpportunityProcessor: Precargando configuración de balance para {self.app.usdt_holder_exchange_id}")
                await self.app.helpers.load_balance_config(self.app.usdt_holder_exchange_id)


            for opp_data in opportunities_to_process:
                symbol = opp_data.get('symbol', 'N/A_BATCH')
                # ai_input_for_log is the dictionary that will be logged for this opportunity
                ai_input_for_log = {
                    'symbol': symbol,
                    'analysis_id': opp_data.get('analysis_id'),
                    'batch_process_timestamp': datetime.now(timezone.utc).isoformat()
                }

                try:
                    # ----- 1. Initial Checks & Data Gathering (uses self.app.helpers and self.app attributes) -----
                    current_usdt_holder = self.app.usdt_holder_exchange_id or DEFAULT_USDT_HOLDER_EXCHANGE_ID
                    if not current_usdt_holder:
                        print(f"OpportunityProcessor: {symbol} | Saltando: usdt_holder_exchange_id no configurado globalmente."); continue

                    # Ensure balance config for the current USDT holder is loaded
                    if not self.app.current_balance_config or current_usdt_holder != self.app.current_balance_config.get("id_exchange"):
                        if not await self.app.helpers.load_balance_config(current_usdt_holder): # Uses helper
                            print(f"OpportunityProcessor: {symbol} | Saltando: No se pudo cargar config de Balance para {current_usdt_holder}.")
                            ai_input_for_log.update({'error_message': f'Failed to load balance for {current_usdt_holder}'});
                            await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    ai_input_for_log['current_balance_config_before_op'] = dict(self.app.current_balance_config)
                    if self.app.global_sl_active_flag:
                        ai_input_for_log['stop_reason'] = "Global SL Active"; await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue


                    current_bal = float(self.app.current_balance_config.get('balance_usdt', 0))
                    initial_cap_sl = float(self.app.current_balance_config.get('initial_capital_for_global_sl',0))
                    sl_global_perc = float(self.app.current_balance_config.get('stop_loss_percentage_global',50))
                    if initial_cap_sl > 0 and current_bal < (initial_cap_sl * (1-(sl_global_perc/100.0))):
                        self.app.global_sl_active_flag = True;
                        ai_input_for_log['stop_reason'] = f"Global SL Triggered ({current_bal:.2f})"; await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    # ----- 2. Prepare Features for ML Model -----
                    usdt_wd_info = await self.app.helpers.get_usdt_withdrawal_info(current_usdt_holder) # Uses helper
                    model_features = {
                        'gross_percentage_diff_sebo': float(str(opp_data.get('percentage_difference','0%')).replace('%','')) if opp_data.get('percentage_difference') else 0.0,
                        'price_ex_min_buy_asset_sebo': opp_data.get('price_at_exMin_to_buy_asset'),
                        'price_ex_max_sell_asset_sebo': opp_data.get('price_at_exMax_to_sell_asset'),
                        'ex_min_taker_fee_rate_sebo': opp_data.get('fees_exMin',{}).get('taker_fee'),
                        'ex_max_taker_fee_rate_sebo': opp_data.get('fees_exMax',{}).get('taker_fee'),
                        'asset_withdrawal_fee_from_ex_min_sebo': opp_data.get('fees_exMin',{}).get('withdrawal_fee_asset'),
                        'initial_usdt_withdrawal_selected_fee': usdt_wd_info.get('selected_fee', 1.0),
                        'ex_min_id_sebo': opp_data.get('exchange_min_id'),
                        'ex_max_id_sebo': opp_data.get('exchange_max_id'),
                        'symbol_name': opp_data.get('symbol_name', symbol.split('/')[0] if '/' in symbol else symbol)
                    }
                    ai_input_for_log['model_input_features'] = model_features

                    # ----- 3. Get Model Prediction -----
                    model_predicts_profitable = True # Default if model not used or fails
                    if self.app.model and self.app.model.model_trained:
                        pred_out = self.app.model.predict([model_features])
                        if pred_out and 'predictions' in pred_out:
                            model_predicts_profitable = pred_out['predictions'][0] == 1
                            ai_input_for_log['model_prediction_class'] = pred_out['predictions'][0]
                            if 'probabilities' in pred_out: ai_input_for_log['model_prediction_probabilities'] = pred_out['probabilities'][0]
                        else: model_predicts_profitable = False
                    elif self.app.model and not self.app.model.model_trained: ai_input_for_log['model_decision_info'] = "SKIPPED_MODEL_NOT_TRAINED"

                    if not model_predicts_profitable:
                        ai_input_for_log['decision_outcome_step'] = "MODEL_SAYS_NO_ACTION"
                        await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    ai_input_for_log['decision_outcome_step'] = "MODEL_SAYS_ACTION_PENDING_VERIFICATION"

                    # ----- 4. Detailed Simulation & Verification (if model predicted profitable) -----
                    inv_mode = self.app.current_balance_config.get('investment_mode', "FIXED")
                    min_op = REAL_TRADE_MIN_OPERATIONAL_USDT
                    if current_bal < min_op: await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    inv_amount = current_bal if current_bal < 150 else \
                                 float(self.app.current_balance_config.get('fixed_investment_usdt',50)) if inv_mode=="FIXED" else \
                                 current_bal * (float(self.app.current_balance_config.get('investment_percentage',10))/100.0)
                    if current_bal >=150 and inv_amount < BATCH_PRACTICAL_MIN_INVESTMENT: inv_amount = BATCH_PRACTICAL_MIN_INVESTMENT
                    inv_amount = min(inv_amount, current_bal)
                    if inv_amount < min_op: await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    # Populate/update ai_input_for_log for detailed simulation
                    ai_input_for_log.update({k:opp_data.get(k) for k in ['fetch_timestamp_sebo','exchange_min_name','price_at_exMin_to_buy_asset','exchange_max_name','price_at_exMax_to_sell_asset']})
                    ai_input_for_log.update({
                        'ex_min_id_sebo': model_features['ex_min_id_sebo'], 'ex_max_id_sebo': model_features['ex_max_id_sebo'],
                        'ex_min_maker_fee_rate_sebo': opp_data.get('fees_exMin',{}).get('maker_fee'),
                        'asset_withdrawal_network_from_ex_min_sebo': opp_data.get('fees_exMin',{}).get('withdrawal_network'),
                        'ex_max_maker_fee_rate_sebo': opp_data.get('fees_exMax',{}).get('maker_fee'),
                        'initial_usdt_holder_exchange_id': current_usdt_holder,
                        'initial_usdt_withdrawal_selected_fee': model_features['initial_usdt_withdrawal_selected_fee'],
                        'initial_usdt_withdrawal_selected_network': usdt_wd_info.get('selected_network'),
                        'initial_usdt_all_networks_info': usdt_wd_info.get('all_networks'),
                        'processing_timestamp_v2_start': asyncio.get_event_loop().time(),
                        'current_balance_config_v2': dict(self.app.current_balance_config), # Pass a copy
                        'determined_investment_usdt_v2': inv_amount
                    })
                    cp_buy, _ = await self.app.helpers.get_current_market_prices(ai_input_for_log['ex_min_id_sebo'], symbol)
                    _, cp_sell = await self.app.helpers.get_current_market_prices(ai_input_for_log['ex_max_id_sebo'], symbol)
                    ai_input_for_log.update({'current_price_ex_min_buy_asset': cp_buy or model_features['price_ex_min_buy_asset_sebo'],
                                             'current_price_ex_max_sell_asset': cp_sell or model_features['price_ex_max_sell_asset_sebo']})
                    if ai_input_for_log['current_price_ex_min_buy_asset'] and ai_input_for_log['current_price_ex_max_sell_asset'] and ai_input_for_log['current_price_ex_min_buy_asset'] > 0:
                        ai_input_for_log['current_percentage_difference'] = ((ai_input_for_log['current_price_ex_max_sell_asset'] - ai_input_for_log['current_price_ex_min_buy_asset'])/ai_input_for_log['current_price_ex_min_buy_asset'])*100
                    else: ai_input_for_log['current_percentage_difference'] = None
                    if ai_input_for_log.get('initial_usdt_withdrawal_selected_fee') is None: await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    orig_inv_detail = inv_amount; best_profit_res = None; best_inv = inv_amount
                    max_inv_cap = current_bal * (MAX_INVESTMENT_PERCENTAGE_OF_BALANCE / 100.0); final_adj_attempt = 0
                    for adj_attempt in range(MAX_INVESTMENT_ADJUSTMENT_ATTEMPTS + 1):
                        final_adj_attempt = adj_attempt
                        if adj_attempt > 0: inv_amount += INVESTMENT_ADJUSTMENT_STEP_USDT
                        inv_amount = min(inv_amount, current_bal, max_inv_cap)
                        if inv_amount < REAL_TRADE_MIN_OPERATIONAL_USDT and adj_attempt > 0: break
                        ai_input_for_log['determined_investment_usdt_v2'] = inv_amount
                        curr_profit_res = calculate_net_profitability(ai_input_for_log, inv_amount)
                        if curr_profit_res is None or curr_profit_res.get("error_message"):
                            if adj_attempt == 0: ai_input_for_log['net_profitability_results'] = curr_profit_res or {"error_message":"Calc error"}
                            break
                        if best_profit_res is None or curr_profit_res.get('net_profit_usdt',0) > best_profit_res.get('net_profit_usdt',0):
                            best_profit_res = curr_profit_res; best_inv = inv_amount
                        if curr_profit_res.get('net_profit_usdt',0) >= MIN_PROFIT_FOR_ADJUSTMENT_USDT: break
                        if inv_amount >= current_bal or inv_amount >= max_inv_cap: break
                        if adj_attempt >= MAX_INVESTMENT_ADJUSTMENT_ATTEMPTS: break

                    profit_res = best_profit_res; inv_amount = best_inv
                    ai_input_for_log.update({'determined_investment_usdt_v2': inv_amount, 'net_profitability_results': profit_res, 'investment_adjustment_attempts_made': final_adj_attempt + 1, 'original_calculated_investment_before_adjustment': orig_inv_detail})

                    if not profit_res or profit_res.get("error_message"):
                        error_message = profit_res.get('error_message', 'Detailed Profitability calc failed') if profit_res else 'Detailed Profitability calc failed'
                        ai_input_for_log.setdefault('simulation_results',{})['error_message'] = error_message
                        ai_input_for_log.setdefault('simulation_results',{})['decision_outcome'] = "ERROR_PROFITABILITY_DETAIL_BATCH"
                        await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH); continue

                    sim_res = await evaluate_and_simulate_arbitrage(ai_input_for_log, self.app) # Pass app instance
                    ai_input_for_log['simulation_results'] = sim_res

                    decision = sim_res.get('decision_outcome')
                    print(f"OpportunityProcessor: {symbol} | Verif. Detallada - Inv: {inv_amount:.2f} USDT. Sim Outcome: {decision}, Sim Profit: {sim_res.get('final_simulated_profit_usdt'):.4f} USDT")

                    if decision in ["EJECUTADA_SIMULADA", "EJECUTADA_SIMULADA_TP_INICIAL", "EJECUTADA_SIMULADA_TP_FINAL"]:
                        print(f"OpportunityProcessor: {symbol} - Modelo OK, Verificación OK. ACTUANDO (simulated balance update).")
                        acted_in_batch = True
                        profit_loss = sim_res.get('final_simulated_profit_usdt',0.0)
                        orig_holder = ai_input_for_log.get('initial_usdt_holder_exchange_id')
                        final_dest = ai_input_for_log.get('ex_max_id_sebo')
                        actual_inv = float(ai_input_for_log.get('determined_investment_usdt_v2',0.0))

                        # Update local self.app.current_balance_config first
                        if orig_holder == self.app.usdt_holder_exchange_id:
                            self.app.current_balance_config['balance_usdt'] = float(self.app.current_balance_config.get('balance_usdt',0)) - actual_inv

                        orig_conf_sebo = await self.app.helpers.load_balance_config_for_exchange(orig_holder)
                        if orig_conf_sebo: await self.app.helpers.update_balance_on_sebo(orig_holder, float(orig_conf_sebo.get('balance_usdt',0)) - actual_inv, orig_conf_sebo)

                        final_conf_sebo = await self.app.helpers.load_balance_config_for_exchange(final_dest)
                        if not final_conf_sebo: final_conf_sebo = {"id_exchange":final_dest, "balance_usdt":0}
                        new_final_bal = float(final_conf_sebo.get('balance_usdt',0)) + actual_inv + profit_loss
                        if not final_conf_sebo.get('initial_capital_for_global_sl') or final_conf_sebo.get('initial_capital_for_global_sl')==0:
                            final_conf_sebo['initial_capital_for_global_sl'] = new_final_bal
                        await self.app.helpers.update_balance_on_sebo(final_dest, new_final_bal, final_conf_sebo)

                        if orig_holder != final_dest:
                            self.app.usdt_holder_exchange_id = final_dest
                            await self.app.helpers.load_balance_config(self.app.usdt_holder_exchange_id) # Reloads self.app.current_balance_config
                        elif self.app.usdt_holder_exchange_id == final_dest: # if holder is same, update in-memory
                            self.app.current_balance_config['balance_usdt'] = new_final_bal

                        await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH)
                        self.app.is_processing_opportunity_batch = False
                        print(f"OpportunityProcessor: Acción SIMULADA (bal update) en {symbol}. Ciclo de lote finalizado.")
                        return
                    else:
                        await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH)
                except Exception as e_opp_detail:
                    print(f"OpportunityProcessor: Error procesando {symbol} en lote (detalle): {e_opp_detail}")
                    ai_input_for_log.setdefault('error_processing_opportunity',str(e_opp_detail))
                    ai_input_for_log.setdefault('simulation_results', {})['decision_outcome'] = "ERROR_IN_BATCH_PROCESSING_DETAIL"
                    await log_operation_to_csv(ai_input_for_log, OPERATIONS_LOG_CSV_PATH)
                    continue
                finally:
                    if not acted_in_batch: print("OpportunityProcessor: Ninguna oportunidad procesada resultó en acción en este lote.")
                    self.app.is_processing_opportunity_batch = False
                    print("OpportunityProcessor: Procesamiento de lote finalizado.")
