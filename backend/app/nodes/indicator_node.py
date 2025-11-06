"""Technical indicator calculation node"""

import logging
from typing import List, Dict, Optional

import pandas as pd
import talib
import numpy as np

from app.core.node_base import ProcessorNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)


class IndicatorNode(ProcessorNode):
    """
    Technical indicator calculation node
    
    Responsibilities:
    - Subscribe to K-line data
    - Calculate technical indicators using TA-Lib
    - Save indicators to database
    - Publish indicator data to message bus
    
    Features:
    - Supports multiple symbols
    - Supports multiple timeframes
    - Calculates: MA, EMA, RSI, MACD, Bollinger Bands, ATR
    - Uses historical data for accurate calculations
    """
    
    def __init__(
        self,
        bus: MessageBus,
        db: Database,
        symbols: List[str],
        timeframes: List[str],
        lookback_periods: int = 200
    ):
        """
        Initialize indicator node
        
        Args:
            bus: MessageBus instance
            db: Database instance
            symbols: List of symbols to track
            timeframes: List of timeframes
            lookback_periods: Number of historical periods to use for calculations
        """
        super().__init__("indicator_node", bus)
        
        self.db = db
        self.symbols = symbols
        self.timeframes = timeframes
        self.lookback_periods = lookback_periods
        
        # Subscribe to all K-line topics
        self.input_topics = [
            f"kline:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        # Define output topics
        self.output_topics = [
            f"indicator:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        # Cache for recent data (to avoid excessive database queries)
        self._cache: Dict[str, List[KlineData]] = {}
        
        logger.info(
            f"IndicatorNode initialized: {len(symbols)} symbols, "
            f"{len(timeframes)} timeframes, "
            f"lookback={lookback_periods}"
        )
    
    async def process(self, topic: str, data: dict) -> None:
        """
        Process incoming K-line data and calculate indicators
        
        Args:
            topic: Topic name (e.g., 'kline:BTCUSDT:1h')
            data: K-line data dictionary
        """
        try:
            # Parse topic
            parts = topic.split(":")
            if len(parts) != 3:
                logger.warning(f"Invalid topic format: {topic}")
                return
            
            _, symbol, timeframe = parts
            
            # Parse K-line data
            kline = KlineData(**data)
            
            logger.debug(
                f"Processing K-line: {symbol} {timeframe} @ {kline.timestamp}"
            )
            
            # Load recent K-lines from database (for accurate indicator calculation)
            recent_klines = await self.db.get_recent_klines(
                symbol,
                timeframe,
                limit=self.lookback_periods
            )
            
            if len(recent_klines) < 20:
                logger.debug(
                    f"Insufficient data for {symbol} {timeframe}: "
                    f"{len(recent_klines)} K-lines (need at least 20)"
                )
                return
            
            # Calculate indicators
            indicator = await self._calculate_indicators(
                symbol,
                timeframe,
                recent_klines
            )
            
            if not indicator:
                logger.debug(
                    f"Indicators not ready for {symbol} {timeframe}"
                )
                return
            
            # Save to database
            success = await self.db.insert_indicator(indicator)
            
            if success:
                logger.debug(
                    f"Saved indicators for {symbol} {timeframe} @ {indicator.timestamp}"
                )
            
            # Publish to message bus
            output_topic = f"indicator:{symbol}:{timeframe}"
            await self.emit(output_topic, indicator.model_dump())
            
            logger.debug(
                f"Published indicators to topic '{output_topic}'"
            )
            
        except Exception as e:
            logger.error(f"Error processing K-line from topic '{topic}': {e}")
    
    async def _calculate_indicators(
        self,
        symbol: str,
        timeframe: str,
        klines: List[KlineData]
    ) -> Optional[IndicatorData]:
        """
        Calculate technical indicators using TA-Lib
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe
            klines: List of K-line data (chronological order)
            
        Returns:
            IndicatorData object or None if calculation fails
        """
        try:
            # Convert to DataFrame
            df = pd.DataFrame([
                {
                    'timestamp': k.timestamp,
                    'open': k.open,
                    'high': k.high,
                    'low': k.low,
                    'close': k.close,
                    'volume': k.volume
                }
                for k in klines
            ])
            
            # Extract price arrays
            close = df['close'].values
            high = df['high'].values
            low = df['low'].values
            volume = df['volume'].values
            
            # Calculate Moving Averages
            ma5 = talib.SMA(close, timeperiod=5)
            ma10 = talib.SMA(close, timeperiod=10)
            ma20 = talib.SMA(close, timeperiod=20)
            ma60 = talib.SMA(close, timeperiod=60)
            ma120 = talib.SMA(close, timeperiod=120)
            
            # Calculate Exponential Moving Averages
            ema12 = talib.EMA(close, timeperiod=12)
            ema26 = talib.EMA(close, timeperiod=26)
            
            # Calculate RSI
            rsi14 = talib.RSI(close, timeperiod=14)
            
            # Calculate MACD
            macd_line, macd_signal, macd_histogram = talib.MACD(
                close,
                fastperiod=12,
                slowperiod=26,
                signalperiod=9
            )
            
            # Calculate Bollinger Bands
            bb_upper, bb_middle, bb_lower = talib.BBANDS(
                close,
                timeperiod=20,
                nbdevup=2,
                nbdevdn=2,
                matype=0
            )
            
            # Calculate ATR (Average True Range)
            atr14 = talib.ATR(high, low, close, timeperiod=14)
            
            # Calculate Volume Moving Average
            volume_ma5 = talib.SMA(volume, timeperiod=5)
            
            # Get latest values (last row)
            latest_idx = -1
            
            # Check if MA20 is ready (minimum requirement)
            if np.isnan(ma20[latest_idx]):
                logger.debug(
                    f"MA20 not ready for {symbol} {timeframe} "
                    f"(need at least 20 periods)"
                )
                return None
            
            # Create IndicatorData object
            indicator = IndicatorData(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=int(df['timestamp'].iloc[latest_idx]),
                ma5=float(ma5[latest_idx]) if not np.isnan(ma5[latest_idx]) else None,
                ma10=float(ma10[latest_idx]) if not np.isnan(ma10[latest_idx]) else None,
                ma20=float(ma20[latest_idx]) if not np.isnan(ma20[latest_idx]) else None,
                ma60=float(ma60[latest_idx]) if not np.isnan(ma60[latest_idx]) else None,
                ma120=float(ma120[latest_idx]) if not np.isnan(ma120[latest_idx]) else None,
                ema12=float(ema12[latest_idx]) if not np.isnan(ema12[latest_idx]) else None,
                ema26=float(ema26[latest_idx]) if not np.isnan(ema26[latest_idx]) else None,
                rsi14=float(rsi14[latest_idx]) if not np.isnan(rsi14[latest_idx]) else None,
                macd_line=float(macd_line[latest_idx]) if not np.isnan(macd_line[latest_idx]) else None,
                macd_signal=float(macd_signal[latest_idx]) if not np.isnan(macd_signal[latest_idx]) else None,
                macd_histogram=float(macd_histogram[latest_idx]) if not np.isnan(macd_histogram[latest_idx]) else None,
                bb_upper=float(bb_upper[latest_idx]) if not np.isnan(bb_upper[latest_idx]) else None,
                bb_middle=float(bb_middle[latest_idx]) if not np.isnan(bb_middle[latest_idx]) else None,
                bb_lower=float(bb_lower[latest_idx]) if not np.isnan(bb_lower[latest_idx]) else None,
                atr14=float(atr14[latest_idx]) if not np.isnan(atr14[latest_idx]) else None,
                volume_ma5=float(volume_ma5[latest_idx]) if not np.isnan(volume_ma5[latest_idx]) else None
            )
            
            logger.debug(
                f"Calculated indicators for {symbol} {timeframe}: "
                f"MA5={indicator.ma5:.2f if indicator.ma5 else None}, "
                f"MA20={indicator.ma20:.2f if indicator.ma20 else None}, "
                f"RSI={indicator.rsi14:.2f if indicator.rsi14 else None}"
            )
            
            return indicator
            
        except Exception as e:
            logger.error(
                f"Failed to calculate indicators for {symbol} {timeframe}: {e}"
            )
            return None
    
    def __repr__(self) -> str:
        return (
            f"<IndicatorNode "
            f"symbols={len(self.symbols)} "
            f"timeframes={len(self.timeframes)} "
            f"lookback={self.lookback_periods} "
            f"running={self.is_running}>"
        )

