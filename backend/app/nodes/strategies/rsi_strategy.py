"""RSI Strategy"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class RSIStrategy(BaseStrategy):
    """
    RSI超买超卖策略 (Relative Strength Index)
    
    策略逻辑：
    - RSI从超卖区（<30）向上突破 → BUY信号
    - RSI从超买区（>70）向下回落 → SELL信号
    
    指标说明：
    - RSI = 100 - (100 / (1 + RS))
    - RS = 平均涨幅 / 平均跌幅
    - 范围：0-100
    
    参数：
    - oversold: 超卖阈值 (默认: 30)
    - overbought: 超买阈值 (默认: 70)
    
    适用场景：
    - 震荡市场
    - 短期反转交易
    - 超买超卖判断
    """
    
    def __init__(
        self,
        bus,
        db,
        symbols,
        timeframe,
        oversold: int = 30,
        overbought: int = 70
    ):
        """
        初始化RSI策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            oversold: 超卖阈值
            overbought: 超买阈值
        """
        super().__init__(
            strategy_name="rsi",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            oversold=oversold,
            overbought=overbought
        )
        
        self.oversold = oversold
        self.overbought = overbought
        
        logger.info(
            f"RSIStrategy initialized: oversold={oversold}, overbought={overbought}"
        )
    
    async def check_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        检测RSI超买超卖信号
        
        Args:
            symbol: 交易对
            kline: 当前K线
            current_indicator: 当前指标
            prev_indicator: 前一个指标
            
        Returns:
            SignalData对象或None
        """
        # 获取RSI值
        rsi_current = current_indicator.rsi14
        rsi_prev = prev_indicator.rsi14
        
        # 检查数据完整性
        if not all([rsi_current, rsi_prev]):
            logger.debug(
                f"[rsi] Incomplete RSI data for {symbol}"
            )
            return None
        
        # 🟢 超卖反弹信号（买入）
        # 条件：前一根RSI在超卖区（≤阈值），当前RSI突破超卖区（>阈值）
        if rsi_prev <= self.oversold and rsi_current > self.oversold:
            # 增强条件：如果RSI快速上升，增加置信度
            confidence = self._calculate_confidence(current_indicator)
            rsi_momentum = rsi_current - rsi_prev
            if rsi_momentum > 5:  # RSI快速上升超过5点
                confidence = min(confidence + 0.15, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.BUY,
                price=kline.close,
                reason=(
                    f"RSI Oversold Bounce: RSI({rsi_current:.1f}) "
                    f"crossed above oversold threshold ({self.oversold}), "
                    f"momentum: +{rsi_momentum:.1f}"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=True),
                take_profit=self._calculate_take_profit(kline, is_long=True)
            )
            
            logger.info(
                f"[rsi] Oversold bounce detected for {symbol}: "
                f"RSI {rsi_prev:.1f}->{rsi_current:.1f} "
                f"(threshold: {self.oversold})"
            )
            
            return signal
        
        # 🔴 超买回落信号（卖出）
        # 条件：前一根RSI在超买区（≥阈值），当前RSI回落到超买区下方（<阈值）
        elif rsi_prev >= self.overbought and rsi_current < self.overbought:
            # 增强条件：如果RSI快速下降，增加置信度
            confidence = self._calculate_confidence(current_indicator)
            rsi_momentum = rsi_prev - rsi_current
            if rsi_momentum > 5:  # RSI快速下降超过5点
                confidence = min(confidence + 0.15, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.SELL,
                price=kline.close,
                reason=(
                    f"RSI Overbought Pullback: RSI({rsi_current:.1f}) "
                    f"crossed below overbought threshold ({self.overbought}), "
                    f"momentum: -{rsi_momentum:.1f}"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=False),
                take_profit=self._calculate_take_profit(kline, is_long=False)
            )
            
            logger.info(
                f"[rsi] Overbought pullback detected for {symbol}: "
                f"RSI {rsi_prev:.1f}->{rsi_current:.1f} "
                f"(threshold: {self.overbought})"
            )
            
            return signal
        
        # 无信号
        return None
    
    def _calculate_confidence(self, indicator: IndicatorData) -> float:
        """
        计算RSI策略的置信度
        
        考虑因素：
        - MACD趋势确认
        - 成交量
        - 价格趋势（MA）
        """
        confidence = 0.5
        
        # MACD确认趋势
        if indicator.macd_histogram:
            if abs(indicator.macd_histogram) > 0.01:  # MACD有明显趋势
                confidence += 0.15
        
        # 成交量确认
        if indicator.volume_ma5:
            confidence += 0.1
        
        # 价格趋势确认（使用MA20作为趋势判断）
        if indicator.ma20:
            confidence += 0.1
        
        return min(confidence, 1.0)

