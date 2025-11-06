"""Trading strategy nodes"""

import logging
from typing import List, Dict, Optional

from app.core.node_base import ProcessorNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData, SignalType

logger = logging.getLogger(__name__)


class DualMAStrategyNode(ProcessorNode):
    """
    Dual Moving Average crossover strategy
    
    Strategy Logic:
    - Golden Cross: When MA5 crosses above MA20 -> BUY signal
    - Death Cross: When MA5 crosses below MA20 -> SELL signal
    
    Responsibilities:
    - Subscribe to K-line and indicator data
    - Detect MA crossovers
    - Generate trading signals
    - Save signals to database
    - Publish signals to message bus
    """
    
    def __init__(
        self,
        bus: MessageBus,
        db: Database,
        symbols: List[str],
        timeframe: str,
        fast_period: int = 5,
        slow_period: int = 20
    ):
        """
        Initialize dual MA strategy node
        
        Args:
            bus: MessageBus instance
            db: Database instance
            symbols: List of symbols to trade
            timeframe: Timeframe for strategy (e.g., '1h')
            fast_period: Fast MA period (default: 5)
            slow_period: Slow MA period (default: 20)
        """
        super().__init__("dual_ma_strategy", bus)
        
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
        self.fast_period = fast_period
        self.slow_period = slow_period
        
        # Subscribe to K-line and indicator topics
        self.input_topics = []
        for symbol in symbols:
            self.input_topics.append(f"kline:{symbol}:{timeframe}")
            self.input_topics.append(f"indicator:{symbol}:{timeframe}")
        
        # Define output topics
        self.output_topics = [
            f"signal:dual_ma:{symbol}"
            for symbol in symbols
        ]
        
        # State cache: stores latest K-line and indicator for each symbol
        self.state: Dict[str, Dict[str, Optional[object]]] = {
            symbol: {"kline": None, "indicator": None}
            for symbol in symbols
        }
        
        logger.info(
            f"DualMAStrategyNode initialized: {len(symbols)} symbols, "
            f"timeframe={timeframe}, "
            f"MA({fast_period}/{slow_period})"
        )
    
    async def process(self, topic: str, data: dict) -> None:
        """
        Process incoming K-line or indicator data
        
        Args:
            topic: Topic name
            data: Data dictionary
        """
        try:
            # Parse topic
            parts = topic.split(":")
            if len(parts) < 3:
                logger.warning(f"Invalid topic format: {topic}")
                return
            
            data_type = parts[0]  # 'kline' or 'indicator'
            symbol = parts[1]
            
            # Update state
            if data_type == "kline":
                self.state[symbol]["kline"] = KlineData(**data)
                logger.debug(f"Updated K-line for {symbol}")
                
            elif data_type == "indicator":
                self.state[symbol]["indicator"] = IndicatorData(**data)
                logger.debug(f"Updated indicator for {symbol}")
            
            # Check if we have both K-line and indicator
            if not all(self.state[symbol].values()):
                logger.debug(
                    f"Waiting for complete data for {symbol} "
                    f"(kline: {self.state[symbol]['kline'] is not None}, "
                    f"indicator: {self.state[symbol]['indicator'] is not None})"
                )
                return
            
            # Get current data
            kline: KlineData = self.state[symbol]["kline"]
            indicator: IndicatorData = self.state[symbol]["indicator"]
            
            # Verify timestamp alignment
            if kline.timestamp != indicator.timestamp:
                logger.debug(
                    f"Timestamp mismatch for {symbol}: "
                    f"kline={kline.timestamp}, indicator={indicator.timestamp}"
                )
                return
            
            # Check if indicators are ready
            if indicator.ma5 is None or indicator.ma20 is None:
                logger.debug(
                    f"Indicators not ready for {symbol} "
                    f"(MA5={indicator.ma5}, MA20={indicator.ma20})"
                )
                return
            
            # Get previous indicator (to detect crossover)
            prev_indicator = await self.db.get_indicator_at(
                symbol,
                self.timeframe,
                kline.timestamp - 3600  # Assume 1h timeframe
            )
            
            if not prev_indicator:
                logger.debug(
                    f"No previous indicator data for {symbol}, "
                    f"cannot detect crossover yet"
                )
                return
            
            if prev_indicator.ma5 is None or prev_indicator.ma20 is None:
                logger.debug(
                    f"Previous indicators incomplete for {symbol}"
                )
                return
            
            # Detect crossover and generate signal
            signal = await self._check_crossover(
                symbol,
                kline,
                indicator,
                prev_indicator
            )
            
            if signal:
                # Save to database
                success = await self.db.insert_signal(signal)
                
                if success:
                    logger.info(
                        f"Generated {signal.signal_type.value} signal for {symbol} "
                        f"@ {signal.price:.2f}: {signal.reason}"
                    )
                    
                    # Publish to message bus
                    output_topic = f"signal:dual_ma:{symbol}"
                    await self.emit(output_topic, signal.model_dump())
            
        except Exception as e:
            logger.error(f"Error processing data from topic '{topic}': {e}")
    
    async def _check_crossover(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: IndicatorData
    ) -> Optional[SignalData]:
        """
        Check for MA crossover and generate signal if detected
        
        Args:
            symbol: Trading symbol
            kline: Current K-line data
            current_indicator: Current indicator data
            prev_indicator: Previous indicator data
            
        Returns:
            SignalData object if signal detected, None otherwise
        """
        ma5_current = current_indicator.ma5
        ma20_current = current_indicator.ma20
        ma5_prev = prev_indicator.ma5
        ma20_prev = prev_indicator.ma20
        
        # Golden Cross: MA5 crosses above MA20 (BUY signal)
        if ma5_prev <= ma20_prev and ma5_current > ma20_current:
            signal = SignalData(
                strategy_name="dual_ma",
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.BUY,
                price=kline.close,
                reason=(
                    f"Golden Cross: MA{self.fast_period}({ma5_current:.2f}) "
                    f"crossed above MA{self.slow_period}({ma20_current:.2f})"
                ),
                confidence=self._calculate_confidence(current_indicator),
                stop_loss=self._calculate_stop_loss(kline, is_long=True),
                take_profit=self._calculate_take_profit(kline, is_long=True)
            )
            
            logger.info(
                f"Golden Cross detected for {symbol}: "
                f"MA5 {ma5_prev:.2f}->{ma5_current:.2f}, "
                f"MA20 {ma20_prev:.2f}->{ma20_current:.2f}"
            )
            
            return signal
        
        # Death Cross: MA5 crosses below MA20 (SELL signal)
        elif ma5_prev >= ma20_prev and ma5_current < ma20_current:
            signal = SignalData(
                strategy_name="dual_ma",
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.SELL,
                price=kline.close,
                reason=(
                    f"Death Cross: MA{self.fast_period}({ma5_current:.2f}) "
                    f"crossed below MA{self.slow_period}({ma20_current:.2f})"
                ),
                confidence=self._calculate_confidence(current_indicator),
                stop_loss=self._calculate_stop_loss(kline, is_long=False),
                take_profit=self._calculate_take_profit(kline, is_long=False)
            )
            
            logger.info(
                f"Death Cross detected for {symbol}: "
                f"MA5 {ma5_prev:.2f}->{ma5_current:.2f}, "
                f"MA20 {ma20_prev:.2f}->{ma20_current:.2f}"
            )
            
            return signal
        
        # No crossover detected
        return None
    
    def _calculate_confidence(self, indicator: IndicatorData) -> float:
        """
        Calculate signal confidence based on additional indicators
        
        Args:
            indicator: IndicatorData object
            
        Returns:
            Confidence score (0.0 - 1.0)
        """
        confidence = 0.5  # Base confidence
        
        # Increase confidence if RSI is in normal range (30-70)
        if indicator.rsi14:
            if 40 <= indicator.rsi14 <= 60:
                confidence += 0.2
            elif 30 <= indicator.rsi14 <= 70:
                confidence += 0.1
        
        # Increase confidence if MACD confirms trend
        if indicator.macd_histogram:
            if indicator.macd_histogram > 0:
                confidence += 0.1
        
        # Increase confidence if volume is above average
        if indicator.volume_ma5:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _calculate_stop_loss(self, kline: KlineData, is_long: bool) -> float:
        """
        Calculate stop loss price
        
        Args:
            kline: Current K-line data
            is_long: True for long position, False for short
            
        Returns:
            Stop loss price
        """
        # Use 2% stop loss by default
        if is_long:
            return kline.close * 0.98
        else:
            return kline.close * 1.02
    
    def _calculate_take_profit(self, kline: KlineData, is_long: bool) -> float:
        """
        Calculate take profit price
        
        Args:
            kline: Current K-line data
            is_long: True for long position, False for short
            
        Returns:
            Take profit price
        """
        # Use 4% take profit by default (2:1 risk/reward ratio)
        if is_long:
            return kline.close * 1.04
        else:
            return kline.close * 0.96
    
    def __repr__(self) -> str:
        return (
            f"<DualMAStrategyNode "
            f"symbols={len(self.symbols)} "
            f"timeframe={self.timeframe} "
            f"MA({self.fast_period}/{self.slow_period}) "
            f"running={self.is_running}>"
        )

