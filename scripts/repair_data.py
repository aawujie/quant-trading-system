#!/usr/bin/env python3
"""
数据修复工具
用于检测和修复K线和指标数据的缺失
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Database
from app.exchanges.binance import BinanceExchange
from app.services.data_integrity import DataIntegrityService
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)


async def main():
    """Main entry point"""
    
    parser = argparse.ArgumentParser(
        description="Data Integrity Repair Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check only (no repair)
  python repair_data.py --check-only

  # Repair last 7 days
  python repair_data.py --days 7

  # Repair specific symbols
  python repair_data.py --symbols BTCUSDT,ETHUSDT --timeframes 1h,4h --days 30

  # Repair spot market
  python repair_data.py --market spot
        """
    )
    
    parser.add_argument(
        '--symbols',
        default='BTCUSDT,ETHUSDT',
        help='Comma-separated symbols (default: BTCUSDT,ETHUSDT)'
    )
    
    parser.add_argument(
        '--timeframes',
        default='1h',
        help='Comma-separated timeframes (default: 1h)'
    )
    
    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Check last N days (default: 30)'
    )
    
    parser.add_argument(
        '--market',
        default='future',
        choices=['spot', 'future', 'delivery'],
        help='Market type (default: future)'
    )
    
    parser.add_argument(
        '--check-only',
        action='store_true',
        help='Only check for gaps, do not repair'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Set log level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Parse arguments
    symbols = [s.strip() for s in args.symbols.split(',')]
    timeframes = [t.strip() for t in args.timeframes.split(',')]
    
    logger.info("Data Repair Tool")
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Timeframes: {timeframes}")
    logger.info(f"Days back: {args.days}")
    logger.info(f"Market type: {args.market}")
    logger.info(f"Mode: {'Check Only' if args.check_only else 'Check & Repair'}")
    logger.info("")
    
    # Initialize database
    logger.info("Connecting to database...")
    db = Database()
    await db.connect()
    logger.info("✅ Database connected")
    
    # Initialize exchange
    logger.info("Initializing exchange...")
    exchange = BinanceExchange(
        api_key=settings.binance_api_key or "",
        api_secret=settings.binance_api_secret or "",
        market_type=args.market
    )
    logger.info("✅ Exchange initialized")
    logger.info("")
    
    # Create service
    service = DataIntegrityService(db, exchange)
    
    try:
        # Run check and repair
        await service.check_and_repair_all(
            symbols=symbols,
            timeframes=timeframes,
            days_back=args.days,
            auto_fix=not args.check_only,
            market_type=args.market
        )
        
        logger.info("✅ Data repair completed successfully")
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Error during repair: {e}", exc_info=True)
        return 1
    finally:
        # Cleanup
        await exchange.close()
        await db.close()
        logger.info("Connections closed")
    
    return 0


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

