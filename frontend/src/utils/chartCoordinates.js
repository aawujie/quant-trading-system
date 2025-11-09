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
   * 线性插值/外推：将任意时间戳转换为屏幕坐标
   * 支持超出数据范围的时间点（外推）
   * @param {number} targetTime - 目标时间戳
   * @returns {number|null} 屏幕X坐标
   * @private
   */
  _interpolateTimeToCoordinate(targetTime) {
    try {
      const timeScale = this.chart.timeScale();
      const chartElement = this.chart.chartElement();
      if (!chartElement) return null;
      
      // 获取所有数据点
      const data = this.series.data();
      if (!data || data.length === 0) return null;
      
      // 使用所有数据的第一个和最后一个点作为参考（而不是可见范围）
      // 这样可以支持外推到数据范围之外
      const firstIndex = 0;
      const lastIndex = data.length - 1;
      
      const firstBar = data[firstIndex];
      const lastBar = data[lastIndex];
      
      if (!firstBar || !lastBar) return null;
      
      const firstTime = firstBar.time;
      const lastTime = lastBar.time;
      
      if (!firstTime || !lastTime) return null;
      
      // 计算时间范围和目标时间的相对位置
      const timeRange = lastTime - firstTime;
      if (timeRange === 0) return null;
      
      const timeOffset = targetTime - firstTime;
      const timeRatio = timeOffset / timeRange; // 可以小于0或大于1（外推）
      
      // 获取参考点在屏幕上的坐标
      const firstCoord = timeScale.logicalToCoordinate(firstIndex);
      const lastCoord = timeScale.logicalToCoordinate(lastIndex);
      
      if (firstCoord === null || lastCoord === null) return null;
      
      // 线性插值/外推计算X坐标
      // timeRatio < 0: 在数据开始之前（左侧外推）
      // 0 <= timeRatio <= 1: 在数据范围内（插值）
      // timeRatio > 1: 在数据结束之后（右侧外推）
      const x = firstCoord + (lastCoord - firstCoord) * timeRatio;
      
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
   * 反向插值/外推：屏幕X坐标 → 时间戳（支持超出数据范围）
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
      
      // 使用所有数据的第一个和最后一个点作为参考
      const firstIndex = 0;
      const lastIndex = data.length - 1;
      
      const firstBar = data[firstIndex];
      const lastBar = data[lastIndex];
      
      if (!firstBar || !lastBar) return null;
      
      const firstTime = firstBar.time;
      const lastTime = lastBar.time;
      
      if (!firstTime || !lastTime) return null;
      
      // 获取参考点在屏幕上的坐标
      const firstCoord = timeScale.logicalToCoordinate(firstIndex);
      const lastCoord = timeScale.logicalToCoordinate(lastIndex);
      
      if (firstCoord === null || lastCoord === null) return null;
      
      // 计算X坐标在屏幕上的相对位置
      const coordRange = lastCoord - firstCoord;
      if (coordRange === 0) return null;
      
      const coordOffset = x - firstCoord;
      const coordRatio = coordOffset / coordRange; // 可以小于0或大于1（外推）
      
      // 反向插值/外推计算时间戳
      const timeRange = lastTime - firstTime;
      const time = firstTime + timeRange * coordRatio;
      
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

