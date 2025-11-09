# 量化交易系统升级计划

## 概述

本文档详细说明如何将现有量化交易系统升级为更强大、更灵活的生产级系统。主要升级包括：

1. **仓位管理系统**：支持多种风险管理策略
2. **策略框架重构**：分离入场/出场信号，增强灵活性
3. **高效回测引擎**：实盘与回测代码统一
4. **参数优化**：集成Optuna自动寻优
5. **AI信号增强**：使用DeepSeek提升决策质量
6. **前端集成**：回测配置、结果展示、AI推理可视化

---

## 阶段1：仓位管理系统（第1-3天）

### 1.1 仓位计算策略（核心）

**文件**：`backend/app/core/position_manager.py`（新建，约700行）

```python
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
```

---

### 1.2 数据库扩展

**文件**：`backend/app/core/database.py`

**新增方法**（约80行）：

```python
async def get_strategy_statistics(self, strategy_name: str, symbol: str, days: int = 30) -> Dict:
    """
    获取策略历史统计（用于凯利公式）
    
    Returns:
        {
            'win_rate': 0.58,
            'avg_win': 150,
            'avg_loss': -100,
            'win_loss_ratio': 1.5,
            'total_trades': 50
        }
    """
    # 计算时间范围
    end_time = int(time.time())
    start_time = end_time - days * 86400
    
    # 查询历史交易（需要有trades表）
    query = """
        SELECT 
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
            AVG(CASE WHEN pnl <= 0 THEN pnl END) as avg_loss
        FROM trades
        WHERE strategy_name = $1 
        AND symbol = $2
        AND exit_time >= $3
    """
    
    result = await self.pool.fetchrow(query, strategy_name, symbol, start_time)
    
    if not result or result['total_trades'] == 0:
        return {
            'win_rate': 0.5,
            'avg_win': 0,
            'avg_loss': 0,
            'win_loss_ratio': 1.0,
            'total_trades': 0
        }
    
    winning_trades = result['winning_trades'] or 0
    total_trades = result['total_trades']
    win_rate = winning_trades / total_trades
    
    avg_win = result['avg_win'] or 0
    avg_loss = result['avg_loss'] or 0
    win_loss_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 1.0
    
    return {
        'win_rate': win_rate,
        'avg_win': avg_win,
        'avg_loss': avg_loss,
        'win_loss_ratio': win_loss_ratio,
        'total_trades': total_trades
    }

async def get_recent_trades(self, strategy_name: str, symbol: str, limit: int = 10) -> list:
    """获取最近的交易记录（用于AI推理）"""
    query = """
        SELECT symbol, side, entry_price, exit_price, pnl, pnl_pct, exit_time
        FROM trades
        WHERE strategy_name = $1 AND symbol = $2
        ORDER BY exit_time DESC
        LIMIT $3
    """
    
    rows = await self.pool.fetch(query, strategy_name, symbol, limit)
    return [dict(row) for row in rows]
```

---

## 阶段2：策略框架重构（第4-6天）

### 2.1 重构BaseStrategy

**文件**：`backend/app/nodes/strategies/base_strategy.py`

**主要改动**：

1. 拆分 `check_signal` → `check_entry_signal` + `check_exit_signal`
2. 添加持仓跟踪
3. 实现 `confirm_signal` 二次确认
4. 基于ATR的动态止损/止盈

