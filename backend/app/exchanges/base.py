"""Base exchange interface"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.market_data import KlineData, TickerData, OrderBookData
from app.models.signals import OrderData


class ExchangeBase(ABC):
    """
    Abstract base class for cryptocurrency exchanges
    
    All exchange implementations must inherit from this class and implement
    the required methods
    """
    
    def __init__(self, api_key: str = "", api_secret: str = ""):
        """
        Initialize exchange
        
        Args:
            api_key: API key for authenticated requests
            api_secret: API secret for authenticated requests
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.name = self.__class__.__name__
    
    @abstractmethod
    async def fetch_klines(
        self,
        symbol: str,
        timeframe: str,
        since: Optional[int] = None,
        limit: int = 1000
    ) -> List[KlineData]:
        """
        Fetch OHLCV candlestick data
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            timeframe: Timeframe (e.g., '1h', '1d')
            since: Unix timestamp in milliseconds (for incremental fetch)
            limit: Maximum number of candles to fetch
            
        Returns:
            List of KlineData objects
        """
        pass
    
    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> TickerData:
        """
        Fetch real-time ticker data
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            TickerData object
        """
        pass
    
    @abstractmethod
    async def fetch_order_book(
        self,
        symbol: str,
        limit: int = 20
    ) -> OrderBookData:
        """
        Fetch order book snapshot
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            limit: Depth of order book (number of price levels)
            
        Returns:
            OrderBookData object
        """
        pass
    
    @abstractmethod
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
        Create a trading order
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            side: Order side ('buy' or 'sell')
            order_type: Order type ('market' or 'limit')
            amount: Order quantity
            price: Order price (required for limit orders)
            params: Additional parameters
            
        Returns:
            OrderData object
        """
        pass
    
    @abstractmethod
    async def cancel_order(
        self,
        order_id: str,
        symbol: str
    ) -> bool:
        """
        Cancel an existing order
        
        Args:
            order_id: Order ID to cancel
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def fetch_order(
        self,
        order_id: str,
        symbol: str
    ) -> Optional[OrderData]:
        """
        Fetch order status
        
        Args:
            order_id: Order ID to fetch
            symbol: Trading pair (e.g., 'BTC/USDT')
            
        Returns:
            OrderData object or None if not found
        """
        pass
    
    @abstractmethod
    async def fetch_balance(self) -> Dict[str, float]:
        """
        Fetch account balance
        
        Returns:
            Dictionary mapping currency to available balance
            Example: {'BTC': 0.5, 'USDT': 10000.0}
        """
        pass
    
    @abstractmethod
    async def close(self) -> None:
        """Close exchange connection and cleanup resources"""
        pass
    
    def __repr__(self) -> str:
        return f"<{self.name}>"

