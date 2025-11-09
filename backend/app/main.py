"""Main entry point for starting nodes"""

import argparse
import asyncio
import logging
import sys

import redis.asyncio as redis

from app.config import settings
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.exchanges.binance import BinanceExchange

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Suppress verbose logs from external libraries
logging.getLogger('ccxt').setLevel(logging.WARNING)  # 关闭ccxt的详细日志
logging.getLogger('urllib3').setLevel(logging.WARNING)  # 关闭urllib3的详细日志
logging.getLogger('asyncio').setLevel(logging.WARNING)  # 关闭asyncio的详细日志

logger = logging.getLogger(__name__)


async def start_kline_node(bus: MessageBus, db: Database, args):
    """
    Start K-line data fetching node
    
    Args:
        bus: MessageBus instance
        db: Database instance
        args: Command line arguments
    """
    from app.nodes.kline_node import KlineNode
    
    logger.info("Starting K-line node...")
    
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
    
    # Initialize exchange
    exchange = BinanceExchange(
        api_key=settings.binance_api_key,
        api_secret=settings.binance_api_secret,
        proxy_config=proxy_config,
        market_type=settings.market_type
    )
    
    # Parse symbols and timeframes
    symbols = args.symbols.split(",")
    timeframes = args.timeframes.split(",")
    
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframes: {timeframes}")
    logger.info(f"Market type: {settings.market_type}")
    
    # Create and start node
    node = KlineNode(
        bus=bus,
        exchange=exchange,
        db=db,
        symbols=symbols,
        timeframes=timeframes,
        market_type=settings.market_type,
        fetch_interval=args.fetch_interval
    )
    
    await node.start()
    
    # Keep running
    try:
        while node.is_running:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        await node.stop()
        await exchange.close()


async def start_indicator_node(bus: MessageBus, db: Database, args):
    """
    Start indicator calculation node
    
    Args:
        bus: MessageBus instance
        db: Database instance
        args: Command line arguments
    """
    from app.nodes.indicator_node import IndicatorNode
    
    logger.info("Starting indicator node...")
    
    # Parse symbols and timeframes
    symbols = args.symbols.split(",")
    timeframes = args.timeframes.split(",")
    
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframes: {timeframes}")
    
    # 指标节点订阅所有市场类型的K线数据
    market_types = ['spot', 'future']
    logger.info(f"Market types: {market_types}")
    
    # Create and start node
    node = IndicatorNode(
        bus=bus,
        db=db,
        symbols=symbols,
        timeframes=timeframes,
        market_types=market_types
    )
    
    await node.start()
    
    # Keep running
    try:
        while node.is_running:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        await node.stop()


async def start_strategy_node(bus: MessageBus, db: Database, args):
    """
    Start trading strategy nodes
    
    支持同时运行多个策略节点
    
    Args:
        bus: MessageBus instance
        db: Database instance
        args: Command line arguments
    """
    from app.nodes.strategies import (
        DualMAStrategy,
        MACDStrategy,
        RSIStrategy,
        BollingerStrategy
    )
    
    # Parse symbols
    symbols = args.symbols.split(",")
    
    # 确定要启动的策略
    strategies_to_run = args.strategies if hasattr(args, 'strategies') and args.strategies else ['dual_ma']
    
    logger.info("=" * 60)
    logger.info(f"Starting {len(strategies_to_run)} strategy node(s)...")
    logger.info(f"Strategies: {', '.join(strategies_to_run)}")
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframe: {args.timeframe}")
    logger.info("=" * 60)
    
    nodes = []
    
    # 启动双均线策略
    if 'dual_ma' in strategies_to_run:
        logger.info("📊 Initializing Dual MA Strategy...")
        dual_ma = DualMAStrategy(
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=args.timeframe,
            fast_period=args.fast_ma,
            slow_period=args.slow_ma
        )
        await dual_ma.start()
        nodes.append(dual_ma)
        logger.info("✅ Dual MA Strategy started")
    
    # 启动MACD策略
    if 'macd' in strategies_to_run:
        logger.info("📈 Initializing MACD Strategy...")
        macd = MACDStrategy(
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=args.timeframe
        )
        await macd.start()
        nodes.append(macd)
        logger.info("✅ MACD Strategy started")
    
    # 启动RSI策略
    if 'rsi' in strategies_to_run:
        logger.info("📉 Initializing RSI Strategy...")
        rsi = RSIStrategy(
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=args.timeframe,
            oversold=30,
            overbought=70
        )
        await rsi.start()
        nodes.append(rsi)
        logger.info("✅ RSI Strategy started")
    
    # 启动布林带策略
    if 'bollinger' in strategies_to_run:
        logger.info("🎯 Initializing Bollinger Bands Strategy...")
        bollinger = BollingerStrategy(
            bus=bus,
            db=db,
            symbols=symbols,
            timeframe=args.timeframe,
            touch_threshold=0.005  # 0.5%
        )
        await bollinger.start()
        nodes.append(bollinger)
        logger.info("✅ Bollinger Bands Strategy started")
    
    if not nodes:
        logger.error("❌ No strategies were started!")
        return
    
    logger.info("=" * 60)
    logger.info(f"✅ All {len(nodes)} strategy node(s) are running")
    logger.info("=" * 60)
    
    # Keep running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, stopping strategies...")
        for node in nodes:
            await node.stop()
        logger.info("All strategies stopped")


