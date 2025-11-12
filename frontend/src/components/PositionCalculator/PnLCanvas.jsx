import { useEffect, useRef } from 'react';
import { drawPnLBoxOnCanvas, clearPnLBoxCanvas } from '../../utils/drawPriceLines';

/**
 * P&L 矩形 Canvas 组件
 * 
 * 在图表上绘制合约计算器的盈亏区域矩形
 */
export default function PnLCanvas({
  chart,
  series,
  result,
  visible
}) {
  const containerRef = useRef();
  const canvasRef = useRef();
  const animationFrameRef = useRef();
  
  // 创建和初始化 Canvas
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
    canvas.style.pointerEvents = 'none';  // 让事件穿透
    canvas.style.zIndex = '5';  // 在图表上，但在绘图工具下
    
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;
    
    // 监听图表大小变化
    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.current) {
        const newRect = chartContainer.getBoundingClientRect();
        canvasRef.current.width = newRect.width;
        canvasRef.current.height = newRect.height;
        // 触发重绘
        redraw();
      }
    });
    
    resizeObserver.observe(chartContainer);
    
    // 清理
    return () => {
      resizeObserver.disconnect();
      if (canvasRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(canvasRef.current);
        } catch (e) {
          // Canvas already removed
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [chart]);
  
  // 重绘函数
  const redraw = () => {
    if (!canvasRef.current || !chart || !series) return;
    
    // 清除画布
    clearPnLBoxCanvas(canvasRef.current);
    
    // 如果不显示或没有结果，直接返回
    if (!visible || !result || result.error) return;
    
    // 绘制 P&L 矩形
    drawPnLBoxOnCanvas(canvasRef.current, chart, series, result);
  };
  
  // 监听 result 和 visible 变化，触发重绘
  useEffect(() => {
    redraw();
  }, [result, visible, chart, series]);
  
  // 监听图表滚动和缩放，触发重绘
  useEffect(() => {
    if (!chart) return;
    
    const timeScale = chart.timeScale();
    
    const handleVisibleRangeChange = () => {
      // 使用 requestAnimationFrame 避免频繁重绘
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(redraw);
    };
    
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [chart, result, visible, series]);
  
  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none'
      }}
    />
  );
}

