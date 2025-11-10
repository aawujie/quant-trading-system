# 紧急Bug修复 🔧

## 修复的问题

### 1. ✅ 前端崩溃问题
**错误**: `presets.map is not a function`

**原因**: 
- 后端`/api/backtest/presets`接口未启动或返回格式错误
- `presets`状态初始化为空数组`[]`，但API失败后变成`undefined`

**修复方案**:
```javascript
// 1. 设置默认值防止崩溃
const [presets, setPresets] = useState([
  { name: 'conservative', display_name: '保守型' },
  { name: 'balanced', display_name: '平衡型' },
  { name: 'aggressive', display_name: '激进型' },
]);

// 2. API调用容错处理
const [strategiesData, presetsData, aiConfigData] = await Promise.all([
  getStrategies().catch(() => []),
  getPositionPresets().catch(() => [...默认值...]),
  getAIConfig().catch(() => ({ enabled: false })),
]);
```

**文件**: 
- `frontend/src/components/TradingEngine/LiveTrading.jsx`
- `frontend/src/components/TradingEngine/BacktestConfig.jsx`

### 2. ✅ Signals API 500错误
**错误**: `GET /api/signals/dual_ma 500 Internal Server Error`

**原因**: 
- `get_recent_signals`方法缺少AI字段处理
- SignalData模型有AI字段，但数据库查询没有读取这些字段

**修复方案**:
```python
# backend/app/core/database.py
return [
    SignalData(
        # ...原有字段...
        # 新增AI字段（使用getattr安全获取）
        ai_enhanced=getattr(row, 'ai_enhanced', None),
        ai_reasoning=getattr(row, 'ai_reasoning', None),
        ai_confidence=getattr(row, 'ai_confidence', None),
        ai_model=getattr(row, 'ai_model', None),
        ai_risk_assessment=getattr(row, 'ai_risk_assessment', None),
    )
    for row in reversed(rows)
]
```

**文件**: `backend/app/core/database.py`

### 3. ⚠️ WebSocket连接失败
**错误**: `WebSocket connection to 'ws://localhost:8001/ws' failed`

**原因**: WebSocket服务未启动

**解决方案**:
```bash
# 启动WebSocket服务
cd backend
python -m app.main --node websocket
```

## 快速检查清单

### 后端服务检查

1. **API服务** (端口8000)
```bash
cd backend
python -m app.main --node api
```
访问: http://localhost:8000/health

2. **WebSocket服务** (端口8001)
```bash
cd backend
python -m app.main --node websocket
```

3. **数据采集服务** (可选)
```bash
# 现货数据
MARKET_TYPE=spot python -m app.main --node kline --symbol BTCUSDT --timeframe 1h

# 合约数据
MARKET_TYPE=future python -m app.main --node kline --symbol BTCUSDT --timeframe 1h
```

### 前端检查

```bash
cd frontend
npm run dev
```
访问: http://localhost:3000

## 测试修复

### 1. 测试交易引擎UI
1. 打开浏览器控制台
2. 点击"🚀 交易引擎"
3. 应该能正常显示，不再崩溃
4. 策略卡片应该可以点击选择
5. 仓位管理下拉框应该有选项

### 2. 测试Signals API
```bash
# 测试API
curl http://localhost:8000/api/signals/dual_ma?symbol=BTCUSDT&limit=10
```

应该返回JSON数组或空数组，不应该500错误。

### 3. 测试WebSocket
1. 确保WebSocket服务运行
2. 刷新前端页面
3. 控制台应该显示: `WebSocket connected`
4. 应该能看到实时数据更新

## 数据库迁移（如果需要）

如果signals表缺少AI字段，运行迁移：

```bash
cd backend
psql -U your_user -d trading_system -f migrations/002_add_ai_fields_to_signals.sql
```

迁移文件内容:
```sql
-- 添加AI增强相关字段
ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT FALSE;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_confidence FLOAT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50);
ALTER TABLE signals ADD COLUMN IF NOT EXISTS ai_risk_assessment VARCHAR(20);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_signals_ai_enhanced ON signals(ai_enhanced);
```

## 当前状态

| 组件 | 状态 | 说明 |
|------|------|------|
| 前端UI | ✅ 已修复 | 添加了默认值和容错处理 |
| Signals API | ✅ 已修复 | 添加了AI字段处理 |
| WebSocket | ⚠️ 需启动 | 需要手动启动服务 |
| 数据库 | ⚠️ 可能需要迁移 | 如果缺少AI字段 |

## 完整启动流程

### 方式1：分别启动（推荐开发）

```bash
# 终端1: API服务
cd backend
source .venv/bin/activate  # 或 uv venv && source .venv/bin/activate
python -m app.main --node api

# 终端2: WebSocket服务
cd backend
source .venv/bin/activate
python -m app.main --node websocket

# 终端3: 数据采集（可选）
cd backend
source .venv/bin/activate
MARKET_TYPE=future python -m app.main --node kline --symbol BTCUSDT --timeframe 1h

# 终端4: 前端
cd frontend
npm run dev
```

### 方式2：使用tmux（推荐生产）

```bash
# 创建tmux会话
tmux new -s trading

# 窗口0: API
python -m app.main --node api

# 新建窗口 (Ctrl+B C)
python -m app.main --node websocket

# 新建窗口
MARKET_TYPE=future python -m app.main --node kline --symbol BTCUSDT --timeframe 1h

# 新建窗口
cd ../frontend && npm run dev

# 分离会话: Ctrl+B D
# 重新连接: tmux attach -t trading
```

## 验证一切正常

打开浏览器控制台，应该看到：

```
✅ WebSocket connected
✅ Chart initialized, loading data...
✅ Loaded 500 K-lines, 500 indicators
✅ 成功加载 4/4 个历史绘图
```

**不应该看到**：
- ❌ `presets.map is not a function`
- ❌ `500 Internal Server Error`
- ❌ `WebSocket connection failed` (如果服务已启动)

## 性能优化提示

1. **浏览器缓存**: 前端有5分钟缓存，刷新时很快
2. **预加载**: 会自动预加载相邻时间周期
3. **增量加载**: 图表支持无限滚动历史数据

## 如果还有问题

### 清理缓存
```bash
# 前端
rm -rf frontend/node_modules/.vite
rm -rf frontend/dist

# 浏览器
打开控制台 → Application → Clear Storage → Clear All
```

### 重启数据库
```bash
# PostgreSQL
brew services restart postgresql@14

# 或
pg_ctl restart -D /usr/local/var/postgresql@14
```

### 检查日志
```bash
# 后端日志
tail -f backend/logs/app.log

# 前端控制台
F12 → Console
```

---

**修复时间**: 2025-11-10
**状态**: ✅ 完成
**测试**: ⏳ 待用户验证

