import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * 账户资金曲线图表组件（回测专用）
 * 
 * 展示账户总资金随时间变化
 */
export default function BalanceCurve({ backtestResult }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!backtestResult || !containerRef.current) return;
    
    let chart = null;
    
    try {
      setLoading(true);
      
      // 1. 获取资金曲线数据
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
          mode: 0,
        },
      });
      
      chartRef.current = chart;
      
      // 3. 创建线图系列
      const lineSeries = chart.addLineSeries({
        color: '#4FC3F7',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price) => `$${price.toFixed(2)}`,
        },
      });
      
      // 4. 转换并设置数据
      const chartData = equityCurve.map(point => ({
        time: point.time,
        value: point.balance,  // 账户资金
      }));
      
      lineSeries.setData(chartData);
      
      // 5. 添加初始资金参考线
      const initialLine = chart.addLineSeries({
        color: '#666',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
      });
      
      const initialBalance = backtestResult.initialBalance;
      initialLine.setData([
        { time: equityCurve[0].time, value: initialBalance },
        { time: equityCurve[equityCurve.length - 1].time, value: initialBalance },
      ]);
      
      // 6. 自动调整视图
      chart.timeScale().fitContent();
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to create balance curve:', err);
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
  
  // 计算资金变化
  const initialBalance = backtestResult?.initialBalance || 0;
  const finalBalance = backtestResult?.finalBalance || 0;
  const balanceChange = finalBalance - initialBalance;
  const changeClass = balanceChange >= 0 ? 'text-green-400' : 'text-red-400';
  const changeLabel = `${balanceChange >= 0 ? '+' : ''}$${balanceChange.toFixed(2)}`;
  
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
          💰 账户资金曲线
        </h4>
        <div className={`text-2xl font-bold ${changeClass}`}>
          {changeLabel}
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
            <div className="text-gray-500">交易次数</div>
            <div className="text-white font-semibold">
              {backtestResult.totalTrades}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">胜率</div>
            <div className="text-green-400 font-semibold">
              {(backtestResult.winRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">盈亏比</div>
            <div className="text-blue-400 font-semibold">
              {backtestResult.profitFactor.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">平均持仓</div>
            <div className="text-purple-400 font-semibold">
              {backtestResult.avgHoldingTime.toFixed(0)}h
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

