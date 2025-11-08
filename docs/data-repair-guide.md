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
3. **多种触发方式**：启动时自动、定时任务、手动触发
4. **详细报告**：提供完整的检测和修复报告

### 适用场景

- **服务器宕机**：系统重启后自动修复停机期间的数据
- **网络问题**：修复因网络中断导致的数据缺失
- **首次部署**：填充历史数据
- **日常维护**：定期检查和修复潜在的数据问题

---

## 🚀 使用方法

### 方法1：独立脚本（推荐）

```bash
# 进入项目目录
cd /Users/apple/code/quant-trading-system

# 只检查，不修复
uv run python scripts/repair_data.py --check-only

# 自动修复最近7天的数据
uv run python scripts/repair_data.py --days 7

# 修复特定交易对和时间周期
uv run python scripts/repair_data.py \
  --symbols BTCUSDT,ETHUSDT \
  --timeframes 1h,4h,1d \
  --days 30

# 修复现货市场数据
uv run python scripts/repair_data.py \
  --market spot \
  --days 7

# 查看帮助
uv run python scripts/repair_data.py --help
```

### 方法2：启动时自动修复

系统启动时会自动运行数据完整性检查（如果启用）：

```bash
# 修改配置
# backend/app/config.py
auto_repair_data: bool = True  # 启用自动修复
repair_days_back: int = 7      # 检查最近7天

# 启动系统（会自动修复）
cd backend
uv run python -m app.main --node all --symbols BTCUSDT,ETHUSDT --timeframes 1h
```

**输出示例：**
```
2025-11-08 10:00:00 - INFO - ✓ Database tables ready
2025-11-08 10:00:01 - INFO - 
2025-11-08 10:00:01 - INFO - 🔍 Running data integrity check...
============================================================
🔍 Starting Data Integrity Check
============================================================
📊 Checking BTCUSDT 1h...
   ✅ Data is complete
📊 Checking ETHUSDT 1h...
   ⚠️  Found 5 K-line gap(s)
   🔧 Backfilling K-lines...
   ✅ Backfilled 120 K-lines
   ⚠️  Found 120 indicator gap(s)
   🔧 Backfilling indicators...
   ✅ Backfilled 118 indicators
============================================================
📈 Data Integrity Check Complete
   K-line gaps found: 5
   Indicator gaps found: 120
   Status: ✅ All gaps have been repaired
============================================================
```

### 方法3：定时任务（Crontab）

**安装定时任务：**

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨2点运行）
0 2 * * * cd /Users/apple/code/quant-trading-system && /usr/local/bin/uv run python scripts/cron_repair_data.py >> logs/repair.log 2>&1
```

**查看日志：**
```bash
tail -f /Users/apple/code/quant-trading-system/logs/repair.log
```

### 方法4：HTTP API手动触发

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
      "kline_gaps": 2,
      "kline_missing_count": 24,
      "indicator_gaps": 24,
      "status": "incomplete"
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

### 环境变量配置

在 `backend/.env` 文件中配置：

```bash
# 数据完整性配置
AUTO_REPAIR_DATA=true      # 启动时自动修复
REPAIR_DAYS_BACK=7         # 检查最近N天

# 如果使用代理
PROXY_ENABLED=true
PROXY_HOST=127.0.0.1
PROXY_PORT=7897
```

### Python配置

在 `backend/app/config.py` 中：

```python
class Settings(BaseSettings):
    # Data Integrity Configuration
    auto_repair_data: bool = True  # 启动时自动修复数据
    repair_days_back: int = 7      # 检查最近N天的数据
```

### 定时任务配置

在 `scripts/cron_repair_data.py` 中：

```python
# 配置
symbols = ['BTCUSDT', 'ETHUSDT']     # 交易对
timeframes = ['1h', '4h', '1d']      # 时间周期
days_back = 7                         # 检查最近N天
market_type = 'future'                # 市场类型
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

