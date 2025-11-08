/**
 * 数据管理API服务
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

/**
 * 创建历史数据下载任务
 */
export async function createDownloadTask(params) {
  const response = await axios.post(`${API_BASE_URL}/api/data/download`, null, {
    params: {
      symbol: params.symbol,
      timeframe: params.timeframe,
      start_time: params.startTime,
      end_time: params.endTime,
      market_type: params.marketType || 'future',
      auto_start: params.autoStart !== false,
    }
  });
  return response.data;
}

/**
 * 获取下载任务状态
 */
export async function getDownloadTask(taskId) {
  const response = await axios.get(`${API_BASE_URL}/api/data/download/${taskId}`);
  return response.data;
}

/**
 * 获取所有下载任务
 */
export async function listDownloadTasks() {
  const response = await axios.get(`${API_BASE_URL}/api/data/download`);
  return response.data;
}

/**
 * 启动下载任务
 */
export async function startDownloadTask(taskId) {
  const response = await axios.post(`${API_BASE_URL}/api/data/download/${taskId}/start`);
  return response.data;
}

/**
 * 取消下载任务
 */
export async function cancelDownloadTask(taskId) {
  const response = await axios.post(`${API_BASE_URL}/api/data/download/${taskId}/cancel`);
  return response.data;
}

/**
 * 获取数据统计
 */
export async function getDataStats() {
  const response = await axios.get(`${API_BASE_URL}/api/data/stats`);
  return response.data;
}

