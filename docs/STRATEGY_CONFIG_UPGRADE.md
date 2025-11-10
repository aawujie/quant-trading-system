# 策略配置系统升级文档

## 📋 概述

将交易系统的策略配置从前端硬编码改为后端统一配置文件管理，实现了配置与代码分离，提高了系统的可维护性和灵活性。

## 🎯 改进目标

1. ✅ **配置集中化**: 所有策略配置统一在YAML文件中管理
2. ✅ **动态加载**: 前端通过API动态获取策略配置
3. ✅ **易于扩展**: 添加新策略只需修改配置文件
4. ✅ **参数验证**: 后端提供参数验证功能
5. ✅ **分类管理**: 支持策略分类和筛选

## 📂 文件结构

```
backend/
├── config/
│   └── strategies.yaml          # ⭐ 策略配置文件（新增）
├── app/
│   ├── core/
│   │   └── strategy_config.py   # ⭐ 策略配置加载器（新增）
│   └── api/
│       └── rest.py               # ✏️ 添加策略API接口
└── pyproject.toml                # ✏️ 添加pyyaml依赖

frontend/
└── src/
    ├── services/
    │   └── tradingEngineApi.js   # ✏️ 修改为调用真实API
    └── components/
        └── TradingEngine/
            └── BacktestConfig.jsx # ✏️ 从API动态加载配置
```

## 🔧 实现细节

### 1. 策略配置文件 (`backend/config/strategies.yaml`)

使用YAML格式定义所有策略及其参数：

```yaml
strategies:
  dual_ma:
    display_name: "双均线策略"
    description: "基于快慢均线交叉的经典趋势跟踪策略"
    icon: "📊"
    color: "#4CAF50"
    class_path: "app.nodes.strategies.dual_ma_strategy.DualMAStrategy"
    category: "trend"
    enabled: true
    parameters:
      fast_period:
        label: "快线周期"
        type: "integer"
        default: 5
        min: 2
        max: 50
        step: 1
        description: "快速移动平均线的周期"
    risk_management:
      stop_loss_pct:
        label: "止损百分比"
        type: "float"
        default: 2.0
        min: 0.5
        max: 10.0
        step: 0.1
```

**配置项说明**：
- `display_name`: 策略显示名称
- `description`: 策略描述
- `icon`: UI显示图标
- `color`: UI主题色
- `class_path`: 策略类的导入路径
- `category`: 策略分类
- `enabled`: 是否启用
- `parameters`: 策略参数定义
- `risk_management`: 风控参数定义

### 2. 配置加载器 (`backend/app/core/strategy_config.py`)

提供完整的配置管理功能：

```python
from app.core.strategy_config import get_strategy_config

# 获取配置实例
config = get_strategy_config()

# 获取所有策略
strategies = config.get_all_strategies()

# 获取启用的策略
enabled = config.get_enabled_strategies()

# 获取单个策略
strategy = config.get_strategy('dual_ma')

# 获取默认参数
defaults = config.get_strategy_defaults('dual_ma')

# 参数验证
valid, error = config.validate_parameters('dual_ma', {
    'fast_period': 5,
    'slow_period': 20
})

# 格式化为API响应
api_data = config.format_for_api()
```

### 3. REST API接口

#### 获取所有策略
```http
GET /api/strategies
```

**响应示例**:
```json
{
  "status": "success",
  "strategies": [
    {
      "name": "dual_ma",
      "display_name": "双均线策略",
      "description": "基于快慢均线交叉的经典趋势跟踪策略",
      "icon": "📊",
      "color": "#4CAF50",
      "category": "trend",
      "parameters": {
        "fast_period": {
          "label": "快线周期",
          "type": "integer",
          "default": 5,
          "min": 2,
          "max": 50,
          "step": 1,
          "description": "快速移动平均线的周期"
        }
      },
      "risk_management": { ... }
    }
  ],
  "total": 4
}
```

#### 获取单个策略详情
```http
GET /api/strategies/{strategy_name}
```

#### 获取策略分类
```http
GET /api/strategies/categories
```

#### 重新加载配置
```http
POST /api/strategies/reload
```

### 4. 前端调用

**API服务** (`frontend/src/services/tradingEngineApi.js`):
```javascript
// 获取策略列表
export const getStrategies = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/strategies`);
  return response.data.strategies;
};