```python
from abc import ABC, abstractmethod
from typing import Optional
import logging
from app.nodes.base_node import BaseNode
from app.models.signals import SignalData, SignalType
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)

class BaseStrategy(BaseNode, ABC):
    """
    策略基类（重构版）
    
    主要改进：
    1. 分离入场/出场信号检测
    2. 内置持仓跟踪
    3. 信号二次确认机制
    4. 基于ATR的动态止损/止盈
    """
    
    def __init__(self, strategy_name, bus, db, symbols, timeframe, 
                 enable_ai_enhancement=False, **params):
        super().__init__(f"{strategy_name}_strategy", bus)
        
        self.strategy_name = strategy_name
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
        self.params = params
        
        # 状态管理
        self.state = {
            symbol: {
                "kline": None,
                "indicator": None,
                "prev_indicator": None
            }
            for symbol in symbols
        }
        
        # 持仓跟踪（新增）
        self.positions = {
            symbol: {
                "has_position": False,
                "side": None,
                "entry_price": None,
                "entry_time": None,
                "highest_price": None,  # 用于移动止损
                "lowest_price": None
            }
            for symbol in symbols
        }
        
        # AI增强（新增）
        self.enable_ai_enhancement = enable_ai_enhancement
        if enable_ai_enhancement:
            from app.ai.providers.deepseek import DeepSeekProvider
            from app.ai.signal_enhancer import AISignalEnhancer
            import os
            
            api_key = os.getenv('DEEPSEEK_API_KEY')
            if not api_key:
                logger.warning("DEEPSEEK_API_KEY not set, AI disabled")
                self.enable_ai_enhancement = False
            else:
                provider = DeepSeekProvider(api_key)
                self.ai_enhancer = AISignalEnhancer(provider)
                logger.info("AI enhancement enabled")
    
    async def process(self, topic: str, data: dict) -> None:
        """处理数据流"""
        symbol = data.get('symbol')
        
        if 'open' in data:
            # K线数据
            kline = KlineData(**data)
            self.state[symbol]["kline"] = kline
        else:
            # 指标数据
            indicator = IndicatorData(**data)
            self.state[symbol]["prev_indicator"] = self.state[symbol]["indicator"]
            self.state[symbol]["indicator"] = indicator
        
        # 检查是否有完整数据
        if not self.state[symbol]["kline"] or not self.state[symbol]["indicator"]:
            return
        
        kline = self.state[symbol]["kline"]
        current_indicator = self.state[symbol]["indicator"]
        prev_indicator = self.state[symbol]["prev_indicator"]
        
        # 根据持仓状态决定检测入场还是出场
        signal = None
        
        if self.positions[symbol]["has_position"]:
            # 有持仓：检测出场信号
            signal = await self.check_exit_signal(symbol, kline, current_indicator, prev_indicator)
            
            if signal:
                # 平仓
                self.positions[symbol]["has_position"] = False
                self.positions[symbol]["side"] = None
        else:
            # 无持仓：检测入场信号
            signal = await self.check_entry_signal(symbol, kline, current_indicator, prev_indicator)
            
            if signal:
                # 二次确认
                confirmed = await self.confirm_signal(signal, kline, current_indicator)
                if not confirmed:
                    logger.info(f"Signal rejected by confirmation: {signal.signal_type}")
                    return
                
                # 开仓
                self.positions[symbol]["has_position"] = True
                self.positions[symbol]["side"] = signal.side
                self.positions[symbol]["entry_price"] = signal.price
                self.positions[symbol]["entry_time"] = signal.timestamp
                self.positions[symbol]["highest_price"] = signal.price
                self.positions[symbol]["lowest_price"] = signal.price
        
        # 更新最高/最低价（用于移动止损）
        if self.positions[symbol]["has_position"]:
            current_price = kline.close
            if current_price > self.positions[symbol]["highest_price"]:
                self.positions[symbol]["highest_price"] = current_price
            if current_price < self.positions[symbol]["lowest_price"]:
                self.positions[symbol]["lowest_price"] = current_price
        
        # 发送信号
        if signal:
            await self.db.insert_signal(signal)
            output_topic = f"signal:{self.strategy_name}:{symbol}"
            await self.emit(output_topic, signal.model_dump())
    
    @abstractmethod
    async def check_entry_signal(
        self, 
        symbol: str, 
        kline: KlineData, 
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测入场信号（子类必须实现）
        
        Returns:
            SignalData or None
        """
        pass
    
    async def check_exit_signal(
        self,
        symbol: str,
        kline: KlineData,
        current_indicator: IndicatorData,
        prev_indicator: Optional[IndicatorData]
    ) -> Optional[SignalData]:
        """
        检测出场信号（默认实现：固定止损/止盈/移动止损）
        
        子类可覆盖此方法添加策略特定的出场逻辑
        """
        pos = self.positions[symbol]
        current_price = kline.close
        
        # 1. 固定止损
        if pos["side"] == "LONG":
            # 多单止损
            stop_loss = self._calculate_stop_loss(pos["entry_price"], "LONG", current_indicator)
            if current_price <= stop_loss:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Stop loss triggered",
                    side="LONG",
                    action="CLOSE"
                )
            
            # 多单止盈
            take_profit = self._calculate_take_profit(pos["entry_price"], "LONG", current_indicator)
            if current_price >= take_profit:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Take profit triggered",
                    side="LONG",
                    action="CLOSE"
                )
            
            # 移动止损（简单版）
            trailing_stop = pos["highest_price"] * 0.95  # 从最高点回撤5%
            if current_price <= trailing_stop:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_LONG,
                    price=current_price,
                    reason="Trailing stop triggered",
                    side="LONG",
                    action="CLOSE"
                )
        
        elif pos["side"] == "SHORT":
            # 空单止损
            stop_loss = self._calculate_stop_loss(pos["entry_price"], "SHORT", current_indicator)
            if current_price >= stop_loss:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Stop loss triggered",
                    side="SHORT",
                    action="CLOSE"
                )
            
            # 空单止盈
            take_profit = self._calculate_take_profit(pos["entry_price"], "SHORT", current_indicator)
            if current_price <= take_profit:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Take profit triggered",
                    side="SHORT",
                    action="CLOSE"
                )
            
            # 移动止损
            trailing_stop = pos["lowest_price"] * 1.05  # 从最低点反弹5%
            if current_price >= trailing_stop:
                return SignalData(
                    strategy_name=self.strategy_name,
                    symbol=symbol,
                    timestamp=kline.timestamp,
                    signal_type=SignalType.CLOSE_SHORT,
                    price=current_price,
                    reason="Trailing stop triggered",
                    side="SHORT",
                    action="CLOSE"
                )
        
        return None
    
    async def confirm_signal(self, signal: SignalData, kline: KlineData, indicator: IndicatorData) -> bool:
        """
        信号二次确认（可选，子类可覆盖）
        
        过滤条件：
        1. 置信度过低
        2. 成交量不足
        3. 波动率过高
        4. AI增强判断
        """
        # 1. 基础过滤
        if signal.confidence and signal.confidence < 0.5:
            return False
        
        # 2. 成交量过滤
        if indicator.volume_ma5:
            volume_ratio = kline.volume / indicator.volume_ma5
            if volume_ratio < 0.5:  # 成交量低于5日均量50%
                logger.info(f"Signal rejected: low volume ratio {volume_ratio:.2f}")
                return False
        
        # 3. 波动率过滤
        if indicator.atr14 and indicator.ma20:
            atr_pct = indicator.atr14 / indicator.ma20
            if atr_pct > 0.05:  # ATR超过价格5%，市场过于波动
                logger.info(f"Signal rejected: high volatility {atr_pct:.2%}")
                return False
        
        # 4. AI增强（新增）
        if self.enable_ai_enhancement:
            try:
                # 获取历史交易
                historical_trades = await self.db.get_recent_trades(
                    strategy_name=self.strategy_name,
                    symbol=signal.symbol,
                    limit=10
                )
                
                # AI判断
                ai_decision = await self.ai_enhancer.enhance_signal(
                    signal, kline, indicator, historical_trades
                )
                
                # 记录AI推理
                signal.ai_enhanced = True
                signal.ai_reasoning = ai_decision['reasoning']
                signal.ai_confidence = ai_decision['ai_confidence']
                signal.ai_model = 'deepseek-chat'
                signal.ai_risk_assessment = ai_decision['risk_assessment']
                
                logger.info(
                    f"[AI] {signal.symbol} - Execute: {ai_decision['should_execute']}, "
                    f"Confidence: {ai_decision['ai_confidence']:.2f}"
                )
                
                # AI不建议执行
                if not ai_decision['should_execute']:
                    logger.info(f"[AI] Rejected: {ai_decision['reasoning'][:100]}")
                    return False
                
                # 更新置信度（AI+技术指标平均）
                signal.confidence = (signal.confidence + ai_decision['ai_confidence']) / 2
            
            except Exception as e:
                logger.error(f"AI enhancement failed: {e}")
                # AI失败不影响交易
        
        return True
    
    def _calculate_stop_loss(self, entry_price: float, side: str, indicator: IndicatorData) -> float:
        """
        计算止损价（基于ATR）
        """
        if indicator.atr14:
            # 使用2倍ATR作为止损距离
            atr_multiplier = 2.0
            stop_distance = indicator.atr14 * atr_multiplier
            
            if side == "LONG":
                return entry_price - stop_distance
            else:
                return entry_price + stop_distance
        else:
            # 回退到固定百分比
            if side == "LONG":
                return entry_price * 0.97  # 3%止损
            else:
                return entry_price * 1.03
    
    def _calculate_take_profit(self, entry_price: float, side: str, indicator: IndicatorData) -> float:
        """
        计算止盈价（基于ATR）
        """
        if indicator.atr14:
            # 使用3倍ATR作为止盈距离
            atr_multiplier = 3.0
            tp_distance = indicator.atr14 * atr_multiplier
            
            if side == "LONG":
                return entry_price + tp_distance
            else:
                return entry_price - tp_distance
        else:
            # 回退到固定百分比
            if side == "LONG":
                return entry_price * 1.06  # 6%止盈
            else:
                return entry_price * 0.94
```

---

### 2.2 数据库迁移（添加AI字段）

**文件**：`backend/migrations/add_ai_fields_to_signals.sql`（新建）

```sql
-- 为signals表添加AI相关字段
ALTER TABLE signals
ADD COLUMN ai_enhanced BOOLEAN DEFAULT FALSE,
ADD COLUMN ai_reasoning TEXT,
ADD COLUMN ai_confidence FLOAT,
ADD COLUMN ai_model VARCHAR(50),
ADD COLUMN ai_risk_assessment VARCHAR(20);

-- 添加索引
CREATE INDEX idx_signals_ai_enhanced ON signals(ai_enhanced);
```

---

### 2.3 更新SignalData模型

**文件**：`backend/app/models/signals.py`

**新增字段**（约20行）：

```python
from pydantic import BaseModel, Field
from typing import Optional

class SignalData(BaseModel):
    strategy_name: str
    symbol: str
    timestamp: int
    signal_type: str
    price: float
    reason: str
    confidence: Optional[float] = None
    side: str
    action: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    
    # AI增强字段（新增）
    ai_enhanced: Optional[bool] = Field(None, description="是否经过AI增强")
    ai_reasoning: Optional[str] = Field(None, description="AI推理过程（Chain of Thought）")
    ai_confidence: Optional[float] = Field(None, description="AI置信度")
    ai_model: Optional[str] = Field(None, description="AI模型名称")
    ai_risk_assessment: Optional[str] = Field(None, description="AI风险评估（low/medium/high）")
```

---

### 2.4 重构现有策略（示例：RSI）

**文件**：`backend/app/nodes/strategies/rsi_strategy.py`

