# V2/arbitrage_executor.py
import asyncio
import json # Solo para un print de debug si se descomenta

async def evaluate_and_simulate_arbitrage(ai_data: dict, app_instance=None):
    simulation_results = {
        "decision_outcome": "NO_EVALUADA", # Posibles valores: NO_VIABLE_CALC_ERROR, NO_VIABLE_SL_OPERACION, EJECUTADA_SIMULADA_TP_INICIAL, NO_VIABLE_UMBRAL_PROFIT, ERROR_SIMULACION_NO_APP_INSTANCE, ABORTADA_EXMAX_SIN_PRECIO_FINAL, EJECUTADA_SIMULADA, ABORTADA_EXMAX_NO_RENTABLE_REPRICE, ABORTADA_EXMAX_SL_REPRICE, EJECUTADA_SIMULADA_TP_FINAL
        "final_simulated_profit_usdt": 0.0,
        "latest_price_ex_max_sell_asset": None,
        "simulated_steps": [],
        "error_message": None,
        "sl_operation_triggered": False,
        "tp_operation_triggered": False
    }

    profitability_info = ai_data.get('net_profitability_results', {})
    if profitability_info.get("error_message"):
        simulation_results["decision_outcome"] = "NO_VIABLE_CALC_ERROR"
        simulation_results["error_message"] = profitability_info["error_message"]
        return simulation_results

    calculated_net_profit_usdt = profitability_info.get('net_profit_usdt', 0.0)

    balance_config = ai_data.get('current_balance_config_v2', {})
    amount_invested_usdt = ai_data.get('determined_investment_usdt_v2', 0.0)

    sl_op_percentage = float(balance_config.get('stop_loss_percentage_operation', 50))
    tp_op_percentage = balance_config.get('take_profit_percentage_operation', None)
    if tp_op_percentage is not None:
        tp_op_percentage = float(tp_op_percentage)

    min_abs_profit_threshold_usdt = 0.01

    # --- Aplicar Stop Loss por Operación (sobre la rentabilidad calculada inicial) ---
    # SL se calcula como pérdida máxima aceptable sobre el capital invertido en ESTA operación.
    stop_loss_value_for_operation_usdt = -(amount_invested_usdt * (sl_op_percentage / 100.0))
    if calculated_net_profit_usdt < stop_loss_value_for_operation_usdt:
        simulation_results["decision_outcome"] = "NO_VIABLE_SL_OPERACION"
        simulation_results["final_simulated_profit_usdt"] = calculated_net_profit_usdt
        simulation_results["sl_operation_triggered"] = True
        simulation_results["simulated_steps"].append(f"Decisión: No viable. Pérdida ({calculated_net_profit_usdt:.4f} USDT) excede SL por operación ({stop_loss_value_for_operation_usdt:.4f} USDT / {sl_op_percentage}% de {amount_invested_usdt:.2f} USDT).")
        return simulation_results

    # --- Aplicar Take Profit por Operación (sobre la rentabilidad calculada inicial) ---
    if tp_op_percentage is not None and tp_op_percentage > 0:
        take_profit_value_for_operation_usdt = amount_invested_usdt * (tp_op_percentage / 100.0)
        if calculated_net_profit_usdt >= take_profit_value_for_operation_usdt:
            simulation_results["decision_outcome"] = "EJECUTADA_SIMULADA_TP_INICIAL"
            simulation_results["final_simulated_profit_usdt"] = calculated_net_profit_usdt
            simulation_results["tp_operation_triggered"] = True
            simulation_results["simulated_steps"].append(f"SIM: Take Profit alcanzado en evaluación inicial. Ganancia neta: {calculated_net_profit_usdt:.4f} USDT (TP: {take_profit_value_for_operation_usdt:.4f} USDT / {tp_op_percentage}% de {amount_invested_usdt:.2f} USDT).")
            return simulation_results

    # --- Decisión Primaria de Viabilidad (después de SL/TP iniciales) ---
    if calculated_net_profit_usdt < min_abs_profit_threshold_usdt:
        simulation_results["decision_outcome"] = "NO_VIABLE_UMBRAL_PROFIT"
        simulation_results["final_simulated_profit_usdt"] = calculated_net_profit_usdt
        simulation_results["simulated_steps"].append(f"Decisión: No viable. Ganancia neta inicial: {calculated_net_profit_usdt:.4f} USDT (Umbral mínimo de profit: {min_abs_profit_threshold_usdt:.4f} USDT).")
        return simulation_results

    simulation_results["simulated_steps"].append(f"INFO: Oportunidad viable inicialmente. Ganancia neta esperada: {calculated_net_profit_usdt:.4f} USDT.")
    simulation_results["simulated_steps"].append(f"SIM: Retirar {profitability_info.get('initial_investment_usdt',0) - profitability_info.get('usdt_after_initial_withdrawal',0):.4f} USDT como fee desde {ai_data.get('initial_usdt_holder_exchange_id')}.")
    simulation_results["simulated_steps"].append(f"SIM: Comprar {profitability_info.get('asset_bought_at_ex_min',0):.8f} {ai_data.get('symbol_name')} en {ai_data.get('ex_min_id_sebo')} (precio CCXT: {ai_data.get('current_price_ex_min_buy_asset')}).")
    simulation_results["simulated_steps"].append(f"SIM: Retirar {profitability_info.get('asset_to_transfer_to_ex_max',0):.8f} {ai_data.get('symbol_name')} desde {ai_data.get('ex_min_id_sebo')} (Fee: {profitability_info.get('asset_transfer_fee_at_ex_min',0):.8f} {ai_data.get('symbol_name')}, Red: {ai_data.get('asset_withdrawal_network_from_ex_min_sebo')}).")

    await asyncio.sleep(0.05) # Simular tiempo muy corto para re-verificación de precio

    if not app_instance or not hasattr(app_instance, 'get_current_market_prices'):
        simulation_results["decision_outcome"] = "ERROR_SIMULACION_NO_APP_INSTANCE"
        simulation_results["error_message"] = "Instancia de app o método get_current_market_prices no disponible."
        return simulation_results

    _, latest_bid_price_at_ex_max = await app_instance.get_current_market_prices(ai_data['ex_max_id_sebo'], ai_data['symbol'])
    simulation_results["latest_price_ex_max_sell_asset"] = latest_bid_price_at_ex_max
    simulation_results["simulated_steps"].append(f"INFO: Verificación precio venta en {ai_data.get('ex_max_id_sebo')} para {ai_data.get('symbol_name')}: {latest_bid_price_at_ex_max} USDT.")

    if latest_bid_price_at_ex_max is None:
        simulation_results["decision_outcome"] = "ABORTADA_EXMAX_SIN_PRECIO_FINAL"
        simulation_results["error_message"] = f"No se pudo obtener el precio actual en {ai_data.get('ex_max_id_sebo')} para la venta final."
        return simulation_results

    asset_to_sell = profitability_info.get('asset_to_transfer_to_ex_max', 0.0)
    fee_rate_taker_ex_max = ai_data.get('ex_max_taker_fee_rate_sebo', 0.0) or 0.0

    usdt_from_repriced_sale_net = (asset_to_sell * latest_bid_price_at_ex_max) * (1 - fee_rate_taker_ex_max)

    # El profit original (`calculated_net_profit_usdt`) se basó en `ai_data.get('current_price_ex_max_sell_asset')`.
    # El nuevo profit se basará en `latest_bid_price_at_ex_max`.
    # El cambio en el ingreso neto por la venta es:
    original_net_usdt_from_exmax_sale = (profitability_info.get('asset_to_transfer_to_ex_max',0) * \
                                        (ai_data.get('current_price_ex_max_sell_asset') or 0)) * \
                                        (1 - fee_rate_taker_ex_max)

    net_change_from_exmax_repricing = usdt_from_repriced_sale_net - original_net_usdt_from_exmax_sale
    final_simulated_profit_usdt_calc = calculated_net_profit_usdt + net_change_from_exmax_repricing

    simulation_results["final_simulated_profit_usdt"] = final_simulated_profit_usdt_calc

    # Aplicar Take Profit de nuevo con el precio re-verificado
    if tp_op_percentage is not None and tp_op_percentage > 0:
        take_profit_value_for_operation_usdt_recheck = amount_invested_usdt * (tp_op_percentage / 100.0)
        if final_simulated_profit_usdt_calc >= take_profit_value_for_operation_usdt_recheck:
            simulation_results["decision_outcome"] = "EJECUTADA_SIMULADA_TP_FINAL"
            simulation_results["tp_operation_triggered"] = True
            simulation_results["simulated_steps"].append(f"SIM: Take Profit alcanzado tras re-verificación de precio. Vender {asset_to_sell:.8f} {ai_data.get('symbol_name')} en {ai_data.get('ex_max_id_sebo')} al nuevo precio {latest_bid_price_at_ex_max} USDT. Ganancia neta final: {final_simulated_profit_usdt_calc:.4f} USDT.")
            return simulation_results

    # Aplicar Stop Loss de nuevo con el precio re-verificado
    if final_simulated_profit_usdt_calc < stop_loss_value_for_operation_usdt:
         simulation_results["decision_outcome"] = "ABORTADA_EXMAX_SL_REPRICE"
         simulation_results["sl_operation_triggered"] = True
         simulation_results["simulated_steps"].append(f"INFO: Venta abortada en {ai_data.get('ex_max_id_sebo')}. Nuevo precio {latest_bid_price_at_ex_max} USDT resulta en pérdida {final_simulated_profit_usdt_calc:.4f} USDT que excede SL por operación ({stop_loss_value_for_operation_usdt:.4f} USDT).")
         return simulation_results

    if final_simulated_profit_usdt_calc >= min_abs_profit_threshold_usdt:
        simulation_results["decision_outcome"] = "EJECUTADA_SIMULADA"
        simulation_results["simulated_steps"].append(f"SIM: Vender {asset_to_sell:.8f} {ai_data.get('symbol_name')} en {ai_data.get('ex_max_id_sebo')} al nuevo precio {latest_bid_price_at_ex_max} USDT. Ganancia neta final: {final_simulated_profit_usdt_calc:.4f} USDT.")
    else:
        simulation_results["decision_outcome"] = "ABORTADA_EXMAX_NO_RENTABLE_REPRICE"
        simulation_results["simulated_steps"].append(f"INFO: Venta abortada en {ai_data.get('ex_max_id_sebo')}. Nuevo precio {latest_bid_price_at_ex_max} USDT resulta en ganancia {final_simulated_profit_usdt_calc:.4f} USDT (Umbral mínimo: {min_abs_profit_threshold_usdt:.4f} USDT).")

    return simulation_results
