"""Unified Trading Engine for live and backtest modes"""

import asyncio
import logging
from typing import Literal, Dict, List, Optional
from datetime import datetime

from app.core.data_source import DataSource
from app.core.position_manager import PositionManager
from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.signals import SignalData
from app.core.progress_tracker import ProgressTracker

logger = logging.getLogger(__name__)


class TradingEngine:
    """
    统一交易引擎
    
    支持：
    1. 实盘模式（live）- 实时交易
    2. 回测模式（backtest）- 历史数据回测
    
    核心功能：
    - 统一的数据处理流程
    - 信号处理和仓位管理
    - 交易记录和统计
    """
    
    def __init__(
        self,
        data_source: DataSource,
        strategy: BaseStrategy,
        position_manager: PositionManager,
        mode: Literal["live", "backtest"] = "live",
        progress_tracker: Optional[ProgressTracker] = None
    ):
        """
        Args:
            data_source: 数据源（LiveDataSource或BacktestDataSource）
            strategy: 策略实例
            position_manager: 仓位管理器
            mode: 运行模式（live/backtest）
            progress_tracker: 进度跟踪器（可选，用于回测进度报告）
        """
        self.data_source = data_source
        self.strategy = strategy
        self.position_manager = position_manager
        self.mode = mode
        self.progress_tracker = progress_tracker
        
        # 回测结果
        self.trades: List[Dict] = []  # 完整交易记录（开仓到平仓）
        self.signals: List[Dict] = []  # 所有信号记录（用于前端展示）
        self.equity_curve: List[Dict] = []
        
        # 回测模式：注入直接信号处理器，避免 Redis 开销
        if mode == "backtest":
            strategy._direct_signal_handler = self._handle_signal_direct
            logger.info("Backtest mode: Using direct signal handler (bypassing Redis)")
        
        logger.info(
            f"TradingEngine initialized: mode={mode}, "
            f"strategy={strategy.strategy_name}, "
            f"symbols={len(strategy.symbols)}"
        )
    
    async def run(self):
        """启动交易引擎"""
        logger.info(f"Starting trading engine in {self.mode} mode...")
        
        # 实盘模式：创建 Redis 订阅任务
        subscription_tasks = []
        if self.mode == "live":
            for symbol in self.strategy.symbols:
                signal_topic = f"signal:{self.strategy.strategy_name}:{symbol}"
                task = asyncio.create_task(
                    self.strategy.bus.subscribe(signal_topic, self._handle_signal)
                )
                subscription_tasks.append(task)
                logger.info(f"[LIVE] Created subscription task for: {signal_topic}")
        else:
            logger.info("[BACKTEST] Using direct signal handler, no Redis subscription needed")
        
        try:
            # 获取数据流
            data_stream = self.data_source.get_data_stream(
                symbols=self.strategy.symbols,
                timeframe=self.strategy.timeframe
            )
            
            # 处理数据流（带进度跟踪）
            async for topic, data in data_stream:
                await self._process_data(topic, data)
                
                # 更新进度（仅回测模式）
                if self.mode == "backtest" and self.progress_tracker:
                    # 每处理一条数据就尝试更新（ProgressTracker会自动节流）
                    self.progress_tracker.update(items=1)
            
            # 回测结束：打印结果
            if self.mode == "backtest":
                self._print_backtest_results()
        
        except Exception as e:
            logger.error(f"Trading engine error: {e}", exc_info=True)
            raise
        
        finally:
            # 取消所有订阅任务（仅实盘模式）
            for task in subscription_tasks:
                task.cancel()
            # 等待任务完成（忽略CancelledError）
            if subscription_tasks:
                await asyncio.gather(*subscription_tasks, return_exceptions=True)
            
            await self.data_source.close()
            logger.info("Trading engine stopped")
    
    async def _process_data(self, topic: str, data: dict):
        """
        处理单条数据
        
        将数据传递给策略处理
        """
        try:
            await self.strategy.process(topic, data)
            
            # 回测模式：记录权益曲线
            if self.mode == "backtest" and topic.startswith("kline"):
                self._record_equity(data['timestamp'])
        
        except Exception as e:
            logger.error(f"Error processing data from {topic}: {e}")
    
    async def _handle_signal_direct(self, signal: SignalData):
        """
        直接处理交易信号（回测模式专用，无需 Redis）
        
        Args:
            signal: SignalData 对象（而不是 dict）
        """
        try:
            symbol = signal.symbol
            
            logger.info(
                f"[BACKTEST] Processing signal: {signal.action} {signal.side} "
                f"for {symbol} @ ${signal.price:.2f} - {signal.reason}"
            )
            
            kline = self.strategy.state[symbol]["kline"]
            indicator = self.strategy.state[symbol]["indicator"]
            
            if not kline or not indicator:
                logger.warning(f"Incomplete state for {symbol}, skipping signal")
                return
            
            if signal.action == "OPEN":
                # 开仓
                order_info = self.position_manager.calculate_order_size(
                    signal, kline, indicator
                )
                
                if order_info:
                    self._simulate_order(signal, order_info)
                    self.position_manager.open_position(symbol, order_info, signal)
                    
                    # 记录信号（用于前端展示）
                    self.signals.append({
                        'timestamp': signal.timestamp,
                        'symbol': symbol,
                        'side': signal.side,
                        'action': signal.action,
                        'signal_type': signal.signal_type.value,
                        'price': signal.price,
                        'quantity': order_info.get('quantity', 0),
                        'reason': signal.reason,
                        'confidence': signal.confidence,
                        'stop_loss': signal.stop_loss,
                        'take_profit': signal.take_profit
                    })
            
            elif signal.action == "CLOSE":
                # 平仓
                if symbol in self.position_manager.positions:
                    position = self.position_manager.positions[symbol]
                    self._simulate_close(signal)
                    trade_result = self.position_manager.close_position(symbol, signal.price)
                    
                    if trade_result:
                        # 记录完整交易
                        self.trades.append({
                            'symbol': symbol,
                            'side': trade_result.get('side', 'UNKNOWN'),
                            'entry_time': trade_result.get('entry_time'),
                            'exit_time': signal.timestamp,
                            **trade_result
                        })
                        
                        # 记录平仓信号（用于前端展示）
                        self.signals.append({
                            'timestamp': signal.timestamp,
                            'symbol': symbol,
                            'side': signal.side,
                            'action': signal.action,
                            'signal_type': signal.signal_type.value,
                            'price': signal.price,
                            'quantity': position.get('quantity', 0),
                            'reason': signal.reason,
                            'confidence': None,
                            'pnl': trade_result.get('pnl'),
                            'pnl_pct': trade_result.get('pnl_pct')
                        })
        
        except Exception as e:
            logger.error(f"Error handling signal directly: {e}", exc_info=True)
    
    async def _handle_signal(self, topic: str, signal_data: dict):
        """
        处理交易信号（实盘模式，从 Redis 接收）
        
        实盘：发送到交易所
        """
        try:
            logger.info(f"[LIVE] Received signal on topic: {topic}")
            signal = SignalData(**signal_data)
            symbol = signal.symbol
            
            logger.info(
                f"[LIVE] Processing signal: {signal.action} {signal.side} "
                f"for {symbol} @ ${signal.price:.2f}"
            )
            
            kline = self.strategy.state[symbol]["kline"]
            indicator = self.strategy.state[symbol]["indicator"]
            
            if not kline or not indicator:
                logger.warning(f"Incomplete state for {symbol}, skipping signal")
                return
            
            if signal.action == "OPEN":
                # 开仓
                order_info = self.position_manager.calculate_order_size(
                    signal, kline, indicator
                )
                
                if order_info:
                    await self._execute_live_order(signal, order_info)
                    self.position_manager.open_position(symbol, order_info, signal)
            
            elif signal.action == "CLOSE":
                # 平仓
                if symbol in self.position_manager.positions:
                    await self._execute_live_close(signal)
                    self.position_manager.close_position(symbol, signal.price)
        
        except Exception as e:
            logger.error(f"Error handling signal from Redis: {e}", exc_info=True)
    
    def _simulate_order(self, signal: SignalData, order_info: dict):
        """回测模拟开仓"""
        logger.info(
            f"[BACKTEST] Open {signal.side}: {signal.symbol} "
            f"qty={order_info['quantity']:.6f} @ ${signal.price:.2f} "
            f"(${order_info['usdt_amount']:.2f})"
        )
    
    def _simulate_close(self, signal: SignalData):
        """回测模拟平仓"""
        logger.info(
            f"[BACKTEST] Close {signal.side}: {signal.symbol} @ ${signal.price:.2f} "
            f"- {signal.reason}"
        )
    
    async def _execute_live_order(self, signal: SignalData, order_info: dict):
        """实盘执行开仓（需要交易所API）"""
        logger.warning(
            f"[LIVE] Order execution not implemented: {signal.symbol} {signal.side}"
        )
        # TODO: 集成交易所API
        pass
    
    async def _execute_live_close(self, signal: SignalData):
        """实盘执行平仓（需要交易所API）"""
        logger.warning(
            f"[LIVE] Close execution not implemented: {signal.symbol}"
        )
        # TODO: 集成交易所API
        pass
    
    def _record_equity(self, timestamp: int):
        """记录权益曲线"""
        account_status = self.position_manager.get_account_status()
        self.equity_curve.append({
            'timestamp': timestamp,
            'balance': account_status['current_balance'],
            'pnl': account_status['total_pnl'],
            'pnl_pct': account_status['total_pnl_pct']
        })
    
    def _print_backtest_results(self):
        """打印回测结果"""
        if self.mode != "backtest":
            return
        
        stats = self._calculate_statistics()
        account_status = self.position_manager.get_account_status()
        
        print("\n" + "="*70)
        print("📊 回测结果")
        print("="*70)
        print(f"策略名称:    {self.strategy.strategy_name}")
        print(f"交易对:      {', '.join(self.strategy.symbols)}")
        print(f"时间周期:    {self.strategy.timeframe}")
        print("-"*70)
        print(f"初始资金:    ${account_status['initial_balance']:,.2f}")
        print(f"最终资金:    ${account_status['current_balance']:,.2f}")
        print(f"总盈亏:      ${account_status['total_pnl']:,.2f} ({account_status['total_pnl_pct']*100:.2f}%)")
        print("-"*70)
        print(f"总交易数:    {stats.get('total_trades', 0)}")
        print(f"盈利交易:    {stats.get('winning_trades', 0)}")
        print(f"亏损交易:    {stats.get('losing_trades', 0)}")
        print(f"胜率:        {stats.get('win_rate', 0)*100:.2f}%")
        print(f"平均盈利:    ${stats.get('avg_win', 0):.2f}")
        print(f"平均亏损:    ${stats.get('avg_loss', 0):.2f}")
        print(f"盈亏比:      {stats.get('win_loss_ratio', 0):.2f}")
        print("-"*70)
        print(f"最大单笔盈利: ${stats.get('max_win', 0):.2f}")
        print(f"最大单笔亏损: ${stats.get('max_loss', 0):.2f}")
        print(f"最大回撤:     {stats.get('max_drawdown', 0)*100:.2f}%")
        print(f"夏普比率:     {stats.get('sharpe_ratio', 0):.2f}")
        print("="*70 + "\n")
    
    def _calculate_statistics(self) -> dict:
        """计算回测统计"""
        if not self.trades:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'win_loss_ratio': 0,
                'max_win': 0,
                'max_loss': 0,
                'max_drawdown': 0,
                'sharpe_ratio': 0
            }
        
        winning_trades = [t for t in self.trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in self.trades if t.get('pnl', 0) <= 0]
        
        win_rate = len(winning_trades) / len(self.trades) if self.trades else 0
        avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        max_win = max((t.get('pnl', 0) for t in self.trades), default=0)
        max_loss = min((t.get('pnl', 0) for t in self.trades), default=0)
        
        # 计算最大回撤
        max_drawdown = self._calculate_max_drawdown()
        
        # 计算夏普比率（简化版）
        sharpe_ratio = self._calculate_sharpe_ratio()
        
        return {
            'total_trades': len(self.trades),
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'win_loss_ratio': abs(avg_win / avg_loss) if avg_loss != 0 else 0,
            'max_win': max_win,
            'max_loss': max_loss,
            'max_drawdown': max_drawdown,
            'sharpe_ratio': sharpe_ratio
        }
    
    def _calculate_max_drawdown(self) -> float:
        """计算最大回撤"""
        if not self.equity_curve:
            return 0.0
        
        peak = self.equity_curve[0]['balance']
        max_dd = 0.0
        
        for point in self.equity_curve:
            balance = point['balance']
            if balance > peak:
                peak = balance
            
            drawdown = (peak - balance) / peak if peak > 0 else 0
            max_dd = max(max_dd, drawdown)
        
        return max_dd
    
    def _calculate_sharpe_ratio(self) -> float:
        """计算夏普比率（简化版）"""
        if len(self.trades) < 2:
            return 0.0
        
        returns = [t.get('pnl_pct', 0) for t in self.trades]
        
        avg_return = sum(returns) / len(returns)
        std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
        
        if std_return == 0:
            return 0.0
        
        # 假设无风险利率为0
        sharpe = avg_return / std_return
        
        # 年化（假设每天交易）
        sharpe_annualized = sharpe * (252 ** 0.5)
        
        return sharpe_annualized
    
    def get_results(self) -> dict:
        """获取回测结果（用于API返回）"""
        statistics = self._calculate_statistics()
        account_status = self.position_manager.get_account_status()
        
        # 计算盈利因子
        winning_trades = [t for t in self.trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in self.trades if t.get('pnl', 0) < 0]
        total_profit = sum(t.get('pnl', 0) for t in winning_trades)
        total_loss = abs(sum(t.get('pnl', 0) for t in losing_trades))
        profit_factor = total_profit / total_loss if total_loss > 0 else 0
        
        # 计算仓位相关统计
        if self.trades:
            # 平均持仓时间（小时）
            avg_holding_time = sum(
                (t.get('exit_time', 0) - t.get('entry_time', 0)) / 3600 
                for t in self.trades
            ) / len(self.trades) if self.trades else 0
            
            # 最大持仓金额占比
            max_position_pct = self.position_manager.single_position_max_pct
            
            # 平均单笔投入（从信号中计算开仓金额）
            open_signals = [s for s in self.signals if s.get('action') == 'OPEN']
            avg_position_size = sum(
                s.get('price', 0) * s.get('quantity', 0) 
                for s in open_signals
            ) / len(open_signals) if open_signals else 0
        else:
            avg_holding_time = 0
            max_position_pct = 0
            avg_position_size = 0
        
        return {
            'mode': self.mode,
            'strategy': self.strategy.strategy_name,
            'symbols': self.strategy.symbols,
            'timeframe': self.strategy.timeframe,
            
            # 顶层字段（方便前端直接访问）
            'total_return': account_status['total_pnl_pct'],
            'sharpe_ratio': statistics['sharpe_ratio'],
            'max_drawdown': statistics['max_drawdown'],
            'win_rate': statistics['win_rate'],
            'total_trades': statistics['total_trades'],
            'profit_factor': profit_factor,
            
            # 仓位管理信息
            'initial_balance': account_status['initial_balance'],
            'final_balance': account_status['current_balance'],
            'avg_holding_time': avg_holding_time,  # 小时
            'max_position_pct': max_position_pct,  # 单笔最大仓位占比
            'avg_position_size': avg_position_size,  # 平均单笔投入
            
            # 详细统计（兼容性保留）
            'statistics': statistics,
            'account_status': account_status,
            
            # 数据记录
            'trades': self.trades,  # 完整交易记录（用于统计分析）
            'signals': self.signals,  # 所有信号记录（用于前端展示）
            'equity_curve': self.equity_curve
        }
    
    def save_results_to_file(self, output_dir: str = "backtest_results") -> str:
        """
        保存回测结果到文件
        
        Args:
            output_dir: 输出目录
            
        Returns:
            保存的文件路径
        """
        import os
        import json
        from datetime import datetime
        
        # 创建输出目录
        os.makedirs(output_dir, exist_ok=True)
        
        # 生成文件名：策略_交易对_时间周期_时间戳.json
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        symbols_str = "_".join(self.strategy.symbols)
        filename = f"{self.strategy.strategy_name}_{symbols_str}_{self.strategy.timeframe}_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        # 获取结果
        results = self.get_results()
        
        # 添加元数据
        results['metadata'] = {
            'generated_at': datetime.now().isoformat(),
            'total_signals': len(self.signals),
            'total_trades': len(self.trades),
            'backtest_duration_seconds': None,  # 可以记录运行时间
        }
        
        # 保存为 JSON
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Backtest results saved to: {filepath}")
        return filepath

