import { useState, useCallback, useEffect, useRef } from 'react';
import { getDefaultIndicators, getIndicatorConfig } from '../components/Indicators/IndicatorConfig';

/**
 * 指标管理Hook
 * 管理指标的显示/隐藏状态
 * 
 * @param {object} chartRef - TradingView图表实例引用
 * @param {object} seriesRef - 系列数据引用
 * @param {string} symbol - 交易对
 * @param {string} timeframe - 时间周期
 * @returns {object} 指标管理方法和状态
 */
export function useIndicatorManager(chartRef, seriesRef, symbol, timeframe) {
  // 当前激活的指标列表 - 直接从localStorage读取，避免时序问题
  const [activeIndicators, setActiveIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem(`indicators_${symbol}`);
      if (saved) {
        const savedIndicators = JSON.parse(saved);
        if (Array.isArray(savedIndicators)) {
          return savedIndicators;
        }
      }
    } catch (err) {
      console.warn('Failed to load indicator settings on init:', err);
    }
    // 只有没有保存记录时才使用默认值
    return getDefaultIndicators();
  });
  
  // 指标系列对象缓存（存储TradingView的line series）
  const [indicatorSeries, setIndicatorSeries] = useState({});
  
  // 使用 ref 追踪最新的 indicatorSeries，供清理函数使用
  const indicatorSeriesRef = useRef(indicatorSeries);
  
  // 同步更新 ref
  useEffect(() => {
    indicatorSeriesRef.current = indicatorSeries;
  }, [indicatorSeries]);

  /**
   * 创建指标线系列
   */
  const createIndicatorSeries = useCallback((indicatorId) => {
    if (!chartRef.current) return null;

    const config = getIndicatorConfig(indicatorId);
    if (!config) return null;

    // 只处理主图指标
    if (config.type !== 'main') {
      console.log(`📊 Skipping sub-chart indicator: ${indicatorId}`);
      return null;
    }

    try {
      const series = chartRef.current.addLineSeries({
        color: config.color,
        lineWidth: config.lineWidth || 1,
        title: config.name,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        autoscaleInfoProvider: () => ({
          priceRange: null,  // 不影响价格范围的自动缩放
        }),
      });

      console.log(`✅ Created indicator series: ${indicatorId}`);
      return series;
    } catch (error) {
      console.error(`❌ Failed to create indicator series ${indicatorId}:`, error);
      return null;
    }
  }, [chartRef]);

  /**
   * 移除指标线系列
   */
  const removeIndicatorSeries = useCallback((indicatorId) => {
    if (!chartRef.current) return;

    const series = indicatorSeries[indicatorId];
    if (series) {
      try {
        chartRef.current.removeSeries(series);
        console.log(`🗑️ Removed indicator series: ${indicatorId}`);
      } catch (error) {
        console.error(`❌ Failed to remove indicator series ${indicatorId}:`, error);
      }
    }
  }, [chartRef, indicatorSeries]);

  /**
   * 更新指标选择
   */
  const updateIndicators = useCallback((newIndicatorIds) => {
    console.log('🔄 Updating indicators:', newIndicatorIds);

    // 找出需要添加和删除的指标
    const toAdd = newIndicatorIds.filter(id => !activeIndicators.includes(id));
    const toRemove = activeIndicators.filter(id => !newIndicatorIds.includes(id));

    // 删除不再需要的指标
    toRemove.forEach(id => {
      removeIndicatorSeries(id);
    });

    // 创建新的指标系列
    const newSeries = { ...indicatorSeries };
    toRemove.forEach(id => {
      delete newSeries[id];
    });

    toAdd.forEach(id => {
      const series = createIndicatorSeries(id);
      if (series) {
        newSeries[id] = series;
      }
    });

    setIndicatorSeries(newSeries);
    setActiveIndicators(newIndicatorIds);

    // 保存到localStorage（全局配置，不区分时间周期）
    try {
      localStorage.setItem(`indicators_${symbol}`, JSON.stringify(newIndicatorIds));
      console.log('💾 Saved global indicators for', symbol, ':', newIndicatorIds);
    } catch (err) {
      console.warn('Failed to save indicator settings:', err);
    }
  }, [activeIndicators, indicatorSeries, createIndicatorSeries, removeIndicatorSeries, symbol]);

  /**
   * 确保指标系列存在
   */
  const ensureIndicatorSeries = useCallback((indicatorId) => {
    if (indicatorSeries[indicatorId]) {
      return indicatorSeries[indicatorId];
    }
    
    // 系列不存在，尝试创建它
    try {
      console.log(`⚠️ Indicator series ${indicatorId} not found, creating...`);
      const series = createIndicatorSeries(indicatorId);
      if (series) {
        setIndicatorSeries(prev => ({
          ...prev,
          [indicatorId]: series
        }));
        return series;
      }
    } catch (err) {
      console.debug(`Cannot create indicator series ${indicatorId} (chart may be initializing):`, err.message);
    }
    return null;
  }, [indicatorSeries, createIndicatorSeries]);

  /**
   * 设置指标数据（指标不影响K线的显示方式）
   */
  const setIndicatorData = useCallback((indicatorId, data) => {
    if (!data || data.length === 0) return;
    
    const series = ensureIndicatorSeries(indicatorId);
    if (series) {
      try {
        // 直接设置数据，不做任何干预
        // 指标系列已配置为不影响视图（见 createIndicatorSeries）
        series.setData(data);
        console.log(`📈 Set data for indicator ${indicatorId}: ${data.length} points`);
      } catch (error) {
        console.debug(`Cannot set data for indicator ${indicatorId}:`, error.message);
      }
    }
  }, [ensureIndicatorSeries]);

  /**
   * 更新单个指标数据点
   */
  const updateIndicatorPoint = useCallback((indicatorId, dataPoint) => {
    const series = indicatorSeries[indicatorId];
    if (series && dataPoint) {
      try {
        series.update(dataPoint);
      } catch (error) {
        console.error(`❌ Failed to update indicator ${indicatorId}:`, error);
      }
    }
  }, [indicatorSeries]);

  /**
   * 当symbol变化时，从localStorage重新加载指标配置
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`indicators_${symbol}`);
      if (saved) {
        const savedIndicators = JSON.parse(saved);
        if (Array.isArray(savedIndicators)) {
          setActiveIndicators(savedIndicators);
          console.log('📊 Loaded global indicators for', symbol, ':', savedIndicators);
        }
      } else {
        const defaultIndicators = getDefaultIndicators();
        setActiveIndicators(defaultIndicators);
        console.log('📊 No saved config, using default indicators:', defaultIndicators);
      }
    } catch (err) {
      console.warn('Failed to load indicator settings:', err);
    }
  }, [symbol]);

  /**
   * 清理：组件卸载时移除所有指标系列
   */
  useEffect(() => {
    return () => {
      // 使用 ref 获取最新的 indicatorSeries 值
      const currentSeries = indicatorSeriesRef.current;
      if (!chartRef.current || !currentSeries) return;
      
      Object.keys(currentSeries).forEach(id => {
        const series = currentSeries[id];
        if (series) {
          try {
            chartRef.current.removeSeries(series);
            console.log(`🗑️ Cleanup: Removed indicator series ${id}`);
          } catch (error) {
            // 忽略清理时的错误，图表可能已经销毁
            console.debug(`Cleanup: Could not remove series ${id}`, error);
          }
        }
      });
    };
    // 空依赖数组：只在组件卸载时执行清理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // 状态
    activeIndicators,
    indicatorSeries,
    
    // 方法
    updateIndicators,
    setIndicatorData,
    updateIndicatorPoint,
    createIndicatorSeries,
    removeIndicatorSeries
  };
}

