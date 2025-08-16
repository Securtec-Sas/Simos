from config import SEBO_API_BASE_URL

async def get_last_balance(http_session):
    api_url = f"{SEBO_API_BASE_URL}/api/balances/last"
    async with http_session.get(api_url) as response:
        if response.status == 200:
            data = await response.json()
            return {
                "last_balance": data.get("balance_usdt"),
                "usdt_holder_ex1change_id ": data.get("id_exchange"),
            }
        return {"error": "Failed to fetch last balance"}

async def get_balance_config(self, exchange_id: str):
    """
    Carga la configuración de balance para un exchange consultando el endpoint /api/config.
    """
    await self._ensure_http_session()
    url = f"{SEBO_API_BASE_URL}/api/config"
    try:
        async with self.http_session.get(url, params={"exchange_id": exchange_id}) as resp:
            if resp.status == 200:
                config = await resp.json()
                self.current_balance_config = config
                return True
            else:
                print(f"Error loading config: HTTP {resp.status}")
                return False
    except Exception as e:
        print(f"Exception loading config from {url}: {e}")
        return False

async def update_balance(http_session, exchange_id, payload):
    api_url = f"{SEBO_API_BASE_URL}/balances/exchange/{exchange_id}"
    async with http_session.put(api_url, json=payload) as response:
        if response.status == 200:
            return await response.json()
        return None

async def get_usdt_withdrawal_info(http_session, from_exchange_id):
    api_url = f"{SEBO_API_BASE_URL}/exchanges/{from_exchange_id}/withdrawal-fees/USDT"
    async with http_session.get(api_url) as response:
        if response.status == 200:
            return await response.json()
        return None
    
async def get_symbol_withdrawal_info(http_session, from_exchange_id, symbol):
    api_url = f"{SEBO_API_BASE_URL}/exchanges/{from_exchange_id}/withdrawal-fees/{symbol}"
    async with http_session.get(api_url) as response:
        if response.status == 200:
            return await response.json()
        return None
    

async def get_current_market_prices(self, exchange_id: str, symbol: str):
    """Obtiene los precios de mercado actuales para un símbolo en un exchange (dummy)."""
    return (100, 99)


