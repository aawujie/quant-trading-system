#!/usr/bin/env python3
"""
定时数据修复任务
用于 crontab 定时执行
"""

import asyncio
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Database
from app.exchanges.binance import BinanceExchange
from app.services.data_integrity import DataIntegrityService
from app.config import settings

# Configure logging to file
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_dir / 'repair.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


async def daily_repair():
    """每日定时修复任务"""
    
    logger.info("=" * 80)
    logger.info(f"Daily Data Repair Task Started at {datetime.now()}")
    logger.info("=" * 80)
    
    # 配置
    symbols = ['BTCUSDT', 'ETHUSDT']
    timeframes = ['1h', '4h', '1d']
    days_back = 7  # 只检查最近7天
    market_type = 'future'
    
    # Initialize
    db = Database()
    await db.connect()
    
    exchange = BinanceExchange(
        api_key=settings.binance_api_key or "",
        api_secret=settings.binance_api_secret or "",
        market_type=market_type
    )
    
    service = DataIntegrityService(db, exchange)
    
    try:
        # 执行修复
        await service.check_and_repair_all(
            symbols=symbols,
            timeframes=timeframes,
            days_back=days_back,
            auto_fix=True,
            market_type=market_type
        )
        
        logger.info("✅ Daily repair task completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Daily repair task failed: {e}", exc_info=True)
        return 1
    finally:
        await exchange.close()
        await db.close()
    
    logger.info("=" * 80)
    logger.info("")
    
    return 0


if __name__ == '__main__':
    exit_code = asyncio.run(daily_repair())
    sys.exit(exit_code)