```python
from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.signals import SignalData, SignalType

class RSIStrategy(BaseStrategy):
    """RSI策略（重构版）"""
    
    def __init__(self, bus, db, symbols, timeframe, oversold=30, overbought=70, **kwargs):
        super().__init__("rsi", bus, db, symbols, timeframe, **kwargs)
        self.oversold = oversold
        self.overbought = overbought
    
    async def check_entry_signal(self, symbol, kline, current_indicator, prev_indicator):
        """入场信号检测"""
        if not current_indicator.rsi14 or not prev_indicator or not prev_indicator.rsi14:
            return None
        
        # 做多信号：RSI从超卖区上穿
        if prev_indicator.rsi14 < self.oversold and current_indicator.rsi14 >= self.oversold:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_LONG,
                price=kline.close,
                reason=f"RSI crossed above {self.oversold}",
                confidence=min((self.oversold - prev_indicator.rsi14) / 10, 1.0),
                side="LONG",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "LONG", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "LONG", current_indicator)
            )
        
        # 做空信号：RSI从超买区下穿
        elif prev_indicator.rsi14 > self.overbought and current_indicator.rsi14 <= self.overbought:
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.OPEN_SHORT,
                price=kline.close,
                reason=f"RSI crossed below {self.overbought}",
                confidence=min((prev_indicator.rsi14 - self.overbought) / 10, 1.0),
                side="SHORT",
                action="OPEN",
                stop_loss=self._calculate_stop_loss(kline.close, "SHORT", current_indicator),
                take_profit=self._calculate_take_profit(kline.close, "SHORT", current_indicator)
            )
        
        return None
    
    async def check_exit_signal(self, symbol, kline, current_indicator, prev_indicator):
        """出场信号检测（可添加RSI特定逻辑）"""
        # 先调用基类的默认出场逻辑（止损/止盈）
        base_exit = await super().check_exit_signal(symbol, kline, current_indicator, prev_indicator)
        if base_exit:
            return base_exit
        
        # RSI特定出场：极端RSI值
        pos = self.positions[symbol]
        
        if pos["side"] == "LONG" and current_indicator.rsi14 and current_indicator.rsi14 > 80:
            # 多单：RSI超买
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_LONG,
                price=kline.close,
                reason=f"RSI overbought: {current_indicator.rsi14:.2f}",
                side="LONG",
                action="CLOSE"
            )
        
        elif pos["side"] == "SHORT" and current_indicator.rsi14 and current_indicator.rsi14 < 20:
            # 空单：RSI超卖
            return SignalData(
                strategy_name=self.strategy_name,
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type=SignalType.CLOSE_SHORT,
                price=kline.close,
                reason=f"RSI oversold: {current_indicator.rsi14:.2f}",
                side="SHORT",
                action="CLOSE"
            )
        
        return None
    
    async def confirm_signal(self, signal, kline, indicator):
        """RSI特定的信号确认"""
        # 先调用基类的确认逻辑
        if not await super().confirm_signal(signal, kline, indicator):
            return False
        
        # RSI特定：避免逆势交易
        if indicator.ma5 and indicator.ma20:
            # 趋势判断
            is_uptrend = indicator.ma5 > indicator.ma20
            
            # 做多信号但处于下跌趋势
            if signal.side == "LONG" and not is_uptrend:
                logger.info("RSI LONG signal rejected: downtrend")
                return False
            
            # 做空信号但处于上涨趋势
            if signal.side == "SHORT" and is_uptrend:
                logger.info("RSI SHORT signal rejected: uptrend")
                return False
        
        return True
```

---

## 阶段3：交易引擎开发（第7-10天）

### 3.1 抽象数据源

**文件**：`backend/app/core/data_source.py`（新建，约300行）

```python
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List
import asyncio
import logging

logger = logging.getLogger(__name__)

class DataSource(ABC):
    """数据源抽象接口"""
    
    @abstractmethod
    async def get_kline_stream(self, symbols: List[str], timeframe: str) -> AsyncGenerator:
        """
        获取K线数据流
        
        Yields:
            (topic, data) tuples
        """
        pass
    
    @abstractmethod
    async def get_indicator_stream(self, symbols: List[str], timeframe: str) -> AsyncGenerator:
        """
        获取指标数据流
        
        Yields:
            (topic, data) tuples
        """
        pass


class LiveDataSource(DataSource):
    """实盘数据源（基于MessageBus）"""
    
    def __init__(self, message_bus):
        self.bus = message_bus
    
    async def get_kline_stream(self, symbols: List[str], timeframe: str):
        """订阅实时K线"""
        topics = [f"kline:{timeframe}:{symbol}" for symbol in symbols]
        
        for topic in topics:
            await self.bus.subscribe(topic, self._kline_handler)
        
        # 持续监听（实盘永不结束）
        while True:
            await asyncio.sleep(1)
    
    async def get_indicator_stream(self, symbols: List[str], timeframe: str):
        """订阅实时指标"""
        topics = [f"indicator:{timeframe}:{symbol}" for symbol in symbols]
        
        for topic in topics:
            await self.bus.subscribe(topic, self._indicator_handler)
        
        while True:
            await asyncio.sleep(1)
    
    async def _kline_handler(self, topic, data):
        yield (topic, data)
    
    async def _indicator_handler(self, topic, data):
        yield (topic, data)


class BacktestDataSource(DataSource):
    """回测数据源（预加载）"""
    
    def __init__(self, db, start_time: int, end_time: int):
        self.db = db
        self.start_time = start_time
        self.end_time = end_time
        self.kline_data = {}
        self.indicator_data = {}
    
    async def preload_data(self, symbols: List[str], timeframe: str):
        """预加载数据（性能优化）"""
        logger.info(f"Preloading data: {symbols}, {timeframe}, {self.start_time} - {self.end_time}")
        
        for symbol in symbols:
            # 加载K线
            klines = await self.db.get_kline_data(
                symbol, timeframe, self.start_time, self.end_time
            )
            self.kline_data[symbol] = klines
            
            # 加载指标
            indicators = await self.db.get_indicator_data(
                symbol, timeframe, self.start_time, self.end_time
            )
            self.indicator_data[symbol] = indicators
            
            logger.info(f"Loaded {len(klines)} klines, {len(indicators)} indicators for {symbol}")
    
    async def get_kline_stream(self, symbols: List[str], timeframe: str):
        """按时间顺序推送K线"""
        await self.preload_data(symbols, timeframe)
        
        # 合并所有symbol的K线，按时间排序
        all_klines = []
        for symbol in symbols:
            for kline in self.kline_data.get(symbol, []):
                all_klines.append((f"kline:{timeframe}:{symbol}", kline))
        
        all_klines.sort(key=lambda x: x[1]['timestamp'])
        
        for topic, kline in all_klines:
            yield (topic, kline)
    
    async def get_indicator_stream(self, symbols: List[str], timeframe: str):
        """按时间顺序推送指标"""
        # 合并所有symbol的指标
        all_indicators = []
        for symbol in symbols:
            for indicator in self.indicator_data.get(symbol, []):
                all_indicators.append((f"indicator:{timeframe}:{symbol}", indicator))
        
        all_indicators.sort(key=lambda x: x[1]['timestamp'])
        
        for topic, indicator in all_indicators:
            yield (topic, indicator)
```

---

### 3.2 统一交易引擎

**文件**：`backend/app/core/trading_engine.py`（新建，约400行）

