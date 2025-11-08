# 数据修复模式对比：按时间 vs 按数量

## 📋 概述

数据修复系统支持两种模式：
- **按时间修复**：检查指定时间范围内的数据完整性
- **按数量修复**：检查最近N根K线的数据完整性

但并非所有修复类型都适用两种模式。

---

## 🔑 核心区别

### K线修复 vs 指标修复

| 维度 | K线修复 | 指标修复 |
|------|--------|---------|
| **数据源** | 交易所 API（外部） | 本地K线数据（内部） |
| **按时间** | ✅ 合理 | ✅ 合理 |
| **按数量** | ❌ 不合理 | ✅ 合理 |
| **缺失原因** | 系统故障、网络中断 | 计算遗漏、程序bug |
| **修复方式** | 从交易所拉取历史数据 | 基于已有K线计算 |
| **时间语义** | 必须明确时间范围 | 可以只关心数量 |
| **API限制** | `fetch_klines(start_time, end_time)` | 本地计算，无API限制 |

---

## 💡 为什么K线修复不适合按数量？

### 1. 交易所API的限制

**交易所API是按时间范围工作的：**
```python
# Binance API
exchange.fetch_klines(
    symbol='BTCUSDT',
    interval='1d',
    start_time=1640995200000,  # 必须指定开始时间
    end_time=1672531200000,     # 必须指定结束时间
    limit=1000
)
```

**不能这样调用：**
```python
# ❌ 这样的API不存在
exchange.fetch_klines(
    symbol='BTCUSDT',
    interval='1d',
    count=2000  # "给我2000根K线"
)
```

### 2. 时间语义不明确

**按数量检测的问题：**
```python
# 场景：数据库有311根1d K线，期望2000根
klines_count = 2000
current_count = 311
missing_count = 1689  # 缺少1689根

问题：
❓ 这1689根在什么时间点？
❓ 是2025年之前的？还是2024年的？还是2020年的？
❓ 如何告诉交易所API要获取哪个时间段的数据？
❓ 交易所有这么久远的历史数据吗？（5.5年）
```

### 3. 不同周期的时间跨度差异巨大

**按数量的时间跨度：**
```
2000根K线对应的时间：
- 1d:  2000天 = 5.5年
- 4h:  2000×4小时 = 333天
- 1h:  2000小时 = 83天
- 3m:  2000×3分钟 = 4天
```

**问题：**
- 1d周期需要5.5年历史，交易所可能没有
- 3m周期只需要4天历史，很容易获取
- 按数量无法统一处理

### 4. 业务意义不大

**实时交易系统通常只关心最近的数据：**
```python
# 有意义：检查最近30天的K线是否完整
days_back = 30  ✅

# 意义不大：检查最近2000根1d K线（5.5年前的数据）
klines_count = 2000  ❓ 为什么需要这么久远的数据？
```

---

## ✅ 为什么指标修复可以按数量？

### 1. 数据源是本地的

**指标计算不依赖外部API：**
```python
# 指标修复流程
1. 从本地数据库查询最近2000根K线  ← 本地有
2. 遍历这些K线，检查是否有指标
3. 缺失的就基于K线计算指标  ← 本地计算
4. 保存到数据库
```

### 2. 灵活性高

**可以按时间或数量，都有明确语义：**
```python
# 按时间：确保最近30天的指标完整
days_back = 30
→ 适合生产环境，确保时间连续性

# 按数量：确保每个周期都有2000个指标
klines_count = 2000
→ 适合回测和策略开发，数量一致更公平
```

### 3. 回测友好

**策略开发时，相同数量更合理：**
```python
# 回测场景：对比不同周期的策略表现
策略A在1d周期：用2000根K线回测 = 5.5年
策略B在1h周期：用2000根K线回测 = 83天

虽然时间跨度不同，但：
✅ 样本量相同（都是2000个交易点）
✅ 统计意义相当
✅ 对比更公平
```

### 4. 无外部依赖

```python
# 指标计算示例
klines = db.get_recent_klines(limit=2000)

for kline in klines:
    if not db.has_indicator(kline.timestamp):
        # 本地计算，不需要调用交易所
        indicator = calculate_indicators(kline)
        db.save_indicator(indicator)
```

---

## 📊 实际场景对比

### 场景1：按时间修复K线（正常）✅

