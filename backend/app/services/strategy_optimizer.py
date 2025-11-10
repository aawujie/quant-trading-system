"""Strategy parameter optimizer using Optuna"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Callable
import optuna
from optuna.trial import Trial

from app.core.database import Database
from app.core.data_source import BacktestDataSource
from app.core.trading_engine import TradingEngine
from app.core.position_manager import PositionManagerFactory
from app.core.message_bus import MessageBus

logger = logging.getLogger(__name__)


class StrategyOptimizer:
    """
    策略参数优化器
    
    使用Optuna自动搜索最优参数组合
    """
    
    def __init__(
        self,
        db: Database,
        symbols: List[str],
        timeframe: str,
        market_type: str = 'spot'
    ):
        """
        Args:
            db: Database实例
            symbols: 交易对列表
            timeframe: 时间周期
            market_type: 市场类型
        """
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
        self.market_type = market_type
        
        logger.info(
            f"StrategyOptimizer initialized: symbols={symbols}, "
            f"timeframe={timeframe}, market={market_type}"
        )
    
    async def optimize_rsi_strategy(
        self,
        start_time: int,
        end_time: int,
        initial_balance: float = 10000,
        n_trials: int = 100,
        optimization_target: str = 'sharpe_ratio'
    ) -> dict:
        """
        优化RSI策略参数
        
        Args:
            start_time: 回测开始时间
            end_time: 回测结束时间
            initial_balance: 初始资金
            n_trials: 优化试验次数
            optimization_target: 优化目标（sharpe_ratio/total_pnl/win_rate）
        
        Returns:
            {
                'best_params': {...},
                'best_value': 0.85,
                'trials': 100,
                'all_trials': [...]
            }
        """
        logger.info(f"Starting RSI strategy optimization: {n_trials} trials")
        
        def objective(trial: Trial) -> float:
            """Optuna目标函数"""
            # 定义参数搜索空间
            oversold = trial.suggest_int('oversold', 20, 40)
            overbought = trial.suggest_int('overbought', 60, 80)
            
            # 运行回测
            result = asyncio.run(self._run_backtest(
                strategy_class='rsi',
                strategy_params={
                    'oversold': oversold,
                    'overbought': overbought
                },
                start_time=start_time,
                end_time=end_time,
                initial_balance=initial_balance
            ))
            
            # 返回优化目标值
            stats = result['statistics']
            
            if optimization_target == 'sharpe_ratio':
                return stats.get('sharpe_ratio', 0)
            elif optimization_target == 'total_pnl':
                return result['account_status']['total_pnl']
            elif optimization_target == 'win_rate':
                return stats.get('win_rate', 0)
            else:
                return stats.get('sharpe_ratio', 0)
        
        # 创建Optuna study
        study = optuna.create_study(
            direction='maximize',
            study_name=f'rsi_optimization_{int(time.time())}',
            sampler=optuna.samplers.TPESampler()
        )
        
        # 运行优化
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        
        logger.info(
            f"Optimization complete: best_value={study.best_value:.4f}, "
            f"best_params={study.best_params}"
        )
        
        return {
            'best_params': study.best_params,
            'best_value': study.best_value,
            'trials': len(study.trials),
            'all_trials': [
                {
                    'number': t.number,
                    'params': t.params,
                    'value': t.value
                }
                for t in study.trials
            ]
        }
    
    async def optimize_dual_ma_strategy(
        self,
        start_time: int,
        end_time: int,
        initial_balance: float = 10000,
        n_trials: int = 100,
        optimization_target: str = 'sharpe_ratio'
    ) -> dict:
        """
        优化双均线策略参数
        
        Args:
            start_time: 回测开始时间
            end_time: 回测结束时间
            initial_balance: 初始资金
            n_trials: 优化试验次数
            optimization_target: 优化目标
        """
        logger.info(f"Starting Dual MA strategy optimization: {n_trials} trials")
        
        def objective(trial: Trial) -> float:
            # 定义参数搜索空间
            fast_period = trial.suggest_int('fast_period', 3, 20)
            slow_period = trial.suggest_int('slow_period', 10, 60)
            
            # 确保快线周期小于慢线周期
            if fast_period >= slow_period:
                return 0.0
            
            # 运行回测
            result = asyncio.run(self._run_backtest(
                strategy_class='dual_ma',
                strategy_params={
                    'fast_period': fast_period,
                    'slow_period': slow_period
                },
                start_time=start_time,
                end_time=end_time,
                initial_balance=initial_balance
            ))
            
            stats = result['statistics']
            
            if optimization_target == 'sharpe_ratio':
                return stats.get('sharpe_ratio', 0)
            elif optimization_target == 'total_pnl':
                return result['account_status']['total_pnl']
            elif optimization_target == 'win_rate':
                return stats.get('win_rate', 0)
            else:
                return stats.get('sharpe_ratio', 0)
        
        study = optuna.create_study(
            direction='maximize',
            study_name=f'dual_ma_optimization_{int(time.time())}',
            sampler=optuna.samplers.TPESampler()
        )
        
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        
        logger.info(
            f"Optimization complete: best_value={study.best_value:.4f}, "
            f"best_params={study.best_params}"
        )
        
        return {
            'best_params': study.best_params,
            'best_value': study.best_value,
            'trials': len(study.trials),
            'all_trials': [
                {
                    'number': t.number,
                    'params': t.params,
                    'value': t.value
                }
                for t in study.trials
            ]
        }
    
    async def _run_backtest(
        self,
        strategy_class: str,
        strategy_params: dict,
        start_time: int,
        end_time: int,
        initial_balance: float
    ) -> dict:
        """
        运行回测（内部方法）
        
        Args:
            strategy_class: 策略类名（rsi/dual_ma/macd等）
            strategy_params: 策略参数
            start_time: 开始时间
            end_time: 结束时间
            initial_balance: 初始资金
        
        Returns:
            回测结果字典
        """
        # 创建MessageBus（回测模式下不需要真实的消息传递）
        bus = MessageBus()
        
        # 创建策略实例
        if strategy_class == 'rsi':
            from app.nodes.strategies.rsi_strategy import RSIStrategy
            strategy = RSIStrategy(
                bus=bus,
                db=self.db,
                symbols=self.symbols,
                timeframe=self.timeframe,
                **strategy_params
            )
        elif strategy_class == 'dual_ma':
            from app.nodes.strategies.dual_ma_strategy import DualMAStrategy
            strategy = DualMAStrategy(
                bus=bus,
                db=self.db,
                symbols=self.symbols,
                timeframe=self.timeframe,
                **strategy_params
            )
        else:
            raise ValueError(f"Unknown strategy class: {strategy_class}")
        
        # 创建数据源
        data_source = BacktestDataSource(
            self.db,
            start_time,
            end_time,
            self.market_type
        )
        
        # 创建仓位管理器
        position_manager = PositionManagerFactory.create_moderate(initial_balance)
        
        # 创建交易引擎
        engine = TradingEngine(
            data_source=data_source,
            strategy=strategy,
            position_manager=position_manager,
            mode="backtest"
        )
        
        # 运行回测
        await engine.run()
        
        # 返回结果
        return engine.get_results()
    
    async def optimize_custom_strategy(
        self,
        strategy_factory: Callable,
        param_space: Dict,
        start_time: int,
        end_time: int,
        initial_balance: float = 10000,
        n_trials: int = 100,
        optimization_target: str = 'sharpe_ratio'
    ) -> dict:
        """
        优化自定义策略
        
        Args:
            strategy_factory: 策略工厂函数，接收params并返回策略实例
            param_space: 参数空间定义
                例如: {
                    'param1': {'type': 'int', 'low': 10, 'high': 50},
                    'param2': {'type': 'float', 'low': 0.1, 'high': 1.0}
                }
            start_time: 开始时间
            end_time: 结束时间
            initial_balance: 初始资金
            n_trials: 试验次数
            optimization_target: 优化目标
        """
        logger.info(f"Starting custom strategy optimization: {n_trials} trials")
        
        def objective(trial: Trial) -> float:
            # 根据param_space动态生成参数
            params = {}
            for param_name, param_config in param_space.items():
                if param_config['type'] == 'int':
                    params[param_name] = trial.suggest_int(
                        param_name,
                        param_config['low'],
                        param_config['high']
                    )
                elif param_config['type'] == 'float':
                    params[param_name] = trial.suggest_float(
                        param_name,
                        param_config['low'],
                        param_config['high']
                    )
                elif param_config['type'] == 'categorical':
                    params[param_name] = trial.suggest_categorical(
                        param_name,
                        param_config['choices']
                    )
            
            # 创建策略实例
            bus = MessageBus()
            strategy = strategy_factory(bus, self.db, self.symbols, self.timeframe, **params)
            
            # 创建数据源和引擎
            data_source = BacktestDataSource(self.db, start_time, end_time, self.market_type)
            position_manager = PositionManagerFactory.create_moderate(initial_balance)
            engine = TradingEngine(data_source, strategy, position_manager, mode="backtest")
            
            # 运行回测
            result = asyncio.run(engine.run())
            result = engine.get_results()
            
            stats = result['statistics']
            
            if optimization_target == 'sharpe_ratio':
                return stats.get('sharpe_ratio', 0)
            elif optimization_target == 'total_pnl':
                return result['account_status']['total_pnl']
            elif optimization_target == 'win_rate':
                return stats.get('win_rate', 0)
            else:
                return stats.get('sharpe_ratio', 0)
        
        study = optuna.create_study(
            direction='maximize',
            sampler=optuna.samplers.TPESampler()
        )
        
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        
        return {
            'best_params': study.best_params,
            'best_value': study.best_value,
            'trials': len(study.trials),
            'all_trials': [
                {'number': t.number, 'params': t.params, 'value': t.value}
                for t in study.trials
            ]
        }

