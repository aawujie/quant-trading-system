# 快速开始指南

## 系统要求

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- uv (Python package manager)

## 快速启动

### 1. 克隆项目

```bash
git clone <repository-url>
cd quant-trading-system
```

### 2. 启动基础设施

```bash
# 启动 Redis 和 PostgreSQL
docker-compose up -d
```

### 3. 配置环境变量

```bash
cd backend
cp .env.example .env

# 编辑 .env 文件，添加你的币安 API 密钥（可选，用于实盘）
# BINANCE_API_KEY=your_api_key
# BINANCE_API_SECRET=your_api_secret
```

### 4. 安装 Python 依赖

```bash
cd backend
uv sync
```

### 5. 初始化数据库

```bash
uv run alembic upgrade head
```

### 6. 启动后端节点

```bash
# 方式 1: 使用启动脚本（推荐）
./scripts/dev_start.sh

# 方式 2: 手动启动各个节点
uv run python -m app.main --node kline --symbols BTCUSDT,ETHUSDT &
uv run python -m app.main --node indicator --symbols BTCUSDT,ETHUSDT &
uv run python -m app.main --node strategy --symbols BTCUSDT,ETHUSDT &
```

### 7. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:3000 启动

### 8. 停止服务

```bash
# 停止所有节点和基础设施
./scripts/dev_stop.sh
```

## 验证安装

### 检查 Docker 服务

```bash
docker-compose ps
```

应该看到 redis 和 postgres 服务正在运行。

### 检查后端节点

```bash
ps aux | grep "app.main"
```

应该看到 3 个 Python 进程（kline, indicator, strategy）。

### 检查日志

```bash
tail -f logs/kline_node.log
tail -f logs/indicator_node.log
tail -f logs/strategy_node.log
```

### 测试 API

```bash
# 检查 K 线数据
curl http://localhost:8000/api/klines/BTCUSDT/1h?limit=10

# 检查健康状态
curl http://localhost:8000/health
```

## 常见问题

### Q: 启动时提示端口被占用

A: 检查是否有其他服务占用了以下端口：
- 6379 (Redis)
- 5432 (PostgreSQL)
- 8000 (FastAPI REST API)
- 8001 (FastAPI WebSocket)
- 3000 (React Frontend)

```bash
# macOS/Linux
lsof -i :6379
lsof -i :5432

# 杀掉占用端口的进程
kill -9 <PID>
```

### Q: 数据库连接失败

A: 确保 PostgreSQL 容器正在运行：

```bash
docker-compose ps postgres
docker-compose logs postgres
```

### Q: TA-Lib 安装失败

A: TA-Lib 需要先安装 C 库：

```bash
# macOS
brew install ta-lib

# Ubuntu/Debian
sudo apt-get install ta-lib

# 然后重新安装 Python 包
uv sync
```

### Q: 前端无法连接 WebSocket

A: 检查 WebSocket 服务是否启动：

```bash
curl http://localhost:8001/health
```

## 下一步

- 查看 [系统架构文档](architecture.md) 了解系统设计
- 查看 [节点开发指南](node_development.md) 学习如何创建自定义策略
- 查看 [API 文档](api_spec.md) 了解 REST API 和 WebSocket 接口

