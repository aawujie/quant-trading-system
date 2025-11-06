"""WebSocket endpoint for real-time data streaming"""

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import redis.asyncio as redis

from app.core.message_bus import MessageBus
from app.config import settings

logger = logging.getLogger(__name__)

# Create FastAPI app for WebSocket
ws_app = FastAPI(title="WebSocket Server")

# Connection manager
class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
    
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
    logger.info("Starting Redis bridge...")
    
    # Connect to Redis
    redis_client = await redis.from_url(
        f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}",
        decode_responses=False
    )
    
    bus = MessageBus(redis_client)
    
    # Subscribe to all topics using wildcard
    async def forward_to_websocket(topic: str, data: dict):
        """Forward Redis message to WebSocket clients"""
        await manager.broadcast(topic, data)
    
    # Subscribe to all topics
    topics = [
        "kline:*",
        "indicator:*",
        "signal:*"
    ]
    
    logger.info(f"Redis bridge subscribed to topics: {topics}")
    
    # Start subscription tasks
    tasks = [
        bus.subscribe(topic, forward_to_websocket)
        for topic in topics
    ]
    
    await asyncio.gather(*tasks)


@ws_app.on_event("startup")
async def startup_event():
    """Start Redis bridge on startup"""
    asyncio.create_task(start_redis_bridge())
    logger.info("WebSocket server started")


@ws_app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("WebSocket server shutdown")


# Health check endpoint
@ws_app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections)
    }

