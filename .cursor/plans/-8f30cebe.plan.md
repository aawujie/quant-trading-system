<!-- 8f30cebe-9c8c-47f0-922e-72dd0e0c2e5f f5add935-f93d-4792-a028-27c5bc433826 -->
# 量化交易系统实施计划

## 架构设计决策

### 1. 消息中间件：Redis Pub/Sub + Streams

- **延迟**: 1-5ms（满足3秒周期要求）
- **部署**: Docker一键启动
- **历史消息**: Streams支持回溯调试
- **持久化**: 配合 PostgreSQL 存储长期数据

### 2. 数据库：PostgreSQL

- **职责**: 持久化存储（K线、指标、信号）
- **核心优势**: 避免重复计算（启动时查询最新时间戳，只计算增量）
- **查询优化**: symbol + timeframe + timestamp 复合索引

### 3. 节点架构：一个节点处理多交易对

- **资源占用**: 单节点 70MB vs 多节点 196MB（节省64%）
- **CPU利用率**: <1%（3秒周期完全够用）
- **扩展性**: 配置文件添加交易对即可
- **何时拆分**: 交易对>100个 或 CPU>70% 或 延迟>策略周期10%

### 4. 部署方式：多进程避免 GIL

- **开发环境**: 手动启动多个进程（`python3 main.py --node xxx`）
- **生产环境**: Docker Compose（每个节点独立容器）
- **性能提升**: 2.7倍（充分利用多核CPU）

### 5. 数据格式：JSON + Pydantic

- **序列化**: JSON（开发快，易调试）
- **验证**: Pydantic 自动类型检查
- **扩展性**: 未来可无缝切换 Protobuf

### 6. 交易所支持

- **首期**: 币安（ccxt库）
- **接口设计**: 抽象基类，便于扩展其他交易所

---

## 项目结构

```
quant-trading-system/
├── backend/
│   ├── app/
│   │   ├── main.py                   # 统一启动入口
│   │   ├── config.py                 # 配置管理（Pydantic Settings）
│   │   ├── core/
│   │   │   ├── message_bus.py       # Redis 消息总线封装
│   │   │   ├── node_base.py         # 节点基类（订阅、发布、启动）
│   │   │   └── database.py          # PostgreSQL 连接池
│   │   ├── models/
│   │   │   ├── market_data.py       # KlineData（Pydantic 模型）
│   │   │   ├── indicators.py        # IndicatorData（MA/RSI/MACD）
│   │   │   └── signals.py           # SignalData（BUY/SELL/HOLD）
│   │   ├── nodes/
│   │   │   ├── kline_node.py        # K线获取节点（支持多交易对）
│   │   │   ├── indicator_node.py    # 指标计算节点（TA-Lib）
│   │   │   └── strategy_node.py     # 双均线策略节点
│   │   ├── exchanges/
│   │   │   ├── base.py              # ExchangeBase 抽象基类
│   │   │   ├── binance.py           # 币安实现（ccxt）
│   │   │   └── interfaces.py        # 待实现：OKX、Huobi、Bybit
│   │   ├── api/
│   │   │   ├── rest.py              # FastAPI REST 端点
│   │   │   └── websocket.py         # WebSocket 实时推送
│   │   └── services/
│   │       ├── backtest.py          # 回测服务接口（预留）
│   │       └── live_trading.py      # 实盘交易接口（预留）
│   ├── pyproject.toml                # uv 项目配置和依赖管理
│   ├── uv.lock                       # uv 锁文件
│   ├── alembic/                      # 数据库迁移
│   │   └── versions/
│   └── Dockerfile                    # Python 应用容器化（可选）
├── frontend/                         # React 前端
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx                  # 主应用组件
│   │   ├── main.jsx                 # 入口文件
│   │   ├── components/
│   │   │   ├── TradingChart.jsx     # 图表组件（Lightweight Charts）
│   │   │   ├── SymbolSelector.jsx   # 交易对选择器
│   │   │   ├── IndicatorPanel.jsx   # 指标面板
│   │   │   ├── SignalList.jsx       # 信号列表
│   │   │   └── StrategyControl.jsx  # 策略控制面板
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js      # WebSocket Hook
│   │   │   ├── useMarketData.js     # 市场数据 Hook
│   │   │   └── useChart.js          # 图表管理 Hook
│   │   ├── services/
│   │   │   ├── api.js               # REST API 客户端
│   │   │   └── websocket.js         # WebSocket 客户端
│   │   ├── stores/
│   │   │   └── tradingStore.js      # 状态管理（Zustand/Redux）
│   │   └── styles/
│   │       └── index.css
│   ├── package.json
│   ├── vite.config.js               # Vite 构建配置
│   └── Dockerfile                    # 前端容器化（可选）
├── scripts/
│   ├── dev_start.sh                  # 开发环境启动（多进程）
│   ├── dev_stop.sh                   # 停止所有节点
│   └── prod_deploy.sh                # 生产部署脚本
├── docker-compose.yml                # 基础设施（Redis + PostgreSQL）
├── docker-compose.prod.yml           # 生产环境（包含应用容器）
├── config/
│   └── nodes.yaml                    # 节点配置（交易对、参数）
└── docs/
    ├── architecture.md               # 系统架构文档
    ├── node_development.md           # 节点开发指南
    ├── api_spec.md                   # API 接口文档
    └── deployment.md                 # 部署指南
```

