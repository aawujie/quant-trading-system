"""Database layer using SQLAlchemy"""

import logging
from typing import List, Optional
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, Float, BigInteger, DateTime, Index, select, JSON
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.models.market_data import KlineData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData
from app.models.drawings import DrawingData, DrawingPoint, DrawingStyle

logger = logging.getLogger(__name__)

Base = declarative_base()


# SQLAlchemy ORM Models

class KlineDB(Base):
    """K-line data table"""
    __tablename__ = "klines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_klines_lookup', 'symbol', 'timeframe', 'timestamp', unique=True),
    )


class IndicatorDB(Base):
    """Technical indicators table"""
    __tablename__ = "indicators"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    ma5 = Column(Float)
    ma10 = Column(Float)
    ma20 = Column(Float)
    ma60 = Column(Float)
    ma120 = Column(Float)
    ema12 = Column(Float)
    ema26 = Column(Float)
    rsi14 = Column(Float)
    macd_line = Column(Float)
    macd_signal = Column(Float)
    macd_histogram = Column(Float)
    bb_upper = Column(Float)
    bb_middle = Column(Float)
    bb_lower = Column(Float)
    atr14 = Column(Float)
    volume_ma5 = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_indicators_lookup', 'symbol', 'timeframe', 'timestamp', unique=True),
    )


class SignalDB(Base):
    """Trading signals table"""
    __tablename__ = "signals"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_name = Column(String(50), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    signal_type = Column(String(10), nullable=False)
    price = Column(Float, nullable=False)
    reason = Column(String(500))
    confidence = Column(Float)
    stop_loss = Column(Float)
    take_profit = Column(Float)
    position_size = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_signals_lookup', 'strategy_name', 'symbol', 'timestamp'),
    )


class DrawingDB(Base):
    """绘图数据表"""
    __tablename__ = "drawings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    drawing_id = Column(String(50), nullable=False, unique=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, index=True)
    drawing_type = Column(String(20), nullable=False)
    points = Column(JSON, nullable=False)  # 存储为 JSON
    style = Column(JSON, nullable=False)   # 存储为 JSON
    label = Column(String(200))
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_drawings_lookup', 'symbol', 'timeframe'),
    )


