import { BaseTool } from './BaseTool';

/**
 * 垂直线工具（时间分隔线/重要事件标记）
 * 只需要点击一次，纵跨整个图表
 */
export class VerticalLineTool extends BaseTool {
  constructor(chart, series, coordinates) {
    super(chart, series, coordinates);
    this.type = 'vertical_line';
    this.time = null;
    this.priceAtClick = null;
    this.previewTime = null; // 预览时间（鼠标跟随）
    this.previewPrice = null;
  }

  onMouseDown(x, y) {
    const { time, price } = this.coordinates.screenToPrice(x, y);
    if (time === null || price === null) return;
    
    this.time = time;
    this.priceAtClick = price;
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

  draw(ctx) {
    // 获取图表高度
    const chartElement = this.chart.chartElement();
    if (!chartElement) return;
    const chartHeight = chartElement.getBoundingClientRect().height;

    // 绘制确定的垂直线
    if (this.time !== null) {
      const coord = this.coordinates.priceToScreen(this.time, this.priceAtClick);
      if (coord && coord.x !== null) {
        ctx.strokeStyle = this.style.color;
        ctx.lineWidth = this.style.lineWidth;
        
        if (this.style.lineStyle === 'dashed') {
          ctx.setLineDash([5, 5]);
        }
        
        ctx.beginPath();
        ctx.moveTo(coord.x, 0);
        ctx.lineTo(coord.x, chartHeight);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // 绘制时间标签（如果有label）
        if (this.label) {
          ctx.save();
          ctx.translate(coord.x + 5, 15);
          ctx.fillStyle = this.style.color;
          ctx.font = '12px Arial';
          ctx.fillText(this.label, 0, 0);
          ctx.restore();
        }
      }
    }
    
    // 绘制预览线（半透明、虚线）
    if (this.time === null && this.previewTime !== null) {
      const coord = this.coordinates.priceToScreen(this.previewTime, this.previewPrice);
      if (coord && coord.x !== null) {
        ctx.strokeStyle = this.style.color;
        ctx.globalAlpha = 0.5; // 半透明
        ctx.lineWidth = this.style.lineWidth;
        ctx.setLineDash([5, 5]); // 虚线
        
        ctx.beginPath();
        ctx.moveTo(coord.x, 0);
        ctx.lineTo(coord.x, chartHeight);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0; // 恢复透明度
      }
    }
  }

  isComplete() {
    return this.time !== null;
  }

  getPoints() {
    if (this.time === null) return [];
    
    return [
      { time: this.time, price: this.priceAtClick }
    ];
  }

  setPoints(points) {
    if (points.length >= 1) {
      this.time = points[0].time;
      this.priceAtClick = points[0].price;
      this.isDrawing = false;
    }
  }
}