---

## 实施步骤

### 阶段 1: 基础设施搭建

#### 1.1 项目初始化

- 创建目录结构
- 初始化 Python 虚拟环境：`python3 -m venv venv`
- 创建 `requirements.txt`
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
redis[hiredis]==5.0.1
asyncpg==0.29.0
sqlalchemy==2.0.23
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
ccxt==4.1.50
ta-lib==0.4.28
pandas==2.1.3
numpy==1.26.2
python-multipart==0.0.6
websockets==12.0
```


#### 1.2 Docker 基础设施

创建 `docker-compose.yml`（只包含基础服务）：

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
   - "6379:6379"
    volumes:
   - redis_data:/data
    command: redis-server --appendonly yes
  
  postgres:
    image: postgres:15-alpine
    ports:
   - "5432:5432"
    environment:
      POSTGRES_DB: quant
      POSTGRES_USER: quant_user
      POSTGRES_PASSWORD: quant_pass
    volumes:
   - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

启动基础设施：

```bash
docker-compose up -d
```

#### 1.3 配置管理

`backend/app/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    
    # PostgreSQL
    database_url: str = "postgresql+asyncpg://quant_user:quant_pass@localhost/quant"
    
    # 交易所
    binance_api_key: str = ""
    binance_api_secret: str = ""
    
    # 系统配置
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

#### 1.4 数据库表设计

使用 Alembic 创建迁移：

```sql
-- klines 表
CREATE TABLE klines (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp BIGINT NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, timeframe, timestamp)
);
CREATE INDEX idx_klines_lookup ON klines(symbol, timeframe, timestamp DESC);

-- indicators 表
CREATE TABLE indicators (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp BIGINT NOT NULL,
    ma5 DECIMAL(20, 8),
    ma10 DECIMAL(20, 8),
    ma20 DECIMAL(20, 8),
    rsi14 DECIMAL(10, 4),
    macd_line DECIMAL(20, 8),
    macd_signal DECIMAL(20, 8),
    macd_histogram DECIMAL(20, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, timeframe, timestamp)
);
CREATE INDEX idx_indicators_lookup ON indicators(symbol, timeframe, timestamp DESC);

-- signals 表
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timestamp BIGINT NOT NULL,
    signal_type VARCHAR(10) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_signals_lookup ON signals(strategy_name, symbol, timestamp DESC);
```

---

### 阶段 2: 核心消息总线