class Database:
    """
    Async database manager
    
    Provides methods for CRUD operations on K-lines, indicators, and signals
    """
    
    def __init__(self, database_url: str):
        """
        Initialize database connection
        
        Args:
            database_url: SQLAlchemy database URL
        """
        self.database_url = database_url
        self.engine = create_async_engine(
            database_url,
            echo=False,
            poolclass=NullPool,  # Use NullPool for better concurrency
        )
        self.SessionLocal = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        logger.info(f"Database initialized: {database_url}")
    
    async def create_tables(self):
        """Create all tables (idempotent - safe to call multiple times)"""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all, checkfirst=True)
            logger.info("Database tables ready")
        except Exception as e:
            logger.warning(f"Table creation warning (tables may already exist): {e}")
            # Tables might already exist, which is fine
            pass
    
    async def close(self):
        """Close database connections"""
        await self.engine.dispose()
        logger.info("Database closed")
    
    # K-line operations
    
    async def insert_kline(self, kline: KlineData) -> bool:
        """Insert a single K-line"""
        async with self.SessionLocal() as session:
            try:
                db_kline = KlineDB(
                    symbol=kline.symbol,
                    timeframe=kline.timeframe,
                    timestamp=kline.timestamp,
                    open=kline.open,
                    high=kline.high,
                    low=kline.low,
                    close=kline.close,
                    volume=kline.volume
                )
                session.add(db_kline)
                await session.commit()
                return True
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to insert kline: {e}")
                return False
    
    async def bulk_insert_klines(self, klines: List[KlineData]) -> int:
        """Bulk insert K-lines (ignores duplicates)"""
        if not klines:
            return 0
        
        async with self.SessionLocal() as session:
            inserted = 0
            for kline in klines:
                try:
                    db_kline = KlineDB(
                        symbol=kline.symbol,
                        timeframe=kline.timeframe,
                        timestamp=kline.timestamp,
                        open=kline.open,
                        high=kline.high,
                        low=kline.low,
                        close=kline.close,
                        volume=kline.volume
                    )
                    session.add(db_kline)
                    inserted += 1
                except Exception:
                    pass  # Skip duplicates
            
            try:
                await session.commit()
                logger.debug(f"Bulk inserted {inserted} klines")
                return inserted
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to bulk insert klines: {e}")
                return 0
    
    async def get_last_kline_time(self, symbol: str, timeframe: str) -> Optional[int]:
        """Get the timestamp of the last K-line for a symbol/timeframe"""
        async with self.SessionLocal() as session:
            result = await session.execute(
                select(KlineDB.timestamp)
                .where(KlineDB.symbol == symbol, KlineDB.timeframe == timeframe)
                .order_by(KlineDB.timestamp.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            return row if row else None
    
    async def get_recent_klines(
        self, 
        symbol: str, 
        timeframe: str, 
        limit: int = 200,
        before: Optional[int] = None
    ) -> List[KlineData]:
        """
        Get recent K-lines
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe
            limit: Number of K-lines to fetch
            before: Optional timestamp - fetch K-lines before this timestamp
        """
        async with self.SessionLocal() as session:
            query = select(KlineDB).where(
                KlineDB.symbol == symbol, 
                KlineDB.timeframe == timeframe
            )
            
            # If before timestamp is specified, only get K-lines before it
            if before is not None:
                query = query.where(KlineDB.timestamp < before)
            
            query = query.order_by(KlineDB.timestamp.desc()).limit(limit)
            
            result = await session.execute(query)
            rows = result.scalars().all()
            
            # Convert to Pydantic models (reverse to chronological order)
            return [
                KlineData(
                    symbol=row.symbol,
                    timeframe=row.timeframe,
                    timestamp=row.timestamp,
                    open=row.open,
                    high=row.high,
                    low=row.low,
                    close=row.close,
                    volume=row.volume
                )
                for row in reversed(rows)
            ]
    
    # Indicator operations
    
    async def insert_indicator(self, indicator: IndicatorData) -> bool:
        """Insert indicator data"""
        async with self.SessionLocal() as session:
            try:
                db_indicator = IndicatorDB(
                    symbol=indicator.symbol,
                    timeframe=indicator.timeframe,
                    timestamp=indicator.timestamp,
                    ma5=indicator.ma5,
                    ma10=indicator.ma10,
                    ma20=indicator.ma20,
                    ma60=indicator.ma60,
                    ma120=indicator.ma120,
                    ema12=indicator.ema12,
                    ema26=indicator.ema26,
                    rsi14=indicator.rsi14,
                    macd_line=indicator.macd_line,
                    macd_signal=indicator.macd_signal,
                    macd_histogram=indicator.macd_histogram,
                    bb_upper=indicator.bb_upper,
                    bb_middle=indicator.bb_middle,
                    bb_lower=indicator.bb_lower,
                    atr14=indicator.atr14,
                    volume_ma5=indicator.volume_ma5
                )
                session.add(db_indicator)
                await session.commit()
                return True
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to insert indicator: {e}")
                return False
    
    async def get_indicator_at(
        self, 
        symbol: str, 
        timeframe: str, 
        timestamp: int
    ) -> Optional[IndicatorData]:
        """Get indicator at specific timestamp"""
        async with self.SessionLocal() as session:
            result = await session.execute(
                select(IndicatorDB)
                .where(
                    IndicatorDB.symbol == symbol,
                    IndicatorDB.timeframe == timeframe,
                    IndicatorDB.timestamp == timestamp
                )
            )
            row = result.scalar_one_or_none()
            
            if not row:
                return None
            
            return IndicatorData(
                symbol=row.symbol,
                timeframe=row.timeframe,
                timestamp=row.timestamp,
                ma5=row.ma5,
                ma10=row.ma10,
                ma20=row.ma20,
                ma60=row.ma60,
                ma120=row.ma120,
                ema12=row.ema12,
                ema26=row.ema26,
                rsi14=row.rsi14,
                macd_line=row.macd_line,
                macd_signal=row.macd_signal,
                macd_histogram=row.macd_histogram,
                bb_upper=row.bb_upper,
                bb_middle=row.bb_middle,
                bb_lower=row.bb_lower,
                atr14=row.atr14,
                volume_ma5=row.volume_ma5
            )
    
    # Signal operations
    
    async def insert_signal(self, signal: SignalData) -> bool:
        """Insert trading signal"""
        async with self.SessionLocal() as session:
            try:
                db_signal = SignalDB(
                    strategy_name=signal.strategy_name,
                    symbol=signal.symbol,
                    timestamp=signal.timestamp,
                    signal_type=signal.signal_type.value,
                    price=signal.price,
                    reason=signal.reason,
                    confidence=signal.confidence,
                    stop_loss=signal.stop_loss,
                    take_profit=signal.take_profit,
                    position_size=signal.position_size
                )
                session.add(db_signal)
                await session.commit()
                return True
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to insert signal: {e}")
                return False
    
    async def get_recent_signals(
        self,
        strategy_name: str,
        symbol: Optional[str] = None,
        limit: int = 100
    ) -> List[SignalData]:
        """Get recent signals"""
        async with self.SessionLocal() as session:
            query = select(SignalDB).where(SignalDB.strategy_name == strategy_name)
            
            if symbol:
                query = query.where(SignalDB.symbol == symbol)
            
            query = query.order_by(SignalDB.timestamp.desc()).limit(limit)
            
            result = await session.execute(query)
            rows = result.scalars().all()
            
            from app.models.signals import SignalType
            
            return [
                SignalData(
                    strategy_name=row.strategy_name,
                    symbol=row.symbol,
                    timestamp=row.timestamp,
                    signal_type=SignalType(row.signal_type),
                    price=row.price,
                    reason=row.reason or "",
                    confidence=row.confidence,
                    stop_loss=row.stop_loss,
                    take_profit=row.take_profit,
                    position_size=row.position_size
                )
                for row in reversed(rows)
            ]
    
    # Drawing operations
    
    async def insert_drawing(self, drawing: DrawingData) -> bool:
        """插入绘图数据"""
        async with self.SessionLocal() as session:
            try:
                db_drawing = DrawingDB(
                    drawing_id=drawing.drawing_id,
                    symbol=drawing.symbol,
                    timeframe=drawing.timeframe,
                    drawing_type=drawing.drawing_type.value,
                    points=[p.model_dump() for p in drawing.points],
                    style=drawing.style.model_dump(),
                    label=drawing.label,
                    created_at=drawing.created_at
                )
                session.add(db_drawing)
                await session.commit()
                logger.info(f"Inserted drawing: {drawing.drawing_id}")
                return True
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to insert drawing: {e}")
                return False
    
    async def get_drawings(
        self,
        symbol: str,
        timeframe: str
    ) -> List[DrawingData]:
        """获取指定交易对的所有绘图"""
        async with self.SessionLocal() as session:
            query = select(DrawingDB).where(
                DrawingDB.symbol == symbol,
                DrawingDB.timeframe == timeframe
            ).order_by(DrawingDB.created_at.desc())
            
            result = await session.execute(query)
            rows = result.scalars().all()
            
            return [
                DrawingData(
                    drawing_id=row.drawing_id,
                    symbol=row.symbol,
                    timeframe=row.timeframe,
                    drawing_type=row.drawing_type,
                    points=[DrawingPoint(**p) for p in row.points],
                    style=DrawingStyle(**row.style),
                    label=row.label or "",
                    created_at=row.created_at
                )
                for row in rows
            ]
    
    async def get_drawing_by_id(self, drawing_id: str) -> Optional[DrawingData]:
        """根据ID获取单个绘图"""
        async with self.SessionLocal() as session:
            result = await session.execute(
                select(DrawingDB).where(DrawingDB.drawing_id == drawing_id)
            )
            row = result.scalar_one_or_none()
            
            if not row:
                return None
            
            return DrawingData(
                drawing_id=row.drawing_id,
                symbol=row.symbol,
                timeframe=row.timeframe,
                drawing_type=row.drawing_type,
                points=[DrawingPoint(**p) for p in row.points],
                style=DrawingStyle(**row.style),
                label=row.label or "",
                created_at=row.created_at
            )
    
    async def update_drawing(self, drawing: DrawingData) -> bool:
        """更新绘图数据"""
        async with self.SessionLocal() as session:
            try:
                result = await session.execute(
                    select(DrawingDB).where(DrawingDB.drawing_id == drawing.drawing_id)
                )
                db_drawing = result.scalar_one_or_none()
                
                if db_drawing:
                    db_drawing.points = [p.model_dump() for p in drawing.points]
                    db_drawing.style = drawing.style.model_dump()
                    db_drawing.label = drawing.label
                    await session.commit()
                    logger.info(f"Updated drawing: {drawing.drawing_id}")
                    return True
                return False
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to update drawing: {e}")
                return False
    
    async def delete_drawing(self, drawing_id: str) -> bool:
        """删除绘图"""
        async with self.SessionLocal() as session:
            try:
                result = await session.execute(
                    select(DrawingDB).where(DrawingDB.drawing_id == drawing_id)
                )
                drawing = result.scalar_one_or_none()
                
                if drawing:
                    await session.delete(drawing)
                    await session.commit()
                    logger.info(f"Deleted drawing: {drawing_id}")
                    return True
                return False
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to delete drawing: {e}")
                return False

