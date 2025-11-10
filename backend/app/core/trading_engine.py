"""Unified Trading Engine for live and backtest modes"""

import asyncio
import logging
from typing import Literal, Dict, List
from datetime import datetime

from app.core.data_source import DataSource
from app.core.position_manager import PositionManager
from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.signals import SignalData

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
        mode: Literal["live", "backtest"] = "live"
    ):
        """
        Args:
            data_source: 数据源（LiveDataSource或BacktestDataSource）
            strategy: 策略实例
            position_manager: 仓位管理器
            mode: 运行模式（live/backtest）
        """
        self.data_source = data_source
        self.strategy = strategy
        self.position_manager = position_manager
        self.mode = mode
        
        # 回测结果
        self.trades: List[Dict] = []
        self.equity_curve: List[Dict] = []
        
        # 订阅策略的信号输出
        if mode == "backtest":
            # 回测模式：同步处理信号
            for symbol in strategy.symbols:
                signal_topic = f"signal:{strategy.strategy_name}:{symbol}"
                asyncio.create_task(
                    strategy.bus.subscribe(signal_topic, self._handle_signal)
                )
        
        logger.info(
            f"TradingEngine initialized: mode={mode}, "
            f"strategy={strategy.strategy_name}, "
            f"symbols={len(strategy.symbols)}"
        )
    
    async def run(self):
        """启动交易引擎"""
        logger.info(f"Starting trading engine in {self.mode} mode...")
        
        try:
            # 获取数据流
            data_stream = self.data_source.get_data_stream(
                symbols=self.strategy.symbols,
                timeframe=self.strategy.timeframe
            )
            
            # 处理数据流
            async for topic, data in data_stream:
                await self._process_data(topic, data)
            
            # 回测结束：打印结果
            if self.mode == "backtest":
                self._print_backtest_results()
        
        except Exception as e:
            logger.error(f"Trading engine error: {e}", exc_info=True)
            raise
        
        finally:
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
    
    async def _handle_signal(self, topic: str, signal_data: dict):
        """
        处理交易信号
        
        实盘：发送到交易所
        回测：模拟执行
        """
        try:
            signal = SignalData(**signal_data)
            symbol = signal.symbol
            
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
                    if self.mode == "live":
                        await self._execute_live_order(signal, order_info)
                    else:
                        self._simulate_order(signal, order_info)
                    
                    self.position_manager.open_position(symbol, order_info, signal)
            
            elif signal.action == "CLOSE":
                # 平仓
                if symbol in self.position_manager.positions:
                    if self.mode == "live":
                        await self._execute_live_close(signal)
                    else:
                        self._simulate_close(signal)
                    
                    trade_result = self.position_manager.close_position(symbol, signal.price)
                    
                    if self.mode == "backtest" and trade_result:
                        # 记录交易
                        self.trades.append({
                            'symbol': symbol,
                            'side': self.position_manager.positions.get(symbol, {}).get('side', 'UNKNOWN'),
                            'entry_time': trade_result.get('entry_time'),
                            'exit_time': signal.timestamp,
                            **trade_result
                        })
        
        except Exception as e:
            logger.error(f"Error handling signal: {e}", exc_info=True)
    
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
        return {
            'mode': self.mode,
            'strategy': self.strategy.strategy_name,
            'symbols': self.strategy.symbols,
            'timeframe': self.strategy.timeframe,
            'statistics': self._calculate_statistics(),
            'account_status': self.position_manager.get_account_status(),
            'trades': self.trades,
            'equity_curve': self.equity_curve
        }

