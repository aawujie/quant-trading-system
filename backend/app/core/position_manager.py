from abc import ABC, abstractmethod
from typing import Dict, Optional
import logging
from app.models.signals import SignalData
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)

# ============================================
# 1. 仓位计算策略抽象
# ============================================

class PositionSizingStrategy(ABC):
    """仓位计算策略基类"""
    
    @abstractmethod
    def calculate_position_size(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData,
        account_balance: float,
        current_positions: Dict
    ) -> float:
        """
        计算开仓金额（USDT）
        
        Returns:
            float: 本次交易应投入的USDT金额
        """
        pass


# ============================================
# 2. 具体实现：5种策略
# ============================================

class FixedAmountSizing(PositionSizingStrategy):
    """固定金额策略"""
    
    def __init__(self, amount_per_trade: float = 100):
        self.amount_per_trade = amount_per_trade
    
    def calculate_position_size(self, signal, kline, indicator, account_balance, current_positions):
        return min(self.amount_per_trade, account_balance * 0.5)


class FixedPercentageSizing(PositionSizingStrategy):
    """固定百分比策略"""
    
    def __init__(self, percentage: float = 0.1):
        self.percentage = percentage
    
    def calculate_position_size(self, signal, kline, indicator, account_balance, current_positions):
        return account_balance * self.percentage


class RiskBasedSizing(PositionSizingStrategy):
    """基于风险的仓位计算（推荐）"""
    
    def __init__(self, risk_per_trade: float = 0.02):
        """
        Args:
            risk_per_trade: 每笔交易愿意承担的账户风险比例（默认2%）
        """
        self.risk_per_trade = risk_per_trade
    
    def calculate_position_size(self, signal, kline, indicator, account_balance, current_positions):
        if not signal.stop_loss:
            logger.warning("No stop_loss in signal, fallback to 10% balance")
            return account_balance * 0.1
        
        # 计算风险金额
        risk_amount = account_balance * self.risk_per_trade
        
        # 计算止损距离（百分比）
        stop_loss_distance = abs(signal.price - signal.stop_loss) / signal.price
        
        # 仓位 = 风险金额 / 止损距离
        position_size = risk_amount / stop_loss_distance
        
        # 限制最大仓位（不超过账户50%）
        max_position = account_balance * 0.5
        return min(position_size, max_position)


class KellyCriterionSizing(PositionSizingStrategy):
    """凯利公式仓位计算（需要历史统计）"""
    
    def __init__(self, win_rate: float = 0.55, avg_win_loss_ratio: float = 1.5):
        """
        Args:
            win_rate: 胜率（需要从历史数据统计）
            avg_win_loss_ratio: 平均盈亏比
        """
        self.win_rate = win_rate
        self.avg_win_loss_ratio = avg_win_loss_ratio
    
    def calculate_position_size(self, signal, kline, indicator, account_balance, current_positions):
        # 凯利公式：f = (p*b - q) / b
        # p = 胜率, q = 败率, b = 盈亏比
        p = self.win_rate
        q = 1 - p
        b = self.avg_win_loss_ratio
        
        kelly_fraction = (p * b - q) / b
        
        # 保守策略：使用半凯利
        kelly_fraction = kelly_fraction * 0.5
        
        # 限制范围
        kelly_fraction = max(0.01, min(kelly_fraction, 0.25))
        
        return account_balance * kelly_fraction


class VolatilityAdjustedSizing(PositionSizingStrategy):
    """基于波动率的动态仓位"""
    
    def __init__(self, base_percentage: float = 0.15):
        self.base_percentage = base_percentage
    
    def calculate_position_size(self, signal, kline, indicator, account_balance, current_positions):
        if not indicator.atr14 or not indicator.ma20:
            return account_balance * self.base_percentage
        
        # ATR百分比
        atr_pct = indicator.atr14 / indicator.ma20
        
        # 波动率越大，仓位越小
        volatility_multiplier = 1 / (1 + atr_pct * 20)
        
        position_size = account_balance * self.base_percentage * volatility_multiplier
        
        return position_size


# ============================================
# 3. 仓位管理器（统一管理）
# ============================================

