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
  const response = await axios.get(`${API_BASE_URL}/api/position/presets`);
  return response.data.presets;
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
  const response = await axios.get(`${API_BASE_URL}/api/strategies`);
  return response.data.strategies;
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

