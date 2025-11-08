# 数据回补系统使用指南

## 📋 目录
- [系统概述](#系统概述)
- [使用方法](#使用方法)
- [配置说明](#配置说明)
- [API接口](#api接口)
- [最佳实践](#最佳实践)

---

## 🎯 系统概述

数据回补系统用于自动检测和修复K线数据和指标数据的缺失，确保系统数据的完整性和连续性。

### 主要功能

1. **自动检测缺失**：扫描K线和指标数据，识别时间序列中的gap
2. **智能回补**：从交易所获取缺失的K线，重新计算缺失的指标
3. **多种触发方式**：启动时自动、专用修复节点、手动触发
4. **详细报告**：提供完整的检测和修复报告

### 适用场景

- **服务器宕机**：系统重启后自动修复停机期间的数据
- **网络问题**：修复因网络中断导致的数据缺失
- **首次部署**：填充历史数据
- **日常维护**：定期检查和修复潜在的数据问题

---

## 🚀 使用方法

### 方法1：专用修复节点（推荐）

使用 `repair` 节点进行深度数据修复：

```bash
# 进入后端目录
cd backend

# 深度修复（使用配置文件的参数）
uv run python -m app.main --node repair \
  --symbols BTCUSDT,ETHUSDT \
  --timeframes 1h,4h,1d

# 修复单个交易对
uv run python -m app.main --node repair \
  --symbols BTCUSDT \
  --timeframes 1h

# 修复更多交易对
uv run python -m app.main --node repair \
  --symbols BTCUSDT,ETHUSDT,BNBUSDT \
  --timeframes 1h,1d
```

**输出示例：**
```
2025-11-08 10:00:00 - INFO - ✓ Database tables ready
2025-11-08 10:00:01 - INFO - 
2025-11-08 10:00:01 - INFO - 🔧 Running DEEP data integrity repair...
2025-11-08 10:00:01 - INFO -    Checking last 30 day(s)
============================================================
🔍 Starting Data Integrity Check
============================================================
Symbols: ['BTCUSDT', 'ETHUSDT']
Timeframes: ['1h', '4h', '1d']
Market type: future

🔧 Repair Mode (Fixed):
  K-line: ✅ By time - 30.0 day(s)
  Indicator: ✅ By count - 1000 K-lines per timeframe
  Auto fix: True

📊 Checking BTCUSDT 1h...
   ⚠️  Found 800 indicator gap(s)
   🔧 Backfilling indicators...
   ✅ Backfilled 800 indicators

📊 Checking BTCUSDT 4h...
   ✅ Data is complete

📊 Checking BTCUSDT 1d...
   ⚠️  Found 107 indicator gap(s)
   🔧 Backfilling indicators...
   ✅ Backfilled 107 indicators

============================================================
📈 Data Integrity Check Complete
============================================================
K-line gaps found: 0
K-lines filled: 0
Indicator gaps found: 907
Indicators filled: 907
   Status: ✅ All gaps have been repaired
============================================================

✅ Deep repair completed!
```

**修复范围：**
- K线修复：最近 **30天**（`repair_days_back` 配置）
- 指标修复：最近 **1000根K线**（`repair_klines_count` 配置）

### 方法2：启动时自动修复

系统启动时会自动运行快速数据完整性检查（如果启用）：

```bash
cd backend

# 启动系统（会自动修复最近1小时的数据）
uv run python -m app.main --node all \
  --symbols BTCUSDT,ETHUSDT \
  --timeframes 1h
```

**自动修复特点：**
- K线检查：最近 **1小时**（`repair_hours_back_on_startup` 配置）
- 指标检查：最近 **1000根K线**（`repair_klines_count` 配置）
- **快速启动**：只检查最近数据，不影响启动速度

**输出示例：**
```
2025-11-08 10:00:00 - INFO - ✓ Database tables ready
2025-11-08 10:00:01 - INFO - 
2025-11-08 10:00:01 - INFO - 🔍 Running quick data integrity check...
2025-11-08 10:00:01 - INFO -    Checking last 1 hour(s)
============================================================
📊 Checking BTCUSDT 1h...
   ✅ Data is complete
============================================================
Status: ✅ All gaps have been repaired
============================================================

2025-11-08 10:00:02 - INFO - Starting KlineNode...
2025-11-08 10:00:02 - INFO - Starting IndicatorNode...
```

### 方法3：HTTP API手动触发

**检查数据状态：**
```bash
curl "http://localhost:8000/api/admin/data-status?symbols=BTCUSDT&timeframes=1h&days=7"
```

**响应示例：**
```json
{
  "status": "success",
  "data": {
    "BTCUSDT_1h": {
      "kline_gaps": 0,
      "kline_missing_count": 0,
      "indicator_gaps": 0,
      "status": "complete"
    }
  },
  "parameters": {
    "symbols": ["BTCUSDT"],
    "timeframes": ["1h"],
    "days": 7,
    "market_type": "future"
  }
}
```

**触发数据修复：**
```bash
curl -X POST "http://localhost:8000/api/admin/repair-data?symbols=BTCUSDT&timeframes=1h&days=7"
```

**响应示例：**
```json
{
  "status": "started",
  "message": "Data repair task started in background",
  "parameters": {
    "symbols": ["BTCUSDT"],
    "timeframes": ["1h"],
    "days": 7,
    "market_type": "future"
  }
}
```

---

## ⚙️ 配置说明

### 核心配置文件

在 `backend/app/config.py` 中：

```python
class Settings(BaseSettings):
    # Data Integrity Configuration
    auto_repair_data: bool = True  # 启动时自动修复数据
    repair_hours_back_on_startup: int = 1  # 启动时检查最近N小时（快速检查）
    
    # 修复范围配置（混合模式）
    repair_days_back: int = 30  # K线修复：检查最近N天（确保时间连续性）
    repair_klines_count: int = 1000  # 指标修复：每个周期修复N根K线（统一样本量）
```

### 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `auto_repair_data` | bool | True | 是否在节点启动时自动修复数据 |
| `repair_hours_back_on_startup` | int | 1 | 启动时快速检查最近N小时的数据 |
| `repair_days_back` | int | 30 | K线修复：检查最近N天的历史数据 |
| `repair_klines_count` | int | 1000 | 指标修复：检查最近N根K线的指标数据 |

### 推荐配置

**场景1：生产环境（高可用）**
```python
auto_repair_data = True
repair_hours_back_on_startup = 2  # 检查最近2小时
repair_days_back = 30  # 深度修复检查30天
repair_klines_count = 1000  # 确保足够的指标数据
```

**场景2：开发环境（快速启动）**
```python
auto_repair_data = True
repair_hours_back_on_startup = 1  # 只检查最近1小时
repair_days_back = 7  # 深度修复检查7天
repair_klines_count = 500  # 减少检查范围
```

**场景3：首次部署（完整回补）**
```python
auto_repair_data = True
repair_hours_back_on_startup = 1  # 快速启动
repair_days_back = 90  # 深度修复检查90天
repair_klines_count = 2000  # 更多历史指标
```

然后运行深度修复：
```bash
cd backend
uv run python -m app.main --node repair --symbols BTCUSDT --timeframes 1h,1d
```

### 环境变量配置

在 `backend/.env` 文件中配置（可选）：

```bash
# 数据完整性配置
AUTO_REPAIR_DATA=true
REPAIR_HOURS_BACK_ON_STARTUP=1
REPAIR_DAYS_BACK=30
REPAIR_KLINES_COUNT=1000

# 如果使用代理
PROXY_ENABLED=true
PROXY_HOST=127.0.0.1
PROXY_PORT=7897
```

---

## 🌐 API接口

### 1. 检查数据状态

**Endpoint:**
```
GET /api/admin/data-status
```

**参数:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| symbols | string | BTCUSDT | 交易对列表（逗号分隔） |
| timeframes | string | 1h | 时间周期列表（逗号分隔） |
| days | int | 7 | 检查最近N天 |
| market_type | string | future | 市场类型 |

**响应:**
```json
{
  "status": "success",
  "data": {
    "BTCUSDT_1h": {
      "kline_gaps": 0,
      "kline_missing_count": 0,
      "indicator_gaps": 0,
      "status": "complete"
    }
  }
}
```

### 2. 触发数据修复

**Endpoint:**
```
POST /api/admin/repair-data
```

**参数:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| symbols | string | BTCUSDT,ETHUSDT | 交易对列表 |
| timeframes | string | 1h,4h,1d | 时间周期列表 |
| days | int | 7 | 检查最近N天（1-90） |
| market_type | string | future | 市场类型 |

**响应:**
```json
{
  "status": "started",
  "message": "Data repair task started in background"
}
```

---

## 💡 最佳实践

### 1. 多层防护策略

```
Layer 1: 实时监控 + 重试机制
  └─ K线节点、指标节点内置重试

Layer 2: 启动时快速检查（最近1小时）
  └─ 快速修复短期缺失，不影响启动速度

Layer 3: 定期深度修复
  └─ 使用 repair 节点定期全面检查

Layer 4: 手动触发
  └─ 运维人员可通过 API 随时修复
```

### 2. 日常运维流程

**每日检查（推荐）：**
```bash
# 每天运行一次深度修复（可加入crontab）
cd /Users/apple/code/quant-trading-system/backend
uv run python -m app.main --node repair \
  --symbols BTCUSDT,ETHUSDT \
  --timeframes 1h,4h,1d >> ../logs/repair.log 2>&1
```

**添加到 crontab：**
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨2点运行）
0 2 * * * cd /Users/apple/code/quant-trading-system/backend && /usr/local/bin/uv run python -m app.main --node repair --symbols BTCUSDT,ETHUSDT --timeframes 1h,4h,1d >> ../logs/repair.log 2>&1
```

**查看日志：**
```bash
tail -f /Users/apple/code/quant-trading-system/logs/repair.log
```

### 3. 监控建议

**数据完整性监控：**
```bash
# 定期检查数据状态
curl "http://localhost:8000/api/admin/data-status?symbols=BTCUSDT&timeframes=1h&days=7" | jq

# 检查指标覆盖率
psql -U quant_user -d quant -c "
SELECT 
    k.symbol,
    k.timeframe,
    COUNT(DISTINCT k.timestamp) as kline_count,
    COUNT(DISTINCT i.timestamp) as indicator_count,
    ROUND(100.0 * COUNT(DISTINCT i.timestamp) / COUNT(DISTINCT k.timestamp), 2) as coverage_pct
FROM klines k
LEFT JOIN indicators i ON 
    k.symbol = i.symbol AND 
    k.timeframe = i.timeframe AND 
    k.timestamp = i.timestamp
WHERE k.market_type = 'future'
GROUP BY k.symbol, k.timeframe;
"
```

**期望结果：**
```
 symbol   | timeframe | kline_count | indicator_count | coverage_pct 
----------+-----------+-------------+-----------------+--------------
 BTCUSDT  | 1h        |        1000 |             998 |        99.80
 ETHUSDT  | 1h        |        1000 |             998 |        99.80
```

### 4. 性能优化

**避免启动延迟：**
- 使用较小的 `repair_hours_back_on_startup`（如1小时）
- 深度修复使用独立的 `repair` 节点，不要在启动时运行

**避免API限流：**
- 系统已内置限流保护
- 大批量修复会自动控制请求速度

**数据库优化：**
```sql
-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_klines_lookup 
ON klines (symbol, timeframe, timestamp, market_type);

CREATE INDEX IF NOT EXISTS idx_indicators_lookup 
ON indicators (symbol, timeframe, timestamp, market_type);
```

### 5. 常见场景处理

**场景1：系统宕机后重启**
```bash
# 启动时会自动修复最近1小时
cd backend
uv run python -m app.main --node all --symbols BTCUSDT --timeframes 1h

# 如果宕机时间较长，手动运行深度修复
uv run python -m app.main --node repair --symbols BTCUSDT --timeframes 1h
```

**场景2：新增交易对**
```bash
# 为新交易对回补历史数据
cd backend
uv run python -m app.main --node repair \
  --symbols NEWCOIN \
  --timeframes 1h,4h,1d
```

**场景3：网络故障后恢复**
```bash
# 检查数据状态
curl "http://localhost:8000/api/admin/data-status?symbols=BTCUSDT&timeframes=1h&days=1"

# 触发修复
curl -X POST "http://localhost:8000/api/admin/repair-data?symbols=BTCUSDT&timeframes=1h&days=1"
```

---

## 🔍 故障排查

### 问题1：修复失败

**症状：** 修复节点报错，数据未修复

**可能原因：**
- 网络连接问题
- API密钥无效
- 数据库连接失败

**解决方法：**
```bash
# 检查网络
curl -I https://fapi.binance.com

# 检查数据库
psql -U quant_user -d quant -c "SELECT 1"

# 检查配置
cd backend
cat .env | grep -E "BINANCE|DATABASE|PROXY"
```

### 问题2：指标数据不完整

**症状：** K线存在，但指标缺失

**原因：** 指标计算需要至少120根K线作为基础数据

**解决方法：**
```bash
# 1. 确保配置的 repair_klines_count 足够大
# 在 config.py 中设置
repair_klines_count = 1000  # 至少要大于120

# 2. 运行深度修复
cd backend
uv run python -m app.main --node repair --symbols BTCUSDT --timeframes 1h
```

### 问题3：前端指标不显示

**症状：** 前端日志显示 "⚠️ No indicator data available"

**原因：** 数据库中指标数据量不足

**解决方法：**
```bash
# 1. 检查数据库中的指标数量
psql -U quant_user -d quant -c "
SELECT symbol, timeframe, COUNT(*) 
FROM indicators 
WHERE market_type='future' 
GROUP BY symbol, timeframe;
"

# 2. 如果数量少于500，增加 repair_klines_count
# 修改 backend/app/config.py
repair_klines_count = 1000

# 3. 运行修复
cd backend
uv run python -m app.main --node repair \
  --symbols BTCUSDT \
  --timeframes 1h,1d
```

### 问题4：修复时间过长

**症状：** 修复任务运行很久

**原因：** 缺失数据量太大

**解决方法：**
```bash
# 减少修复范围
# 修改 backend/app/config.py
repair_days_back = 7  # 从30天改为7天

# 或者分批修复
cd backend
# 先修复1天
uv run python -m app.main --node repair --symbols BTCUSDT --timeframes 1h
# 然后逐步增加配置的天数
```

---

## 📊 效果验证

### 验证K线完整性

```sql
-- 检查K线数量和时间范围
SELECT 
    symbol, 
    timeframe, 
    market_type,
    COUNT(*) as count,
    TO_TIMESTAMP(MIN(timestamp)) as earliest,
    TO_TIMESTAMP(MAX(timestamp)) as latest
FROM klines
WHERE market_type = 'future'
GROUP BY symbol, timeframe, market_type
ORDER BY symbol, timeframe;
```

### 验证指标完整性

```sql
-- 检查指标覆盖率
SELECT 
    k.symbol,
    k.timeframe,
    k.market_type,
    COUNT(DISTINCT k.timestamp) as kline_count,
    COUNT(DISTINCT i.timestamp) as indicator_count,
    ROUND(100.0 * COUNT(DISTINCT i.timestamp) / COUNT(DISTINCT k.timestamp), 2) as coverage_pct,
    CASE 
        WHEN COUNT(DISTINCT i.timestamp) * 100.0 / COUNT(DISTINCT k.timestamp) >= 99.0 THEN '✅ Good'
        WHEN COUNT(DISTINCT i.timestamp) * 100.0 / COUNT(DISTINCT k.timestamp) >= 90.0 THEN '⚠️ OK'
        ELSE '❌ Poor'
    END as status
FROM klines k
LEFT JOIN indicators i ON 
    k.symbol = i.symbol AND 
    k.timeframe = i.timeframe AND 
    k.timestamp = i.timestamp AND
    k.market_type = i.market_type
WHERE k.market_type = 'future'
GROUP BY k.symbol, k.timeframe, k.market_type
ORDER BY k.symbol, k.timeframe;
```

### 检查特定指标字段

```sql
-- 检查各个指标的可用性
SELECT 
    symbol,
    timeframe,
    COUNT(*) as total,
    COUNT(ma5) as ma5_count,
    COUNT(ma10) as ma10_count,
    COUNT(ma20) as ma20_count,
    COUNT(ma60) as ma60_count,
    COUNT(ma120) as ma120_count,
    ROUND(100.0 * COUNT(ma120) / COUNT(*), 2) as ma120_coverage
FROM indicators
WHERE market_type = 'future'
  AND symbol = 'BTCUSDT'
  AND timeframe = '1h'
GROUP BY symbol, timeframe;
```

---

## 📝 总结

数据回补系统提供了完善的数据完整性保障机制：

✅ **自动化**：启动时自动检查，无需人工干预  
✅ **灵活配置**：可调整检查范围和修复策略  
✅ **专用节点**：独立的 repair 节点不影响正常服务  
✅ **API支持**：可通过HTTP API远程触发修复  
✅ **详细报告**：提供完整的检测和修复日志  

### 推荐配置（生产环境）

```python
# backend/app/config.py
auto_repair_data = True  # 启动时自动修复
repair_hours_back_on_startup = 1  # 快速检查最近1小时
repair_days_back = 30  # 深度修复检查30天
repair_klines_count = 1000  # 确保1000根K线的指标数据
```

### 推荐运维流程

1. **启动系统**：自动修复最近1小时
2. **每日定时**：使用 crontab 运行 repair 节点
3. **监控告警**：定期检查数据状态API
4. **定期验证**：运行SQL查询验证数据完整性

这样可以确保系统数据的完整性和稳定性！ 🚀
