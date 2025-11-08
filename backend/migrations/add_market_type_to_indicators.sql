-- 迁移脚本：为 indicators 表添加 market_type 字段
-- 创建时间：2025-11-09
-- 目的：支持现货/合约指标数据隔离

BEGIN;

-- 1. 添加 market_type 列（默认为 'spot'，允许为现有数据提供默认值）
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS market_type VARCHAR(20) DEFAULT 'spot';

-- 2. 为现有数据设置 market_type（根据实际情况调整）
--   假设现有的所有指标数据都是 'future' 类型
--   如果是其他类型，请修改以下 SQL
UPDATE indicators SET market_type = 'future' WHERE market_type = 'spot';

-- 3. 将 market_type 设置为 NOT NULL
ALTER TABLE indicators ALTER COLUMN market_type SET NOT NULL;

-- 4. 删除旧的唯一索引（不包含 market_type）
DROP INDEX IF EXISTS idx_indicators_lookup;

-- 5. 创建新的唯一索引（包含 market_type）
CREATE UNIQUE INDEX idx_indicators_lookup 
ON indicators (symbol, timeframe, timestamp, market_type);

-- 6. 为 market_type 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS ix_indicators_market_type ON indicators (market_type);

COMMIT;

-- 验证迁移结果
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'indicators' AND column_name = 'market_type';

-- 查看索引
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'indicators';

