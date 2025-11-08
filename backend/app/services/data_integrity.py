"""
数据完整性服务
用于检测和修复K线和指标数据的缺失
"""

import asyncio
from datetime import datetime
from typing import List, Tuple, Optional
import logging

from app.models.market_data import KlineData

logger = logging.getLogger(__name__)


class DataIntegrityService:
    """数据完整性服务"""
    
    def __init__(self, db, exchange):
        """
        初始化服务
        
        Args:
            db: Database实例
            exchange: Exchange实例
        """
        self.db = db
        self.exchange = exchange
        
    async def check_and_repair_all(
        self, 
        symbols: List[str],
        timeframes: List[str],
        days_back: float = 30,
        auto_fix: bool = True,
        market_type: str = 'future',
        repair_kline: bool = True,
        repair_indicator: bool = True
    ):
        """
        检查并修复所有数据缺失
        
        Args:
            symbols: 交易对列表
            timeframes: 时间周期列表
            days_back: 检查最近N天的数据（支持小数，如0.042 = 1小时）
            auto_fix: 是否自动修复
            market_type: 市场类型
            repair_kline: 是否修复K线数据
            repair_indicator: 是否修复指标数据
        """
        logger.info("=" * 60)
        logger.info("🔍 Starting Data Integrity Check")
        logger.info("=" * 60)
        logger.info(f"Symbols: {symbols}")
        logger.info(f"Timeframes: {timeframes}")
        
        # 显示时间范围（区分小时和天）
        if days_back < 1:
            hours_back = days_back * 24
            logger.info(f"Look back: {hours_back:.1f} hour(s)")
        else:
            logger.info(f"Look back: {days_back:.1f} day(s)")
        
        logger.info(f"Market type: {market_type}")
        logger.info(f"Auto fix: {auto_fix}")
        logger.info(f"Repair K-line: {repair_kline}")
        logger.info(f"Repair Indicator: {repair_indicator}")
        logger.info("")
        
        total_kline_gaps = 0
        total_indicator_gaps = 0
        total_klines_filled = 0
        total_indicators_filled = 0
        
        for symbol in symbols:
            for timeframe in timeframes:
                logger.info(f"📊 Checking {symbol} {timeframe}...")
                
                kline_gaps = []
                indicator_gaps = []
                
                # 1. 检测K线缺失（如果需要）
                if repair_kline:
                    kline_gaps = await self.detect_kline_gaps(
                        symbol, timeframe, days_back, market_type
                    )
                    total_kline_gaps += len(kline_gaps)
                    
                    if kline_gaps:
                        logger.warning(f"   ⚠️  Found {len(kline_gaps)} K-line gap(s)")
                        
                        if auto_fix:
                            filled = await self.backfill_klines(
                                symbol, timeframe, kline_gaps, market_type
                            )
                            total_klines_filled += filled
                
                # 2. 检测指标缺失（如果需要）
                if repair_indicator:
                    indicator_gaps = await self.detect_indicator_gaps(
                        symbol, timeframe, days_back
                    )
                    total_indicator_gaps += len(indicator_gaps)
                    
                    if indicator_gaps:
                        logger.warning(
                            f"   ⚠️  Found {len(indicator_gaps)} indicator gap(s)"
                        )
                        
                        if auto_fix:
                            filled = await self.backfill_indicators(
                                symbol, timeframe, indicator_gaps
                            )
                            total_indicators_filled += filled
                
                if (not repair_kline or not kline_gaps) and (not repair_indicator or not indicator_gaps):
                    logger.info(f"   ✅ Data is complete")
                
                logger.info("")
        
        # 总结报告
        logger.info("=" * 60)
        logger.info("📈 Data Integrity Check Complete")
        logger.info("=" * 60)
        
        if repair_kline:
            logger.info(f"K-line gaps found: {total_kline_gaps}")
            if auto_fix:
                logger.info(f"K-lines filled: {total_klines_filled}")
        
        if repair_indicator:
            logger.info(f"Indicator gaps found: {total_indicator_gaps}")
            if auto_fix:
                logger.info(f"Indicators filled: {total_indicators_filled}")
        
        if auto_fix and (repair_kline or repair_indicator):
            logger.info(f"Status: ✅ All gaps have been repaired")
        else:
            logger.info(f"Status: ⚠️  Gaps detected")
        
        logger.info("=" * 60)
        logger.info("")
    
    async def detect_kline_gaps(
        self,
        symbol: str,
        timeframe: str,
        days_back: float,
        market_type: str = 'future'
    ) -> List[Tuple[int, int]]:
        """
        检测K线数据缺失
        
        Returns:
            List of (start_timestamp, end_timestamp) tuples
        """
        # 计算时间范围
        interval_seconds = self._get_interval_seconds(timeframe)
        end_time = int(datetime.now().timestamp())
        start_time = end_time - int(days_back * 86400)
        
        # 从数据库获取现有K线
        existing_klines = await self.db.get_recent_klines(
            symbol, timeframe, 
            limit=100000,  # 大数量，确保获取所有
            market_type=market_type
        )
        
        if not existing_klines:
            # 完全没有数据，返回整个时间段
            logger.debug(f"   No existing K-lines found, need full backfill")
            return [(start_time, end_time)]
        
        # 转换为时间戳集合
        existing_timestamps = {k.timestamp for k in existing_klines}
        
        # 生成期望的时间戳序列
        expected_timestamps = []
        current = start_time
        # 对齐到interval边界
        current = (current // interval_seconds) * interval_seconds
        
        while current <= end_time:
            expected_timestamps.append(current)
            current += interval_seconds
        
        # 找出缺失的时间戳
        missing_timestamps = [
            ts for ts in expected_timestamps 
            if ts not in existing_timestamps
        ]
        
        if not missing_timestamps:
            return []
        
        # 将连续的缺失时间戳合并为区间
        gaps = self._merge_to_ranges(missing_timestamps, interval_seconds)
        
        logger.debug(f"   Missing timestamps: {len(missing_timestamps)}")
        logger.debug(f"   Merged into {len(gaps)} gap(s)")
        
        return gaps
    
    async def detect_indicator_gaps(
        self,
        symbol: str,
        timeframe: str,
        days_back: float
    ) -> List[int]:
        """
        检测指标数据缺失
        
        Returns:
            List of missing timestamps
        """
        # 计算时间范围
        cutoff = int(datetime.now().timestamp()) - int(days_back * 86400)
        
        # 获取K线时间戳（基准）
        klines = await self.db.get_recent_klines(
            symbol, timeframe, limit=100000
        )
        
        # 只考虑在时间范围内的K线
        kline_timestamps = {
            k.timestamp for k in klines 
            if k.timestamp >= cutoff
        }
        
        if not kline_timestamps:
            logger.debug(f"   No K-lines in range, skipping indicator check")
            return []
        
        # 获取指标时间戳
        indicators = await self.db.get_recent_indicators(
            symbol, timeframe, limit=100000
        )
        indicator_timestamps = {i.timestamp for i in indicators}
        
        # 找出有K线但没有指标的时间戳
        missing = sorted(kline_timestamps - indicator_timestamps)
        
        logger.debug(f"   K-lines in range: {len(kline_timestamps)}")
        logger.debug(f"   Indicators in range: {len(indicator_timestamps & kline_timestamps)}")
        logger.debug(f"   Missing indicators: {len(missing)}")
        
        return missing
    
    async def backfill_klines(
        self,
        symbol: str,
        timeframe: str,
        gaps: List[Tuple[int, int]],
        market_type: str = 'future'
    ) -> int:
        """
        回补K线数据
        
        Returns:
            Number of K-lines filled
        """
        logger.info(f"   🔧 Backfilling K-lines...")
        
        total_filled = 0
        
        for start_ts, end_ts in gaps:
            try:
                # 从交易所获取历史数据
                klines = await self.exchange.fetch_historical_klines(
                    symbol=symbol,
                    interval=timeframe,
                    start_time=start_ts * 1000,  # 毫秒
                    end_time=end_ts * 1000,
                    limit=1500,  # Binance限制
                    market_type=market_type
                )
                
                if not klines:
                    logger.debug(f"   No K-lines returned for {start_ts}-{end_ts}")
                    continue
                
                # 批量保存到数据库（使用 upsert，自动处理重复数据）
                kline_objects = [
                    KlineData(
                        symbol=kline_data['symbol'],
                        timeframe=kline_data['timeframe'],
                        timestamp=kline_data['timestamp'],
                        open=kline_data['open'],
                        high=kline_data['high'],
                        low=kline_data['low'],
                        close=kline_data['close'],
                        volume=kline_data['volume'],
                        market_type=market_type
                    )
                    for kline_data in klines
                ]
                
                # 使用 bulk_insert_klines，它会自动处理重复数据（on_conflict_do_update）
                affected = await self.db.bulk_insert_klines(kline_objects)
                total_filled += affected
                
                logger.debug(f"   Filled {affected} K-lines for gap {start_ts}-{end_ts}")
                
                # 避免API限流
                await asyncio.sleep(0.2)
                
            except Exception as e:
                logger.error(
                    f"   ❌ Failed to backfill K-lines "
                    f"{start_ts}-{end_ts}: {e}"
                )
        
        logger.info(f"   ✅ Backfilled {total_filled} K-lines")
        return total_filled
    
    async def backfill_indicators(
        self,
        symbol: str,
        timeframe: str,
        missing_timestamps: List[int]
    ) -> int:
        """
        回补指标数据
        
        Returns:
            Number of indicators filled
        """
        logger.info(f"   🔧 Backfilling indicators...")
        
        # 动态导入避免循环依赖
        from app.nodes.indicator_node import IndicatorNode
        
        # 创建临时的指标计算节点（自动从元数据计算需要的K线数量）
        indicator_node = IndicatorNode(
            bus=None,  # 不需要消息总线
            db=self.db,
            symbols=[symbol],
            timeframes=[timeframe]
        )
        
        filled = 0
        skipped = 0
        
        for timestamp in missing_timestamps:
            try:
                # 获取该时间点及之前的K线（用于计算）
                klines_before = await self.db.get_klines_before(
                    symbol, timeframe, timestamp, limit=201
                )
                
                # 需要至少120根K线才能计算MA120
                if len(klines_before) < 120:
                    logger.debug(
                        f"   ⚠️  Skip {timestamp}: "
                        f"insufficient K-lines ({len(klines_before)}/120)"
                    )
                    skipped += 1
                    continue
                
                # 计算指标
                indicator = await indicator_node._calculate_indicators(
                    symbol, timeframe, klines_before
                )
                
                if indicator:
                    # 保存到数据库
                    success = await self.db.insert_indicator(indicator)
                    if success:
                        filled += 1
                else:
                    logger.debug(f"   ⚠️  Indicator calculation returned None for {timestamp}")
                    skipped += 1
                
            except Exception as e:
                logger.error(
                    f"   ❌ Failed to backfill indicator {timestamp}: {e}"
                )
                skipped += 1
        
        logger.info(f"   ✅ Backfilled {filled} indicators")
        if skipped > 0:
            logger.info(f"   ⚠️  Skipped {skipped} indicators (insufficient data)")
        
        return filled
    
    def _get_interval_seconds(self, timeframe: str) -> int:
        """获取时间周期的秒数"""
        intervals = {
            '1m': 60,
            '3m': 180,
            '5m': 300,
            '15m': 900,
            '30m': 1800,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400
        }
        return intervals.get(timeframe, 3600)
    
    def _merge_to_ranges(
        self,
        timestamps: List[int],
        interval: int
    ) -> List[Tuple[int, int]]:
        """
        将连续的时间戳合并为区间
        
        Args:
            timestamps: 时间戳列表
            interval: 时间间隔（秒）
            
        Returns:
            List of (start, end) tuples
        """
        if not timestamps:
            return []
        
        timestamps = sorted(timestamps)
        ranges = []
        start = timestamps[0]
        end = timestamps[0]
        
        for ts in timestamps[1:]:
            if ts <= end + interval * 1.5:  # 容忍小误差
                # 连续
                end = ts
            else:
                # 断开，保存当前区间
                ranges.append((start, end))
                start = ts
                end = ts
        
        # 保存最后一个区间
        ranges.append((start, end))
        
        return ranges

