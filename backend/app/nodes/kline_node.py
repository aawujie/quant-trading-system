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
            
            if last_ts:
                logger.debug(
                    f"Last K-line for {symbol} {timeframe}: "
                    f"timestamp={last_ts}"
                )
            else:
                logger.info(
                    f"No existing K-line data for {symbol} {timeframe}, "
                    f"fetching initial dataset"
                )
            
            # 2. Fetch new K-lines from exchange
            # Convert symbol format: BTCUSDT -> BTC/USDT for ccxt
            exchange_symbol = self._format_symbol_for_exchange(symbol)
            
            klines = await self.exchange.fetch_klines(
                symbol=exchange_symbol,
                timeframe=timeframe,
                since=last_ts,  # Only fetch data after last timestamp
                limit=1000
            )
            
            if not klines:
                logger.debug(f"No new K-lines for {symbol} {timeframe}")
                return
            
            logger.info(
                f"Fetched {len(klines)} K-lines for {symbol} {timeframe}"
            )
            
            # 3. Save to database (bulk insert, skip duplicates)
            inserted = await self.db.bulk_insert_klines(klines)
            
            if inserted > 0:
                logger.info(
                    f"Inserted {inserted} new K-lines for {symbol} {timeframe}"
                )
            
            # 4. Publish to message bus (only new K-lines)
            topic = f"kline:{symbol}:{timeframe}"
            
            for kline in klines:
                # Only publish K-lines that are newer than last_ts
                if not last_ts or kline.timestamp > last_ts:
                    await self.emit(topic, kline.model_dump())
            
            logger.debug(
                f"Published {len(klines)} K-lines to topic '{topic}'"
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

