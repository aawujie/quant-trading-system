import { BaseTool } from './BaseTool';
import { normalizeRect } from '../../../utils/drawingHelpers';

/**
 * 矩形工具
 */
export class RectangleTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'rectangle';
    this.startPoint = null;
    this.endPoint = null;
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.startPoint = { time, price };
    this.isDrawing = true;
  }

  onMouseMove(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.endPoint = { time, price };
  }

  onMouseUp(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.endPoint = { time, price };
    this.isDrawing = false;
  }

  draw(ctx) {
    if (!this.startPoint) return;
    
    const start = this.coordinates.priceToScreen(
      this.startPoint.time,
      this.startPoint.price
    );
    
    if (!start || start.x === null || start.y === null) return;
    
    const end = this.endPoint
      ? this.coordinates.priceToScreen(this.endPoint.time, this.endPoint.price)
      : null;

    if (!end || end.x === null || end.y === null) return;

    // 标准化矩形坐标
    const rect = normalizeRect(start, end);

    // 绘制半透明填充
    ctx.fillStyle = `rgba(${this.hexToRgb(this.style.color)}, ${this.style.fillOpacity})`;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // 绘制边框
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.lineWidth;
    
    if (this.style.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    }
    
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    // 重置虚线
    ctx.setLineDash([]);
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

  /**
   * 将十六进制颜色转换为RGB
   * @param {string} hex - 十六进制颜色 (#RRGGBB)
   * @returns {string} - "r, g, b"
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `${r}, ${g}, ${b}`;
    }
    return '41, 98, 255'; // 默认蓝色
  }
}

