"""Technical indicator data models"""

from typing import Optional, Dict, Any
import logging
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


# ============================================================================
# 指标版本控制
# ============================================================================

INDICATOR_VERSION = "v2.0.0"  # 指标计算版本号
INDICATOR_CHANGELOG = {
    "v2.0.0": "增量计算版本，添加边界检查和验证",
    "v1.0.0": "传统批量计算版本"
}

# ============================================================================
# 指标元数据配置
# ============================================================================

class IndicatorMetadata(BaseModel):
    """
    指标元数据 - 定义每个指标的计算参数
    
    支持单参数和多参数指标：
    - 单参数：MA, EMA, RSI（只需 period）
    - 多参数：MACD, BOLL（需要额外参数）
    """
    name: str  # 指标名称
    period: int  # 需要的基本周期数（单参数指标）
    warmup: int  # 预热期（确保指标计算准确）
    description: str  # 描述
    
    # 多参数支持（可选）
    params: Optional[Dict[str, Any]] = None  # 额外参数，如 {'fast': 12, 'slow': 26}
    
    def get_required_klines(self) -> int:
        """获取该指标需要的总 K 线数量"""
        return self.period + self.warmup
    
    def get_param(self, key: str, default: Any = None) -> Any:
        """获取参数值"""
        if self.params and key in self.params:
            return self.params[key]
        return default


# 指标配置字典 - 所有指标的元数据集中管理
INDICATOR_CONFIGS: Dict[str, IndicatorMetadata] = {
    'ma5': IndicatorMetadata(
        name='MA5',
        period=5,
        warmup=0,
        description='5周期简单移动平均线'
    ),
    'ma10': IndicatorMetadata(
        name='MA10',
        period=10,
        warmup=0,
        description='10周期简单移动平均线'
    ),
    'ma20': IndicatorMetadata(
        name='MA20',
        period=20,
        warmup=0,
        description='20周期简单移动平均线'
    ),
    'ma60': IndicatorMetadata(
        name='MA60',
        period=60,
        warmup=0,
        description='60周期简单移动平均线'
    ),
    'ma120': IndicatorMetadata(
        name='MA120',
        period=120,
        warmup=0,
        description='120周期简单移动平均线'
    ),
    'ema12': IndicatorMetadata(
        name='EMA12',
        period=12,
        warmup=50,  # EMA 需要预热期确保准确性
        description='12周期指数移动平均线'
    ),
    'ema26': IndicatorMetadata(
        name='EMA26',
        period=26,
        warmup=50,
        description='26周期指数移动平均线'
    ),
    'rsi14': IndicatorMetadata(
        name='RSI14',
        period=14,
        warmup=20,  # RSI 需要预热期
        description='14周期相对强弱指标'
    ),
    'macd': IndicatorMetadata(
        name='MACD',
        period=35,  # slowperiod(26) + signalperiod(9)
        warmup=50,  # MACD 基于 EMA，需要预热
        description='MACD指标 (12,26,9)',
        params={'fast_period': 12, 'slow_period': 26, 'signal_period': 9}
    ),
    'boll': IndicatorMetadata(
        name='BOLL',
        period=20,
        warmup=0,
        description='布林带 (20,2)',
        params={'nbdev': 2.0}  # 标准差倍数
    ),
    'atr14': IndicatorMetadata(
        name='ATR14',
        period=14,
        warmup=20,  # ATR 需要预热期
        description='14周期平均真实波幅'
    ),
    'volume_ma5': IndicatorMetadata(
        name='Volume_MA5',
        period=5,
        warmup=0,
        description='5周期成交量移动平均'
    ),
}


def get_max_required_klines(indicator_keys: Optional[list] = None) -> int:
    """
    计算需要的最大 K 线数量
    
    Args:
        indicator_keys: 指标键列表，如 ['ma5', 'ma20']。如果为 None，则计算所有指标
        
    Returns:
        需要的最大 K 线数量
        
    Raises:
        ValueError: 如果传入的指标键不存在于元数据中
    """
    if indicator_keys is None:
        # 计算所有指标
        indicator_keys = INDICATOR_CONFIGS.keys()
    
    result = 0
    for key in indicator_keys:
        config = INDICATOR_CONFIGS.get(key)
        if config is None:
            # 强制要求指标必须在元数据中定义
            raise ValueError(
                f"指标 '{key}' 不存在于元数据配置中！"
                f"可用的指标: {', '.join(INDICATOR_CONFIGS.keys())}"
            )
        required = config.get_required_klines()
        result = max(result, required)
    
    return result