#### 2.1 Redis 消息总线

`backend/app/core/message_bus.py`:

```python
import redis.asyncio as redis
import json
from typing import Callable, Dict

class MessageBus:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.subscribers: Dict[str, Callable] = {}
    
    async def publish(self, topic: str, data: dict):
        """发布消息到 Pub/Sub 和 Stream"""
        json_data = json.dumps(data)
        
        # 1. Pub/Sub（实时）
        await self.redis.publish(topic, json_data)
        
        # 2. Stream（历史回溯）
        await self.redis.xadd(
            f"stream:{topic}",
            {"data": json_data},
            maxlen=1000  # 保留最近 1000 条
        )
    
    async def subscribe(self, topic: str, callback: Callable):
        """订阅 topic（支持通配符）"""
        pubsub = self.redis.pubsub()
        
        if "*" in topic:
            await pubsub.psubscribe(topic)
        else:
            await pubsub.subscribe(topic)
        
        # 后台任务监听消息
        async for message in pubsub.listen():
            if message["type"] in ["message", "pmessage"]:
                data = json.loads(message["data"])
                await callback(message["channel"].decode(), data)
    
    async def get_history(self, topic: str, count: int = 100):
        """从 Stream 获取历史消息"""
        messages = await self.redis.xrevrange(
            f"stream:{topic}",
            count=count
        )
        return [json.loads(msg[1][b"data"]) for msg in messages]
```

**Topic 命名规范**：

- `kline:{symbol}:{timeframe}` - 例如 `kline:BTCUSDT:1h`
- `indicator:{symbol}:{timeframe}` - 例如 `indicator:BTCUSDT:1h`
- `signal:{strategy}:{symbol}` - 例如 `signal:dual_ma:BTCUSDT`

#### 2.2 节点基类

`backend/app/core/node_base.py`:

```python
from abc import ABC, abstractmethod
from typing import List
import asyncio

class Node(ABC):
    def __init__(self, name: str, bus: MessageBus):
        self.name = name
        self.bus = bus
        self.input_topics: List[str] = []
        self.output_topics: List[str] = []
        self._running = False
    
    async def start(self):
        """启动节点，订阅输入 topics"""
        self._running = True
        
        # 订阅所有输入 topics
        tasks = [
            self.bus.subscribe(topic, self.process)
            for topic in self.input_topics
        ]
        
        print(f"[{self.name}] 已启动，订阅 {len(self.input_topics)} 个 topics")
        
        # 并发监听所有订阅
        await asyncio.gather(*tasks)
    
    async def stop(self):
        """停止节点"""
        self._running = False
        print(f"[{self.name}] 已停止")
    
    @abstractmethod
    async def process(self, topic: str, data: dict):
        """处理接收到的消息"""
        raise NotImplementedError
    
    async def emit(self, topic: str, data: dict):
        """发布消息到输出 topic"""
        await self.bus.publish(topic, data)
```

---

### 阶段 3: 数据模型定义

使用 Pydantic 定义所有数据结构：

`backend/app/models/market_data.py`:

```python
from pydantic import BaseModel

class KlineData(BaseModel):
    symbol: str
    timeframe: str
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
```

`backend/app/models/indicators.py`:

```python
class IndicatorData(BaseModel):
    symbol: str
    timeframe: str
    timestamp: int
    ma5: float | None = None
    ma10: float | None = None
    ma20: float | None = None
    rsi14: float | None = None
    macd_line: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None
```

`backend/app/models/signals.py`:

```python
class SignalData(BaseModel):
    strategy_name: str
    symbol: str
    timestamp: int
    signal_type: str  # "BUY", "SELL", "HOLD"
    price: float
    reason: str
```

---

### 阶段 4: 交易所抽象层

`backend/app/exchanges/base.py`:

