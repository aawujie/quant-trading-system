-- 创建交易记录表
-- 用于记录策略的历史交易，供凯利公式和AI推理使用

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    
    -- 基本信息
    strategy_name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,  -- LONG/SHORT
    
    -- 入场信息
    entry_price FLOAT NOT NULL,
    entry_time BIGINT NOT NULL,
    entry_signal_type VARCHAR(20),
    
    -- 出场信息
    exit_price FLOAT NOT NULL,
    exit_time BIGINT NOT NULL,
    exit_signal_type VARCHAR(20),
    exit_reason VARCHAR(200),
    
    -- 仓位信息
    quantity FLOAT NOT NULL,
    usdt_amount FLOAT NOT NULL,
    
    -- 盈亏信息
    pnl FLOAT NOT NULL,
    pnl_pct FLOAT NOT NULL,
    
    -- 止损止盈
    stop_loss FLOAT,
    take_profit FLOAT,
    
    -- AI增强信息（可选）
    ai_enhanced BOOLEAN DEFAULT FALSE,
    ai_confidence FLOAT,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    CONSTRAINT trades_pkey PRIMARY KEY (id)
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_trades_strategy_symbol ON trades(strategy_name, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_exit_time ON trades(exit_time);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl);

-- 添加注释
COMMENT ON TABLE trades IS '交易记录表，用于统计策略表现和AI分析';
COMMENT ON COLUMN trades.pnl IS '盈亏金额（USDT）';
COMMENT ON COLUMN trades.pnl_pct IS '盈亏百分比';
COMMENT ON COLUMN trades.ai_enhanced IS '是否使用AI增强决策';

