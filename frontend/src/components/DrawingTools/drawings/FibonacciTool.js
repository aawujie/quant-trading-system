import { BaseTool } from './BaseTool';

/**
 * 斐波那契回撤工具
 * 绘制斐波那契回撤水平线：0%, 23.6%, 38.2%, 50%, 61.8%, 100%
 */
export class FibonacciTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'fibonacci';
    this.startPoint = null;
    this.endPoint = null;
    
    // 斐波那契回撤位
    this.levels = [
      { ratio: 0, label: '0.0%', color: '#787B86' },
      { ratio: 0.236, label: '23.6%', color: '#F23645' },
      { ratio: 0.382, label: '38.2%', color: '#FF9800' },
      { ratio: 0.5, label: '50.0%', color: '#9C27B0' },
      { ratio: 0.618, label: '61.8%', color: '#2962FF' },
      { ratio: 1, label: '100.0%', color: '#787B86' }
    ];
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
    if (!this.startPoint || !this.endPoint) return;
    
    // 获取起点和终点的当前屏幕坐标
    const start = this.coordinates.priceToScreen(
      this.startPoint.time,
      this.startPoint.price
    );
    
    const end = this.coordinates.priceToScreen(
      this.endPoint.time,
      this.endPoint.price
    );

    if (!start || start.x === null || start.y === null) return;
    if (!end || end.x === null || end.y === null) return;

    // 计算价格差
    const priceDiff = this.endPoint.price - this.startPoint.price;
    
    // 获取画布宽度
    const canvasWidth = ctx.canvas.width;
    
    // 绘制每一个斐波那契回撤位
    this.levels.forEach(level => {
      const price = this.startPoint.price + priceDiff * level.ratio;
      const screenPos = this.coordinates.priceToScreen(this.startPoint.time, price);
      
      if (!screenPos || screenPos.y === null) return;
      
      // 绘制水平线
      ctx.strokeStyle = level.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, screenPos.y);
      ctx.lineTo(canvasWidth, screenPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 绘制标签（价格和百分比）- 显示在左侧
      ctx.fillStyle = level.color;
      ctx.font = '12px Arial';
      const label = `${level.label} (${price.toFixed(2)})`;
      const textWidth = ctx.measureText(label).width;
      
      // 绘制文本背景 - 左侧位置
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, screenPos.y - 16, textWidth + 8, 18);
      
      // 绘制文本 - 左侧位置
      ctx.fillStyle = level.color;
      ctx.fillText(label, 14, screenPos.y - 3);
    });
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

