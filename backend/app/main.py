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
        proxy_config=proxy_config
    )
    
    # Parse symbols and timeframes
    symbols = args.symbols.split(",")
    timeframes = args.timeframes.split(",")
    
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframes: {timeframes}")
    
    # Create and start node
    node = KlineNode(
        bus=bus,
        exchange=exchange,
        db=db,
        symbols=symbols,
        timeframes=timeframes,
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
    
    # Create and start node
    node = IndicatorNode(
        bus=bus,
        db=db,
        symbols=symbols,
        timeframes=timeframes,
        lookback_periods=args.lookback
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
    Start trading strategy node
    
    Args:
        bus: MessageBus instance
        db: Database instance
        args: Command line arguments
    """
    from app.nodes.strategy_node import DualMAStrategyNode
    
    logger.info("Starting dual MA strategy node...")
    
    # Parse symbols
    symbols = args.symbols.split(",")
    
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframe: {args.timeframe}")
    
    # Create and start node
    node = DualMAStrategyNode(
        bus=bus,
        db=db,
        symbols=symbols,
        timeframe=args.timeframe,
        fast_period=args.fast_ma,
        slow_period=args.slow_ma
    )
    
    await node.start()
    
    # Keep running
    try:
        while node.is_running:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        await node.stop()


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
        choices=["kline", "indicator", "strategy", "all"],
        required=True,
        help="Node type to start"
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
        "--lookback",
        type=int,
        default=200,
        help="Number of historical periods for indicators (default: 200)"
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
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Quantitative Trading System")
    logger.info("=" * 60)
    logger.info(f"Node type: {args.node}")
    logger.info(f"Redis: {settings.redis_host}:{settings.redis_port}")
    logger.info(f"Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'localhost'}")
    logger.info("=" * 60)
    
    # Connect to Redis
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
        await bus.close()
        await db.close()
        logger.info("Shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting...")

