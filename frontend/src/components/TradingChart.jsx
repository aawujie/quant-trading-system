import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * TradingChart Component
 * 
 * Displays candlestick chart with moving averages using TradingView Lightweight Charts
 * 
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {function} onChartReady - Callback when chart is initialized
 * @param {function} onLoadMore - Callback to load more historical data when scrolling left
 */
export default function TradingChart({ symbol, onChartReady, onLoadMore }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const isLoadingMore = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore); // Store the latest onLoadMore callback
  
  // Update the ref whenever onLoadMore changes
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    console.log('🎨 Creating chart for symbol:', symbol);

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: {
        mode: 0, // CrosshairMode.Normal
      },
      localization: {
        timeFormatter: (timestamp) => {
          // Convert Unix timestamp to Beijing time (UTC+8)
          const date = new Date(timestamp * 1000);
          const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
          const year = beijingDate.getUTCFullYear();
          const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(beijingDate.getUTCDate()).padStart(2, '0');
          const hours = String(beijingDate.getUTCHours()).padStart(2, '0');
          const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}`;
        },
      },
      timeScale: {
        borderColor: '#3a3a4a',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 50, // 右侧预留空间（可以画未来的线）
        barSpacing: 6, // K线间距
        minBarSpacing: 0.5, // 最小K线间距
        fixLeftEdge: false, // 不固定左边界
        fixRightEdge: false, // 不固定右边界（允许滚动到未来）
        lockVisibleTimeRangeOnResize: false, // 窗口大小变化时不锁定可见范围
        rightBarStaysOnScroll: false, // 滚动时最右边的K线可以移动
        shiftVisibleRangeOnNewBar: false, // 新K线不自动移动视图
      },
      rightPriceScale: {
        borderColor: '#3a3a4a',
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current.candlestick = candlestickSeries;

    // Create MA5 line series
    const ma5Series = chart.addLineSeries({
      color: '#FF6B6B',
      lineWidth: 1,
      title: 'MA5',
    });

    seriesRef.current.ma5 = ma5Series;

    // Create MA20 line series
    const ma20Series = chart.addLineSeries({
      color: '#4ECDC4',
      lineWidth: 1,
      title: 'MA20',
    });

    seriesRef.current.ma20 = ma20Series;

    // Subscribe to visible time range changes for infinite scroll
    const timeScale = chart.timeScale();
    
    const handleVisibleTimeRangeChange = (timeRange) => {
      if (!timeRange || isLoadingMore.current) return;

      const logicalRange = timeScale.getVisibleLogicalRange();
      if (!logicalRange) return;

      // When user scrolls to the left edge, trigger loading
      // Lower threshold = less frequent triggers
      if (logicalRange.from < 10 && logicalRange.from >= 0) {
        console.log('📥 Near left edge, loading more data...');
        isLoadingMore.current = true;
        
        // Trigger load more - use ref to get the latest callback
        if (onLoadMoreRef.current) {
          onLoadMoreRef.current(() => {
            isLoadingMore.current = false;
          });
        } else {
          isLoadingMore.current = false;
        }
      }
    };

    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);

    // Notify parent component only once
    if (onChartReady) {
      // Use setTimeout to ensure this runs after the chart is fully initialized
      setTimeout(() => {
        onChartReady(chart, seriesRef.current);
      }, 0);
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      console.log('🗑️ Cleaning up chart');
      
      window.removeEventListener('resize', handleResize);
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleTimeRangeChange);
      chart.remove();
    };
  }, [symbol]); // Remove onChartReady from dependencies

  return (
    <div 
      ref={chartContainerRef} 
      className="trading-chart"
    />
  );
}

