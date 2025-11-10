"""仓位管理配置加载器"""

import os
import yaml
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class PositionConfig:
    """仓位管理配置管理器"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        初始化仓位管理配置加载器
        
        Args:
            config_path: 配置文件路径，默认为 backend/config/position_management.yaml
        """
        if config_path is None:
            # 默认配置文件路径
            backend_dir = Path(__file__).parent.parent.parent
            config_path = backend_dir / "config" / "position_management.yaml"
        
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        try:
            if not self.config_path.exists():
                logger.error(f"Position config file not found: {self.config_path}")
                self.config = {"presets": {}, "sizing_strategies": {}, "recommendations": {}}
                return
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)
            
            logger.info(f"Loaded position config from {self.config_path}")
            logger.info(f"Found {len(self.config.get('presets', {}))} position presets")
            
        except Exception as e:
            logger.error(f"Failed to load position config: {e}")
            self.config = {"presets": {}, "sizing_strategies": {}, "recommendations": {}}
    
    def reload(self):
        """重新加载配置文件"""
        logger.info("Reloading position config...")
        self._load_config()
    
    def get_all_presets(self) -> Dict[str, Dict]:
        """
        获取所有仓位管理预设
        
        Returns:
            预设配置字典
        """
        return self.config.get("presets", {})
    
    def get_enabled_presets(self) -> Dict[str, Dict]:
        """
        获取所有启用的预设
        
        Returns:
            启用的预设配置字典
        """
        all_presets = self.get_all_presets()
        return {
            name: config
            for name, config in all_presets.items()
            if config.get("enabled", True)
        }
    
    def get_preset(self, preset_name: str) -> Optional[Dict]:
        """
        获取指定预设的配置
        
        Args:
            preset_name: 预设名称
            
        Returns:
            预设配置字典，如果不存在返回None
        """
        return self.get_all_presets().get(preset_name)
    
    def get_sizing_strategies(self) -> Dict[str, Dict]:
        """
        获取仓位计算策略说明
        
        Returns:
            策略说明字典
        """
        return self.config.get("sizing_strategies", {})
    
    def get_recommendations(self) -> Dict[str, str]:
        """
        获取推荐配置
        
        Returns:
            推荐配置字典
        """
        return self.config.get("recommendations", {})
    
    def validate_preset(self, preset_name: str) -> tuple[bool, Optional[str]]:
        """
        验证预设是否存在且启用
        
        Args:
            preset_name: 预设名称
            
        Returns:
            (是否有效, 错误消息)
        """
        preset = self.get_preset(preset_name)
        
        if not preset:
            return False, f"Position preset '{preset_name}' not found"
        
        if not preset.get("enabled", True):
            return False, f"Position preset '{preset_name}' is disabled"
        
        return True, None
    
    def format_for_api(self) -> List[Dict]:
        """
        格式化配置为API响应格式
        
        Returns:
            适合前端使用的预设列表
        """
        presets = self.get_enabled_presets()
        result = []
        
        for name, config in presets.items():
            preset_info = {
                "name": name,
                "display_name": config.get("display_name", name),
                "description": config.get("description", ""),
                "icon": config.get("icon", "📊"),
                "color": config.get("color", "#2196F3"),
                "sizing_strategy": {
                    "type": config.get("sizing_strategy", {}).get("type", "risk_based"),
                    "risk_per_trade": config.get("sizing_strategy", {}).get("risk_per_trade", 0.02),
                },
                "risk_management": {
                    "max_positions": config.get("risk_management", {}).get("max_positions", 3),
                    "max_exposure_pct": config.get("risk_management", {}).get("max_exposure_pct", 0.8),
                    "single_position_max_pct": config.get("risk_management", {}).get("single_position_max_pct", 0.5),
                },
                "default_stops": {
                    "stop_loss_pct": config.get("default_stops", {}).get("stop_loss_pct", 2.0),
                    "take_profit_pct": config.get("default_stops", {}).get("take_profit_pct", 4.0),
                    "trailing_stop": config.get("default_stops", {}).get("trailing_stop", False),
                }
            }
            
            result.append(preset_info)
        
        return result
    
    def get_preset_for_factory(self, preset_name: str) -> Optional[Dict]:
        """
        获取用于创建PositionManager的预设参数
        
        Args:
            preset_name: 预设名称
            
        Returns:
            工厂方法所需的参数字典
        """
        preset = self.get_preset(preset_name)
        if not preset:
            return None
        
        sizing_strategy = preset.get("sizing_strategy", {})
        risk_mgmt = preset.get("risk_management", {})
        
        return {
            "sizing_strategy_type": sizing_strategy.get("type", "risk_based"),
            "risk_per_trade": sizing_strategy.get("risk_per_trade", 0.02),
            "max_positions": risk_mgmt.get("max_positions", 3),
            "max_exposure_pct": risk_mgmt.get("max_exposure_pct", 0.8),
            "single_position_max_pct": risk_mgmt.get("single_position_max_pct", 0.5),
            # Kelly相关参数（如果有）
            "win_rate": sizing_strategy.get("win_rate"),
            "win_loss_ratio": sizing_strategy.get("win_loss_ratio"),
            "kelly_fraction": sizing_strategy.get("kelly_fraction"),
            # 波动率相关参数（如果有）
            "base_risk": sizing_strategy.get("base_risk"),
            "volatility_lookback": sizing_strategy.get("volatility_lookback"),
            "volatility_target": sizing_strategy.get("volatility_target"),
        }


# 全局单例
_position_config_instance: Optional[PositionConfig] = None


def get_position_config() -> PositionConfig:
    """
    获取仓位管理配置单例
    
    Returns:
        PositionConfig实例
    """
    global _position_config_instance
    if _position_config_instance is None:
        _position_config_instance = PositionConfig()
    return _position_config_instance


def reload_position_config():
    """重新加载仓位管理配置"""
    global _position_config_instance
    if _position_config_instance is not None:
        _position_config_instance.reload()
    else:
        _position_config_instance = PositionConfig()

