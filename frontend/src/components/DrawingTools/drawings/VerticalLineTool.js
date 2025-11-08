import { BaseTool } from './BaseTool';

/**
 * 垂直线工具（时间分隔线/重要事件标记）
 * 只需要点击一次，纵跨整个图表
 * 优化：只使用时间坐标，不依赖价格
 */
export class VerticalLineTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'vertical_line';
    this.time = null;
    this.priceAtClick = null; // 保留用于序列化兼容性
    this.previewTime = null; // 预览时间（鼠标跟随）
    this.previewPrice = null;
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.time = time;
    this.priceAtClick = price; // 保存但不用于绘制
    this.previewTime = null; // 清除预览
    this.isDrawing = false; // 一次点击就完成
  }

  onMouseMove(x, y) {
    // 如果还没有确定位置，显示预览
    if (this.time === null) {
      const { time, price } = this.coordinates.screenToPrice(x, y);
      if (time !== null && price !== null) {
        this.previewTime = time;
        this.previewPrice = price;
      }
    }
  }

  onMouseUp(x, y) {
    // 垂直线不需要释放逻辑
  }

  onMouseLeave() {
    // 鼠标离开画布时清除预览
    if (this.time === null) {
      this.previewTime = null;
      this.previewPrice = null;
    }
  }

  draw(ctx) {
    // 获取可绘制区域
    const bounds = this.getDrawableBounds(ctx.canvas.width, ctx.canvas.height);

    // 绘制确定的垂直线（只使用时间坐标）
    if (this.time !== null) {
      const x = this._timeToScreenX(this.time);
      if (x === null) {
        return; // 转换失败，不绘制
      }
      
      // 限制X坐标在可绘制区域内
      const clampedX = Math.max(bounds.left, Math.min(bounds.right, x));
      
      ctx.strokeStyle = this.style.color;
      ctx.lineWidth = this.style.lineWidth;
      
      if (this.style.lineStyle === 'dashed') {
        ctx.setLineDash([5, 5]);
      }
      
      ctx.beginPath();
      ctx.moveTo(clampedX, bounds.top);
      ctx.lineTo(clampedX, bounds.bottom);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // 绘制时间标签（如果有label）
      if (this.label) {
        ctx.save();
        ctx.translate(clampedX + 5, 15);
        ctx.fillStyle = this.style.color;
        ctx.font = '12px Arial';
        ctx.fillText(this.label, 0, 0);
        ctx.restore();
      }
    }
    
    // 绘制预览线（半透明、虚线）
    if (this.time === null && this.previewTime !== null) {
      const x = this._timeToScreenX(this.previewTime);
      if (x !== null) {
        // 限制X坐标在可绘制区域内
        const clampedX = Math.max(bounds.left, Math.min(bounds.right, x));
        
        ctx.strokeStyle = this.style.color;
        ctx.globalAlpha = 0.5; // 半透明
        ctx.lineWidth = this.style.lineWidth;
        ctx.setLineDash([5, 5]); // 虚线
        
        ctx.beginPath();
        ctx.moveTo(clampedX, bounds.top);
        ctx.lineTo(clampedX, bounds.bottom);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0; // 恢复透明度
      }
    }
  }

  /**
   * 将时间戳转换为屏幕X坐标（专用于垂直线，支持插值）
   * @param {number} time - 时间戳
   * @returns {number|null} 屏幕X坐标
   * @private
   */
  _timeToScreenX(time) {
    try {
      const timeScale = this.chart.timeScale();
      
      // 尝试直接转换
      let x = timeScale.timeToCoordinate(time);
      
      // 如果失败，使用线性插值
      if (x === null) {
        x = this.coordinates._interpolateTimeToCoordinate(time);
      }
      
      return x;
    } catch (error) {
      console.error('垂直线时间转换失败:', error);
      return null;
    }
  }

  isComplete() {
    return this.time !== null;
  }

  getPoints() {
    if (this.time === null) return [];
    
    return [
      { time: this.time, price: this.priceAtClick || 0 }
    ];
  }

  setPoints(points) {
    if (points.length >= 1) {
      this.time = points[0].time;
      this.priceAtClick = points[0].price || 0;
      this.isDrawing = false;
    }
  }
}
