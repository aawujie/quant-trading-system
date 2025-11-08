"""Configuration management"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Redis Configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    
    # PostgreSQL Configuration
    database_url: str = "postgresql+asyncpg://quant_user:quant_pass@localhost:5432/quant"
    
    # Binance Exchange Configuration
    binance_api_key: str = ""
    binance_api_secret: str = ""
    
    # Proxy Configuration
    proxy_enabled: bool = True
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 7897
    proxy_username: str = ""
    proxy_password: str = ""
    
    # System Configuration
    log_level: str = "DEBUG"
    
    # K-line Data Fetching Configuration
    kline_fetch_interval: int = 4  # K线数据获取间隔（秒）
    market_type: str = "future"  # 市场类型: spot, future, delivery
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

