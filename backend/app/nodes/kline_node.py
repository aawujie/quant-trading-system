"""K-line data fetching node"""

import asyncio
import logging
from typing import List

from app.core.node_base import ProducerNode
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.exchanges.base import ExchangeBase
from app.models.market_data import KlineData

logger = logging.getLogger(__name__)


class KlineNode(ProducerNode):
    """
    K-line data producer node
    
    Responsibilities:
    - Fetch K-line data from exchange
    - Save to database (incremental, avoiding duplicates)
    - Publish to message bus
    
    Features:
    - Supports multiple symbols
    - Supports multiple timeframes
    - Incremental fetching (only new data)
    - Automatic retry on errors
    """
    
    def __init__(
        self,
        bus: MessageBus,
        exchange: ExchangeBase,
        db: Database,
        symbols: List[str],
        timeframes: List[str],
        fetch_interval: int = 60
    ):
        """
        Initialize K-line node
        
        Args:
            bus: MessageBus instance
            exchange: Exchange instance (e.g., BinanceExchange)
            db: Database instance
            symbols: List of symbols to track (e.g., ['BTCUSDT', 'ETHUSDT'])
            timeframes: List of timeframes (e.g., ['1h', '1d'])
            fetch_interval: Fetch interval in seconds (default: 60)
        """
        super().__init__("kline_node", bus)
        
        self.exchange = exchange
        self.db = db
        self.symbols = symbols
        self.timeframes = timeframes
        self.fetch_interval = fetch_interval
        
        # Define output topics
        self.output_topics = [
            f"kline:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        logger.info(
            f"KlineNode initialized: {len(symbols)} symbols, "
            f"{len(timeframes)} timeframes, "
            f"fetch_interval={fetch_interval}s"
        )
    
    async def produce(self) -> None:
        """
        Main production loop
        
        Fetches K-line data periodically and publishes to message bus
        """
        logger.info(f"KlineNode '{self.name}' starting production loop")
        
        while self.is_running:
            try:
                # Fetch all symbol/timeframe combinations
                tasks = []
                for symbol in self.symbols:
                    for timeframe in self.timeframes:
                        task = self._fetch_and_publish(symbol, timeframe)
                        tasks.append(task)
                
                # Execute all fetches concurrently
                await asyncio.gather(*tasks, return_exceptions=True)
                
                # Wait before next iteration
                await asyncio.sleep(self.fetch_interval)
                
            except Exception as e:
                logger.error(f"Error in KlineNode production loop: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _fetch_and_publish(self, symbol: str, timeframe: str) -> None:
        """
        Fetch K-line data for a specific symbol/timeframe and publish
        
        Args:
            symbol: Trading symbol (e.g., 'BTCUSDT')
            timeframe: Timeframe (e.g., '1h')
        """
        try:
            # 1. Get last timestamp from database (for incremental fetch)
            last_ts = await self.db.get_last_kline_time(symbol, timeframe)
            kline_count = await self.db.count_klines(symbol, timeframe)
            
            if last_ts:
                logger.debug(
                    f"Last K-line for {symbol} {timeframe}: "
                    f"timestamp={last_ts}, count={kline_count}"
                )
            else:
                logger.info(
                    f"No existing K-line data for {symbol} {timeframe}, "
                    f"fetching initial dataset"
                )
            
            # 2. Fetch new K-lines from exchange
            # Convert symbol format: BTCUSDT -> BTC/USDT for ccxt
            exchange_symbol = self._format_symbol_for_exchange(symbol)
            
            # 根据数据量决定获取策略
            if kline_count < 500:  # 数据少于500条，需要批量补充历史数据
                import time
                # 获取时间周期的秒数
                timeframe_seconds = {
                    '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
                    '1h': 3600, '4h': 14400, '1d': 86400
                }
                seconds = timeframe_seconds.get(timeframe, 3600)
                
                # 目标：获取到7天前的数据
                target_ts = int(time.time() - 7 * 24 * 3600)
                
                # 确定起始时间
                if last_ts:
                    # 有数据，从最早的时间戳往前推
                    earliest_ts = await self.db.get_earliest_kline_time(symbol, timeframe)
                    since_ts = int(earliest_ts - seconds * 100)  # 往前推100个周期
                else:
                    # 没有数据，从7天前开始
                    since_ts = target_ts
                    earliest_ts = int(time.time())
                
                logger.info(f"数据不足（{kline_count}条），{symbol} {timeframe} 批量拉取到7天前")
                
                # 批量获取，直到覆盖到7天前
                # 策略：从7天前开始，每次拉1000条，逐步往现在推进
                all_klines = []
                current_since = target_ts
                
                for i in range(10):  # 最多10批，每批1000条
                    batch_klines = await self.exchange.fetch_klines(
                        symbol=exchange_symbol,
                        timeframe=timeframe,
                        since=current_since,
                        limit=1000
                    )
                    
                    if not batch_klines:
                        logger.info(f"批次{i+1}无数据，停止 {symbol} {timeframe}")
                        break
                    
                    all_klines.extend(batch_klines)
                    
                    # 更新since为本批次最后一个K线的时间+1个周期
                    last_ts_in_batch = max(k.timestamp for k in batch_klines)
                    current_since = int(last_ts_in_batch + seconds)
                    
                    # 如果已经拉到最新数据了（距离现在不到2个周期），停止
                    import time
                    if last_ts_in_batch >= time.time() - seconds * 2:
                        logger.info(f"已拉取到最新，停止批量获取 {symbol} {timeframe}")
                        break
                    
                    logger.info(f"批次{i+1}获取了{len(batch_klines)}条 {symbol} {timeframe}")
                
                klines = all_klines
                if klines:
                    logger.info(f"批量获取了 {len(klines)} 条历史数据 for {symbol} {timeframe}")
                else:
                    logger.debug(f"No historical K-lines for {symbol} {timeframe}")
                    return
            else:
                # 数据充足，正常增量更新
                klines = await self.exchange.fetch_klines(
                    symbol=exchange_symbol,
                    timeframe=timeframe,
                    since=None,
                    limit=100
                )
                
                if not klines:
                    logger.debug(f"No new K-lines for {symbol} {timeframe}")
                    return
            
            logger.info(
                f"Fetched {len(klines)} K-lines for {symbol} {timeframe}"
            )
            
            # 3. 过滤出新数据（比数据库中最新的更新或相等，以支持更新当前未完成的K线）
            # 注意：批量拉取模式下不过滤，直接使用全部数据，依赖数据库UPSERT处理重复
            logger.info(f"📊 kline_count={kline_count}, len(klines)={len(klines)}, last_ts={last_ts}")
            new_klines = []
            if kline_count < 500:
                # 批量拉取模式：不过滤，全部插入，依赖数据库UPSERT
                new_klines = klines
                logger.info(f"✅ 批量模式：{len(new_klines)} 条数据待插入 for {symbol} {timeframe}")
            elif last_ts:
                # 增量更新模式：过滤新数据
                # 使用 >= 而不是 > 来允许更新当前正在形成的K线
                new_klines = [k for k in klines if k.timestamp >= last_ts]
                logger.info(f"🔄 增量模式：过滤后 {len(new_klines)} 条 for {symbol} {timeframe}")
                if not new_klines:
                    logger.debug(f"No newer K-lines for {symbol} {timeframe} (last: {last_ts})")
                    return
            else:
                new_klines = klines
                logger.info(f"🆕 初始模式：{len(new_klines)} 条 for {symbol} {timeframe}")
            
            logger.info(
                f"Fetched {len(klines)} K-lines, {len(new_klines)} are new for {symbol} {timeframe}"
            )
            
            # 4. Save to database (bulk insert, skip duplicates)
            inserted = await self.db.bulk_insert_klines(new_klines)
            
            if inserted > 0:
                logger.info(
                    f"Inserted {inserted} new K-lines for {symbol} {timeframe}"
                )
            
            # 5. Publish to message bus (only new K-lines)
            topic = f"kline:{symbol}:{timeframe}"
            
            for kline in new_klines:
                await self.emit(topic, kline.model_dump())
            
            if new_klines:
                logger.debug(
                    f"Published {len(new_klines)} K-lines to topic '{topic}'"
                )
            
        except Exception as e:
            logger.error(
                f"Failed to fetch/publish K-lines for {symbol} {timeframe}: {e}"
            )
    
    def _format_symbol_for_exchange(self, symbol: str) -> str:
        """
        Format symbol for exchange API
        
        Args:
            symbol: Internal format (e.g., 'BTCUSDT')
            
        Returns:
            Exchange format (e.g., 'BTC/USDT')
        """
        # Most common case: XXX/USDT
        if symbol.endswith('USDT'):
            base = symbol[:-4]
            return f"{base}/USDT"
        elif symbol.endswith('USD'):
            base = symbol[:-3]
            return f"{base}/USD"
        elif symbol.endswith('BTC'):
            base = symbol[:-3]
            return f"{base}/BTC"
        elif symbol.endswith('ETH'):
            base = symbol[:-3]
            return f"{base}/ETH"
        else:
            # Default: assume format is correct
            return symbol
    
    async def start(self) -> None:
        """Start the K-line node"""
        await super().start()
        
        # Start production loop as a background task
        task = asyncio.create_task(self.produce())
        self._tasks.append(task)
        
        logger.info(f"KlineNode '{self.name}' started with production loop")
    
    def __repr__(self) -> str:
        return (
            f"<KlineNode "
            f"symbols={len(self.symbols)} "
            f"timeframes={len(self.timeframes)} "
            f"interval={self.fetch_interval}s "
            f"running={self.is_running}>"
        )