```python
# 问题：系统在 2025-10-20 到 2025-10-25 期间停机
数据库K线：2025-01-01 ~ 2025-10-20，2025-10-26 ~ 现在
缺失：2025-10-21 ~ 2025-10-25（5天）

# 检测
days_back = 30
detect_kline_gaps(days_back=30)
→ 发现时间缺口：2025-10-21 到 2025-10-25

# 修复
exchange.fetch_klines(
    start_time='2025-10-21 00:00',  # 明确的时间
    end_time='2025-10-25 23:59'     # 明确的时间
)
✅ 补充5天的K线，时间连续性恢复
```

---

### 场景2：按数量修复K线（有问题）❌

```python
# 问题：数据库只有311根1d K线
数据库K线：311根（从 2025-01-02 开始）
期望：2000根

# 检测
klines_count = 2000
detect_kline_gaps(klines_count=2000)
→ 缺少 1689 根

# 修复？
❌ 问题1：这1689根在什么时间点？
   - 2024年的？2023年的？2020年的？

❌ 问题2：如何调用交易所API？
   exchange.fetch_klines(
       start_time=????,  # 不知道从什么时候开始
       end_time=????     # 不知道到什么时候结束
   )

❌ 问题3：交易所有这么多历史数据吗？
   - 2000根1d = 5.5年历史
   - Binance可能只保留1-2年的1d数据

❌ 问题4：这些久远的数据有用吗？
   - 实时交易系统通常只需要最近几个月的数据
```

---

### 场景3：按数量修复指标（正常）✅

```python
# 问题：指标计算遗漏，只有部分指标
数据库K线：311根1d K线（完整）
数据库指标：30个指标（部分遗漏）
期望：所有K线都有指标

# 检测
klines_count = 2000
detect_indicator_gaps(klines_count=2000)
→ K线有311根，指标有30个，缺少281个

# 修复
klines = db.get_recent_klines(limit=2000)  # 获取最近2000根（实际311根）
for kline in klines:
    if not db.has_indicator(kline.timestamp):
        # 基于K线本地计算指标
        indicator = calculate_indicators(kline)
        db.save_indicator(indicator)

✅ 补充281个指标，所有K线都有指标了
```

---

## 🎯 配置建议

### ⭐ 推荐：混合模式（K线按时间 + 指标按数量）

```python
# config.py
repair_days_back = 30        # K线修复：检查最近30天
repair_klines_count = 2000   # 指标修复：每个周期2000根

# 效果
K线：
  所有周期都检查最近30天的时间连续性
  
指标：
  1d:  2000 根指标（5.5年）
  1h:  2000 根指标（83天）
  3m:  2000 根指标（4天）

# 优势
✅ K线时间连续性有保障（按时间）
✅ 指标样本量统一公平（按数量）
✅ 兼顾生产稳定性和回测需求
✅ 最佳实践
```

### 生产环境（全按时间）

```python
# 节点启动时快速检查
repair_hours_back_on_startup = 1  # 最近1小时
→ K线和指标都按时间检查

# 效果
1d:  1 根（1小时 < 1天，无数据）
1h:  1 根（1小时）
3m:  20 根（1小时）

# 优势
✅ 快速启动
✅ 只检查最近数据
✅ 适合日常运行
```

---

## 🔧 代码实现逻辑

### K线修复：必须按时间

```python
async def detect_kline_gaps(days_back: float):
    """K线缺失检测（只支持按时间）"""
    # 计算时间范围
    end_time = int(datetime.now().timestamp())
    start_time = end_time - int(days_back * 86400)
    
    # 生成期望的时间戳序列
    expected_timestamps = generate_expected_timestamps(
        start_time, end_time, interval
    )
    
    # 获取数据库中的K线
    existing_klines = db.get_klines_in_range(start_time, end_time)
    existing_timestamps = {k.timestamp for k in existing_klines}
    
    # 找出缺失的时间段
    missing = expected_timestamps - existing_timestamps
    
    return missing

async def backfill_klines(missing_timestamps):
    """从交易所补充K线"""
    for timestamp in missing_timestamps:
        # 调用交易所API，指定明确的时间
        klines = exchange.fetch_klines(
            start_time=timestamp,
            end_time=timestamp + interval
        )
        db.save_klines(klines)
```

### 指标修复：支持按时间和按数量

