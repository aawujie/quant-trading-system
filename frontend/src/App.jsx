import { useState, useRef, useEffect, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import PriceDisplay from './components/PriceDisplay';
import DataManager from './components/DataManager/DataManager';
import { useWebSocket } from './hooks/useWebSocket';
import { useDrawingManager } from './hooks/useDrawingManager';
import DrawingToolbar from './components/DrawingTools/DrawingToolbar';
import DrawingCanvas from './components/DrawingTools/DrawingCanvas';
import DrawingList from './components/DrawingTools/DrawingList';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8001/ws';

export default function App() {
  const [currentView, setCurrentView] = useState('trading'); // trading, dataManager
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [marketType, setMarketType] = useState('future'); // 市场类型：spot(现货) / future(永续)
  
  // Use refs to store latest symbol/timeframe/marketType for WebSocket callbacks
  const symbolRef = useRef(symbol);
  const timeframeRef = useRef(timeframe);
  const marketTypeRef = useRef(marketType);
  
  // Update refs when symbol/timeframe/marketType changes
  useEffect(() => {
    symbolRef.current = symbol;
    timeframeRef.current = timeframe;
    marketTypeRef.current = marketType;
  }, [symbol, timeframe, marketType]);

  // No need to clear refs when switching views - chart stays in background

  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Changed to false
  const [error, setError] = useState(null);
  const [noDataMessage, setNoDataMessage] = useState(null); // 无数据提示

  // 实时价格数据
  const [priceData, setPriceData] = useState({
    currentPrice: null,
    openPrice: null,
    high24h: null,
    low24h: null,
    volume24h: null,
  });

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersRef = useRef([]);
  const hasLoadedData = useRef(false); // Track if data has been loaded
  const earliestTimestamp = useRef(null); // Track the earliest loaded timestamp
  const isLoadingMore = useRef(false); // Prevent concurrent load requests
  const hasMoreData = useRef(true); // Track if more data is available

  // 绘图管理
  const drawingManager = useDrawingManager(
    chartRef.current,
    seriesRef.current?.candlestick,
    symbol,
    timeframe
  );

  // Generate future ghost bars for time scale marks (不可见的未来K线，只为生成刻度)
  const generateFutureBars = useCallback((lastBar, timeframe, count = 50) => {
    const timeframeSeconds = {
      '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400
    };
    
    const interval = timeframeSeconds[timeframe] || 3600;
    const futureBars = [];
    
    for (let i = 1; i <= count; i++) {
      futureBars.push({
        time: lastBar.time + interval * i,
        open: lastBar.close,
        high: lastBar.close,
        low: lastBar.close,
        close: lastBar.close,
      });
    }
    
    return futureBars;
  }, []);

  // Set chart to show latest 200 bars (or all if less than 200)
  const setInitialChartView = useCallback(() => {
    if (!chartRef.current || !seriesRef.current?.candlestick) {
      console.warn('⚠️ Chart or series not ready');
      return;
    }

    try {
      const candlestickData = seriesRef.current.candlestick.data();
      if (!candlestickData || candlestickData.length === 0) {
        console.warn('⚠️ No candlestick data available');
        return;
      }

      const timeScale = chartRef.current.timeScale();
      const totalBars = candlestickData.length;
      const barsToShow = 500; // Show all loaded bars initially
      
      // Calculate range: show all loaded bars with 10% padding on right
      const from = Math.max(0, totalBars - barsToShow);
      const to = totalBars + barsToShow * 0.1;
      
      timeScale.setVisibleLogicalRange({ from, to });
      
      console.log(`📍 Chart view: showing ${Math.min(totalBars, barsToShow)} bars (${from.toFixed(0)} to ${to.toFixed(1)})`);
    } catch (err) {
      console.error('❌ Failed to set chart view:', err);
    }
  }, []);

  // Reset chart - always show all loaded bars with same zoom level
  const resetChart = useCallback(() => {
    if (!chartRef.current || !seriesRef.current?.candlestick) {
      console.warn('⚠️ Chart not ready');
      return;
    }

    try {
      console.log('🔄 Resetting chart view and price scale...');
      const candlestickData = seriesRef.current.candlestick.data();
      const totalBars = candlestickData.length;
      const barsToShow = 500;
      
      const timeScale = chartRef.current.timeScale();
      const from = Math.max(0, totalBars - barsToShow);
      const to = totalBars + barsToShow * 0.1;
      
      // 重置时间轴范围
      timeScale.setVisibleLogicalRange({ from, to });
      
      // 重置价格轴缩放（竖坐标）
      const priceScale = chartRef.current.priceScale('right');
      priceScale.applyOptions({
        autoScale: true,
      });
      
      console.log(`✅ Reset: showing latest ${Math.min(totalBars, barsToShow)} bars (${from.toFixed(0)} to ${to.toFixed(1)}), price scale auto-adjusted`);
    } catch (err) {
      console.error('❌ Failed to reset chart:', err);
    }
  }, []);

  // Load 24h ticker data (独立于timeframe，初次加载)
  const loadTickerData = useCallback(async (isInitialLoad = false) => {
    try {
      const tickerResponse = await axios.get(`${API_BASE_URL}/api/ticker/${symbol}`);
      const ticker = tickerResponse.data;
      
      // 只更新24h统计数据
      setPriceData(prev => ({
        ...prev,
        // 只在初次加载时设置currentPrice，之后由WebSocket实时更新
        ...(isInitialLoad ? { currentPrice: ticker.last } : {}),
        openPrice: ticker.last - (ticker.price_change || 0), // 反推24h前价格
        high24h: ticker.high,
        low24h: ticker.low,
        volume24h: ticker.volume_24h,
      }));
      
      console.log(`✅ Loaded 24h ticker data from exchange${isInitialLoad ? ' (initial)' : ' (refresh)'}`);
    } catch (tickerErr) {
      console.error('❌ Failed to load ticker data:', tickerErr);
    }
  }, [symbol]);

  // Load historical K-line data - wrapped in useCallback
  const loadHistoricalData = useCallback(async () => {
    // Prevent duplicate loading during React strict mode
    if (hasLoadedData.current) {
      console.log('⏭️ Skipping duplicate data load');
      return;
    }
    
    // Early check: ensure refs are available before starting
    if (!seriesRef.current || !chartRef.current) {
      console.warn('⚠️ Chart refs not ready, deferring load');
      return;
    }
    
    hasLoadedData.current = true;
    
    try {
      console.log('🔄 Loading historical data...');
      setIsLoading(true);
      setError(null);
      setNoDataMessage(null); // 清除之前的提示

      // Fetch K-lines from API (increase limit to load more historical data)
      console.log(`📡 Fetching: ${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=500&market_type=${marketType}`);
      const klinesResponse = await axios.get(
        `${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=500&market_type=${marketType}`
      );

      const klines = klinesResponse.data;
      console.log(`✅ Received ${klines.length} K-lines`);

      // Re-check refs after async operations (they might be null if component unmounted)
      if (klines.length > 0 && seriesRef.current && chartRef.current) {
        // Track the earliest timestamp
        earliestTimestamp.current = klines[0].timestamp;
        console.log(`📌 Initial earliest timestamp set to: ${earliestTimestamp.current}`);
        
        // Update candlestick chart - use timestamp directly
        // The chart will display time based on user's browser timezone
        const candlestickData = klines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        console.log('📊 Setting candlestick data...');
        seriesRef.current.candlestick.setData(candlestickData);
        
        // Add invisible helper line to extend time scale with full data points
        if (!seriesRef.current.futureHelper && chartRef.current) {
          const lastBar = candlestickData[candlestickData.length - 1];
          const futureBars = generateFutureBars(lastBar, timeframe, 50);
          
          // Create an invisible line series that extends to the future
          const helperSeries = chartRef.current.addLineSeries({
            color: 'transparent',
            lineWidth: 0,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          
          // Add ALL future points (not just 2) to generate time scale marks
          const helperData = [
            { time: lastBar.time, value: lastBar.close },
            ...futureBars.map(bar => ({ time: bar.time, value: lastBar.close }))
          ];
          
          helperSeries.setData(helperData);
          
          seriesRef.current.futureHelper = helperSeries;
          console.log(`✅ Extended time scale with ${helperData.length} future points`);
        }


        console.log(`✅ Loaded ${klines.length} K-lines for ${symbol} ${timeframe}`);

        // Set initial chart view
        setInitialChartView();

        // Load indicators (MA5, MA20)
        await loadIndicators(klines);

        // Load signals
        await loadSignals();
      } else if (klines.length === 0) {
        // 没有数据，显示友好提示
        console.warn('⚠️ No K-line data available for this market type');
        const marketTypeName = marketType === 'spot' ? '现货' : marketType === 'future' ? '永续合约' : marketType;
        const otherMarketType = marketType === 'spot' ? 'future' : 'spot';
        const otherMarketTypeName = otherMarketType === 'spot' ? '现货' : '永续合约';
        
        setNoDataMessage({
          type: marketType,
          typeName: marketTypeName,
          otherType: otherMarketType,
          otherTypeName: otherMarketTypeName
        });
      } else {
        console.warn('⚠️ Chart not ready:', {
          hasKlines: klines.length > 0,
          hasSeriesRef: !!seriesRef.current,
          hasChartRef: !!chartRef.current
        });
      }

      console.log('✅ Data loading complete, setting isLoading=false');
      setIsLoading(false);
    } catch (err) {
      console.error('❌ Failed to load historical data:', err);
      setError('Failed to load data. Please check if the backend is running.');
      setIsLoading(false);
    }
  }, [symbol, timeframe, marketType, setInitialChartView]);

  // Load more historical data (for infinite scroll)
  const loadMoreData = useCallback(async (onComplete) => {
    // Prevent concurrent requests
    if (isLoadingMore.current) {
      console.log('⏳ Already loading more data, skipping...');
      if (onComplete) onComplete();
      return;
    }

    // Check if more data is available
    if (!hasMoreData.current) {
      console.log('⚠️ No more data available');
      if (onComplete) onComplete();
      return;
    }

    // Check if we have a valid earliest timestamp
    if (!earliestTimestamp.current) {
      console.warn('⚠️ No earliest timestamp available');
      if (onComplete) onComplete();
      return;
    }

    // Set loading flag
    isLoadingMore.current = true;

    try {
      console.log('📥 Loading more historical data before:', earliestTimestamp.current);
      
      // Fetch older K-lines - load 500 at a time to reduce trigger frequency
      const klinesResponse = await axios.get(
        `${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=500&before=${earliestTimestamp.current}&market_type=${marketType}`
      );

      const klines = klinesResponse.data;
      console.log(`✅ Loaded ${klines.length} more K-lines`);

      if (klines.length > 0 && seriesRef.current) {
        // Update the earliest timestamp to the oldest one we just loaded
        earliestTimestamp.current = klines[0].timestamp;
        console.log(`📌 Updated earliest timestamp to: ${earliestTimestamp.current}`);
        
        // Get existing data
        const existingData = seriesRef.current.candlestick.data();
        
        // Prepare new candlestick data - use timestamp directly
        const newCandlestickData = klines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        // Merge new data with existing data (new data comes first)
        const mergedData = [...newCandlestickData, ...existingData];
        
        // Update chart with merged data
        seriesRef.current.candlestick.setData(mergedData);
        
        console.log(`✅ Total K-lines now: ${mergedData.length}`);
      } else {
        // No more data available from backend
        console.log('⚠️ No more historical data available');
        hasMoreData.current = false;
      }
    } catch (err) {
      console.error('❌ Failed to load more data:', err);
    } finally {
      // Reset loading flag
      isLoadingMore.current = false;
      
      // Always call the completion callback to reset chart's loading flag
      if (onComplete) onComplete();
    }
  }, [symbol, timeframe, marketType]);

  // Initialize chart
  const handleChartReady = useCallback((chart, series) => {
    chartRef.current = chart;
    seriesRef.current = series;
    console.log('✅ Chart initialized, loading data...');

    // Load initial data
    loadHistoricalData();
  }, [loadHistoricalData]);

  // Load indicators has been moved above

  // Load indicator data
  const loadIndicators = useCallback(async (klines) => {
    try {
      // For each K-line timestamp, try to get indicator data
      const timestamps = klines.map(k => k.timestamp);

      // In a real app, you'd have a batch API endpoint
      // For now, just get the latest indicator
      const response = await axios.get(
        `${API_BASE_URL}/api/indicators/${symbol}/${timeframe}/latest`
      );

      // Note: This is a simplified version
      // In production, you'd load all indicators for all timestamps
      console.log('Latest indicator:', response.data);
    } catch (err) {
      console.error('Failed to load indicators:', err);
    }
  }, [symbol, timeframe]);

  // Load trading signals
  const loadSignals = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/signals/dual_ma?symbol=${symbol}&limit=50`
      );

      const signalsData = response.data;
      setSignals(signalsData);

      // Add markers to chart
      if (seriesRef.current && signalsData.length > 0) {
        const markers = signalsData.map(signal => ({
          time: signal.timestamp,
          position: signal.signal_type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: signal.signal_type === 'BUY' ? '#26a69a' : '#ef5350',
          shape: signal.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: signal.signal_type,
        }));

        seriesRef.current.candlestick.setMarkers(markers);
        markersRef.current = markers;

        console.log(`Loaded ${signalsData.length} signals`);
      }
    } catch (err) {
      console.error('Failed to load signals:', err);
    }
  }, [symbol]);

  // Handle symbol change
  const handleSymbolChange = (newSymbol) => {
    console.log('🔄 Switching symbol to:', newSymbol);
    setSymbol(newSymbol);
    setSignals([]);
    setNoDataMessage(null); // 清除无数据提示
    hasLoadedData.current = false; // Reset to allow data reload
    earliestTimestamp.current = null; // Reset earliest timestamp
    isLoadingMore.current = false; // Reset loading flag
    hasMoreData.current = true; // Reset data availability flag
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
      
      // Remove future helper series
      if (seriesRef.current.futureHelper && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current.futureHelper);
        seriesRef.current.futureHelper = null;
      }
    }
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    console.log('🔄 Switching timeframe to:', newTimeframe);
    setTimeframe(newTimeframe);
    setSignals([]);
    setNoDataMessage(null); // 清除无数据提示
    hasLoadedData.current = false; // Reset to allow data reload
    earliestTimestamp.current = null; // Reset earliest timestamp
    isLoadingMore.current = false; // Reset loading flag
    hasMoreData.current = true; // Reset data availability flag
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
      
      // Remove future helper series
      if (seriesRef.current.futureHelper && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current.futureHelper);
        seriesRef.current.futureHelper = null;
      }
    }
  };

  // Handle market type change
  const handleMarketTypeChange = (newMarketType) => {
    console.log('🔄 Switching market type to:', newMarketType);
    setMarketType(newMarketType);
    setSignals([]);
    setNoDataMessage(null); // 清除无数据提示
    hasLoadedData.current = false; // Reset to allow data reload
    earliestTimestamp.current = null; // Reset earliest timestamp
    isLoadingMore.current = false; // Reset loading flag
    hasMoreData.current = true; // Reset data availability flag
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
      
      // Remove future helper series
      if (seriesRef.current.futureHelper && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current.futureHelper);
        seriesRef.current.futureHelper = null;
      }
    }
  };

  // Load ticker data when symbol changes (独立于timeframe)
  useEffect(() => {
    loadTickerData(true); // 初次加载，会设置currentPrice
    
    // 定期刷新ticker数据（每30秒，只更新24h统计，不更新currentPrice）
    const tickerInterval = setInterval(() => {
      loadTickerData(false); // 定期刷新，不更新currentPrice
    }, 30000);
    
    return () => clearInterval(tickerInterval);
  }, [symbol, loadTickerData]);

  // Reload data when symbol, timeframe, or market type changes
  useEffect(() => {
    if (seriesRef.current && !hasLoadedData.current) {
      console.log('📥 Reloading data for', symbol, timeframe, marketType);
      loadHistoricalData();
    }
  }, [symbol, timeframe, marketType, loadHistoricalData]);

  // WebSocket message handler
  const handleWebSocketMessage = (message) => {
    const { topic, data } = message;

    if (!topic || !data) return;

    if (topic.startsWith('kline:')) {
      // Debug: 打印原始数据
      console.log('📨 收到K线数据:', {
        topic,
        timestamp: data.timestamp,
        timestamp_type: typeof data.timestamp,
        data: data
      });
      handleKlineUpdate(data);
    } else if (topic.startsWith('indicator:')) {
      handleIndicatorUpdate(data);
    } else if (topic.startsWith('signal:')) {
      handleSignalUpdate(data);
    }
  };

  // Handle K-line update
  const handleKlineUpdate = (kline) => {
    // Always update chart data, even when not visible (chart works in background)
    // Use refs to get latest symbol/timeframe/marketType (avoid closure issues)
    const currentSymbol = symbolRef.current;
    const currentTimeframe = timeframeRef.current;
    const currentMarketType = marketTypeRef.current;
    
    // Debug: log all received K-lines
    console.log('🔍 Checking K-line:', {
      received: `${kline.symbol}:${kline.timeframe}:${kline.market_type}`,
      expected: `${currentSymbol}:${currentTimeframe}:${currentMarketType}`,
      hasSeriesRef: !!seriesRef.current,
      match: kline.symbol === currentSymbol && kline.timeframe === currentTimeframe && kline.market_type === currentMarketType
    });

    if (seriesRef.current && 
        kline.symbol === currentSymbol && 
        kline.timeframe === currentTimeframe && 
        kline.market_type === currentMarketType) {
      // Debug: 检查数据格式
      if (typeof kline.timestamp !== 'number') {
        console.error('❌ Invalid timestamp type:', typeof kline.timestamp, kline.timestamp);
        console.error('Full kline data:', kline);
        return;
      }
      
      try {
        // Check if chart is still valid before updating
        if (!seriesRef.current || !seriesRef.current.candlestick) {
          return;
        }

        // Use timestamp directly - chart will display based on browser timezone
        seriesRef.current.candlestick.update({
          time: kline.timestamp,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
        });

        // Update current price only (24h data comes from exchange ticker API)
        setPriceData(prev => ({
          ...prev,
          currentPrice: kline.close,
        }));

        console.log('✅ Updated K-line:', kline.timestamp);
      } catch (error) {
        // Silently ignore errors from disposed chart
        if (error.message && error.message.includes('disposed')) {
          return;
        }
        console.error('❌ Failed to update K-line:', error);
      }
    }
  };

  // Handle indicator update
  const handleIndicatorUpdate = (indicator) => {
    // Always update indicators, even when not visible (chart works in background)
    const currentSymbol = symbolRef.current;
    const currentTimeframe = timeframeRef.current;
    
    if (seriesRef.current && indicator.symbol === currentSymbol && indicator.timeframe === currentTimeframe) {
      try {
        // Check if chart is still valid
        if (!seriesRef.current || !seriesRef.current.ma5 || !seriesRef.current.ma20) {
          return;
        }

        if (indicator.ma5) {
          seriesRef.current.ma5.update({
            time: indicator.timestamp,
            value: indicator.ma5,
          });
        }

        if (indicator.ma20) {
          seriesRef.current.ma20.update({
            time: indicator.timestamp,
            value: indicator.ma20,
          });
        }

        console.log('Updated indicators:', indicator.timestamp);
      } catch (error) {
        // Silently ignore errors from disposed chart
        if (error.message && error.message.includes('disposed')) {
          return;
        }
        console.error('❌ Failed to update indicators:', error);
      }
    }
  };

  // Handle signal update
  const handleSignalUpdate = (signal) => {
    // Always update signals, even when not visible
    const currentSymbol = symbolRef.current;
    
    if (signal.symbol === currentSymbol) {
      setSignals(prev => [signal, ...prev].slice(0, 50));

      // Add marker to chart
      if (seriesRef.current && seriesRef.current.candlestick) {
        try {
          const newMarker = {
            time: signal.timestamp,
            position: signal.signal_type === 'BUY' ? 'belowBar' : 'aboveBar',
            color: signal.signal_type === 'BUY' ? '#26a69a' : '#ef5350',
            shape: signal.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: signal.signal_type,
          };

          const allMarkers = [...markersRef.current, newMarker];
          seriesRef.current.candlestick.setMarkers(allMarkers);
          markersRef.current = allMarkers;

          console.log('New signal:', signal.signal_type, signal.price);
        } catch (error) {
          // Silently ignore errors from disposed chart
          if (error.message && error.message.includes('disposed')) {
            return;
          }
          console.error('❌ Failed to add signal marker:', error);
        }
      }
    }
  };

  // WebSocket connection
  const { isConnected, subscribe, unsubscribe } = useWebSocket(WS_URL, handleWebSocketMessage);

  // Subscribe to topics when connected
  useEffect(() => {
    if (isConnected) {
      const topics = [
        `kline:${symbol}:${timeframe}:${marketType}`,
        `indicator:${symbol}:${timeframe}`,
        `signal:dual_ma:${symbol}`,
      ];

      subscribe(topics);
      console.log('📡 Subscribed to topics:', topics);

      // Cleanup: unsubscribe when symbol/timeframe/marketType changes
      return () => {
        unsubscribe(topics);
        console.log('📡 Unsubscribed from topics:', topics);
      };
    }
  }, [isConnected, symbol, timeframe, marketType, subscribe, unsubscribe]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Trading Nerd</h1>
          <div className="nav-buttons">
            <button
              className={`nav-button ${currentView === 'trading' ? 'active' : ''}`}
              onClick={() => setCurrentView('trading')}
            >
              📈 交易图表
            </button>
            <button
              className={`nav-button ${currentView === 'dataManager' ? 'active' : ''}`}
              onClick={() => setCurrentView('dataManager')}
            >
              📊 数据管理
            </button>
          </div>
        </div>
        <div className="status">
          <span>{isConnected ? '🟢 已连接' : '🔴 未连接'}</span>
          {currentView === 'trading' && (
            <>
              <span>{symbol}</span>
              <span>{timeframe}</span>
            </>
          )}
        </div>
      </header>

      <main className="main-content">
        {/* Data Manager View */}
        {currentView === 'dataManager' && <DataManager />}

        {/* Trading View - stays mounted, just hidden */}
        <div className="chart-section" style={{ display: currentView === 'trading' ? 'flex' : 'none' }}>
          <div className="toolbar">
            <select 
              value={symbol} 
              onChange={(e) => handleSymbolChange(e.target.value)}
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
            </select>

            {/* 时间级别按钮组 */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { value: '3m', label: '3m' },
                { value: '5m', label: '5m' },
                { value: '15m', label: '15m' },
                { value: '30m', label: '30m' },
                { value: '1h', label: '1h' },
                { value: '4h', label: '4h' },
                { value: '1d', label: '1d' }
              ].map((tf, index, arr) => (
            <button 
                  key={tf.value}
                  onClick={() => handleTimeframeChange(tf.value)}
              style={{
                    padding: '8px 12px',
                    background: timeframe === tf.value ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                color: 'white',
                    border: '1px solid ' + (timeframe === tf.value ? '#4CAF50' : 'rgba(255,255,255,0.3)'),
                    borderRadius: index === 0 ? '6px 0 0 6px' : (index === arr.length - 1 ? '0 6px 6px 0' : '0'),
                cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: timeframe === tf.value ? '600' : '400',
                    transition: 'all 0.2s',
                    minWidth: '42px'
                  }}
                  onMouseOver={(e) => {
                    if (timeframe !== tf.value) {
                      e.target.style.background = 'rgba(255,255,255,0.15)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (timeframe !== tf.value) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                    }
              }}
                  title={tf.label}
            >
                  {tf.label}
            </button>
              ))}
            </div>

            {/* 绘图工具栏 */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '1rem' }}>
            <DrawingToolbar
              activeTool={drawingManager.activeTool}
              onToolSelect={drawingManager.activateTool}
            />
            </div>

            {/* 市场类型切换 - 放在右侧 */}
            <button
              onClick={() => handleMarketTypeChange(marketType === 'spot' ? 'future' : 'spot')}
              style={{
                marginLeft: 'auto',
                padding: '8px 12px',
                background: '#2196F3',
                color: 'white',
                border: '1px solid #2196F3',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s',
                minWidth: '42px',
                marginRight: '0.5rem'
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#1976D2';
                e.target.style.borderColor = '#1976D2';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#2196F3';
                e.target.style.borderColor = '#2196F3';
              }}
              title={marketType === 'spot' ? '切换到合约' : '切换到现货'}
            >
              {marketType === 'spot' ? 'S' : 'F'}
            </button>

            {/* 重置图表按钮 */}
            <button 
              onClick={resetChart}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#888',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.color = '#fff';
                e.target.style.borderColor = '#666';
              }}
              onMouseOut={(e) => {
                e.target.style.color = '#888';
                e.target.style.borderColor = '#444';
              }}
              title="Reset chart view"
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="error">{error}</div>
          )}

          {isLoading && (
            <div className="loading" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              加载数据中...
            </div>
          )}

          {/* 无数据提示 */}
          {noDataMessage && !isLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              background: 'rgba(33, 33, 33, 0.95)',
              border: '2px solid #FF9800',
              borderRadius: '12px',
              padding: '32px 48px',
              textAlign: 'center',
              maxWidth: '600px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <h3 style={{ color: '#FF9800', fontSize: '20px', marginBottom: '16px', fontWeight: '600' }}>
                暂无{noDataMessage.typeName}数据
              </h3>
              <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                当前市场类型：<strong style={{ color: '#FF9800' }}>{noDataMessage.typeName}</strong>
                <br />
                后端没有运行相应的数据采集节点
              </p>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>💡 解决方案：</div>
                <div style={{ color: '#eee', fontSize: '13px', lineHeight: '1.8' }}>
                  <strong>方案1：</strong>启动{noDataMessage.typeName}数据节点
                  <br />
                  <code style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    display: 'inline-block',
                    marginTop: '8px',
                    color: '#4CAF50'
                  }}>
                    MARKET_TYPE={noDataMessage.type} python -m app.main --node kline ...
                  </code>
                  <br /><br />
                  <strong>方案2：</strong>切换到 {noDataMessage.otherTypeName} 查看数据
                </div>
              </div>

              <button
                onClick={() => handleMarketTypeChange(noDataMessage.otherType)}
                style={{
                  padding: '12px 32px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                }}
                onMouseOver={(e) => e.target.style.background = '#1976D2'}
                onMouseOut={(e) => e.target.style.background = '#2196F3'}
              >
                切换到{noDataMessage.otherTypeName}
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <TradingChart 
              symbol={symbol} 
              onChartReady={handleChartReady}
              onLoadMore={loadMoreData}
            />
            
            {/* 绘图画布覆盖层 */}
            {chartRef.current && (
              <DrawingCanvas
                chart={chartRef.current}
                canvasRef={drawingManager.canvasRef}
                onMouseDown={drawingManager.handleMouseDown}
                onMouseMove={drawingManager.handleMouseMove}
                onMouseUp={drawingManager.handleMouseUp}
                onMouseLeave={drawingManager.handleMouseLeave}
                redrawCanvas={drawingManager.redrawCanvas}
                isDrawingMode={drawingManager.activeTool !== null}
                activeTool={drawingManager.activeTool}
              />
            )}
          </div>
        </div>

        <aside className="signal-panel" style={{ display: currentView === 'trading' ? 'flex' : 'none' }}>
          {/* 实时价格显示 */}
          <PriceDisplay
            symbol={symbol}
            currentPrice={priceData.currentPrice}
            priceChange={priceData.currentPrice - priceData.openPrice}
            priceChangePercent={priceData.openPrice ? ((priceData.currentPrice - priceData.openPrice) / priceData.openPrice * 100) : 0}
            high24h={priceData.high24h}
            low24h={priceData.low24h}
            volume24h={priceData.volume24h}
          />
          
          {/* 绘图列表 */}
          <DrawingList
            drawings={drawingManager.drawings}
            onDelete={drawingManager.deleteDrawing}
          />

          {/* 交易信号 */}
          <h3 style={{ marginTop: '2rem' }}>交易信号 ({signals.length})</h3>
          <div className="signal-list">
            {signals.map((signal, idx) => (
              <div key={idx} className={`signal signal-${signal.signal_type.toLowerCase()}`}>
                <strong>{signal.signal_type}</strong>
                <span>{signal.symbol}</span>
                <span>{new Date(signal.timestamp * 1000).toLocaleString()}</span>
                <span>${signal.price.toFixed(2)}</span>
                <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {signal.reason}
                </span>
              </div>
            ))}
            {signals.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3b0' }}>
                暂无交易信号
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

