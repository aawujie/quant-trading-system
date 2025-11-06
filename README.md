# Quantitative Trading System

一个基于节点架构的量化交易系统，使用 Redis Pub/Sub 进行消息通信，PostgreSQL 持久化数据，React + TradingView Lightweight Charts 实现前端。

## 架构特点

- **节点化架构**：K线节点、指标计算节点、策略节点独立运行
- **消息总线**：Redis Pub/Sub + Streams 实现实时通信和历史回溯
- **数据持久化**：PostgreSQL 存储 K线、指标和信号，避免重复计算
- **多进程部署**：避免 Python GIL，充分利用多核 CPU
- **React 前端**：基于 TradingView Lightweight Charts 的现代化界面

## 快速开始

### 1. 启动基础设施

```bash
docker-compose up -d
```

### 2. 安装 Python 依赖

```bash
cd backend
uv sync
```

### 3. 初始化数据库

```bash
cd backend
uv run alembic upgrade head
```

### 4. 启动节点

```bash
# 开发环境 - 多进程模式
cd backend
uv run python -m app.main --node kline --symbols BTCUSDT,ETHUSDT &
uv run python -m app.main --node indicator --symbols BTCUSDT,ETHUSDT &
uv run python -m app.main --node strategy --symbols BTCUSDT,ETHUSDT &
```

### 5. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
quant-trading-system/
├── backend/              # Python 后端
│   ├── app/
│   │   ├── core/        # 核心模块（消息总线、节点基类、数据库）
│   │   ├── models/      # 数据模型
│   │   ├── nodes/       # 节点实现
│   │   ├── exchanges/   # 交易所接口
│   │   ├── api/         # REST API 和 WebSocket
│   │   └── services/    # 服务（回测、实盘）
│   └── pyproject.toml
├── frontend/            # React 前端
├── docker-compose.yml   # Docker 配置
└── docs/               # 文档
```

## 文档

- [系统架构](docs/architecture.md)
- [节点开发指南](docs/node_development.md)
- [API 接口文档](docs/api_spec.md)
- [部署指南](docs/deployment.md)

## 技术栈

**后端**
- FastAPI - Web 框架
- Redis - 消息总线
- PostgreSQL - 数据持久化
- SQLAlchemy - ORM
- TA-Lib - 技术指标计算
- ccxt - 交易所API

**前端**
- React - UI 框架
- Vite - 构建工具
- TradingView Lightweight Charts - 图表库
- Zustand - 状态管理

## License

MIT

