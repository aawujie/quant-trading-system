"""Technical indicator data models"""

from typing import Optional
from pydantic import BaseModel, Field


class IndicatorData(BaseModel):
    """
    Technical indicators data model
    
    Contains calculated indicator values for a specific symbol and timeframe
    """
    
    symbol: str = Field(..., description="Trading pair symbol (e.g., 'BTCUSDT')")
    timeframe: str = Field(..., description="Timeframe (e.g., '1h', '1d')")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    
    # Moving Averages
    ma5: Optional[float] = Field(None, description="5-period simple moving average")
    ma10: Optional[float] = Field(None, description="10-period simple moving average")
    ma20: Optional[float] = Field(None, description="20-period simple moving average")
    ma60: Optional[float] = Field(None, description="60-period simple moving average")
    ma120: Optional[float] = Field(None, description="120-period simple moving average")
    
    # Exponential Moving Averages
    ema12: Optional[float] = Field(None, description="12-period exponential moving average")
    ema26: Optional[float] = Field(None, description="26-period exponential moving average")
    
    # RSI
    rsi14: Optional[float] = Field(None, description="14-period RSI (0-100)")
    
    # MACD
    macd_line: Optional[float] = Field(None, description="MACD line (DIF)")
    macd_signal: Optional[float] = Field(None, description="MACD signal line (DEA)")
    macd_histogram: Optional[float] = Field(None, description="MACD histogram")
    
    # Bollinger Bands
    bb_upper: Optional[float] = Field(None, description="Bollinger Bands upper band")
    bb_middle: Optional[float] = Field(None, description="Bollinger Bands middle band")
    bb_lower: Optional[float] = Field(None, description="Bollinger Bands lower band")
    
    # ATR
    atr14: Optional[float] = Field(None, description="14-period Average True Range")
    
    # Volume indicators
    volume_ma5: Optional[float] = Field(None, description="5-period volume moving average")
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "timestamp": 1705320000,
                "ma5": 35100.0,
                "ma10": 35050.0,
                "ma20": 35000.0,
                "rsi14": 55.5,
                "macd_line": 150.2,
                "macd_signal": 140.5,
                "macd_histogram": 9.7,
                "bb_upper": 35500.0,
                "bb_middle": 35000.0,
                "bb_lower": 34500.0
            }
        }
    
    def __repr__(self) -> str:
        return (
            f"<IndicatorData {self.symbol} {self.timeframe} "
            f"@ {self.timestamp} "
            f"MA5={self.ma5:.2f if self.ma5 else None} "
            f"RSI={self.rsi14:.2f if self.rsi14 else None}>"
        )


class BollingerBandsData(BaseModel):
    """Bollinger Bands indicator (detailed)"""
    
    symbol: str
    timeframe: str
    timestamp: int
    upper_band: float
    middle_band: float
    lower_band: float
    bandwidth: Optional[float] = None
    percent_b: Optional[float] = None  # %B indicator
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "timestamp": 1705320000,
                "upper_band": 35500.0,
                "middle_band": 35000.0,
                "lower_band": 34500.0,
                "bandwidth": 0.0286,
                "percent_b": 0.5
            }
        }


class MACDData(BaseModel):
    """MACD indicator (detailed)"""
    
    symbol: str
    timeframe: str
    timestamp: int
    macd_line: float  # DIF
    signal_line: float  # DEA
    histogram: float  # MACD histogram
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "timestamp": 1705320000,
                "macd_line": 150.2,
                "signal_line": 140.5,
                "histogram": 9.7
            }
        }

