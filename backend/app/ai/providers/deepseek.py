"""DeepSeek AI Provider"""

import asyncio
import logging
from typing import Optional

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

from .base import AIProvider

logger = logging.getLogger(__name__)


class DeepSeekProvider(AIProvider):
    """
    DeepSeek API提供者
    
    使用OpenAI SDK访问DeepSeek API
    """
    
    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com"):
        """
        Args:
            api_key: DeepSeek API密钥
            base_url: API基础URL
        """
        if not OPENAI_AVAILABLE:
            raise ImportError(
                "openai package is required for DeepSeek provider. "
                "Install it with: uv add openai"
            )
        
        self.api_key = api_key
        self.base_url = base_url
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        logger.info(f"DeepSeekProvider initialized: base_url={base_url}")
    
    async def chat_completion(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 5.0
    ) -> Optional[str]:
        """
        调用DeepSeek API
        
        Returns:
            AI响应文本，失败返回None
        """
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {
                            "role": "system",
                            "content": "你是专业的量化交易助手，精通技术分析和风险管理。"
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens
                ),
                timeout=timeout
            )
            
            content = response.choices[0].message.content
            logger.debug(f"DeepSeek response: {content[:100]}...")
            
            return content
        
        except asyncio.TimeoutError:
            logger.warning(f"DeepSeek API timeout after {timeout}s")
            return None
        
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            return None
    
    def get_model_name(self) -> str:
        """获取模型名称"""
        return "deepseek-chat"


class DeepSeekCoderProvider(AIProvider):
    """
    DeepSeek Coder模型提供者
    
    专门用于代码生成和分析
    """
    
    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com"):
        if not OPENAI_AVAILABLE:
            raise ImportError("openai package is required")
        
        self.api_key = api_key
        self.base_url = base_url
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        logger.info(f"DeepSeekCoderProvider initialized")
    
    async def chat_completion(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 5.0
    ) -> Optional[str]:
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="deepseek-coder",
                    messages=[
                        {"role": "system", "content": "You are a professional trading strategy developer."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens
                ),
                timeout=timeout
            )
            
            return response.choices[0].message.content
        
        except asyncio.TimeoutError:
            logger.warning(f"DeepSeek Coder timeout after {timeout}s")
            return None
        
        except Exception as e:
            logger.error(f"DeepSeek Coder error: {e}")
            return None
    
    def get_model_name(self) -> str:
        return "deepseek-coder"

