"""Technical indicator calculation node"""

import logging
import time
from typing import List, Dict, Optional

import pandas as pd
import talib
import numpy as np

from app.core.node_base import ProcessorNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.models.market_data import KlineData
from app.models.indicators import (
    IndicatorData, 
    get_max_required_klines,
    get_min_required_klines
)
from app.indicators.calculators import IndicatorCalculatorSet

logger = logging.getLogger(__name__)


class IndicatorNode(ProcessorNode):
    """
    Technical indicator calculation node (增量计算版本)
    
    Responsibilities:
    - Subscribe to K-line data
    - Calculate technical indicators using incremental calculators
    - Save indicators to database
    - Publish indicator data to message bus
    
    Features:
    - 高性能增量计算（O(1)复杂度）
    - 无需每次查询数据库
    - 状态保持，实时更新
    - 支持多交易对、多时间周期
    - 自动预热（首次启动时用历史数据初始化）
    
    Performance:
    - 计算延迟：<1ms（vs 之前 ~50ms）
    - 数据库查询：仅初始化时（vs 之前每次）
    - 内存使用：~10KB/交易对（可接受）
    """
    
    def __init__(
        self,
        bus: MessageBus,
        db: Database,
        symbols: List[str],
        timeframes: List[str],
        market_types: List[str] = None,
        use_incremental: bool = True
    ):
        """
        Initialize indicator node
        
        Args:
            bus: MessageBus instance
            db: Database instance
            symbols: List of symbols to track
            timeframes: List of timeframes
            market_types: List of market types (e.g., ['spot', 'future']), None for all
            use_incremental: 是否使用增量计算（默认 True）
        """
        super().__init__("indicator_node", bus)
        
        self.db = db
        self.symbols = symbols
        self.timeframes = timeframes
        self.market_types = market_types or ['spot', 'future']  # 默认订阅所有市场
        self.use_incremental = use_incremental
        
        # 自动从元数据计算需要的 K 线数量
        self.lookback_periods = get_max_required_klines()
        self.min_required_klines = get_min_required_klines()
        
        logger.info(
            f"📊 Indicator K-line requirements: "
            f"min={self.min_required_klines}, max={self.lookback_periods}"
        )
        
        # 增量计算器：为每个 symbol:timeframe 维护一个独立的计算器集合
        # key: "BTCUSDT:1h" -> IndicatorCalculatorSet
        self.calculators: Dict[str, IndicatorCalculatorSet] = {}
        
        # 性能统计
        self.stats = {
            'calc_time_total': 0.0,
            'calc_count': 0,
            'db_query_count': 0,
        }
        
        # Subscribe to all K-line topics (with market_type)
        self.input_topics = [
            f"kline:{symbol}:{tf}:{mt}"
            for symbol in symbols
            for tf in timeframes
            for mt in self.market_types
        ]
        
        # Define output topics (without market_type, indicators are unified)
        self.output_topics = [
            f"indicator:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        # Cache for recent data (legacy, for non-incremental mode)
        self._cache: Dict[str, List[KlineData]] = {}
        
        mode = "增量计算" if use_incremental else "传统计算"
        logger.info(
            f"IndicatorNode initialized ({mode}): {len(symbols)} symbols, "
            f"{len(timeframes)} timeframes, "
            f"{len(self.market_types)} market_types"
        )
    
    async def process(self, topic: str, data: dict) -> None:
        """
        Process incoming K-line data and calculate indicators
        
        增量计算模式：
        1. 首次接收：用历史数据预热计算器
        2. 后续接收：O(1) 增量更新
        
        传统模式（向后兼容）：
        1. 每次查询历史数据
        2. 重新计算所有指标
        
        Args:
            topic: Topic name (e.g., 'kline:BTCUSDT:1h:future')
            data: K-line data dictionary
        """
        try:
            # Parse topic
            parts = topic.split(":")
            if len(parts) != 4:
                logger.warning(f"Invalid topic format: {topic}")
                return
            
            _, symbol, timeframe, market_type = parts
            
            # Parse K-line data
            kline = KlineData(**data)
            
            logger.debug(
                f"Processing K-line: {symbol} {timeframe} @ {kline.timestamp}"
            )
            
            # 选择计算模式
            if self.use_incremental:
                indicator = await self._process_incremental(
                    symbol, timeframe, market_type, kline
                )
            else:
                indicator = await self._process_traditional(
                    symbol, timeframe, market_type, kline
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
    
    async def _process_incremental(
        self, 
        symbol: str, 
        timeframe: str, 
        market_type: str,
        kline: KlineData
    ) -> Optional[IndicatorData]:
        """
        增量计算模式：O(1) 复杂度，无需查询数据库
        
        首次调用：用历史数据预热计算器
        后续调用：直接增量更新
        
        Returns:
            IndicatorData 或 None（数据不足时）
        """
        # 计算器 key
        calc_key = f"{symbol}:{timeframe}"
        
        # 首次调用：初始化计算器
        if calc_key not in self.calculators:
            logger.info(f"🔧 Initializing calculator for {calc_key}...")
            success = await self._initialize_calculator(
                symbol, timeframe, market_type, calc_key
            )
            if not success:
                return None
        
        # 性能监控：开始计时
        start_time = time.time()
        
        # 增量计算：O(1) 复杂度
        calc_set = self.calculators[calc_key]
        indicator_dict = calc_set.update(kline)
        
        # 性能监控：结束计时
        calc_time = time.time() - start_time
        self.stats['calc_time_total'] += calc_time
        self.stats['calc_count'] += 1
        
        # 性能告警
        if calc_time > 0.01:  # 超过 10ms
            logger.warning(
                f"⚠️ Incremental calculation too slow: {calc_time*1000:.2f}ms for {calc_key}"
            )
        
        # 转换为 IndicatorData 对象
        indicator = IndicatorData(**indicator_dict)
        
        logger.debug(
            f"📊 Incremental calc: {calc_key} @ {indicator.timestamp} "
            f"({calc_time*1000:.2f}ms, update #{calc_set.update_count})"
        )
        
        return indicator
    
    async def _initialize_calculator(
        self,
        symbol: str,
        timeframe: str,
        market_type: str,
        calc_key: str
    ) -> bool:
        """
        初始化计算器：用历史数据预热
        
        这是唯一需要查询数据库的地方！
        
        Returns:
            是否初始化成功
        """
        try:
            # 查询历史数据（仅此一次！）
            historical_klines = await self.db.get_recent_klines(
                symbol,
                timeframe,
                limit=self.lookback_periods,
                market_type=market_type
            )
            
            self.stats['db_query_count'] += 1
            
            # 检查数据是否足够
            if len(historical_klines) < self.min_required_klines:
                logger.warning(
                    f"⚠️ Insufficient historical data for {calc_key}: "
                    f"{len(historical_klines)} klines (need >={self.min_required_klines})"
                )
                return False
            
            # 创建计算器集合
            calc_set = IndicatorCalculatorSet()
            
            # 用历史数据预热
            logger.info(
                f"🔥 Preheating calculator for {calc_key} with "
                f"{len(historical_klines)} historical klines..."
            )
            
            for kline in historical_klines:
                calc_set.update(kline)
            
            # 保存到字典
            self.calculators[calc_key] = calc_set
            
            # 输出状态
            status = calc_set.get_status()
            logger.info(
                f"✅ Calculator initialized for {calc_key}: "
                f"updates={status['update_count']}, "
                f"ma5_ready={status['ma5_ready']}, "
                f"ma120_ready={status['ma120_ready']}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize calculator for {calc_key}: {e}")
            return False
    
    async def _process_traditional(
        self,
        symbol: str,
        timeframe: str,
        market_type: str,
        kline: KlineData
    ) -> Optional[IndicatorData]:
        """
        传统计算模式：每次查询数据库，重新计算
        
        保留此方法用于：
        1. 向后兼容
        2. 对比测试
        3. 验证增量计算的正确性
        
        Returns:
            IndicatorData 或 None
        """
        # Load recent K-lines from database
        recent_klines = await self.db.get_recent_klines(
            symbol,
            timeframe,
            limit=self.lookback_periods,
            market_type=market_type
        )
        
        self.stats['db_query_count'] += 1
        
        # 检查是否有足够的K线数据计算任何指标
        if len(recent_klines) < self.min_required_klines:
            logger.debug(
                f"Insufficient data for {symbol} {timeframe}: "
                f"{len(recent_klines)} K-lines (need at least {self.min_required_klines})"
            )
            return None
        
        # Calculate indicators (legacy method)
        indicator = await self._calculate_indicators(
            symbol,
            timeframe,
            recent_klines
        )
        
        return indicator
    
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
            
            # 检查数据量，记录能计算哪些指标
            data_count = len(df)
            logger.debug(
                f"Calculating indicators with {data_count} K-lines for {symbol} {timeframe}"
            )
            
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
            
            # Format indicator values for logging
            ma5_str = f"{indicator.ma5:.2f}" if indicator.ma5 is not None else "None"
            ma20_str = f"{indicator.ma20:.2f}" if indicator.ma20 is not None else "None"
            rsi_str = f"{indicator.rsi14:.2f}" if indicator.rsi14 is not None else "None"
            
            logger.debug(
                f"Calculated indicators for {symbol} {timeframe}: "
                f"MA5={ma5_str}, MA20={ma20_str}, RSI={rsi_str}"
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

