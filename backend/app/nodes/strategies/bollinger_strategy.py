"""Bollinger Bands Strategy"""

import logging
from typing import Optional

from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class BollingerStrategy(BaseStrategy):
    """
    布林带策略 (Bollinger Bands)
    
    策略逻辑：
    - 价格触及下轨并反弹 → BUY信号
    - 价格触及上轨并回落 → SELL信号
    
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
        touch_threshold: float = 0.005  # 0.5%
    ):
        """
        初始化布林带策略
        
        Args:
            bus: MessageBus实例
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            touch_threshold: 触及阈值（占价格的百分比）
        """
        super().__init__(
            strategy_name="bollinger",
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=timeframe,
            touch_threshold=touch_threshold
        )
        
        self.touch_threshold = touch_threshold
        
        logger.info(
            f"BollingerStrategy initialized: touch_threshold={touch_threshold*100:.1f}%"
        )
    
    async def check_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        检测布林带突破信号
        
        Args:
            symbol: 交易对
            kline: 当前K线
            current_indicator: 当前指标
            prev_indicator: 前一个指标
            
        Returns:
            SignalData对象或None
        """
        # 获取布林带值
        bb_upper_current = current_indicator.bb_upper
        bb_middle_current = current_indicator.bb_middle
        bb_lower_current = current_indicator.bb_lower
        
        bb_lower_prev = prev_indicator.bb_lower
        bb_upper_prev = prev_indicator.bb_upper
        
        # 当前价格
        price_current = kline.close
        price_prev = prev_indicator.ma20  # 使用前一根的收盘价（用MA20近似）
        
        # 检查数据完整性
        if not all([bb_upper_current, bb_middle_current, bb_lower_current, bb_lower_prev, bb_upper_prev]):
            logger.debug(
                f"[bollinger] Incomplete Bollinger Bands data for {symbol}"
            )
            return None
        
        # 计算触及阈值
        lower_touch_threshold = bb_lower_current * (1 + self.touch_threshold)
        upper_touch_threshold = bb_upper_current * (1 - self.touch_threshold)
        
        # 🟢 下轨反弹信号（买入）
        # 条件1：前一根价格在下轨附近或下方
        # 条件2：当前价格反弹回到下轨上方
        prev_near_lower = price_prev <= lower_touch_threshold if price_prev else False
        current_above_lower = price_current > bb_lower_current
        
        if prev_near_lower and current_above_lower:
            # 计算反弹强度
            bounce_strength = (price_current - bb_lower_current) / bb_lower_current * 100
            
            confidence = self._calculate_confidence(current_indicator)
            if bounce_strength > 1.0:  # 反弹超过1%
                confidence = min(confidence + 0.15, 1.0)
            
            # 计算布林带宽度（判断波动性）
            bb_width = (bb_upper_current - bb_lower_current) / bb_middle_current * 100
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,  # ← 改为开多
                price=kline.close,
                reason=(
                    f"Bollinger Lower Band Bounce: "
                    f"Price({price_current:.2f}) bounced from lower band({bb_lower_current:.2f}), "
                    f"bounce strength: +{bounce_strength:.2f}%, BB width: {bb_width:.2f}%"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=True),
                take_profit=self._calculate_take_profit(kline, is_long=True),
                side="LONG",   # ← 做多方向
                action="OPEN"  # ← 开仓操作
            )
            
            logger.info(
                f"[bollinger] Lower band bounce detected for {symbol}: "
                f"Price {price_current:.2f}, Lower band {bb_lower_current:.2f}"
            )
            
            return signal
        
        # 🔴 上轨回落信号（卖出）
        # 条件1：前一根价格在上轨附近或上方
        # 条件2：当前价格回落到上轨下方
        prev_near_upper = price_prev >= upper_touch_threshold if price_prev else False
        current_below_upper = price_current < bb_upper_current
        
        if prev_near_upper and current_below_upper:
            # 计算回落强度
            pullback_strength = (bb_upper_current - price_current) / bb_upper_current * 100
            
            confidence = self._calculate_confidence(current_indicator)
            if pullback_strength > 1.0:  # 回落超过1%
                confidence = min(confidence + 0.15, 1.0)
            
            # 计算布林带宽度
            bb_width = (bb_upper_current - bb_lower_current) / bb_middle_current * 100
            
            signal = SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,  # ← 改为开空
                price=kline.close,
                reason=(
                    f"Bollinger Upper Band Pullback: "
                    f"Price({price_current:.2f}) pulled back from upper band({bb_upper_current:.2f}), "
                    f"pullback strength: -{pullback_strength:.2f}%, BB width: {bb_width:.2f}%"
                ),
                confidence=confidence,
                stop_loss=self._calculate_stop_loss(kline, is_long=False),
                take_profit=self._calculate_take_profit(kline, is_long=False),
                side="SHORT",  # ← 做空方向
                action="OPEN"  # ← 开仓操作
            )
            
            logger.info(
                f"[bollinger] Upper band pullback detected for {symbol}: "
                f"Price {price_current:.2f}, Upper band {bb_upper_current:.2f}"
            )
            
            return signal
        
        # 无信号
        return None
    
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
            if bb_width > 0.05:  # 宽度较大，波动性高
                confidence += 0.1
        
        return min(confidence, 1.0)

