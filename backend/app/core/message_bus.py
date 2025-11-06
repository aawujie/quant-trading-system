"""Redis message bus implementation using Pub/Sub and Streams"""

import json
import logging
from typing import Callable, Dict, List, Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class MessageBus:
    """
    Redis-based message bus supporting Pub/Sub and Streams
    
    Topic naming convention:
    - kline:{symbol}:{timeframe} - e.g., kline:BTCUSDT:1h
    - indicator:{symbol}:{timeframe} - e.g., indicator:BTCUSDT:1h
    - signal:{strategy}:{symbol} - e.g., signal:dual_ma:BTCUSDT
    """
    
    def __init__(self, redis_client: redis.Redis):
        """
        Initialize message bus
        
        Args:
            redis_client: Async Redis client instance
        """
        self.redis = redis_client
        self.subscribers: Dict[str, Callable] = {}
        logger.info("MessageBus initialized")
    
    async def publish(self, topic: str, data: dict) -> None:
        """
        Publish message to both Pub/Sub and Stream
        
        Args:
            topic: Topic name (e.g., 'kline:BTCUSDT:1h')
            data: Message data as dictionary
        """
        try:
            json_data = json.dumps(data, default=str)
            
            # 1. Publish to Pub/Sub for real-time subscribers
            num_subscribers = await self.redis.publish(topic, json_data)
            
            # 2. Add to Stream for historical replay (keep last 1000 messages)
            await self.redis.xadd(
                f"stream:{topic}",
                {"data": json_data},
                maxlen=1000,
                approximate=True
            )
            
            logger.debug(
                f"Published to topic '{topic}' ({num_subscribers} subscribers)"
            )
            
        except Exception as e:
            logger.error(f"Failed to publish to topic '{topic}': {e}")
            raise
    
    async def subscribe(
        self, 
        topic: str, 
        callback: Callable[[str, dict], Any]
    ) -> None:
        """
        Subscribe to a topic (supports wildcards)
        
        Args:
            topic: Topic name or pattern (e.g., 'kline:*:1h')
            callback: Async callback function(topic: str, data: dict)
        """
        try:
            pubsub = self.redis.pubsub()
            
            # Pattern subscribe if wildcard present
            if "*" in topic:
                await pubsub.psubscribe(topic)
                logger.info(f"Pattern subscribed to '{topic}'")
            else:
                await pubsub.subscribe(topic)
                logger.info(f"Subscribed to '{topic}'")
            
            # Listen for messages
            async for message in pubsub.listen():
                if message["type"] in ["message", "pmessage"]:
                    try:
                        # Decode channel name
                        if isinstance(message["channel"], bytes):
                            channel = message["channel"].decode()
                        else:
                            channel = message["channel"]
                        
                        # Parse JSON data
                        data = json.loads(message["data"])
                        
                        # Call the callback
                        await callback(channel, data)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse message from '{topic}': {e}")
                    except Exception as e:
                        logger.error(f"Error in callback for topic '{topic}': {e}")
                        
        except Exception as e:
            logger.error(f"Failed to subscribe to topic '{topic}': {e}")
            raise
    
    async def get_history(
        self, 
        topic: str, 
        count: int = 100,
        reverse: bool = True
    ) -> List[dict]:
        """
        Get historical messages from Stream
        
        Args:
            topic: Topic name
            count: Number of messages to retrieve
            reverse: If True, get latest messages first
            
        Returns:
            List of message data dictionaries
        """
        try:
            stream_key = f"stream:{topic}"
            
            if reverse:
                # Get latest messages (most recent first)
                messages = await self.redis.xrevrange(
                    stream_key,
                    count=count
                )
            else:
                # Get oldest messages (chronological order)
                messages = await self.redis.xrange(
                    stream_key,
                    count=count
                )
            
            # Parse messages
            result = []
            for msg_id, msg_data in messages:
                try:
                    data = json.loads(msg_data[b"data"])
                    result.append(data)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"Failed to parse stream message: {e}")
            
            logger.debug(f"Retrieved {len(result)} messages from '{topic}'")
            return result
            
        except Exception as e:
            logger.error(f"Failed to get history from topic '{topic}': {e}")
            return []
    
    async def clear_history(self, topic: str) -> bool:
        """
        Clear all historical messages for a topic
        
        Args:
            topic: Topic name
            
        Returns:
            True if successful, False otherwise
        """
        try:
            stream_key = f"stream:{topic}"
            await self.redis.delete(stream_key)
            logger.info(f"Cleared history for topic '{topic}'")
            return True
        except Exception as e:
            logger.error(f"Failed to clear history for topic '{topic}': {e}")
            return False
    
    async def close(self) -> None:
        """Close Redis connection"""
        try:
            await self.redis.aclose()
            logger.info("MessageBus closed")
        except Exception as e:
            logger.error(f"Error closing MessageBus: {e}")

