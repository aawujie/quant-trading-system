/**
 * 合约仓位计算器 - 核心计算逻辑
 * 
 * 基于相对距离输入（止盈/止损距离）计算合约仓位参数
 */

/**
 * 根据距离计算仓位参数
 * 
 * @param {number} maxLoss - 最大可承受亏损 (USDT)
 * @param {number} tpDistance - 止盈距离 (USDT)，做多为正数，做空为负数
 * @param {number} slDistance - 止损距离 (USDT)，做多为负数，做空为正数
 * @param {number} currentPrice - 当前价格 (USDT)
 * @param {number} MMR - 维持保证金率 (小数，默认 0.005 = 0.5%)
 * @param {number} LIQ_BUFFER - 强平缓冲比例 (小数，默认 0.1 = 10%)
 * 
 * @returns {object} 计算结果对象
 */
export function calculatePositionByDistance(
  maxLoss, 
  tpDistance, 
  slDistance, 
  currentPrice,
  MMR = 0.005,        // 默认 0.5%
  LIQ_BUFFER = 0.1    // 默认 10%
) {
  // 输入验证
  if (!currentPrice || currentPrice <= 0) {
    return { error: '当前价格无效' };
  }
  
  if (!maxLoss || maxLoss <= 0) {
    return { error: '最大亏损必须大于 0' };
  }
  
  if (tpDistance === 0 || slDistance === 0) {
    return { error: '止盈止损距离不能为 0' };
  }
  
  // 1. 计算绝对价格
  const entry = currentPrice;         // 开仓价 = 实时价格
  const tp = entry + tpDistance;      // 止盈价
  const sl = entry + slDistance;      // 止损价
  
  // 2. 判断交易方向
  let direction;
  if (tp > entry && sl < entry) {
    direction = 'Long';   // 做多
  } else if (tp < entry && sl > entry) {
    direction = 'Short';  // 做空
  } else {
    return { 
      error: '止盈止损方向错误！\n做多：止盈为正(+), 止损为负(-)\n做空：止盈为负(-), 止损为正(+)' 
    };
  }
  
  // 3. 单位盈亏（绝对值）
  const unitLoss = Math.abs(entry - sl);
  const unitProfit = Math.abs(tp - entry);
  
  // 4. 盈亏比
  const rrRatio = unitProfit / unitLoss;
  
  // 5. 持仓数量（核心公式）
  const positionSize = maxLoss / unitLoss;
  
  // 6. 仓位价值
  const positionValue = positionSize * entry;
  
  // 7. 潜在盈利
  const totalProfit = positionSize * unitProfit;
  
  // 8. 目标强平价（带安全缓冲）
  const targetLiqPrice = direction === 'Long'
    ? sl - (unitLoss * LIQ_BUFFER)      // 做多：强平价在止损价下方
    : sl + (unitLoss * LIQ_BUFFER);     // 做空：强平价在止损价上方
  
  // 9. 所需保证金（从目标强平价反推）
  const requiredMargin = direction === 'Long'
    ? positionSize * (entry - targetLiqPrice * (1 - MMR))
    : targetLiqPrice * positionSize * (1 + MMR) - positionValue;
  
  // 10. 所需杠杆倍数
  const requiredLeverage = positionValue / requiredMargin;
  
  // 11. 实际杠杆（限制在 1-125x）
  const leverage = Math.max(1, Math.min(requiredLeverage, 125));
  
  // 12. 实际保证金
  const margin = positionValue / leverage;
  
  // 13. 实际强平价（使用实际保证金重新计算）
  const liquidationPrice = direction === 'Long'
    ? (positionValue - margin) / (positionSize * (1 - MMR))
    : (positionValue + margin) / (positionSize * (1 + MMR));
  
  // 14. 保证金收益率
  const marginYield = (totalProfit / margin) * 100;
  
  // 15. 保证金亏损率
  const marginLossRate = (maxLoss / margin) * 100;
  
  // 16. 强平价距离
  const distanceToLiq = liquidationPrice - entry;
  const distanceToLiqPercent = (distanceToLiq / entry) * 100;
  
  // 17. 强平价距离止损价
  const liqToSlDistance = direction === 'Long' 
    ? sl - liquidationPrice 
    : liquidationPrice - sl;
  const liqToSlPercent = (liqToSlDistance / entry) * 100;
  
  return {
    // 价格
    entry,
    tp,
    sl,
    liquidationPrice,
    targetLiqPrice,
    
    // 方向和比例
    direction,
    rrRatio,
    
    // 仓位信息
    positionSize,
    positionValue,
    leverage,
    margin,
    requiredLeverage,
    
    // 盈亏
    unitLoss,
    unitProfit,
    totalProfit,
    maxLoss,
    marginYield,
    marginLossRate,
    
    // 风险
    distanceToLiq,
    distanceToLiqPercent,
    liqToSlDistance,
    liqToSlPercent,
    
    // 使用的参数
    usedMMR: MMR,
    usedBuffer: LIQ_BUFFER
  };
}

/**
 * 格式化价格显示
 * @param {number} price 
 * @param {number} decimals 
 */
export function formatPrice(price, decimals = 2) {
  if (price === null || price === undefined || isNaN(price)) {
    return '-';
  }
  return price.toFixed(decimals);
}

/**
 * 格式化百分比显示
 * @param {number} percent 
 * @param {number} decimals 
 */
export function formatPercent(percent, decimals = 2) {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return '0.00';
  }
  return percent.toFixed(decimals);
}

/**
 * 格式化持仓数量显示
 * @param {number} size 
 * @param {number} decimals 
 */
export function formatSize(size, decimals = 4) {
  if (size === null || size === undefined || isNaN(size)) {
    return '-';
  }
  return size.toFixed(decimals);
}

