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
   * 价格和时间 → 屏幕坐标
   * @param {number} time - 时间戳
   * @param {number} price - 价格
   * @returns {{x: number|null, y: number|null}}
   */
  priceToScreen(time, price) {
    try {
      const timeScale = this.chart.timeScale();
      
      const x = timeScale.timeToCoordinate(time);
      const y = this.series.priceToCoordinate(price);
      
      return { x, y };
    } catch (error) {
      console.error('坐标转换失败:', error);
      return { x: null, y: null };
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

