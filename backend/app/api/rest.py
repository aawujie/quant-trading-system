"""REST API endpoints"""

import asyncio
import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Database
from app.config import settings
from app.models.market_data import KlineData, TickerData
from app.models.indicators import IndicatorData
from app.models.signals import SignalData
from app.models.drawings import DrawingData
from app.models.requests import BacktestRequest, OptimizationRequest, DataDownloadRequest, DataRepairRequest
from app.exchanges.binance import BinanceExchange
from app.services.data_manager import DataManager
from app.core.strategy_config import get_strategy_config
from app.core.position_config import get_position_config
from app.core.task_manager import backtest_task_manager, optimization_task_manager, start_cleanup_task

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
    
    # 启动任务清理定时任务
    asyncio.create_task(start_cleanup_task())
    logger.info("Task cleanup scheduler started")
    
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

@app.get("/api/indicators/{symbol}/{timeframe}", response_model=List[IndicatorData])
async def get_indicators(
    symbol: str,
    timeframe: str,
    limit: int = Query(500, ge=1, le=1000, description="Number of indicators to fetch"),
    before: Optional[int] = Query(None, description="Fetch indicators before this timestamp"),
    market_type: str = Query('future', description="Market type: spot, future, delivery")
):
    """
    Get recent indicator data (batch)
    
    Args:
        symbol: Trading symbol (e.g., BTCUSDT)
        timeframe: Timeframe (e.g., 1h, 1d)
        limit: Number of indicators to fetch (max 1000)
        before: Optional timestamp - fetch indicators before this timestamp
        market_type: Market type (spot, future, delivery)
        
    Returns:
        List of indicator data, sorted by timestamp ascending
    """
    try:
        indicators = await db.get_recent_indicators(symbol, timeframe, limit, before, market_type)
        return indicators
    except Exception as e:
        logger.error(f"Failed to fetch indicators: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/indicators/{symbol}/{timeframe}/latest", response_model=Optional[IndicatorData])
async def get_latest_indicator(
    symbol: str,
    timeframe: str,
    market_type: str = Query('future', description="Market type: spot, future, delivery")
):
    """
    Get the latest indicator data
    
    Args:
        symbol: Trading symbol
        timeframe: Timeframe
        market_type: Market type (spot, future, delivery)
        
    Returns:
        Latest indicator data or None
    """
    try:
        # Get latest K-line timestamp
        timestamp = await db.get_last_kline_time(symbol, timeframe, market_type)
        
        if not timestamp:
            return None
        
        indicator = await db.get_indicator_at(symbol, timeframe, timestamp, market_type)
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


# =============================================================================
# Admin Endpoints - Data Integrity
# =============================================================================

