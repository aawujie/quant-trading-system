"""Base class for all trading strategies (Refactored)"""

import logging
import os
from abc import abstractmethod
from typing import List, Dict, Optional

from app.core.node_base import ProcessorNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class BaseStrategy(ProcessorNode):
    """
    策略基类（重构版）
    
    主要改进：
    1. 分离入场/出场信号检测
    2. 内置持仓跟踪
    3. 信号二次确认机制
    4. 基于ATR的动态止损/止盈
    5. AI增强支持
    """
    
    def __init__(
        self,
        strategy_name: str,
        bus: MessageBus,
        db: Database,
        symbols: List[str],
        timeframe: str,
        enable_ai_enhancement: bool = False,
        **params
    ):
        """
        初始化策略
        
        Args:
            strategy_name: 策略标识符
            bus: MessageBus 实例
            db: Database 实例
            symbols: 交易对列表
            timeframe: 时间周期
            enable_ai_enhancement: 是否启用AI增强
            **params: 策略特定参数
        """
        super().__init__(f"{strategy_name}_strategy", bus)
        
        self.strategy_name = strategy_name
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
        self.params = params
        
        # 订阅K线和指标主题
        self.input_topics = []
        for symbol in symbols:
            self.input_topics.append(f"kline:{symbol}:{timeframe}")
            self.input_topics.append(f"indicator:{symbol}:{timeframe}")
        
        # 定义输出主题
        self.output_topics = [
            f"signal:{strategy_name}:{symbol}"
            for symbol in symbols
        ]
        
        # 回测模式的直接信号处理器（避免 Redis 开销）
        self._direct_signal_handler = None
        
        # 状态缓存
        self.state: Dict[str, Dict[str, Optional[object]]] = {
            symbol: {
                "kline": None,
                "indicator": None,
                "prev_indicator": None
            }
            for symbol in symbols
        }
        
        # 持仓跟踪（新增）
        self.positions = {
            symbol: {
                "has_position": False,
                "side": None,
                "entry_price": None,
                "entry_time": None,
                "highest_price": None,  # 用于移动止损
                "lowest_price": None
            }
            for symbol in symbols
        }
        
        # AI增强（新增）
        self.enable_ai_enhancement = enable_ai_enhancement
        if enable_ai_enhancement:
            try:
                from app.ai.providers.deepseek import DeepSeekProvider
                from app.ai.signal_enhancer import AISignalEnhancer
                
                api_key = os.getenv('DEEPSEEK_API_KEY')
                if not api_key:
                    logger.warning("DEEPSEEK_API_KEY not set, AI disabled")
                    self.enable_ai_enhancement = False
                else:
                    provider = DeepSeekProvider(api_key)
                    self.ai_enhancer = AISignalEnhancer(provider)
                    logger.info("AI enhancement enabled")
            except ImportError:
                logger.warning("AI modules not available, AI disabled")
                self.enable_ai_enhancement = False
        
        logger.info(
            f"{self.name} initialized: {len(symbols)} symbols, "
            f"timeframe={timeframe}, AI={enable_ai_enhancement}, params={params}"
        )
    
    async def process(self, topic: str, data: dict) -> None:
        """
        处理K线或指标数据（重构版）
        """
        try:
            # 解析主题
            parts = topic.split(":")
            if len(parts) < 3:
                logger.warning(f"Invalid topic format: {topic}")
                return
            
            data_type = parts[0]  # 'kline' or 'indicator'
            symbol = parts[1]
            
            # 更新状态
            if data_type == "kline":
                self.state[symbol]["kline"] = KlineData(**data)
                
            elif data_type == "indicator":
                if self.state[symbol]["indicator"]:
                    self.state[symbol]["prev_indicator"] = self.state[symbol]["indicator"]
                self.state[symbol]["indicator"] = IndicatorData(**data)
            
            # 检查数据完整性
            if not all([
                self.state[symbol]["kline"],
                self.state[symbol]["indicator"],
                self.state[symbol]["prev_indicator"]
            ]):
                return
            
            kline: KlineData = self.state[symbol]["kline"]
            current_indicator: IndicatorData = self.state[symbol]["indicator"]
            prev_indicator: IndicatorData = self.state[symbol]["prev_indicator"]
            
            # 验证时间戳对齐
            if kline.timestamp != current_indicator.timestamp:
                return
            
            # 根据持仓状态决定检测入场还是出场（新逻辑）
            signal = None
            
            if self.positions[symbol]["has_position"]:
                # 有持仓：检测出场信号
                signal = await self.check_exit_signal(
                    symbol, kline, current_indicator, prev_indicator
                )
                
                if signal:
                    # 平仓
                    self.positions[symbol]["has_position"] = False
                    self.positions[symbol]["side"] = None
                    logger.info(
                        f"[{self.strategy_name}] Exit signal: {symbol} @ {signal.price:.2f} - {signal.reason}"
                    )
            else:
                # 无持仓：检测入场信号
                signal = await self.check_entry_signal(
                    symbol, kline, current_indicator, prev_indicator
                )
                
                if signal:
                    # 二次确认
                    confirmed = await self.confirm_signal(signal, kline, current_indicator)
                    if not confirmed:
                        logger.info(f"[{self.strategy_name}] Signal rejected by confirmation: {signal.signal_type}")
                        return
                    
                    # 开仓
                    self.positions[symbol]["has_position"] = True
                    self.positions[symbol]["side"] = signal.side
                    self.positions[symbol]["entry_price"] = signal.price
                    self.positions[symbol]["entry_time"] = signal.timestamp
                    self.positions[symbol]["highest_price"] = signal.price
                    self.positions[symbol]["lowest_price"] = signal.price
                    logger.info(
                        f"[{self.strategy_name}] Entry signal: {symbol} {signal.side} @ {signal.price:.2f} - {signal.reason}"
                    )
            
            # 更新最高/最低价（用于移动止损）
            if self.positions[symbol]["has_position"]:
                current_price = kline.close
                if current_price > self.positions[symbol]["highest_price"]:
                    self.positions[symbol]["highest_price"] = current_price
                if current_price < self.positions[symbol]["lowest_price"]:
                    self.positions[symbol]["lowest_price"] = current_price
            
            # 保存和发布信号
            if signal:
                # 检查是否有直接的信号处理器（回测模式使用）
                if hasattr(self, '_direct_signal_handler') and self._direct_signal_handler:
                    # 回测模式：直接调用处理器，不经过 Redis
                    await self._direct_signal_handler(signal)
                else:
                    # 实盘模式：保存到数据库并发布到 Redis
                    success = await self.db.insert_signal(signal)
                    if success:
                        output_topic = f"signal:{self.strategy_name}:{symbol}"
                        await self.emit(output_topic, signal.model_dump())
        
        except Exception as e:
            logger.error(f"[{self.strategy_name}] Error processing {topic}: {e}")
    
    @abstractmethod
    async def check_entry_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测入场信号（子类必须实现）
        
        Returns:
            SignalData or None
        """
        pass
    
    async def check_exit_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测出场信号（默认实现：固定止损/止盈/移动止损）
        
        子类可覆盖此方法添加策略特定的出场逻辑
        """
        pos = self.positions[symbol]
        current_price = kline.close
        
        # 1. 固定止损
        if pos["side"] == "LONG":
            # 多单止损
            stop_loss = self._calculate_stop_loss(pos["entry_price"], "LONG", current_indicator)
            if current_price <= stop_loss:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Stop loss triggered",
                    side="LONG",
                    action="CLOSE"
                )
            
            # 多单止盈
            take_profit = self._calculate_take_profit(pos["entry_price"], "LONG", current_indicator)
            if current_price >= take_profit:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Take profit triggered",
                    side="LONG",
                    action="CLOSE"
                )
            
            # 移动止损（简单版）
            trailing_stop = pos["highest_price"] * 0.95  # 从最高点回撤5%
            if current_price <= trailing_stop:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Trailing stop triggered",
                    side="LONG",
                    action="CLOSE"
                )
        
        elif pos["side"] == "SHORT":
            # 空单止损
            stop_loss = self._calculate_stop_loss(pos["entry_price"], "SHORT", current_indicator)
            if current_price >= stop_loss:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Stop loss triggered",
                    side="SHORT",
                    action="CLOSE"
                )
            
            # 空单止盈
            take_profit = self._calculate_take_profit(pos["entry_price"], "SHORT", current_indicator)
            if current_price <= take_profit:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Take profit triggered",
                    side="SHORT",
                    action="CLOSE"
                )
            
            # 移动止损
            trailing_stop = pos["lowest_price"] * 1.05  # 从最低点反弹5%
            if current_price >= trailing_stop:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Trailing stop triggered",
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
        信号二次确认（可选，子类可覆盖）
        
        过滤条件：
        1. 置信度过低
        2. 成交量不足
        3. 波动率过高
        4. AI增强判断
        """
        # 1. 基础过滤
        if signal.confidence and signal.confidence < 0.5:
            return False
        
        # 2. 成交量过滤
        if indicator.volume_ma5:
            volume_ratio = kline.volume / indicator.volume_ma5
            if volume_ratio < 0.5:  # 成交量低于5日均量50%
                logger.info(f"Signal rejected: low volume ratio {volume_ratio:.2f}")
                return False
        
        # 3. 波动率过滤
        if indicator.atr14 and indicator.ma20:
            atr_pct = indicator.atr14 / indicator.ma20
            if atr_pct > 0.05:  # ATR超过价格5%，市场过于波动
                logger.info(f"Signal rejected: high volatility {atr_pct:.2%}")
                return False
        
        # 4. AI增强（新增）
        if self.enable_ai_enhancement:
            try:
                # 获取历史交易
                historical_trades = await self.db.get_recent_trades(
                    strategy_name=self.strategy_name,
                    symbol=signal.symbol,
                    limit=10
                )
                
                # AI判断
                ai_decision = await self.ai_enhancer.enhance_signal(
                    signal, kline, indicator, historical_trades
                )
                
                # 记录AI推理
                signal.ai_enhanced = True
                signal.ai_reasoning = ai_decision['reasoning']
                signal.ai_confidence = ai_decision['ai_confidence']
                signal.ai_model = 'deepseek-chat'
                signal.ai_risk_assessment = ai_decision['risk_assessment']
                
                logger.info(
                    f"[AI] {signal.symbol} - Execute: {ai_decision['should_execute']}, "
                    f"Confidence: {ai_decision['ai_confidence']:.2f}"
                )
                
                # AI不建议执行
                if not ai_decision['should_execute']:
                    logger.info(f"[AI] Rejected: {ai_decision['reasoning'][:100]}")
                    return False
                
                # 更新置信度（AI+技术指标平均）
                signal.confidence = (signal.confidence + ai_decision['ai_confidence']) / 2
            
            except Exception as e:
                logger.error(f"AI enhancement failed: {e}")
                # AI失败不影响交易
        
        return True
    
    def _calculate_stop_loss(self, entry_price: float, side: str, indicator: IndicatorData) -> float:
        """
        计算止损价（基于ATR）
        """
        if indicator.atr14:
            # 使用2倍ATR作为止损距离
            atr_multiplier = 2.0
            stop_distance = indicator.atr14 * atr_multiplier
            
            if side == "LONG":
                return entry_price - stop_distance
            else:
                return entry_price + stop_distance
        else:
            # 回退到固定百分比
            if side == "LONG":
                return entry_price * 0.97  # 3%止损
            else:
                return entry_price * 1.03
    
    def _calculate_take_profit(self, entry_price: float, side: str, indicator: IndicatorData) -> float:
        """
        计算止盈价（基于ATR）
        """
        if indicator.atr14:
            # 使用3倍ATR作为止盈距离
            atr_multiplier = 3.0
            tp_distance = indicator.atr14 * atr_multiplier
            
            if side == "LONG":
                return entry_price + tp_distance
            else:
                return entry_price - tp_distance
        else:
            # 回退到固定百分比
            if side == "LONG":
                return entry_price * 1.06  # 6%止盈
            else:
                return entry_price * 0.94
    
    def _calculate_confidence(self, indicator: IndicatorData) -> float:
        """
        计算信号置信度（可被子类重写）
        
        默认实现：基于RSI、MACD和成交量
        """
        confidence = 0.5  # 基础置信度
        
        # RSI 在合理区间增加信心
        if indicator.rsi14:
            if 40 <= indicator.rsi14 <= 60:
                confidence += 0.2
            elif 30 <= indicator.rsi14 <= 70:
                confidence += 0.1
        
        # MACD 确认趋势
        if indicator.macd_histogram:
            if abs(indicator.macd_histogram) > 0:
                confidence += 0.1
        
        # 成交量高于均值
        if indicator.volume_ma5:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def __repr__(self) -> str:
        return (
            f"<{self.__class__.__name__} "
            f"strategy={self.strategy_name} "
            f"symbols={len(self.symbols)} "
            f"timeframe={self.timeframe} "
            f"running={self.is_running}>"
        )
