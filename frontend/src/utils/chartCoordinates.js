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
   * 屏幕坐标 → 价格和时间（健壮版本，支持未来时间和任意价格）
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   * @returns {{time: number|null, price: number|null}}
   */
  screenToPrice(x, y) {
    try {
      const timeScale = this.chart.timeScale();
      
      // 尝试直接转换
      let time = timeScale.coordinateToTime(x);
      let price = this.series.coordinateToPrice(y);
      
      // 如果时间转换失败（例如：点击在未来时间），使用反向插值
      if (time === null) {
        time = this._interpolateCoordinateToTime(x);
      }
      
      // 如果价格转换失败，使用反向插值
      if (price === null) {
        price = this._interpolateCoordinateToPrice(y);
      }
      
      return { time, price };
    } catch (error) {
      console.error('坐标转换失败:', error);
      return { time: null, price: null };
    }
  }

  /**
   * 价格和时间 → 屏幕坐标（健壮版本，支持任意时间戳和价格）
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
      
      // 如果价格转换失败（返回null），使用线性插值
      if (y === null) {
        y = this._interpolatePriceToCoordinate(price);
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
      const chartElement = this.chart.chartElement();
      if (!chartElement) return null;
      
      const chartWidth = chartElement.clientWidth;
      
      // 获取所有数据点
      const data = this.series.data();
      if (!data || data.length === 0) return null;
      
      // 获取可见逻辑范围
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (!visibleRange) return null;
      
      // 获取可见范围内的第一个和最后一个数据点的索引
      const fromIndex = Math.max(0, Math.floor(visibleRange.from));
      const toIndex = Math.min(data.length - 1, Math.ceil(visibleRange.to));
      
      // 获取边界时间
      const leftTime = data[fromIndex].time;
      const rightTime = data[toIndex].time;
      
      if (!leftTime || !rightTime) return null;
      
      // 如果目标时间在可见范围外，仍然计算（允许画出屏幕外的线）
      const timeRange = rightTime - leftTime;
      if (timeRange === 0) return null;
      
      const timeOffset = targetTime - leftTime;
      const timeRatio = timeOffset / timeRange;
      
      // 获取边界在屏幕上的坐标
      const leftCoord = timeScale.logicalToCoordinate(fromIndex);
      const rightCoord = timeScale.logicalToCoordinate(toIndex);
      
      if (leftCoord === null || rightCoord === null) return null;
      
      // 线性插值计算X坐标
      const x = leftCoord + (rightCoord - leftCoord) * timeRatio;
      
      return x;
    } catch (error) {
      console.error('时间插值失败:', error);
      return null;
    }
  }

  /**
   * 线性插值：将任意价格转换为屏幕坐标
   * @param {number} targetPrice - 目标价格
   * @returns {number|null} 屏幕Y坐标
   * @private
   */
  _interpolatePriceToCoordinate(targetPrice) {
    try {
      const chartElement = this.chart.chartElement();
      if (!chartElement) return null;
      
      const chartHeight = chartElement.clientHeight;
      
      // 获取价格刻度的可见范围
      const priceScale = this.chart.priceScale('right');
      
      // 尝试获取可见价格范围
      // 方法1：通过屏幕坐标转换
      const topPrice = this.series.coordinateToPrice(0);
      const bottomPrice = this.series.coordinateToPrice(chartHeight);
      
      if (topPrice !== null && bottomPrice !== null) {
        // 价格范围（注意：顶部价格更大，底部价格更小）
        const priceRange = topPrice - bottomPrice;
        const priceOffset = topPrice - targetPrice;
        const ratio = priceOffset / priceRange;
        
        // 线性插值计算Y坐标
        const y = ratio * chartHeight;
        
        return y;
      }
      
      // 方法2：如果上面失败，使用备用方案
      // 直接使用价格的相对位置估算（假设线性刻度）
      return null;
    } catch (error) {
      console.error('价格插值失败:', error);
      return null;
    }
  }

  /**
   * 反向插值：屏幕X坐标 → 时间戳（支持未来时间）
   * @param {number} x - 屏幕X坐标
   * @returns {number|null} 时间戳
   * @private
   */
  _interpolateCoordinateToTime(x) {
    try {
      const timeScale = this.chart.timeScale();
      const chartElement = this.chart.chartElement();
      if (!chartElement) return null;
      
      // 获取所有数据点
      const data = this.series.data();
      if (!data || data.length === 0) return null;
      
      // 获取可见逻辑范围
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (!visibleRange) return null;
      
      // 获取可见范围内的第一个和最后一个数据点的索引
      const fromIndex = Math.max(0, Math.floor(visibleRange.from));
      const toIndex = Math.min(data.length - 1, Math.ceil(visibleRange.to));
      
      // 获取边界时间
      const leftTime = data[fromIndex].time;
      const rightTime = data[toIndex].time;
      
      if (!leftTime || !rightTime) return null;
      
      // 获取边界在屏幕上的坐标
      const leftCoord = timeScale.logicalToCoordinate(fromIndex);
      const rightCoord = timeScale.logicalToCoordinate(toIndex);
      
      if (leftCoord === null || rightCoord === null) return null;
      
      // 计算X坐标在屏幕上的相对位置
      const coordRange = rightCoord - leftCoord;
      if (coordRange === 0) return null;
      
      const coordOffset = x - leftCoord;
      const coordRatio = coordOffset / coordRange;
      
      // 反向插值计算时间戳（支持未来时间）
      const timeRange = rightTime - leftTime;
      const time = leftTime + timeRange * coordRatio;
      
      return Math.round(time); // 返回整数时间戳
    } catch (error) {
      console.error('反向时间插值失败:', error);
      return null;
    }
  }

  /**
   * 反向插值：屏幕Y坐标 → 价格
   * @param {number} y - 屏幕Y坐标
   * @returns {number|null} 价格
   * @private
   */
  _interpolateCoordinateToPrice(y) {
    try {
      const chartElement = this.chart.chartElement();
      if (!chartElement) return null;
      
      const chartHeight = chartElement.clientHeight;
      
      // 尝试获取可见价格范围
      const topPrice = this.series.coordinateToPrice(0);
      const bottomPrice = this.series.coordinateToPrice(chartHeight);
      
      if (topPrice !== null && bottomPrice !== null) {
        // 价格范围（注意：顶部价格更大，底部价格更小）
        const priceRange = topPrice - bottomPrice;
        const ratio = y / chartHeight;
        
        // 反向插值计算价格
        const price = topPrice - priceRange * ratio;
        
        return price;
      }
      
      return null;
    } catch (error) {
      console.error('反向价格插值失败:', error);
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

