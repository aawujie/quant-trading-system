"""API请求模型定义"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# 导入系统配置以使用统一的默认值
from app.config import settings


class BacktestRequest(BaseModel):
    """回测请求模型"""
    strategy: str = Field(..., description="策略名称")
    symbol: str = Field(..., description="交易对，例如 BTCUSDT")
    timeframe: str = Field(..., description="时间周期，例如 1h")
    start_date: str = Field(..., description="开始日期，格式 YYYY-MM-DD")
    end_date: str = Field(..., description="结束日期，格式 YYYY-MM-DD")
    initial_capital: float = Field(default=10000, description="初始资金")
    position_preset: str = Field(default="balanced", description="仓位管理预设")
    params: Dict[str, Any] = Field(default_factory=dict, description="策略参数")
    enable_ai: bool = Field(default=False, description="是否启用AI增强")
    market_type: str = Field(default=settings.market_type, description="市场类型: spot/future (默认从系统配置读取)")

    class Config:
        json_schema_extra = {
            "example": {
                "strategy": "dual_ma",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "initial_capital": 10000,
                "position_preset": "balanced",
                "params": {
                    "fast_period": 5,
                    "slow_period": 20
                },
                "enable_ai": False,
                "market_type": "future"  # 更新为与系统配置一致
            }
        }


class OptimizationRequest(BaseModel):
    """参数优化请求模型"""
    strategy: str = Field(..., description="策略名称")
    symbol: str = Field(..., description="交易对")
    timeframe: str = Field(..., description="时间周期")
    start_date: str = Field(..., description="开始日期")
    end_date: str = Field(..., description="结束日期")
    initial_capital: float = Field(default=10000, description="初始资金")
    position_preset: str = Field(default="balanced", description="仓位管理预设")
    n_trials: int = Field(default=50, ge=10, le=500, description="优化轮数")
    optimization_target: str = Field(
        default="sharpe_ratio",
        description="优化目标: sharpe_ratio/total_return/win_rate"
    )
    market_type: str = Field(default=settings.market_type, description="市场类型 (默认从系统配置读取)")

    class Config:
        json_schema_extra = {
            "example": {
                "strategy": "dual_ma",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "initial_capital": 10000,
                "position_preset": "balanced",
                "n_trials": 50,
                "optimization_target": "sharpe_ratio",
                "market_type": "future"  # 更新为与系统配置一致
            }
        }


class DataDownloadRequest(BaseModel):
    """数据下载请求模型"""
    symbols: List[str] = Field(..., description="交易对列表")
    timeframes: List[str] = Field(..., description="时间周期列表")
    start_date: str = Field(..., description="开始日期")
    end_date: Optional[str] = Field(None, description="结束日期，默认为当前时间")
    market_type: str = Field(default=settings.market_type, description="市场类型 (默认从系统配置读取)")
    force_update: bool = Field(default=False, description="是否强制更新")

    class Config:
        json_schema_extra = {
            "example": {
                "symbols": ["BTCUSDT", "ETHUSDT"],
                "timeframes": ["1h", "4h"],
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "market_type": "future",  # 更新为与系统配置一致
                "force_update": False
            }
        }


class DataRepairRequest(BaseModel):
    """数据修复请求模型"""
    symbols: List[str] = Field(..., description="要修复的交易对列表")
    timeframes: List[str] = Field(..., description="要修复的时间周期列表")
    mode: str = Field(
        default="auto",
        description="修复模式: auto/full/incremental"
    )
    start_date: Optional[str] = Field(None, description="起始日期")
    market_type: str = Field(default=settings.market_type, description="市场类型 (默认从系统配置读取)")

    class Config:
        json_schema_extra = {
            "example": {
                "symbols": ["BTCUSDT"],
                "timeframes": ["1h"],
                "mode": "auto",
                "start_date": "2024-01-01",
                "market_type": "future"  # 更新为与系统配置一致
            }
        }

