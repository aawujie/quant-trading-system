"""Dual Moving Average Crossover Strategy (Refactored)"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class DualMAStrategy(BaseStrategy):
    """
    双均线交叉策略（重构版）
    
    策略逻辑：
    入场：
    - 金叉(Golden Cross): 快速均线上穿慢速均线 → 开多（OPEN_LONG）
    - 死叉(Death Cross): 快速均线下穿慢速均线 → 开空（OPEN_SHORT）
    
    出场：
    1. 基类默认止损/止盈/移动止损
    2. 反向交叉出场（可选）
    
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
        slow_period: int = 20,
        enable_ai_enhancement: bool = False,
        **kwargs
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
            enable_ai_enhancement: 是否启用AI增强
        """
        super().__init__(
            strategy_name="dual_ma",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            enable_ai_enhancement=enable_ai_enhancement,
            fast_period=fast_period,
            slow_period=slow_period,
            **kwargs
        )
        
        self.fast_period = fast_period
        self.slow_period = slow_period
        
        # 根据周期选择对应的MA字段
        self.fast_ma_field = f"ma{fast_period}"
        self.slow_ma_field = f"ma{slow_period}"
        
        logger.info(
            f"DualMAStrategy initialized: MA({fast_period}/{slow_period}), "
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
        检测双均线交叉入场信号（重构版）
        
        Returns:
            SignalData对象或None
        """
        # 检查数据完整性
        if not prev_indicator:
            return None
        
        # 获取均线值
        fast_current = getattr(current_indicator, self.fast_ma_field, None)
        slow_current = getattr(current_indicator, self.slow_ma_field, None)
        fast_prev = getattr(prev_indicator, self.fast_ma_field, None)
        slow_prev = getattr(prev_indicator, self.slow_ma_field, None)
        
        if not all([fast_current, slow_current, fast_prev, slow_prev]):
            return None
        
        # 🟢 金叉检测（开多信号）
        # 条件：前一根快线 ≤ 慢线，当前快线 > 慢线
        if fast_prev <= slow_prev and fast_current > slow_current:
            # 计算交叉强度（快线与慢线的距离百分比）
            cross_strength = (fast_current - slow_current) / slow_current * 100
            
            confidence = self._calculate_confidence(current_indicator)
            if cross_strength > 1.0:  # 强势交叉（快线超过慢线1%以上）
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,
                price=kline.close,
                reason=(
                    f"Golden Cross: MA{self.fast_period}({fast_current:.2f}) "
                    f"crossed above MA{self.slow_period}({slow_current:.2f}), "
                    f"cross strength: +{cross_strength:.2f}%"
                ),
                confidence=confidence,
                side="LONG",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "LONG", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "LONG", current_indicator)
            )
            
            return signal
        
        # 🔴 死叉检测（开空信号）
        # 条件：前一根快线 ≥ 慢线，当前快线 < 慢线
        elif fast_prev >= slow_prev and fast_current < slow_current:
            # 计算交叉强度
            cross_strength = (slow_current - fast_current) / slow_current * 100
            
            confidence = self._calculate_confidence(current_indicator)
            if cross_strength > 1.0:  # 强势交叉
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,
                price=kline.close,
                reason=(
                    f"Death Cross: MA{self.fast_period}({fast_current:.2f}) "
                    f"crossed below MA{self.slow_period}({slow_current:.2f}), "
                    f"cross strength: +{cross_strength:.2f}%"
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
        检测双均线出场信号（策略特定）
        
        先调用基类的默认出场逻辑，然后添加反向交叉出场
        """
        # 1. 调用基类的默认出场逻辑
        base_exit = await super().check_exit_signal(
            symbol, kline, current_indicator, prev_indicator
        )
        if base_exit:
            return base_exit
        
        # 2. 双均线特定出场：反向交叉
        if not prev_indicator:
            return None
        
        pos = self.positions[symbol]
        
        fast_current = getattr(current_indicator, self.fast_ma_field, None)
        slow_current = getattr(current_indicator, self.slow_ma_field, None)
        fast_prev = getattr(prev_indicator, self.fast_ma_field, None)
        slow_prev = getattr(prev_indicator, self.slow_ma_field, None)
        
        if not all([fast_current, slow_current, fast_prev, slow_prev]):
            return None
        
        # 多单出场：死叉
        if pos["side"] == "LONG" and fast_prev >= slow_prev and fast_current < slow_current:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"Death Cross: MA{self.fast_period}({fast_current:.2f}) < MA{self.slow_period}({slow_current:.2f})",
                side="LONG",
                action="CLOSE"
            )
        
        # 空单出场：金叉
        elif pos["side"] == "SHORT" and fast_prev <= slow_prev and fast_current > slow_current:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"Golden Cross: MA{self.fast_period}({fast_current:.2f}) > MA{self.slow_period}({slow_current:.2f})",
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
        双均线策略特定的信号确认
        """
        # 1. 调用基类的确认逻辑（包含AI增强）
        if not await super().confirm_signal(signal, kline, indicator):
            return False
        
        # 2. 双均线特定过滤：避免在极端波动时交易
        if indicator.atr14 and indicator.ma20:
            atr_pct = indicator.atr14 / indicator.ma20
            if atr_pct > 0.08:  # ATR超过价格8%，市场过于波动
                logger.info(f"Dual MA signal rejected: extreme volatility {atr_pct:.2%}")
                return False
        
        return True
