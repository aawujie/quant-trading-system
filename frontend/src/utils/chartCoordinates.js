/**
 * 图表坐标系转换工具
 * 
 * 负责：屏幕坐标 ↔ 价格/时间坐标的转换
 */
export class ChartCoordinates {
  constructor(chart, series) {
    this.chart = chart;
    this.series = series;
  }

  /**
   * 屏幕坐标 → 价格和时间
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   * @returns {{time: number|null, price: number|null}}
   */
  screenToPrice(x, y) {
    try {
      const timeScale = this.chart.timeScale();
      
      const time = timeScale.coordinateToTime(x);
      const price = this.series.coordinateToPrice(y);
      
      return { time, price };
    } catch (error) {
      console.error('坐标转换失败:', error);
      return { time: null, price: null };
    }
  }

  /**
   * 价格和时间 → 屏幕坐标（健壮版本，支持任意时间戳）
   * @param {number} time - 时间戳
   * @param {number} price - 价格
   * @returns {{x: number|null, y: number|null}}
   */
  priceToScreen(time, price) {
    try {
      const timeScale = this.chart.timeScale();
      
      // 尝试直接转换
      let x = timeScale.timeToCoordinate(time);
      let y = this.series.priceToCoordinate(price);
      
      // 如果时间戳转换失败（返回null），使用线性插值
      if (x === null) {
        x = this._interpolateTimeToCoordinate(time);
      }
      
      // 价格转换通常不会失败，但以防万一
      if (y === null) {
        console.warn(`⚠️ 价格转换失败: price=${price}`);
      }
      
      return { x, y };
    } catch (error) {
      console.error('坐标转换失败:', error);
      return { x: null, y: null };
    }
  }

  /**
   * 线性插值：将任意时间戳转换为屏幕坐标
   * @param {number} targetTime - 目标时间戳
   * @returns {number|null} 屏幕X坐标
   * @private
   */
  _interpolateTimeToCoordinate(targetTime) {
    try {
      const timeScale = this.chart.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      
      if (!visibleRange) return null;
      
      // 获取可见范围的时间边界
      const leftTime = timeScale.coordinateToTime(0);
      const rightTime = timeScale.coordinateToTime(this.chart.chartElement().clientWidth);
      
      if (!leftTime || !rightTime) return null;
      
      // 如果目标时间在可见范围外，仍然计算（允许画出屏幕外的线）
      const timeRange = rightTime - leftTime;
      const timeOffset = targetTime - leftTime;
      const ratio = timeOffset / timeRange;
      
      // 线性插值计算X坐标
      const chartWidth = this.chart.chartElement().clientWidth;
      const x = ratio * chartWidth;
      
      return x;
    } catch (error) {
      console.error('时间插值失败:', error);
      return null;
    }
  }

  /**
   * 检查坐标是否在图表范围内
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   * @returns {boolean}
   */
  isInBounds(x, y) {
    const chartElement = this.chart.chartElement();
    if (!chartElement) return false;

    const rect = chartElement.getBoundingClientRect();
    return x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
  }
}

