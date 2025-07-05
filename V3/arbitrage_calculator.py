# V2/arbitrage_calculator.py
import json # Solo para un print de debug si se descomenta

def calculate_net_profitability(ai_data: dict, investment_usdt: float):
    results = {
        "net_profit_usdt": 0.0,
        "net_profit_percentage": 0.0,
        "initial_investment_usdt": investment_usdt,
        "usdt_after_initial_withdrawal": 0.0,
        "asset_bought_at_ex_min": 0.0,
        "asset_transfer_fee_at_ex_min": 0.0,
        "asset_to_transfer_to_ex_max": 0.0,
        "usdt_from_sale_at_ex_max": 0.0,
        "final_usdt_after_all_fees": 0.0,
        "is_profitable": False,
        "calculation_stages": {},
        "error_message": None
    }

    if investment_usdt <= 0:
        results["error_message"] = "Investment USDT must be positive."
        return results

    price_buy_at_ex_min = ai_data.get('current_price_ex_min_buy_asset')
    price_sell_at_ex_max = ai_data.get('current_price_ex_max_sell_asset')

    fee_initial_usdt_withdrawal = ai_data.get('initial_usdt_withdrawal_selected_fee', 0.0) or 0.0
    fee_rate_taker_ex_min = ai_data.get('ex_min_taker_fee_rate_sebo', 0.0) or 0.0 # Using Sebo's fee rate as current
    fee_asset_withdrawal_ex_min = ai_data.get('asset_withdrawal_fee_from_ex_min_sebo', 0.0) or 0.0
    fee_rate_taker_ex_max = ai_data.get('ex_max_taker_fee_rate_sebo', 0.0) or 0.0 # Using Sebo's fee rate as current

    results["calculation_stages"]["s0_initial_investment_usdt"] = investment_usdt
    results["calculation_stages"]["s0_price_buy_at_ex_min"] = price_buy_at_ex_min
    results["calculation_stages"]["s0_price_sell_at_ex_max"] = price_sell_at_ex_max
    results["calculation_stages"]["s0_fee_initial_usdt_withdrawal"] = fee_initial_usdt_withdrawal
    results["calculation_stages"]["s0_fee_rate_taker_ex_min"] = fee_rate_taker_ex_min
    results["calculation_stages"]["s0_fee_asset_withdrawal_ex_min"] = fee_asset_withdrawal_ex_min
    results["calculation_stages"]["s0_fee_rate_taker_ex_max"] = fee_rate_taker_ex_max

    if price_buy_at_ex_min is None or price_sell_at_ex_max is None or price_buy_at_ex_min <= 0:
        results["error_message"] = "Current market prices are invalid or unavailable."
        return results

    usdt_available_at_ex_min = investment_usdt - fee_initial_usdt_withdrawal
    results["usdt_after_initial_withdrawal"] = usdt_available_at_ex_min
    results["calculation_stages"]["s1_usdt_available_at_ex_min"] = usdt_available_at_ex_min
    if usdt_available_at_ex_min <= 0:
        results["error_message"] = "No USDT left after initial withdrawal fee."
        return results

    asset_bought_gross = usdt_available_at_ex_min / price_buy_at_ex_min
    trading_fee_asset_at_ex_min = asset_bought_gross * fee_rate_taker_ex_min
    asset_bought_net = asset_bought_gross - trading_fee_asset_at_ex_min
    results["asset_bought_at_ex_min"] = asset_bought_net
    results["calculation_stages"]["s2_asset_bought_gross"] = asset_bought_gross
    results["calculation_stages"]["s2_trading_fee_asset_at_ex_min"] = trading_fee_asset_at_ex_min
    results["calculation_stages"]["s2_asset_bought_net"] = asset_bought_net
    if asset_bought_net <= 0:
        results["error_message"] = "Could not buy a positive amount of asset at exMin."
        return results

    results["asset_transfer_fee_at_ex_min"] = fee_asset_withdrawal_ex_min
    asset_to_transfer = asset_bought_net - fee_asset_withdrawal_ex_min
    results["asset_to_transfer_to_ex_max"] = asset_to_transfer
    results["calculation_stages"]["s3_asset_to_transfer"] = asset_to_transfer
    if asset_to_transfer <= 0:
        results["error_message"] = "No asset left to transfer after withdrawal fee from exMin."
        return results

    usdt_from_sale_gross = asset_to_transfer * price_sell_at_ex_max
    results["usdt_from_sale_at_ex_max"] = usdt_from_sale_gross # This is actually gross before this exMax trading fee
    trading_fee_usdt_at_ex_max = usdt_from_sale_gross * fee_rate_taker_ex_max
    final_usdt_after_all_fees = usdt_from_sale_gross - trading_fee_usdt_at_ex_max
    results["final_usdt_after_all_fees"] = final_usdt_after_all_fees
    results["calculation_stages"]["s4_usdt_from_sale_gross_before_trading_fee"] = usdt_from_sale_gross
    results["calculation_stages"]["s4_trading_fee_usdt_at_ex_max"] = trading_fee_usdt_at_ex_max
    results["calculation_stages"]["s4_final_usdt_after_all_fees"] = final_usdt_after_all_fees

    net_profit_usdt_calc = final_usdt_after_all_fees - investment_usdt
    results["net_profit_usdt"] = net_profit_usdt_calc
    if investment_usdt > 0 : # Avoid division by zero if investment is somehow zero
        results["net_profit_percentage"] = (net_profit_usdt_calc / investment_usdt) * 100

    if net_profit_usdt_calc > 0:
        results["is_profitable"] = True

    # print(f"CALCULATOR DEBUG: {json.dumps(results, indent=2)}")
    return results
