"""
智能进度跟踪器
自适应更新频率，平滑进度展示
"""

import time
import logging
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class ProgressTracker:
    """
    智能进度跟踪器
    
    功能：
    - 自适应更新频率（根据数据量调整）
    - 时间节流（避免更新过于频繁）
    - 平滑进度变化
    - 阶段管理
    """
    
    def __init__(
        self,
        total_items: int,
        min_interval: float = 0.5,
        max_updates: int = 100,
        callback: Optional[Callable[[int], None]] = None
    ):
        """
        初始化进度跟踪器
        
        Args:
            total_items: 总项目数（如K线总数）
            min_interval: 最小更新间隔（秒），避免刷屏
            max_updates: 最大更新次数，避免过度推送
            callback: 进度回调函数，接收进度百分比(0-100)
        """
        self.total_items = max(1, total_items)  # 避免除零
        self.processed_items = 0
        self.last_update_time = time.time()
        self.last_progress = 0
        self.min_interval = min_interval
        self.callback = callback
        
        # 计算更新阈值（至少处理多少项才更新）
        # 确保更新次数不超过max_updates
        self.update_threshold = max(1, total_items // max_updates)
        
        logger.debug(
            f"ProgressTracker initialized: total={total_items}, "
            f"threshold={self.update_threshold}, interval={min_interval}s"
        )
    
    def update(self, items: int = 1) -> Optional[int]:
        """
        更新进度（处理了items个项目）
        
        Args:
            items: 本次处理的项目数
            
        Returns:
            如果触发了更新，返回当前进度(0-100)；否则返回None
        """
        self.processed_items += items
        current_time = time.time()
        
        # 计算当前进度
        progress = min(100, int((self.processed_items / self.total_items) * 100))
        
        # 判断是否应该更新
        time_passed = current_time - self.last_update_time >= self.min_interval
        threshold_reached = self.processed_items % self.update_threshold == 0
        progress_changed = progress > self.last_progress
        is_complete = self.processed_items >= self.total_items
        
        # 更新条件（修复：确保时间节流生效）：
        # 1. 时间间隔足够 且 (达到阈值 或 进度变化了)
        # 2. 或者完成了（完成时立即推送）
        should_update = (time_passed and (threshold_reached or progress_changed)) or is_complete
        
        if should_update:
            self.last_update_time = current_time
            self.last_progress = progress
            
            # 触发回调
            if self.callback:
                try:
                    self.callback(progress)
                except Exception as e:
                    logger.error(f"Progress callback error: {e}")
            
            return progress
        
        return None
    
    def set_progress(self, progress: int) -> None:
        """
        直接设置进度（用于阶段性更新）
        
        Args:
            progress: 进度百分比(0-100)
        """
        progress = max(0, min(100, progress))
        
        if progress > self.last_progress:
            self.last_progress = progress
            self.last_update_time = time.time()
            
            if self.callback:
                try:
                    self.callback(progress)
                except Exception as e:
                    logger.error(f"Progress callback error: {e}")
    
    def get_progress(self) -> int:
        """获取当前进度"""
        return self.last_progress
    
    def is_complete(self) -> bool:
        """是否已完成"""
        return self.processed_items >= self.total_items


class StageProgressTracker:
    """
    多阶段进度跟踪器
    
    将整个任务分为多个阶段，每个阶段占用一定的进度范围
    """
    
    def __init__(self, callback: Optional[Callable[[int], None]] = None):
        """
        初始化多阶段进度跟踪器
        
        Args:
            callback: 进度回调函数
        """
        self.callback = callback
        self.stages = []  # [(name, start, end, tracker)]
        self.current_stage = None
        self.total_progress = 0
    
    def add_stage(
        self,
        name: str,
        start: int,
        end: int,
        total_items: Optional[int] = None
    ) -> 'ProgressTracker':
        """
        添加一个阶段
        
        Args:
            name: 阶段名称
            start: 起始进度(0-100)
            end: 结束进度(0-100)
            total_items: 该阶段的总项目数（如果为None，使用简单进度）
            
        Returns:
            该阶段的ProgressTracker（如果提供了total_items）
        """
        progress_range = end - start
        
        if total_items:
            # 创建子跟踪器，将其进度映射到该阶段的范围
            tracker = ProgressTracker(
                total_items=total_items,
                callback=lambda p: self._stage_callback(start, progress_range, p)
            )
            self.stages.append((name, start, end, tracker))
            return tracker
        else:
            self.stages.append((name, start, end, None))
            return None
    
    def _stage_callback(self, stage_start: int, stage_range: int, stage_progress: int):
        """
        阶段进度回调（将阶段内进度映射到全局进度）
        
        Args:
            stage_start: 阶段起始进度
            stage_range: 阶段进度范围
            stage_progress: 阶段内进度(0-100)
        """
        # 映射：stage_start + (stage_range * stage_progress / 100)
        global_progress = stage_start + int(stage_range * stage_progress / 100)
        
        if global_progress > self.total_progress:
            self.total_progress = global_progress
            if self.callback:
                try:
                    self.callback(global_progress)
                except Exception as e:
                    logger.error(f"Stage progress callback error: {e}")
    
    def set_stage_progress(self, stage_name: str, progress: int):
        """
        设置某个阶段的进度（用于无细粒度跟踪的阶段）
        
        Args:
            stage_name: 阶段名称
            progress: 阶段内进度(0-100)
        """
        for name, start, end, tracker in self.stages:
            if name == stage_name:
                stage_range = end - start
                global_progress = start + int(stage_range * progress / 100)
                
                if global_progress > self.total_progress:
                    self.total_progress = global_progress
                    if self.callback:
                        try:
                            self.callback(global_progress)
                        except Exception as e:
                            logger.error(f"Stage progress callback error: {e}")
                break
    
    def get_stage_tracker(self, stage_name: str) -> Optional[ProgressTracker]:
        """获取指定阶段的跟踪器"""
        for name, start, end, tracker in self.stages:
            if name == stage_name:
                return tracker
        return None


# 便捷函数
def create_backtest_progress_tracker(
    total_klines: int,
    callback: Optional[Callable[[int], None]] = None
) -> StageProgressTracker:
    """
    创建回测专用的多阶段进度跟踪器
    
    进度分配：
    - 数据加载: 0-20%
    - 策略初始化: 20-25%
    - 回测执行: 25-95%
    - 结果统计: 95-100%
    
    Args:
        total_klines: K线总数
        callback: 进度回调
        
    Returns:
        多阶段进度跟踪器
    """
    tracker = StageProgressTracker(callback=callback)
    
    # 阶段1: 数据加载 (0-20%)
    tracker.add_stage("data_loading", 0, 20)
    
    # 阶段2: 策略初始化 (20-25%)
    tracker.add_stage("strategy_init", 20, 25)
    
    # 阶段3: 回测执行 (25-95%)，细粒度跟踪
    tracker.add_stage("backtest_execution", 25, 95, total_items=total_klines)
    
    # 阶段4: 结果统计 (95-100%)
    tracker.add_stage("result_calculation", 95, 100)
    
    return tracker

