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
    
    # Data Integrity Configuration
    auto_repair_data: bool = True  # 启动时自动修复数据
    repair_hours_back_on_startup: int = 1  # 节点启动时检查最近N小时的数据（快速检查）
    
    # 混合修复模式：K线按时间，指标按数量
    repair_days_back: int = 30  # K线修复：检查最近N天（确保时间连续性）
    repair_klines_count: int = 2000  # 指标修复：每个周期修复N根K线（统一样本量）
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

