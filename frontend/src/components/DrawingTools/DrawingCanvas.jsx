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
  isDrawingMode // 新增：是否处于绘图模式
}) {
  const containerRef = useRef();

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

    // 包装 mousemove 事件，同时更新图表十字星
    const handleMouseMove = (e) => {
      // 调用绘图的 mousemove 处理
      onMouseMove(e);
      
      // 如果在绘图模式，手动触发图表的十字星更新
      if (isDrawingMode) {
        const chartContainer = chart.chartElement();
        const rect = chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 触发图表的鼠标移动事件，使十字星跟随
        const mouseEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          view: window
        });
        chartContainer.dispatchEvent(mouseEvent);
      }
    };
    
    // 绑定鼠标事件到 canvas
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    // 初始绘制
    if (redrawCanvas) {
      redrawCanvas();
    }

    // 监听窗口大小变化
    const handleResize = () => {
      const newRect = chartContainer.getBoundingClientRect();
      canvas.width = newRect.width;
      canvas.height = newRect.height;
      if (redrawCanvas) {
        redrawCanvas();
      }
    };

    window.addEventListener('resize', handleResize);

    // 图表缩放/平移时重绘（时间轴和价格轴）
    const handleVisibleRangeChange = () => {
      if (redrawCanvas) {
        redrawCanvas();
      }
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
  }, [chart, canvasRef, redrawCanvas, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, isDrawingMode]);

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

