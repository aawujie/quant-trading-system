import { BaseTool } from './BaseTool';

/**
 * 水平线工具（支撑位/阻力位）
 * 只需要点击一次，横跨整个图表
 * 优化：只使用价格坐标，不依赖时间
 */
export class HorizontalLineTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'horizontal_line';
    this.price = null;
    this.timestamp = null; // 保留用于序列化兼容性
    this.previewPrice = null; // 预览价格（鼠标跟随）
    this.previewTimestamp = null;
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.price = price;
    this.timestamp = time; // 保存但不用于绘制
    this.previewPrice = null; // 清除预览
    this.isDrawing = false; // 一次点击就完成
  }

  onMouseMove(x, y) {
    // 如果还没有确定位置，显示预览
    if (this.price === null) {
      const { time, price } = this.coordinates.screenToPrice(x, y);
      if (time !== null && price !== null) {
        this.previewPrice = price;
        this.previewTimestamp = time;
      }
    }
  }

  onMouseUp(x, y) {
    // 水平线不需要释放逻辑
  }

  onMouseLeave() {
    // 鼠标离开画布时清除预览
    if (this.price === null) {
      this.previewPrice = null;
      this.previewTimestamp = null;
    }
  }

  draw(ctx) {
    // 获取图表宽度
    const chartElement = this.chart.chartElement();
    if (!chartElement) return;
    const chartWidth = chartElement.getBoundingClientRect().width;

    // 绘制确定的水平线（只使用价格坐标）
    if (this.price !== null) {
      const y = this._priceToScreenY(this.price);
      if (y === null) {
        return; // 转换失败，不绘制
      }
      
      ctx.strokeStyle = this.style.color;
      ctx.lineWidth = this.style.lineWidth;
      
      if (this.style.lineStyle === 'dashed') {
        ctx.setLineDash([5, 5]);
      }
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // 绘制价格标签
      const priceText = `$${this.price.toFixed(2)}`;
      ctx.fillStyle = this.style.color;
      ctx.font = '12px Arial';
      ctx.fillText(priceText, 5, y - 5);
    }
    
    // 绘制预览线（半透明、虚线）
    if (this.price === null && this.previewPrice !== null) {
      const y = this._priceToScreenY(this.previewPrice);
      if (y !== null) {
        ctx.strokeStyle = this.style.color;
        ctx.globalAlpha = 0.5; // 半透明
        ctx.lineWidth = this.style.lineWidth;
        ctx.setLineDash([5, 5]); // 虚线
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0; // 恢复透明度
        
        // 绘制预览价格标签
        const priceText = `$${this.previewPrice.toFixed(2)}`;
        ctx.fillStyle = this.style.color;
        ctx.globalAlpha = 0.7;
        ctx.font = '12px Arial';
        ctx.fillText(priceText, 5, y - 5);
        ctx.globalAlpha = 1.0;
      }
    }
  }

  /**
   * 将价格转换为屏幕Y坐标（专用于水平线，支持插值）
   * @param {number} price - 价格
   * @returns {number|null} 屏幕Y坐标
   * @private
   */
  _priceToScreenY(price) {
    try {
      // 尝试直接转换
      let y = this.series.priceToCoordinate(price);
      
      // 如果失败，使用线性插值
      if (y === null) {
        y = this.coordinates._interpolatePriceToCoordinate(price);
      }
      
      return y;
    } catch (error) {
      console.error('水平线价格转换失败:', error);
      return null;
    }
  }

  isComplete() {
    return this.price !== null;
  }

  getPoints() {
    if (this.price === null) return [];
    
    return [
      { time: this.timestamp || 0, price: this.price }
    ];
  }

  setPoints(points) {
    if (points.length >= 1) {
      this.timestamp = points[0].time || 0;
      this.price = points[0].price;
      this.isDrawing = false;
    }
  }
}