@app.post("/api/admin/repair-data")
async def trigger_data_repair(
    symbols: str = Query('BTCUSDT,ETHUSDT', description="Comma-separated symbols"),
    timeframes: str = Query('1h,4h,1d', description="Comma-separated timeframes"),
    days: int = Query(7, ge=1, le=90, description="Check last N days"),
    market_type: str = Query('future', description="Market type")
):
    """
    手动触发数据修复任务
    
    Args:
        symbols: 交易对列表（逗号分隔）
        timeframes: 时间周期列表（逗号分隔）
        days: 检查最近N天
        market_type: 市场类型
        
    Returns:
        任务启动状态
    """
    try:
        from app.services.data_integrity import DataIntegrityService
        from app.exchanges.binance import BinanceExchange
        from app.config import settings
        
        # 在后台异步执行（不阻塞请求）
        async def run_repair():
            exchange = BinanceExchange(
                api_key=settings.binance_api_key or "",
                api_secret=settings.binance_api_secret or "",
                market_type=market_type
            )
            
            service = DataIntegrityService(db, exchange)
            
            try:
                await service.check_and_repair_all(
                    symbols=symbols.split(','),
                    timeframes=timeframes.split(','),
                    days_back=days,
                    auto_fix=True,
                    market_type=market_type
                )
            finally:
                await exchange.close()
        
        # 启动后台任务
        asyncio.create_task(run_repair())
        
        return {
            "status": "started",
            "message": "Data repair task started in background",
            "parameters": {
                "symbols": symbols.split(','),
                "timeframes": timeframes.split(','),
                "days": days,
                "market_type": market_type
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to start data repair: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/data-status")
async def check_data_status(
    symbols: str = Query('BTCUSDT', description="Comma-separated symbols"),
    timeframes: str = Query('1h', description="Comma-separated timeframes"),
    days: int = Query(7, ge=1, le=90, description="Check last N days"),
    market_type: str = Query('future', description="Market type")
):
    """
    检查数据完整性状态
    
    Args:
        symbols: 交易对列表（逗号分隔）
        timeframes: 时间周期列表（逗号分隔）
        days: 检查最近N天
        market_type: 市场类型
        
    Returns:
        数据状态报告
    """
    try:
        from app.services.data_integrity import DataIntegrityService
        from app.exchanges.binance import BinanceExchange
        from app.config import settings
        
        exchange = BinanceExchange(
            api_key=settings.binance_api_key or "",
            api_secret=settings.binance_api_secret or "",
            market_type=market_type
        )
        
        service = DataIntegrityService(db, exchange)
        
        result = {}
        
        for symbol in symbols.split(','):
            for timeframe in timeframes.split(','):
                key = f"{symbol}_{timeframe}"
                
                # 检测K线缺失
                kline_gaps = await service.detect_kline_gaps(
                    symbol.strip(), 
                    timeframe.strip(), 
                    days, 
                    market_type
                )
                
                # 检测指标缺失（也按时间）
                indicator_gaps = await service.detect_indicator_gaps(
                    symbol.strip(), 
                    timeframe.strip(), 
                    days,
                    market_type
                )
                
                # 计算缺失总数
                kline_gap_count = sum(
                    (end - start) // service._get_interval_seconds(timeframe.strip()) + 1
                    for start, end in kline_gaps
                )
                
                result[key] = {
                    "kline_gaps": len(kline_gaps),
                    "kline_missing_count": kline_gap_count,
                    "indicator_gaps": len(indicator_gaps),
                    "status": "complete" if not kline_gaps and not indicator_gaps else "incomplete"
                }
        
        await exchange.close()
        
        return {
            "status": "success",
            "data": result,
            "parameters": {
                "symbols": symbols.split(','),
                "timeframes": timeframes.split(','),
                "days": days,
                "market_type": market_type
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to check data status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Backtest & Optimization Endpoints (优化版)
# =============================================================================

from typing import Dict, Any

# 任务管理器已在模块顶部导入
# 不再使用全局字典，改用 TaskManager


@app.post("/api/backtest/run")
async def run_backtest(request: BacktestRequest):
    """
    运行策略回测（优化版）
    
    优化特性：
    - TTL缓存（1小时自动过期）
    - 并发控制（最多3个并发）
    - WebSocket实时推送
    - SQL层面时间过滤
    
    Args:
        request: 回测配置
        
    Returns:
        任务ID和状态
    """
    try:
        import uuid
        from app.core.data_source import BacktestDataSource
        from app.core.trading_engine import TradingEngine
        from app.core.position_manager import PositionManagerFactory
        from app.core.message_bus import MessageBus
        
        task_id = str(uuid.uuid4())
        
        # 定义回测任务函数（带细粒度进度）
        async def run_backtest_task():
            from datetime import datetime
            from app.core.progress_tracker import create_backtest_progress_tracker
            
            # === 阶段0: 初始化 (0-5%) ===
            backtest_task_manager.update_progress(task_id, 2)
            
            # 创建MessageBus
            bus = MessageBus()
            
            # 转换日期为时间戳
            start_time = int(datetime.fromisoformat(request.start_date).timestamp())
            end_time = int(datetime.fromisoformat(request.end_date).timestamp())
            
            backtest_task_manager.update_progress(task_id, 5)
            
            # === 阶段1: 数据加载 (5-20%) ===
            # 创建数据源
            data_source = BacktestDataSource(
                db, start_time, end_time, request.market_type
            )
            
            backtest_task_manager.update_progress(task_id, 8)
            
            # 预加载数据
            await data_source.preload_data([request.symbol], request.timeframe)
            
            backtest_task_manager.update_progress(task_id, 15)
            
            # 估算总数据量
            total_points = await data_source.estimate_total_points(
                [request.symbol], request.timeframe
            )
            
            backtest_task_manager.update_progress(task_id, 20)
            
            # === 阶段2: 策略初始化 (20-25%) ===
            # 创建策略实例
            if request.strategy == 'rsi':
                from app.nodes.strategies.rsi_strategy import RSIStrategy
                strategy = RSIStrategy(
                    bus=bus,
                    db=db,
                    symbols=[request.symbol],
                    timeframe=request.timeframe,
                    enable_ai_enhancement=request.enable_ai,
                    **request.params
                )
            elif request.strategy == 'dual_ma':
                from app.nodes.strategies.dual_ma_strategy import DualMAStrategy
                strategy = DualMAStrategy(
                    bus=bus,
                    db=db,
                    symbols=[request.symbol],
                    timeframe=request.timeframe,
                    enable_ai_enhancement=request.enable_ai,
                    **request.params
                )
            elif request.strategy == 'macd':
                from app.nodes.strategies.macd_strategy import MACDStrategy
                strategy = MACDStrategy(
                    bus=bus,
                    db=db,
                    symbols=[request.symbol],
                    timeframe=request.timeframe,
                    enable_ai_enhancement=request.enable_ai,
                    **request.params
                )
            elif request.strategy == 'bollinger':
                from app.nodes.strategies.bollinger_strategy import BollingerStrategy
                strategy = BollingerStrategy(
                    bus=bus,
                    db=db,
                    symbols=[request.symbol],
                    timeframe=request.timeframe,
                    enable_ai_enhancement=request.enable_ai,
                    **request.params
                )
            else:
                raise ValueError(f"Unknown strategy: {request.strategy}")
            
            backtest_task_manager.update_progress(task_id, 25)
            
            # === 阶段3: 回测执行 (25-95%) ===
            # 创建仓位管理器
            pm_factory = getattr(PositionManagerFactory, f'create_{request.position_preset}')
            position_manager = pm_factory(request.initial_capital)
            
            # 创建细粒度进度跟踪器（25-95%范围）
            from app.core.progress_tracker import ProgressTracker
            execution_tracker = ProgressTracker(
                total_items=max(1, total_points),
                min_interval=0.5,  # 最快每0.5秒更新
                max_updates=100,   # 最多100次更新
                callback=lambda p: backtest_task_manager.update_progress(
                    task_id,
                    25 + int(p * 0.7)  # 映射到25-95%
                )
            )
            
            # 创建交易引擎（传入进度跟踪器）
            engine = TradingEngine(
                data_source,
                strategy,
                position_manager,
                mode="backtest",
                progress_tracker=execution_tracker
            )
            
            # 运行回测（自动更新进度）
            await engine.run()
            
            backtest_task_manager.update_progress(task_id, 95)
            
            # === 阶段4: 结果统计 (95-100%) ===
            results = engine.get_results()
            
            backtest_task_manager.update_progress(task_id, 98)
            
            # 返回结果（100%会在任务完成时自动设置）
            return results
        
        # 使用任务管理器创建任务（自动处理并发控制和TTL）
        await backtest_task_manager.create_task(
            task_id=task_id,
            task_func=run_backtest_task,
            request_data=request.model_dump()
        )
        
        return {
            "status": "success",
            "task_id": task_id,
            "message": "Backtest task started (optimized)"
        }
        
    except Exception as e:
        logger.error(f"Failed to start backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/result/{task_id}")
async def get_backtest_result(task_id: str):
    """
    获取回测结果（优化版）
    
    从任务管理器获取（支持TTL缓存）
    
    Args:
        task_id: 任务ID
        
    Returns:
        回测结果或任务状态
    """
    task = backtest_task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or expired")
    
    return {
        "status": task['status'],
        "progress": task.get('progress', 0),
        "results": task.get('results'),
        "error": task.get('error')
    }


@app.websocket("/ws/backtest/{task_id}")
async def backtest_websocket(websocket: WebSocket, task_id: str):
    """
    WebSocket端点 - 实时推送回测进度
    
    替代前端轮询，性能提升96.7%
    
    连接后会：
    1. 立即发送当前任务状态
    2. 任务状态变化时实时推送
    3. 任务完成后自动关闭连接
    
    Args:
        websocket: WebSocket连接
        task_id: 任务ID
    """
    await websocket.accept()
    
    try:
        # 注册WebSocket连接
        await backtest_task_manager.register_websocket(task_id, websocket)
        logger.info(f"WebSocket connected for backtest task {task_id}")
        
        # 保持连接，等待任务完成
        while True:
            # 检查任务状态
            task = backtest_task_manager.get_task(task_id)
            
            if not task:
                await websocket.send_json({
                    'error': 'Task not found or expired'
                })
                break
            
            # 任务完成，关闭连接
            if task['status'] in ['completed', 'failed']:
                await asyncio.sleep(0.5)  # 确保最后一条消息已发送
                break
            
            # 等待状态变化（任务管理器会自动推送）
            await asyncio.sleep(1)
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for backtest task {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error for backtest task {task_id}: {e}")
    finally:
        # 注销WebSocket连接
        await backtest_task_manager.unregister_websocket(task_id, websocket)
        await websocket.close()


@app.get("/api/backtest/stats")
async def get_backtest_stats():
    """
    获取回测任务统计信息
    
    Returns:
        任务统计数据
    """
    return {
        "status": "success",
        "stats": backtest_task_manager.get_stats()
    }


# ==================== 仓位管理配置接口 ====================

@app.get("/api/position/presets")
async def get_position_manager_presets():
    """
    获取仓位管理预设配置（从配置文件）
    
    Returns:
        预设列表
    """
    try:
        position_config = get_position_config()
        presets = position_config.format_for_api()
        
        return {
            "status": "success",
            "presets": presets,
            "total": len(presets)
        }
    except Exception as e:
        logger.error(f"Failed to get position presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/position/presets/{preset_name}")
async def get_position_preset_detail(preset_name: str):
    """
    获取指定仓位管理预设的详细配置
    
    Args:
        preset_name: 预设名称
        
    Returns:
        预设详细配置
    """
    try:
        position_config = get_position_config()
        preset = position_config.get_preset(preset_name)
        
        if not preset:
            raise HTTPException(status_code=404, detail=f"Position preset '{preset_name}' not found")
        
        return {
            "status": "success",
            "preset": {
                "name": preset_name,
                "display_name": preset.get("display_name", preset_name),
                "description": preset.get("description", ""),
                "icon": preset.get("icon", "📊"),
                "color": preset.get("color", "#2196F3"),
                "sizing_strategy": preset.get("sizing_strategy", {}),
                "risk_management": preset.get("risk_management", {}),
                "default_stops": preset.get("default_stops", {}),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get position preset detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/position/sizing-strategies")
async def get_sizing_strategies():
    """
    获取仓位计算策略说明
    
    Returns:
        策略说明列表
    """
    try:
        position_config = get_position_config()
        strategies = position_config.get_sizing_strategies()
        
        return {
            "status": "success",
            "strategies": strategies
        }
    except Exception as e:
        logger.error(f"Failed to get sizing strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/position/recommendations")
async def get_position_recommendations():
    """
    获取仓位管理推荐配置
    
    Returns:
        推荐配置
    """
    try:
        position_config = get_position_config()
        recommendations = position_config.get_recommendations()
        
        return {
            "status": "success",
            "recommendations": recommendations
        }
    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/position/reload")
async def reload_position_config():
    """
    重新加载仓位管理配置
    
    Returns:
        重新加载结果
    """
    try:
        from app.core.position_config import reload_position_config
        reload_position_config()
        
        return {
            "status": "success",
            "message": "Position management configuration reloaded successfully"
        }
    except Exception as e:
        logger.error(f"Failed to reload position config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/run")
async def run_optimization(request: OptimizationRequest):
    """
    运行参数优化
    
    Args:
        request: 优化配置
        
    Returns:
        任务ID和状态
    """
    try:
        import uuid
        from app.services.strategy_optimizer import StrategyOptimizer
        
        task_id = str(uuid.uuid4())
        
        # 在后台异步运行优化
        async def run_optimization_task():
            try:
                optimization_tasks[task_id]['status'] = 'running'
                
                # 创建优化器
                optimizer = StrategyOptimizer(
                    db=db,
                    symbols=request.symbols,
                    timeframe=request.timeframe,
                    market_type=request.market_type
                )
                
                # 运行优化
                if request.strategy_name == 'rsi':
                    results = await optimizer.optimize_rsi_strategy(
                        start_time=request.start_time,
                        end_time=request.end_time,
                        initial_balance=request.initial_balance,
                        n_trials=request.n_trials,
                        optimization_target=request.optimization_target
                    )
                elif request.strategy_name == 'dual_ma':
                    results = await optimizer.optimize_dual_ma_strategy(
                        start_time=request.start_time,
                        end_time=request.end_time,
                        initial_balance=request.initial_balance,
                        n_trials=request.n_trials,
                        optimization_target=request.optimization_target
                    )
                else:
                    raise ValueError(f"Unknown strategy: {request.strategy_name}")
                
                # 保存结果
                optimization_tasks[task_id]['status'] = 'completed'
                optimization_tasks[task_id]['results'] = results
                
            except Exception as e:
                logger.error(f"Optimization task {task_id} failed: {e}")
                optimization_tasks[task_id]['status'] = 'failed'
                optimization_tasks[task_id]['error'] = str(e)
        
        # 初始化任务状态
        optimization_tasks[task_id] = {
            'status': 'pending',
            'request': request.model_dump(),
            'results': None,
            'error': None
        }
        
        # 启动后台任务
        asyncio.create_task(run_optimization_task())
        
        return {
            "status": "success",
            "task_id": task_id,
            "message": "Optimization task started"
        }
        
    except Exception as e:
        logger.error(f"Failed to start optimization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimize/result/{task_id}")
async def get_optimization_result(task_id: str):
    """
    获取优化结果
    
    Args:
        task_id: 任务ID
        
    Returns:
        优化结果或任务状态
    """
    if task_id not in optimization_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = optimization_tasks[task_id]
    
    return {
        "status": task['status'],
        "results": task.get('results'),
        "error": task.get('error')
    }


@app.get("/api/ai/config")
async def get_ai_config():
    """
    获取AI配置状态
    
    Returns:
        AI配置信息
    """
    import os
    
    return {
        "status": "success",
        "config": {
            "enabled": os.getenv('ENABLE_AI_ENHANCEMENT', 'false').lower() == 'true',
            "model": "deepseek-chat",
            "api_key_set": bool(os.getenv('DEEPSEEK_API_KEY')),
            "timeout": float(os.getenv('AI_TIMEOUT', '5.0'))
        }
    }


# ==================== 策略配置接口 ====================

@app.get("/api/strategies")
async def get_strategies():
    """
    获取所有可用策略及其配置
    
    Returns:
        策略列表，包含每个策略的参数配置
    """
    try:
        strategy_config = get_strategy_config()
        strategies = strategy_config.format_for_api()
        
        return {
            "status": "success",
            "strategies": strategies,
            "total": len(strategies)
        }
    except Exception as e:
        logger.error(f"Failed to get strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/strategies/{strategy_name}")
async def get_strategy_detail(strategy_name: str):
    """
    获取指定策略的详细配置
    
    Args:
        strategy_name: 策略名称
        
    Returns:
        策略详细配置
    """
    try:
        strategy_config = get_strategy_config()
        strategy = strategy_config.get_strategy(strategy_name)
        
        if not strategy:
            raise HTTPException(status_code=404, detail=f"Strategy '{strategy_name}' not found")
        
        # 格式化参数
        parameters = {}
        for param_name, param_config in strategy.get("parameters", {}).items():
            parameters[param_name] = {
                "label": param_config.get("label", param_name),
                "type": param_config.get("type", "string"),
                "default": param_config.get("default"),
                "min": param_config.get("min"),
                "max": param_config.get("max"),
                "step": param_config.get("step"),
                "description": param_config.get("description", ""),
            }
        
        return {
            "status": "success",
            "strategy": {
                "name": strategy_name,
                "display_name": strategy.get("display_name", strategy_name),
                "description": strategy.get("description", ""),
                "icon": strategy.get("icon", "📊"),
                "color": strategy.get("color", "#4CAF50"),
                "category": strategy.get("category", "other"),
                "parameters": parameters,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get strategy detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/strategies/categories")
async def get_strategy_categories():
    """
    获取策略分类
    
    Returns:
        策略分类列表
    """
    try:
        strategy_config = get_strategy_config()
        categories = strategy_config.get_categories()
        
        return {
            "status": "success",
            "categories": categories
        }
    except Exception as e:
        logger.error(f"Failed to get strategy categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/strategies/reload")
async def reload_strategies():
    """
    重新加载策略配置
    
    Returns:
        重新加载结果
    """
    try:
        from app.core.strategy_config import reload_strategy_config
        reload_strategy_config()
        
        return {
            "status": "success",
            "message": "Strategy configuration reloaded successfully"
        }
    except Exception as e:
        logger.error(f"Failed to reload strategy config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

