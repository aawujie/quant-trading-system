"""Bollinger Bands Strategy (Refactored)"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class BollingerStrategy(BaseStrategy):
    """
    布林带策略（重构版）- Bollinger Bands
    
    策略逻辑：
    入场：
    - 价格触及下轨并反弹 → 开多（OPEN_LONG）
    - 价格触及上轨并回落 → 开空（OPEN_SHORT）
    
    出场：
    1. 基类默认止损/止盈/移动止损
    2. 价格触及中轨出场（均值回归完成）
    3. 反向触及轨道出场
    
    指标说明：
    - 中轨 = SMA(20)
    - 上轨 = 中轨 + 2 * 标准差
    - 下轨 = 中轨 - 2 * 标准差
    
    参数：
    - touch_threshold: 触及阈值百分比 (默认: 0.5%, 即价格在轨道0.5%范围内)
    
    适用场景：
    - 震荡市场
    - 超买超卖判断
    - 均值回归交易
    """
    
    def __init__(
        self,
        bus,
        db,
        symbols,
        timeframe,
        touch_threshold: float = 0.005,  # 0.5%
        enable_ai_enhancement: bool = False,
        **kwargs
    ):
        """
        初始化布林带策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            touch_threshold: 触及阈值（占价格的百分比）
            enable_ai_enhancement: 是否启用AI增强
        """
        super().__init__(
            strategy_name="bollinger",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            enable_ai_enhancement=enable_ai_enhancement,
            touch_threshold=touch_threshold,
            **kwargs
        )
        
        self.touch_threshold = touch_threshold
        
        logger.info(
            f"BollingerStrategy initialized: touch_threshold={touch_threshold*100:.1f}%, "
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
        检测布林带触及入场信号（重构版）
            
        Returns:
            SignalData对象或None
        """
        # 检查数据完整性
        if not prev_indicator:
            return None
        
        # 获取布林带值
        bb_upper_current = current_indicator.bb_upper
        bb_middle_current = current_indicator.bb_middle
        bb_lower_current = current_indicator.bb_lower
        
        bb_lower_prev = prev_indicator.bb_lower
        bb_upper_prev = prev_indicator.bb_upper
        
        # 当前价格
        price_current = kline.close
        
        if not all([bb_upper_current, bb_middle_current, bb_lower_current, bb_lower_prev, bb_upper_prev]):
            return None
        
        # 计算触及阈值
        lower_touch_threshold = bb_lower_current * (1 + self.touch_threshold)
        upper_touch_threshold = bb_upper_current * (1 - self.touch_threshold)
        
        # 计算布林带宽度（判断波动性）
        bb_width = (bb_upper_current - bb_lower_current) / bb_middle_current * 100
        
        # 🟢 下轨反弹信号（开多）
        # 条件1：价格触及或突破下轨
        # 条件2：当前价格回到下轨上方（反弹确认）
        touched_lower = price_current <= lower_touch_threshold
        above_lower = price_current > bb_lower_current
        
        if touched_lower and above_lower:
            # 计算反弹强度
            bounce_strength = (price_current - bb_lower_current) / bb_lower_current * 100
            
            # 计算距离中轨的位置（越接近下轨，信号越强）
            position_in_band = (price_current - bb_lower_current) / (bb_upper_current - bb_lower_current)
            
            confidence = self._calculate_confidence(current_indicator)
            
            # 增强条件1：强势反弹
            if bounce_strength > 0.5:
                confidence = min(confidence + 0.1, 1.0)
            
            # 增强条件2：RSI超卖
            if current_indicator.rsi14 and current_indicator.rsi14 < 35:
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,
                price=kline.close,
                reason=(
                    f"Bollinger Lower Band Bounce: "
                    f"Price({price_current:.2f}) bounced from lower band({bb_lower_current:.2f}), "
                    f"bounce: +{bounce_strength:.2f}%, BB width: {bb_width:.2f}%, "
                    f"position: {position_in_band:.1%}"
                ),
                confidence=confidence,
                side="LONG",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "LONG", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "LONG", current_indicator)
            )
            
            return signal
        
        # 🔴 上轨回落信号（开空）
        # 条件1：价格触及或突破上轨
        # 条件2：当前价格回到上轨下方（回落确认）
        touched_upper = price_current >= upper_touch_threshold
        below_upper = price_current < bb_upper_current
        
        if touched_upper and below_upper:
            # 计算回落强度
            pullback_strength = (bb_upper_current - price_current) / bb_upper_current * 100
            
            # 计算距离中轨的位置
            position_in_band = (price_current - bb_lower_current) / (bb_upper_current - bb_lower_current)
            
            confidence = self._calculate_confidence(current_indicator)
            
            # 增强条件1：强势回落
            if pullback_strength > 0.5:
                confidence = min(confidence + 0.1, 1.0)
            
            # 增强条件2：RSI超买
            if current_indicator.rsi14 and current_indicator.rsi14 > 65:
                confidence = min(confidence + 0.1, 1.0)
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,
                price=kline.close,
                reason=(
                    f"Bollinger Upper Band Pullback: "
                    f"Price({price_current:.2f}) pulled back from upper band({bb_upper_current:.2f}), "
                    f"pullback: -{pullback_strength:.2f}%, BB width: {bb_width:.2f}%, "
                    f"position: {position_in_band:.1%}"
                ),
                confidence=confidence,
                side="SHORT",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "SHORT", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "SHORT", current_indicator)
            )
            
            return signal
        
        # 无信号
        return None
    
    async def check_exit_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测布林带出场信号（策略特定）
        
        先调用基类的默认出场逻辑，然后添加布林带特定出场条件
        """
        # 1. 调用基类的默认出场逻辑
        base_exit = await super().check_exit_signal(
            symbol, kline, current_indicator, prev_indicator
        )
        if base_exit:
            return base_exit
        
        # 2. 布林带特定出场
        pos = self.positions[symbol]
        
        bb_upper = current_indicator.bb_upper
        bb_middle = current_indicator.bb_middle
        bb_lower = current_indicator.bb_lower
        price_current = kline.close
        
        if not all([bb_upper, bb_middle, bb_lower]):
            return None
        
        # 出场条件1：价格触及中轨（均值回归完成）
        middle_touch_threshold = bb_middle * 0.002  # 0.2%范围内
        
        # 多单：价格接近或超过中轨
        if pos["side"] == "LONG" and abs(price_current - bb_middle) <= middle_touch_threshold:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"Price reached middle band: {price_current:.2f} ≈ {bb_middle:.2f}",
                side="LONG",
                action="CLOSE"
            )
        
        # 空单：价格接近或低于中轨
        elif pos["side"] == "SHORT" and abs(price_current - bb_middle) <= middle_touch_threshold:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"Price reached middle band: {price_current:.2f} ≈ {bb_middle:.2f}",
                side="SHORT",
                action="CLOSE"
            )
        
        # 出场条件2：反向触及轨道（趋势反转）
        upper_touch_threshold = bb_upper * (1 - self.touch_threshold)
        lower_touch_threshold = bb_lower * (1 + self.touch_threshold)
        
        # 多单：价格触及上轨（目标达成）
        if pos["side"] == "LONG" and price_current >= upper_touch_threshold:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"Price touched upper band: {price_current:.2f} ≥ {bb_upper:.2f}",
                side="LONG",
                action="CLOSE"
            )
        
        # 空单：价格触及下轨（目标达成）
        elif pos["side"] == "SHORT" and price_current <= lower_touch_threshold:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"Price touched lower band: {price_current:.2f} ≤ {bb_lower:.2f}",
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
        布林带策略特定的信号确认
        """
        # 1. 调用基类的确认逻辑（包含AI增强）
        if not await super().confirm_signal(signal, kline, indicator):
            return False
        
        # 2. 布林带特定过滤：避免在布林带收缩时交易
        if all([indicator.bb_upper, indicator.bb_lower, indicator.bb_middle]):
            bb_width = (indicator.bb_upper - indicator.bb_lower) / indicator.bb_middle
            
            # 布林带太窄，市场缺乏波动性
            if bb_width < 0.02:  # 宽度小于2%
                logger.info(f"Bollinger signal rejected: band too narrow ({bb_width:.2%})")
                return False
            
            # 布林带太宽，市场过于波动
            if bb_width > 0.15:  # 宽度大于15%
                logger.info(f"Bollinger signal rejected: band too wide ({bb_width:.2%})")
                return False
        
        return True
    
    def _calculate_confidence(self, indicator: IndicatorData) -> float:
        """
        计算布林带策略的置信度
        
        考虑因素：
        - RSI确认超买超卖
        - 成交量
        - 布林带宽度（波动性）
        """
        confidence = 0.5
        
        # RSI确认
        if indicator.rsi14:
            if indicator.rsi14 < 35:  # 超卖区，支持买入
                confidence += 0.15
            elif indicator.rsi14 > 65:  # 超买区，支持卖出
                confidence += 0.15
            elif 40 <= indicator.rsi14 <= 60:  # 中性区
                confidence += 0.1
        
        # 成交量确认
        if indicator.volume_ma5:
            confidence += 0.1
        
        # 布林带宽度（波动性判断）
        if all([indicator.bb_upper, indicator.bb_lower, indicator.bb_middle]):
            bb_width = (indicator.bb_upper - indicator.bb_lower) / indicator.bb_middle
            if 0.03 <= bb_width <= 0.10:  # 宽度适中
                confidence += 0.15
        
        return min(confidence, 1.0)
