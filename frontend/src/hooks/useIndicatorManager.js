import { useState, useCallback, useEffect } from 'react';
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
  // 当前激活的指标列表
  const [activeIndicators, setActiveIndicators] = useState(() => getDefaultIndicators());
  
  // 指标系列对象缓存（存储TradingView的line series）
  const [indicatorSeries, setIndicatorSeries] = useState({});

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
        crosshairMarkerVisible: true
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

    // 保存到localStorage
    try {
      localStorage.setItem(`indicators_${symbol}_${timeframe}`, JSON.stringify(newIndicatorIds));
    } catch (err) {
      console.warn('Failed to save indicator settings:', err);
    }
  }, [activeIndicators, indicatorSeries, createIndicatorSeries, removeIndicatorSeries, symbol, timeframe]);

  /**
   * 设置指标数据
   */
  const setIndicatorData = useCallback((indicatorId, data) => {
    const series = indicatorSeries[indicatorId];
    if (series && data && data.length > 0) {
      try {
        series.setData(data);
        console.log(`📈 Set data for indicator ${indicatorId}: ${data.length} points`);
      } catch (error) {
        console.error(`❌ Failed to set data for indicator ${indicatorId}:`, error);
      }
    }
  }, [indicatorSeries]);

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
   * 从localStorage加载指标配置
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`indicators_${symbol}_${timeframe}`);
      if (saved) {
        const savedIndicators = JSON.parse(saved);
        setActiveIndicators(savedIndicators);
      }
    } catch (err) {
      console.warn('Failed to load indicator settings:', err);
    }
  }, [symbol, timeframe]);

  /**
   * 清理：图表销毁时移除所有指标系列
   */
  useEffect(() => {
    return () => {
      Object.keys(indicatorSeries).forEach(id => {
        removeIndicatorSeries(id);
      });
    };
  }, [indicatorSeries, removeIndicatorSeries]);

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