```python
from abc import ABC, abstractmethod
from typing import List
from app.models.market_data import KlineData

class ExchangeBase(ABC):
    @abstractmethod
    async def fetch_klines(
        self, 
        symbol: str, 
        timeframe: str,
        since: int = None,
        limit: int = 1000
    ) -> List[KlineData]:
        """获取K线数据（支持增量 since 参数）"""
        pass
    
    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> dict:
        """获取实时行情"""
        pass
    
    @abstractmethod
    async def create_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        price: float = None
    ) -> dict:
        """下单（预留）"""
        pass
```

`backend/app/exchanges/binance.py`:

```python
import ccxt.async_support as ccxt

class BinanceExchange(ExchangeBase):
    def __init__(self, api_key: str, api_secret: str):
        self.exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,
        })
    
    async def fetch_klines(self, symbol, timeframe, since, limit):
        ohlcv = await self.exchange.fetch_ohlcv(
            symbol, timeframe, since, limit
        )
        return [
            KlineData(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=int(candle[0] / 1000),
                open=candle[1],
                high=candle[2],
                low=candle[3],
                close=candle[4],
                volume=candle[5]
            )
            for candle in ohlcv
        ]
```

---

### 阶段 5: 核心节点实现

#### 5.1 K线节点（支持多交易对 + 增量获取）

`backend/app/nodes/kline_node.py`:

```python
class KlineNode(Node):
    def __init__(
        self,
        bus: MessageBus,
        exchange: ExchangeBase,
        db,
        symbols: List[str],
        timeframes: List[str]
    ):
        super().__init__("kline_node", bus)
        self.exchange = exchange
        self.db = db
        self.symbols = symbols
        self.timeframes = timeframes
        
        # 输出 topics
        self.output_topics = [
            f"kline:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
    
    async def fetch_and_publish_loop(self):
        """定时获取K线并发布"""
        while self._running:
            for symbol in self.symbols:
                for tf in self.timeframes:
                    await self._fetch_and_publish(symbol, tf)
            
            # 每3秒执行一次
            await asyncio.sleep(3)
    
    async def _fetch_and_publish(self, symbol: str, timeframe: str):
        # 1. 查询数据库最新时间戳（增量获取关键）
        last_ts = await self.db.get_last_kline_time(symbol, timeframe)
        
        # 2. 从交易所获取增量数据
        klines = await self.exchange.fetch_klines(
            symbol,
            timeframe,
            since=last_ts,  # ← 只获取新数据
            limit=100
        )
        
        if not klines:
            return
        
        # 3. 批量保存到数据库
        await self.db.bulk_insert_klines(klines)
        
        # 4. 逐条发布到消息总线
        for kline in klines:
            await self.emit(
                f"kline:{symbol}:{timeframe}",
                kline.model_dump()
            )
```

#### 5.2 指标节点（一个节点处理多交易对）

`backend/app/nodes/indicator_node.py`:

```python
import pandas as pd
import talib

class IndicatorNode(Node):
    def __init__(
        self,
        bus: MessageBus,
        db,
        symbols: List[str],
        timeframes: List[str]
    ):
        super().__init__("indicator_node", bus)
        self.db = db
        self.symbols = symbols
        self.timeframes = timeframes
        
        # 输入：订阅所有 K线
        self.input_topics = [
            f"kline:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        # 输出：发布指标
        self.output_topics = [
            f"indicator:{symbol}:{tf}"
            for symbol in symbols
            for tf in timeframes
        ]
        
        # 数据缓存（每个交易对独立）
        self.kline_buffer = {}
    
    async def process(self, topic: str, data: dict):
        # 解析 topic
        parts = topic.split(":")
        symbol = parts[1]
        timeframe = parts[2]
        
        kline = KlineData(**data)
        
        # 从数据库加载最近 200 根 K线（计算指标需要历史数据）
        recent_klines = await self.db.get_recent_klines(
            symbol, timeframe, limit=200
        )
        
        if len(recent_klines) < 20:
            return  # 数据不足，跳过
        
        # 转换为 DataFrame 并计算指标
        df = pd.DataFrame([k.dict() for k in recent_klines])
        
        # 使用 TA-Lib 计算
        df['ma5'] = talib.SMA(df['close'], 5)
        df['ma10'] = talib.SMA(df['close'], 10)
        df['ma20'] = talib.SMA(df['close'], 20)
        df['rsi14'] = talib.RSI(df['close'], 14)
        
        macd, signal, hist = talib.MACD(df['close'], 12, 26, 9)
        df['macd_line'] = macd
        df['macd_signal'] = signal
        df['macd_histogram'] = hist
        
        # 提取最新值
        latest = df.iloc[-1]
        
        if pd.isna(latest['ma20']):
            return  # 指标未计算完成
        
        indicator = IndicatorData(
            symbol=symbol,
            timeframe=timeframe,
            timestamp=kline.timestamp,
            ma5=float(latest['ma5']),
            ma10=float(latest['ma10']),
            ma20=float(latest['ma20']),
            rsi14=float(latest['rsi14']),
            macd_line=float(latest['macd_line']),
            macd_signal=float(latest['macd_signal']),
            macd_histogram=float(latest['macd_histogram'])
        )
        
        # 保存到数据库
        await self.db.insert_indicator(indicator)
        
        # 发布到消息总线
        await self.emit(
            f"indicator:{symbol}:{timeframe}",
            indicator.model_dump()
        )
```

#### 5.3 策略节点

`backend/app/nodes/strategy_node.py`:

```python
class DualMAStrategyNode(Node):
    """双均线策略"""
    
    def __init__(
        self,
        bus: MessageBus,
        db,
        symbols: List[str],
        timeframe: str
    ):
        super().__init__("dual_ma_strategy", bus)
        self.db = db
        self.symbols = symbols
        self.timeframe = timeframe
        
        # 订阅 K线和指标
        self.input_topics = [
            f"kline:{symbol}:{timeframe}" for symbol in symbols
        ] + [
            f"indicator:{symbol}:{timeframe}" for symbol in symbols
        ]
        
        self.output_topics = [
            f"signal:dual_ma:{symbol}" for symbol in symbols
        ]
        
        # 状态缓存
        self.state = {
            symbol: {"kline": None, "indicator": None}
            for symbol in symbols
        }
    
    async def process(self, topic: str, data: dict):
        parts = topic.split(":")
        data_type = parts[0]
        symbol = parts[1]
        
        # 更新状态
        if data_type == "kline":
            self.state[symbol]["kline"] = KlineData(**data)
        elif data_type == "indicator":
            self.state[symbol]["indicator"] = IndicatorData(**data)
        
        # 检查数据完整性
        if not all(self.state[symbol].values()):
            return
        
        kline = self.state[symbol]["kline"]
        indicator = self.state[symbol]["indicator"]
        
        # 获取前一根K线的指标（判断交叉）
        prev_indicator = await self.db.get_indicator_at(
            symbol, self.timeframe, kline.timestamp - 3600
        )
        
        if not prev_indicator:
            return
        
        # 策略逻辑
        signal = None
        
        # 金叉：MA5 上穿 MA20
        if (prev_indicator.ma5 <= prev_indicator.ma20 and
            indicator.ma5 > indicator.ma20):
            signal = SignalData(
                strategy_name="dual_ma",
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type="BUY",
                price=kline.close,
                reason=f"MA5({indicator.ma5:.2f}) 上穿 MA20({indicator.ma20:.2f})"
            )
        
        # 死叉：MA5 下穿 MA20
        elif (prev_indicator.ma5 >= prev_indicator.ma20 and
              indicator.ma5 < indicator.ma20):
            signal = SignalData(
                strategy_name="dual_ma",
                symbol=symbol,
                timestamp=kline.timestamp,
                signal_type="SELL",
                price=kline.close,
                reason=f"MA5({indicator.ma5:.2f}) 下穿 MA20({indicator.ma20:.2f})"
            )
        
        if signal:
            await self.db.insert_signal(signal)
            await self.emit(f"signal:dual_ma:{symbol}", signal.model_dump())
```