```python
import asyncio
import logging
from typing import Literal
from app.core.data_source import DataSource
from app.core.position_manager import PositionManager
from app.nodes.strategies.base_strategy import BaseStrategy
from app.models.signals import SignalData

logger = logging.getLogger(__name__)

class TradingEngine:
    """
    统一交易引擎
    
    支持：
    1. 实盘模式（live）
    2. 回测模式（backtest）
    """
    
    def __init__(
        self,
        data_source: DataSource,
        strategy: BaseStrategy,
        position_manager: PositionManager,
        mode: Literal["live", "backtest"] = "live"
    ):
        self.data_source = data_source
        self.strategy = strategy
        self.position_manager = position_manager
        self.mode = mode
        
        # 回测结果
        self.trades = []
        
        logger.info(f"TradingEngine initialized: mode={mode}")
    
    async def run(self):
        """启动交易引擎"""
        logger.info(f"Starting trading engine in {self.mode} mode...")
        
        try:
            # 订阅信号
            for symbol in self.strategy.symbols:
                signal_topic = f"signal:{self.strategy.strategy_name}:{symbol}"
                await self.strategy.bus.subscribe(signal_topic, self._handle_signal) if self.mode == "live" else None
                # 回测模式下不需要异步订阅，直接在process中处理

            # 创建数据流
            kline_stream = self.data_source.get_kline_stream(
                symbols=self.strategy.symbols,
                timeframe=self.strategy.timeframe
            )
            indicator_stream = self.data_source.get_indicator_stream(
                symbols=self.strategy.symbols,
                timeframe=self.strategy.timeframe
            )
            
            # 处理数据流
            async for topic, data in self._merge_streams(kline_stream, indicator_stream):
                await self._process_data(topic, data)
            
            # 回测结束：打印结果
            if self.mode == "backtest":
                self._print_backtest_results()
    
    async def _merge_streams(self, *streams):
        """合并多个数据流"""
        merged_queue = asyncio.Queue()
        
        async def producer(stream):
            async for item in stream:
                await merged_queue.put(item)
        
        producers = [asyncio.create_task(producer(s)) for s in streams]
        
        while True:
            try:
                item = await asyncio.wait_for(merged_queue.get(), timeout=0.1)
                yield item
            except asyncio.TimeoutError:
                if all(p.done() for p in producers) and merged_queue.empty():
                    break
    
    async def _process_data(self, topic: str, data: dict):
        """处理单条数据"""
        await self.strategy.process(topic, data)
    
    async def _handle_signal(self, topic: str, signal_data: dict):
        """
        处理交易信号
        
        实盘：发送到交易所
        回测：模拟执行
        """
        signal = SignalData(**signal_data)
        symbol = signal.symbol
        
        kline = self.strategy.state[symbol]["kline"]
        indicator = self.strategy.state[symbol]["indicator"]
        
        if signal.action == "OPEN":
            # 计算仓位
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
            if symbol in self.position_manager.positions:
                if self.mode == "live":
                    await self._execute_live_close(signal)
                else:
                    self._simulate_close(signal)
                
                trade_result = self.position_manager.close_position(symbol, signal.price)
                
                if self.mode == "backtest":
                    self.trades.append({
                        'symbol': symbol,
                        'entry_time': trade_result.get('entry_time'),
                        'exit_time': signal.timestamp,
                        **trade_result
                    })
    
    def _simulate_order(self, signal, order_info):
        """回测模拟订单"""
        logger.info(
            f"[BACKTEST] Open {signal.side}: {signal.symbol} "
            f"qty={order_info['quantity']:.6f} @ ${signal.price:.2f}"
        )
    
    def _simulate_close(self, signal):
        """回测模拟平仓"""
        logger.info(f"[BACKTEST] Close {signal.side}: {signal.symbol} @ ${signal.price:.2f}")
    
    def _print_backtest_results(self):
        """打印回测结果"""
        stats = self._calculate_statistics()
        account_status = self.position_manager.get_account_status()
        
        print("\n" + "="*60)
        print("回测结果")
        print("="*60)
        print(f"初始资金:  ${account_status['initial_balance']:,.2f}")
        print(f"最终资金:  ${account_status['current_balance']:,.2f}")
        print(f"总盈亏:    ${account_status['total_pnl']:,.2f} ({account_status['total_pnl_pct']*100:.2f}%)")
        print(f"总交易数:  {stats.get('total_trades', 0)}")
        print(f"胜率:      {stats.get('win_rate', 0)*100:.2f}%")
        print(f"盈亏比:    {stats.get('win_loss_ratio', 0):.2f}")
        print(f"夏普比率:  {stats.get('sharpe_ratio', 0):.2f}")
        print("="*60 + "\n")
    
    def _calculate_statistics(self) -> dict:
        """计算回测统计"""
        if not self.trades:
            return {}
        
        winning_trades = [t for t in self.trades if t['pnl'] > 0]
        losing_trades = [t for t in self.trades if t['pnl'] <= 0]
        
        win_rate = len(winning_trades) / len(self.trades) if self.trades else 0
        avg_win = sum(t['pnl'] for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t['pnl'] for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        return {
            'total_trades': len(self.trades),
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'win_loss_ratio': abs(avg_win / avg_loss) if avg_loss != 0 else 0,
            'sharpe_ratio': 0.0  # 简化版
        }
```

---

## 阶段4：参数优化与测试（第11-13天）

### 4.1 集成Optuna参数优化

**文件**：`backend/app/services/strategy_optimizer.py`（新建，约250行）

```python
import optuna
import asyncio
import time
from app.core.trading_engine import TradingEngine, BacktestDataSource
from app.core.position_manager import PositionManagerFactory

class StrategyOptimizer:
    """
    策略参数优化器
    
    使用Optuna自动搜索最优参数
    """
    
    def __init__(self, db, symbols: list, timeframe: str):
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
    
    async def optimize_rsi_strategy(
        self,
        start_time: int,
        end_time: int,
        initial_balance: float = 10000,
        n_trials: int = 100
    ) -> dict:
        """优化RSI策略参数"""
        
        def objective(trial: optuna.Trial) -> float:
            # 定义参数搜索空间
            oversold = trial.suggest_int('oversold', 20, 40)
            overbought = trial.suggest_int('overbought', 60, 80)
            
            # 创建策略实例
            from app.nodes.strategies.rsi_strategy import RSIStrategy
            strategy = RSIStrategy(
                bus=None,
                db=self.db,
                symbols=self.symbols,
                timeframe=self.timeframe,
                oversold=oversold,
                overbought=overbought
            )
            
            # 创建回测引擎
            data_source = BacktestDataSource(self.db, start_time, end_time)
            position_manager = PositionManagerFactory.create_moderate(initial_balance)
            engine = TradingEngine(data_source, strategy, position_manager, mode="backtest")
            
            # 运行回测
            asyncio.run(engine.run())
            
            # 返回优化目标（夏普比率）
            stats = engine._calculate_statistics()
            return stats.get('sharpe_ratio', 0)
        
        # 创建Optuna study
        study = optuna.create_study(
            direction='maximize',
            study_name=f'rsi_optimization_{int(time.time())}'
        )
        
        # 运行优化
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        
        return {
            'best_params': study.best_params,
            'best_value': study.best_value,
            'trials': len(study.trials),
            'all_trials': [
                {'params': t.params, 'value': t.value}
                for t in study.trials
            ]
        }
```

---

### 4.2 回测CLI工具

**文件**：`backend/scripts/run_backtest.py`（新建，约150行）

```python
import argparse
import asyncio
from datetime import datetime
import os

async def main():
    parser = argparse.ArgumentParser(description='运行策略回测')
    parser.add_argument('--strategy', required=True, 
                       choices=['rsi', 'dual_ma', 'macd', 'bollinger'])
    parser.add_argument('--symbols', nargs='+', default=['BTCUSDT'])
    parser.add_argument('--timeframe', default='1h')
    parser.add_argument('--start', required=True, help='开始日期 YYYY-MM-DD')
    parser.add_argument('--end', required=True, help='结束日期 YYYY-MM-DD')
    parser.add_argument('--balance', type=float, default=10000)
    parser.add_argument('--position-manager', 
                       choices=['conservative', 'moderate', 'aggressive'], 
                       default='moderate')
    
    # RSI策略参数
    parser.add_argument('--rsi-oversold', type=int, default=30)
    parser.add_argument('--rsi-overbought', type=int, default=70)
    
    # 双均线策略参数
    parser.add_argument('--ma-fast', type=int, default=5)
    parser.add_argument('--ma-slow', type=int, default=20)
    
    args = parser.parse_args()
    
    # 转换日期
    start_time = int(datetime.strptime(args.start, '%Y-%m-%d').timestamp())
    end_time = int(datetime.strptime(args.end, '%Y-%m-%d').timestamp())
    
    # 初始化
    from app.core.database import Database
    from app.core.trading_engine import TradingEngine, BacktestDataSource
    from app.core.position_manager import PositionManagerFactory
    
    db = Database(os.getenv('DATABASE_URL'))
    await db.connect()
    
    # 创建策略
    if args.strategy == 'rsi':
        from app.nodes.strategies.rsi_strategy import RSIStrategy
        strategy = RSIStrategy(
            bus=None,
            db=db,
            symbols=args.symbols,
            timeframe=args.timeframe,
            oversold=args.rsi_oversold,
            overbought=args.rsi_overbought
        )
    # TODO: 其他策略...
    
    # 创建仓位管理器
    pm_factory = getattr(PositionManagerFactory, f'create_{args.position_manager}')
    position_manager = pm_factory(args.balance)
    
    # 创建数据源和引擎
    data_source = BacktestDataSource(db, start_time, end_time)
    engine = TradingEngine(data_source, strategy, position_manager, mode="backtest")
    
    # 运行回测
    print(f"\n开始回测: {args.strategy} @ {args.timeframe}")
    print(f"时间范围: {args.start} ~ {args.end}")
    print(f"初始资金: ${args.balance}")
    print("=" * 60)
    
    await engine.run()

if __name__ == "__main__":
    asyncio.run(main())
```

**使用示例**：

```bash
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT ETHUSDT \
  --timeframe 1h \
  --start 2024-01-01 \
  --end 2024-02-01 \
  --balance 10000 \
  --position-manager moderate \
  --rsi-oversold 30 \
  --rsi-overbought 70
```

---

### 4.3 单元测试

**文件**：`backend/tests/test_position_manager.py`（新建，约200行）

