/**
 * 指标配置文件
 * 定义所有可用指标的元数据
 */

export const INDICATOR_TYPES = {
  // 主图指标
  MAIN: 'main',
  // 副图指标
  SUB: 'sub'
};

/**
 * 所有可用指标配置
 */
export const INDICATORS = {
  // ========== 移动平均线 ==========
  ma5: {
    id: 'ma5',
    name: 'MA5',
    fullName: '5日移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#FF6B6B',
    lineWidth: 1,
    field: 'ma5',
    category: 'ma',
    categoryName: '移动平均',
    defaultVisible: true,
    description: '5周期简单移动平均线'
  },
  ma10: {
    id: 'ma10',
    name: 'MA10',
    fullName: '10日移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#FFA500',
    lineWidth: 1,
    field: 'ma10',
    category: 'ma',
    categoryName: '移动平均',
    defaultVisible: false,
    description: '10周期简单移动平均线'
  },
  ma20: {
    id: 'ma20',
    name: 'MA20',
    fullName: '20日移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#4ECDC4',
    lineWidth: 1,
    field: 'ma20',
    category: 'ma',
    categoryName: '移动平均',
    defaultVisible: true,
    description: '20周期简单移动平均线'
  },
  ma60: {
    id: 'ma60',
    name: 'MA60',
    fullName: '60日移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#9B59B6',
    lineWidth: 1,
    field: 'ma60',
    category: 'ma',
    categoryName: '移动平均',
    defaultVisible: false,
    description: '60周期简单移动平均线'
  },
  ma120: {
    id: 'ma120',
    name: 'MA120',
    fullName: '120日移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#95A5A6',
    lineWidth: 1,
    field: 'ma120',
    category: 'ma',
    categoryName: '移动平均',
    defaultVisible: false,
    description: '120周期简单移动平均线'
  },
  
  // ========== 指数移动平均线 ==========
  ema12: {
    id: 'ema12',
    name: 'EMA12',
    fullName: '12日指数移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#E74C3C',
    lineWidth: 1,
    field: 'ema12',
    category: 'ema',
    categoryName: '指数移动平均',
    defaultVisible: false,
    description: '12周期指数移动平均线'
  },
  ema26: {
    id: 'ema26',
    name: 'EMA26',
    fullName: '26日指数移动平均线',
    type: INDICATOR_TYPES.MAIN,
    color: '#3498DB',
    lineWidth: 1,
    field: 'ema26',
    category: 'ema',
    categoryName: '指数移动平均',
    defaultVisible: false,
    description: '26周期指数移动平均线'
  },
  
  // ========== 布林带 ==========
  bb_upper: {
    id: 'bb_upper',
    name: 'BB Upper',
    fullName: '布林带上轨',
    type: INDICATOR_TYPES.MAIN,
    color: '#E67E22',
    lineWidth: 1,
    field: 'bb_upper',
    category: 'bollinger',
    categoryName: '布林带',
    defaultVisible: false,
    description: '布林带上轨（20周期，2标准差）',
    group: 'bollinger_bands'
  },
  bb_middle: {
    id: 'bb_middle',
    name: 'BB Middle',
    fullName: '布林带中轨',
    type: INDICATOR_TYPES.MAIN,
    color: '#34495E',
    lineWidth: 1,
    field: 'bb_middle',
    category: 'bollinger',
    categoryName: '布林带',
    defaultVisible: false,
    description: '布林带中轨（20周期MA）',
    group: 'bollinger_bands'
  },
  bb_lower: {
    id: 'bb_lower',
    name: 'BB Lower',
    fullName: '布林带下轨',
    type: INDICATOR_TYPES.MAIN,
    color: '#16A085',
    lineWidth: 1,
    field: 'bb_lower',
    category: 'bollinger',
    categoryName: '布林带',
    defaultVisible: false,
    description: '布林带下轨（20周期，2标准差）',
    group: 'bollinger_bands'
  },
  
  // ========== RSI ==========
  rsi14: {
    id: 'rsi14',
    name: 'RSI14',
    fullName: '相对强弱指数',
    type: INDICATOR_TYPES.SUB,
    color: '#9B59B6',
    lineWidth: 2,
    field: 'rsi14',
    category: 'oscillator',
    categoryName: '震荡指标',
    defaultVisible: false,
    description: '14周期相对强弱指数（0-100）',
    subChartHeight: 100,
    minValue: 0,
    maxValue: 100,
    referenceLevels: [30, 50, 70]  // 超卖、中性、超买线
  },
  
  // ========== MACD ==========
  macd: {
    id: 'macd',
    name: 'MACD',
    fullName: 'MACD指标',
    type: INDICATOR_TYPES.SUB,
    color: {
      line: '#2196F3',
      signal: '#FF9800',
      histogram: '#4CAF50'
    },
    lineWidth: 2,
    fields: ['macd_line', 'macd_signal', 'macd_histogram'],
    category: 'trend',
    categoryName: '趋势指标',
    defaultVisible: false,
    description: 'MACD趋势指标（12,26,9）',
    subChartHeight: 120,
    isComposite: true  // 组合指标（多条线）
  },
  
  // ========== ATR ==========
  atr14: {
    id: 'atr14',
    name: 'ATR14',
    fullName: '平均真实波幅',
    type: INDICATOR_TYPES.SUB,
    color: '#E91E63',
    lineWidth: 2,
    field: 'atr14',
    category: 'volatility',
    categoryName: '波动率指标',
    defaultVisible: false,
    description: '14周期平均真实波幅',
    subChartHeight: 80
  },
  
  // ========== 成交量MA ==========
  volume_ma5: {
    id: 'volume_ma5',
    name: 'Vol MA5',
    fullName: '成交量5日均线',
    type: INDICATOR_TYPES.SUB,
    color: '#FFC107',
    lineWidth: 2,
    field: 'volume_ma5',
    category: 'volume',
    categoryName: '成交量',
    defaultVisible: false,
    description: '5周期成交量移动平均',
    subChartHeight: 80
  }
};

