"""
Exchange interfaces to be implemented
=====================================

This file lists exchange interfaces that should be implemented in the future.

Supported Exchanges (Implemented):
----------------------------------
- Binance (app/exchanges/binance.py)

To Be Implemented:
------------------

1. OKX Exchange
   - File: app/exchanges/okx.py
   - Class: OKXExchange(ExchangeBase)
   - Features: Spot, futures, options trading
   - Priority: High

2. Huobi Exchange
   - File: app/exchanges/huobi.py
   - Class: HuobiExchange(ExchangeBase)
   - Features: Spot trading, USDT-margined contracts
   - Priority: Medium

3. Bybit Exchange
   - File: app/exchanges/bybit.py
   - Class: BybitExchange(ExchangeBase)
   - Features: Derivatives trading, spot trading
   - Priority: Medium

4. Coinbase Exchange
   - File: app/exchanges/coinbase.py
   - Class: CoinbaseExchange(ExchangeBase)
   - Features: Spot trading (US regulation compliant)
   - Priority: Low

5. Kraken Exchange
   - File: app/exchanges/kraken.py
   - Class: KrakenExchange(ExchangeBase)
   - Features: Spot and futures trading
   - Priority: Low

6. Gate.io Exchange
   - File: app/exchanges/gateio.py
   - Class: GateIOExchange(ExchangeBase)
   - Features: Wide variety of altcoins
   - Priority: Low

Implementation Template:
-----------------------

```python
from app.exchanges.base import ExchangeBase
from app.models.market_data import KlineData, TickerData, OrderBookData
from app.models.signals import OrderData
import ccxt.async_support as ccxt

class NewExchange(ExchangeBase):
    def __init__(self, api_key: str = "", api_secret: str = ""):
        super().__init__(api_key, api_secret)
        self.exchange = ccxt.new_exchange({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,
        })
    
    async def fetch_klines(self, symbol, timeframe, since, limit):
        # Implementation here
        pass
    
    async def fetch_ticker(self, symbol):
        # Implementation here
        pass
    
    # ... implement all abstract methods from ExchangeBase
```

Usage in Nodes:
--------------

```python
from app.exchanges.binance import BinanceExchange
from app.exchanges.okx import OKXExchange  # When implemented

# In node initialization
exchange = BinanceExchange(api_key, api_secret)
# or
exchange = OKXExchange(api_key, api_secret)

# The rest of the node code remains the same
klines = await exchange.fetch_klines('BTC/USDT', '1h')
```

Notes:
------
- All implementations should use ccxt library for consistency
- Follow the same error handling pattern as BinanceExchange
- Ensure symbol format conversion (e.g., 'BTC/USDT' vs 'BTCUSDT')
- Test thoroughly before deploying to production
- Add appropriate logging for debugging
"""

# TODO: Implement OKX exchange
# TODO: Implement Huobi exchange
# TODO: Implement Bybit exchange
# TODO: Implement Coinbase exchange
# TODO: Implement Kraken exchange
# TODO: Implement Gate.io exchange

