"""Base class for all nodes in the trading system"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

from app.core.message_bus import MessageBus

logger = logging.getLogger(__name__)


class Node(ABC):
    """
    Abstract base class for all trading system nodes
    
    Lifecycle:
    1. __init__: Initialize node with configuration
    2. start(): Subscribe to input topics and begin processing
    3. process(): Handle incoming messages (implemented by subclass)
    4. emit(): Publish messages to output topics
    5. stop(): Clean shutdown
    """
    
    def __init__(self, name: str, bus: MessageBus):
        """
        Initialize node
        
        Args:
            name: Node identifier (e.g., 'kline_node', 'indicator_node')
            bus: MessageBus instance for pub/sub
        """
        self.name = name
        self.bus = bus
        self.input_topics: List[str] = []
        self.output_topics: List[str] = []
        self._running = False
        self._tasks: List[asyncio.Task] = []
        
        logger.info(f"Node '{self.name}' initialized")
    
    async def start(self) -> None:
        """
        Start the node
        
        This will:
        1. Set running flag to True
        2. Subscribe to all input topics
        3. Start background tasks
        """
        if self._running:
            logger.warning(f"Node '{self.name}' is already running")
            return
        
        self._running = True
        
        # Subscribe to all input topics
        if self.input_topics:
            logger.info(
                f"Node '{self.name}' subscribing to {len(self.input_topics)} topics: "
                f"{', '.join(self.input_topics)}"
            )
            
            for topic in self.input_topics:
                task = asyncio.create_task(
                    self.bus.subscribe(topic, self.process)
                )
                self._tasks.append(task)
        else:
            logger.info(f"Node '{self.name}' has no input topics (producer node)")
        
        logger.info(f"Node '{self.name}' started")
    
    async def stop(self) -> None:
        """Stop the node and clean up resources"""
        if not self._running:
            logger.warning(f"Node '{self.name}' is not running")
            return
        
        self._running = False
        
        # Cancel all tasks
        for task in self._tasks:
            task.cancel()
        
        # Wait for all tasks to complete
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        self._tasks.clear()
        
        logger.info(f"Node '{self.name}' stopped")
    
    @abstractmethod
    async def process(self, topic: str, data: dict) -> None:
        """
        Process incoming message (must be implemented by subclass)
        
        Args:
            topic: Topic the message was received from
            data: Message data as dictionary
            
        Example:
            async def process(self, topic: str, data: dict) -> None:
                kline = KlineData(**data)
                # Process kline data
                result = self.calculate_indicators(kline)
                # Publish result
                await self.emit('indicator:BTCUSDT:1h', result.dict())
        """
        raise NotImplementedError(
            f"Node '{self.name}' must implement process() method"
        )
    
    async def emit(self, topic: str, data: dict) -> None:
        """
        Publish message to an output topic
        
        Args:
            topic: Topic to publish to (e.g., 'kline:BTCUSDT:1h')
            data: Message data as dictionary
        """
        try:
            await self.bus.publish(topic, data)
            logger.debug(f"Node '{self.name}' emitted to topic '{topic}'")
        except Exception as e:
            logger.error(
                f"Node '{self.name}' failed to emit to topic '{topic}': {e}"
            )
            raise
    
    @property
    def is_running(self) -> bool:
        """Check if node is currently running"""
        return self._running
    
    def __repr__(self) -> str:
        """String representation of node"""
        return (
            f"<{self.__class__.__name__} "
            f"name='{self.name}' "
            f"inputs={len(self.input_topics)} "
            f"outputs={len(self.output_topics)} "
            f"running={self._running}>"
        )


class ProducerNode(Node):
    """
    Base class for producer nodes (nodes that generate data without inputs)
    
    Examples: KlineNode that fetches data from exchanges
    """
    
    def __init__(self, name: str, bus: MessageBus):
        super().__init__(name, bus)
        self.input_topics = []  # Producers have no inputs
    
    async def process(self, topic: str, data: dict) -> None:
        """Producer nodes don't process incoming messages"""
        pass
    
    @abstractmethod
    async def produce(self) -> None:
        """
        Main production loop (must be implemented by subclass)
        
        Example:
            async def produce(self) -> None:
                while self.is_running:
                    data = await self.fetch_data()
                    await self.emit('kline:BTCUSDT:1h', data.dict())
                    await asyncio.sleep(60)
        """
        raise NotImplementedError(
            f"ProducerNode '{self.name}' must implement produce() method"
        )


class ProcessorNode(Node):
    """
    Base class for processor nodes (nodes that consume and transform data)
    
    Examples: IndicatorNode, StrategyNode
    """
    
    def __init__(self, name: str, bus: MessageBus):
        super().__init__(name, bus)
    
    @abstractmethod
    async def process(self, topic: str, data: dict) -> None:
        """
        Process incoming message and emit results
        
        Must be implemented by subclass
        """
        raise NotImplementedError(
            f"ProcessorNode '{self.name}' must implement process() method"
        )

