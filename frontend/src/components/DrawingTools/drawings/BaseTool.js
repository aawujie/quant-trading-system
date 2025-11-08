import { generateId } from '../../../utils/drawingHelpers';

/**
 * 所有绘图工具的基类
 */
export class BaseTool {
  constructor(chart, series, coordinates) {
    this.chart = chart;
    this.series = series;
    this.coordinates = coordinates;
    this.isDrawing = false;
    this.points = [];
    this.drawingId = generateId();
    this.type = 'base';
    
    // 默认样式
    this.style = {
      color: '#8AB4F8', // 浅蓝色
      lineWidth: 1, // 更细的线条
      lineStyle: 'solid',
      fillOpacity: 0.1
    };
    
    this.label = '';
  }

  /**
   * 鼠标按下事件 - 子类需要实现
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   */
  onMouseDown(x, y) {
    throw new Error('onMouseDown must be implemented by subclass');
  }

  /**
   * 鼠标移动事件 - 子类需要实现
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   */
  onMouseMove(x, y) {
    throw new Error('onMouseMove must be implemented by subclass');
  }

  /**
   * 鼠标释放事件 - 子类需要实现
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   */
  onMouseUp(x, y) {
    throw new Error('onMouseUp must be implemented by subclass');
  }

  /**
   * 鼠标离开画布事件 - 子类可选实现
   */
  onMouseLeave() {
    // 默认不做任何操作，子类可以覆盖
  }

  /**
   * 绘制图形 - 子类需要实现
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   */
  draw(ctx) {
    throw new Error('draw must be implemented by subclass');
  }

  /**
   * 检查绘制是否完成
   * @returns {boolean}
   */
  isComplete() {
    return false;
  }

  /**
   * 获取关键点（用于保存）
   * @returns {Array<{time: number, price: number}>}
   */
  getPoints() {
    return [];
  }

  /**
   * 从保存的点恢复
   * @param {Array<{time: number, price: number}>} points
   */
  setPoints(points) {
    // 子类实现
  }

  /**
   * 设置样式
   * @param {object} style
   */
  setStyle(style) {
    this.style = { ...this.style, ...style };
  }

  /**
   * 获取可绘制区域（排除坐标轴刻度区域）
   * @param {number} canvasWidth - 画布宽度
   * @param {number} canvasHeight - 画布高度
   * @returns {{left: number, right: number, top: number, bottom: number}}
   */
  getDrawableBounds(canvasWidth, canvasHeight) {
    // 留出坐标轴刻度的空间
    return {
      left: 0,
      right: canvasWidth - 70, // 右侧价格轴约70px
      top: 0,
      bottom: canvasHeight - 30 // 底部时间轴约30px
    };
  }

  /**
   * 序列化为可保存的格式
   * @returns {object}
   */
  toJSON() {
    return {
      drawing_id: this.drawingId,
      drawing_type: this.type,
      points: this.getPoints(),
      style: this.style,
      label: this.label
    };
  }
}