```python
import pytest
from app.core.position_manager import (
    RiskBasedSizing,
    PositionManager,
    PositionManagerFactory
)
from app.models.signals import SignalData, SignalType

def test_risk_based_sizing():
    """测试基于风险的仓位计算"""
    sizing = RiskBasedSizing(risk_per_trade=0.02)
    
    signal = SignalData(
        strategy_name="test",
        symbol="BTCUSDT",
        timestamp=1234567890,
        signal_type=SignalType.OPEN_LONG,
        price=50000,
        reason="test",
        stop_loss=49000,
        side="LONG",
        action="OPEN"
    )
    
    position_size = sizing.calculate_position_size(
        signal=signal,
        kline=None,
        indicator=None,
        account_balance=10000,
        current_positions={}
    )
    
    # 风险金额 = 10000 * 0.02 = 200
    # 止损距离 = (50000-49000)/50000 = 2%
    # 仓位 = 200 / 0.02 = 10000（但会限制为50% = 5000）
    assert position_size == 5000

def test_max_positions_limit():
    """测试最大持仓数限制"""
    pm = PositionManager(
        initial_balance=10000,
        sizing_strategy=RiskBasedSizing(0.02),
        max_positions=2
    )
    
    # 模拟已有2个持仓
    pm.positions = {
        'BTCUSDT': {},
        'ETHUSDT': {}
    }
    
    signal = SignalData(
        strategy_name="test",
        symbol="BNBUSDT",
        timestamp=1234567890,
        signal_type=SignalType.OPEN_LONG,
        price=300,
        reason="test",
        side="LONG",
        action="OPEN"
    )
    
    order_info = pm.calculate_order_size(signal, None, None)
    
    # 应该返回None（超过最大持仓数）
    assert order_info is None
```

---

## 阶段5：AI信号增强（第14-16天）

### 5.1 AI提供者基础设施

**文件**：`backend/app/ai/providers/base.py`（新建，约50行）

```python
from abc import ABC, abstractmethod

class AIProvider(ABC):
    """AI提供者抽象接口"""
    
    @abstractmethod
    async def chat_completion(self, prompt: str, temperature: float = 0.7) -> str:
        """
        发送prompt，获取AI响应
        
        Args:
            prompt: 提示词
            temperature: 温度参数（0-1）
            
        Returns:
            AI的文本响应
        """
        pass
```

**文件**：`backend/app/ai/providers/deepseek.py`（新建，约80行）

```python
from openai import AsyncOpenAI
import asyncio
import logging
from .base import AIProvider

logger = logging.getLogger(__name__)

class DeepSeekProvider(AIProvider):
    """DeepSeek API提供者"""
    
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
    
    async def chat_completion(self, prompt: str, temperature: float = 0.7) -> str:
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": "你是专业的量化交易助手"},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=2000
                ),
                timeout=5.0  # 5秒超时
            )
            
            return response.choices[0].message.content
        
        except asyncio.TimeoutError:
            logger.warning("DeepSeek API timeout")
            return None
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return None
```

---

### 5.2 AI信号增强器

**文件**：`backend/app/ai/signal_enhancer.py`（新建，约300行）

```python
import json
import re
import logging
from typing import Dict, List, Optional
from app.ai.providers.base import AIProvider
from app.models.signals import SignalData
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)

class AISignalEnhancer:
    """
    AI信号增强器
    
    使用LLM对传统技术指标信号进行二次确认
    """
    
    def __init__(self, provider: AIProvider, enable_cache: bool = True):
        self.provider = provider
        self.cache = {} if enable_cache else None
    
    async def enhance_signal(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData,
        historical_trades: List[Dict] = None
    ) -> Dict:
        """
        使用AI增强信号
        
        Returns:
            {
                'should_execute': True/False,
                'ai_confidence': 0.85,
                'reasoning': 'AI推理过程',
                'risk_assessment': 'low/medium/high',
                'position_size_multiplier': 0.8
            }
        """
        # 构建Prompt
        prompt = self._build_prompt(signal, kline, indicator, historical_trades)
        
        # 调用AI
        response = await self.provider.chat_completion(prompt)
        
        if not response:
            # AI调用失败，返回默认值
            return {
                'should_execute': True,
                'ai_confidence': signal.confidence or 0.5,
                'reasoning': 'AI服务不可用，使用默认判断',
                'risk_assessment': 'medium'
            }
        
        # 解析响应
        decision = self._parse_response(response)
        
        return decision
    
    def _build_prompt(self, signal, kline, indicator, historical_trades):
        """构建Prompt"""
        historical_summary = self._format_historical_trades(historical_trades) if historical_trades else "无历史数据"
        
        return f"""
你是专业的加密货币交易助手。请分析以下信息并给出建议。

## 技术指标信号
- 策略：{signal.strategy_name}
- 信号类型：{signal.signal_type}
- 价格：${signal.price:.2f}
- 原因：{signal.reason}
- 置信度：{signal.confidence:.2f if signal.confidence else 'N/A'}

## 当前市场数据
- 交易对：{signal.symbol}
- 最新价格：${kline.close:.2f}
- 24h高/低：${kline.high:.2f} / ${kline.low:.2f}
- 成交量：{kline.volume:.2f}

## 技术指标
- RSI(14)：{indicator.rsi14:.2f if indicator.rsi14 else 'N/A'}
- MACD柱：{indicator.macd_histogram:.4f if indicator.macd_histogram else 'N/A'}
- MA(5/20)：{indicator.ma5:.2f if indicator.ma5 else 'N/A'} / {indicator.ma20:.2f if indicator.ma20 else 'N/A'}
- ATR(14)：{indicator.atr14:.2f if indicator.atr14 else 'N/A'}

## 最近交易表现
{historical_summary}

请按JSON格式回答（不要包含其他文本）：
{{
    "should_execute": true,
    "ai_confidence": 0.85,
    "reasoning": "详细分析推理过程",
    "risk_assessment": "medium",
    "position_size_multiplier": 1.0
}}
"""
    
    def _parse_response(self, response: str) -> Dict:
        """解析AI响应"""
        try:
            # 提取JSON
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                decision = json.loads(json_match.group())
                
                # 验证必需字段
                if all(f in decision for f in ['should_execute', 'ai_confidence', 'reasoning']):
                    return decision
            
            # 解析失败
            return {
                'should_execute': False,
                'ai_confidence': 0.3,
                'reasoning': f'AI响应格式错误：{response[:200]}',
                'risk_assessment': 'high'
            }
        except Exception as e:
            logger.error(f"Parse AI response failed: {e}")
            return {
                'should_execute': False,
                'ai_confidence': 0.3,
                'reasoning': f'解析失败：{str(e)}',
                'risk_assessment': 'high'
            }
    
    def _format_historical_trades(self, trades: List[Dict]) -> str:
        """格式化历史交易"""
        if not trades:
            return "暂无历史交易"
        
        lines = []
        for t in trades[:5]:  # 只显示最近5笔
            lines.append(f"- {t.get('side')} {t.get('symbol')}: PnL {t.get('pnl', 0):.2f}")
        
        return "\n".join(lines)
```

---

### 5.3 集成到策略基类

**文件**：`backend/app/nodes/strategies/base_strategy.py`

**修改 `__init__` 方法**（约20行）：

```python
def __init__(self, strategy_name, bus, db, symbols, timeframe, 
             enable_ai_enhancement=False, **params):
    super().__init__(f"{strategy_name}_strategy", bus)
    
    # ... 原有代码 ...
    
    # AI增强
    self.enable_ai_enhancement = enable_ai_enhancement
    
    if enable_ai_enhancement:
        from app.ai.providers.deepseek import DeepSeekProvider
        from app.ai.signal_enhancer import AISignalEnhancer
        
        api_key = os.getenv('DEEPSEEK_API_KEY')
        if not api_key:
            logger.warning("DEEPSEEK_API_KEY not set, AI disabled")
            self.enable_ai_enhancement = False
        else:
            provider = DeepSeekProvider(api_key)
            self.ai_enhancer = AISignalEnhancer(provider)
            logger.info("AI enhancement enabled")
```

**修改 `confirm_signal` 方法**（约40行）：

