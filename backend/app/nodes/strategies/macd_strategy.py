"""MACD Strategy"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class MACDStrategy(BaseStrategy):
    """
    MACD策略 (Moving Average Convergence Divergence)
    
    策略逻辑：
    - MACD线上穿信号线 → BUY信号
    - MACD线下穿信号线 → SELL信号
    
    指标说明：
    - MACD线 = EMA(12) - EMA(26)
    - 信号线 = EMA(MACD, 9)
    - 柱状图 = MACD线 - 信号线
    
    适用场景：
    - 趋势确认
    - 动量交易
    - 适合中期交易
    """
    
    def __init__(self, bus, db, symbols, timeframe):
        """
        初始化MACD策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
        """
        super().__init__(
            strategy_name="macd",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe
        )
        
        logger.info("MACDStrategy initialized")
    
    async def check_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        检测MACD交叉信号
        
        Args:
            symbol: 交易对
            kline: 当前K线
            current_indicator: 当前指标
            prev_indicator: 前一个指标
            
        Returns:
            SignalData对象或None
        """
        # 获取MACD值
        macd_current = current_indicator.macd_line
        signal_current = current_indicator.macd_signal
        hist_current = current_indicator.macd_histogram
        
        macd_prev = prev_indicator.macd_line
        signal_prev = prev_indicator.macd_signal
        
        # 检查数据完整性
        if not all([macd_current, signal_current, macd_prev, signal_prev]):
            logger.debug(
                f"[macd] Incomplete MACD data for {symbol}"
            )
            return None
        
        # 🟢 金叉检测（买入信号）
        # 条件：前一根MACD ≤ 信号线，当前MACD > 信号线
        if macd_prev <= signal_prev and macd_current > signal_current:
            # 增强条件：柱状图为正值
            confidence = self._calculate_confidence(current_indicator)
            if hist_current and hist_current > 0:
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.BUY,
                price=kline.close,
                reason=(
                    f"MACD Golden Cross: MACD({macd_current:.4f}) "
                    f"crossed above Signal({signal_current:.4f}), "
                    f"Histogram: {hist_current:.4f if hist_current else 'N/A'}"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=True),
                take_profit=self._calculate_take_profit(kline, is_long=True)
            )
            
            logger.info(
                f"[macd] Golden Cross detected for {symbol}: "
                f"MACD {macd_prev:.4f}->{macd_current:.4f}, "
                f"Signal {signal_prev:.4f}->{signal_current:.4f}"
            )
            
            return signal
        
        # 🔴 死叉检测（卖出信号）
        # 条件：前一根MACD ≥ 信号线，当前MACD < 信号线
        elif macd_prev >= signal_prev and macd_current < signal_current:
            # 增强条件：柱状图为负值
            confidence = self._calculate_confidence(current_indicator)
            if hist_current and hist_current < 0:
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.SELL,
                price=kline.close,
                reason=(
                    f"MACD Death Cross: MACD({macd_current:.4f}) "
                    f"crossed below Signal({signal_current:.4f}), "
                    f"Histogram: {hist_current:.4f if hist_current else 'N/A'}"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=False),
                take_profit=self._calculate_take_profit(kline, is_long=False)
            )
            
            logger.info(
                f"[macd] Death Cross detected for {symbol}: "
                f"MACD {macd_prev:.4f}->{macd_current:.4f}, "
                f"Signal {signal_prev:.4f}->{signal_current:.4f}"
            )
            
            return signal
        
        # 无交叉
        return None

