"""
任务管理器 - 管理回测和优化任务
支持：
1. TTL缓存（自动清理过期任务）
2. 并发控制（限制最大并发数）
3. WebSocket推送（实时通知）
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional, Callable
from cachetools import TTLCache
from datetime import datetime

logger = logging.getLogger(__name__)


class TaskManager:
    """
    任务管理器
    
    功能：
    - TTL缓存：任务1小时后自动过期
    - 并发控制：限制最大并发任务数
    - 任务状态跟踪
    - WebSocket推送支持
    """
    
    def __init__(
        self,
        max_tasks: int = 100,
        ttl_seconds: int = 3600,
        max_concurrent: int = 3
    ):
        """
        初始化任务管理器
        
        Args:
            max_tasks: 最大任务数（超出则淘汰最旧的）
            ttl_seconds: 任务生存时间（秒）
            max_concurrent: 最大并发任务数
        """
        # 使用TTL缓存，自动清理过期任务
        self.tasks: TTLCache = TTLCache(maxsize=max_tasks, ttl=ttl_seconds)
        
        # 并发控制信号量
        self.semaphore = asyncio.Semaphore(max_concurrent)
        
        # 活跃任务计数
        self.active_tasks = 0
        
        # WebSocket连接池 {task_id: [websocket1, websocket2, ...]}
        self.websocket_connections: Dict[str, list] = {}
        
        logger.info(
            f"TaskManager initialized: max_tasks={max_tasks}, "
            f"ttl={ttl_seconds}s, max_concurrent={max_concurrent}"
        )
    
    async def create_task(
        self,
        task_id: str,
        task_func: Callable,
        request_data: Dict[str, Any]
    ) -> None:
        """
        创建并执行异步任务
        
        Args:
            task_id: 任务ID
            task_func: 任务执行函数（协程）
            request_data: 请求数据
        """
        # 初始化任务状态
        self.tasks[task_id] = {
            'status': 'pending',
            'request': request_data,
            'results': None,
            'error': None,
            'created_at': int(time.time()),
            'started_at': None,
            'completed_at': None,
            'progress': 0
        }
        
        # 创建后台任务
        asyncio.create_task(self._run_task(task_id, task_func))
        
        logger.info(f"Task {task_id} created")
    
    async def _run_task(self, task_id: str, task_func: Callable) -> None:
        """
        在并发控制下执行任务
        
        Args:
            task_id: 任务ID
            task_func: 任务执行函数
        """
        # 获取信号量（限制并发）
        async with self.semaphore:
            self.active_tasks += 1
            logger.info(
                f"Task {task_id} started (active: {self.active_tasks}/{self.semaphore._value + 1})"
            )
            
            try:
                # 更新状态为运行中
                if task_id in self.tasks:
                    self.tasks[task_id]['status'] = 'running'
                    self.tasks[task_id]['started_at'] = int(time.time())
                    await self._notify_websockets(task_id)
                
                # 执行任务
                results = await task_func()
                
                # 保存结果
                if task_id in self.tasks:
                    self.tasks[task_id]['status'] = 'completed'
                    self.tasks[task_id]['results'] = results
                    self.tasks[task_id]['completed_at'] = int(time.time())
                    self.tasks[task_id]['progress'] = 100
                    await self._notify_websockets(task_id)
                    
                    duration = self.tasks[task_id]['completed_at'] - self.tasks[task_id]['started_at']
                    logger.info(f"Task {task_id} completed in {duration}s")
                
            except Exception as e:
                logger.error(f"Task {task_id} failed: {e}", exc_info=True)
                
                if task_id in self.tasks:
                    self.tasks[task_id]['status'] = 'failed'
                    self.tasks[task_id]['error'] = str(e)
                    self.tasks[task_id]['completed_at'] = int(time.time())
                    await self._notify_websockets(task_id)
            
            finally:
                self.active_tasks -= 1
                logger.info(f"Task {task_id} finished (active: {self.active_tasks})")
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务信息或None
        """
        return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有任务（用于管理界面）
        
        Returns:
            任务字典
        """
        return dict(self.tasks)
    
    def update_progress(self, task_id: str, progress: int) -> None:
        """
        更新任务进度（带节流）
        
        Args:
            task_id: 任务ID
            progress: 进度百分比（0-100）
        """
        if task_id in self.tasks:
            old_progress = self.tasks[task_id].get('progress', 0)
            
            # 节流：只有进度真正改变时才推送
            if progress != old_progress:
                self.tasks[task_id]['progress'] = progress
                # 异步通知WebSocket客户端（不等待）
                asyncio.create_task(self._notify_websockets(task_id))
    
    async def register_websocket(self, task_id: str, websocket) -> None:
        """
        注册WebSocket连接
        
        Args:
            task_id: 任务ID
            websocket: WebSocket对象
        """
        if task_id not in self.websocket_connections:
            self.websocket_connections[task_id] = []
        
        self.websocket_connections[task_id].append(websocket)
        logger.info(f"WebSocket registered for task {task_id}")
        
        # 立即发送当前状态
        task = self.get_task(task_id)
        if task:
            try:
                await websocket.send_json({
                    'task_id': task_id,
                    'status': task['status'],
                    'progress': task.get('progress', 0),
                    'results': task.get('results'),
                    'error': task.get('error')
                })
            except Exception as e:
                logger.error(f"Failed to send initial status to WebSocket: {e}")
    
    async def unregister_websocket(self, task_id: str, websocket) -> None:
        """
        注销WebSocket连接
        
        Args:
            task_id: 任务ID
            websocket: WebSocket对象
        """
        if task_id in self.websocket_connections:
            try:
                self.websocket_connections[task_id].remove(websocket)
                if not self.websocket_connections[task_id]:
                    del self.websocket_connections[task_id]
                logger.info(f"WebSocket unregistered for task {task_id}")
            except ValueError:
                pass
    
    async def _notify_websockets(self, task_id: str) -> None:
        """
        通知所有监听该任务的WebSocket客户端
        
        Args:
            task_id: 任务ID
        """
        if task_id not in self.websocket_connections:
            return
        
        task = self.get_task(task_id)
        if not task:
            return
        
        # 准备消息
        message = {
            'task_id': task_id,
            'status': task['status'],
            'progress': task.get('progress', 0),
            'results': task.get('results'),
            'error': task.get('error')
        }
        
        # 发送给所有连接的客户端
        disconnected = []
        for ws in self.websocket_connections[task_id]:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.append(ws)
        
        # 清理断开的连接
        for ws in disconnected:
            await self.unregister_websocket(task_id, ws)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计数据
        """
        total = len(self.tasks)
        pending = sum(1 for t in self.tasks.values() if t['status'] == 'pending')
        running = sum(1 for t in self.tasks.values() if t['status'] == 'running')
        completed = sum(1 for t in self.tasks.values() if t['status'] == 'completed')
        failed = sum(1 for t in self.tasks.values() if t['status'] == 'failed')
        
        return {
            'total_tasks': total,
            'active_tasks': self.active_tasks,
            'pending_tasks': pending,
            'running_tasks': running,
            'completed_tasks': completed,
            'failed_tasks': failed,
            'max_concurrent': self.semaphore._bound,
            'available_slots': self.semaphore._value,
            'websocket_connections': sum(len(conns) for conns in self.websocket_connections.values())
        }
    
    async def cleanup_old_tasks(self, max_age_seconds: int = 1800) -> int:
        """
        手动清理超过指定时间的已完成任务
        
        Args:
            max_age_seconds: 最大年龄（秒），默认30分钟
            
        Returns:
            清理的任务数
        """
        now = int(time.time())
        to_delete = []
        
        for task_id, task in self.tasks.items():
            if task['status'] in ['completed', 'failed']:
                completed_at = task.get('completed_at', 0)
                if now - completed_at > max_age_seconds:
                    to_delete.append(task_id)
        
        for task_id in to_delete:
            del self.tasks[task_id]
            # 清理WebSocket连接
            if task_id in self.websocket_connections:
                del self.websocket_connections[task_id]
        
        if to_delete:
            logger.info(f"Cleaned up {len(to_delete)} old tasks")
        
        return len(to_delete)


# 全局任务管理器实例
backtest_task_manager = TaskManager(
    max_tasks=100,
    ttl_seconds=3600,  # 1小时TTL
    max_concurrent=3   # 最多3个并发回测
)

optimization_task_manager = TaskManager(
    max_tasks=50,
    ttl_seconds=7200,  # 2小时TTL（优化通常耗时更长）
    max_concurrent=2   # 最多2个并发优化
)


async def start_cleanup_task():
    """
    启动定期清理任务（每10分钟）
    """
    while True:
        try:
            await asyncio.sleep(600)  # 10分钟
            
            # 清理30分钟前完成的任务
            cleaned_backtest = await backtest_task_manager.cleanup_old_tasks(1800)
            cleaned_opt = await optimization_task_manager.cleanup_old_tasks(3600)
            
            if cleaned_backtest or cleaned_opt:
                logger.info(
                    f"Periodic cleanup: {cleaned_backtest} backtest tasks, "
                    f"{cleaned_opt} optimization tasks"
                )
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