/**
 * 按分类组织指标
 */
export const INDICATOR_CATEGORIES = {
  ma: {
    id: 'ma',
    name: '移动平均',
    indicators: ['ma5', 'ma10', 'ma20', 'ma60', 'ma120']
  },
  ema: {
    id: 'ema',
    name: '指数移动平均',
    indicators: ['ema12', 'ema26']
  },
  bollinger: {
    id: 'bollinger',
    name: '布林带',
    indicators: ['bb_upper', 'bb_middle', 'bb_lower']
  },
  oscillator: {
    id: 'oscillator',
    name: '震荡指标',
    indicators: ['rsi14']
  },
  trend: {
    id: 'trend',
    name: '趋势指标',
    indicators: ['macd']
  },
  volatility: {
    id: 'volatility',
    name: '波动率',
    indicators: ['atr14']
  },
  volume: {
    id: 'volume',
    name: '成交量',
    indicators: ['volume_ma5']
  }
};

/**
 * 获取指标配置
 */
export const getIndicatorConfig = (indicatorId) => {
  return INDICATORS[indicatorId];
};

/**
 * 获取主图指标列表
 */
export const getMainIndicators = () => {
  return Object.values(INDICATORS).filter(ind => ind.type === INDICATOR_TYPES.MAIN);
};

/**
 * 获取副图指标列表
 */
export const getSubIndicators = () => {
  return Object.values(INDICATORS).filter(ind => ind.type === INDICATOR_TYPES.SUB);
};

/**
 * 获取默认显示的指标
 */
export const getDefaultIndicators = () => {
  return Object.values(INDICATORS)
    .filter(ind => ind.defaultVisible)
    .map(ind => ind.id);
};

/**
 * 按分类获取指标
 */
export const getIndicatorsByCategory = (categoryId) => {
  const category = INDICATOR_CATEGORIES[categoryId];
  if (!category) return [];
  
  return category.indicators.map(id => INDICATORS[id]);
};

