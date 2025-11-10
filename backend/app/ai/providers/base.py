"""AI Provider base interface"""

from abc import ABC, abstractmethod
from typing import Optional


class AIProvider(ABC):
    """
    AI提供者抽象接口
    
    支持多种AI服务商（DeepSeek、Qwen、Claude等）
    """
    
    @abstractmethod
    async def chat_completion(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 5.0
    ) -> Optional[str]:
        """
        发送prompt，获取AI响应
        
        Args:
            prompt: 提示词
            temperature: 温度参数（0-1），控制输出随机性
            max_tokens: 最大token数
            timeout: 超时时间（秒）
            
        Returns:
            AI的文本响应，失败返回None
        """
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """获取模型名称"""
        pass

