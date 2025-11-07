import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

/**
 * 绘图API服务
 */
export const drawingApi = {
  /**
   * 获取指定交易对的所有绘图
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Array>}
   */
  async getDrawings(symbol, timeframe) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/drawings/${symbol}/${timeframe}`
      );
      return response.data;
    } catch (error) {
      console.error('获取绘图失败:', error);
      throw error;
    }
  },

  /**
   * 根据ID获取单个绘图
   * @param {string} drawingId - 绘图ID
   * @returns {Promise<object>}
   */
  async getDrawingById(drawingId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/drawings/id/${drawingId}`
      );
      return response.data;
    } catch (error) {
      console.error('获取绘图详情失败:', error);
      throw error;
    }
  },

  /**
   * 保存新绘图
   * @param {object} drawing - 绘图数据
   * @returns {Promise<object>}
   */
  async saveDrawing(drawing) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/drawings`,
        drawing
      );
      return response.data;
    } catch (error) {
      console.error('保存绘图失败:', error);
      throw error;
    }
  },

  /**
   * 更新绘图
   * @param {string} drawingId - 绘图ID
   * @param {object} drawing - 绘图数据
   * @returns {Promise<object>}
   */
  async updateDrawing(drawingId, drawing) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/drawings/${drawingId}`,
        drawing
      );
      return response.data;
    } catch (error) {
      console.error('更新绘图失败:', error);
      throw error;
    }
  },

  /**
   * 删除绘图
   * @param {string} drawingId - 绘图ID
   * @returns {Promise<object>}
   */
  async deleteDrawing(drawingId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/drawings/${drawingId}`
      );
      return response.data;
    } catch (error) {
      console.error('删除绘图失败:', error);
      throw error;
    }
  }
};

