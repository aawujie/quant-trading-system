import { useState, useRef, useEffect, useCallback } from 'react';
import TradingChart from './components/TradingChart';
import PriceDisplay from './components/PriceDisplay';
import DataManager from './components/DataManager/DataManager';
import { useWebSocket } from './hooks/useWebSocket';
import { useDrawingManager } from './hooks/useDrawingManager';
import { useIndicatorManager } from './hooks/useIndicatorManager';
import DrawingToolbar from './components/DrawingTools/DrawingToolbar';
import DrawingCanvas from './components/DrawingTools/DrawingCanvas';
import DrawingList from './components/DrawingTools/DrawingList';
import StrategyList from './components/Strategy/StrategyList';
import SidebarAccordion from './components/ui/SidebarAccordion';
import PositionCalculatorContent from './components/PositionCalculator/PositionCalculatorContent';
import DataIndicatorsList from './components/DataIndicators/DataIndicatorsList';
import IndicatorButton from './components/Indicators/IndicatorButton';
import IndicatorModal from './components/Indicators/IndicatorModal';
import { getIndicatorConfig } from './components/Indicators/IndicatorConfig';
import TradingEngine from './components/TradingEngine/TradingEngine';
import PnLCanvas from './components/PositionCalculator/PnLCanvas';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8001/ws';

// 缓存配置
const CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟过期
const CACHE_VERSION = 'v1'; // 缓存版本，方便清理旧缓存

// 缓存工具函数
const getCacheKey = (type, symbol, timeframe, marketType) => 
  `${CACHE_VERSION}_${type}_${symbol}_${timeframe}_${marketType}`;

const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Failed to get cached data:', err);
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('Failed to set cached data:', err);
    // 如果localStorage满了，清理旧缓存
    if (err.name === 'QuotaExceededError') {
      clearOldCache();
    }
  }
};

const clearOldCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_VERSION + '_klines_') || 
        key.startsWith(CACHE_VERSION + '_indicators_')) {
      try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
  });
};

// 预加载策略：相邻时间级别
const PRELOAD_TIMEFRAMES = {
  '3m': ['5m'],
  '5m': ['3m', '15m'],
  '15m': ['5m', '30m'],
  '30m': ['15m', '1h'],
  '1h': ['30m', '4h'],
  '4h': ['1h', '1d'],
  '1d': ['4h']
};