```python
async def detect_indicator_gaps(
    days_back: float = None,
    klines_count: int = None
):
    """指标缺失检测（支持两种模式）"""
    if klines_count:
        # 按数量模式：获取最近N根K线
        klines = db.get_recent_klines(limit=klines_count)
        kline_timestamps = {k.timestamp for k in klines}
    else:
        # 按时间模式：获取时间范围内的K线
        cutoff = now - days_back * 86400
        klines = db.get_klines_after(cutoff)
        kline_timestamps = {k.timestamp for k in klines}
    
    # 获取已有的指标
    indicators = db.get_indicators()
    indicator_timestamps = {i.timestamp for i in indicators}
    
    # 找出有K线但没指标的
    missing = kline_timestamps - indicator_timestamps
    
    return missing

async def backfill_indicators(missing_timestamps):
    """本地计算指标"""
    for timestamp in missing_timestamps:
        # 获取该时间点的K线
        kline = db.get_kline_at(timestamp)
        
        # 本地计算指标（不需要交易所API）
        indicator = calculate_indicators(kline)
        
        db.save_indicator(indicator)
```

---

## 📈 性能对比

### 按时间修复 30天

```
K线修复：
- 检测：扫描30天时间范围
- 修复：调用交易所API（如有缺失）
- 时间：取决于网络和交易所响应

指标修复：
- 1d:  30 个指标（< 1秒）
- 1h:  720 个指标（< 10秒）
- 3m:  14400 个指标（~3分钟）
```

### 按数量修复 2000根

```
K线修复：
- ❌ 不支持

指标修复：
- 1d:  2000 个指标（~30秒）
- 1h:  2000 个指标（~30秒）
- 3m:  2000 个指标（~30秒）
- ✅ 所有周期耗时相同
```

---

## ⚠️ 注意事项

### 1. 按数量模式的限制

```python
repair_by_count = True

限制：
❌ 不支持K线修复（自动跳过）
✅ 只支持指标修复
⚠️  如果数据库K线不足2000根，会修复所有可用的
```

### 2. 数据不足时的行为

```python
# 按数量模式，期望2000根，但只有311根
klines_count = 2000
actual_klines = 311

行为：
→ 获取全部311根K线
→ 检测和修复这311根的指标
→ 不会报错
→ 日志会显示实际数量：
   "K-lines in range: 311"
```

### 3. 混合使用建议

```python
# 生产环境：按时间（每天自动运行）
if is_production:
    repair_by_count = False
    repair_days_back = 7  # 检查最近一周

# 开发环境：按数量（手动运行）
if is_development:
    repair_by_count = True
    repair_klines_count = 2000  # 统一样本量
```

---

## 🎓 总结

### 核心原则

**K线修复 = 外部数据同步 → 必须按时间**
- 数据来自交易所API
- API要求时间范围
- 时间缺口有明确语义

**指标修复 = 本地数据计算 → 可按时间或数量**
- 数据来自本地K线
- 本地计算，灵活度高
- 按数量有实际意义（回测、对比）

### 选择建议

| 场景 | K线修复 | 指标修复 | 原因 |
|------|--------|---------|------|
| **⭐ 推荐** | **按时间** | **按数量** | **兼顾时间连续性和样本统一性** |
| 生产环境 | 按时间 | 按数量 | 确保K线连续，指标样本充足 |
| 实时交易 | 按时间 | 按时间 | 只需最近的数据 |
| 策略回测 | 按时间 | 按数量 | K线连续，指标样本统一 |
| 算法研究 | 不修复 | 按数量 | 只关心指标，样本量一致 |
| 紧急修复 | 按时间 | 按时间 | 快速修复最近时段 |
| 节点启动 | 按时间 | 按时间 | 快速检查最近几小时 |

### 最佳实践

```python
# ⭐ 推荐配置（混合模式）
repair_days_back = 30        # K线：确保30天时间连续性
repair_klines_count = 2000   # 指标：统一2000根样本量

# 节点启动时的快速检查
repair_hours_back_on_startup = 1  # 只检查最近1小时

# 使用方式
# 1. 节点启动时自动运行（快速检查）
python -m app.main kline --symbols BTCUSDT --timeframes 1h,3m
→ 检查最近1小时的K线和指标（按时间）

# 2. 手动深度修复（混合模式）
./scripts/repair_data.sh "BTCUSDT" "1h,3m"
→ K线：检查最近30天（按时间）
→ 指标：检查最近2000根（按数量）
```

---

## 📚 相关文档

- [指标元数据配置](./indicator-metadata.md)
- [指标改进报告](./indicator-improvement-report.md)
- [数据完整性服务](../backend/app/services/data_integrity.py)

---

**最后更新：** 2025-11-08
**版本：** v2.0 - 混合模式（K线按时间 + 指标按数量）

