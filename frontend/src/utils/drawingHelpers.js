/**
 * 绘图辅助函数
 */

/**
 * 计算两点之间的距离
 * @param {{x: number, y: number}} p1 - 点1
 * @param {{x: number, y: number}} p2 - 点2
 * @returns {number} 距离
 */
export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * 判断点是否在线段附近（用于选中检测）
 * @param {{x: number, y: number}} point - 待检测的点
 * @param {{x: number, y: number}} lineStart - 线段起点
 * @param {{x: number, y: number}} lineEnd - 线段终点
 * @param {number} threshold - 距离阈值（像素）
 * @returns {boolean}
 */
export function isPointNearLine(point, lineStart, lineEnd, threshold = 5) {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;

  // 计算点到线段的距离
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist <= threshold;
}

/**
 * 判断点是否在矩形内
 * @param {{x: number, y: number}} point - 待检测的点
 * @param {{x: number, y: number, width: number, height: number}} rect - 矩形
 * @returns {boolean}
 */
export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * 绘制虚线
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {number} x1 - 起点X
 * @param {number} y1 - 起点Y
 * @param {number} x2 - 终点X
 * @param {number} y2 - 终点Y
 * @param {number[]} dashPattern - 虚线模式 [实线长度, 间隔长度]
 */
export function drawDashedLine(ctx, x1, y1, x2, y2, dashPattern = [5, 5]) {
  ctx.setLineDash(dashPattern);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * 生成唯一ID
 * @returns {string}
 */
export function generateId() {
  return `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取矩形的标准化坐标（左上角为原点）
 * @param {{x: number, y: number}} start - 起点
 * @param {{x: number, y: number}} end - 终点
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function normalizeRect(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  
  return { x, y, width, height };
}

