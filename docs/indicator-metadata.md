# 指标元数据配置说明

## 概述

从现在开始，指标的配置信息（需要的K线数量、预热期等）统一在后端的元数据中管理，而不是硬编码在代码各处。

## 位置

**文件**: `backend/app/models/indicators.py`

## 核心概念

### 1. IndicatorMetadata 类

定义每个指标的元数据：

```python
class IndicatorMetadata(BaseModel):
    name: str          # 指标名称，如 "MA5"
    period: int        # 需要的基本周期数
    warmup: int        # 预热期（确保指标计算准确）
    description: str   # 描述
```

### 2. INDICATOR_CONFIGS 字典

所有指标的元数据集中管理：

```python
INDICATOR_CONFIGS = {
    'ma5': IndicatorMetadata(...),
    'ma20': IndicatorMetadata(...),
    'ema12': IndicatorMetadata(...),
    ...
}
```

### 3. 自动计算 K 线数量

系统会自动根据指标元数据计算需要的 K 线数量：

```python
max_klines = get_max_required_klines()
# 返回所有指标中需要的最大值
```

## 当前配置

根据元数据自动计算的结果：

```
📊 所有指标需要的最大K线数量: 120

指标详情:
  MA5             - period:   5, warmup:  0, total:   5
  MA10            - period:  10, warmup:  0, total:  10
  MA20            - period:  20, warmup:  0, total:  20
  MA60            - period:  60, warmup:  0, total:  60
  MA120           - period: 120, warmup:  0, total: 120
  EMA12           - period:  12, warmup: 50, total:  62
  EMA26           - period:  26, warmup: 50, total:  76
  RSI14           - period:  14, warmup: 20, total:  34
  MACD            - period:  35, warmup: 50, total:  85
  BOLL            - period:  20, warmup:  0, total:  20
  ATR14           - period:  14, warmup: 20, total:  34
  Volume_MA5      - period:   5, warmup:  0, total:   5
```

**注意**: 虽然 MA120 只需要 120 根，但带预热的指标（如 MACD）需要 85 根。系统取最大值 120。

## 为什么需要预热期？

某些指标（特别是指数移动平均类）需要足够的历史数据才能达到稳定状态：

- **简单移动平均（SMA/MA）**: 不需要预热，计算简单直接
- **指数移动平均（EMA）**: 需要预热，因为每个值都依赖前一个值
- **RSI**: 需要预热，内部使用 EMA 计算
- **MACD**: 需要预热，基于两条 EMA
- **ATR**: 需要预热，使用修正移动平均

## 如何添加新指标

1. 在 `INDICATOR_CONFIGS` 中添加元数据：

```python
INDICATOR_CONFIGS = {
    ...
    'ma200': IndicatorMetadata(
        name='MA200',
        period=200,
        warmup=0,
        description='200周期简单移动平均线'
    ),
}
```

2. 在 `IndicatorData` 类中添加字段：

```python
class IndicatorData(BaseModel):
    ...
    ma200: Optional[float] = Field(None, description="200-period moving average")
```

3. 在 `indicator_node.py` 中添加计算逻辑：

```python
ma200 = talib.SMA(close, timeperiod=200)
```

4. 系统会**自动重新计算**需要的 K 线数量！

## 优势

✅ **配置集中**: 所有指标配置在一个地方管理  
✅ **自动计算**: 无需手动指定 lookback_periods  
✅ **易于扩展**: 添加新指标只需更新元数据  
✅ **避免浪费**: 只取需要的 K 线数量  
✅ **类型安全**: 使用 Pydantic 模型验证  

## API 使用

### 获取最大需求

```python
from app.models.indicators import get_max_required_klines

# 获取所有指标的最大需求
max_klines = get_max_required_klines()

# 获取特定指标的需求
specific_klines = get_max_required_klines(['ma5', 'ma20', 'rsi14'])
```

### 获取单个指标元数据

```python
from app.models.indicators import get_indicator_metadata

meta = get_indicator_metadata('ma5')
print(meta.period)  # 5
print(meta.get_required_klines())  # 5
```

## IndicatorNode 自动使用

```python
# 旧方式 - 硬编码
node = IndicatorNode(
    bus=bus,
    db=db,
    symbols=['BTCUSDT'],
    timeframes=['1h'],
    lookback_periods=200  # 固定值
)

# 新方式 - 自动计算
node = IndicatorNode(
    bus=bus,
    db=db,
    symbols=['BTCUSDT'],
    timeframes=['1h'],
    lookback_periods=None  # 自动从元数据计算
)
```

## 向后兼容

如果你需要指定特定的 lookback_periods（例如测试），仍然可以传入整数值：

```python
node = IndicatorNode(
    bus=bus,
    db=db,
    symbols=['BTCUSDT'],
    timeframes=['1h'],
    lookback_periods=500  # 仍然支持自定义
)
```

## 总结

这个改进遵循了**配置分离**原则，让系统更加：

- 🎯 **智能**: 自动计算需求
- 🔧 **灵活**: 易于添加新指标
- 📊 **高效**: 只取必要数据
- 🛡️ **可靠**: 类型安全验证

