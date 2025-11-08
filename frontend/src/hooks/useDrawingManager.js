import { useState, useCallback, useRef, useEffect } from 'react';
import { ChartCoordinates } from '../utils/chartCoordinates';
import { TrendLineTool } from '../components/DrawingTools/drawings/TrendLineTool';
import { RectangleTool } from '../components/DrawingTools/drawings/RectangleTool';
import { HorizontalLineTool } from '../components/DrawingTools/drawings/HorizontalLineTool';
import { VerticalLineTool } from '../components/DrawingTools/drawings/VerticalLineTool';
import { FibonacciTool } from '../components/DrawingTools/drawings/FibonacciTool';
import { ParallelLineTool } from '../components/DrawingTools/drawings/ParallelLineTool';
import { drawingApi } from '../services/drawingApi';

/**
 * 绘图管理Hook
 * 统一管理所有绘图工具和已绘制的图形
 */
export function useDrawingManager(chart, series, symbol, timeframe) {
  const [activeTool, setActiveTool] = useState(null); // 'line' | 'rectangle' | null
  const [drawings, setDrawings] = useState([]); // 所有已完成的绘图
  const currentTool = useRef(null);
  const coordinates = useRef(null);
  const canvasRef = useRef(null);

  // 初始化坐标转换器
  useEffect(() => {
    if (chart && series) {
      coordinates.current = new ChartCoordinates(chart, series);
    }
  }, [chart, series]);

  // 加载历史绘图（所有时间级别共享）
  useEffect(() => {
    if (!chart || !series || !symbol) return;

    async function loadHistoricalDrawings() {
      try {
        const savedDrawings = await drawingApi.getDrawings(symbol);
        
        // 将保存的数据转换为绘图工具实例
        const reconstructedDrawings = savedDrawings.map(data => {
          const tool = createToolFromData(data);
          return tool;
        }).filter(tool => tool !== null);
        
        setDrawings(reconstructedDrawings);
        
        console.log(`✅ 加载了 ${savedDrawings.length} 个历史绘图（所有时间级别共享）`);
      } catch (error) {
        console.error('❌ 加载历史绘图失败:', error);
      }
    }

    loadHistoricalDrawings();
  }, [chart, series, symbol]); // 移除 timeframe 依赖

  // 创建新工具
  const createTool = useCallback((toolType) => {
    if (!chart || !series || !coordinates.current) return null;

    switch (toolType) {
      case 'line':
        return new TrendLineTool(chart, series, coordinates.current);
      case 'rectangle':
        return new RectangleTool(chart, series, coordinates.current);
      case 'horizontal_line':
        return new HorizontalLineTool(chart, series, coordinates.current);
      case 'vertical_line':
        return new VerticalLineTool(chart, series, coordinates.current);
      case 'fibonacci':
        return new FibonacciTool(chart, series, coordinates.current);
      case 'parallel_line':
        return new ParallelLineTool(chart, series, coordinates.current);
      default:
        return null;
    }
  }, [chart, series]);

  // 从保存的数据重建绘图工具
  const createToolFromData = useCallback((data) => {
    if (!chart || !series || !coordinates.current) return null;

    try {
      const tool = createTool(data.drawing_type);
      if (!tool) return null;
      
      // 恢复点数据
      tool.setPoints(data.points);
      
      // 恢复样式和元数据
      tool.setStyle(data.style);
      tool.drawingId = data.drawing_id;
      tool.label = data.label;
      tool.created_at = data.created_at; // 恢复时间戳
      
      return tool;
    } catch (error) {
      console.error('重建绘图工具失败:', error);
      return null;
    }
  }, [chart, series, createTool]);

  // 激活工具
  const activateTool = useCallback((toolType) => {
    setActiveTool(toolType);
    currentTool.current = createTool(toolType);
  }, [createTool]);

  // 停用工具
  const deactivateTool = useCallback(() => {
    // 如果当前工具已完成，保存它
    if (currentTool.current && currentTool.current.isComplete()) {
      saveDrawing(currentTool.current);
      setDrawings(prev => [...prev, currentTool.current]);
    }
    
    setActiveTool(null);
    currentTool.current = null;
  }, []);

  // 验证绘图是否有效
  const validateDrawing = useCallback((tool) => {
    // 对于趋势线、矩形和斐波那契，检查两个点是否相同
    if (tool.type === 'trend_line' || tool.type === 'rectangle' || tool.type === 'fibonacci') {
      const points = tool.getPoints();
      if (points.length === 2) {
        const [point1, point2] = points;
        // 如果时间和价格都相同，则无效
        if (point1.time === point2.time && point1.price === point2.price) {
          return false;
        }
      }
    }
    
    // 对于平行线，检查三个点的有效性
    if (tool.type === 'parallel_line') {
      const points = tool.getPoints();
      if (points.length === 3) {
        const [point1, point2, point3] = points;
        // 前两个点不能相同
        if (point1.time === point2.time && point1.price === point2.price) {
          return false;
        }
        // 第三个点不能与前两个点中的任何一个相同
        if ((point3.time === point1.time && point3.price === point1.price) ||
            (point3.time === point2.time && point3.price === point2.price)) {
          return false;
        }
      }
    }
    
    // 其他类型或有效的绘图
    return true;
  }, []);

  // 保存绘图到后端
  const saveDrawing = useCallback(async (tool) => {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // 给工具对象添加时间戳（用于显示）
      tool.created_at = timestamp;
      
      const drawingData = {
        drawing_id: tool.drawingId,
        symbol,
        timeframe,
        drawing_type: tool.type,
        points: tool.getPoints(),
        style: tool.style,
        label: tool.label || '',
        created_at: timestamp
      };

      console.log('📤 保存绘图数据:', JSON.stringify(drawingData, null, 2));
      await drawingApi.saveDrawing(drawingData);
      console.log('✅ 绘图已保存');
    } catch (error) {
      console.error('❌ 保存绘图失败:', error);
      if (error.response) {
        console.error('❌ 错误详情:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }, [symbol, timeframe]);

  // 重绘所有图形（提前定义，避免循环依赖）
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制所有已完成的图形
    drawings.forEach(drawing => {
      try {
        drawing.draw(ctx);
      } catch (error) {
        console.error('绘制失败:', error);
      }
    });

    // 绘制当前正在绘制的图形
    if (currentTool.current) {
      try {
        currentTool.current.draw(ctx);
      } catch (error) {
        console.error('绘制当前工具失败:', error);
      }
    }
  }, [drawings]);

  // 删除绘图
  const deleteDrawing = useCallback(async (drawingId) => {
    try {
      await drawingApi.deleteDrawing(drawingId);
      setDrawings(prev => prev.filter(d => d.drawingId !== drawingId));
      redrawCanvas();
      console.log('✅ 绘图已删除');
    } catch (error) {
      console.error('❌ 删除绘图失败:', error);
    }
  }, [redrawCanvas]);

  // 鼠标事件处理
  const handleMouseDown = useCallback((e) => {
    if (!currentTool.current) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentTool.current.onMouseDown(x, y);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!currentTool.current) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentTool.current.onMouseMove(x, y);
    
    // 触发重绘
    redrawCanvas();
  }, [redrawCanvas]);

  const handleMouseUp = useCallback((e) => {
    if (!currentTool.current) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentTool.current.onMouseUp(x, y);

    // 如果绘制完成，保存并自动停用工具
    if (currentTool.current.isComplete()) {
      const completedTool = currentTool.current;
      
      // 验证绘图是否有效（对于趋势线和矩形，检查两个点是否相同）
      const isValidDrawing = validateDrawing(completedTool);
      
      if (isValidDrawing) {
      // 保存到后端
      saveDrawing(completedTool);
      
      // 添加到绘图列表
      setDrawings(prev => [...prev, completedTool]);
        
        console.log('✅ 绘图完成并添加到列表，当前绘图数量:', drawings.length + 1);
      } else {
        console.log('⚠️ 绘图无效（两个点相同），已丢弃');
      }
      
      // 自动停用工具（画完一次就退出绘图模式）
      setActiveTool(null);
      currentTool.current = null;
      console.log('🎨 绘图工具已自动停用');
    }

    // 触发重绘
    redrawCanvas();
  }, [saveDrawing, redrawCanvas, drawings.length, validateDrawing]);

  const handleMouseLeave = useCallback(() => {
    if (!currentTool.current) return;
    
    // 调用工具的 onMouseLeave 方法
    if (currentTool.current.onMouseLeave) {
      currentTool.current.onMouseLeave();
    }
    
    // 触发重绘以清除预览
    redrawCanvas();
  }, [redrawCanvas]);

  // 当图表缩放/平移时重绘（时间轴和价格轴）
  useEffect(() => {
    if (!chart || !series) return;

    const handleVisibleRangeChange = () => {
      redrawCanvas();
    };

    // 订阅时间范围变化（左右拖拽、缩放）
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    // 订阅价格范围变化（上下拖拽、缩放）
    const priceScale = series.priceScale();
    const handlePriceRangeChange = () => {
      redrawCanvas();
    };
    
    // 使用逻辑范围变化监听价格轴
    timeScale.subscribeVisibleLogicalRangeChange(handlePriceRangeChange);

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      timeScale.unsubscribeVisibleLogicalRangeChange(handlePriceRangeChange);
    };
  }, [chart, series, redrawCanvas]);

  // 当绘图列表更新时重绘
  useEffect(() => {
    if (drawings.length > 0) {
      redrawCanvas();
    }
  }, [drawings, redrawCanvas]);

  // 使用requestAnimationFrame持续重绘（确保绘图跟随图表变化）
  useEffect(() => {
    if (!chart || drawings.length === 0) return;

    let animationId;
    let lastRedrawTime = 0;
    const redrawInterval = 50; // 20fps，避免过度重绘

    const animate = (timestamp) => {
      // 限制重绘频率
      if (timestamp - lastRedrawTime >= redrawInterval) {
        redrawCanvas();
        lastRedrawTime = timestamp;
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [chart, drawings.length, redrawCanvas]);

  return {
    activeTool,
    activateTool,
    deactivateTool,
    drawings,
    setDrawings,
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    redrawCanvas,
    deleteDrawing,
  };
}