class PositionManager:
    """
    仓位管理器
    
    功能：
    1. 计算开仓数量
    2. 跟踪持仓
    3. 风控规则
    """
    
    def __init__(
        self,
        initial_balance: float,
        sizing_strategy: PositionSizingStrategy,
        max_positions: int = 3,
        max_exposure_pct: float = 0.8,
        single_position_max_pct: float = 0.5
    ):
        self.initial_balance = initial_balance
        self.current_balance = initial_balance
        self.sizing_strategy = sizing_strategy
        
        # 风控参数
        self.max_positions = max_positions
        self.max_exposure_pct = max_exposure_pct
        self.single_position_max_pct = single_position_max_pct
        
        # 持仓跟踪
        self.positions: Dict[str, dict] = {}
        
        logger.info(
            f"PositionManager initialized: balance=${initial_balance}, "
            f"strategy={sizing_strategy.__class__.__name__}, "
            f"max_positions={max_positions}"
        )
    
    def calculate_order_size(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData
    ) -> Optional[Dict]:
        """
        计算开仓订单
        
        Returns:
            {
                'quantity': 0.01,  # BTC数量
                'usdt_amount': 500,  # USDT金额
                'price': 50000
            }
            或 None（不满足风控）
        """
        symbol = signal.symbol
        
        # 1. 检查最大持仓数
        if len(self.positions) >= self.max_positions:
            logger.warning(f"Max positions reached ({self.max_positions})")
            return None
        
        # 2. 计算仓位金额
        position_size_usdt = self.sizing_strategy.calculate_position_size(
            signal, kline, indicator, self.current_balance, self.positions
        )
        
        # 3. 检查单笔最大仓位
        max_single_position = self.current_balance * self.single_position_max_pct
        if position_size_usdt > max_single_position:
            logger.warning(f"Position too large, capped at {self.single_position_max_pct*100}%")
            position_size_usdt = max_single_position
        
        # 4. 检查总暴露度
        current_exposure = sum(pos['usdt_amount'] for pos in self.positions.values())
        max_exposure = self.current_balance * self.max_exposure_pct
        
        if current_exposure + position_size_usdt > max_exposure:
            available = max_exposure - current_exposure
            if available < position_size_usdt * 0.5:
                logger.warning("Insufficient exposure capacity")
                return None
            position_size_usdt = available
        
        # 5. 计算数量
        quantity = position_size_usdt / signal.price
        
        order_info = {
            'quantity': quantity,
            'usdt_amount': position_size_usdt,
            'price': signal.price
        }
        
        logger.info(
            f"Order calculated: {symbol} {signal.side} "
            f"qty={quantity:.6f} (${position_size_usdt:.2f})"
        )
        
        return order_info
    
    def open_position(self, symbol: str, order_info: dict, signal: SignalData):
        """记录开仓"""
        self.positions[symbol] = {
            'side': signal.side,
            'quantity': order_info['quantity'],
            'usdt_amount': order_info['usdt_amount'],
            'entry_price': order_info['price'],
            'entry_time': signal.timestamp,
            'stop_loss': signal.stop_loss,
            'take_profit': signal.take_profit
        }
        
        self.current_balance -= order_info['usdt_amount']
        
        logger.info(f"Position opened: {symbol} {signal.side}, balance=${self.current_balance:.2f}")
    
    def close_position(self, symbol: str, exit_price: float) -> Dict:
        """平仓并计算盈亏"""
        if symbol not in self.positions:
            logger.warning(f"Position not found: {symbol}")
            return {}
        
        pos = self.positions[symbol]
        
        # 计算盈亏
        if pos['side'] == 'LONG':
            pnl = (exit_price - pos['entry_price']) * pos['quantity']
        else:
            pnl = (pos['entry_price'] - exit_price) * pos['quantity']
        
        pnl_pct = pnl / pos['usdt_amount']
        
        # 更新余额
        self.current_balance += pos['usdt_amount'] + pnl
        
        # 删除持仓
        del self.positions[symbol]
        
        logger.info(
            f"Position closed: {symbol} {pos['side']}, "
            f"PnL=${pnl:.2f} ({pnl_pct*100:.2f}%), "
            f"balance=${self.current_balance:.2f}"
        )
        
        return {
            'pnl': pnl,
            'pnl_pct': pnl_pct,
            'entry_price': pos['entry_price'],
            'exit_price': exit_price,
            'entry_time': pos['entry_time']
        }
    
    def get_account_status(self) -> Dict:
        """获取账户状态"""
        return {
            'initial_balance': self.initial_balance,
            'current_balance': self.current_balance,
            'total_pnl': self.current_balance - self.initial_balance,
            'total_pnl_pct': (self.current_balance - self.initial_balance) / self.initial_balance,
            'positions_count': len(self.positions),
            'positions': self.positions
        }


# ============================================
# 4. 工厂类（便捷创建）
# ============================================

class PositionManagerFactory:
    """仓位管理器工厂"""
    
    @staticmethod
    def create_conservative(initial_balance: float) -> PositionManager:
        """保守型：低风险，小仓位"""
        return PositionManager(
            initial_balance=initial_balance,
            sizing_strategy=RiskBasedSizing(risk_per_trade=0.01),
            max_positions=2,
            max_exposure_pct=0.5,
            single_position_max_pct=0.3
        )
    
    @staticmethod
    def create_moderate(initial_balance: float) -> PositionManager:
        """适中型：平衡风险收益"""
        return PositionManager(
            initial_balance=initial_balance,
            sizing_strategy=RiskBasedSizing(risk_per_trade=0.02),
            max_positions=3,
            max_exposure_pct=0.8,
            single_position_max_pct=0.5
        )
    
    @staticmethod
    def create_aggressive(initial_balance: float) -> PositionManager:
        """激进型：高风险，大仓位"""
        return PositionManager(
            initial_balance=initial_balance,
            sizing_strategy=RiskBasedSizing(risk_per_trade=0.05),
            max_positions=5,
            max_exposure_pct=0.95,
            single_position_max_pct=0.7
        )
    
    @staticmethod
    def create_kelly(initial_balance: float, win_rate: float, win_loss_ratio: float) -> PositionManager:
        """凯利公式型：基于历史统计"""
        return PositionManager(
            initial_balance=initial_balance,
            sizing_strategy=KellyCriterionSizing(win_rate, win_loss_ratio),
            max_positions=3,
            max_exposure_pct=0.8,
            single_position_max_pct=0.5
        )

