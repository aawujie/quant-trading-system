"""Market data models"""

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class KlineData(BaseModel):
    """
    Candlestick (K-line) data model
    
    Represents OHLCV data for a specific symbol and timeframe
    """
    
    symbol: str = Field(..., description="Trading pair symbol (e.g., 'BTCUSDT')")
    timeframe: str = Field(..., description="Timeframe (e.g., '1h', '1d')")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    market_type: str = Field(default='spot', description="Market type: 'spot', 'future', 'delivery'")
    beijing_time: Optional[str] = Field(None, description="Beijing time (UTC+8) in ISO format")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Highest price")
    low: float = Field(..., description="Lowest price")
    close: float = Field(..., description="Closing price")
    volume: float = Field(..., description="Trading volume")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "timestamp": 1705320000,
                "market_type": "future",
                "open": 35000.0,
                "high": 35500.0,
                "low": 34800.0,
                "close": 35200.0,
                "volume": 1250.5
            }
        }
    )
    
    def __repr__(self) -> str:
        return (
            f"<KlineData {self.symbol} {self.timeframe} "
            f"@ {self.timestamp} "
            f"OHLC=[{self.open:.2f}, {self.high:.2f}, "
            f"{self.low:.2f}, {self.close:.2f}]>"
        )


class TickerData(BaseModel):
    """
    Real-time ticker data model (24hr统计数据)
    """
    
    symbol: str = Field(..., description="Trading pair symbol")
    bid: float = Field(..., description="Best bid price")
    ask: float = Field(..., description="Best ask price")
    last: float = Field(..., description="Last traded price")
    high: Optional[float] = Field(None, description="24-hour high price")
    low: Optional[float] = Field(None, description="24-hour low price")
    volume_24h: float = Field(..., description="24-hour trading volume")
    price_change: Optional[float] = Field(None, description="24-hour price change")
    price_change_percent: Optional[float] = Field(None, description="24-hour price change percentage")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTCUSDT",
                "bid": 35000.0,
                "ask": 35001.0,
                "last": 35000.5,
                "volume_24h": 28500.25,
                "timestamp": 1705320000
            }
        }


class OrderBookData(BaseModel):
    """Order book snapshot"""
    
    symbol: str = Field(..., description="Trading pair symbol")
    bids: list[tuple[float, float]] = Field(..., description="List of (price, quantity) bids")
    asks: list[tuple[float, float]] = Field(..., description="List of (price, quantity) asks")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTCUSDT",
                "bids": [[35000.0, 1.5], [34999.0, 2.3]],
                "asks": [[35001.0, 1.2], [35002.0, 3.1]],
                "timestamp": 1705320000
            }
        }

