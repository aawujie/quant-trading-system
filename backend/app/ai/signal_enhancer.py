"""AI Signal Enhancer"""

import json
import re
import logging
from typing import Dict, List, Optional

from app.ai.providers.base import AIProvider
from app.models.signals import SignalData
from app.models.market_data import KlineData
from app.models.indicators import IndicatorData

logger = logging.getLogger(__name__)


class AISignalEnhancer:
    """
    AI信号增强器
    
    使用LLM对传统技术指标信号进行二次确认和增强
    
    功能：
    1. 分析市场环境和技术指标
    2. 评估信号质量和风险
    3. 提供执行建议和推理过程
    4. 调整仓位大小建议
    """
    
    def __init__(
        self,
        provider: AIProvider,
        enable_cache: bool = True,
        cache_size: int = 100
    ):
        """
        Args:
            provider: AI提供者实例
            enable_cache: 是否启用缓存
            cache_size: 缓存大小
        """
        self.provider = provider
        self.enable_cache = enable_cache
        self.cache = {} if enable_cache else None
        self.cache_size = cache_size
        
        logger.info(
            f"AISignalEnhancer initialized: "
            f"provider={provider.get_model_name()}, cache={enable_cache}"
        )
    
    async def enhance_signal(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData,
        historical_trades: Optional[List[Dict]] = None
    ) -> Dict:
        """
        使用AI增强信号
        
        Args:
            signal: 原始交易信号
            kline: 当前K线数据
            indicator: 技术指标数据
            historical_trades: 历史交易记录
        
        Returns:
            {
                'should_execute': True/False,
                'ai_confidence': 0.85,
                'reasoning': 'AI推理过程',
                'risk_assessment': 'low/medium/high',
                'position_size_multiplier': 0.8
            }
        """
        # 检查缓存
        cache_key = self._generate_cache_key(signal, kline, indicator)
        if self.enable_cache and cache_key in self.cache:
            logger.debug(f"Cache hit for signal: {signal.symbol}")
            return self.cache[cache_key]
        
        # 构建Prompt
        prompt = self._build_prompt(signal, kline, indicator, historical_trades)
        
        # 调用AI
        response = await self.provider.chat_completion(prompt, temperature=0.3)
        
        if not response:
            # AI调用失败，返回默认值
            logger.warning("AI service unavailable, using default judgment")
            return {
                'should_execute': True,
                'ai_confidence': signal.confidence or 0.5,
                'reasoning': 'AI服务不可用，使用默认判断',
                'risk_assessment': 'medium',
                'position_size_multiplier': 1.0
            }
        
        # 解析响应
        decision = self._parse_response(response)
        
        # 存入缓存
        if self.enable_cache:
            self._add_to_cache(cache_key, decision)
        
        return decision
    
    def _build_prompt(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData,
        historical_trades: Optional[List[Dict]]
    ) -> str:
        """
        构建AI提示词
        
        包含：
        1. 当前市场数据
        2. 技术指标
        3. 信号信息
        4. 历史交易表现
        """
        historical_summary = self._format_historical_trades(historical_trades) if historical_trades else "无历史数据"
        
        prompt = f"""你是专业的加密货币交易分析师。请分析以下交易信号并给出执行建议。

## 📊 技术指标信号
- **策略**: {signal.strategy_name}
- **信号类型**: {signal.signal_type}
- **方向**: {signal.side}
- **操作**: {signal.action}
- **价格**: ${signal.price:.2f}
- **原因**: {signal.reason}
- **置信度**: {signal.confidence:.2f if signal.confidence else 'N/A'}

## 💹 当前市场数据
- **交易对**: {signal.symbol}
- **最新价格**: ${kline.close:.2f}
- **24h高点**: ${kline.high:.2f}
- **24h低点**: ${kline.low:.2f}
- **成交量**: {kline.volume:.2f}

## 📈 技术指标
- **RSI(14)**: {indicator.rsi14:.2f if indicator.rsi14 else 'N/A'}
- **MACD**: {indicator.macd_histogram:.4f if indicator.macd_histogram else 'N/A'}
- **MA(5/20)**: {indicator.ma5:.2f if indicator.ma5 else 'N/A'} / {indicator.ma20:.2f if indicator.ma20 else 'N/A'}
- **ATR(14)**: {indicator.atr14:.2f if indicator.atr14 else 'N/A'}
- **布林带**: 上轨 {indicator.bb_upper:.2f if indicator.bb_upper else 'N/A'}, 中轨 {indicator.bb_middle:.2f if indicator.bb_middle else 'N/A'}, 下轨 {indicator.bb_lower:.2f if indicator.bb_lower else 'N/A'}

## 📜 最近交易表现
{historical_summary}

## 🎯 任务要求

请基于以上信息，进行深度分析并给出建议：

1. **技术面分析**: 评估当前技术指标的强度和可靠性
2. **趋势判断**: 判断市场处于趋势/震荡状态
3. **风险评估**: 分析潜在风险（市场波动、止损距离等）
4. **执行建议**: 是否应该执行此信号，以及仓位调整建议

**输出格式**（请严格按照JSON格式输出，不要包含其他文本）：

```json
{{
    "should_execute": true,
    "ai_confidence": 0.75,
    "reasoning": "详细的分析推理过程（100-200字）",
    "risk_assessment": "low",
    "position_size_multiplier": 0.8
}}
```

**字段说明**：
- `should_execute`: 是否建议执行（true/false）
- `ai_confidence`: AI置信度（0-1）
- `reasoning`: 详细推理过程
- `risk_assessment`: 风险评估（low/medium/high）
- `position_size_multiplier`: 仓位调整系数（0.5-1.5）
"""
        
        return prompt
    
    def _parse_response(self, response: str) -> Dict:
        """
        解析AI响应
        
        从响应中提取JSON格式的决策
        """
        try:
            # 尝试提取JSON
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                decision = json.loads(json_match.group())
                
                # 验证必需字段
                required_fields = ['should_execute', 'ai_confidence', 'reasoning']
                if all(f in decision for f in required_fields):
                    # 添加默认值
                    decision.setdefault('risk_assessment', 'medium')
                    decision.setdefault('position_size_multiplier', 1.0)
                    
                    # 验证数据类型和范围
                    decision['ai_confidence'] = max(0.0, min(1.0, float(decision['ai_confidence'])))
                    decision['position_size_multiplier'] = max(0.5, min(1.5, float(decision.get('position_size_multiplier', 1.0))))
                    
                    return decision
            
            # 解析失败
            logger.warning(f"Failed to parse AI response: {response[:200]}")
            return {
                'should_execute': False,
                'ai_confidence': 0.3,
                'reasoning': f'AI响应格式错误：{response[:200]}',
                'risk_assessment': 'high',
                'position_size_multiplier': 1.0
            }
        
        except Exception as e:
            logger.error(f"Parse AI response error: {e}")
            return {
                'should_execute': False,
                'ai_confidence': 0.3,
                'reasoning': f'解析失败：{str(e)}',
                'risk_assessment': 'high',
                'position_size_multiplier': 1.0
            }
    
    def _format_historical_trades(self, trades: List[Dict]) -> str:
        """
        格式化历史交易记录
        
        返回易读的摘要字符串
        """
        if not trades:
            return "暂无历史交易"
        
        lines = []
        for i, t in enumerate(trades[:5], 1):  # 只显示最近5笔
            side = t.get('side', 'UNKNOWN')
            pnl = t.get('pnl', 0)
            pnl_pct = t.get('pnl_pct', 0)
            
            result = "盈利" if pnl > 0 else "亏损"
            lines.append(
                f"{i}. {side} - {result} ${pnl:.2f} ({pnl_pct*100:.2f}%)"
            )
        
        # 计算统计
        total_trades = len(trades)
        winning = sum(1 for t in trades if t.get('pnl', 0) > 0)
        win_rate = winning / total_trades if total_trades > 0 else 0
        
        summary = f"\n最近{len(trades)}笔交易，胜率 {win_rate*100:.1f}%"
        
        return "\n".join(lines) + summary
    
    def _generate_cache_key(
        self,
        signal: SignalData,
        kline: KlineData,
        indicator: IndicatorData
    ) -> str:
        """生成缓存键"""
        return (
            f"{signal.symbol}:{signal.signal_type}:{signal.timestamp}:"
            f"{kline.close:.2f}:{indicator.rsi14:.1f if indicator.rsi14 else 0}"
        )
    
    def _add_to_cache(self, key: str, value: Dict):
        """添加到缓存（LRU策略）"""
        if not self.enable_cache:
            return
        
        # 如果缓存已满，删除最旧的条目
        if len(self.cache) >= self.cache_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        
        self.cache[key] = value
    
    def clear_cache(self):
        """清空缓存"""
        if self.enable_cache:
            self.cache.clear()
            logger.info("AI cache cleared")

