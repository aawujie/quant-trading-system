graph TD
    %% 数据源节点
    A[Data Feed Node<br/>市场数据源] -->|publish: K线数据| B[/market_data/kline]
    A -->|publish: 成交量数据| C[/market_data/volume]
    
    %% 指标计算节点（共享上游）
    D[Indicator Nodes<br/>各种指标计算器<br/>e.g., MA, RSI, MACD] -.->|subscribe| B
    D -.->|subscribe| C
    D -->|publish: 指标值| E[/indicators/{type}<br/>e.g., /indicators/ma, /indicators/rsi]
    
    %% 多个策略节点（共享订阅）
    F1[Strategy Node A<br/>e.g., 均线交叉策略] -.->|subscribe: 多指标| E
    F1 -->|publish: 专属信号| G1[/signals/strategy_a<br/>e.g., buy/sell for MA Cross]
    
    F2[Strategy Node B<br/>e.g., RSI超买策略] -.->|subscribe: 多指标| E
    F2 -->|publish: 专属信号| G2[/signals/strategy_b<br/>e.g., sell for RSI Overbought]
    
    F3[Strategy Node C<br/>e.g., MACD动量策略] -.->|subscribe: 多指标| E
    F3 -->|publish: 专属信号| G3[/signals/strategy_c<br/>e.g., buy for MACD Bullish]
    
    %% 信号汇聚到执行
    H[Executor Node<br/>订单执行器<br/>+ 风险控制] -.->|subscribe: 多信号| G1
    H -.->|subscribe: 多信号| G2
    H -.->|subscribe: 多信号| G3
    H -->|execute: 聚合订单| I[External Broker<br/>外部经纪商]
    I -.->|feedback: 执行结果| J[/logs/execution<br/>+ 风险警报]
    
    %% 反馈循环（可选监控）
    K[Monitor Node<br/>系统监控] -.->|subscribe| J
    K -.->|subscribe 多信号| G1
    K -.->|subscribe 多信号| G2
    K -.->|subscribe 多信号| G3
    K -->|publish: 警报/报告| L[/system/monitor]
    
    %% 样式
    classDef node fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef topic fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    class A,D,F1,F2,F3,H,K node;
    class B,C,E,G1,G2,G3,J,L topic;