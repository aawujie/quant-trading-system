import { useState, useRef, useEffect, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import { useWebSocket } from './hooks/useWebSocket';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8001/ws';

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Changed to false
  const [error, setError] = useState(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersRef = useRef([]);
  const hasLoadedData = useRef(false); // Track if data has been loaded
  const earliestTimestamp = useRef(null); // Track the earliest loaded timestamp

  // Load historical K-line data - wrapped in useCallback
  const loadHistoricalData = useCallback(async () => {
    // Prevent duplicate loading during React strict mode
    if (hasLoadedData.current) {
      console.log('⏭️ Skipping duplicate data load');
      return;
    }
    hasLoadedData.current = true;
    try {
      console.log('🔄 Loading historical data...');
      setIsLoading(true);
      setError(null);

      // Fetch K-lines
      console.log(`📡 Fetching: ${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=200`);
      const klinesResponse = await axios.get(
        `${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=200`
      );

      const klines = klinesResponse.data;
      console.log(`✅ Received ${klines.length} K-lines`);

      if (klines.length > 0 && seriesRef.current) {
        // Track the earliest timestamp
        earliestTimestamp.current = klines[0].timestamp;
        console.log(`📌 Initial earliest timestamp set to: ${earliestTimestamp.current}`);
        
        // Update candlestick chart
        const candlestickData = klines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        console.log('📊 Setting candlestick data...');
        seriesRef.current.candlestick.setData(candlestickData);

        console.log(`✅ Loaded ${klines.length} K-lines for ${symbol} ${timeframe}`);

        // Align chart to left: first bar at left edge, show all data with padding on right
        if (chartRef.current && candlestickData.length > 0) {
          const timeScale = chartRef.current.timeScale();
          const barCount = candlestickData.length;
          // from: 0 means first bar is at left edge
          // to: barCount + padding shows all bars with some space on right
          timeScale.setVisibleLogicalRange({
            from: 0,
            to: barCount + barCount * 0.1  // Show all bars + 10% padding
          });
          console.log(`📍 Chart aligned to left (showing all ${barCount} bars)`);
        }

        // Load indicators (MA5, MA20)
        await loadIndicators(klines);

        // Load signals
        await loadSignals();
      } else {
        console.warn('⚠️ No data or seriesRef not ready');
      }

      console.log('✅ Data loading complete, setting isLoading=false');
      setIsLoading(false);
    } catch (err) {
      console.error('❌ Failed to load historical data:', err);
      setError('Failed to load data. Please check if the backend is running.');
      setIsLoading(false);
    }
  }, [symbol, timeframe]); // Only depend on symbol and timeframe

  // Load more historical data (for infinite scroll)
  const loadMoreData = useCallback(async (onComplete) => {
    try {
      // Check if we have a valid earliest timestamp
      if (!earliestTimestamp.current) {
        console.warn('⚠️ No earliest timestamp available');
        if (onComplete) onComplete();
        return;
      }

      console.log('📥 Loading more historical data before:', earliestTimestamp.current);
      
      // Fetch older K-lines
      const klinesResponse = await axios.get(
        `${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=100&before=${earliestTimestamp.current}`
      );

      const klines = klinesResponse.data;
      console.log(`✅ Loaded ${klines.length} more K-lines`);

      if (klines.length > 0 && seriesRef.current) {
        // Update the earliest timestamp to the oldest one we just loaded
        earliestTimestamp.current = klines[0].timestamp;
        console.log(`📌 Updated earliest timestamp to: ${earliestTimestamp.current}`);
        
        // Get existing data
        const existingData = seriesRef.current.candlestick.data();
        
        // Prepare new candlestick data
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
        console.log('⚠️ No more historical data available');
      }
    } catch (err) {
      console.error('❌ Failed to load more data:', err);
    } finally {
      // Always call the completion callback to reset loading flag
      if (onComplete) onComplete();
    }
  }, [symbol, timeframe]);

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
    hasLoadedData.current = false; // Reset to allow data reload
    earliestTimestamp.current = null; // Reset earliest timestamp
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
    }
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    console.log('🔄 Switching timeframe to:', newTimeframe);
    setTimeframe(newTimeframe);
    setSignals([]);
    hasLoadedData.current = false; // Reset to allow data reload
    earliestTimestamp.current = null; // Reset earliest timestamp
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
    }
  };

  // Reload data when symbol or timeframe changes
  useEffect(() => {
    if (seriesRef.current && !hasLoadedData.current) {
      console.log('📥 Reloading data for', symbol, timeframe);
      loadHistoricalData();
    }
  }, [symbol, timeframe, loadHistoricalData]);

  // WebSocket message handler
  const handleWebSocketMessage = (message) => {
    const { topic, data } = message;

    if (!topic || !data) return;

    if (topic.startsWith('kline:')) {
      handleKlineUpdate(data);
    } else if (topic.startsWith('indicator:')) {
      handleIndicatorUpdate(data);
    } else if (topic.startsWith('signal:')) {
      handleSignalUpdate(data);
    }
  };

  // Handle K-line update
  const handleKlineUpdate = (kline) => {
    if (seriesRef.current && kline.symbol === symbol && kline.timeframe === timeframe) {
      seriesRef.current.candlestick.update({
        time: kline.timestamp,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
      });

      console.log('Updated K-line:', kline.timestamp);
    }
  };

  // Handle indicator update
  const handleIndicatorUpdate = (indicator) => {
    if (seriesRef.current && indicator.symbol === symbol && indicator.timeframe === timeframe) {
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
    }
  };

  // Handle signal update
  const handleSignalUpdate = (signal) => {
    if (signal.symbol === symbol) {
      setSignals(prev => [signal, ...prev].slice(0, 50));

      // Add marker to chart
      if (seriesRef.current) {
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
      }
    }
  };

  // WebSocket connection
  const { isConnected, subscribe } = useWebSocket(WS_URL, handleWebSocketMessage);

  // Subscribe to topics when connected
  useEffect(() => {
    if (isConnected) {
      const topics = [
        `kline:${symbol}:${timeframe}`,
        `indicator:${symbol}:${timeframe}`,
        `signal:dual_ma:${symbol}`,
      ];

      subscribe(topics);
      console.log('📡 Subscribed to topics:', topics);
    }
  }, [isConnected, symbol, timeframe, subscribe]);

  return (
    <div className="app">
      <header className="header">
        <h1>量化交易系统</h1>
        <div className="status">
          <span>{isConnected ? '🟢 已连接' : '🔴 未连接'}</span>
          <span>{symbol}</span>
          <span>{timeframe}</span>
        </div>
      </header>

      <main className="main-content">
        <div className="chart-section">
          <div className="toolbar">
            <select 
              value={symbol} 
              onChange={(e) => handleSymbolChange(e.target.value)}
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
            </select>

            <select 
              value={timeframe} 
              onChange={(e) => handleTimeframeChange(e.target.value)}
            >
              <option value="1h">1小时</option>
              <option value="4h">4小时</option>
              <option value="1d">1天</option>
            </select>
          </div>

          {error && (
            <div className="error">{error}</div>
          )}

          {isLoading && (
            <div className="loading" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              加载数据中...
            </div>
          )}

          <TradingChart 
            symbol={symbol} 
            onChartReady={handleChartReady}
            onLoadMore={loadMoreData}
          />
        </div>

        <aside className="signal-panel">
          <h3>交易信号 ({signals.length})</h3>
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

