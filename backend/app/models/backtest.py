"""回测相关的 Pydantic 模型"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class BacktestResult(BaseModel):
    """
    回测结果响应模型（用于 API 返回）
    
    包含完整的回测配置参数和执行结果
    """
    
    # ==================== 回测标识 ====================
    run_id: Optional[str] = Field(None, description="回测运行ID")
    mode: str = Field(default="backtest", description="运行模式")
    
    # ==================== 回测配置（参数） ====================
    strategy: str = Field(..., description="策略名称")
    symbols: List[str] = Field(..., description="交易对列表")
    timeframe: str = Field(..., description="时间周期")
    
    # 时间范围
    start_time: Optional[int] = Field(None, description="开始时间（Unix时间戳）")
    end_time: Optional[int] = Field(None, description="结束时间（Unix时间戳）")
    
    # 策略参数
    strategy_params: Optional[Dict[str, Any]] = Field(None, description="策略参数")
    position_preset: Optional[str] = Field(None, description="仓位管理预设")
    initial_capital: Optional[float] = Field(None, description="初始资金")
    market_type: Optional[str] = Field(None, description="市场类型")
    
    # ==================== 核心指标（结果） ====================
    total_return: float = Field(..., description="总收益率（0.15表示15%）")
    sharpe_ratio: float = Field(..., description="夏普比率")
    max_drawdown: float = Field(..., description="最大回撤（负数，-0.2表示20%回撤）")
    win_rate: float = Field(..., description="胜率（0.65表示65%）")
    total_trades: int = Field(..., description="总交易次数")
    profit_factor: float = Field(..., description="盈利因子")
    
    # ==================== 资金指标 ====================
    initial_balance: float = Field(..., description="初始余额")
    final_balance: float = Field(..., description="最终余额")
    
    # ==================== 交易统计 ====================
    avg_holding_time: Optional[float] = Field(None, description="平均持仓时间（小时）")
    max_position_pct: Optional[float] = Field(None, description="最大仓位占比")
    avg_position_size: Optional[float] = Field(None, description="平均单笔投入")
    
    # ==================== 详细数据 ====================
    signals: List[Dict[str, Any]] = Field(default_factory=list, description="所有交易信号")
    trades: Optional[List[Dict[str, Any]]] = Field(None, description="完整交易记录")
    equity_curve: Optional[List[Dict[str, Any]]] = Field(None, description="权益曲线")
    
    # ==================== 详细统计（兼容性） ====================
    statistics: Optional[Dict[str, Any]] = Field(None, description="详细统计数据")
    account_status: Optional[Dict[str, Any]] = Field(None, description="账户状态")
    
    # ==================== 元数据 ====================
    duration: Optional[float] = Field(None, description="回测耗时（秒）")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    status: str = Field(default="completed", description="状态：completed/failed")
    error_message: Optional[str] = Field(None, description="错误信息")
    
    class Config:
        json_schema_extra = {
            "example": {
                "run_id": "dual_ma_BTCUSDT_1h_20241112_093000",
                "mode": "backtest",
                "strategy": "dual_ma",
                "symbols": ["BTCUSDT"],
                "timeframe": "1h",
                "start_time": 1704067200,
                "end_time": 1735689600,
                "total_return": 0.15,
                "sharpe_ratio": 1.2,
                "max_drawdown": -0.08,
                "win_rate": 0.65,
                "total_trades": 42,
                "profit_factor": 2.5,
                "initial_balance": 10000.0,
                "final_balance": 11500.0,
                "signals": [],
                "status": "completed"
            }
        }


class BacktestHistoryItem(BaseModel):
    """
    回测历史列表项（用于列表展示）
    
    只包含关键信息，不包含详细的 signals 数据
    """
    
    id: int = Field(..., description="数据库ID")
    run_id: str = Field(..., description="回测运行ID")
    
    # 配置信息
    strategy_name: str = Field(..., description="策略名称")
    symbol: str = Field(..., description="交易对")
    timeframe: str = Field(..., description="时间周期")
    market_type: str = Field(..., description="市场类型")
    
    # 核心指标
    total_return: float = Field(..., description="总收益率")
    sharpe_ratio: Optional[float] = Field(None, description="夏普比率")
    max_drawdown: Optional[float] = Field(None, description="最大回撤")
    win_rate: Optional[float] = Field(None, description="胜率")
    total_trades: int = Field(..., description="总交易次数")
    
    # 时间信息
    start_time: int = Field(..., description="开始时间")
    end_time: int = Field(..., description="结束时间")
    created_at: datetime = Field(..., description="创建时间")
    
    # 状态
    status: str = Field(..., description="状态")
    
    class Config:
        from_attributes = True  # 支持从 ORM 模型转换


class BacktestHistoryResponse(BaseModel):
    """
    回测历史列表响应
    """
    
    data: List[BacktestHistoryItem] = Field(..., description="回测历史列表")
    total: int = Field(..., description="总记录数")
    limit: int = Field(..., description="每页数量")
    offset: int = Field(..., description="偏移量")


class BacktestDetailResponse(BaseModel):
    """
    回测详情响应（包含完整的 signals 数据）
    """
    
    data: Dict[str, Any] = Field(..., description="完整的回测数据")
    
    class Config:
        json_schema_extra = {
            "example": {
                "data": {
                    "run_id": "dual_ma_BTCUSDT_1h_20241112_093000",
                    "strategy_name": "dual_ma",
                    "symbol": "BTCUSDT",
                    "timeframe": "1h",
                    "total_return": 0.15,
                    "signals": [
                        {
                            "timestamp": 1704067200,
                            "side": "LONG",
                            "action": "OPEN",
                            "price": 42000.0,
                            "quantity": 0.1
                        }
                    ],
                    "metrics": {}
                }
            }
        }

