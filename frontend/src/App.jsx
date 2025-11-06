import { useState, useRef, useEffect } from 'react';
import TradingChart from './components/TradingChart';
import { useWebSocket } from './hooks/useWebSocket';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8001/ws';

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize chart
  const handleChartReady = (chart, series) => {
    chartRef.current = chart;
    seriesRef.current = series;
    console.log('Chart initialized');

    // Load initial data
    loadHistoricalData();
  };

  // Load historical K-line data
  const loadHistoricalData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch K-lines
      const klinesResponse = await axios.get(
        `${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=200`
      );

      const klines = klinesResponse.data;

      if (klines.length > 0 && seriesRef.current) {
        // Update candlestick chart
        const candlestickData = klines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        seriesRef.current.candlestick.setData(candlestickData);

        console.log(`Loaded ${klines.length} K-lines for ${symbol} ${timeframe}`);

        // Load indicators (MA5, MA20)
        await loadIndicators(klines);

        // Load signals
        await loadSignals();
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load historical data:', err);
      setError('Failed to load data. Please check if the backend is running.');
      setIsLoading(false);
    }
  };

  // Load indicator data
  const loadIndicators = async (klines) => {
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
  };

  // Load trading signals
  const loadSignals = async () => {
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
  };

  // Handle symbol change
  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
    setSignals([]);
    if (seriesRef.current) {
      // Clear chart data
      seriesRef.current.candlestick.setData([]);
      seriesRef.current.ma5.setData([]);
      seriesRef.current.ma20.setData([]);
    }
  };

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
      console.log('Subscribed to topics:', topics);
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
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="1h">1小时</option>
              <option value="4h">4小时</option>
              <option value="1d">1天</option>
            </select>
          </div>

          {error && (
            <div className="error">{error}</div>
          )}

          {isLoading ? (
            <div className="loading">加载中...</div>
          ) : (
            <TradingChart 
              symbol={symbol} 
              onChartReady={handleChartReady} 
            />
          )}
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

