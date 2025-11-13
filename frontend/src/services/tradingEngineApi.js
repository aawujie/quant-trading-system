import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

/**
 * 获取回测历史列表
 */
export const getBacktestHistory = async (params) => {
  const response = await axios.get(`${API_BASE_URL}/api/backtest/history`, { params });
  return response.data;
};

/**
 * 获取回测详情
 */
export const getBacktestDetail = async (runId) => {
  const response = await axios.get(`${API_BASE_URL}/api/backtest/detail/${runId}`);
  return response.data;
};

/**
 * 删除回测记录
 */
export const deleteBacktest = async (runId) => {
  const response = await axios.delete(`${API_BASE_URL}/api/backtest/${runId}`);
  return response.data;
};

/**
 * 获取K线数据
 */
export const getKlines = async (symbol, timeframe, params) => {
  const response = await axios.get(`${API_BASE_URL}/api/klines/${symbol}/${timeframe}`, { params });
  return response.data;
};

