## websocket调试工具

```shell
# 安装
npm install -g wscat

# 连接
wscat -c ws://localhost:8001/ws

# 收到欢迎消息
< {"type":"connection","status":"connected","message":"Welcome to Quantitative Trading System WebSocket"}

# 订阅主题
> {"action":"subscribe","topics":["kline:BTCUSDT:1h:future"]}

# 取消订阅
> {"action": "unsubscribe", "topics": ["kline:BTCUSDT:1h:future"]}

# 心跳
> {"action": "ping"}

# 查询所有活跃的 topics
> {"action": "list_topics"}

# 查看当前订阅的 topics
> {"action": "my_subscriptions"}

# 收到订阅确认
< {"type":"subscription","status":"success","topics":["kline:BTCUSDT:1h:future"]}

# 收到心跳响应
< {"type":"pong"}

# 收到 topics 列表
< {"type":"topics","topics":["kline:BTCUSDT:1h:future","kline:ETHUSDT:1h:future"],"count":2}

# 收到当前订阅列表
< {"type":"subscriptions","topics":["kline:BTCUSDT:1h:future"],"count":1}

# 收到实时数据
< {"topic":"kline:BTCUSDT:1h:future","data":{...}}
```

## Redis 调试工具

### 方法1：使用便捷脚本（推荐）

```shell
# 查看所有 Redis Topics（Pub/Sub + Streams）
./scripts/show_redis_topics.sh
```

### 方法2：直接使用 Docker 执行 Redis 命令

```shell
# 进入 Redis CLI（交互式）
docker exec -it quant-trading-system-redis-1 redis-cli

# 或者直接执行单个命令
docker exec quant-trading-system-redis-1 redis-cli <命令>
```

### 常用 Redis 命令

```shell
# 查看所有 Stream Topics（有历史消息的）
docker exec quant-trading-system-redis-1 redis-cli --scan --pattern "stream:*"

# 查看 Pub/Sub 活跃频道（当前有订阅者的）
docker exec quant-trading-system-redis-1 redis-cli PUBSUB CHANNELS

# 查看特定频道的订阅者数量
docker exec quant-trading-system-redis-1 redis-cli PUBSUB NUMSUB kline:BTCUSDT:1h:future

# 查看某个 Stream 的长度（消息数量）
docker exec quant-trading-system-redis-1 redis-cli XLEN stream:kline:BTCUSDT:1h:future

# 查看某个 Stream 的最新消息（最近5条）
docker exec quant-trading-system-redis-1 redis-cli XREVRANGE stream:kline:BTCUSDT:1h:future + - COUNT 5

# 查看某个 Stream 的最旧消息
docker exec quant-trading-system-redis-1 redis-cli XRANGE stream:kline:BTCUSDT:1h:future - + COUNT 5

# 清空某个 Stream
docker exec quant-trading-system-redis-1 redis-cli DEL stream:kline:BTCUSDT:1h:future

# 查看所有键
docker exec quant-trading-system-redis-1 redis-cli KEYS "*"

# 监控 Redis 实时命令（调试用）
docker exec -it quant-trading-system-redis-1 redis-cli MONITOR
```

### 调试技巧

```shell
# 1. 检查是否有数据发布到 Redis
docker exec -it quant-trading-system-redis-1 redis-cli MONITOR

# 2. 查看 Stream 是否有数据
./scripts/show_redis_topics.sh

# 3. 使用 wscat 测试订阅
wscat -c ws://localhost:8001/ws
> {"action": "list_topics"}
> {"action": "subscribe", "topics": ["kline:BTCUSDT:1h:future"]}

# 4. 查看特定消息内容
docker exec quant-trading-system-redis-1 redis-cli \
  XREVRANGE stream:kline:BTCUSDT:1h:future + - COUNT 1
```