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
    if (!this.startPoint || !this.endPoint) return;
    
    // 获取当前屏幕坐标（因为图表可能缩放/平移了）
    const start = this.coordinates.priceToScreen(
      this.startPoint.time,
      this.startPoint.price
    );
    
    const end = this.coordinates.priceToScreen(
      this.endPoint.time, 
      this.endPoint.price
    );

    // 如果两个点都转换失败，则无法绘制
    if ((!start || start.x === null || start.y === null) && 
        (!end || end.x === null || end.y === null)) {
      console.debug('趋势线：两个端点都无法转换为屏幕坐标');
      return;
    }

    // 至少有一个点可以转换，尝试绘制
    // 如果某个端点在屏幕外很远，使用线段延伸逻辑
    let x1, y1, x2, y2;

    if (start && start.x !== null && start.y !== null) {
      x1 = start.x;
      y1 = start.y;
    } else {
      // 起点无法转换，尝试通过延伸线段来估算
      // 使用终点和方向来推算起点在屏幕上的位置
      console.debug('趋势线：起点超出范围，尝试延伸绘制');
      if (!end || end.x === null || end.y === null) return;
      
      // 简化处理：如果起点无法转换，暂时跳过
      // TODO: 可以实现更复杂的线段裁剪算法
      return;
    }

    if (end && end.x !== null && end.y !== null) {
      x2 = end.x;
      y2 = end.y;
    } else {
      // 终点无法转换，尝试通过延伸线段来估算
      console.debug('趋势线：终点超出范围，尝试延伸绘制');
      if (!start || start.x === null || start.y === null) return;
      
      // 简化处理：如果终点无法转换，暂时跳过
      // TODO: 可以实现更复杂的线段裁剪算法
      return;
    }

    // 应用样式
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.lineWidth;
    
    if (this.style.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    }
    
    // 绘制线段（Canvas会自动裁剪到可见区域）
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
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
}