Layer 2: 启动时检查（最近7天）
  └─ 快速修复短期缺失

Layer 3: 定时巡检（每天凌晨）
  └─ 修复过去30天的数据

Layer 4: 手动触发
  └─ 运维人员可随时修复
```

### 2. 推荐配置

**日常运行：**
```python
auto_repair_data = True
repair_days_back = 7  # 只检查最近7天，启动速度快
```

**定时任务：**
```python
days_back = 30  # 定时任务检查更长时间
```

**首次部署：**
```bash
# 回补全部历史数据
python scripts/repair_data.py --days 90 --verbose
```

### 3. 监控告警

在生产环境中，建议添加监控：

```python
# 伪代码
if total_gaps > threshold:
    send_alert_to_slack(f"⚠️ Data gaps detected: {total_gaps}")
    send_email_to_admin(gap_report)
```

### 4. 性能优化

**大批量修复：**
```python
# 分批处理，避免内存溢出
batch_size = 1000
for i in range(0, len(gaps), batch_size):
    batch = gaps[i:i+batch_size]
    await process_batch(batch)
    await asyncio.sleep(1)
```

**避免API限流：**
```python
# 每次请求后休眠
await asyncio.sleep(0.2)
```

### 5. 日志管理

**查看实时日志：**
```bash
tail -f logs/repair.log
```

**日志轮转（防止日志过大）：**
```bash
# 使用 logrotate
/Users/apple/code/quant-trading-system/logs/*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
}
```

---

## 🔍 故障排查

### 问题1：修复失败

**症状：** 脚本报错，数据未修复

**可能原因：**
- 网络连接问题
- API密钥无效
- 数据库连接失败

**解决方法：**
```bash
# 检查网络
curl -I https://api.binance.com

# 检查数据库
psql -U quant_user -d quant -c "SELECT 1"

# 使用verbose模式查看详细日志
python scripts/repair_data.py --days 7 --verbose
```

### 问题2：修复时间过长

**症状：** 修复任务运行很久

**可能原因：**
- 缺失数据量太大
- API限流
- 数据库性能

**解决方法：**
```bash
# 分批修复
python scripts/repair_data.py --days 7   # 先修复最近7天
python scripts/repair_data.py --days 30  # 再修复30天
```

### 问题3：指标修复失败

**症状：** K线修复成功，但指标依然缺失

**可能原因：**
- K线数量不足（需要至少120根）

**解决方法：**
```bash
# 先修复更长时间的K线
python scripts/repair_data.py --days 60

# 然后再修复指标
```

---

## 📊 效果验证

### 验证K线完整性

```sql
-- 检查K线数量
SELECT 
    symbol, 
    timeframe, 
    COUNT(*) as count,
    MIN(timestamp) as earliest,
    MAX(timestamp) as latest
FROM klines
WHERE market_type = 'future'
GROUP BY symbol, timeframe;
```

### 验证指标完整性

```sql
-- 检查指标覆盖率
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
GROUP BY k.symbol, k.timeframe;
```

**期望结果：**
```
 symbol   | timeframe | kline_count | indicator_count | coverage_pct 
----------+-----------+-------------+-----------------+--------------
 BTCUSDT  | 1h        |        1000 |             998 |        99.80
 ETHUSDT  | 1h        |        1000 |             998 |        99.80
```

---

## 📝 总结

数据回补系统提供了完善的数据完整性保障机制：

✅ **自动化**：启动时自动检查，无需人工干预  
✅ **多触发**：脚本、定时任务、API多种方式  
✅ **智能修复**：自动识别缺失并回补  
✅ **详细报告**：提供完整的修复报告  
✅ **高可靠**：多层防护，确保数据完整  

建议在生产环境中：
1. 启用 `auto_repair_data = True`
2. 设置每日定时任务
3. 配置监控告警
4. 定期查看修复日志

这样可以确保系统数据的完整性和稳定性！ 🚀