---

### 阶段 6: 多进程启动方案

#### 6.1 统一启动入口（支持独立启动）

`backend/app/main.py`:

```python
import argparse
import asyncio
import redis.asyncio as redis
from app.core.message_bus import MessageBus
from app.core.database import Database
from app.config import settings

async def start_kline_node(bus, db, args):
    from app.nodes.kline_node import KlineNode
    from app.exchanges.binance import BinanceExchange
    
    exchange = BinanceExchange(
        settings.binance_api_key,
        settings.binance_api_secret
    )
    
    symbols = args.symbols.split(",")
    timeframes = args.timeframes.split(",")
    
    node = KlineNode(bus, exchange, db, symbols, timeframes)
    await node.start()
    await node.fetch_and_publish_loop()  # 定时任务

async def start_indicator_node(bus, db, args):
    from app.nodes.indicator_node import IndicatorNode
    
    symbols = args.symbols.split(",")
    timeframes = args.timeframes.split(",")
    
    node = IndicatorNode(bus, db, symbols, timeframes)
    await node.start()

async def start_strategy_node(bus, db, args):
    from app.nodes.strategy_node import DualMAStrategyNode
    
    symbols = args.symbols.split(",")
    
    node = DualMAStrategyNode(bus, db, symbols, args.timeframe)
    await node.start()

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", choices=["kline", "indicator", "strategy", "all"])
    parser.add_argument("--symbols", default="BTCUSDT")
    parser.add_argument("--timeframes", default="1h")
    parser.add_argument("--timeframe", default="1h")
    
    args = parser.parse_args()
    
    # 连接基础设施
    redis_client = await redis.from_url(
        f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
    )
    bus = MessageBus(redis_client)
    
    db = Database(settings.database_url)
    await db.connect()
    
    # 启动节点
    if args.node == "kline":
        await start_kline_node(bus, db, args)
    elif args.node == "indicator":
        await start_indicator_node(bus, db, args)
    elif args.node == "strategy":
        await start_strategy_node(bus, db, args)
    elif args.node == "all":
        # 单进程启动所有（不推荐生产环境）
        tasks = [
            start_kline_node(bus, db, args),
            start_indicator_node(bus, db, args),
            start_strategy_node(bus, db, args)
        ]
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
```

#### 6.2 多进程启动脚本

`scripts/dev_start.sh`:

```bash
#!/bin/bash

echo "🚀 启动量化交易系统（多进程模式）"

# 1. 启动基础设施
docker-compose up -d redis postgres
sleep 3

# 2. 初始化数据库
cd backend
alembic upgrade head

# 3. 启动节点（每个独立进程）
python3 main.py --node kline --symbols BTCUSDT,ETHUSDT --timeframes 1h &
echo "✅ K线节点启动 (PID: $!)"

python3 main.py --node indicator --symbols BTCUSDT,ETHUSDT --timeframes 1h &
echo "✅ 指标节点启动 (PID: $!)"

python3 main.py --node strategy --symbols BTCUSDT,ETHUSDT --timeframe 1h &
echo "✅ 策略节点启动 (PID: $!)"

echo "✅ 所有节点已启动（多进程模式，避免GIL）"
echo "按 Ctrl+C 停止"

wait
```

---

### 阶段 7: React 前端集成

