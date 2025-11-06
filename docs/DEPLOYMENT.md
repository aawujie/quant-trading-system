# 部署指南

## 生产环境部署

本文档介绍如何将系统部署到生产环境。

## 部署架构

### 推荐架构

```
┌─────────────────────────────────────────────┐
│            Load Balancer (Nginx)           │
└───────────────┬─────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌────────┐             ┌─────────┐
│Frontend│             │ Backend │
│(React) │             │ (多进程) │
└────────┘             └─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌────────┐        ┌────────┐        ┌────────┐
   │ Redis  │        │Postgres│        │Exchange│
   │        │        │        │        │  API   │
   └────────┘        └────────┘        └────────┘
```

## 部署选项

### 选项 1: Docker Compose（单机部署）

适合中小规模部署，所有服务运行在单台服务器上。

#### 1. 准备环境

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 配置生产环境

创建 `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - trading_network

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: quant
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - trading_network

  kline_node:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    command: python -m app.main --node kline --symbols ${SYMBOLS} --timeframes ${TIMEFRAMES}
    environment:
      REDIS_HOST: redis
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/quant
      BINANCE_API_KEY: ${BINANCE_API_KEY}
      BINANCE_API_SECRET: ${BINANCE_API_SECRET}
    depends_on:
      - redis
      - postgres
    networks:
      - trading_network

  indicator_node:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    command: python -m app.main --node indicator --symbols ${SYMBOLS} --timeframes ${TIMEFRAMES}
    environment:
      REDIS_HOST: redis
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/quant
    depends_on:
      - redis
      - postgres
    networks:
      - trading_network

  strategy_node:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    command: python -m app.main --node strategy --symbols ${SYMBOLS} --timeframe ${TIMEFRAME}
    environment:
      REDIS_HOST: redis
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/quant
    depends_on:
      - redis
      - postgres
    networks:
      - trading_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"
    depends_on:
      - kline_node
      - indicator_node
      - strategy_node
    networks:
      - trading_network

networks:
  trading_network:
    driver: bridge

volumes:
  redis_data:
  postgres_data:
```

#### 3. 部署

```bash
# 设置环境变量
export DB_USER=quant_user
export DB_PASSWORD=secure_password
export SYMBOLS=BTCUSDT,ETHUSDT
export TIMEFRAMES=1h
export TIMEFRAME=1h
export BINANCE_API_KEY=your_api_key
export BINANCE_API_SECRET=your_api_secret

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 选项 2: 多进程部署（无 Docker）

适合需要最大性能的场景。

#### 1. 安装依赖

```bash
# 安装系统依赖
sudo apt-get update
sudo apt-get install -y redis-server postgresql ta-lib

# 安装 Python 依赖
cd backend
uv sync
```

#### 2. 配置 systemd 服务

创建 `/etc/systemd/system/quant-kline.service`:

```ini
[Unit]
Description=Quant Trading - K-line Node
After=network.target redis.service postgresql.service

[Service]
Type=simple
User=trading
WorkingDirectory=/opt/quant-trading-system/backend
ExecStart=/usr/bin/uv run python -m app.main --node kline --symbols BTCUSDT,ETHUSDT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

类似地创建 `quant-indicator.service` 和 `quant-strategy.service`。

#### 3. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable quant-kline quant-indicator quant-strategy
sudo systemctl start quant-kline quant-indicator quant-strategy

# 检查状态
sudo systemctl status quant-*
```

## 监控与日志

### 日志管理

使用 ELK Stack 或 Grafana Loki 收集日志：

```yaml
# docker-compose.prod.yml 中添加
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "10"
```

### 性能监控

使用 Prometheus + Grafana：

```yaml
# 添加 Prometheus 导出器
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: admin
```

## 安全性

### 1. 使用强密码

```bash
# 生成随机密码
openssl rand -base64 32
```

### 2. 启用防火墙

```bash
# 只开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. 使用 HTTPS

配置 Nginx 反向代理:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. 定期备份

```bash
# PostgreSQL 备份脚本
#!/bin/bash
BACKUP_DIR=/backup/postgres
DATE=$(date +%Y%m%d_%H%M%S)

docker exec postgres pg_dump -U quant_user quant > $BACKUP_DIR/quant_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "quant_*.sql" -mtime +7 -delete
```

## 性能优化

### 1. PostgreSQL 调优

编辑 `postgresql.conf`:

```ini
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

### 2. Redis 调优

编辑 `redis.conf`:

```ini
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 3. 调整进程数

根据 CPU 核心数调整节点数量：

- 4 核 CPU: 各运行 1 个节点
- 8 核 CPU: K线节点 2 个，其他各 2 个
- 16 核 CPU: 根据负载动态调整

## 故障排除

### 问题: 节点崩溃

```bash
# 检查日志
docker-compose -f docker-compose.prod.yml logs --tail=100 kline_node

# 重启节点
docker-compose -f docker-compose.prod.yml restart kline_node
```

### 问题: 数据库连接池耗尽

增加连接池大小：

```python
# database.py
self.engine = create_async_engine(
    database_url,
    pool_size=20,  # 增加连接池大小
    max_overflow=40
)
```

### 问题: Redis 内存不足

增加 Redis 内存或启用淘汰策略：

```bash
docker-compose exec redis redis-cli CONFIG SET maxmemory 512mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 扩展

### 水平扩展

- 使用 Kubernetes 部署，自动扩展节点数
- 使用 Redis Cluster 扩展消息总线
- 使用 PostgreSQL 主从复制提高读性能

### 垂直扩展

- 升级服务器硬件（CPU、内存、SSD）
- 使用专用服务器分离组件（数据库、缓存、应用）

