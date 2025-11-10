import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

/**
 * 运行回测
 */
export const runBacktest = async (config) => {
  const response = await axios.post(`${API_BASE_URL}/api/backtest/run`, config);
  return response.data;
};

/**
 * 获取回测结果
 */
export const getBacktestResult = async (taskId) => {
  const response = await axios.get(`${API_BASE_URL}/api/backtest/result/${taskId}`);
  return response.data;
};

/**
 * 获取仓位管理预设（从配置文件）
 */
export const getPositionPresets = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/position/presets`);
    return response.data.presets || [];
  } catch (error) {
    console.error('Failed to load presets from backend, using defaults:', error);
    // 返回默认预设
    return [
      { name: 'conservative', display_name: '保守型' },
      { name: 'balanced', display_name: '平衡型' },
      { name: 'aggressive', display_name: '激进型' },
      { name: 'scalper', display_name: '超短线' },
      { name: 'swing', display_name: '波段交易' },
    ];
  }
};

/**
 * 获取仓位管理预设详情
 */
export const getPositionPresetDetail = async (presetName) => {
  const response = await axios.get(`${API_BASE_URL}/api/position/presets/${presetName}`);
  return response.data.preset;
};

/**
 * 获取仓位计算策略说明
 */
export const getSizingStrategies = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/position/sizing-strategies`);
  return response.data.strategies;
};

/**
 * 获取仓位管理推荐配置
 */
export const getPositionRecommendations = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/position/recommendations`);
  return response.data.recommendations;
};

/**
 * 运行参数优化
 */
export const runOptimization = async (config) => {
  const response = await axios.post(`${API_BASE_URL}/api/optimize/run`, config);
  return response.data;
};

/**
 * 获取优化结果
 */
export const getOptimizationResult = async (taskId) => {
  const response = await axios.get(`${API_BASE_URL}/api/optimize/result/${taskId}`);
  return response.data;
};

/**
 * 获取AI配置状态
 */
export const getAIConfig = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/ai/config`);
  return response.data;
};

/**
 * 获取策略列表（从后端API）
 */
export const getStrategies = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/strategies`);
    return response.data.strategies || [];
  } catch (error) {
    console.error('Failed to load strategies from backend, using defaults:', error);
    // 返回默认策略
    return [
      {
        name: 'dual_ma',
        display_name: '双均线策略',
        description: '基于快慢均线交叉的经典趋势跟踪策略',
        icon: '📊',
        color: '#4CAF50',
        parameters: {
          fast_period: { label: '快线周期', default: 5, min: 2, max: 50, step: 1 },
          slow_period: { label: '慢线周期', default: 20, min: 5, max: 200, step: 1 },
        }
      },
      {
        name: 'macd',
        display_name: 'MACD策略',
        description: 'MACD指标金叉死叉交易策略',
        icon: '📈',
        color: '#2196F3',
        parameters: {
          fast_period: { label: '快线周期', default: 12, min: 5, max: 50, step: 1 },
          slow_period: { label: '慢线周期', default: 26, min: 10, max: 100, step: 1 },
          signal_period: { label: '信号周期', default: 9, min: 3, max: 30, step: 1 },
        }
      },
      {
        name: 'rsi',
        display_name: 'RSI策略',
        description: 'RSI超买超卖区间交易策略',
        icon: '📉',
        color: '#FF9800',
        parameters: {
          period: { label: 'RSI周期', default: 14, min: 5, max: 50, step: 1 },
          oversold: { label: '超卖阈值', default: 30, min: 10, max: 40, step: 1 },
          overbought: { label: '超买阈值', default: 70, min: 60, max: 90, step: 1 },
        }
      },
      {
        name: 'bollinger',
        display_name: '布林带策略',
        description: '基于布林带突破的波动率交易策略',
        icon: '📐',
        color: '#9C27B0',
        parameters: {
          period: { label: '周期', default: 20, min: 10, max: 50, step: 1 },
          std_dev: { label: '标准差倍数', default: 2.0, min: 1, max: 3, step: 0.1 },
        }
      },
    ];
  }
};

/**
 * 获取策略详情
 */
export const getStrategyDetail = async (strategyName) => {
  const response = await axios.get(`${API_BASE_URL}/api/strategies/${strategyName}`);
  return response.data.strategy;
};

/**
 * 获取策略分类
 */
export const getStrategyCategories = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/strategies/categories`);
  return response.data.categories;
};

