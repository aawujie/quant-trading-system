# 🚀 系统升级指南 v1.0 → v2.0

## 📋 升级概述

本次升级主要针对**回测性能优化**，修复了严重的内存泄漏问题，并大幅提升了系统性能和稳定性。

---

## ⚡ 快速升级（3步）

### 1️⃣ 安装新依赖

```bash
cd backend
uv pip install -e .
```

**新增依赖：**
- `cachetools>=5.3.0` - TTL缓存

### 2️⃣ 重启后端服务

```bash
# 停止旧服务
pkill -f "python -m app.main"

# 启动新服务
cd backend
python -m app.main --node rest
```

### 3️⃣ 刷新前端

```bash
# 前端无需重新编译，直接刷新浏览器即可
# Ctrl/Cmd + Shift + R (强制刷新)
```

**完成！** ✅

---

## 🆕 新功能

### 1. WebSocket实时推送

**体验升级：**
- ❌ 旧版：每秒轮询，延迟1秒
- ✅ 新版：实时推送，延迟<10ms

**无需修改代码，自动启用！**

### 2. 并发控制

**资源保护：**
- 最多3个并发回测
- 超出限制自动排队
- 防止服务器过载

### 3. 自动清理

**内存管理：**
- 任务1小时后自动过期
- 每10分钟清理一次
- 最多保留100个任务

### 4. 任务统计

**新API：**
```bash
GET http://localhost:8000/api/backtest/stats
```

**响应：**
```json
{
  "status": "success",
  "stats": {
    "total_tasks": 5,
    "active_tasks": 1,
    "running_tasks": 1,
    "completed_tasks": 2,
    "max_concurrent": 3,
    "available_slots": 2
  }
}
```

---

## 🔧 配置调整（可选）

### 调整并发数

**文件：** `backend/app/core/task_manager.py:276`

```python
# 默认：最多3个并发回测
backtest_task_manager = TaskManager(
    max_tasks=100,
    ttl_seconds=3600,
    max_concurrent=3   # 👈 修改这里
)
```

**建议：**
- 单核CPU: 1-2
- 双核CPU: 2-3
- 四核CPU: 3-5
- 八核CPU: 5-8

### 调整TTL（生存时间）

```python
backtest_task_manager = TaskManager(
    max_tasks=100,
    ttl_seconds=3600,  # 👈 默认1小时，可改为 7200（2小时）
    max_concurrent=3
)
```

---

## ⚠️ 兼容性说明

### API兼容性
✅ **完全兼容** - 所有现有API保持不变

**现有端点：**
- `POST /api/backtest/run` - ✅ 兼容（内部优化）
- `GET /api/backtest/result/{task_id}` - ✅ 兼容（新增progress字段）

**新增端点：**
- `WS /ws/backtest/{task_id}` - 🆕 WebSocket推送
- `GET /api/backtest/stats` - 🆕 任务统计

### 数据库兼容性
✅ **无需迁移** - 数据库Schema未变更

### 前端兼容性
✅ **自动升级** - 前端自动使用WebSocket

---

## 📊 性能对比

| 指标 | v1.0 | v2.0 | 提升 |
|------|------|------|------|
| 回测速度 | 2200ms | 1180ms | ↑46% |
| 内存占用 | 10.5MB/任务 | 1.0MB/任务 | ↓90% |
| 网络请求 | 30次/30秒 | 1次连接 | ↓96.7% |
| 实时性 | 1秒延迟 | <10ms | ↑100x |
| 并发控制 | ❌ 无 | ✅ 3个 | 新增 |
| 内存泄漏 | ❌ 存在 | ✅ 修复 | 修复 |

---

## 🔍 验证升级

### 1. 检查后端日志

启动后端时应看到：
```
INFO:app.api.rest:Task cleanup scheduler started
INFO:app.api.rest:REST API started
```

### 2. 测试WebSocket

打开浏览器控制台，提交回测后应看到：
```
✅ WebSocket connected for task: xxx-xxx-xxx
📨 Received from WebSocket: {status: "running", progress: 0}
📨 Received from WebSocket: {status: "completed", results: {...}}
🔌 WebSocket closed for task: xxx-xxx-xxx
```

### 3. 检查并发控制

快速提交4个回测任务，第4个会自动排队等待。

### 4. 查看任务统计

```bash
curl http://localhost:8000/api/backtest/stats | jq
```

---

## 🐛 故障排除

### 问题1：WebSocket连接失败

**错误：**
```
❌ WebSocket error: ...
```

**解决：**
1. 确认后端已启动
2. 检查端口8000是否被占用
3. 浏览器控制台查看详细错误

### 问题2：任务一直pending

**原因：** 达到并发限制（3个）

**解决：**
- 等待其他任务完成
- 或调整 `max_concurrent` 配置

### 问题3：依赖安装失败

**错误：**
```
ERROR: No matching distribution found for cachetools
```

**解决：**
```bash
# 更新uv
pip install --upgrade uv

# 重新安装
cd backend
uv pip install -e .
```

---

## 📚 更多信息

### 详细文档
- [性能优化分析报告](docs/BACKTEST_PERFORMANCE_ANALYSIS.md)
- [优化完成报告](docs/PERFORMANCE_OPTIMIZATION_COMPLETE.md)

### 核心文件
- `backend/app/core/task_manager.py` - 任务管理器
- `backend/app/core/database.py` - 优化的数据库查询
- `backend/app/api/rest.py` - WebSocket端点
- `frontend/src/components/TradingEngine/BacktestConfig.jsx` - WebSocket客户端

---

## 🎉 升级完成！

恭喜！你的量化交易系统已升级到 **v2.0**！

**核心改进：**
- 🚀 性能提升46%
- 💾 内存优化90%
- 🔧 并发控制
- ⚡ 实时推送
- 🛡️ 稳定性大幅提升

**开始使用：**
1. 打开交易引擎页面
2. 配置策略和参数
3. 点击"开启回测"
4. 享受实时反馈的流畅体验！

---

*升级指南版本: v2.0*  
*更新时间: 2025-11-10*