def get_min_required_klines(indicator_keys: Optional[list] = None) -> int:
    """
    计算需要的最小 K 线数量
    
    Args:
        indicator_keys: 指标键列表，如 ['ma5', 'ma20']。如果为 None，则计算所有指标
        
    Returns:
        需要的最小 K 线数量
        
    Raises:
        ValueError: 如果传入的指标键不存在于元数据中
    """
    if indicator_keys is None:
        # 计算所有指标
        indicator_keys = INDICATOR_CONFIGS.keys()
    
    result = float('inf')  # 初始化为无穷大
    for key in indicator_keys:
        config = INDICATOR_CONFIGS.get(key)
        if config is None:
            # 强制要求指标必须在元数据中定义
            raise ValueError(
                f"指标 '{key}' 不存在于元数据配置中！"
                f"可用的指标: {', '.join(INDICATOR_CONFIGS.keys())}"
            )
        required = config.get_required_klines()
        result = min(result, required)
    
    # 如果没有找到任何指标，返回0
    return result if result != float('inf') else 0


def get_indicator_metadata(indicator_key: str) -> Optional[IndicatorMetadata]:
    """
    获取指定指标的元数据
    
    Args:
        indicator_key: 指标键，如 'ma5'
        
    Returns:
        IndicatorMetadata 对象，如果不存在则返回 None
    """
    return INDICATOR_CONFIGS.get(indicator_key)


class IndicatorData(BaseModel):
    """
    Technical indicators data model
    
    Contains calculated indicator values for a specific symbol and timeframe
    """
    
    symbol: str = Field(..., description="Trading pair symbol (e.g., 'BTCUSDT')")
    timeframe: str = Field(..., description="Timeframe (e.g., '1h', '1d')")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    market_type: str = Field(default='spot', description="Market type: 'spot', 'future', 'delivery'")
    
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
    
    @field_validator('rsi14')
    @classmethod
    def validate_rsi(cls, v: Optional[float]) -> Optional[float]:
        """验证 RSI 值在 0-100 范围内"""
        if v is not None:
            if v < 0 or v > 100:
                logger.warning(f"Invalid RSI value: {v}, should be in [0, 100]. Setting to None.")
                return None
        return v
    
    @field_validator('atr14')
    @classmethod
    def validate_atr(cls, v: Optional[float]) -> Optional[float]:
        """验证 ATR 值为正数"""
        if v is not None and v < 0:
            logger.warning(f"Invalid ATR value: {v}, should be >= 0. Setting to None.")
            return None
        return v
    
    @field_validator('volume_ma5')
    @classmethod
    def validate_volume(cls, v: Optional[float]) -> Optional[float]:
        """验证成交量为正数"""
        if v is not None and v < 0:
            logger.warning(f"Invalid volume MA value: {v}, should be >= 0. Setting to None.")
            return None
        return v
    
    @field_validator('bb_upper', 'bb_middle', 'bb_lower')
    @classmethod
    def validate_bollinger(cls, v: Optional[float]) -> Optional[float]:
        """验证布林带值的合理性"""
        if v is not None:
            # 检查是否为有限数字
            if not (-1e10 < v < 1e10):  # 防止极端值
                logger.warning(f"Invalid Bollinger Band value: {v}. Setting to None.")
                return None
        return v
    
    @field_validator('ma5', 'ma10', 'ma20', 'ma60', 'ma120', 'ema12', 'ema26')
    @classmethod
    def validate_moving_average(cls, v: Optional[float]) -> Optional[float]:
        """验证移动平均线值为正数"""
        if v is not None and v <= 0:
            logger.warning(f"Invalid MA/EMA value: {v}, price should be > 0. Setting to None.")
            return None
        return v
    
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

