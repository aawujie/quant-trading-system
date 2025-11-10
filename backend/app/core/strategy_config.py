"""策略配置加载器"""

import os
import yaml
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class StrategyConfig:
    """策略配置管理器"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        初始化策略配置加载器
        
        Args:
            config_path: 配置文件路径，默认为 backend/config/strategies.yaml
        """
        if config_path is None:
            # 默认配置文件路径
            backend_dir = Path(__file__).parent.parent.parent
            config_path = backend_dir / "config" / "strategies.yaml"
        
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        try:
            if not self.config_path.exists():
                logger.error(f"Strategy config file not found: {self.config_path}")
                self.config = {"strategies": {}, "categories": {}}
                return
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)
            
            logger.info(f"Loaded strategy config from {self.config_path}")
            logger.info(f"Found {len(self.config.get('strategies', {}))} strategies")
            
        except Exception as e:
            logger.error(f"Failed to load strategy config: {e}")
            self.config = {"strategies": {}, "categories": {}}
    
    def reload(self):
        """重新加载配置文件"""
        logger.info("Reloading strategy config...")
        self._load_config()
    
    def get_all_strategies(self) -> Dict[str, Dict]:
        """
        获取所有策略配置
        
        Returns:
            策略配置字典
        """
        return self.config.get("strategies", {})
    
    def get_enabled_strategies(self) -> Dict[str, Dict]:
        """
        获取所有启用的策略
        
        Returns:
            启用的策略配置字典
        """
        all_strategies = self.get_all_strategies()
        return {
            name: config
            for name, config in all_strategies.items()
            if config.get("enabled", True)
        }
    
    def get_strategy(self, strategy_name: str) -> Optional[Dict]:
        """
        获取指定策略的配置
        
        Args:
            strategy_name: 策略名称
            
        Returns:
            策略配置字典，如果不存在返回None
        """
        return self.get_all_strategies().get(strategy_name)
    
    def get_strategy_parameters(self, strategy_name: str) -> Optional[Dict]:
        """
        获取策略参数配置
        
        Args:
            strategy_name: 策略名称
            
        Returns:
            参数配置字典
        """
        strategy = self.get_strategy(strategy_name)
        if strategy:
            return strategy.get("parameters", {})
        return None
    
    def get_strategy_defaults(self, strategy_name: str) -> Dict[str, Any]:
        """
        获取策略的默认参数值
        
        Args:
            strategy_name: 策略名称
            
        Returns:
            默认参数值字典
        """
        params = self.get_strategy_parameters(strategy_name)
        if not params:
            return {}
        
        defaults = {}
        for param_name, param_config in params.items():
            if "default" in param_config:
                defaults[param_name] = param_config["default"]
        
        return defaults
    
    def get_categories(self) -> Dict[str, Dict]:
        """
        获取策略分类定义
        
        Returns:
            分类配置字典
        """
        return self.config.get("categories", {})
    
    def get_strategies_by_category(self, category: str) -> Dict[str, Dict]:
        """
        按分类获取策略
        
        Args:
            category: 分类名称
            
        Returns:
            该分类下的策略配置字典
        """
        all_strategies = self.get_enabled_strategies()
        return {
            name: config
            for name, config in all_strategies.items()
            if config.get("category") == category
        }
    
    def format_for_api(self) -> List[Dict]:
        """
        格式化配置为API响应格式
        
        Returns:
            适合前端使用的策略列表
        """
        strategies = self.get_enabled_strategies()
        result = []
        
        for name, config in strategies.items():
            # 格式化参数
            parameters = {}
            for param_name, param_config in config.get("parameters", {}).items():
                parameters[param_name] = {
                    "label": param_config.get("label", param_name),
                    "type": param_config.get("type", "string"),
                    "default": param_config.get("default"),
                    "min": param_config.get("min"),
                    "max": param_config.get("max"),
                    "step": param_config.get("step"),
                    "description": param_config.get("description", ""),
                }
            
            # 格式化风控参数
            risk_params = {}
            for param_name, param_config in config.get("risk_management", {}).items():
                risk_params[param_name] = {
                    "label": param_config.get("label", param_name),
                    "type": param_config.get("type", "float"),
                    "default": param_config.get("default"),
                    "min": param_config.get("min"),
                    "max": param_config.get("max"),
                    "step": param_config.get("step"),
                    "description": param_config.get("description", ""),
                }
            
            strategy_info = {
                "name": name,
                "display_name": config.get("display_name", name),
                "description": config.get("description", ""),
                "icon": config.get("icon", "📊"),
                "color": config.get("color", "#4CAF50"),
                "category": config.get("category", "other"),
                "parameters": parameters,
                "risk_management": risk_params,
            }
            
            result.append(strategy_info)
        
        return result
    
    def validate_parameters(
        self, 
        strategy_name: str, 
        params: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """
        验证策略参数
        
        Args:
            strategy_name: 策略名称
            params: 要验证的参数
            
        Returns:
            (是否有效, 错误消息)
        """
        strategy_params = self.get_strategy_parameters(strategy_name)
        if not strategy_params:
            return False, f"Strategy '{strategy_name}' not found"
        
        for param_name, param_value in params.items():
            if param_name not in strategy_params:
                return False, f"Unknown parameter '{param_name}' for strategy '{strategy_name}'"
            
            param_config = strategy_params[param_name]
            param_type = param_config.get("type", "string")
            
            # 类型检查
            if param_type == "integer" and not isinstance(param_value, int):
                return False, f"Parameter '{param_name}' must be an integer"
            elif param_type == "float" and not isinstance(param_value, (int, float)):
                return False, f"Parameter '{param_name}' must be a number"
            
            # 范围检查
            if "min" in param_config and param_value < param_config["min"]:
                return False, f"Parameter '{param_name}' must be >= {param_config['min']}"
            if "max" in param_config and param_value > param_config["max"]:
                return False, f"Parameter '{param_name}' must be <= {param_config['max']}"
        
        return True, None


# 全局单例
_strategy_config_instance: Optional[StrategyConfig] = None


def get_strategy_config() -> StrategyConfig:
    """
    获取策略配置单例
    
    Returns:
        StrategyConfig实例
    """
    global _strategy_config_instance
    if _strategy_config_instance is None:
        _strategy_config_instance = StrategyConfig()
    return _strategy_config_instance


def reload_strategy_config():
    """重新加载策略配置"""
    global _strategy_config_instance
    if _strategy_config_instance is not None:
        _strategy_config_instance.reload()
    else:
        _strategy_config_instance = StrategyConfig()