async def start_all_nodes(bus: MessageBus, db: Database, args):
    """
    Start all nodes in a single process (not recommended for production)
    
    Args:
        bus: MessageBus instance
        db: Database instance
        args: Command line arguments
    """
    logger.warning(
        "Starting all nodes in single process - "
        "this may be limited by Python GIL. "
        "Use separate processes for production."
    )
    
    # Start all nodes concurrently
    tasks = [
        start_kline_node(bus, db, args),
        start_indicator_node(bus, db, args),
        start_strategy_node(bus, db, args)
    ]
    
    await asyncio.gather(*tasks)


async def main():
    """Main entry point"""
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Quantitative Trading System")
    
    parser.add_argument(
        "--node",
        choices=["kline", "indicator", "strategy", "all", "repair"],
        required=True,
        help="Node type to start (use 'repair' for deep data integrity check)"
    )
    
    parser.add_argument(
        "--symbols",
        default="BTCUSDT",
        help="Comma-separated list of symbols (e.g., BTCUSDT,ETHUSDT)"
    )
    
    parser.add_argument(
        "--timeframes",
        default="1h",
        help="Comma-separated list of timeframes (e.g., 1h,1d)"
    )
    
    parser.add_argument(
        "--timeframe",
        default="1h",
        help="Single timeframe for strategy"
    )
    
    parser.add_argument(
        "--fetch-interval",
        type=int,
        default=settings.kline_fetch_interval,
        help=f"K-line fetch interval in seconds (default: {settings.kline_fetch_interval})"
    )
    
    parser.add_argument(
        "--fast-ma",
        type=int,
        default=5,
        help="Fast MA period for dual MA strategy (default: 5)"
    )
    
    parser.add_argument(
        "--slow-ma",
        type=int,
        default=20,
        help="Slow MA period for dual MA strategy (default: 20)"
    )
    
    parser.add_argument(
        "--strategies",
        nargs='+',
        choices=['dual_ma', 'macd', 'rsi', 'bollinger'],
        help="Strategies to run (default: dual_ma). Can specify multiple: --strategies dual_ma macd rsi"
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Quantitative Trading System")
    logger.info("=" * 60)
    logger.info(f"Node type: {args.node}")
    logger.info(f"Redis: {settings.redis_host}:{settings.redis_port}")
    logger.info(f"Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'localhost'}")
    logger.info("=" * 60)
    
    # Repair node doesn't need Redis (no message bus required)
    if args.node == "repair":
        redis_client = None
        bus = None
    else:
        # Connect to Redis for normal nodes
        logger.info("Connecting to Redis...")
        redis_client = await redis.from_url(
            f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}",
            decode_responses=False
        )
        
        # Test Redis connection
        try:
            await redis_client.ping()
            logger.info("✓ Redis connection successful")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Redis: {e}")
            sys.exit(1)
        
        # Create message bus
        bus = MessageBus(redis_client)
    
    # Connect to database
    logger.info("Connecting to database...")
    db = Database(settings.database_url)
    
    # Create tables if they don't exist
    try:
        await db.create_tables()
        logger.info("✓ Database tables ready")
    except Exception as e:
        logger.error(f"✗ Failed to create database tables: {e}")
        sys.exit(1)
    
    # Check and repair data integrity (if enabled)
    if settings.auto_repair_data and args.node in ["kline", "indicator", "all"]:
        logger.info("")
        logger.info("🔍 Running quick data integrity check...")
        logger.info(f"   Checking last {settings.repair_hours_back_on_startup} hour(s)")
        
        try:
            from app.services.data_integrity import DataIntegrityService
            
            # Initialize exchange for repair
            proxy_config = None
            if settings.proxy_enabled:
                proxy_config = {
                    'enabled': settings.proxy_enabled,
                    'host': settings.proxy_host,
                    'port': settings.proxy_port,
                    'username': settings.proxy_username,
                    'password': settings.proxy_password
                }
            
            exchange = BinanceExchange(
                api_key=settings.binance_api_key or "",
                api_secret=settings.binance_api_secret or "",
                proxy_config=proxy_config,
                market_type=settings.market_type
            )
            
            service = DataIntegrityService(db, exchange)
            
            # Get symbols and timeframes from args
            symbols = args.symbols.split(",")
            timeframes = args.timeframes.split(",")
            
            # 根据节点类型决定修复什么数据
            repair_kline = args.node in ["kline", "all"]
            repair_indicator = args.node in ["indicator", "all"]
            
            # Run quick repair (只检查最近几小时)
            # K线按时间，指标按数量（固定模式）
            hours_back = settings.repair_hours_back_on_startup
            
            await service.check_and_repair_all(
                symbols=symbols,
                timeframes=timeframes,
                days_back=hours_back / 24,          # K线：按时间（快速检查）
                klines_count=settings.repair_klines_count,  # 指标：按数量
                auto_fix=True,
                market_type=settings.market_type,
                repair_kline=repair_kline,
                repair_indicator=repair_indicator
            )
            
            await exchange.close()
            
        except Exception as e:
            logger.warning(f"⚠️  Data integrity check failed: {e}")
            logger.info("Continuing with node startup...")
        
        logger.info("")
    
    # Handle repair node (runs once and exits)
    if args.node == "repair":
        logger.info("")
        logger.info("🔧 Running DEEP data integrity repair...")
        logger.info(f"   Checking last {settings.repair_days_back} day(s)")
        
        try:
            from app.services.data_integrity import DataIntegrityService
            
            # Initialize exchange for repair
            proxy_config = None
            if settings.proxy_enabled:
                proxy_config = {
                    'enabled': settings.proxy_enabled,
                    'host': settings.proxy_host,
                    'port': settings.proxy_port,
                    'username': settings.proxy_username,
                    'password': settings.proxy_password
                }
            
            exchange = BinanceExchange(
                api_key=settings.binance_api_key or "",
                api_secret=settings.binance_api_secret or "",
                proxy_config=proxy_config,
                market_type=settings.market_type
            )
            
            service = DataIntegrityService(db, exchange)
            
            # Get symbols and timeframes from args
            symbols = args.symbols.split(",")
            timeframes = args.timeframes.split(",")
            
            # Deep repair: 固定模式
            # - K线修复：固定按时间（确保时间连续性）
            # - 指标修复：固定按数量（统一样本量）
            await service.check_and_repair_all(
                symbols=symbols,
                timeframes=timeframes,
                days_back=settings.repair_days_back,      # K线：固定按时间
                klines_count=settings.repair_klines_count, # 指标：固定按数量
                auto_fix=True,
                market_type=settings.market_type,
                repair_kline=True,
                repair_indicator=True
            )
            
            await exchange.close()
            
            logger.info("")
            logger.info("✅ Deep repair completed!")
            logger.info("")
            
        except Exception as e:
            logger.error(f"❌ Deep repair failed: {e}", exc_info=True)
            sys.exit(1)
        
        finally:
            # Cleanup and exit
            if bus:
                await bus.close()
            await db.close()
            logger.info("Repair node exiting...")
        
        return  # Exit after repair
    
    # Start appropriate node
    try:
        if args.node == "kline":
            await start_kline_node(bus, db, args)
        elif args.node == "indicator":
            await start_indicator_node(bus, db, args)
        elif args.node == "strategy":
            await start_strategy_node(bus, db, args)
        elif args.node == "all":
            await start_all_nodes(bus, db, args)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Error running node: {e}", exc_info=True)
    finally:
        # Cleanup
        logger.info("Cleaning up...")
        if bus:
            await bus.close()
        await db.close()
        logger.info("Shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting...")