```python
async def confirm_signal(self, signal, kline, indicator) -> bool:
    """信号二次确认（含AI增强）"""
    
    # 1. 基础过滤（原有逻辑）
    if signal.confidence and signal.confidence < 0.5:
        return False
    
    if indicator.volume_ma5:
        volume_ratio = kline.volume / indicator.volume_ma5
        if volume_ratio < 0.5:
            return False
    
    if indicator.atr14 and indicator.ma20:
        atr_pct = indicator.atr14 / indicator.ma20
        if atr_pct > 0.05:
            return False
    
    # 2. AI增强（新增）
    if self.enable_ai_enhancement:
        try:
            historical_trades = await self.db.get_recent_trades(
                strategy_name=self.strategy_name,
                symbol=signal.symbol,
                limit=10
            )
            
            ai_decision = await self.ai_enhancer.enhance_signal(
                signal, kline, indicator, historical_trades
            )
            
            # 记录AI推理
            signal.ai_enhanced = True
            signal.ai_reasoning = ai_decision['reasoning']
            signal.ai_confidence = ai_decision['ai_confidence']
            signal.ai_model = 'deepseek-chat'
            signal.ai_risk_assessment = ai_decision['risk_assessment']
            
            logger.info(
                f"[AI] {signal.symbol} - Execute: {ai_decision['should_execute']}, "
                f"Confidence: {ai_decision['ai_confidence']:.2f}"
            )
            
            # AI不建议执行
            if not ai_decision['should_execute']:
                logger.info(f"[AI] Rejected: {ai_decision['reasoning'][:100]}")
                return False
            
            # 更新置信度
            signal.confidence = (signal.confidence + ai_decision['ai_confidence']) / 2
        
        except Exception as e:
            logger.error(f"AI enhancement failed: {e}")
            # AI失败不影响交易
    
    return True
```

---

### 5.4 配置管理

**文件**：`backend/.env` 示例

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quant_trading

# AI Enhancement
ENABLE_AI_ENHANCEMENT=true
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
AI_TIMEOUT=5.0
AI_CACHE_ENABLED=true
```

---

## 阶段6：前端集成（第17-19天）

### 6.1 后端API接口

**文件**：`backend/app/api/rest.py`

**新增端点**（约150行）：

```python
from pydantic import BaseModel
from typing import Optional

class BacktestRequest(BaseModel):
    strategy_name: str
    symbols: list
    timeframe: str
    start_time: int
    end_time: int
    initial_balance: float
    position_manager_type: str
    strategy_params: Optional[dict] = {}

@router.post("/api/backtest/run")
async def run_backtest(request: BacktestRequest):
    """运行回测"""
    # TODO: 实现异步回测
    return {"task_id": "xxx", "status": "running"}

@router.get("/api/backtest/result/{task_id}")
async def get_backtest_result(task_id: str):
    """获取回测结果"""
    # TODO: 查询回测结果
    return {
        "status": "completed",
        "results": {
            "total_pnl": 1500.0,
            "win_rate": 0.65,
            "trades": []
        }
    }

@router.get("/api/backtest/presets")
async def get_position_manager_presets():
    """获取仓位管理预设"""
    return {
        "conservative": {"risk": 0.01, "max_positions": 2, "description": "保守型"},
        "moderate": {"risk": 0.02, "max_positions": 3, "description": "适中型"},
        "aggressive": {"risk": 0.05, "max_positions": 5, "description": "激进型"}
    }

@router.post("/api/optimize/run")
async def run_optimization(request: dict):
    """运行参数优化"""
    # TODO: 调用Optuna优化
    return {"task_id": "xxx", "status": "running"}

@router.get("/api/ai/config")
async def get_ai_config():
    """获取AI配置"""
    return {
        "enabled": os.getenv('ENABLE_AI_ENHANCEMENT') == 'true',
        "model": "deepseek-chat",
        "api_key_set": bool(os.getenv('DEEPSEEK_API_KEY'))
    }
```

---

### 6.2 前端配置面板

**文件**：`frontend/src/components/Backtest/BacktestConfig.jsx`（新建，约300行）

```jsx
import { useState } from 'react';

export default function BacktestConfig() {
  const [config, setConfig] = useState({
    strategy: 'rsi',
    symbols: ['BTCUSDT'],
    timeframe: '1h',
    startDate: '2024-01-01',
    endDate: '2024-02-01',
    initialBalance: 10000,
    positionManager: 'moderate',
    strategyParams: {
      rsi_oversold: 30,
      rsi_overbought: 70
    }
  });
  
  const handleRunBacktest = async () => {
    const response = await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_name: config.strategy,
        symbols: config.symbols,
        timeframe: config.timeframe,
        start_time: new Date(config.startDate).getTime() / 1000,
        end_time: new Date(config.endDate).getTime() / 1000,
        initial_balance: config.initialBalance,
        position_manager_type: config.positionManager,
        strategy_params: config.strategyParams
      })
    });
    
    const data = await response.json();
    console.log('Backtest started:', data.task_id);
  };
  
  return (
    <div className="backtest-config">
      <h2>回测配置</h2>
      
      {/* 策略选择 */}
      <div className="form-group">
        <label>策略</label>
        <select value={config.strategy} onChange={(e) => setConfig({...config, strategy: e.target.value})}>
          <option value="rsi">RSI策略</option>
          <option value="dual_ma">双均线策略</option>
          <option value="macd">MACD策略</option>
          <option value="bollinger">布林带策略</option>
        </select>
      </div>
      
      {/* 时间范围 */}
      <div className="form-group">
        <label>开始日期</label>
        <input type="date" value={config.startDate} 
               onChange={(e) => setConfig({...config, startDate: e.target.value})} />
      </div>
      
      <div className="form-group">
        <label>结束日期</label>
        <input type="date" value={config.endDate} 
               onChange={(e) => setConfig({...config, endDate: e.target.value})} />
      </div>
      
      {/* 初始资金 */}
      <div className="form-group">
        <label>初始资金（USDT）</label>
        <input type="number" value={config.initialBalance} 
               onChange={(e) => setConfig({...config, initialBalance: parseFloat(e.target.value)})} />
      </div>
      
      {/* 仓位管理 */}
      <div className="form-group">
        <label>仓位管理</label>
        <select value={config.positionManager} 
                onChange={(e) => setConfig({...config, positionManager: e.target.value})}>
          <option value="conservative">保守型</option>
          <option value="moderate">适中型</option>
          <option value="aggressive">激进型</option>
        </select>
      </div>
      
      {/* 策略参数 */}
      {config.strategy === 'rsi' && (
        <div className="strategy-params">
          <h3>RSI参数</h3>
          <div className="form-group">
            <label>超卖阈值</label>
            <input type="number" value={config.strategyParams.rsi_oversold}
                   onChange={(e) => setConfig({
                     ...config, 
                     strategyParams: {...config.strategyParams, rsi_oversold: parseInt(e.target.value)}
                   })} />
          </div>
          <div className="form-group">
            <label>超买阈值</label>
            <input type="number" value={config.strategyParams.rsi_overbought}
                   onChange={(e) => setConfig({
                     ...config,
                     strategyParams: {...config.strategyParams, rsi_overbought: parseInt(e.target.value)}
                   })} />
          </div>
        </div>
      )}
      
      <button onClick={handleRunBacktest} className="btn-primary">
        开始回测
      </button>
    </div>
  );
}
```

---

### 6.3 AI推理展示组件

**文件**：`frontend/src/components/Strategy/SignalCard.jsx`（新建，约200行）

```jsx
import { useState } from 'react';

