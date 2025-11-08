"""REST API endpoints"""

import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Database
from app.config import settings
from app.models.market_data import KlineData, TickerData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData
from app.models.drawings import DrawingData
from app.exchanges.binance import BinanceExchange
from app.services.data_manager import DataManager

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Quantitative Trading System API",
    description="REST API for accessing trading data",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database instance (will be initialized on startup)
db: Optional[Database] = None
exchange: Optional[BinanceExchange] = None
data_manager: Optional[DataManager] = None


@app.on_event("startup")
async def startup_event():
    """Initialize database and exchange on startup"""
    global db, exchange, data_manager
    db = Database(settings.database_url)
    await db.create_tables()
    
    # Prepare proxy configuration
    proxy_config = None
    if settings.proxy_enabled:
        proxy_config = {
            'enabled': settings.proxy_enabled,
            'host': settings.proxy_host,
            'port': settings.proxy_port,
            'username': settings.proxy_username,
            'password': settings.proxy_password
        }
    
    # Initialize exchange for ticker API (延迟加载，首次调用时自动加载markets)
    exchange = BinanceExchange(proxy_config=proxy_config, market_type=settings.market_type)
    
    # Initialize data manager
    data_manager = DataManager(db=db, exchange=exchange)
    
    logger.info("REST API started")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database on shutdown"""
    global db
    if db:
        await db.close()
    logger.info("REST API shutdown")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Quantitative Trading System API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# K-line endpoints

@app.get("/api/klines/{symbol}/{timeframe}", response_model=List[KlineData])
async def get_klines(
    symbol: str,
    timeframe: str,
    limit: int = Query(100, ge=1, le=1000, description="Number of K-lines to fetch"),
    before: Optional[int] = Query(None, description="Fetch K-lines before this timestamp (for pagination)"),
    market_type: str = Query('future', description="Market type: spot, future, delivery")
):
    """
    Get recent K-line data
    
    Args:
        symbol: Trading symbol (e.g., BTCUSDT)
        timeframe: Timeframe (e.g., 1h, 1d)
        limit: Number of K-lines to fetch (max 1000)
        before: Optional timestamp - fetch K-lines before this timestamp (for infinite scroll)
        market_type: Market type (spot, future, delivery)
        
    Returns:
        List of K-line data
    """
    try:
        klines = await db.get_recent_klines(symbol, timeframe, limit, before, market_type)
        # 调试：打印到控制台
        if klines:
            import json
            print(f"\n{'='*80}")
            print(f"🔍 API Query: symbol={symbol}, timeframe={timeframe}, market_type={market_type}")
            print(f"🔍 Result: {len(klines)} klines")
            print(f"🔍 First kline market_type: {klines[0].market_type}")
            print(f"🔍 Serialized:")
            print(json.dumps(klines[0].model_dump(), indent=2))
            print(f"{'='*80}\n")
        return klines
    except Exception as e:
        logger.error(f"Failed to fetch K-lines: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/klines/{symbol}/{timeframe}/latest", response_model=Optional[KlineData])
async def get_latest_kline(
    symbol: str,
    timeframe: str,
    market_type: str = Query('future', description="Market type: spot, future, delivery")
):
    """
    Get the latest K-line
    
    Args:
        symbol: Trading symbol
        timeframe: Timeframe
        market_type: Market type (spot, future, delivery)
        
    Returns:
        Latest K-line data or None
    """
    try:
        klines = await db.get_recent_klines(symbol, timeframe, limit=1, market_type=market_type)
        return klines[0] if klines else None
    except Exception as e:
        logger.error(f"Failed to fetch latest K-line: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Ticker endpoints

@app.get("/api/ticker/{symbol}", response_model=TickerData)
async def get_ticker(symbol: str):
    """
    Get 24hr ticker statistics from exchange (交易所官方24小时统计数据)
    
    Args:
        symbol: Trading symbol (e.g., 'BTCUSDT')
        
    Returns:
        Ticker data with 24hr statistics
    """
    try:
        # Convert BTCUSDT to BTC/USDT for exchange
        exchange_symbol = f"{symbol[:-4]}/{symbol[-4:]}" if symbol.endswith('USDT') else symbol
        ticker = await exchange.fetch_ticker(exchange_symbol)
        return ticker
    except Exception as e:
        logger.error(f"Failed to fetch ticker for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Indicator endpoints

@app.get("/api/indicators/{symbol}/{timeframe}/latest", response_model=Optional[IndicatorData])
async def get_latest_indicator(
    symbol: str,
    timeframe: str
):
    """
    Get the latest indicator data
    
    Args:
        symbol: Trading symbol
        timeframe: Timeframe
        
    Returns:
        Latest indicator data or None
    """
    try:
        # Get latest K-line timestamp
        timestamp = await db.get_last_kline_time(symbol, timeframe)
        
        if not timestamp:
            return None
        
        indicator = await db.get_indicator_at(symbol, timeframe, timestamp)
        return indicator
    except Exception as e:
        logger.error(f"Failed to fetch latest indicator: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Signal endpoints

@app.get("/api/signals/{strategy_name}", response_model=List[SignalData])
async def get_signals(
    strategy_name: str,
    symbol: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000, description="Number of signals to fetch")
):
    """
    Get trading signals
    
    Args:
        strategy_name: Strategy identifier (e.g., dual_ma)
        symbol: Optional symbol filter
        limit: Number of signals to fetch
        
    Returns:
        List of trading signals
    """
    try:
        signals = await db.get_recent_signals(strategy_name, symbol, limit)
        return signals
    except Exception as e:
        logger.error(f"Failed to fetch signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/signals/{strategy_name}/latest", response_model=Optional[SignalData])
async def get_latest_signal(
    strategy_name: str,
    symbol: Optional[str] = None
):
    """
    Get the latest signal
    
    Args:
        strategy_name: Strategy identifier
        symbol: Optional symbol filter
        
    Returns:
        Latest signal or None
    """
    try:
        signals = await db.get_recent_signals(strategy_name, symbol, limit=1)
        return signals[0] if signals else None
    except Exception as e:
        logger.error(f"Failed to fetch latest signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Statistics endpoints

@app.get("/api/stats/symbols")
async def get_available_symbols():
    """
    Get list of available symbols
    
    Returns:
        List of symbols with data
    """
    # TODO: Implement query to get distinct symbols from database
    return {
        "symbols": ["BTCUSDT", "ETHUSDT"],
        "note": "This endpoint is not fully implemented yet"
    }


@app.get("/api/stats/summary")
async def get_system_summary():
    """
    Get system statistics summary
    
    Returns:
        System statistics
    """
    # TODO: Implement comprehensive statistics
    return {
        "status": "running",
        "total_klines": 0,
        "total_indicators": 0,
        "total_signals": 0,
        "active_symbols": 0,
        "note": "This endpoint is not fully implemented yet"
    }


# Drawing endpoints

@app.get("/api/drawings/{symbol}", response_model=List[DrawingData])
async def get_drawings(
    symbol: str
):
    """
    获取指定交易对的所有绘图（所有时间级别共享）
    
    Args:
        symbol: 交易对
        
    Returns:
        绘图数据列表
    """
    try:
        drawings = await db.get_drawings(symbol)
        return drawings
    except Exception as e:
        logger.error(f"Failed to fetch drawings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drawings/id/{drawing_id}", response_model=Optional[DrawingData])
async def get_drawing_by_id(drawing_id: str):
    """
    根据ID获取单个绘图
    
    Args:
        drawing_id: 绘图ID
        
    Returns:
        绘图数据或None
    """
    try:
        drawing = await db.get_drawing_by_id(drawing_id)
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")
        return drawing
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch drawing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/drawings", response_model=dict)
async def create_drawing(drawing: DrawingData):
    """
    创建新绘图
    
    Args:
        drawing: 绘图数据
        
    Returns:
        成功消息
    """
    try:
        success = await db.insert_drawing(drawing)
        if success:
            return {"status": "success", "drawing_id": drawing.drawing_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to save drawing")
    except Exception as e:
        logger.error(f"Failed to create drawing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/drawings/{drawing_id}", response_model=dict)
async def update_drawing(drawing_id: str, drawing: DrawingData):
    """
    更新绘图
    
    Args:
        drawing_id: 绘图ID
        drawing: 更新的绘图数据
        
    Returns:
        成功消息
    """
    try:
        if drawing_id != drawing.drawing_id:
            raise HTTPException(status_code=400, detail="Drawing ID mismatch")
        
        success = await db.update_drawing(drawing)
        if success:
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Drawing not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update drawing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/drawings/{drawing_id}", response_model=dict)
async def delete_drawing(drawing_id: str):
    """
    删除绘图
    
    Args:
        drawing_id: 绘图ID
        
    Returns:
        成功消息
    """
    try:
        success = await db.delete_drawing(drawing_id)
        if success:
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Drawing not found")
    except Exception as e:
        logger.error(f"Failed to delete drawing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# 数据管理 API
# ====================

@app.post("/api/data/download", response_model=dict)
async def create_download_task(
    symbol: str,
    timeframe: str,
    start_time: int,
    end_time: int,
    market_type: str = "future",
    auto_start: bool = True
):
    """
    创建历史数据下载任务
    
    Args:
        symbol: 交易对（如 BTCUSDT）
        timeframe: 时间周期（如 1h）
        start_time: 开始时间戳（秒）
        end_time: 结束时间戳（秒）
        market_type: 市场类型（spot/future/delivery）
        auto_start: 是否自动开始下载
        
    Returns:
        任务信息
    """
    try:
        task_id = data_manager.create_download_task(
            symbol=symbol,
            timeframe=timeframe,
            start_time=start_time,
            end_time=end_time,
            market_type=market_type
        )
        
        if auto_start:
            await data_manager.start_download_task(task_id)
        
        task_status = data_manager.get_task_status(task_id)
        
        return {
            "status": "success",
            "task": task_status
        }
    except Exception as e:
        logger.error(f"Failed to create download task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/download/{task_id}", response_model=dict)
async def get_download_task(task_id: str):
    """
    获取下载任务状态
    
    Args:
        task_id: 任务ID
        
    Returns:
        任务状态
    """
    try:
        task_status = data_manager.get_task_status(task_id)
        
        if task_status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {
            "status": "success",
            "task": task_status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/download", response_model=dict)
async def list_download_tasks():
    """
    获取所有下载任务列表
    
    Returns:
        任务列表
    """
    try:
        tasks = data_manager.get_all_tasks()
        
        return {
            "status": "success",
            "tasks": tasks,
            "total": len(tasks)
        }
    except Exception as e:
        logger.error(f"Failed to list tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/data/download/{task_id}/start", response_model=dict)
async def start_download_task(task_id: str):
    """
    启动下载任务
    
    Args:
        task_id: 任务ID
        
    Returns:
        成功消息
    """
    try:
        await data_manager.start_download_task(task_id)
        
        return {
            "status": "success",
            "message": "Task started"
        }
    except Exception as e:
        logger.error(f"Failed to start task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/data/download/{task_id}/cancel", response_model=dict)
async def cancel_download_task(task_id: str):
    """
    取消下载任务
    
    Args:
        task_id: 任务ID
        
    Returns:
        成功消息
    """
    try:
        await data_manager.cancel_task(task_id)
        
        return {
            "status": "success",
            "message": "Task cancelled"
        }
    except Exception as e:
        logger.error(f"Failed to cancel task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/stats", response_model=dict)
async def get_data_stats():
    """
    获取数据统计信息
    
    Returns:
        数据统计
    """
    try:
        stats = await data_manager.get_data_stats()
        
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Failed to get data stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

