"""WebSocket endpoint for real-time data streaming"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import redis.asyncio as redis

from app.core.message_bus import MessageBus
from app.config import settings

logger = logging.getLogger(__name__)

# Global task reference
redis_bridge_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    import sys
    global redis_bridge_task
    
    sys.stdout.write("=" * 60 + "\n")
    sys.stdout.write("WebSocket服务器启动中...\n")
    sys.stdout.write("=" * 60 + "\n")
    sys.stdout.flush()
    logger.info("WebSocket server starting up...")
    
    try:
        # Start Redis bridge task
        redis_bridge_task = asyncio.create_task(start_redis_bridge())
        logger.info("✅ Redis bridge task created")
        sys.stdout.write("✅ Redis桥接任务已创建\n")
        sys.stdout.flush()
        
        yield  # Server is running
        
    except Exception as e:
        logger.error(f"❌ Failed to start Redis bridge: {e}", exc_info=True)
        sys.stdout.write(f"❌ Redis桥接启动失败: {e}\n")
        sys.stdout.flush()
        yield
    finally:
        # Shutdown
        sys.stdout.write("WebSocket服务器关闭中...\n")
        sys.stdout.flush()
        if redis_bridge_task:
            redis_bridge_task.cancel()
        logger.info("WebSocket server shutdown")

# Create FastAPI app for WebSocket with lifespan
ws_app = FastAPI(title="WebSocket Server", lifespan=lifespan)

# Connection manager
class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        self.redis_client: Optional[redis.Redis] = None
    
    async def connect(self, websocket: WebSocket):
        """Accept new connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        logger.info(f"New WebSocket connection (total: {len(self.active_connections)})")
    
    def disconnect(self, websocket: WebSocket):
        """Remove connection"""
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        logger.info(f"WebSocket disconnected (total: {len(self.active_connections)})")
    
    async def subscribe(self, websocket: WebSocket, topics: list):
        """Subscribe connection to topics"""
        self.subscriptions[websocket].update(topics)
        logger.info(f"Subscribed to topics: {topics}")
    
    async def unsubscribe(self, websocket: WebSocket, topics: list):
        """Unsubscribe connection from topics"""
        self.subscriptions[websocket].difference_update(topics)
        logger.info(f"Unsubscribed from topics: {topics}")
    
    def set_redis_client(self, redis_client: redis.Redis):
        """Set Redis client for topic listing"""
        self.redis_client = redis_client
    
    async def get_active_topics(self) -> List[str]:
        """
        Get all active topics from Redis streams
        
        Returns:
            List of active topic names
        """
        if not self.redis_client:
            logger.warning("Redis client not set, returning empty topic list")
            return []
        
        try:
            # 使用 SCAN 命令查找所有 stream: 开头的键
            topics = []
            cursor = 0
            
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor, 
                    match="stream:*",
                    count=100
                )
                
                for key in keys:
                    # 将 bytes 转换为字符串并移除 "stream:" 前缀
                    if isinstance(key, bytes):
                        key_str = key.decode()
                    else:
                        key_str = key
                    
                    # 移除 "stream:" 前缀
                    if key_str.startswith("stream:"):
                        topic = key_str[7:]  # 去掉 "stream:" 前缀
                        topics.append(topic)
                
                # cursor 返回 0 表示扫描完成
                if cursor == 0:
                    break
            
            logger.info(f"Found {len(topics)} active topics")
            return sorted(topics)  # 返回排序后的列表
            
        except Exception as e:
            logger.error(f"Failed to get active topics: {e}")
            return []
    
    async def broadcast(self, topic: str, data: dict):
        """Broadcast message to subscribed connections"""
        message = {
            "topic": topic,
            "data": data
        }
        
        disconnected = set()
        
        for connection in self.active_connections:
            # Check if connection is subscribed to this topic
            if topic in self.subscriptions.get(connection, set()):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send message: {e}")
                    disconnected.add(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@ws_app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time data streaming
    
    Message format:
    
    Client -> Server:
    {
        "action": "subscribe",
        "topics": ["kline:BTCUSDT:1h", "indicator:BTCUSDT:1h"]
    }
    
    Server -> Client:
    {
        "topic": "kline:BTCUSDT:1h",
        "data": {
            "symbol": "BTCUSDT",
            "timeframe": "1h",
            "timestamp": 1705320000,
            ...
        }
    }
    """
    await manager.connect(websocket)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "message": "Welcome to Quantitative Trading System WebSocket"
        })
        
        # Listen for client messages
        while True:
            try:
                # Receive message from client
                message = await websocket.receive_json()
                
                action = message.get("action")
                
                if action == "subscribe":
                    topics = message.get("topics", [])
                    await manager.subscribe(websocket, topics)
                    await websocket.send_json({
                        "type": "subscription",
                        "status": "success",
                        "topics": topics
                    })
                
                elif action == "unsubscribe":
                    topics = message.get("topics", [])
                    await manager.unsubscribe(websocket, topics)
                    await websocket.send_json({
                        "type": "subscription",
                        "status": "unsubscribed",
                        "topics": topics
                    })
                
                elif action == "ping":
                    await websocket.send_json({"type": "pong"})
                
                elif action == "list_topics":
                    # 获取所有活跃的 topics
                    topics = await manager.get_active_topics()
                    await websocket.send_json({
                        "type": "topics",
                        "topics": topics,
                        "count": len(topics)
                    })
                
                elif action == "my_subscriptions":
                    # 获取当前连接订阅的 topics
                    subscribed = list(manager.subscriptions.get(websocket, set()))
                    await websocket.send_json({
                        "type": "subscriptions",
                        "topics": subscribed,
                        "count": len(subscribed)
                    })
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown action: {action}"
                    })
                    
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Invalid JSON: {e}"
                })
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


async def start_redis_bridge():
    """
    Start Redis message bridge
    
    This subscribes to all topics from Redis and forwards them to WebSocket clients
    """
    import sys
    sys.stdout.write("🚀 启动Redis桥接...\n")
    sys.stdout.flush()
    logger.info("Starting Redis bridge...")
    
    try:
        # Connect to Redis
        redis_url = f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
        sys.stdout.write(f"📡 连接到Redis: {redis_url}\n")
        sys.stdout.flush()
        redis_client = await redis.from_url(redis_url, decode_responses=False)
        sys.stdout.write("✅ Redis连接成功\n")
        sys.stdout.flush()
        
        # 设置 Redis 客户端到 ConnectionManager
        manager.set_redis_client(redis_client)
        
        bus = MessageBus(redis_client)
        
        # Subscribe to all topics using wildcard
        async def forward_to_websocket(topic: str, data: dict):
            """Forward Redis message to WebSocket clients"""
            logger.debug(f"Forwarding message to WebSocket clients: {topic}")
            await manager.broadcast(topic, data)
        
        # Subscribe to all topics
        topics = [
            "kline:*",
            "indicator:*",
            "signal:*"
        ]
        
        sys.stdout.write(f"📻 订阅主题: {topics}\n")
        sys.stdout.flush()
        logger.info(f"Redis bridge subscribed to topics: {topics}")
        
        # Start subscription tasks
        tasks = [
            bus.subscribe(topic, forward_to_websocket)
            for topic in topics
        ]
        
        sys.stdout.write(f"✅ 启动{len(tasks)}个订阅任务\n")
        sys.stdout.flush()
        await asyncio.gather(*tasks)
    except Exception as e:
        sys.stdout.write(f"❌ Redis桥接失败: {e}\n")
        sys.stdout.flush()
        logger.error(f"Redis bridge failed: {e}", exc_info=True)




# Health check endpoint
@ws_app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections)
    }

