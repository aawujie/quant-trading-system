# 指标计算与显示完整流程

> 记录从数据采集、指标计算、存储、到前端显示的完整数据流

---

## 系统架构图

```
┌─────────────────┐
│  Binance API    │  实时K线数据源
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Data Node       │  数据采集节点
│ (binance_data_node.py)
└────────┬────────┘
         │ publish "kline:BTCUSDT:1h"
         ↓
    ┌────────────┐
    │ MessageBus │  Redis消息总线
    └────┬───────┘
         │ subscribe
         ↓
┌─────────────────┐
│ Indicator Node  │  指标计算节点
│ (indicator_node.py)
│ - 加载200根历史K线
│ - 使用TA-Lib计算
└────────┬────────┘
         │
         ├─→ 保存到 PostgreSQL Database
         │
         └─→ publish "indicator:BTCUSDT:1h"
              │
              ↓
         ┌────────────┐
         │ MessageBus │
         └────┬───────┘
              │
              ├─→ REST API (历史查询)
              │   GET /api/indicators/{symbol}/{timeframe}/latest
              │
              └─→ WebSocket (实时推送)
                  ws://localhost:8001/ws
                  │
                  ↓
            ┌──────────────┐
            │   Frontend   │
            │   (React)    │
            ├──────────────┤
            │ 1. REST加载历史
            │ 2. WebSocket实时更新
            │ 3. 更新图表
            └──────────────┘
                  │
                  ↓
            ┌──────────────┐
            │ TradingView  │
            │ Lightweight  │
            │   Charts     │
            └──────────────┘
```

---

## 数据流详解

### 1️⃣ 数据采集（Data Collection）

**节点：** `backend/app/nodes/binance_data_node.py`

**流程：**
1. 订阅Binance WebSocket
2. 接收实时K线数据
3. 保存到数据库（klines表）
4. 发布到消息总线

**发布消息：**
```json
Topic: "kline:BTCUSDT:1h"
Data: {
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "timestamp": 1762606800,
    "open": 108500.0,
    "high": 109000.0,
    "low": 108000.0,
    "close": 108800.0,
    "volume": 1234.56
}
```

---

### 2️⃣ 指标计算（Indicator Calculation）

**节点：** `backend/app/nodes/indicator_node.py`

**触发：** 收到新的K线数据（通过消息总线订阅）

**计算流程：**
```
接收K线数据
    ↓
从数据库加载历史数据（200根K线）
    ↓
转换为pandas DataFrame
    ↓
使用TA-Lib计算指标：
    - MA5, MA10, MA20, MA60, MA120
    - EMA12, EMA26
    - RSI14
    - MACD (DIF, DEA, Histogram)
    - 布林带 (Upper, Middle, Lower)
    - ATR14
    - Volume MA5
    ↓
提取最新值
    ↓
保存到数据库（indicators表）
    ↓
发布到消息总线
```

**核心代码：**
```python
# 提取价格数组
close = df['close'].values
high = df['high'].values
low = df['low'].values
volume = df['volume'].values

# 使用TA-Lib计算
ma5 = talib.SMA(close, timeperiod=5)
ma10 = talib.SMA(close, timeperiod=10)
ma20 = talib.SMA(close, timeperiod=20)
ma60 = talib.SMA(close, timeperiod=60)
ma120 = talib.SMA(close, timeperiod=120)

ema12 = talib.EMA(close, timeperiod=12)
ema26 = talib.EMA(close, timeperiod=26)

rsi14 = talib.RSI(close, timeperiod=14)

macd_line, macd_signal, macd_histogram = talib.MACD(
    close, fastperiod=12, slowperiod=26, signalperiod=9
)

bb_upper, bb_middle, bb_lower = talib.BBANDS(
    close, timeperiod=20, nbdevup=2, nbdevdn=2, matype=0
)

atr14 = talib.ATR(high, low, close, timeperiod=14)
volume_ma5 = talib.SMA(volume, timeperiod=5)
```

**发布消息：**
```json
Topic: "indicator:BTCUSDT:1h"
Data: {
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "timestamp": 1762606800,
    "ma5": 109234.5,
    "ma10": 109123.2,
    "ma20": 108450.2,
    "ma60": 107890.5,
    "ma120": 106234.8,
    "ema12": 109456.3,
    "ema26": 108234.1,
    "rsi14": 65.3,
    "macd_line": 123.4,
    "macd_signal": 98.7,
    "macd_histogram": 24.7,
    "bb_upper": 110234.5,
    "bb_middle": 108450.2,
    "bb_lower": 106665.9,
    "atr14": 456.78,
    "volume_ma5": 1456.89
}
```

