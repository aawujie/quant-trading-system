import { useEffect, useRef } from 'react';

/**
 * 绘图画布组件
 * 在图表上叠加一个Canvas层用于绘图
 */
export default function DrawingCanvas({
  chart,
  canvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  redrawCanvas,
  isDrawingMode, // 是否处于绘图模式
  activeTool // 当前激活的绘图工具
}) {
  const containerRef = useRef();
  const crosshairPos = useRef({ x: null, y: null }); // 存储十字星位置

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    // 创建 Canvas 覆盖层
    const canvas = document.createElement('canvas');
    const chartContainer = chart.chartElement();
    const rect = chartContainer.getBoundingClientRect();
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    // 关键：只在绘图模式时接收事件，否则让事件穿透到底层图表
    canvas.style.pointerEvents = isDrawingMode ? 'auto' : 'none';
    canvas.style.zIndex = '10';
    // 不设置 cursor，让图表库的十字星正常显示
    canvas.style.cursor = 'default';

    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    // 绘制十字星线
    const drawCrosshair = (ctx, x, y) => {
      if (x === null || y === null) return;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      // 绘制垂直线
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ctx.canvas.height);
      ctx.stroke();
      
      // 绘制水平线
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.restore();
    };
    
    // 包装 mousemove 事件，更新十字星位置
    const handleMouseMove = (e) => {
      // 更新十字星位置
      const rect = canvas.getBoundingClientRect();
      crosshairPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // 调用绘图的 mousemove 处理
      onMouseMove(e);
      
      // 在绘图模式下，触发重绘以更新十字星
      if (isDrawingMode) {
        requestAnimationFrame(() => {
          redrawWithCrosshair();
        });
      }
    };
    
    // 包装 mouseleave 事件，清除十字星
    const handleMouseLeave = (e) => {
      crosshairPos.current = { x: null, y: null };
      onMouseLeave(e);
      
      // 重绘
      redrawWithCrosshair();
    };
    
    // 绑定鼠标事件到 canvas
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // 包装 redrawCanvas，在重绘后添加十字星
    const redrawWithCrosshair = () => {
      if (!redrawCanvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      redrawCanvas();
      
      // 在绘图模式下绘制十字星（水平线和垂直线工具除外）
      const shouldShowCrosshair = isDrawingMode && 
        activeTool !== 'horizontal_line' && 
        activeTool !== 'vertical_line' &&
        crosshairPos.current.x !== null;
      
      if (shouldShowCrosshair) {
        drawCrosshair(ctx, crosshairPos.current.x, crosshairPos.current.y);
      }
    };
    
    // 初始绘制
    redrawWithCrosshair();

    // 监听窗口大小变化
    const handleResize = () => {
      const newRect = chartContainer.getBoundingClientRect();
      canvas.width = newRect.width;
      canvas.height = newRect.height;
      redrawWithCrosshair();
    };

    window.addEventListener('resize', handleResize);

    // 图表缩放/平移时重绘（时间轴和价格轴）
    const handleVisibleRangeChange = () => {
      redrawWithCrosshair();
    };

    const timeScale = chart.timeScale();
    
    // 订阅时间范围变化
    timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    
    // 订阅逻辑范围变化（包括价格轴变化）
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      // 移除事件监听
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      
      window.removeEventListener('resize', handleResize);
      timeScale.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      
      if (containerRef.current && canvas) {
        try {
          containerRef.current.removeChild(canvas);
        } catch (e) {
          // Canvas可能已被移除
        }
      }
    };
  }, [chart, canvasRef, redrawCanvas, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, isDrawingMode, activeTool]);

  // 当绘图模式改变时，动态更新canvas的事件接收状态
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 只在绘图模式时接收事件，否则让事件穿透
    canvas.style.pointerEvents = isDrawingMode ? 'auto' : 'none';
    // 保持默认光标，不覆盖图表库的十字星
    canvas.style.cursor = 'default';
  }, [isDrawingMode, canvasRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  );
}

