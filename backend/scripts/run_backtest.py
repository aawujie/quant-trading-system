#!/usr/bin/env python3
"""
回测CLI工具

使用方法:
    python -m scripts.run_backtest --strategy rsi --symbols BTCUSDT --start 2024-01-01 --end 2024-02-01

示例:
    # 基本回测
    python -m scripts.run_backtest \\
        --strategy rsi \\
        --symbols BTCUSDT ETHUSDT \\
        --timeframe 1h \\
        --start 2024-01-01 \\
        --end 2024-02-01 \\
        --balance 10000

    # 带自定义参数的回测
    python -m scripts.run_backtest \\
        --strategy rsi \\
        --symbols BTCUSDT \\
        --timeframe 1h \\
        --start 2024-01-01 \\
        --end 2024-02-01 \\
        --balance 10000 \\
        --position-manager moderate \\
        --rsi-oversold 25 \\
        --rsi-overbought 75
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core.database import Database
from app.core.data_source import BacktestDataSource
from app.core.trading_engine import TradingEngine
from app.core.position_manager import PositionManagerFactory
from app.core.message_bus import MessageBus


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='运行策略回测',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # 基本参数
    parser.add_argument(
        '--strategy',
        required=True,
        choices=['rsi', 'dual_ma', 'macd', 'bollinger'],
        help='策略名称'
    )
    parser.add_argument(
        '--symbols',
        nargs='+',
        default=['BTCUSDT'],
        help='交易对列表（空格分隔）'
    )
    parser.add_argument(
        '--timeframe',
        default='1h',
        help='时间周期（1m/5m/15m/1h/4h/1d）'
    )
    parser.add_argument(
        '--start',
        required=True,
        help='开始日期（YYYY-MM-DD）'
    )
    parser.add_argument(
        '--end',
        required=True,
        help='结束日期（YYYY-MM-DD）'
    )
    parser.add_argument(
        '--balance',
        type=float,
        default=10000,
        help='初始资金（USDT）'
    )
    parser.add_argument(
        '--market-type',
        default='spot',
        choices=['spot', 'future', 'delivery'],
        help='市场类型'
    )
    
    # 仓位管理参数
    parser.add_argument(
        '--position-manager',
        choices=['conservative', 'moderate', 'aggressive'],
        default='moderate',
        help='仓位管理类型'
    )
    
    # RSI策略参数
    parser.add_argument('--rsi-oversold', type=int, default=30, help='RSI超卖阈值')
    parser.add_argument('--rsi-overbought', type=int, default=70, help='RSI超买阈值')
    
    # 双均线策略参数
    parser.add_argument('--ma-fast', type=int, default=5, help='快速均线周期')
    parser.add_argument('--ma-slow', type=int, default=20, help='慢速均线周期')
    
    # MACD策略参数
    parser.add_argument('--macd-fast', type=int, default=12, help='MACD快线周期')
    parser.add_argument('--macd-slow', type=int, default=26, help='MACD慢线周期')
    parser.add_argument('--macd-signal', type=int, default=9, help='MACD信号线周期')
    
    # AI增强
    parser.add_argument(
        '--enable-ai',
        action='store_true',
        help='启用AI增强'
    )
    
    # 数据库
    parser.add_argument(
        '--database-url',
        default=os.getenv('DATABASE_URL'),
        help='数据库URL（默认从环境变量读取）'
    )
    
    args = parser.parse_args()
    
    # 验证参数
    if not args.database_url:
        print("错误：未设置DATABASE_URL环境变量")
        return 1
    
    # 转换日期
    try:
        start_time = int(datetime.strptime(args.start, '%Y-%m-%d').timestamp())
        end_time = int(datetime.strptime(args.end, '%Y-%m-%d').timestamp())
    except ValueError as e:
        print(f"错误：日期格式错误 - {e}")
        return 1
    
    # 打印回测配置
    print("\n" + "="*70)
    print("🚀 回测配置")
    print("="*70)
    print(f"策略:        {args.strategy}")
    print(f"交易对:      {', '.join(args.symbols)}")
    print(f"时间周期:    {args.timeframe}")
    print(f"时间范围:    {args.start} ~ {args.end}")
    print(f"初始资金:    ${args.balance:,.2f}")
    print(f"仓位管理:    {args.position_manager}")
    print(f"市场类型:    {args.market_type}")
    print(f"AI增强:      {'是' if args.enable_ai else '否'}")
    
    if args.strategy == 'rsi':
        print(f"RSI超卖:     {args.rsi_oversold}")
        print(f"RSI超买:     {args.rsi_overbought}")
    elif args.strategy == 'dual_ma':
        print(f"快速均线:    MA{args.ma_fast}")
        print(f"慢速均线:    MA{args.ma_slow}")
    
    print("="*70 + "\n")
    
    # 初始化数据库
    print("📊 连接数据库...")
    db = Database(args.database_url)
    await db.create_tables()
    
    # 创建MessageBus
    bus = MessageBus()
    
    # 创建策略实例
    print(f"⚙️  初始化策略: {args.strategy}...")
    
    if args.strategy == 'rsi':
        from app.nodes.strategies.rsi_strategy import RSIStrategy
        strategy = RSIStrategy(
            bus=bus,
            db=db,
            symbols=args.symbols,
            timeframe=args.timeframe,
            oversold=args.rsi_oversold,
            overbought=args.rsi_overbought,
            enable_ai_enhancement=args.enable_ai
        )
    elif args.strategy == 'dual_ma':
        from app.nodes.strategies.dual_ma_strategy import DualMAStrategy
        strategy = DualMAStrategy(
            bus=bus,
            db=db,
            symbols=args.symbols,
            timeframe=args.timeframe,
            fast_period=args.ma_fast,
            slow_period=args.ma_slow,
            enable_ai_enhancement=args.enable_ai
        )
    elif args.strategy == 'macd':
        from app.nodes.strategies.macd_strategy import MACDStrategy
        strategy = MACDStrategy(
            bus=bus,
            db=db,
            symbols=args.symbols,
            timeframe=args.timeframe,
            fast_period=args.macd_fast,
            slow_period=args.macd_slow,
            signal_period=args.macd_signal,
            enable_ai_enhancement=args.enable_ai
        )
    elif args.strategy == 'bollinger':
        from app.nodes.strategies.bollinger_strategy import BollingerStrategy
        strategy = BollingerStrategy(
            bus=bus,
            db=db,
            symbols=args.symbols,
            timeframe=args.timeframe,
            enable_ai_enhancement=args.enable_ai
        )
    else:
        print(f"错误：不支持的策略 - {args.strategy}")
        return 1
    
    # 创建仓位管理器
    print(f"💰 创建仓位管理器: {args.position_manager}...")
    pm_factory = getattr(PositionManagerFactory, f'create_{args.position_manager}')
    position_manager = pm_factory(args.balance)
    
    # 创建数据源
    print(f"📈 加载历史数据...")
    data_source = BacktestDataSource(
        db=db,
        start_time=start_time,
        end_time=end_time,
        market_type=args.market_type
    )
    
    # 创建交易引擎
    engine = TradingEngine(
        data_source=data_source,
        strategy=strategy,
        position_manager=position_manager,
        mode="backtest"
    )
    
    # 运行回测
    print(f"🔄 开始回测...\n")
    
    try:
        await engine.run()
        print("\n✅ 回测完成！")
        return 0
    
    except Exception as e:
        print(f"\n❌ 回测失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    finally:
        await db.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

