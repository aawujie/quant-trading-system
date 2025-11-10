# 启动脚本使用说明

## 📋 脚本列表

### 1. `dev_start.sh` - 一键启动所有服务（推荐）

**功能：**
- ✅ 自动清理旧进程和端口占用
- ✅ 启动基础设施（Redis、PostgreSQL）
- ✅ 启动API服务器（REST API、WebSocket）
- ✅ 启动数据节点（K线、指标、策略）

**使用方法：**
```bash
./scripts/dev_start.sh
```

**启动顺序：**
1. 清理旧进程（防止端口冲突）
2. 启动Docker容器（Redis + PostgreSQL）
3. 初始化数据库
4. 启动API服务器（REST:8000, WebSocket:8001）
5. 启动K线节点（2秒间隔）
6. 启动指标节点
7. 启动策略节点

**配置：**
- K线更新间隔：**2秒**
- 监控币种：BTCUSDT, ETHUSDT
- 时间级别：3m, 5m, 15m, 30m, 1h, 4h, 1d
- 市场类型：future（永续合约）

---

### 2. `dev_stop.sh` - 停止所有服务

**功能：**
- ✅ 停止所有后端节点
- ✅ 停止API服务器
- ✅ 清理端口占用（8000, 8001）
- ✅ 停止Docker容器

**使用方法：**
```bash
./scripts/dev_stop.sh
```

---

### 3. `start_api_servers.sh` - 单独启动API服务器

**功能：**
- ✅ 仅启动REST API和WebSocket服务器
- ✅ 自动清理旧进程

**使用方法：**
```bash
./scripts/start_api_servers.sh
```

**适用场景：**
- 数据节点已在运行，只需重启API服务器
- 调试API服务器

---

### 4. `show_redis_topics.sh` - 查看 Redis Topics

**功能：**
- ✅ 显示所有 Pub/Sub 活跃频道
- ✅ 显示所有 Stream Topics 及消息数
- ✅ 统计 Topics 总数
- ✅ 提供常用 Redis 命令提示

**使用方法：**
```bash
./scripts/show_redis_topics.sh
```

**示例输出：**
```
================================
📊 Redis Topics 概览
================================

🔴 Pub/Sub 活跃频道（当前有订阅者）:
---
  - kline:*
  - indicator:*
  - signal:*

💾 Stream Topics（有历史消息）:
---
  - kline:BTCUSDT:1h:future (150 条消息)
  - kline:ETHUSDT:1h:future (145 条消息)
  - indicator:BTCUSDT:1h:future (100 条消息)

📈 统计信息:
---
  - Stream Topics: 3
  - 活跃 Channels: 3
```

**适用场景：**
- 调试 WebSocket 订阅问题
- 查看系统中有哪些数据流
- 检查消息是否正常发布

---

## 🔄 脚本关系说明

### 脚本关系图

```
┌─────────────────────────────────────────────────────────┐
│                   开发环境脚本体系                         │
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────┐
│   dev_start.sh       │      │   dev_stop.sh        │
│   完整启动（推荐）     │◄────►│   停止所有服务        │
└──────────────────────┘      └──────────────────────┘
         │
         │ 包含
         ▼
┌──────────────────────┐
│ start_api_servers.sh │
│  独立启动API服务器    │
└──────────────────────┘
```

### 核心概念

**`dev_start.sh`（完整版）= API服务器 + 数据节点**
- 包含了 `start_api_servers.sh` 的所有功能
- 额外启动K线、指标、策略节点
- 就像"全家桶"套餐 🍔

**`start_api_servers.sh`（精简版）= 只有API服务器**
- 只启动REST API和WebSocket
- 不启动数据节点
- 就像"单点"套餐 🍟

### 使用场景对比

| 场景 | 使用脚本 | 原因 |
|------|---------|------|
| 每天开始开发 | `dev_start.sh` | 启动所有服务 |
| 修改了API代码 | `start_api_servers.sh` | 只重启API，节省时间 |
| 修改了数据节点 | 手动重启对应节点 | 保持其他服务运行 |
| 完全重启 | `dev_stop.sh` → `dev_start.sh` | 彻底清理 |
| 结束开发 | `dev_stop.sh` | 释放所有资源 |

### 工作流推荐

**新手/日常开发：**
```bash
# 每次都用完整启动
./scripts/dev_start.sh
```

