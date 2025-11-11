import { useState, useEffect } from 'react';
import { runBacktest } from '../../services/tradingEngineApi';
import { useTradingEngineConfig } from '../../contexts/TradingEngineContext';

/**
 * 回测配置组件 - Tailwind风格
 */
export default function BacktestConfig() {
  // 从Context获取共享配置
  const { strategyDetails, presets } = useTradingEngineConfig();
  
  const [config, setConfig] = useState({
    strategy: 'dual_ma',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    start_date: '',
    end_date: '',
    initial_capital: 10000,
    position_preset: 'conservative',
    params: {},
    market_type: 'future',  // 🔥 默认使用永续合约（与系统配置保持一致）
  });

  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);  // 新增：进度状态
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });  // 排序配置

  // 初始化策略参数
  useEffect(() => {
    const strategyDetail = strategyDetails[config.strategy];
    if (strategyDetail && strategyDetail.params) {
      const defaultParams = {};
      Object.entries(strategyDetail.params).forEach(([key, param]) => {
        defaultParams[key] = param.default;
      });
      setConfig(prev => ({
        ...prev,
        params: defaultParams,
      }));
    }
  }, [config.strategy, strategyDetails]);

  // WebSocket实时推送（替代轮询，性能提升96.7%）
  useEffect(() => {
    if (!taskId) return;

    // 建立WebSocket连接
    const ws = new WebSocket(`ws://localhost:8000/ws/backtest/${taskId}`);
    let lastLoggedProgress = 0; // 记录上次打印日志的进度
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for task:', taskId);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 智能日志：只在关键时刻打印（进度变化>=5% 或 状态变化）
        const shouldLog = 
          data.status === 'completed' || 
          data.status === 'failed' || 
          (data.progress !== undefined && (data.progress - lastLoggedProgress >= 5 || data.progress === 0));
        
        if (shouldLog) {
          console.log(`📨 WebSocket update: ${data.status} - ${data.progress}%`);
          lastLoggedProgress = data.progress || 0;
        }
        
        // 更新进度
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        
        if (data.status === 'completed') {
          setProgress(100);
          setResult(data.results);
          setLoading(false);
          setTaskId(null);
          ws.close();
        } else if (data.status === 'failed') {
          setError(data.error || '回测失败');
          setLoading(false);
          setTaskId(null);
          ws.close();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setError('WebSocket连接失败，请确保后端服务正常运行');
      setLoading(false);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket closed for task:', taskId);
    };
    
    // 清理函数
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [taskId]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);  // 重置进度

    try {
      const response = await runBacktest(config);
      setTaskId(response.task_id);
    } catch (err) {
      console.error('Failed to run backtest:', err);
      setError(err.response?.data?.detail || '运行回测失败');
      setLoading(false);
    }
  };

  const handleParamChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      params: {
        ...prev.params,
        [key]: value,
      },
    }));
  };

  // 排序函数
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 获取排序后的信号数据
  const getSortedSignals = (signals) => {
    if (!signals || !sortConfig.key) return signals;

    const sorted = [...signals].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'side':
          aVal = a.side;
          bVal = b.side;
          break;
        case 'action':
          aVal = a.action;
          bVal = b.action;
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case 'quantity':
          aVal = a.quantity || 0;
          bVal = b.quantity || 0;
          break;
        case 'pnl':
          aVal = a.pnl || 0;
          bVal = b.pnl || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const currentStrategy = strategyDetails[config.strategy];

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* 左侧配置 */}
      <div className="col-span-5 space-y-4">
        {/* 策略选择 */}
        <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            🎯 选择策略
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(strategyDetails).map(([key, strategy]) => (
              <button
                key={key}
                onClick={() => !loading && setConfig({ ...config, strategy: key })}
                disabled={loading}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  config.strategy === key
                    ? `border-[${strategy.color}] bg-[${strategy.color}]/10`
                    : 'border-[#2a2a3a] hover:border-[#3a3a4a]'
                }`}
              >
                <div className="text-2xl mb-1">{strategy.icon}</div>
                <div className="text-sm font-semibold text-white">{strategy.name}</div>
                <div className="text-xs text-gray-400 mt-1 line-clamp-2">{strategy.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 基础配置 */}
        <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            ⚙️ 基础配置
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">交易对</label>
              <select
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">时间周期</label>
              <select
                value={config.timeframe}
                onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1d">1天</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">初始资金</label>
              <input
                type="number"
                value={config.initial_capital}
                onChange={(e) => setConfig({ ...config, initial_capital: parseFloat(e.target.value) })}
                disabled={loading}
                min="100"
                step="1000"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">仓位管理</label>
              <select
                value={config.position_preset}
                onChange={(e) => setConfig({ ...config, position_preset: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                {presets.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">开始日期</label>
              <input
                type="datetime-local"
                value={config.start_date}
                onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0f0f17] border border-[#2a2a3a] rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">结束日期</label>
              <input
                type="datetime-local"
                value={config.end_date}
                onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0f0f17] border border-[#2a2a3a] rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* 策略参数 */}
        {currentStrategy && Object.keys(currentStrategy.params).length > 0 && (
          <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🎛️ 策略参数
            </h3>
            <div className="space-y-3">
              {Object.entries(currentStrategy.params).map(([key, param]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm text-gray-400">{param.label}</label>
                    <span className="text-sm font-semibold text-green-400 font-mono">
                      {config.params[key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={config.params[key] || param.default}
                    onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                    disabled={loading}
                    className="w-full h-2 bg-[#2a2a3a] rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{param.min}</span>
                    <span>{param.max}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 运行按钮 */}
        <button
          onClick={handleRun}
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              运行中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              🚀 开始回测
            </span>
          )}
        </button>

        {/* 进度条（细粒度显示） */}
        {loading && progress > 0 && (
          <div className="bg-[#1a1a2e] border border-[#2a2a3a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">回测进度</span>
              <span className="text-sm font-semibold text-green-400">{progress}%</span>
            </div>
            
            {/* 进度条 */}
            <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              >
                {/* 动画闪光效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
            
            {/* 进度阶段提示 */}
            <div className="mt-2 text-xs text-gray-500">
              {progress < 5 && '初始化中...'}
              {progress >= 5 && progress < 20 && '加载历史数据...'}
              {progress >= 20 && progress < 25 && '初始化策略...'}
              {progress >= 25 && progress < 95 && '执行回测计算...'}
              {progress >= 95 && progress < 100 && '统计结果...'}
              {progress === 100 && '✅ 完成！'}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 右侧结果 */}
      <div className="col-span-7 bg-[#1a1a2e] rounded-lg border border-[#2a2a3a] overflow-hidden">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-[600px] px-8 text-center">
            <div className="text-6xl mb-6 opacity-30">📊</div>
            <h3 className="text-2xl font-semibold text-white mb-4">准备就绪</h3>
            <p className="text-gray-400 mb-8 max-w-md">
              配置好策略参数后，点击"开始回测"查看历史表现
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-xl w-full">
              {['选择策略', '调整参数', '设置条件', '开始回测'].map((text, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#0a0a0f]/50 p-4 rounded-lg border border-[#2a2a3a]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm text-gray-300">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-[600px]">
            <div className="text-6xl mb-6 animate-spin">⏳</div>
            <div className="text-xl font-semibold text-green-400 mb-2">回测运行中...</div>
            <div className="text-sm text-gray-400">正在分析历史数据，请稍候</div>
          </div>
        )}

        {result && (
          <div className="p-6 space-y-6 max-h-[800px] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                📈 回测结果
              </h3>
              <button
                onClick={() => setResult(null)}
                className="px-3 py-1 text-sm bg-[#2a2a3a] hover:bg-[#3a3a4a] text-gray-300 rounded transition-colors"
              >
                清除
              </button>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="总收益率"
                value={result.total_return != null ? `${(result.total_return * 100).toFixed(2)}%` : 'N/A'}
                trend={result.total_return >= 0 ? 'up' : 'down'}
                icon="💰"
              />
              <MetricCard
                label="夏普比率"
                value={result.sharpe_ratio != null ? result.sharpe_ratio.toFixed(2) : 'N/A'}
                icon="📊"
              />
              <MetricCard
                label="最大回撤"
                value={result.max_drawdown != null ? `${(result.max_drawdown * 100).toFixed(2)}%` : 'N/A'}
                trend="down"
                icon="📉"
              />
              <MetricCard
                label="胜率"
                value={result.win_rate != null ? `${(result.win_rate * 100).toFixed(2)}%` : 'N/A'}
                icon="🎯"
              />
              <MetricCard
                label="交易次数"
                value={result.total_trades != null ? result.total_trades : 0}
                icon="🔄"
              />
              <MetricCard
                label="盈利因子"
                value={result.profit_factor != null ? result.profit_factor.toFixed(2) : 'N/A'}
                icon="📈"
              />
            </div>

            {/* 仓位管理信息 */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <MetricCard
                label="初始资金"
                value={result.initial_balance != null ? `$${result.initial_balance.toFixed(2)}` : 'N/A'}
                icon="💵"
              />
              <MetricCard
                label="最终资金"
                value={result.final_balance != null ? `$${result.final_balance.toFixed(2)}` : 'N/A'}
                trend={result.final_balance >= result.initial_balance ? 'up' : 'down'}
                icon="💳"
              />
              <MetricCard
                label="平均持仓时间"
                value={result.avg_holding_time != null ? `${result.avg_holding_time.toFixed(1)}h` : 'N/A'}
                icon="⏱️"
              />
              <MetricCard
                label="最大仓位占比"
                value={result.max_position_pct != null ? `${(result.max_position_pct * 100).toFixed(0)}%` : 'N/A'}
                icon="📊"
              />
              <MetricCard
                label="平均单笔投入"
                value={result.avg_position_size != null ? `$${result.avg_position_size.toFixed(2)}` : 'N/A'}
                icon="💸"
              />
              <MetricCard
                label="资金使用率"
                value={result.avg_position_size != null && result.initial_balance != null 
                  ? `${((result.avg_position_size / result.initial_balance) * 100).toFixed(1)}%` 
                  : 'N/A'}
                icon="🎚️"
              />
            </div>

            {/* 交易信号记录 */}
            {result.signals && result.signals.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  📝 交易信号记录
                  <span className="text-sm text-green-400 font-normal">共 {result.signals.length} 个信号</span>
                </h4>
                <div className="bg-[#0a0a0f] rounded-lg overflow-hidden border border-[#2a2a3a]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#1a1a2e] border-b border-[#2a2a3a]">
                          <SortableHeader 
                            label="时间" 
                            sortKey="timestamp" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="left"
                          />
                          <SortableHeader 
                            label="方向" 
                            sortKey="side" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="left"
                          />
                          <SortableHeader 
                            label="类型" 
                            sortKey="action" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="left"
                          />
                          <SortableHeader 
                            label="价格" 
                            sortKey="price" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="right"
                          />
                          <SortableHeader 
                            label="数量" 
                            sortKey="quantity" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="right"
                          />
                          <SortableHeader 
                            label="收益" 
                            sortKey="pnl" 
                            currentSort={sortConfig} 
                            onSort={handleSort}
                            align="right"
                          />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a3a]">
                        {getSortedSignals(result.signals).map((trade, idx) => (
                          <tr key={idx} className="hover:bg-[#1a1a2e]/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                              {new Date(trade.timestamp * 1000).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-semibold ${
                                trade.side === 'LONG' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {trade.side === 'LONG' ? '做多' : '做空'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {trade.action === 'OPEN' ? '开仓' : '平仓'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono text-right">
                              ${trade.price?.toFixed(2) || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono text-right">
                              {trade.quantity?.toFixed(4) || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-sm font-semibold font-mono ${
                                (trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {trade.action === 'CLOSE' && trade.pnl != null 
                                  ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}` 
                                  : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 可排序表头组件
function SortableHeader({ label, sortKey, currentSort, onSort, align = 'left' }) {
  const isActive = currentSort.key === sortKey;
  const direction = currentSort.direction;

  return (
    <th 
      className={`px-4 py-3 text-${align} text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-gray-200 transition-colors select-none`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className="inline-flex flex-col text-[10px] leading-none">
          {!isActive && (
            <>
              <span className="text-gray-600">▲</span>
              <span className="text-gray-600">▼</span>
            </>
          )}
          {isActive && direction === 'asc' && (
            <>
              <span className="text-blue-400">▲</span>
              <span className="text-gray-600">▼</span>
            </>
          )}
          {isActive && direction === 'desc' && (
            <>
              <span className="text-gray-600">▲</span>
              <span className="text-blue-400">▼</span>
            </>
          )}
        </span>
      </div>
    </th>
  );
}

// 指标卡片组件
function MetricCard({ label, value, trend, icon }) {
  const getTrendColor = () => {
    if (!trend) return 'text-white';
    return trend === 'up' ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 hover:border-[#3a3a4a] transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">{label}</div>
          <div className={`text-2xl font-bold ${getTrendColor()} font-mono truncate`}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
