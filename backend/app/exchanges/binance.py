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
    
    def __init__(self, api_key: str = "", api_secret: str = "", proxy_config: Optional[Dict[str, Any]] = None, market_type: str = 'spot'):
        """
        Initialize Binance exchange
        
        Args:
            api_key: Binance API key
            api_secret: Binance API secret
            proxy_config: Proxy configuration dict
            market_type: Market type - 'spot', 'future', 'delivery' (default: 'spot')
        """
        super().__init__(api_key, api_secret)
        
        # Store market_type for use in KlineData creation
        self.market_type = market_type
        
        # Map our market_type to CCXT's defaultType
        market_type_map = {
            'spot': 'spot',
            'future': 'future',  # USDT-M perpetual/futures
            'delivery': 'delivery'  # Coin-M futures
        }
        ccxt_market_type = market_type_map.get(market_type, 'spot')
        
        config = {
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,  # Respect rate limits
            'verbose': False,
            'options': {
                'defaultType': ccxt_market_type,
            }
        }
        
        # Add proxy configuration if provided
        if proxy_config and proxy_config.get('enabled'):
            proxy_url = self._build_proxy_url(proxy_config)
            if proxy_url:
                # ccxt uses aiohttp_proxy for async requests
                config['aiohttp_proxy'] = proxy_url
                config['proxies'] = {
                    'http': proxy_url,
                    'https': proxy_url,
                }
                logger.info(f"Using proxy: {proxy_config.get('host')}:{proxy_config.get('port')}")
        
        self.exchange = ccxt.binance(config)
        
        logger.info("BinanceExchange initialized")
    
    def _build_proxy_url(self, proxy_config: Dict[str, Any]) -> Optional[str]:
        """
        Build proxy URL from config
        
        Args:
            proxy_config: Proxy configuration dict
            
        Returns:
            Proxy URL string or None
        """
        host = proxy_config.get('host')
        port = proxy_config.get('port')
        
        if not host or not port:
            logger.warning("Proxy enabled but host or port not configured")
            return None
        
        username = proxy_config.get('username')
        password = proxy_config.get('password')
        
        if username and password:
            # Proxy with authentication
            return f"http://{username}:{password}@{host}:{port}"
        else:
            # Proxy without authentication
            return f"http://{host}:{port}"
    
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
                    market_type=self.market_type,  # Use configured market type
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
        Fetch ticker data from Binance (包含24小时统计)
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            TickerData object with 24hr statistics
        """
        try:
            ticker = await self.exchange.fetch_ticker(symbol)
            
            return TickerData(
                symbol=symbol.replace('/', ''),
                bid=float(ticker['bid']) if ticker.get('bid') else 0.0,
                ask=float(ticker['ask']) if ticker.get('ask') else 0.0,
                last=float(ticker['last']),
                high=float(ticker['high']) if ticker.get('high') else None,
                low=float(ticker['low']) if ticker.get('low') else None,
                volume_24h=float(ticker['quoteVolume']) if ticker.get('quoteVolume') else 0.0,
                price_change=float(ticker['change']) if ticker.get('change') else None,
                price_change_percent=float(ticker['percentage']) if ticker.get('percentage') else None,
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

