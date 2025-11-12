import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * 收益率曲线图表组件（回测专用）
 * 
 * 展示累计收益率随时间变化
 */
export default function EquityCurve({ backtestResult }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!backtestResult || !containerRef.current) return;
    
    let chart = null;
    
    try {
      setLoading(true);
      
      // 1. 获取收益率曲线数据
      const equityCurve = backtestResult.getEquityCurve();
      
      if (!equityCurve || equityCurve.length === 0) {
        setLoading(false);
        return;
      }
      
      // 2. 创建图表
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 250,
        layout: {
          background: { color: '#0a0a0f' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#1a1a2e' },
          horzLines: { color: '#1a1a2e' },
        },
        crosshair: {
          mode: 0,
        },
        timeScale: {
          borderColor: '#2a2a3a',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#2a2a3a',
          // 自定义价格格式（显示百分比）
          mode: 0,
        },
      });
      
      chartRef.current = chart;
      
      // 3. 创建区域系列（带填充）
      const areaSeries = chart.addAreaSeries({
        topColor: backtestResult.totalReturn >= 0 ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
        bottomColor: backtestResult.totalReturn >= 0 ? 'rgba(38, 166, 154, 0.0)' : 'rgba(239, 83, 80, 0.0)',
        lineColor: backtestResult.totalReturn >= 0 ? '#26a69a' : '#ef5350',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
        },
      });
      
      // 4. 转换并设置数据
      const chartData = equityCurve.map(point => ({
        time: point.time,
        value: point.return,  // 收益率百分比
      }));
      
      areaSeries.setData(chartData);
      
      // 5. 添加零线（参考线）
      const zeroLine = chart.addLineSeries({
        color: '#666',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      zeroLine.setData([
        { time: equityCurve[0].time, value: 0 },
        { time: equityCurve[equityCurve.length - 1].time, value: 0 },
      ]);
      
      // 6. 自动调整视图
      chart.timeScale().fitContent();
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to create equity curve:', err);
      setLoading(false);
    }
    
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
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, [backtestResult]);
  
  // 计算最终收益率
  const finalReturn = backtestResult?.totalReturn || 0;
  const returnClass = finalReturn >= 0 ? 'text-green-400' : 'text-red-400';
  const returnLabel = `${finalReturn >= 0 ? '+' : ''}${(finalReturn * 100).toFixed(2)}%`;
  
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
          📈 累计收益率曲线
        </h4>
        <div className={`text-2xl font-bold ${returnClass}`}>
          {returnLabel}
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-[250px]">
          <div className="text-sm text-gray-400">加载中...</div>
        </div>
      ) : (
        <div ref={containerRef} />
      )}
      
      {/* 统计信息 */}
      {!loading && backtestResult && (
        <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
          <div className="text-center">
            <div className="text-gray-500">初始资金</div>
            <div className="text-white font-semibold">
              ${backtestResult.initialBalance.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">最终资金</div>
            <div className={`font-semibold ${returnClass}`}>
              ${backtestResult.finalBalance.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">最大回撤</div>
            <div className="text-red-400 font-semibold">
              {(backtestResult.maxDrawdown * 100).toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">夏普比率</div>
            <div className="text-blue-400 font-semibold">
              {backtestResult.sharpeRatio.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