---

### 3️⃣ 数据存储（Database）

**数据库：** PostgreSQL

**indicators表结构：**
```sql
CREATE TABLE indicators (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp INTEGER NOT NULL,
    
    -- 移动平均线
    ma5 FLOAT,
    ma10 FLOAT,
    ma20 FLOAT,
    ma60 FLOAT,
    ma120 FLOAT,
    
    -- 指数移动平均线
    ema12 FLOAT,
    ema26 FLOAT,
    
    -- RSI
    rsi14 FLOAT,
    
    -- MACD
    macd_line FLOAT,
    macd_signal FLOAT,
    macd_histogram FLOAT,
    
    -- 布林带
    bb_upper FLOAT,
    bb_middle FLOAT,
    bb_lower FLOAT,
    
    -- ATR
    atr14 FLOAT,
    
    -- 成交量指标
    volume_ma5 FLOAT,
    
    UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX idx_indicators_lookup ON indicators(symbol, timeframe, timestamp DESC);
```

---

### 4️⃣ REST API（历史数据查询）

**文件：** `backend/app/api/rest.py`

**端点：**
```python
GET /api/indicators/{symbol}/{timeframe}/latest

# 示例
GET /api/indicators/BTCUSDT/1h/latest

# 响应
{
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "timestamp": 1762606800,
    "ma5": 109234.5,
    "ma20": 108450.2,
    "rsi14": 65.3,
    ...
}
```

**使用场景：**
- 页面初始化
- 切换交易对
- 切换时间周期
- 加载历史数据

---

### 5️⃣ WebSocket（实时推送）

**文件：** `backend/app/api/websocket.py`

**连接：** `ws://localhost:8001/ws`

**流程：**
```javascript
// 1. 建立连接
const ws = new WebSocket('ws://localhost:8001/ws');

// 2. 订阅主题
ws.send(JSON.stringify({
    action: 'subscribe',
    topics: [
        'kline:BTCUSDT:1h',
        'indicator:BTCUSDT:1h'
    ]
}));

// 3. 接收实时推送
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.topic === 'indicator:BTCUSDT:1h') {
        handleIndicatorUpdate(message.data);
    }
};
```

**使用场景：**
- 实时更新最新指标
- 低延迟推送（毫秒级）
- 持续接收数据流

---

### 6️⃣ 前端接收与显示

#### A. 初始化加载（REST）

**文件：** `frontend/src/App.jsx`

```javascript
// 页面加载时，获取历史指标
const loadIndicators = async (klines) => {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/api/indicators/${symbol}/${timeframe}/latest`
        );
        
        console.log('Latest indicator:', response.data);
    } catch (err) {
        console.error('Failed to load indicators:', err);
    }
};
```

**时机：**
- 页面初始化
- 切换交易对
- 切换时间周期

---

#### B. 实时更新（WebSocket）

**文件：** `frontend/src/App.jsx`

```javascript
// 接收WebSocket推送的指标数据
const handleIndicatorUpdate = (indicator) => {
    const currentSymbol = symbolRef.current;
    const currentTimeframe = timeframeRef.current;
    
    // 检查是否匹配当前图表
    if (seriesRef.current && 
        indicator.symbol === currentSymbol && 
        indicator.timeframe === currentTimeframe) {
        
        try {
            // 更新MA5线
            if (indicator.ma5) {
                seriesRef.current.ma5.update({
                    time: indicator.timestamp,
                    value: indicator.ma5,
                });
            }
            
            // 更新MA20线
            if (indicator.ma20) {
                seriesRef.current.ma20.update({
                    time: indicator.timestamp,
                    value: indicator.ma20,
                });
            }
            
            console.log('✅ Updated indicators:', indicator.timestamp);
        } catch (error) {
            console.error('❌ Failed to update indicators:', error);
        }
    }
};
```

**时机：**
- 新K线产生时
- 自动接收推送
- 增量更新图表

---

#### C. 图表显示（TradingView Lightweight Charts）

**文件：** `frontend/src/components/TradingChart.jsx`

```javascript
// 创建MA5指标线
const ma5Series = chart.addLineSeries({
    color: '#FF6B6B',       // 红色
    lineWidth: 1,
    title: 'MA5',
    priceLineVisible: false,
    lastValueVisible: false,
});

