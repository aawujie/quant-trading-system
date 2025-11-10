"""RSI Strategy (Refactored)"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class RSIStrategy(BaseStrategy):
    """
    RSI超买超卖策略 (Relative Strength Index) - 重构版
    
    策略逻辑：
    入场：
    - RSI从超卖区（<30）向上突破 → 开多（OPEN_LONG）
    - RSI从超买区（>70）向下回落 → 开空（OPEN_SHORT）
    
    出场：
    1. 基类默认止损/止盈/移动止损
    2. 极端RSI出场：
       - 多单：RSI > 80 → 平仓
       - 空单：RSI < 20 → 平仓
    
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
        overbought: int = 70,
        enable_ai_enhancement: bool = False,
        **kwargs
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
            enable_ai_enhancement: 是否启用AI增强
        """
        super().__init__(
            strategy_name="rsi",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            enable_ai_enhancement=enable_ai_enhancement,
            oversold=oversold,
            overbought=overbought,
            **kwargs
        )
        
        self.oversold = oversold
        self.overbought = overbought
        
        logger.info(
            f"RSIStrategy initialized: oversold={oversold}, overbought={overbought}, "
            f"AI={enable_ai_enhancement}"
        )
    
    async def check_entry_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测RSI入场信号（重构版）
        
        Returns:
            SignalData对象或None
        """
        # 检查数据完整性
        if not prev_indicator or not current_indicator.rsi14 or not prev_indicator.rsi14:
            return None
        
        rsi_current = current_indicator.rsi14
        rsi_prev = prev_indicator.rsi14
        
        # 🟢 超卖反弹信号（开多）
        # 条件：前一根RSI在超卖区（≤阈值），当前RSI突破超卖区（>阈值）
        if rsi_prev <= self.oversold and rsi_current > self.oversold:
            # 计算置信度
            confidence = self._calculate_confidence(current_indicator)
            rsi_momentum = rsi_current - rsi_prev
            if rsi_momentum > 5:  # RSI快速上升超过5点
                confidence = min(confidence + 0.15, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,
                price=kline.close,
                reason=(
                    f"RSI Oversold Bounce: RSI({rsi_current:.1f}) "
                    f"crossed above {self.oversold}, momentum: +{rsi_momentum:.1f}"
                ),
                confidence=confidence,
                side="LONG",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "LONG", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "LONG", current_indicator)
            )
            
            return signal
        
        # 🔴 超买回落信号（开空）
        # 条件：前一根RSI在超买区（≥阈值），当前RSI回落到超买区下方（<阈值）
        elif rsi_prev >= self.overbought and rsi_current < self.overbought:
            # 计算置信度
            confidence = self._calculate_confidence(current_indicator)
            rsi_momentum = rsi_prev - rsi_current
            if rsi_momentum > 5:  # RSI快速下降超过5点
                confidence = min(confidence + 0.15, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,
                price=kline.close,
                reason=(
                    f"RSI Overbought Pullback: RSI({rsi_current:.1f}) "
                    f"crossed below {self.overbought}, momentum: -{rsi_momentum:.1f}"
                ),
                confidence=confidence,
                side="SHORT",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "SHORT", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "SHORT", current_indicator)
            )
            
            return signal
        
        # 无入场信号
        return None
    
    async def check_exit_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测RSI出场信号（策略特定）
        
        先调用基类的默认出场逻辑（止损/止盈/移动止损），
        然后添加RSI特定的出场条件
        """
        # 1. 调用基类的默认出场逻辑
        base_exit = await super().check_exit_signal(
            symbol, kline, current_indicator, prev_indicator
        )
        if base_exit:
            return base_exit
        
        # 2. RSI特定出场：极端RSI值
        pos = self.positions[symbol]
        
        if not current_indicator.rsi14:
            return None
        
        rsi_current = current_indicator.rsi14
        
        # 多单出场：RSI极度超买（>80）
        if pos["side"] == "LONG" and rsi_current > 80:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"RSI extreme overbought: {rsi_current:.1f} > 80",
                side="LONG",
                action="CLOSE"
            )
        
        # 空单出场：RSI极度超卖（<20）
        elif pos["side"] == "SHORT" and rsi_current < 20:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"RSI extreme oversold: {rsi_current:.1f} < 20",
                side="SHORT",
                action="CLOSE"
            )
        
        return None
    
    async def confirm_signal(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData
    ) -> bool:
        """
        RSI策略特定的信号确认
        
        在基类确认的基础上，添加趋势过滤
        """
        # 1. 调用基类的确认逻辑（包含AI增强）
        if not await super().confirm_signal(signal, kline, indicator):
            return False
        
        # 2. RSI特定过滤：避免逆势交易
        if indicator.ma5 and indicator.ma20:
            # 趋势判断
            is_uptrend = indicator.ma5 > indicator.ma20
            
            # 做多信号但处于下跌趋势
            if signal.side == "LONG" and not is_uptrend:
                logger.info(f"RSI LONG signal rejected: downtrend (MA5={indicator.ma5:.2f} < MA20={indicator.ma20:.2f})")
                return False
            
            # 做空信号但处于上涨趋势
            if signal.side == "SHORT" and is_uptrend:
                logger.info(f"RSI SHORT signal rejected: uptrend (MA5={indicator.ma5:.2f} > MA20={indicator.ma20:.2f})")
                return False
        
        return True
    
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
            if abs(indicator.macd_histogram) > 0.01:
                confidence += 0.15
        
        # 成交量确认
        if indicator.volume_ma5:
            confidence += 0.1
        
        # 价格趋势确认
        if indicator.ma20:
            confidence += 0.1
        
        return min(confidence, 1.0)