**进阶开发（效率更高）：**
```bash
# 第一次启动所有
./scripts/dev_start.sh

# 后续只在修改API代码时重启API
./scripts/start_api_servers.sh

# 几天后再完全停止
./scripts/dev_stop.sh
```

---

## 🚀 快速开始

### 完整启动流程

```bash
# 1. 启动后端所有服务
./scripts/dev_start.sh

# 2. 启动前端（另开终端）
cd frontend
npm run dev

# 3. 访问前端
# 打开浏览器: http://localhost:5173
```

### 停止服务

```bash
./scripts/dev_stop.sh
```

---

## 📊 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| REST API | 8000 | HTTP API接口 |
| WebSocket | 8001 | 实时数据推送 |
| Redis | 6379 | 消息队列 |
| PostgreSQL | 5432 | 数据存储 |
| Frontend | 5173 | Web界面（默认） |

---

## 📝 查看日志

```bash
# 查看所有K线节点日志
tail -f logs/kline_node.log

# 查看WebSocket日志
tail -f logs/websocket.log

# 查看REST API日志
tail -f logs/rest_api.log

# 查看指标节点日志
tail -f logs/indicator_node.log

# 查看策略节点日志
tail -f logs/strategy_node.log
```

---

## 🔧 常见问题

### 1. 端口被占用

**问题：** `Address already in use`

**解决：**
```bash
# 先停止所有服务
./scripts/dev_stop.sh

# 如果还有问题，手动清理端口
lsof -ti:8000 | xargs kill -9
lsof -ti:8001 | xargs kill -9

# 重新启动
./scripts/dev_start.sh
```

### 2. 前端无法连接WebSocket

**检查：**
1. WebSocket服务是否启动：`lsof -i:8001`
2. 查看WebSocket日志：`tail logs/websocket.log`
3. 浏览器控制台是否有错误

**解决：**
```bash
# 重启API服务器
./scripts/start_api_servers.sh
```

### 3. 前端数据不更新

**检查清单：**
- [ ] 后端服务是否全部启动
- [ ] 查看K线节点日志，确认有 "Published" 和 "subscribers"
- [ ] 查看WebSocket日志，确认连接已建立
- [ ] 浏览器控制台是否收到数据

**解决：**
```bash
# 完全重启所有服务
./scripts/dev_stop.sh
sleep 2
./scripts/dev_start.sh
```

### 4. Docker容器启动失败

**检查：**
```bash
docker ps
docker-compose logs
```

**解决：**
```bash
# 重建容器
docker-compose down -v
docker-compose up -d
```

---

## 💡 优化建议

### 开发环境配置

在 `backend/.env` 中配置：
```env
# 日志级别（DEBUG可查看详细日志）
LOG_LEVEL=DEBUG

# K线获取间隔（秒）
KLINE_FETCH_INTERVAL=2

# 市场类型
MARKET_TYPE=future
```

### 性能调优

如果需要更快的数据更新：
```bash
# 启动时指定更短的间隔（最小1秒）
cd backend
uv run python -m app.main --node kline \
  --symbols BTCUSDT,ETHUSDT \
  --timeframes 1m,5m,15m \
  --fetch-interval 1
```

---

## 🎯 验证服务状态

### 检查所有服务

```bash
# 检查进程
ps aux | grep python
ps aux | grep uvicorn

# 检查端口
lsof -i:8000  # REST API
lsof -i:8001  # WebSocket
lsof -i:6379  # Redis
lsof -i:5432  # PostgreSQL

# 检查Docker
docker ps
```

### 测试API连接

```bash
# 测试REST API
curl http://localhost:8000/health

# 测试WebSocket（使用websocat或浏览器控制台）
# 浏览器控制台运行：
# ws = new WebSocket('ws://localhost:8001/ws')
# ws.onmessage = (msg) => console.log(msg.data)
```

---

## 📦 更新说明

### v2.0 优化内容

1. **自动清理** - 启动前自动清理旧进程
2. **完整启动** - 一个脚本启动所有服务
3. **端口检查** - 自动释放被占用端口
4. **日志优化** - 更清晰的启动信息
5. **错误处理** - 更好的错误提示

### 主要变化

- ✅ `dev_start.sh` 现在会启动API服务器
- ✅ 自动清理旧进程，防止冲突
- ✅ K线更新间隔改为2秒（原5秒）
- ✅ 增加了端口清理功能
- ✅ 更详细的日志和提示信息