// 获取策略详情
export const getStrategyDetail = async (strategyName) => {
  const response = await axios.get(`${API_BASE_URL}/api/strategies/${strategyName}`);
  return response.data.strategy;
};
```

**组件使用** (`BacktestConfig.jsx`):
```javascript
useEffect(() => {
  const loadData = async () => {
    const strategiesData = await getStrategies();
    setStrategies(strategiesData);
    
    // 转换为组件需要的格式
    const details = {};
    strategiesData.forEach(strategy => {
      details[strategy.name] = {
        name: strategy.display_name,
        description: strategy.description,
        icon: strategy.icon,
        color: strategy.color,
        params: strategy.parameters
      };
    });
    setStrategyDetails(details);
  };
  loadData();
}, []);
```

## 🚀 使用指南

### 添加新策略

1. **编写策略类**（继承BaseStrategy）
2. **更新配置文件** `backend/config/strategies.yaml`:

```yaml
strategies:
  my_new_strategy:
    display_name: "我的新策略"
    description: "策略描述"
    icon: "🎯"
    color: "#FF5722"
    class_path: "app.nodes.strategies.my_new_strategy.MyNewStrategy"
    category: "trend"
    enabled: true
    parameters:
      my_param:
        label: "我的参数"
        type: "integer"
        default: 10
        min: 1
        max: 100
        step: 1
        description: "参数说明"
```

3. **重启服务或调用重载接口**
4. **前端自动显示新策略** ✨

### 修改现有策略参数

只需修改 `strategies.yaml` 中的参数配置，无需修改代码：

```yaml
parameters:
  fast_period:
    default: 10  # 修改默认值
    min: 5       # 修改最小值
    max: 100     # 修改最大值
```

### 禁用策略

在配置文件中设置 `enabled: false`:

```yaml
strategies:
  old_strategy:
    enabled: false  # 前端将不再显示此策略
```

## ✅ 优势对比

### 改进前（硬编码）
- ❌ 策略配置分散在前端代码中
- ❌ 修改参数需要修改代码
- ❌ 前后端配置可能不一致
- ❌ 添加新策略需要同时修改多处

### 改进后（配置文件）
- ✅ 配置集中在一个文件中
- ✅ 修改配置无需改代码
- ✅ 单一数据源保证一致性
- ✅ 添加策略只需修改配置文件
- ✅ 支持热重载配置
- ✅ 参数自动验证
- ✅ 支持策略分类管理

## 🧪 测试验证

运行测试验证配置加载：

```bash
cd backend
uv run python -c "from app.core.strategy_config import get_strategy_config; \
  sc = get_strategy_config(); \
  print('Loaded strategies:', list(sc.get_all_strategies().keys()))"
```

**输出**:
```
Loaded strategies: ['dual_ma', 'macd', 'rsi', 'bollinger']
```

## 📊 现有策略

系统当前包含4个策略：

| 策略名称 | 显示名称 | 分类 | 参数数量 |
|---------|---------|------|---------|
| dual_ma | 双均线策略 | 趋势跟踪 | 2 |
| macd | MACD策略 | 动量策略 | 3 |
| rsi | RSI策略 | 震荡指标 | 3 |
| bollinger | 布林带策略 | 波动率策略 | 2 |

## 🔍 分类说明

- **趋势跟踪** (`trend`): 适合趋势明显的市场
- **动量策略** (`momentum`): 基于价格动量的策略
- **震荡指标** (`oscillator`): 适合震荡市场的策略
- **波动率策略** (`volatility`): 基于市场波动率的策略

## 🛠️ 依赖变更

在 `backend/pyproject.toml` 中新增依赖：

```toml
dependencies = [
    # ... 其他依赖
    "pyyaml>=6.0.1",
]
```

安装依赖：
```bash
cd backend
uv sync
```

## 📝 配置文件位置

- **策略配置**: `backend/config/strategies.yaml`
- **加载器**: `backend/app/core/strategy_config.py`
- **API接口**: `backend/app/api/rest.py` (第1086-1197行)

## 🔄 后续扩展建议

1. **配置版本管理**: 为配置文件添加版本号
2. **配置验证**: 在启动时验证配置文件格式
3. **配置UI**: 提供Web界面管理配置
4. **多环境配置**: 支持开发/生产环境不同配置
5. **参数优化**: 集成参数优化建议到配置中

## 🎉 总结

通过这次升级，我们实现了：
- ✅ 配置与代码完全分离
- ✅ 前端从硬编码改为动态加载
- ✅ 统一的配置管理方式
- ✅ 更灵活的策略扩展机制
- ✅ 更好的可维护性

系统现在可以通过简单修改配置文件来管理策略，大大提高了开发和维护效率！

