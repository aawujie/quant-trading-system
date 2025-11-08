import { BaseTool } from './BaseTool';

/**
 * 平行线工具
 * 用户绘制第一条线（两点），然后点击第三个点确定平行线位置
 */
export class ParallelLineTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'parallel_line';
    this.startPoint = null;    // 第一条线的起点
    this.endPoint = null;      // 第一条线的终点
    this.thirdPoint = null;    // 第三个点，用于确定第二条平行线
    this.drawingState = 'first_line'; // 'first_line' | 'second_line'
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    if (this.drawingState === 'first_line') {
      // 开始绘制第一条线
      this.startPoint = { time, price, x, y };
      this.isDrawing = true;
    } else if (this.drawingState === 'second_line') {
      // 点击第三个点
      this.thirdPoint = { time, price, x, y };
      this.isDrawing = false;
    }
  }

  onMouseMove(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    if (this.drawingState === 'first_line') {
      this.endPoint = { time, price, x, y };
    } else if (this.drawingState === 'second_line') {
      this.thirdPoint = { time, price, x, y };
    }
  }

  onMouseUp(x, y) {
    if (!this.isDrawing) return;
    
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    if (this.drawingState === 'first_line') {
      // 完成第一条线
      this.endPoint = { time, price, x, y };
      this.drawingState = 'second_line';
      this.isDrawing = true; // 继续绘制第二条线
    }
  }

  draw(ctx) {
    if (!this.startPoint) return;
    
    // 获取第一条线的屏幕坐标
    const start = this.coordinates.priceToScreen(
      this.startPoint.time,
      this.startPoint.price
    );
    
    if (!start || start.x === null || start.y === null) return;
    
    const end = this.endPoint
      ? this.coordinates.priceToScreen(this.endPoint.time, this.endPoint.price)
      : null;

    if (!end || end.x === null || end.y === null) return;

    // 获取可绘制区域
    const bounds = this.getDrawableBounds(ctx.canvas.width, ctx.canvas.height);
    
    // 应用样式
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.lineWidth;
    
    // 绘制第一条线
    const clampedStart = {
      x: Math.max(bounds.left, Math.min(bounds.right, start.x)),
      y: Math.max(bounds.top, Math.min(bounds.bottom, start.y))
    };
    
    const clampedEnd = {
      x: Math.max(bounds.left, Math.min(bounds.right, end.x)),
      y: Math.max(bounds.top, Math.min(bounds.bottom, end.y))
    };

    ctx.beginPath();
    ctx.moveTo(clampedStart.x, clampedStart.y);
    ctx.lineTo(clampedEnd.x, clampedEnd.y);
    ctx.stroke();
    
    // 如果有第三个点，绘制第二条平行线
    if (this.thirdPoint) {
      const third = this.coordinates.priceToScreen(
        this.thirdPoint.time,
        this.thirdPoint.price
      );
      
      if (third && third.x !== null && third.y !== null) {
        // 计算第一条线的向量
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        // 计算第三个点到第一条线的垂直距离（使用点到直线的距离公式）
        // 然后在第二条线上应用相同的偏移
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        if (lineLength > 0) {
          // 第一条线的单位法向量
          const nx = -dy / lineLength;
          const ny = dx / lineLength;
          
          // 第三个点到第一条线的距离（带符号）
          const distance = (third.x - start.x) * nx + (third.y - start.y) * ny;
          
          // 第二条平行线的起点和终点
          const parallel_start = {
            x: start.x + nx * distance,
            y: start.y + ny * distance
          };
          
          const parallel_end = {
            x: end.x + nx * distance,
            y: end.y + ny * distance
          };
          
          // 限制坐标在可绘制区域内
          const clampedParallelStart = {
            x: Math.max(bounds.left, Math.min(bounds.right, parallel_start.x)),
            y: Math.max(bounds.top, Math.min(bounds.bottom, parallel_start.y))
          };
          
          const clampedParallelEnd = {
            x: Math.max(bounds.left, Math.min(bounds.right, parallel_end.x)),
            y: Math.max(bounds.top, Math.min(bounds.bottom, parallel_end.y))
          };
          
          // 绘制第二条平行线
          ctx.beginPath();
          ctx.moveTo(clampedParallelStart.x, clampedParallelStart.y);
          ctx.lineTo(clampedParallelEnd.x, clampedParallelEnd.y);
          ctx.stroke();
          
          // 如果正在绘制中，用虚线显示第三个点的预览
          if (this.isDrawing && this.drawingState === 'second_line') {
            ctx.strokeStyle = this.style.color;
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.5;
            
            const clampedThird = {
              x: Math.max(bounds.left, Math.min(bounds.right, third.x)),
              y: Math.max(bounds.top, Math.min(bounds.bottom, third.y))
            };
            
            // 从第三个点到第二条平行线的辅助线
            ctx.beginPath();
            ctx.moveTo(clampedThird.x, clampedThird.y);
            ctx.lineTo(clampedParallelStart.x, clampedParallelStart.y);
            ctx.stroke();
            
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
          }
        }
      }
    } else if (this.drawingState === 'second_line') {
      // 第一条线已完成，显示提示（绘制虚线预览）
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(clampedStart.x, clampedStart.y);
      ctx.lineTo(clampedEnd.x, clampedEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }
  }

  isComplete() {
    return !this.isDrawing && 
           this.startPoint && 
           this.endPoint && 
           this.thirdPoint &&
           this.drawingState === 'second_line';
  }

  getPoints() {
    if (!this.startPoint || !this.endPoint) return [];
    
    const points = [
      { time: this.startPoint.time, price: this.startPoint.price },
      { time: this.endPoint.time, price: this.endPoint.price }
    ];
    
    if (this.thirdPoint) {
      points.push({ time: this.thirdPoint.time, price: this.thirdPoint.price });
    }
    
    return points;
  }

  setPoints(points) {
    if (points.length >= 2) {
      this.startPoint = { ...points[0] };
      this.endPoint = { ...points[1] };
      
      if (points.length >= 3) {
        this.thirdPoint = { ...points[2] };
        this.drawingState = 'second_line';
      }
      
      this.isDrawing = false;
    }
  }
}

