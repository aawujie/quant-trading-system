"""数据管理服务 - 历史数据下载和任务管理"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

from app.core.database import Database
from app.exchanges.base import ExchangeBase
from app.models.market_data import KlineData

logger = logging.getLogger(__name__)


class DataDownloadTask:
    """数据下载任务"""
    
    def __init__(
        self,
        task_id: str,
        symbol: str,
        timeframe: str,
        start_time: int,
        end_time: int,
        market_type: str = "future"
    ):
        self.task_id = task_id
        self.symbol = symbol
        self.timeframe = timeframe
        self.start_time = start_time
        self.end_time = end_time
        self.market_type = market_type
        
        self.status = "pending"  # pending, downloading, completed, failed, cancelled
        self.progress = 0  # 0-100
        self.downloaded_count = 0
        self.total_count = 0
        self.error_message = None
        self.created_at = int(time.time())
        self.updated_at = int(time.time())
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "task_id": self.task_id,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "market_type": self.market_type,
            "status": self.status,
            "progress": self.progress,
            "downloaded_count": self.downloaded_count,
            "total_count": self.total_count,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DataManager:
    """数据管理器 - 负责历史数据下载和管理"""
    
    def __init__(self, db: Database, exchange: ExchangeBase):
        self.db = db
        self.exchange = exchange
        self.tasks: Dict[str, DataDownloadTask] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        
        logger.info("DataManager initialized")
    
    def create_download_task(
        self,
        symbol: str,
        timeframe: str,
        start_time: int,
        end_time: int,
        market_type: str = "future"
    ) -> str:
        """
        创建历史数据下载任务
        
        Args:
            symbol: 交易对（如 BTCUSDT）
            timeframe: 时间周期（如 1h）
            start_time: 开始时间戳（秒）
            end_time: 结束时间戳（秒）
            market_type: 市场类型
            
        Returns:
            task_id: 任务ID
        """
        task_id = str(uuid4())
        task = DataDownloadTask(
            task_id=task_id,
            symbol=symbol,
            timeframe=timeframe,
            start_time=start_time,
            end_time=end_time,
            market_type=market_type
        )
        
        self.tasks[task_id] = task
        logger.info(f"Created download task {task_id} for {symbol} {timeframe}")
        
        return task_id
    
    async def start_download_task(self, task_id: str):
        """启动下载任务"""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.tasks[task_id]
        
        if task.status == "downloading":
            raise ValueError(f"Task {task_id} is already downloading")
        
        # 创建后台任务
        asyncio_task = asyncio.create_task(self._download_worker(task_id))
        self.running_tasks[task_id] = asyncio_task
        
        logger.info(f"Started download task {task_id}")
    
    async def _download_worker(self, task_id: str):
        """下载任务工作线程"""
        task = self.tasks[task_id]
        
        try:
            task.status = "downloading"
            task.updated_at = int(time.time())
            
            # 计算时间范围
            interval_seconds = self._timeframe_to_seconds(task.timeframe)
            total_intervals = (task.end_time - task.start_time) // interval_seconds
            task.total_count = total_intervals
            
            logger.info(
                f"Downloading {task.symbol} {task.timeframe} "
                f"from {task.start_time} to {task.end_time} "
                f"(~{total_intervals} bars)"
            )
            
            # 分批下载（每次最多1000条）
            current_time = task.start_time
            batch_size = 1000
            
            while current_time < task.end_time:
                # 格式化交易对名称（BTCUSDT -> BTC/USDT）
                exchange_symbol = self._format_symbol_for_exchange(task.symbol)
                
                # 从交易所获取数据
                klines = await self.exchange.fetch_klines(
                    symbol=exchange_symbol,
                    timeframe=task.timeframe,
                    since=current_time,
                    limit=batch_size
                )
                
                if not klines:
                    logger.warning(f"No more data available for {task.symbol}")
                    break
                
                # 过滤掉超出范围的数据
                klines = [k for k in klines if k.timestamp <= task.end_time]
                
                if klines:
                    # 保存到数据库
                    await self.db.bulk_insert_klines(klines)
                    
                    # 更新进度
                    task.downloaded_count += len(klines)
                    task.progress = min(100, int(task.downloaded_count / task.total_count * 100))
                    task.updated_at = int(time.time())
                    
                    logger.info(
                        f"Task {task_id}: Downloaded {len(klines)} klines, "
                        f"progress: {task.progress}%"
                    )
                    
                    # 更新当前时间
                    current_time = klines[-1].timestamp + interval_seconds
                else:
                    break
                
                # 避免请求过快
                await asyncio.sleep(0.5)
            
            # 完成
            task.status = "completed"
            task.progress = 100
            task.updated_at = int(time.time())
            
            logger.info(f"Task {task_id} completed: {task.downloaded_count} klines downloaded")
            
        except asyncio.CancelledError:
            task.status = "cancelled"
            task.updated_at = int(time.time())
            logger.info(f"Task {task_id} cancelled")
            
        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.updated_at = int(time.time())
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)
        
        finally:
            # 清理运行中的任务引用
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]
    
    def get_task_status(self, task_id: str) -> Optional[dict]:
        """获取任务状态"""
        if task_id not in self.tasks:
            return None
        
        return self.tasks[task_id].to_dict()
    
    def get_all_tasks(self) -> List[dict]:
        """获取所有任务"""
        return [task.to_dict() for task in self.tasks.values()]
    
    async def cancel_task(self, task_id: str):
        """取消任务"""
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        # 取消asyncio任务
        if task_id in self.running_tasks:
            self.running_tasks[task_id].cancel()
            logger.info(f"Cancelled task {task_id}")
    
    async def get_data_stats(self) -> dict:
        """
        获取数据统计信息
        
        Returns:
            按市场类型和symbol分组的详细统计信息
        """
        try:
            from sqlalchemy import text
            
            market_types = ['spot', 'future']
            timeframes = ['3m', '5m', '15m', '30m', '1h', '4h', '1d']
            
            total_klines = 0
            total_indicators = 0
            all_symbols = set()
            all_timeframes = set()
            by_market = {}
            
            async with self.db.SessionLocal() as session:
                for market_type in market_types:
                    by_market[market_type] = {}
                    
                    # 获取该市场的所有symbol
                    symbols_result = await session.execute(
                        text("""
                            SELECT DISTINCT symbol 
                            FROM klines 
                            WHERE market_type = :market_type
                            ORDER BY symbol
                        """),
                        {"market_type": market_type}
                    )
                    symbols = [row[0] for row in symbols_result.fetchall()]
                    all_symbols.update(symbols)
                    
                    for symbol in symbols:
                        symbol_data = {
                            "timeframes": {},
                            "total_klines": 0,
                            "total_indicators": 0
                        }
                        
                        for timeframe in timeframes:
                            # 获取K线统计
                            kline_result = await session.execute(
                                text("""
                                    SELECT 
                                        COUNT(*) as count,
                                        MIN(timestamp) as earliest,
                                        MAX(timestamp) as latest
                                    FROM klines
                                    WHERE symbol = :symbol 
                                      AND timeframe = :timeframe 
                                      AND market_type = :market_type
                                """),
                                {
                                    "symbol": symbol,
                                    "timeframe": timeframe,
                                    "market_type": market_type
                                }
                            )
                            kline_row = kline_result.fetchone()
                            
                            # 获取指标统计（细分到每个指标字段）
                            indicator_result = await session.execute(
                                text("""
                                    SELECT 
                                        COUNT(ma5) as ma5,
                                        COUNT(ma10) as ma10,
                                        COUNT(ma20) as ma20,
                                        COUNT(ma60) as ma60,
                                        COUNT(ma120) as ma120,
                                        COUNT(ema12) as ema12,
                                        COUNT(ema26) as ema26,
                                        COUNT(rsi14) as rsi14,
                                        COUNT(macd_line) as macd_line,
                                        COUNT(bb_upper) as bb_upper,
                                        COUNT(atr14) as atr14,
                                        COUNT(volume_ma5) as volume_ma5
                                    FROM indicators
                                    WHERE symbol = :symbol 
                                      AND timeframe = :timeframe 
                                      AND market_type = :market_type
                                """),
                                {
                                    "symbol": symbol,
                                    "timeframe": timeframe,
                                    "market_type": market_type
                                }
                            )
                            indicator_row = indicator_result.fetchone()
                            
                            timeframe_data = {}
                            
                            if kline_row and kline_row[0] > 0:
                                from datetime import datetime
                                timeframe_data["klines"] = {
                                    "count": kline_row[0],
                                    "earliest": kline_row[1],
                                    "latest": kline_row[2],
                                    "earliest_time": datetime.fromtimestamp(kline_row[1]).strftime('%Y-%m-%d %H:%M') if kline_row[1] else None,
                                    "latest_time": datetime.fromtimestamp(kline_row[2]).strftime('%Y-%m-%d %H:%M') if kline_row[2] else None
                                }
                                symbol_data["total_klines"] += kline_row[0]
                                total_klines += kline_row[0]
                                all_timeframes.add(timeframe)
                            
                            if indicator_row:
                                # 构建指标字段映射
                                indicator_fields = {
                                    'ma5': indicator_row[0],
                                    'ma10': indicator_row[1],
                                    'ma20': indicator_row[2],
                                    'ma60': indicator_row[3],
                                    'ma120': indicator_row[4],
                                    'ema12': indicator_row[5],
                                    'ema26': indicator_row[6],
                                    'rsi14': indicator_row[7],
                                    'macd_line': indicator_row[8],
                                    'bb_upper': indicator_row[9],
                                    'atr14': indicator_row[10],
                                    'volume_ma5': indicator_row[11],
                                }
                                # 过滤掉为0的指标
                                indicator_fields = {k: v for k, v in indicator_fields.items() if v > 0}
                                
                                if indicator_fields:
                                    timeframe_data["indicators"] = indicator_fields
                                    total_count = sum(indicator_fields.values())
                                    symbol_data["total_indicators"] += total_count
                                    total_indicators += total_count
                            
                            if timeframe_data:
                                symbol_data["timeframes"][timeframe] = timeframe_data
                        
                        # 只添加有数据的symbol
                        if symbol_data["timeframes"]:
                            by_market[market_type][symbol] = symbol_data
            
            return {
                "total_klines": total_klines,
                "total_indicators": total_indicators,
                "symbols": sorted(list(all_symbols)),
                "timeframes": sorted(list(all_timeframes)),
                "market_types": [mt for mt in market_types if by_market[mt]],
                "by_market": by_market
            }
            
        except Exception as e:
            logger.error(f"Failed to get data stats: {e}", exc_info=True)
            return {
                "total_klines": 0,
                "total_indicators": 0,
                "symbols": [],
                "timeframes": [],
                "market_types": [],
                "by_market": {"spot": {}, "future": {}}
            }
    
    def _timeframe_to_seconds(self, timeframe: str) -> int:
        """将时间周期转换为秒数"""
        timeframe_map = {
            '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
            '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
            '1d': 86400, '3d': 259200, '1w': 604800
        }
        return timeframe_map.get(timeframe, 3600)
    
    def _format_symbol_for_exchange(self, symbol: str) -> str:
        """格式化交易对名称（BTCUSDT -> BTC/USDT）"""
        if symbol.endswith('USDT'):
            return f"{symbol[:-4]}/USDT"
        elif symbol.endswith('USD'):
            return f"{symbol[:-3]}/USD"
        elif symbol.endswith('BTC'):
            return f"{symbol[:-3]}/BTC"
        return symbol

