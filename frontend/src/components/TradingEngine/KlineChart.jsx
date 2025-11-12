import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * K线+信号标记图表组件（回测专用）
 * 
 * 静态展示，不需要实时更新
 */
export default function KlineChart({ backtestResult }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);  // 初始为 false，等待 useEffect 触发
  const [error, setError] = useState(null);
  
  useEffect(() => {
    console.log('📊 KlineChart: useEffect triggered');
    console.log('📊 KlineChart: backtestResult =', backtestResult);
    console.log('📊 KlineChart: containerRef.current =', containerRef.current);
    
    if (!backtestResult) {
      console.log('⚠️ KlineChart: backtestResult is null/undefined, skipping');
      return;
    }
    
    if (!containerRef.current) {
      console.log('⚠️ KlineChart: containerRef.current is null, skipping');
      return;
    }
    
    // 防止重复初始化
    if (chartRef.current) {
      console.log('⚠️ KlineChart: Chart already initialized, skipping');
      return;
    }
    
    let chart = null;
    
    const initChart = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('📊 KlineChart: Starting to load kline data...');
        console.log('📊 KlineChart: backtestResult =', backtestResult);
        
        // 1. 加载K线数据
        console.log('📊 KlineChart: Calling loadKlineData()...');
        const klines = await backtestResult.loadKlineData();
        console.log('📊 KlineChart: Loaded', klines?.length, 'klines');
        
        if (!klines || klines.length === 0) {
          setError('无K线数据');
          setLoading(false);
          return;
        }
        
        // 2. 清空容器（防止重复创建）
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        
        // 3. 创建图表
        chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 400,
          layout: {
            background: { color: '#0a0a0f' },
            textColor: '#d1d4dc',
          },
          grid: {
            vertLines: { color: '#1a1a2e' },
            horzLines: { color: '#1a1a2e' },
          },
          crosshair: {
            mode: 0, // Normal
          },
          timeScale: {
            borderColor: '#2a2a3a',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 10,
            barSpacing: 6,
          },
          rightPriceScale: {
            borderColor: '#2a2a3a',
          },
        });
        
        chartRef.current = chart;
        
        // 3. 创建K线系列
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        
        // 4. 转换并设置K线数据
        const chartData = klines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        
        candlestickSeries.setData(chartData);
        
        // 5. 添加信号标记
        const markers = backtestResult.getTradeMarkers();
        if (markers && markers.length > 0) {
          candlestickSeries.setMarkers(markers);
        }
        
        // 6. 自动调整视图
        chart.timeScale().fitContent();
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load kline chart:', err);
        setError('加载图表失败：' + err.message);
        setLoading(false);
      }
    };
    
    initChart();
    
    // 窗口大小变化时调整图表
    const handleResize = () => {
      if (chart && containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // 清理
    return () => {
      console.log('🗑️ KlineChart: Cleaning up chart');
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;  // 重置 ref，允许重新初始化
    };
  }, [backtestResult]);
  
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        📊 K线图 + 交易信号
      </h4>
      
      {/* 容器始终渲染，但根据状态显示不同内容 */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center h-[400px] bg-[#1a1a2e] z-10">
            <div className="text-center">
              <div className="text-4xl mb-2 animate-spin">⏳</div>
              <div className="text-sm text-gray-400">加载K线数据...</div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center h-[400px] bg-[#1a1a2e] z-10">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-sm text-red-400">{error}</div>
            </div>
          </div>
        )}
        
        {/* 图表容器始终存在 */}
        <div ref={containerRef} className={loading || error ? 'invisible' : 'visible'} />
      </div>
      
      {/* 图例说明 */}
      {!loading && !error && (
        <div className="flex gap-4 mt-3 text-xs text-gray-400 justify-center">
          <div className="flex items-center gap-1">
            <span className="text-green-400">▲</span> 开仓
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-400">▼</span> 平仓
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-400">■</span> 做多
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-400">■</span> 做空
          </div>
        </div>
      )}
    </div>
  );
}

