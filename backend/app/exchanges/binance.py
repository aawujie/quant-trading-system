"""Binance exchange implementation"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

import ccxt.async_support as ccxt

from app.exchanges.base import ExchangeBase
from app.models.market_data import KlineData, TickerData, OrderBookData
from app.models.signals import OrderData, SignalType

logger = logging.getLogger(__name__)


class BinanceExchange(ExchangeBase):
    """Binance exchange implementation using ccxt"""
    
    def __init__(self, api_key: str = "", api_secret: str = ""):
        """
        Initialize Binance exchange
        
        Args:
            api_key: Binance API key
            api_secret: Binance API secret
        """
        super().__init__(api_key, api_secret)
        
        self.exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,  # Respect rate limits
            'options': {
                'defaultType': 'spot',  # Use spot trading by default
            }
        })
        
        logger.info("BinanceExchange initialized")
    
    async def fetch_klines(
        self,
        symbol: str,
        timeframe: str,
        since: Optional[int] = None,
        limit: int = 1000
    ) -> List[KlineData]:
        """
        Fetch OHLCV data from Binance
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            timeframe: Timeframe (e.g., '1h', '1d')
            since: Unix timestamp in seconds (converted to ms internally)
            limit: Maximum number of candles (max 1000)
            
        Returns:
            List of KlineData objects
        """
        try:
            # Convert since from seconds to milliseconds if provided
            since_ms = since * 1000 if since else None
            
            # Fetch OHLCV data
            ohlcv = await self.exchange.fetch_ohlcv(
                symbol,
                timeframe,
                since=since_ms,
                limit=limit
            )
            
            # Convert to KlineData objects
            klines = []
            for candle in ohlcv:
                kline = KlineData(
                    symbol=symbol.replace('/', ''),  # BTC/USDT -> BTCUSDT
                    timeframe=timeframe,
                    timestamp=int(candle[0] / 1000),  # Convert ms to seconds
                    open=float(candle[1]),
                    high=float(candle[2]),
                    low=float(candle[3]),
                    close=float(candle[4]),
                    volume=float(candle[5])
                )
                klines.append(kline)
            
            logger.debug(f"Fetched {len(klines)} klines for {symbol} {timeframe}")
            return klines
            
        except Exception as e:
            logger.error(f"Failed to fetch klines from Binance: {e}")
            raise
    
    async def fetch_ticker(self, symbol: str) -> TickerData:
        """
        Fetch ticker data from Binance
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            TickerData object
        """
        try:
            ticker = await self.exchange.fetch_ticker(symbol)
            
            return TickerData(
                symbol=symbol.replace('/', ''),
                bid=float(ticker['bid']),
                ask=float(ticker['ask']),
                last=float(ticker['last']),
                volume_24h=float(ticker['quoteVolume']),
                timestamp=int(ticker['timestamp'] / 1000)
            )
            
        except Exception as e:
            logger.error(f"Failed to fetch ticker from Binance: {e}")
            raise
    
    async def fetch_order_book(
        self,
        symbol: str,
        limit: int = 20
    ) -> OrderBookData:
        """
        Fetch order book from Binance
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            limit: Depth of order book
            
        Returns:
            OrderBookData object
        """
        try:
            order_book = await self.exchange.fetch_order_book(symbol, limit)
            
            return OrderBookData(
                symbol=symbol.replace('/', ''),
                bids=[(float(price), float(qty)) for price, qty in order_book['bids']],
                asks=[(float(price), float(qty)) for price, qty in order_book['asks']],
                timestamp=int(order_book['timestamp'] / 1000)
            )
            
        except Exception as e:
            logger.error(f"Failed to fetch order book from Binance: {e}")
            raise
    
    async def create_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        amount: float,
        price: Optional[float] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> OrderData:
        """
        Create order on Binance
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            side: 'buy' or 'sell'
            order_type: 'market' or 'limit'
            amount: Order quantity
            price: Order price (for limit orders)
            params: Additional parameters
            
        Returns:
            OrderData object
        """
        try:
            order = await self.exchange.create_order(
                symbol,
                order_type,
                side,
                amount,
                price,
                params or {}
            )
            
            return OrderData(
                order_id=str(order['id']),
                symbol=symbol.replace('/', ''),
                side=side.upper(),
                order_type=order_type.upper(),
                price=float(order['price']) if order.get('price') else None,
                quantity=float(order['amount']),
                status=order['status'].upper(),
                filled_quantity=float(order['filled']),
                average_price=float(order['average']) if order.get('average') else None,
                timestamp=int(order['timestamp'] / 1000)
            )
            
        except Exception as e:
            logger.error(f"Failed to create order on Binance: {e}")
            raise
    
    async def cancel_order(
        self,
        order_id: str,
        symbol: str
    ) -> bool:
        """
        Cancel order on Binance
        
        Args:
            order_id: Order ID to cancel
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            True if successful
        """
        try:
            await self.exchange.cancel_order(order_id, symbol)
            logger.info(f"Cancelled order {order_id} on {symbol}")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel order {order_id}: {e}")
            return False
    
    async def fetch_order(
        self,
        order_id: str,
        symbol: str
    ) -> Optional[OrderData]:
        """
        Fetch order status from Binance
        
        Args:
            order_id: Order ID to fetch
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            OrderData object or None
        """
        try:
            order = await self.exchange.fetch_order(order_id, symbol)
            
            if not order:
                return None
            
            return OrderData(
                order_id=str(order['id']),
                symbol=symbol.replace('/', ''),
                side=order['side'].upper(),
                order_type=order['type'].upper(),
                price=float(order['price']) if order.get('price') else None,
                quantity=float(order['amount']),
                status=order['status'].upper(),
                filled_quantity=float(order['filled']),
                average_price=float(order['average']) if order.get('average') else None,
                timestamp=int(order['timestamp'] / 1000)
            )
            
        except Exception as e:
            logger.error(f"Failed to fetch order {order_id}: {e}")
            return None
    
    async def fetch_balance(self) -> Dict[str, float]:
        """
        Fetch account balance from Binance
        
        Returns:
            Dictionary mapping currency to available balance
        """
        try:
            balance = await self.exchange.fetch_balance()
            
            # Extract free (available) balances
            result = {}
            for currency, amounts in balance['free'].items():
                if float(amounts) > 0:
                    result[currency] = float(amounts)
            
            logger.debug(f"Fetched balance: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to fetch balance from Binance: {e}")
            raise
    
    async def close(self) -> None:
        """Close Binance connection"""
        try:
            await self.exchange.close()
            logger.info("BinanceExchange closed")
        except Exception as e:
            logger.error(f"Error closing BinanceExchange: {e}")