#### 7.1 初始化 React 项目（使用 Vite）

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install lightweight-charts zustand axios
```

#### 7.2 图表组件（React + Lightweight Charts）

`frontend/src/components/TradingChart.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function TradingChart({ symbol, onChartReady }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
    });

    chartRef.current = chart;

    // 创建 K线系列
    seriesRef.current.candlestick = chart.addSeries(
      createChart.CandlestickSeries,
      { upColor: '#26a69a', downColor: '#ef5350' }
    );

    // 创建均线系列
    seriesRef.current.ma5 = chart.addSeries(
      createChart.LineSeries,
      { color: '#FF6B6B', lineWidth: 1, title: 'MA5' }
    );

    seriesRef.current.ma20 = chart.addSeries(
      createChart.LineSeries,
      { color: '#4ECDC4', lineWidth: 1, title: 'MA20' }
    );

    // 通知父组件图表已就绪
    if (onChartReady) {
      onChartReady(chart, seriesRef.current);
    }

    // 响应式调整
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  return (
    <div 
      ref={chartContainerRef} 
      className="trading-chart"
      style={{ width: '100%', height: '600px' }}
    />
  );
}
```

#### 7.3 WebSocket Hook

`frontend/src/hooks/useWebSocket.js`:

```javascript
import { useEffect, useRef, useState } from 'react';

