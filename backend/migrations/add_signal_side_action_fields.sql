-- 添加 side 和 action 字段到 signals 表
-- 用于区分做多/做空和开仓/平仓操作

-- 1. 扩展 signal_type 字段长度，以支持新的信号类型（OPEN_LONG, OPEN_SHORT等）
ALTER TABLE signals 
ALTER COLUMN signal_type TYPE VARCHAR(20);

-- 2. 添加 side 字段（LONG/SHORT）
ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS side VARCHAR(10);

-- 3. 添加 action 字段（OPEN/CLOSE）
ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS action VARCHAR(10);

-- 4. 为已有数据填充默认值（可选）
-- 将已有的 BUY 信号映射为 OPEN_LONG
UPDATE signals 
SET 
    signal_type = 'OPEN_LONG',
    side = 'LONG',
    action = 'OPEN'
WHERE signal_type = 'BUY';

-- 将已有的 SELL 信号映射为 OPEN_SHORT
UPDATE signals 
SET 
    signal_type = 'OPEN_SHORT',
    side = 'SHORT',
    action = 'OPEN'
WHERE signal_type = 'SELL';

-- 5. 添加注释
COMMENT ON COLUMN signals.side IS '仓位方向: LONG(做多)/SHORT(做空)';
COMMENT ON COLUMN signals.action IS '操作类型: OPEN(开仓)/CLOSE(平仓)';
COMMENT ON COLUMN signals.signal_type IS '信号类型: BUY/SELL(现货) 或 OPEN_LONG/OPEN_SHORT/CLOSE_LONG/CLOSE_SHORT(合约)';