export default function App() {
  const [currentView, setCurrentView] = useState('trading'); // trading, dataManager, tradingEngine
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [marketType, setMarketType] = useState('future'); // 市场类型：spot(现货) / future(永续)
  
  // Use refs to store latest symbol/timeframe/marketType for WebSocket callbacks
  const symbolRef = useRef(symbol);
  const timeframeRef = useRef(timeframe);
  const marketTypeRef = useRef(marketType);
  
  // 保存每个时间级别的视图状态（用户的缩放状态）
  const viewStateByTimeframe = useRef({});
  
  // 标记是否正在程序化设置视图（非用户操作）
  const isSettingView = useRef(false);
  
  // Update refs when symbol/timeframe/marketType changes
  useEffect(() => {
    symbolRef.current = symbol;
    timeframeRef.current = timeframe;
    marketTypeRef.current = marketType;
  }, [symbol, timeframe, marketType]);

  // No need to clear refs when switching views - chart stays in background

  const [signals, setSignals] = useState([]);
  const [strategies, setStrategies] = useState([
    {
      name: 'dual_ma',
      enabled: true,
      params: {
        'fast_period': 5,
        'slow_period': 20,
        'symbol': symbol,
      }
    },
    {
      name: 'macd',
      enabled: true,
      params: {
        'fast_period': 12,
        'slow_period': 26,
        'signal_period': 9,
        'symbol': symbol,
      }
    },
    {
      name: 'rsi',
      enabled: true,
      params: {
        'period': 14,
        'oversold': 30,
        'overbought': 70,
        'symbol': symbol,
      }
    },
    {
      name: 'bollinger',
      enabled: true,
      params: {
        'period': 20,
        'std_dev': 2.0,
        'touch_threshold': '0.5%',
        'symbol': symbol,
      }
    }
  ]);
  const [isLoading, setIsLoading] = useState(false); // Changed to false
  const [error, setError] = useState(null);
  const [noDataMessage, setNoDataMessage] = useState(null); // 无数据提示
  
  // P&L 计算器状态
  const [pnlResult, setPnlResult] = useState(null);
  const [showPnLBox, setShowPnLBox] = useState(true);

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
  const unsubscribeViewListener = useRef(null); // 保存视图状态监听器的取消订阅函数

  // 绘图管理
  const drawingManager = useDrawingManager(
    chartRef.current,
    seriesRef.current?.candlestick,
    symbol,
    timeframe
  );

  // 指标管理
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const indicatorManager = useIndicatorManager(
    chartRef,
    seriesRef,
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

  // Set chart view - restore saved state or use initial view
  const setInitialChartView = useCallback((forceInitial = false) => {
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
      const priceScale = chartRef.current.priceScale('right');
      const totalBars = candlestickData.length;
      const barsToShow = 400;
      
      // 检查是否有保存的视图状态（用户之前缩放过）
      const savedView = viewStateByTimeframe.current[timeframe];
      
      // 标记开始程序化设置视图
      isSettingView.current = true;
      
      // 总是使用自动价格缩放，确保每个时间级别根据数据独立调整
      priceScale.applyOptions({
        autoScale: true,
      });
      
      if (!forceInitial && savedView) {
        // 恢复用户之前的时间范围缩放
        timeScale.setVisibleLogicalRange({ from: savedView.from, to: savedView.to });
        
        console.log(`📍 Restored view [${timeframe}]: ${savedView.from.toFixed(0)}-${savedView.to.toFixed(0)}`);
      } else {
        // 使用初始视图：显示最后 400 根K线，右侧预留 20%
        const from = Math.max(0, totalBars - barsToShow);
        const to = totalBars + barsToShow * 0.2;
        timeScale.setVisibleLogicalRange({ from, to });
        
        // 保存这个初始视图状态
        viewStateByTimeframe.current[timeframe] = { from, to };
        console.log(`📍 Initial view [${timeframe}]: ${from.toFixed(0)}-${to.toFixed(1)} (${Math.min(totalBars, barsToShow)} bars)`);
      }
      
      // 延迟重置标记，确保 setVisibleLogicalRange 触发的事件被忽略
      setTimeout(() => {
        isSettingView.current = false;
      }, 100);
    } catch (err) {
      console.error('❌ Failed to set chart view:', err);
    }
  }, [timeframe]);

  // Reset chart - clear saved state and restore to initial view
  const resetChart = useCallback(() => {
    if (!chartRef.current || !seriesRef.current?.candlestick) {
      console.warn('⚠️ Chart not ready');
      return;
    }

    try {
      console.log('🔄 Resetting chart view and price scale...');
      
      // 清除当前时间级别的保存状态
      delete viewStateByTimeframe.current[timeframe];
      console.log(`🗑️ Cleared saved view for ${timeframe}`);
      
      // 重置价格轴自动缩放
      const priceScale = chartRef.current.priceScale('right');
      priceScale.applyOptions({
        autoScale: true,
      });
      
      // 强制使用初始视图（forceInitial=true）
      setInitialChartView(true);
      
      console.log(`✅ Reset ${timeframe} to initial view`);
    } catch (err) {
      console.error('❌ Failed to reset chart:', err);
    }
  }, [timeframe, setInitialChartView]);

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
      setError(null);
      setNoDataMessage(null);

      // 生成缓存key
      const klinesCacheKey = getCacheKey('klines', symbol, timeframe, marketType);
      const indicatorsCacheKey = getCacheKey('indicators', symbol, timeframe, marketType);
      
      // 尝试从缓存获取
      const cachedKlines = getCachedData(klinesCacheKey);
      const cachedIndicators = getCachedData(indicatorsCacheKey);
      
      // 如果有缓存，立即显示
      if (cachedKlines && cachedKlines.length > 0 && seriesRef.current && chartRef.current) {
        console.log(`⚡ Using cached klines (${cachedKlines.length} bars)`);
        
        const candlestickData = cachedKlines.map(k => ({
          time: k.timestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        
        seriesRef.current.candlestick.setData(candlestickData);
        earliestTimestamp.current = cachedKlines[0].timestamp;
        
        // 添加未来辅助线（带错误处理）
        if (!seriesRef.current.futureHelper && chartRef.current) {
          try {
            const lastBar = candlestickData[candlestickData.length - 1];
            const futureBars = generateFutureBars(lastBar, timeframe, 50);
            const helperSeries = chartRef.current.addLineSeries({
              color: 'transparent',
              lineWidth: 0,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            helperSeries.setData([
              { time: lastBar.time, value: lastBar.close },
              ...futureBars.map(bar => ({ time: bar.time, value: lastBar.close }))
            ]);
            seriesRef.current.futureHelper = helperSeries;
          } catch (err) {
            console.warn('⚠️ Failed to add future helper (chart may be recreating):', err.message);
          }
        }
        
        setInitialChartView();
        
        // 如果有缓存的指标数据，也立即显示（延迟一点避免图表初始化冲突）
        if (cachedIndicators && cachedIndicators.length > 0) {
          console.log(`⚡ Using cached indicators (${cachedIndicators.length} points)`);
          // 延迟50ms，等待图表完全初始化
          setTimeout(() => {
            try {
              if (chartRef.current && seriesRef.current) {
                loadIndicatorsFromData(cachedIndicators);
                
                // 🔧 FIX: 加载指标后再次设置视图，确保视图范围不被指标加载影响
                setTimeout(() => {
                  if (chartRef.current && seriesRef.current) {
                    setInitialChartView();
                  }
                }, 100);
              }
            } catch (err) {
              console.debug('Cached indicator display failed, will retry on fresh load:', err.message);
            }
          }, 50);
        }
        
        console.log('⚡ Cache hit! Data displayed instantly');
      }

      // 并行请求新数据（无论是否有缓存，都在后台更新）
      console.log(`📡 Fetching fresh data (parallel)...`);
      const [klinesResponse, indicatorsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/klines/${symbol}/${timeframe}?limit=500&market_type=${marketType}`),
        axios.get(`${API_BASE_URL}/api/indicators/${symbol}/${timeframe}?limit=500&market_type=${marketType}`)
      ]);

      const klines = klinesResponse.data;
      const indicators = indicatorsResponse.data;
      console.log(`✅ Received ${klines.length} K-lines, ${indicators.length} indicators`);

      // 保存到缓存
      if (klines.length > 0) {
        setCachedData(klinesCacheKey, klines);
      }
      if (indicators.length > 0) {
        setCachedData(indicatorsCacheKey, indicators);
      }

      // 如果没有缓存或数据有更新，更新UI
      if (!cachedKlines || klines.length !== cachedKlines.length) {
        if (klines.length > 0 && seriesRef.current && chartRef.current) {
          earliestTimestamp.current = klines[0].timestamp;
          
          const candlestickData = klines.map(k => ({
            time: k.timestamp,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
          }));

          seriesRef.current.candlestick.setData(candlestickData);
          
          // 添加未来辅助线（带错误处理）
          if (!seriesRef.current.futureHelper && chartRef.current) {
            try {
              const lastBar = candlestickData[candlestickData.length - 1];
              const futureBars = generateFutureBars(lastBar, timeframe, 50);
              const helperSeries = chartRef.current.addLineSeries({
                color: 'transparent',
                lineWidth: 0,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
              });
              helperSeries.setData([
                { time: lastBar.time, value: lastBar.close },
                ...futureBars.map(bar => ({ time: bar.time, value: lastBar.close }))
              ]);
              seriesRef.current.futureHelper = helperSeries;
            } catch (err) {
              console.warn('⚠️ Failed to add future helper (chart may be recreating):', err.message);
            }
          }

          setInitialChartView();
          
          // 加载指标数据
          if (indicators.length > 0) {
            loadIndicatorsFromData(indicators);
            
            // 🔧 FIX: 加载指标后再次设置视图，确保视图范围不被指标加载影响
            // 延迟一小段时间，确保指标数据已完全加载到图表
            setTimeout(() => {
              if (chartRef.current && seriesRef.current) {
                setInitialChartView();
              }
            }, 100);
          }
          
          console.log(`✅ Updated ${klines.length} K-lines for ${symbol} ${timeframe}`);
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
        }
      }

      // 异步加载信号（不阻塞主流程）
      loadSignals().catch(err => console.warn('Failed to load signals:', err));
      
      // 预加载相邻时间级别（不阻塞）
      preloadAdjacentTimeframes();

      console.log('✅ Data loading complete');
    } catch (err) {
      console.error('❌ Failed to load historical data:', err);
      setError('Failed to load data. Please check if the backend is running.');
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

    // 清理之前的监听器（如果存在）
    if (unsubscribeViewListener.current) {
      unsubscribeViewListener.current();
      unsubscribeViewListener.current = null;
    }

    // 设置视图状态监听器（只保存用户的时间范围缩放，价格始终自动缩放）
    const timeScale = chart.timeScale();
    
    const handleVisibleRangeChange = () => {
      try {
        // 如果是程序化设置视图，忽略此次变化
        if (isSettingView.current) {
          console.log(`⏭️ Ignoring programmatic view change (isSettingView=true)`);
          return;
        }
        
        const range = timeScale.getVisibleLogicalRange();
        if (range) {
          const currentTimeframe = timeframeRef.current;
          const oldView = viewStateByTimeframe.current[currentTimeframe];
          
          viewStateByTimeframe.current[currentTimeframe] = {
            from: range.from,
            to: range.to
          };
          
          // 只在视图实际改变时打印（减少日志噪音）
          if (!oldView || Math.abs(oldView.from - range.from) > 1 || Math.abs(oldView.to - range.to) > 1) {
            console.log(`💾 Saved view [${currentTimeframe}]: ${range.from.toFixed(0)}-${range.to.toFixed(0)}`);
          }
        }
      } catch (err) {
        // 忽略错误
      }
    };
    
    // 订阅监听器并保存取消订阅函数
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    unsubscribeViewListener.current = () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
    console.log('✅ View state listener subscribed');

    // Load initial data
    loadHistoricalData();
  }, [loadHistoricalData]);

  // 初始化指标系列（当图表准备好后）
  useEffect(() => {
    if (!chartRef.current) return;

    console.log('🎨 Initializing indicator series for:', indicatorManager.activeIndicators);
    
    // 使用 updateIndicators 来确保正确创建和保存系列
    indicatorManager.updateIndicators(indicatorManager.activeIndicators);
  }, [chartRef.current, indicatorManager.activeIndicators]);

  // Load indicators has been moved above

  // 从指标数据加载到图表（用于缓存快速显示）
  const loadIndicatorsFromData = useCallback((indicators, indicatorIds = null) => {
    try {
      const targetIndicators = indicatorIds || indicatorManager.activeIndicators;
      
      // 为所有激活的指标准备数据
      const indicatorDataMap = {};
      targetIndicators.forEach(indicatorId => {
        indicatorDataMap[indicatorId] = [];
      });

      indicators.forEach(ind => {
        targetIndicators.forEach(indicatorId => {
          const config = getIndicatorConfig(indicatorId);
          if (config && config.field) {
            const value = ind[config.field];
            if (value !== null && value !== undefined) {
              indicatorDataMap[indicatorId].push({
                time: ind.timestamp,
                value: value
              });
            }
          }
        });
      });

      // 设置所有指标数据
      Object.keys(indicatorDataMap).forEach(indicatorId => {
        const data = indicatorDataMap[indicatorId];
        if (data.length > 0) {
          indicatorManager.setIndicatorData(indicatorId, data);
        }
      });
    } catch (err) {
      console.error('❌ Failed to load indicators from data:', err);
    }
  }, [indicatorManager]);

  // Load indicator data
  const loadIndicators = useCallback(async (klines, indicatorIds = null) => {
    try {
      console.log('📊 Loading indicators...');
      
      // 使用传入的指标列表，或者使用当前激活的指标
      const targetIndicators = indicatorIds || indicatorManager.activeIndicators;
      console.log(`🎯 Target indicators: ${targetIndicators.join(', ')}`);
      
      // 使用批量API加载指标数据
      const response = await axios.get(
        `${API_BASE_URL}/api/indicators/${symbol}/${timeframe}?limit=500&market_type=${marketType}`
      );

      const indicators = response.data;
      console.log(`✅ Received ${indicators.length} indicators`);

      if (indicators.length === 0) {
        console.warn('⚠️ No indicator data available');
        return;
      }

      loadIndicatorsFromData(indicators, targetIndicators);
      
      // 🔧 FIX: 加载指标后再次设置视图，确保视图范围不被指标加载影响
      setTimeout(() => {
        if (chartRef.current && seriesRef.current) {
          setInitialChartView();
        }
      }, 100);

    } catch (err) {
      console.error('❌ Failed to load indicators:', err);
    }
  }, [symbol, timeframe, marketType, indicatorManager, loadIndicatorsFromData, setInitialChartView]);

  // 预加载相邻时间级别（提升切换速度）
  const preloadAdjacentTimeframes = useCallback(() => {
    const toPreload = PRELOAD_TIMEFRAMES[timeframe] || [];
    
    console.log(`🔮 Preloading adjacent timeframes: ${toPreload.join(', ')}`);
    
    toPreload.forEach(tf => {
      const klinesCacheKey = getCacheKey('klines', symbol, tf, marketType);
      const indicatorsCacheKey = getCacheKey('indicators', symbol, tf, marketType);
      
      // 只预加载没有缓存的数据
      if (!getCachedData(klinesCacheKey)) {
        setTimeout(() => {
          axios.get(`${API_BASE_URL}/api/klines/${symbol}/${tf}?limit=500&market_type=${marketType}`)
            .then(res => {
              if (res.data && res.data.length > 0) {
                setCachedData(klinesCacheKey, res.data);
                console.log(`✅ Preloaded ${tf} klines (${res.data.length} bars)`);
              }
            })
            .catch(err => console.debug('Preload failed:', tf, err));
        }, 500); // 延迟500ms避免阻塞
      }
      
      if (!getCachedData(indicatorsCacheKey)) {
        setTimeout(() => {
          axios.get(`${API_BASE_URL}/api/indicators/${symbol}/${tf}?limit=500&market_type=${marketType}`)
            .then(res => {
              if (res.data && res.data.length > 0) {
                setCachedData(indicatorsCacheKey, res.data);
                console.log(`✅ Preloaded ${tf} indicators (${res.data.length} points)`);
              }
            })
            .catch(err => console.debug('Preload failed:', tf, err));
        }, 800); // 延迟800ms
      }
    });
  }, [symbol, timeframe, marketType]);

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
      // Clear candlestick data
      seriesRef.current.candlestick.setData([]);
      
      // 注意：指标系列由 indicatorManager 管理，切换symbol时会自动重建
      
      // Remove future helper series
      if (seriesRef.current.futureHelper && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current.futureHelper);
        seriesRef.current.futureHelper = null;
      }
    }
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    // 如果是当前时间级别，直接返回
    if (newTimeframe === timeframe) {
      console.log('⏭️ Already on timeframe:', newTimeframe);
      return;
    }
    
    console.log('🔄 Switching timeframe to:', newTimeframe);
    
    // 💾 在切换之前，保存当前时间级别的时间范围（价格始终使用自动缩放）
    try {
      if (chartRef.current && seriesRef.current?.candlestick) {
        const timeScale = chartRef.current.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        
        if (range && viewStateByTimeframe.current[timeframe]) {
          // 更新保存的时间范围状态
          viewStateByTimeframe.current[timeframe] = {
            from: range.from,
            to: range.to
          };
          
          console.log(`💾 Saved ${timeframe} view: ${range.from.toFixed(0)}-${range.to.toFixed(0)}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to save state before switch:', err);
    }
    
    // 🔒 阻止在切换过程中保存异常视图状态（setData([]) 会触发 VisibleLogicalRangeChange）
    isSettingView.current = true;
    
    // 清空 K 线数据，准备加载新的时间级别
    if (seriesRef.current) {
      seriesRef.current.candlestick.setData([]);
      
      // 移除未来辅助线
      if (seriesRef.current.futureHelper && chartRef.current) {
        chartRef.current.removeSeries(seriesRef.current.futureHelper);
        seriesRef.current.futureHelper = null;
      }
    }
    
    // 更新时间级别
    setTimeframe(newTimeframe);
    setSignals([]);
    setNoDataMessage(null);
    
    // 重置加载状态标志
    hasLoadedData.current = false;
    earliestTimestamp.current = null;
    isLoadingMore.current = false;
    hasMoreData.current = true;
    
    // ✅ isSettingView 会在 setInitialChartView 中被重置为 false
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
      // Clear candlestick data
      seriesRef.current.candlestick.setData([]);
      
      // 注意：指标系列由 indicatorManager 管理，切换市场类型时会自动重建
      
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
    
    if (indicator.symbol === currentSymbol && indicator.timeframe === currentTimeframe) {
      try {
        // 更新所有激活的指标
        indicatorManager.activeIndicators.forEach(indicatorId => {
          const config = getIndicatorConfig(indicatorId);
          if (config && config.field) {
            const value = indicator[config.field];
            if (value !== null && value !== undefined) {
              indicatorManager.updateIndicatorPoint(indicatorId, {
                time: indicator.timestamp,
                value: value
              });
            }
          }
        });

        console.log('✅ Updated indicators:', indicator.timestamp);
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
          // 判断是否为做多信号（BUY或OPEN_LONG）
          const isLongSignal = ['BUY', 'OPEN_LONG', 'CLOSE_SHORT'].includes(signal.signal_type);
          
          const newMarker = {
            time: signal.timestamp,
            position: isLongSignal ? 'belowBar' : 'aboveBar',
            color: isLongSignal ? '#26a69a' : '#ef5350',
            shape: isLongSignal ? 'arrowUp' : 'arrowDown',
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
            <button
              className={`nav-button ${currentView === 'tradingEngine' ? 'active' : ''}`}
              onClick={() => setCurrentView('tradingEngine')}
            >
              🚀 交易引擎
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

        {/* Trading Engine View */}
        {currentView === 'tradingEngine' && <TradingEngine />}

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
                  disabled={timeframe === tf.value}
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
                  title={timeframe === tf.value ? `当前: ${tf.label}` : `切换到 ${tf.label}`}
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

            {/* 指标管理按钮 */}
            <div style={{ marginLeft: '0.5rem' }}>
              <IndicatorButton
                onClick={() => setShowIndicatorModal(true)}
                indicatorCount={indicatorManager.activeIndicators.length}
              />
            </div>

            {/* 市场类型切换 - 放在右侧 */}
              <button
              onClick={() => handleMarketTypeChange(marketType === 'spot' ? 'future' : 'spot')}
                style={{
                marginLeft: 'auto',
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
                transition: 'all 0.2s',
                marginRight: '0.5rem'
              }}
              onMouseOver={(e) => {
                e.target.style.color = '#fff';
                e.target.style.borderColor = '#666';
              }}
              onMouseOut={(e) => {
                e.target.style.color = '#888';
                e.target.style.borderColor = '#444';
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
            
            {/* P&L 矩形画布覆盖层 */}
            {chartRef.current && seriesRef.current?.candlestick && (
              <PnLCanvas
                chart={chartRef.current}
                series={seriesRef.current.candlestick}
                result={pnlResult}
                visible={showPnLBox}
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
          
          {/* 统一的 Accordion 容器：合约计算器、绘图、策略 */}
          <SidebarAccordion
            type="multiple"
            items={[
              {
                id: 'calculator',
                title: '合约计算器',
                icon: '📐',
                storageKey: 'calculator',
                defaultCollapsed: false,
                onToggle: (isExpanded) => {
                  // 当合约计算器展开时显示矩形，折叠时隐藏
                  setShowPnLBox(isExpanded);
                },
                children: (
                  <PositionCalculatorContent
                    symbol={symbol}
                    currentPrice={priceData.currentPrice}
                    onResultChange={setPnlResult}
                  />
                ),
              },
              {
                id: 'drawing',
                title: '绘图',
                icon: '🎨',
                count: drawingManager.drawings.length,
                storageKey: 'drawingList',
                defaultCollapsed: false,
                children: (
                  <DrawingList
                    drawings={drawingManager.drawings}
                    onDelete={drawingManager.deleteDrawing}
                    onToggleVisibility={drawingManager.toggleDrawingVisibility}
                    onChangeColor={drawingManager.changeDrawingColor}
                  />
                ),
              },
              {
                id: 'strategy',
                title: '策略',
                icon: '⚡',
                count: strategies.length,
                storageKey: 'strategyList',
                defaultCollapsed: false,
                children: (
                  <StrategyList
                    symbol={symbol}
                    strategies={strategies}
                    signals={signals}
                    onStrategyToggle={(strategyName) => {
                      setStrategies(prev => prev.map(s => 
                        s.name === strategyName ? { ...s, enabled: !s.enabled } : s
                      ));
                    }}
                  />
                ),
              },
              {
                id: 'dataIndicators',
                title: '数据指标',
                icon: '📊',
                storageKey: 'dataIndicators',
                defaultCollapsed: false,
                children: <DataIndicatorsList />,
              },
            ]}
          />
        </aside>
      </main>

      {/* 指标选择弹窗 */}
      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        selectedIndicators={indicatorManager.activeIndicators}
        onConfirm={(newIndicators) => {
          indicatorManager.updateIndicators(newIndicators);
          // 重新加载指标数据，传入新的指标列表以避免状态更新延迟
          loadIndicators(null, newIndicators);
        }}
      />
    </div>
  );
}

