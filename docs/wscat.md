## websocket调试工具

```shell
# 安装
npm install -g wscat

# 连接
wscat -c ws://localhost:8001/ws

# 收到欢迎消息
< {"type":"connection","status":"connected","message":"Welcome to Quantitative Trading System WebSocket"}

# 订阅主题
> {"action":"subscribe","topics":["kline:BTCUSDT:1h:future"]}

# 取消订阅
> {"action": "unsubscribe", "topics": ["kline:BTCUSDT:1h:future"]}

# 心跳
> {"action": "ping"}

# 查询所有活跃的 topics
> {"action": "list_topics"}

# 查看当前订阅的 topics
> {"action": "my_subscriptions"}

# 收到订阅确认
< {"type":"subscription","status":"success","topics":["kline:BTCUSDT:1h:future"]}

# 收到心跳响应
< {"type":"pong"}

# 收到 topics 列表
< {"type":"topics","topics":["kline:BTCUSDT:1h:future","kline:ETHUSDT:1h:future"],"count":2}

# 收到当前订阅列表
< {"type":"subscriptions","topics":["kline:BTCUSDT:1h:future"],"count":1}

# 收到实时数据
< {"topic":"kline:BTCUSDT:1h:future","data":{...}}
```