export default function SignalCard({ signal }) {
  const [showReasoning, setShowReasoning] = useState(false);
  
  return (
    <div className="signal-card">
      <div className="signal-header">
        <span className={`signal-type ${signal.signal_type}`}>
          {signal.signal_type}
        </span>
        
        {/* AI增强标识 */}
        {signal.ai_enhanced && (
          <span className="ai-badge" title={`AI置信度: ${signal.ai_confidence?.toFixed(2)}`}>
            🤖 AI {signal.ai_confidence?.toFixed(2)}
          </span>
        )}
        
        {/* 风险评估 */}
        {signal.ai_risk_assessment && (
          <span className={`risk-badge risk-${signal.ai_risk_assessment}`}>
            {signal.ai_risk_assessment}
          </span>
        )}
      </div>
      
      <div className="signal-info">
        <p><strong>策略：</strong>{signal.strategy_name}</p>
        <p><strong>价格：</strong>${signal.price}</p>
        <p><strong>原因：</strong>{signal.reason}</p>
        <p><strong>置信度：</strong>{(signal.confidence * 100).toFixed(0)}%</p>
      </div>
      
      {/* AI推理过程（可展开） */}
      {signal.ai_reasoning && (
        <div className="ai-reasoning">
          <button 
            className="btn-toggle"
            onClick={() => setShowReasoning(!showReasoning)}
          >
            {showReasoning ? '隐藏' : '查看'} AI推理过程
          </button>
          
          {showReasoning && (
            <div className="reasoning-content">
              <h4>AI分析（{signal.ai_model}）</h4>
              <pre>{signal.ai_reasoning}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**样式**（CSS）：

```css
.ai-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-left: 8px;
}

.risk-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.risk-low { background: #26a69a; color: white; }
.risk-medium { background: #ffa726; color: white; }
.risk-high { background: #ef5350; color: white; }

.reasoning-content {
  margin-top: 12px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.reasoning-content pre {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
}
```

---

### 6.4 回测结果展示

**文件**：`frontend/src/components/Backtest/BacktestResults.jsx`（新建，约400行）

```jsx
import { Line } from 'react-chartjs-2';

export default function BacktestResults({ results }) {
  const stats = results.statistics;
  
  return (
    <div className="backtest-results">
      <h2>回测结果</h2>
      
      {/* 统计卡片 */}
      <div className="stats-grid">
        <StatCard 
          title="总收益" 
          value={`$${stats.total_pnl.toFixed(2)}`}
          percentage={`${(stats.total_pnl_pct * 100).toFixed(2)}%`}
          positive={stats.total_pnl > 0}
        />
        
        <StatCard 
          title="胜率" 
          value={`${(stats.win_rate * 100).toFixed(2)}%`}
        />
        
        <StatCard 
          title="盈亏比" 
          value={stats.win_loss_ratio.toFixed(2)}
        />
        
        <StatCard 
          title="夏普比率" 
          value={stats.sharpe_ratio.toFixed(2)}
        />
        
        <StatCard 
          title="最大回撤" 
          value={`${(stats.max_drawdown * 100).toFixed(2)}%`}
          negative={true}
        />
        
        <StatCard 
          title="交易次数" 
          value={stats.total_trades}
        />
      </div>
      
      {/* 权益曲线 */}
      <div className="equity-chart">
        <h3>权益曲线</h3>
        <Line data={prepareChartData(results.equity_curve)} />
      </div>
      
      {/* 交易列表 */}
      <div className="trades-table">
        <h3>交易记录</h3>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>方向</th>
              <th>入场价</th>
              <th>出场价</th>
              <th>盈亏</th>
              <th>盈亏%</th>
            </tr>
          </thead>
          <tbody>
            {results.trades.map((trade, idx) => (
              <tr key={idx}>
                <td>{new Date(trade.entry_time * 1000).toLocaleString()}</td>
                <td className={trade.side === 'LONG' ? 'long' : 'short'}>{trade.side}</td>
                <td>${trade.entry_price.toFixed(2)}</td>
                <td>${trade.exit_price.toFixed(2)}</td>
                <td className={trade.pnl > 0 ? 'profit' : 'loss'}>
                  ${trade.pnl.toFixed(2)}
                </td>
                <td className={trade.pnl_pct > 0 ? 'profit' : 'loss'}>
                  {(trade.pnl_pct * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, percentage, positive, negative }) {
  return (
    <div className="stat-card">
      <h4>{title}</h4>
      <div className={`stat-value ${positive ? 'positive' : negative ? 'negative' : ''}`}>
        {value}
        {percentage && <span className="percentage">{percentage}</span>}
      </div>
    </div>
  );
}
```

---

### 6.5 参数优化界面

**文件**：`frontend/src/components/Backtest/ParameterOptimizer.jsx`（新建，约250行）

```jsx
import { useState } from 'react';

export default function ParameterOptimizer({ strategy }) {
  const [config, setConfig] = useState({
    strategy: strategy || 'rsi',
    symbols: ['BTCUSDT'],
    timeframe: '1h',
    startDate: '2024-01-01',
    endDate: '2024-02-01',
    initialBalance: 10000,
    nTrials: 50,
    paramRanges: {
      rsi_oversold: { min: 20, max: 40 },
      rsi_overbought: { min: 60, max: 80 }
    },
    optimizationTarget: 'sharpe_ratio'
  });
  
  const [result, setResult] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  
  const handleOptimize = async () => {
    setOptimizing(true);
    
    try {
      const response = await fetch('/api/optimize/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: config.strategy,
          symbols: config.symbols,
          timeframe: config.timeframe,
          start_time: new Date(config.startDate).getTime() / 1000,
          end_time: new Date(config.endDate).getTime() / 1000,
          initial_balance: config.initialBalance,
          n_trials: config.nTrials,
          param_ranges: config.paramRanges,
          optimization_target: config.optimizationTarget
        })
      });
      
      const data = await response.json();
      
      // 轮询结果
      await pollOptimizationResult(data.task_id);
    } catch (error) {
      console.error('Optimization failed:', error);
      setOptimizing(false);
    }
  };
  
  const pollOptimizationResult = async (taskId) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/optimize/result/${taskId}`);
      const data = await response.json();
      
      if (data.status === 'completed') {
        clearInterval(interval);
        setResult(data.result);
        setOptimizing(false);
      } else if (data.status === 'failed') {
        clearInterval(interval);
        setOptimizing(false);
        alert('优化失败');
      }
    }, 2000);
  };
  
  return (
    <div className="parameter-optimizer">
      <h2>🔧 参数优化</h2>
      
      {/* 优化配置 */}
      <div className="optimizer-config">
        <div className="form-group">
          <label>策略</label>
          <select value={config.strategy} onChange={(e) => setConfig({...config, strategy: e.target.value})}>
            <option value="rsi">RSI策略</option>
            <option value="dual_ma">双均线策略</option>
            <option value="macd">MACD策略</option>
            <option value="bollinger">布林带策略</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>尝试次数</label>
          <input type="number" value={config.nTrials} 
                 onChange={(e) => setConfig({...config, nTrials: parseInt(e.target.value)})} />
        </div>
        
        <div className="form-group">
          <label>优化目标</label>
          <select value={config.optimizationTarget} 
                  onChange={(e) => setConfig({...config, optimizationTarget: e.target.value})}>
            <option value="sharpe_ratio">夏普比率</option>
            <option value="total_pnl">总收益</option>
            <option value="win_rate">胜率</option>
          </select>
        </div>
        
        {/* RSI参数范围 */}
        {config.strategy === 'rsi' && (
          <div className="param-ranges">
            <h3>参数搜索空间</h3>
            <div className="range-group">
              <label>超卖阈值范围</label>
              <input type="number" placeholder="最小值" 
                     value={config.paramRanges.rsi_oversold.min}
                     onChange={(e) => setConfig({
                       ...config, 
                       paramRanges: {
                         ...config.paramRanges,
                         rsi_oversold: {...config.paramRanges.rsi_oversold, min: parseInt(e.target.value)}
                       }
                     })} />
              <span>-</span>
              <input type="number" placeholder="最大值" 
                     value={config.paramRanges.rsi_oversold.max}
                     onChange={(e) => setConfig({
                       ...config,
                       paramRanges: {
                         ...config.paramRanges,
                         rsi_oversold: {...config.paramRanges.rsi_oversold, max: parseInt(e.target.value)}
                       }
                     })} />
            </div>
            
            <div className="range-group">
              <label>超买阈值范围</label>
              <input type="number" placeholder="最小值" 
                     value={config.paramRanges.rsi_overbought.min}
                     onChange={(e) => setConfig({
                       ...config,
                       paramRanges: {
                         ...config.paramRanges,
                         rsi_overbought: {...config.paramRanges.rsi_overbought, min: parseInt(e.target.value)}
                       }
                     })} />
              <span>-</span>
              <input type="number" placeholder="最大值" 
                     value={config.paramRanges.rsi_overbought.max}
                     onChange={(e) => setConfig({
                       ...config,
                       paramRanges: {
                         ...config.paramRanges,
                         rsi_overbought: {...config.paramRanges.rsi_overbought, max: parseInt(e.target.value)}
                       }
                     })} />
            </div>
          </div>
        )}
        
        <button onClick={handleOptimize} disabled={optimizing} className="btn-primary">
          {optimizing ? '优化中...' : '开始优化'}
        </button>
      </div>
      
      {/* 优化进度 */}
      {optimizing && (
        <div className="optimization-progress">
          <div className="spinner"></div>
          <p>正在运行Optuna优化，请稍候...</p>
        </div>
      )}
      
      {/* 优化结果 */}
      {result && (
        <div className="optimization-result">
          <h3>✅ 优化完成</h3>
          
          <div className="best-params">
            <h4>最优参数</h4>
            <pre>{JSON.stringify(result.best_params, null, 2)}</pre>
          </div>
          
          <div className="best-value">
            <h4>最优值</h4>
            <p className="value">{result.best_value.toFixed(4)}</p>
          </div>
          
          <div className="trials-summary">
            <h4>尝试次数</h4>
            <p>{result.trials} 次</p>
          </div>
          
          {/* 所有试验结果 */}
          <div className="all-trials">
            <h4>所有试验结果</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>参数</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {result.all_trials.slice(0, 10).map((trial, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{JSON.stringify(trial.params)}</td>
                    <td>{trial.value.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| **阶段1** | 仓位管理系统 | 3天 |
| **阶段2** | 策略框架重构 | 3天 |
| **阶段3** | 交易引擎开发 | 4天 |
| **阶段4** | 参数优化与测试 | 3天 |
| **阶段5** | AI信号增强 | 3天 |
| **阶段6** | 前端集成 | 3天 |
| **总计** | | **19天（约4周）** |

---

## 验收标准

### 功能验收

1. ✅ **仓位管理系统**
   - 5种仓位计算策略能正常工作
   - 风控规则（最大持仓数、暴露限制）生效
   - 开平仓记录准确

2. ✅ **策略框架**
   - 所有策略支持入场/出场分离
   - 信号确认机制能有效过滤低质量信号
   - 持仓状态自动管理
   - 基于ATR的动态止损/止盈

3. ✅ **交易引擎**
   - 回测速度满足要求（1个月数据<5秒）
   - 实盘模式正常工作
   - 回测结果与实盘逻辑一致

4. ✅ **参数优化**
   - Optuna能找到更优参数
   - CLI工具可用
   - 优化结果可靠

5. ✅ **AI增强**
   - DeepSeek API调用成功
   - AI推理过程可在前端查看
   - AI拒绝的信号被正确过滤
   - AI失败时系统正常降级

6. ✅ **前端界面**
   - 回测配置面板友好易用
   - 结果可视化清晰
   - AI推理过程可展开查看

### 性能验收

- 回测速度：1个月数据 < 5秒
- AI响应时间：< 5秒（含超时）
- 前端响应：< 500ms

### 稳定性验收

- AI服务不可用时系统正常运行
- 网络异常时有合理降级
- 数据库查询优化，无性能瓶颈

---

## 关键文件清单

### 新建文件

**后端核心**：
- `backend/app/core/position_manager.py` (~700行) - 仓位管理系统
- `backend/app/core/data_source.py` (~300行) - 抽象数据源
- `backend/app/core/trading_engine.py` (~400行) - 统一交易引擎
- `backend/app/services/strategy_optimizer.py` (~250行) - 参数优化

**AI模块**：
- `backend/app/ai/providers/base.py` (~50行) - AI提供者接口
- `backend/app/ai/providers/deepseek.py` (~80行) - DeepSeek集成
- `backend/app/ai/signal_enhancer.py` (~300行) - AI信号增强器

**脚本和测试**：
- `backend/scripts/run_backtest.py` (~150行) - 回测CLI工具
- `backend/tests/test_position_manager.py` (~200行) - 单元测试

**数据库迁移**：
- `backend/migrations/add_ai_fields_to_signals.sql` - AI字段

**前端组件**：
- `frontend/src/components/Backtest/BacktestConfig.jsx` (~300行) - 回测配置
- `frontend/src/components/Backtest/BacktestResults.jsx` (~400行) - 结果展示
- `frontend/src/components/Backtest/ParameterOptimizer.jsx` (~250行) - 参数优化
- `frontend/src/components/Strategy/SignalCard.jsx` (~200行) - AI推理展示

### 修改文件

**后端策略**：
- `backend/app/nodes/strategies/base_strategy.py` (大量修改)
- `backend/app/nodes/strategies/rsi_strategy.py` (~60行改动)
- `backend/app/nodes/strategies/dual_ma_strategy.py` (~60行改动)
- `backend/app/nodes/strategies/macd_strategy.py` (~60行改动)
- `backend/app/nodes/strategies/bollinger_strategy.py` (~60行改动)

**后端其他**：
- `backend/app/models/signals.py` (新增AI字段)
- `backend/app/core/database.py` (新增get_strategy_statistics方法)
- `backend/app/api/rest.py` (新增5个端点)
- `backend/main.py` 或 `backend/scripts/run_live.py` (集成改动)

**配置文件**：
- `backend/.env` (新增AI相关配置)

---

## 依赖安装

### 后端新增依赖

```bash
# 安装Optuna
uv add optuna

# 安装OpenAI SDK（用于DeepSeek）
uv add openai

# 可选：安装进度条
uv add tqdm
```

### 前端新增依赖

```bash
# 图表库
npm install chart.js react-chartjs-2

# 或使用 Lightweight Charts（推荐）
npm install lightweight-charts
```

---

## 快速开始指南

### 1. 设置环境变量

```bash
cd backend
cp .env.example .env

# 编辑 .env，添加：
ENABLE_AI_ENHANCEMENT=true
DEEPSEEK_API_KEY=sk-your-api-key-here
```

### 2. 运行数据库迁移

```bash
cd backend
python -m alembic upgrade head

# 或手动执行SQL
psql -d quant_trading -f migrations/add_ai_fields_to_signals.sql
```

### 3. 测试回测功能

```bash
cd backend
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --balance 10000
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 5. 启动后端（带AI增强）

```bash
cd backend
# 修改策略启动脚本，启用AI增强
python main.py
```

---

## 常见问题

### Q1: AI调用超时怎么办？

A: 系统设计了5秒超时和自动降级，AI失败不会影响交易。可以调整 `AI_TIMEOUT` 环境变量。

### Q2: 回测速度慢怎么办？

A: 
- 确保数据库有索引（timestamp, symbol, timeframe）
- 使用 `BacktestDataSource` 的预加载功能
- 减少回测时间范围或交易对数量

### Q3: 如何切换不同的AI模型？

A: 创建新的Provider类（如 `QwenProvider`），继承 `AIProvider` 接口即可。

### Q4: 如何添加新的仓位管理策略？

A: 继承 `PositionSizingStrategy` 类，实现 `calculate_position_size` 方法。

---

## 下一步计划（可选）

### 短期优化（1-2周）

1. **实盘模拟模式**（Paper Trading）
2. **Webhook通知**（Telegram/Discord推送）
3. **策略性能分析面板**（夏普比率曲线、回撤分析）

### 中期扩展（1-2个月）

4. **多AI模型竞技场**（DeepSeek vs Qwen vs Claude）
5. **自进化机制**（AI从历史交易中学习）
6. **AI策略生成器**（自然语言→策略代码）

### 长期愿景（3-6个月）

7. **分布式回测**（支持多机并行）
8. **实盘交易所集成**（Binance/OKX API）
9. **社区策略市场**（分享和交易策略）

---

## 总结

本升级计划通过以下核心改进，将您的量化交易系统提升到生产级水平：

✅ **专业的风险管理**：5种仓位策略+完善风控  
✅ **灵活的策略框架**：入场/出场分离+信号确认  
✅ **AI信号增强**：DeepSeek提升决策质量  
✅ **高效的回测引擎**：实盘/回测代码共享  
✅ **自动参数优化**：Optuna智能寻优  
✅ **完善的用户界面**：回测配置+结果可视化  

预计**19天（约4周）**完成全部开发，建议按阶段逐步实施，每个阶段结束后进行验收测试。

---

**最后更新**：2025-01-09  
**当前版本**：v2.0（含AI增强）  
**下一个里程碑**：阶段1完成（第3天）