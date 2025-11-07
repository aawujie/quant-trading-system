import { BaseTool } from './BaseTool';

/**
 * 趋势线工具
 */
export class TrendLineTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'trend_line';
    this.startPoint = null;
    this.endPoint = null;
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.startPoint = { time, price, x, y };
    this.isDrawing = true;
  }

  onMouseMove(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.endPoint = { time, price, x, y };
  }

  onMouseUp(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.endPoint = { time, price, x, y };
    this.isDrawing = false;
  }

  draw(ctx) {
    if (!this.startPoint) return;
    
    // 获取当前屏幕坐标（因为图表可能缩放/平移了）
    const start = this.coordinates.priceToScreen(
      this.startPoint.time,
      this.startPoint.price
    );
    
    if (!start || start.x === null || start.y === null) return;
    
    const end = this.endPoint
      ? this.coordinates.priceToScreen(this.endPoint.time, this.endPoint.price)
      : null;

    if (!end || end.x === null || end.y === null) return;

    // 应用样式
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.lineWidth;
    
    if (this.style.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    }
    
    // 绘制线段
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 重置虚线
    ctx.setLineDash([]);
    
    // 绘制端点（圆点）
    ctx.fillStyle = this.style.color;
    ctx.beginPath();
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  isComplete() {
    return !this.isDrawing && this.startPoint && this.endPoint;
  }

  getPoints() {
    if (!this.startPoint || !this.endPoint) return [];
    
    return [
      { time: this.startPoint.time, price: this.startPoint.price },
      { time: this.endPoint.time, price: this.endPoint.price }
    ];
  }

  setPoints(points) {
    if (points.length >= 2) {
      this.startPoint = { ...points[0] };
      this.endPoint = { ...points[1] };
      this.isDrawing = false;
    }
  }
}