// 创建MA20指标线
const ma20Series = chart.addLineSeries({
    color: '#4ECDC4',       // 青色
    lineWidth: 1,
    title: 'MA20',
    priceLineVisible: false,
    lastValueVisible: false,
});

// 设置历史数据
ma5Series.setData([
    { time: 1762606800, value: 109234.5 },
    { time: 1762610400, value: 109340.2 },
    ...
]);

// 实时更新（WebSocket触发）
ma5Series.update({
    time: 1762614000,
    value: 109456.8
});
```

---

## 两种数据获取方式对比

### 1. FastAPI REST - 历史数据

**使用场景：**
- ✅ 页面初始化
- ✅ 切换交易对
- ✅ 切换时间周期
- ✅ 批量加载历史数据

**特点：**
- 请求-响应模式
- 客户端主动请求
- 支持参数查询（limit、before）
- 适合大批量数据

**示例：**
```javascript
// HTTP请求
const response = await axios.get(
    `${API_BASE_URL}/api/indicators/BTCUSDT/1h/latest`
);
```

---

### 2. WebSocket - 实时推送

**使用场景：**
- ✅ 实时更新最新数据
- ✅ 持续接收数据流
- ✅ 低延迟推送

**特点：**
- 双向持久连接
- 服务器主动推送
- 毫秒级延迟
- 适合实时数据

**示例：**
```javascript
// WebSocket订阅
ws.send(JSON.stringify({
    action: 'subscribe',
    topics: ['indicator:BTCUSDT:1h']
}));

// 自动接收推送
ws.onmessage = (event) => {
    handleIndicatorUpdate(event.data);
};
```

---

## 完整使用流程示例

### 场景：用户打开BTCUSDT 1h图表

```
步骤1: 初始化（REST API）
    ↓
用户打开页面
    ↓
前端发起HTTP请求：
  - GET /api/klines/BTCUSDT/1h?limit=500
  - GET /api/indicators/BTCUSDT/1h/latest
    ↓
加载500根K线和指标数据
    ↓
在图表上绘制K线和MA线

---

步骤2: 建立实时连接（WebSocket）
    ↓
连接：ws://localhost:8001/ws
    ↓
订阅主题：
  - 'kline:BTCUSDT:1h'
  - 'indicator:BTCUSDT:1h'
    ↓
保持连接，等待实时推送

---

步骤3: 实时更新（WebSocket推送）
    ↓
新的1h K线产生（如：18:00）
    ↓
后端IndicatorNode计算指标
    ↓
WebSocket推送消息：
{
    "topic": "indicator:BTCUSDT:1h",
    "data": {
        "timestamp": 1762606800,
        "ma5": 109234.5,
        "ma20": 108450.2,
        ...
    }
}
    ↓
前端接收并更新图表（新增一个点）
```

---

## 关键组件说明

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| **数据采集节点** | `backend/app/nodes/binance_data_node.py` | 订阅Binance WebSocket，采集K线 |
| **指标计算节点** | `backend/app/nodes/indicator_node.py` | 使用TA-Lib计算技术指标 |
| **数据库层** | `backend/app/core/database.py` | PostgreSQL数据持久化 |
| **REST API** | `backend/app/api/rest.py` | HTTP端点，历史数据查询 |
| **WebSocket** | `backend/app/api/websocket.py` | 实时数据推送 |
| **消息总线** | `backend/app/core/message_bus.py` | Redis Pub/Sub，组件解耦 |
| **前端主应用** | `frontend/src/App.jsx` | 状态管理、数据加载 |
| **图表组件** | `frontend/src/components/TradingChart.jsx` | TradingView图表显示 |

---

## 技术栈

### 后端
- Python 3.13
- TA-Lib (技术指标计算)
- pandas (数据处理)
- PostgreSQL (数据存储)
- Redis (消息总线)
- FastAPI (REST API)
- WebSocket (实时推送)

### 前端
- React 18
- TradingView Lightweight Charts
- axios (HTTP客户端)
- WebSocket API

---

**文档版本：** v1.1  
**最后更新：** 2025-11-08