export function useWebSocket(url, onMessage) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (onMessage) onMessage(message);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return { isConnected, ws: wsRef.current };
}
```

#### 7.4 主应用组件

`frontend/src/App.jsx`:

```jsx
import { useState, useRef } from 'react';
import TradingChart from './components/TradingChart';
import { useWebSocket } from './hooks/useWebSocket';
import './styles/index.css';

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [signals, setSignals] = useState([]);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const handleChartReady = (chart, series) => {
    chartRef.current = chart;
    seriesRef.current = series;
  };

  const { isConnected } = useWebSocket(
    'ws://localhost:8000/ws',
    (message) => {
      switch (message.type) {
        case 'kline':
          if (seriesRef.current?.candlestick) {
            seriesRef.current.candlestick.update({
              time: message.data.timestamp,
              open: message.data.open,
              high: message.data.high,
              low: message.data.low,
              close: message.data.close,
            });
          }
          break;

        case 'indicator':
          if (seriesRef.current?.ma5) {
            seriesRef.current.ma5.update({
              time: message.data.timestamp,
              value: message.data.ma5,
            });
          }
          if (seriesRef.current?.ma20) {
            seriesRef.current.ma20.update({
              time: message.data.timestamp,
              value: message.data.ma20,
            });
          }
          break;

        case 'signal':
          setSignals(prev => [...prev, message.data]);
          // 在图表上标记信号
          if (seriesRef.current?.candlestick) {
            const marker = {
              time: message.data.timestamp,
              position: message.data.signal_type === 'BUY' ? 'belowBar' : 'aboveBar',
              color: message.data.signal_type === 'BUY' ? '#26a69a' : '#ef5350',
              shape: message.data.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown',
              text: message.data.signal_type,
            };
            seriesRef.current.candlestick.setMarkers([...signals, marker]);
          }
          break;
      }
    }
  );

  return (
    <div className="app">
      <header className="header">
        <h1>量化交易系统</h1>
        <div className="status">
          {isConnected ? '🟢 已连接' : '🔴 未连接'}
        </div>
      </header>

      <main className="main-content">
        <div className="chart-section">
          <div className="toolbar">
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)}
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
            </select>
          </div>

          <TradingChart 
            symbol={symbol} 
            onChartReady={handleChartReady} 
          />
        </div>

        <aside className="signal-panel">
          <h3>交易信号</h3>
          <div className="signal-list">
            {signals.map((signal, idx) => (
              <div key={idx} className={`signal signal-${signal.signal_type.toLowerCase()}`}>
                <strong>{signal.signal_type}</strong>
                <span>{signal.symbol}</span>
                <span>{new Date(signal.timestamp * 1000).toLocaleString()}</span>
                <span>${signal.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
```

#### 7.5 前端配置

`frontend/package.json`:

```json
{
  "name": "quant-trading-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lightweight-charts": "^4.1.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

`frontend/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
```

---

### 阶段 8: 预留接口

#### 回测服务

`backend/app/services/backtest.py`:

```python
class BacktestService:
    """
    回测服务接口定义
    
    待实现功能：
  - 历史数据回放
  - 策略性能评估
  - 风险指标计算
  - 交易记录生成
    """
    
    async def run_backtest(
        self,
        strategy_name: str,
        symbol: str,
        start_time: int,
        end_time: int,
        initial_capital: float = 10000.0
    ) -> dict:
        """
        返回格式：
        {
            "total_return": 0.15,
            "sharpe_ratio": 1.2,
            "max_drawdown": 0.08,
            "win_rate": 0.65,
            "trades": [...]
        }
        """
        raise NotImplementedError("回测功能待实现")
```

#### 实盘交易服务

`backend/app/services/live_trading.py`:

```python
class LiveTradingService:
    """
    实盘交易服务接口定义
    
    待实现功能：
  - 信号执行
  - 风控管理
  - 仓位管理
  - 订单监控
    """
    
    async def execute_signal(self, signal: SignalData):
        """执行交易信号"""
        raise NotImplementedError("实盘交易待实现")
    
    async def get_positions(self, symbol: str = None):
        """获取当前持仓"""
        raise NotImplementedError("待实现")
```

---

## 启动方式

### 开发环境（推荐）

```bash
# 1. 启动基础设施（Docker）
docker-compose up -d

# 2. 安装依赖
cd backend
pip install -r requirements.txt

# 3. 初始化数据库
alembic upgrade head

# 4. 启动节点（多进程，避免GIL）
python3 main.py --node kline --symbols BTCUSDT,ETHUSDT &
python3 main.py --node indicator --symbols BTCUSDT,ETHUSDT &
python3 main.py --node strategy --symbols BTCUSDT,ETHUSDT &

# 或使用启动脚本
./scripts/dev_start.sh
```

### 生产环境

```bash
# Docker Compose 部署（每个节点独立容器）
docker-compose -f docker-compose.prod.yml up -d
```

---

## 文档输出

1. **系统架构文档** (`docs/architecture.md`)

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 整体架构图
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 消息流转图
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 数据库设计
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 为什么用 Redis + PostgreSQL

2. **节点开发指南** (`docs/node_development.md`)

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 如何创建新节点
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Topic 命名规范
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 数据格式定义
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 资源占用评估

3. **API 接口文档** (`docs/api_spec.md`)

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - REST API 端点
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - WebSocket 消息格式
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 待实现接口清单

4. **部署指南** (`docs/deployment.md`)

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 开发环境部署
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 生产环境部署
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Docker vs 本地运行
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - 性能调优建议

### To-dos

- [ ] 创建项目目录结构、初始化虚拟环境、编写 requirements.txt 和 docker-compose.yml
- [ ] 实现 Redis 消息总线封装（Pub/Sub + Streams），定义 Topic 命名规范
- [ ] 实现节点基类，提供订阅、发布、启动、停止等通用方法
- [ ] 使用 Pydantic 定义 KlineData、IndicatorData、SignalData 数据模型
- [ ] 创建 PostgreSQL 表结构（klines、indicators、signals），配置 SQLAlchemy
- [ ] 实现交易所基类和币安交易所，列出待支持交易所接口
- [ ] 实现 K线数据节点，支持增量获取和数据库持久化
- [ ] 实现指标计算节点，使用 TA-Lib 计算 MA、RSI、MACD 等指标
- [ ] 实现双均线策略节点，订阅 K线和指标数据，输出交易信号
- [ ] 使用 FastAPI 实现 REST API（获取历史数据、控制节点）
- [ ] 实现 WebSocket 端点，实时推送 K线、指标、信号到前端
- [ ] 基于 TradingView Lightweight Charts 实现图表管理器
- [ ] 实现前端 WebSocket 客户端，接收实时数据并更新图表
- [ ] 定义回测服务和实盘交易服务的接口规范（待实现）
- [ ] 编写架构设计文档、API 接口文档、使用指南