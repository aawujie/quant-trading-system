"""MACD Strategy (Refactored)"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class MACDStrategy(BaseStrategy):
    """
    MACD策略（重构版）- Moving Average Convergence Divergence
    
    策略逻辑：
    入场：
    - MACD线上穿信号线 → 开多（OPEN_LONG）
    - MACD线下穿信号线 → 开空（OPEN_SHORT）
    
    出场：
    1. 基类默认止损/止盈/移动止损
    2. 反向交叉出场（可选）
    3. 柱状图零轴穿越出场（可选）
    
    指标说明：
    - MACD线 = EMA(12) - EMA(26)
    - 信号线 = EMA(MACD, 9)
    - 柱状图 = MACD线 - 信号线
    
    参数：
    - fast_period: 快速EMA周期 (默认: 12)
    - slow_period: 慢速EMA周期 (默认: 26)
    - signal_period: 信号线周期 (默认: 9)
    
    适用场景：
    - 趋势确认
    - 动量交易
    - 适合中期交易
    """
    
    def __init__(
        self,
        bus,
        db,
        symbols,
        timeframe,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
        enable_ai_enhancement: bool = False,
        **kwargs
    ):
        """
        初始化MACD策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            fast_period: 快速EMA周期
            slow_period: 慢速EMA周期
            signal_period: 信号线周期
            enable_ai_enhancement: 是否启用AI增强
        """
        super().__init__(
            strategy_name="macd",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            enable_ai_enhancement=enable_ai_enhancement,
            fast_period=fast_period,
            slow_period=slow_period,
            signal_period=signal_period,
            **kwargs
        )
        
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period
        
        logger.info(
            f"MACDStrategy initialized: EMA({fast_period},{slow_period}), "
            f"Signal({signal_period}), AI={enable_ai_enhancement}"
        )
    
    async def check_entry_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测MACD交叉入场信号（重构版）
            
        Returns:
            SignalData对象或None
        """
        # 检查数据完整性
        if not prev_indicator:
            return None
        
        # 获取MACD值
        macd_current = current_indicator.macd_line
        signal_current = current_indicator.macd_signal
        hist_current = current_indicator.macd_histogram
        
        macd_prev = prev_indicator.macd_line
        signal_prev = prev_indicator.macd_signal
        hist_prev = prev_indicator.macd_histogram
        
        if not all([macd_current, signal_current, macd_prev, signal_prev]):
            return None
        
        # 🟢 金叉检测（开多信号）
        # 条件：前一根MACD ≤ 信号线，当前MACD > 信号线
        if macd_prev <= signal_prev and macd_current > signal_current:
            # 计算交叉强度
            cross_strength = abs(macd_current - signal_current)
            
            confidence = self._calculate_confidence(current_indicator)
            
            # 增强条件1：柱状图为正值且增长
            if hist_current and hist_current > 0:
                confidence = min(confidence + 0.1, 1.0)
                if hist_prev and hist_current > hist_prev:
                    confidence = min(confidence + 0.05, 1.0)
            
            # 增强条件2：MACD在零轴上方（趋势强劲）
            if macd_current > 0:
                confidence = min(confidence + 0.05, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,
                price=kline.close,
                reason=(
                    f"MACD Golden Cross: MACD({macd_current:.4f}) "
                    f"crossed above Signal({signal_current:.4f}), "
                    f"Histogram: {hist_current:.4f if hist_current else 'N/A'}, "
                    f"strength: {cross_strength:.4f}"
                ),
                confidence=confidence,
                side="LONG",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "LONG", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "LONG", current_indicator)
            )
            
            return signal
        
        # 🔴 死叉检测（开空信号）
        # 条件：前一根MACD ≥ 信号线，当前MACD < 信号线
        elif macd_prev >= signal_prev and macd_current < signal_current:
            # 计算交叉强度
            cross_strength = abs(signal_current - macd_current)
            
            confidence = self._calculate_confidence(current_indicator)
            
            # 增强条件1：柱状图为负值且下降
            if hist_current and hist_current < 0:
                confidence = min(confidence + 0.1, 1.0)
                if hist_prev and hist_current < hist_prev:
                    confidence = min(confidence + 0.05, 1.0)
            
            # 增强条件2：MACD在零轴下方（趋势强劲）
            if macd_current < 0:
                confidence = min(confidence + 0.05, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,
                price=kline.close,
                reason=(
                    f"MACD Death Cross: MACD({macd_current:.4f}) "
                    f"crossed below Signal({signal_current:.4f}), "
                    f"Histogram: {hist_current:.4f if hist_current else 'N/A'}, "
                    f"strength: {cross_strength:.4f}"
                ),
                confidence=confidence,
                side="SHORT",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "SHORT", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "SHORT", current_indicator)
            )
            
            return signal
        
        # 无交叉
        return None

    async def check_exit_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测MACD出场信号（策略特定）
        
        先调用基类的默认出场逻辑，然后添加MACD特定出场条件
        """
        # 1. 调用基类的默认出场逻辑
        base_exit = await super().check_exit_signal(
            symbol, kline, current_indicator, prev_indicator
        )
        if base_exit:
            return base_exit
        
        # 2. MACD特定出场
        if not prev_indicator:
            return None
        
        pos = self.positions[symbol]
        
        macd_current = current_indicator.macd_line
        signal_current = current_indicator.macd_signal
        macd_prev = prev_indicator.macd_line
        signal_prev = prev_indicator.macd_signal
        
        if not all([macd_current, signal_current, macd_prev, signal_prev]):
            return None
        
        # 出场条件1：反向交叉
        # 多单出场：死叉
        if pos["side"] == "LONG" and macd_prev >= signal_prev and macd_current < signal_current:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"MACD Death Cross: MACD({macd_current:.4f}) < Signal({signal_current:.4f})",
                side="LONG",
                action="CLOSE"
            )
        
        # 空单出场：金叉
        elif pos["side"] == "SHORT" and macd_prev <= signal_prev and macd_current > signal_current:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"MACD Golden Cross: MACD({macd_current:.4f}) > Signal({signal_current:.4f})",
                side="SHORT",
                action="CLOSE"
            )
        
        # 出场条件2：柱状图零轴穿越（动量反转）
        hist_current = current_indicator.macd_histogram
        hist_prev = prev_indicator.macd_histogram
        
        if hist_current and hist_prev:
            # 多单：柱状图转负
            if pos["side"] == "LONG" and hist_prev > 0 and hist_current < 0:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=kline.close,
                    reason=f"MACD Histogram turned negative: {hist_current:.4f}",
                    side="LONG",
                    action="CLOSE"
                )
            
            # 空单：柱状图转正
            elif pos["side"] == "SHORT" and hist_prev < 0 and hist_current > 0:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=kline.close,
                    reason=f"MACD Histogram turned positive: {hist_current:.4f}",
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
        MACD策略特定的信号确认
        """
        # 1. 调用基类的确认逻辑（包含AI增强）
        if not await super().confirm_signal(signal, kline, indicator):
            return False
        
        # 2. MACD特定过滤：避免弱势交叉
        if indicator.macd_histogram:
            # 柱状图绝对值太小，交叉力度不足
            if abs(indicator.macd_histogram) < 0.001:
                logger.info(f"MACD signal rejected: weak crossover (histogram={indicator.macd_histogram:.4f})")
                return False
        
        return True
