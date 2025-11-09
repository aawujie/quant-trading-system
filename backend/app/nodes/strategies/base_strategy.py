"""Base class for all trading strategies"""

import logging
from abc import abstractmethod
from typing import List, Dict, Optional

from app.core.node_base import ProcessorNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData

logger = logging.getLogger(__name__)


class BaseStrategy(ProcessorNode):
    """
    策略基类
    
    所有策略都继承这个基类，只需实现 check_signal() 方法
    
    职责：
    - 订阅K线和指标数据
    - 维护状态缓存
    - 验证数据完整性
    - 调用子类的信号检测逻辑
    - 保存和发布信号
    """
    
    def __init__(
        self,
        strategy_name: str,
        bus: MessageBus,
        db: Database,
        symbols: List[str],
        timeframe: str,
        **params
    ):
        """
        初始化策略
        
        Args:
            strategy_name: 策略标识符 (e.g., 'dual_ma', 'macd')
            bus: MessageBus 实例
            db: Database 实例
            symbols: 交易对列表
            timeframe: 时间周期
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
        
        # 状态缓存：存储最新的K线、当前指标和前一个指标
        self.state: Dict[str, Dict[str, Optional[object]]] = {
            symbol: {
                "kline": None,
                "indicator": None,
                "prev_indicator": None
            }
            for symbol in symbols
        }
        
        logger.info(
            f"{self.name} initialized: {len(symbols)} symbols, "
            f"timeframe={timeframe}, params={params}"
        )
    
    async def process(self, topic: str, data: dict) -> None:
        """
        处理K线或指标数据（通用逻辑）
        
        Args:
            topic: 主题名称
            data: 数据字典
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
                logger.debug(f"[{self.strategy_name}] Updated K-line for {symbol}")
                
            elif data_type == "indicator":
                # 保存前一个指标用于交叉检测
                if self.state[symbol]["indicator"]:
                    self.state[symbol]["prev_indicator"] = self.state[symbol]["indicator"]
                self.state[symbol]["indicator"] = IndicatorData(**data)
                logger.debug(f"[{self.strategy_name}] Updated indicator for {symbol}")
            
            # 检查数据完整性（需要K线、当前指标和前一个指标）
            if not all([
                self.state[symbol]["kline"],
                self.state[symbol]["indicator"],
                self.state[symbol]["prev_indicator"]
            ]):
                logger.debug(
                    f"[{self.strategy_name}] Waiting for complete data for {symbol}"
                )
                return
            
            # 获取数据
            kline: KlineData = self.state[symbol]["kline"]
            current_indicator: IndicatorData = self.state[symbol]["indicator"]
            prev_indicator: IndicatorData = self.state[symbol]["prev_indicator"]
            
            # 验证时间戳对齐
            if kline.timestamp != current_indicator.timestamp:
                logger.debug(
                    f"[{self.strategy_name}] Timestamp mismatch for {symbol}: "
                    f"kline={kline.timestamp}, indicator={current_indicator.timestamp}"
                )
                return
            
            # 调用子类的信号检测逻辑
            signal = await self.check_signal(
                symbol,
                kline,
                current_indicator,
                prev_indicator
            )
            
            if signal:
                # 保存到数据库
                success = await self.db.insert_signal(signal)
                
                if success:
                    logger.info(
                        f"[{self.strategy_name}] Generated {signal.signal_type.value} "
                        f"signal for {symbol} @ {signal.price:.2f}: {signal.reason}"
                    )
                    
                    # 发布到消息总线
                    output_topic = f"signal:{self.strategy_name}:{symbol}"
                    await self.emit(output_topic, signal.model_dump())
            
        except Exception as e:
            logger.error(f"[{self.strategy_name}] Error processing {topic}: {e}")
    
    @abstractmethod
    async def check_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        检测交易信号（由子类实现）
        
        Args:
            symbol: 交易对
            kline: 当前K线
            current_indicator: 当前指标
            prev_indicator: 前一个指标
            
        Returns:
            SignalData 对象或 None
        """
        pass
    
    def _calculate_confidence(self, indicator: IndicatorData) -> float:
        """
        计算信号置信度（可被子类重写）
        
        默认实现：基于RSI、MACD和成交量
        
        Args:
            indicator: 指标数据
            
        Returns:
            置信度分数 (0.0 - 1.0)
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
            if indicator.macd_histogram > 0:
                confidence += 0.1
        
        # 成交量高于均值
        if indicator.volume_ma5:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _calculate_stop_loss(self, kline: KlineData, is_long: bool) -> float:
        """
        计算止损价（可被子类重写）
        
        默认使用 2% 止损
        
        Args:
            kline: 当前K线
            is_long: True=做多, False=做空
            
        Returns:
            止损价格
        """
        if is_long:
            return kline.close * 0.98  # -2%
        else:
            return kline.close * 1.02  # +2%
    
    def _calculate_take_profit(self, kline: KlineData, is_long: bool) -> float:
        """
        计算止盈价（可被子类重写）
        
        默认使用 4% 止盈（2:1 风险回报比）
        
        Args:
            kline: 当前K线
            is_long: True=做多, False=做空
            
        Returns:
            止盈价格
        """
        if is_long:
            return kline.close * 1.04  # +4%
        else:
            return kline.close * 0.96  # -4%
    
    def __repr__(self) -> str:
        return (
            f"<{self.__class__.__name__} "
            f"strategy={self.strategy_name} "
            f"symbols={len(self.symbols)} "
            f"timeframe={self.timeframe} "
            f"running={self.is_running}>"
        )

