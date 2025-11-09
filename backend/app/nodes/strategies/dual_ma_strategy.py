"""Dual Moving Average Crossover Strategy"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class DualMAStrategy(BaseStrategy):
    """
    双均线交叉策略
    
    策略逻辑：
    - 金叉(Golden Cross): 快速均线上穿慢速均线 → BUY信号
    - 死叉(Death Cross): 快速均线下穿慢速均线 → SELL信号
    
    参数：
    - fast_period: 快速均线周期 (默认: 5)
    - slow_period: 慢速均线周期 (默认: 20)
    
    适用场景：
    - 趋势跟踪
    - 中长期交易
    - 震荡市场表现较差
    """
    
    def __init__(
        self,
        bus,
        db,
        symbols,
        timeframe,
        fast_period: int = 5,
        slow_period: int = 20
    ):
        """
        初始化双均线策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            fast_period: 快速均线周期
            slow_period: 慢速均线周期
        """
        super().__init__(
            strategy_name="dual_ma",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            fast_period=fast_period,
            slow_period=slow_period
        )
        
        self.fast_period = fast_period
        self.slow_period = slow_period
        
        # 根据周期选择对应的MA字段
        self.fast_ma_field = f"ma{fast_period}"
        self.slow_ma_field = f"ma{slow_period}"
        
        logger.info(
            f"DualMAStrategy initialized: MA({fast_period}/{slow_period})"
        )
    
    async def check_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        检测双均线交叉信号
        
        Args:
            symbol: 交易对
            kline: 当前K线
            current_indicator: 当前指标
            prev_indicator: 前一个指标
            
        Returns:
            SignalData对象或None
        """
        # 获取均线值
        fast_current = getattr(current_indicator, self.fast_ma_field, None)
        slow_current = getattr(current_indicator, self.slow_ma_field, None)
        fast_prev = getattr(prev_indicator, self.fast_ma_field, None)
        slow_prev = getattr(prev_indicator, self.slow_ma_field, None)
        
        # 检查数据完整性
        if not all([fast_current, slow_current, fast_prev, slow_prev]):
            logger.debug(
                f"[dual_ma] Incomplete MA data for {symbol}: "
                f"MA{self.fast_period}(curr={fast_current}, prev={fast_prev}), "
                f"MA{self.slow_period}(curr={slow_current}, prev={slow_prev})"
            )
            return None
        
        # 🟢 金叉检测（开多信号）
        # 条件：前一根快线 ≤ 慢线，当前快线 > 慢线
        if fast_prev <= slow_prev and fast_current > slow_current:
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,  # ← 改为开多
                price=kline.close,
                reason=(
                    f"Golden Cross: MA{self.fast_period}({fast_current:.2f}) "
                    f"crossed above MA{self.slow_period}({slow_current:.2f})"
                ),
                confidence=self._calculate_confidence(current_indicator),
                stop_loss=self._calculate_stop_loss(kline, is_long=True),
                take_profit=self._calculate_take_profit(kline, is_long=True),
                side="LONG",   # ← 做多方向
                action="OPEN"  # ← 开仓操作
            )
            
            logger.info(
                f"[dual_ma] Golden Cross detected for {symbol}: "
                f"MA{self.fast_period} {fast_prev:.2f}->{fast_current:.2f}, "
                f"MA{self.slow_period} {slow_prev:.2f}->{slow_current:.2f}"
            )
            
            return signal
        
        # 🔴 死叉检测（开空信号）
        # 条件：前一根快线 ≥ 慢线，当前快线 < 慢线
        elif fast_prev >= slow_prev and fast_current < slow_current:
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,  # ← 改为开空
                price=kline.close,
                reason=(
                    f"Death Cross: MA{self.fast_period}({fast_current:.2f}) "
                    f"crossed below MA{self.slow_period}({slow_current:.2f})"
                ),
                confidence=self._calculate_confidence(current_indicator),
                stop_loss=self._calculate_stop_loss(kline, is_long=False),
                take_profit=self._calculate_take_profit(kline, is_long=False),
                side="SHORT",  # ← 做空方向
                action="OPEN"  # ← 开仓操作
            )
            
            logger.info(
                f"[dual_ma] Death Cross detected for {symbol}: "
                f"MA{self.fast_period} {fast_prev:.2f}->{fast_current:.2f}, "
                f"MA{self.slow_period} {slow_prev:.2f}->{slow_current:.2f}"
            )
            
            return signal
        
        # 无交叉
        return None

