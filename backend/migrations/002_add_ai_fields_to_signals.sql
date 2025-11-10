-- 为signals表添加AI相关字段
-- 支持AI信号增强功能

-- 添加AI增强字段
ALTER TABLE signals
ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT,
ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50),
ADD COLUMN IF NOT EXISTS ai_risk_assessment VARCHAR(20);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_signals_ai_enhanced ON signals(ai_enhanced);

-- 添加注释
COMMENT ON COLUMN signals.ai_enhanced IS '是否经过AI增强';
COMMENT ON COLUMN signals.ai_reasoning IS 'AI推理过程（Chain of Thought）';
COMMENT ON COLUMN signals.ai_confidence IS 'AI置信度（0-1）';
COMMENT ON COLUMN signals.ai_model IS 'AI模型名称（如deepseek-chat）';
COMMENT ON COLUMN signals.ai_risk_assessment IS 'AI风险评估（low/medium/high）';

