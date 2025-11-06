import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * TradingChart Component
 * 
 * Displays candlestick chart with moving averages using TradingView Lightweight Charts
 * 
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {function} onChartReady - Callback when chart is initialized
 */
export default function TradingChart({ symbol, onChartReady }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});

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
      timeScale: {
        borderColor: '#3a3a4a',
        timeVisible: true,
        secondsVisible: false,
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

