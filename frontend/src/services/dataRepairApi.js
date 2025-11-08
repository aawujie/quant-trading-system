/**
 * 数据修复 API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * 检查数据状态
 */
export async function checkDataStatus(params) {
  const response = await axios.get(`${API_BASE_URL}/api/admin/data-status`, {
    params: {
      symbols: params.symbols || 'BTCUSDT',
      timeframes: params.timeframes || '1h',
      days: params.days || 7,
      market_type: params.marketType || 'future'
    }
  });
  return response.data;
}

/**
 * 触发数据修复
 */
export async function triggerDataRepair(params) {
  const response = await axios.post(`${API_BASE_URL}/api/admin/repair-data`, null, {
    params: {
      symbols: params.symbols || 'BTCUSDT,ETHUSDT',
      timeframes: params.timeframes || '1h,4h,1d',
      days: params.days || 7,
      market_type: params.marketType || 'future'
    }
  });
  return response.data;
}

