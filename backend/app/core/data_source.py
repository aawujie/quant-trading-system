"""Data source abstraction for live and backtest modes"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Tuple
import asyncio
import logging

from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)


class DataSource(ABC):
    """
    数据源抽象接口
    
    统一实盘和回测的数据获取方式
    """
    
    @abstractmethod
    async def get_data_stream(
        self,
        symbols: List[str],
        timeframe: str
    ) -> AsyncGenerator[Tuple[str, dict], None]:
        """
        获取数据流（K线和指标）
        
        Yields:
            (topic, data) tuples
            topic格式: "kline:{symbol}:{timeframe}" 或 "indicator:{symbol}:{timeframe}"
        """
        pass
    
    @abstractmethod
    async def close(self):
        """关闭数据源"""
        pass


class LiveDataSource(DataSource):
    """
    实盘数据源
    
    基于MessageBus订阅实时K线和指标数据
    """
    
    def __init__(self, message_bus):
        """
        Args:
            message_bus: MessageBus实例
        """
        self.bus = message_bus
        self.data_queue = asyncio.Queue()
        self.tasks = []
        logger.info("LiveDataSource initialized")
    
    async def get_data_stream(
        self,
        symbols: List[str],
        timeframe: str
    ) -> AsyncGenerator[Tuple[str, dict], None]:
        """
        订阅实时数据流
        
        注意：实盘模式永不结束，持续推送数据
        """
        # 订阅所有K线和指标主题
        for symbol in symbols:
            kline_topic = f"kline:{symbol}:{timeframe}"
            indicator_topic = f"indicator:{symbol}:{timeframe}"
            
            # 创建订阅处理器
            await self.bus.subscribe(kline_topic, self._data_handler)
            await self.bus.subscribe(indicator_topic, self._data_handler)
            
            logger.info(f"Subscribed to {kline_topic} and {indicator_topic}")
        
        # 持续从队列中获取数据
        while True:
            try:
                topic, data = await self.data_queue.get()
                yield (topic, data)
            except Exception as e:
                logger.error(f"Error in live data stream: {e}")
                break
    
    async def _data_handler(self, topic: str, data: dict):
        """将接收到的数据放入队列"""
        await self.data_queue.put((topic, data))
    
    async def close(self):
        """关闭实盘数据源"""
        logger.info("LiveDataSource closed")


class BacktestDataSource(DataSource):
    """
    回测数据源
    
    从数据库预加载历史数据，按时间顺序推送
    """
    
    def __init__(
        self,
        db,
        start_time: int,
        end_time: int,
        market_type: str = 'spot'
    ):
        """
        Args:
            db: Database实例
            start_time: 回测开始时间（Unix时间戳）
            end_time: 回测结束时间（Unix时间戳）
            market_type: 市场类型（spot/future/delivery）
        """
        self.db = db
        self.start_time = start_time
        self.end_time = end_time
        self.market_type = market_type
        self.kline_data = {}
        self.indicator_data = {}
        
        logger.info(
            f"BacktestDataSource initialized: "
            f"start={start_time}, end={end_time}, market={market_type}"
        )
    
    async def preload_data(self, symbols: List[str], timeframe: str):
        """
        预加载数据（性能优化）
        
        Args:
            symbols: 交易对列表
            timeframe: 时间周期
        """
        logger.info(f"Preloading data for {symbols} @ {timeframe}...")
        
        for symbol in symbols:
            # 加载K线数据
            klines = await self._load_klines(symbol, timeframe)
            self.kline_data[symbol] = klines
            
            # 加载指标数据
            indicators = await self._load_indicators(symbol, timeframe)
            self.indicator_data[symbol] = indicators
            
            logger.info(
                f"Loaded {len(klines)} klines, {len(indicators)} indicators for {symbol}"
            )
        
        logger.info(f"Data preload complete for {len(symbols)} symbols")
    
    async def _load_klines(self, symbol: str, timeframe: str) -> List[dict]:
        """加载K线数据"""
        klines = await self.db.get_recent_klines(
            symbol=symbol,
            timeframe=timeframe,
            limit=100000,  # 足够大的限制
            market_type=self.market_type
        )
        
        # 过滤时间范围
        filtered = [
            k for k in klines
            if self.start_time <= k.timestamp <= self.end_time
        ]
        
        # 转换为字典
        return [k.model_dump() for k in filtered]
    
    async def _load_indicators(self, symbol: str, timeframe: str) -> List[dict]:
        """加载指标数据"""
        indicators = await self.db.get_recent_indicators(
            symbol=symbol,
            timeframe=timeframe,
            limit=100000,
            market_type=self.market_type
        )
        
        # 过滤时间范围
        filtered = [
            i for i in indicators
            if self.start_time <= i.timestamp <= self.end_time
        ]
        
        # 转换为字典
        return [i.model_dump() for i in filtered]
    
    async def get_data_stream(
        self,
        symbols: List[str],
        timeframe: str
    ) -> AsyncGenerator[Tuple[str, dict], None]:
        """
        按时间顺序推送历史数据
        
        将K线和指标数据合并，按时间戳升序推送
        """
        # 预加载数据
        await self.preload_data(symbols, timeframe)
        
        # 合并所有数据并按时间排序
        all_data = []
        
        for symbol in symbols:
            # 添加K线数据
            for kline in self.kline_data.get(symbol, []):
                topic = f"kline:{symbol}:{timeframe}"
                all_data.append((kline['timestamp'], topic, kline))
            
            # 添加指标数据
            for indicator in self.indicator_data.get(symbol, []):
                topic = f"indicator:{symbol}:{timeframe}"
                all_data.append((indicator['timestamp'], topic, indicator))
        
        # 按时间戳排序
        all_data.sort(key=lambda x: x[0])
        
        logger.info(f"Starting backtest stream with {len(all_data)} data points")
        
        # 按顺序推送数据
        for timestamp, topic, data in all_data:
            yield (topic, data)
        
        logger.info("Backtest stream complete")
    
    async def close(self):
        """关闭回测数据源"""
        self.kline_data.clear()
        self.indicator_data.clear()
        logger.info("BacktestDataSource closed")


class DataSourceFactory:
    """数据源工厂类"""
    
    @staticmethod
    def create_live(message_bus) -> LiveDataSource:
        """创建实盘数据源"""
        return LiveDataSource(message_bus)
    
    @staticmethod
    def create_backtest(
        db,
        start_time: int,
        end_time: int,
        market_type: str = 'spot'
    ) -> BacktestDataSource:
        """创建回测数据源"""
        return BacktestDataSource(db, start_time, end_time, market_type)

