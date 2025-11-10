# ⚡ 快速启动指南

## 🎯 5分钟上手

### 第一步：安装依赖

```bash
cd backend
uv add optuna openai
```

### 第二步：配置数据库

```bash
# 运行迁移脚本
psql -d quant_trading -f migrations/001_create_trades_table.sql
psql -d quant_trading -f migrations/002_add_ai_fields_to_signals.sql
```

### 第三步：配置环境变量

创建 `backend/.env` 文件：

```bash
# 最小配置
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/quant_trading

# 可选：启用AI增强
ENABLE_AI_ENHANCEMENT=true
DEEPSEEK_API_KEY=sk-your-key-here
```

### 第四步：运行第一个回测

```bash
cd backend
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --balance 10000
```

---

## 📊 回测结果示例

```
======================================================================
📊 回测结果
======================================================================
策略名称:    rsi
交易对:      BTCUSDT
时间周期:    1h
----------------------------------------------------------------------
初始资金:    $10,000.00
最终资金:    $11,250.00
总盈亏:      $1,250.00 (12.50%)
----------------------------------------------------------------------
总交易数:    15
盈利交易:    10
亏损交易:    5
胜率:        66.67%
平均盈利:    $180.50
平均亏损:    $-85.20
盈亏比:      2.12
----------------------------------------------------------------------
最大单笔盈利: $320.00
最大单笔亏损: $-120.00
最大回撤:     8.50%
夏普比率:     1.85
======================================================================
```

---

## 🎨 常用命令

### 1. 不同仓位管理策略

```bash
# 保守型（低风险）
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --position-manager conservative

# 激进型（高风险）
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --position-manager aggressive
```

### 2. 调整策略参数

```bash
# RSI策略参数
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --rsi-oversold 25 \
  --rsi-overbought 75
```

### 3. 启用AI增强

```bash
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT \
  --start 2024-01-01 \
  --end 2024-01-31 \
  --enable-ai
```

### 4. 多交易对回测

```bash
python -m scripts.run_backtest \
  --strategy rsi \
  --symbols BTCUSDT ETHUSDT BNBUSDT \
  --start 2024-01-01 \
  --end 2024-01-31
```

---

## 🌐 启动API服务

```bash
cd backend
uvicorn app.api.rest:app --reload --port 8000
```

然后访问：
- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

---

## 🧪 测试API

### 运行回测

```bash
curl -X POST "http://localhost:8000/api/backtest/run" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "rsi",
    "symbols": ["BTCUSDT"],
    "timeframe": "1h",
    "start_time": 1704067200,
    "end_time": 1706745600,
    "initial_balance": 10000,
    "position_manager_type": "moderate"
  }'
```

### 查询结果

```bash
# 返回的task_id
curl "http://localhost:8000/api/backtest/result/{task_id}"
```

---

## 🔧 故障排查

### 问题1：数据库连接失败
```bash
# 检查数据库是否运行
pg_isready

# 检查连接字符串
echo $DATABASE_URL
```

### 问题2：AI增强不工作
```bash
# 检查API密钥
echo $DEEPSEEK_API_KEY

# 检查网络连接
curl https://api.deepseek.com/
```

### 问题3：回测无数据
```bash
# 检查数据库中是否有数据
psql -d quant_trading -c "SELECT COUNT(*) FROM klines WHERE symbol='BTCUSDT';"
```

---

## 📚 进阶使用

### 参数优化（需要Optuna）

通过API运行参数优化：

```python
import requests

response = requests.post('http://localhost:8000/api/optimize/run', json={
    "strategy_name": "rsi",
    "symbols": ["BTCUSDT"],
    "timeframe": "1h",
    "start_time": 1704067200,
    "end_time": 1706745600,
    "n_trials": 50,
    "optimization_target": "sharpe_ratio"
})

print(response.json())
```

---

## 🎓 下一步学习

1. 阅读 `UPGRADE_COMPLETE.md` 了解所有功能
2. 查看 `docs/trading-system.md` 了解架构设计
3. 探索 `backend/app/nodes/strategies/` 学习如何编写自定义策略

---

## 💡 提示

- 首次回测建议使用1个月数据测试
- AI增强会增加回测时间，但提升信号质量
- 参数优化建议在有足够历史数据后使用
- 实盘前务必充分回测和模拟

---

祝交易顺利！🚀

