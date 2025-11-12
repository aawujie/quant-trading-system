-- 创建回测运行记录表
-- 用于存储回测的元数据和结果，方便前端查询和展示

CREATE TABLE IF NOT EXISTS backtest_runs (
    id SERIAL PRIMARY KEY,
    
    -- 回测标识
    run_id VARCHAR(50) UNIQUE NOT NULL,  -- 唯一运行ID（用于文件名等）
    
    -- 回测配置
    strategy_name VARCHAR(50) NOT NULL,   -- 策略名称
    symbol VARCHAR(20) NOT NULL,          -- 交易对
    timeframe VARCHAR(10) NOT NULL,       -- 时间周期
    market_type VARCHAR(20) NOT NULL,     -- 市场类型（spot/future/delivery）
    start_time BIGINT NOT NULL,           -- 开始时间戳
    end_time BIGINT NOT NULL,             -- 结束时间戳
    initial_capital FLOAT NOT NULL,       -- 初始资金
    
    -- 策略参数（JSONB格式，便于查询）
    strategy_params JSONB,
    
    -- 仓位管理配置
    position_preset VARCHAR(50),          -- 仓位管理预设名称
    position_config JSONB,                -- 仓位管理详细配置
    
    -- 核心指标（便于快速查询和排序）
    total_return FLOAT,                   -- 总收益率
    sharpe_ratio FLOAT,                   -- 夏普比率
    max_drawdown FLOAT,                   -- 最大回撤
    win_rate FLOAT,                       -- 胜率
    total_trades INTEGER,                 -- 交易次数
    profit_factor FLOAT,                  -- 盈利因子
    
    -- 资金指标
    initial_balance FLOAT,                -- 初始余额
    final_balance FLOAT,                  -- 最终余额
    
    -- 交易统计
    avg_holding_time FLOAT,               -- 平均持仓时间（小时）
    max_position_pct FLOAT,               -- 最大仓位占比
    avg_position_size FLOAT,              -- 平均单笔投入
    
    -- 详细数据（JSONB格式）
    signals JSONB,                        -- 所有交易信号列表
    metrics JSONB,                        -- 完整的性能指标
    
    -- 元数据
    status VARCHAR(20) DEFAULT 'completed',  -- completed/failed
    error_message TEXT,                   -- 错误信息（如果失败）
    duration FLOAT,                       -- 回测耗时（秒）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以加速常见查询
CREATE INDEX IF NOT EXISTS idx_backtest_runs_symbol_timeframe ON backtest_runs(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy ON backtest_runs(strategy_name);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_created_at ON backtest_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_total_return ON backtest_runs(total_return DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_sharpe_ratio ON backtest_runs(sharpe_ratio DESC);

-- JSONB字段的GIN索引（加速JSON查询）
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy_params ON backtest_runs USING GIN (strategy_params);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_signals ON backtest_runs USING GIN (signals);

-- 添加注释
COMMENT ON TABLE backtest_runs IS '回测运行记录表，存储回测配置和结果';
COMMENT ON COLUMN backtest_runs.run_id IS '唯一运行ID，格式: {strategy}_{symbol}_{timeframe}_{timestamp}';
COMMENT ON COLUMN backtest_runs.total_return IS '总收益率（0.15表示15%）';
COMMENT ON COLUMN backtest_runs.sharpe_ratio IS '夏普比率（越高越好，>1为良好）';
COMMENT ON COLUMN backtest_runs.max_drawdown IS '最大回撤（负数，-0.2表示20%回撤）';
COMMENT ON COLUMN backtest_runs.signals IS '所有交易信号的JSON数组';
COMMENT ON COLUMN backtest_runs.metrics IS '完整性能指标的JSON对象';

