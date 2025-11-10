#!/bin/bash
# 查看 Redis 中的所有 Topics
# 适用于 Docker 环境

set -e

# Redis 容器名称（根据 docker-compose.yml 自动生成）
CONTAINER_NAME="quant-trading-system-redis-1"

# 检查容器是否运行
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    echo "❌ Redis 容器未运行"
    echo "尝试查找其他 Redis 容器..."
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep redis | head -1)
    if [ -z "$CONTAINER_NAME" ]; then
        echo "❌ 未找到运行中的 Redis 容器"
        echo "请先启动 Redis: docker-compose up -d redis"
        exit 1
    fi
    echo "✅ 找到容器: $CONTAINER_NAME"
fi

echo "================================"
echo "📊 Redis Topics 概览"
echo "================================"
echo ""

# 1. 查看 Pub/Sub 活跃频道（有订阅者的）
echo "🔴 Pub/Sub 活跃频道（当前有订阅者）:"
echo "---"
CHANNELS=$(docker exec "$CONTAINER_NAME" redis-cli PUBSUB CHANNELS)
if [ -z "$CHANNELS" ]; then
    echo "  （无活跃订阅）"
else
    echo "$CHANNELS" | sed 's/^/  - /'
fi
echo ""

# 2. 查看 Stream 存储的 Topics（有历史消息的）
echo "💾 Stream Topics（有历史消息）:"
echo "---"
STREAMS=$(docker exec "$CONTAINER_NAME" redis-cli --scan --pattern "stream:*")
if [ -z "$STREAMS" ]; then
    echo "  （无历史消息）"
else
    # 移除 "stream:" 前缀并统计消息数
    echo "$STREAMS" | while read -r stream; do
        if [ -n "$stream" ]; then
            topic=${stream#stream:}
            length=$(docker exec "$CONTAINER_NAME" redis-cli XLEN "$stream")
            echo "  - $topic ($length 条消息)"
        fi
    done
fi
echo ""

# 3. 统计信息
echo "📈 统计信息:"
echo "---"
STREAM_COUNT=$(docker exec "$CONTAINER_NAME" redis-cli --scan --pattern "stream:*" | wc -l)
CHANNEL_COUNT=$(docker exec "$CONTAINER_NAME" redis-cli PUBSUB CHANNELS | wc -l)
echo "  - Stream Topics: $STREAM_COUNT"
echo "  - 活跃 Channels: $CHANNEL_COUNT"
echo ""

# 4. 快捷命令提示
echo "💡 快捷命令:"
echo "---"
echo "  进入 Redis CLI:"
echo "    docker exec -it $CONTAINER_NAME redis-cli"
echo ""
echo "  查看某个 Stream 的最新消息:"
echo "    docker exec $CONTAINER_NAME redis-cli XREVRANGE stream:kline:BTCUSDT:1h:future + - COUNT 5"
echo ""
echo "  查看某个频道的订阅者数:"
echo "    docker exec $CONTAINER_NAME redis-cli PUBSUB NUMSUB kline:BTCUSDT:1h:future"
echo ""
echo "================================"

