import { useState, useEffect } from 'react';
import { runBacktest, getBacktestResult, getPositionPresets, getStrategies } from '../../services/tradingEngineApi';

/**
 * 回测配置组件 - Tailwind风格
 */
export default function BacktestConfig() {
  const [config, setConfig] = useState({
    strategy: 'dual_ma',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    start_date: '',
    end_date: '',
    initial_capital: 10000,
    position_preset: 'conservative',
    params: {},
  });

  const [strategies, setStrategies] = useState([]);
  const [strategyDetails, setStrategyDetails] = useState({});
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 加载策略和预设
  useEffect(() => {
    const loadData = async () => {
      try {
        const [strategiesData, presetsData] = await Promise.all([
          getStrategies().catch(() => []),
          getPositionPresets().catch(() => []),
        ]);
        
        if (strategiesData && strategiesData.length > 0) {
          setStrategies(strategiesData);
          
          // 转换策略格式
          const details = {};
          strategiesData.forEach(strategy => {
            details[strategy.name] = {
              name: strategy.display_name || strategy.name,
              description: strategy.description || '',
              icon: strategy.icon || '📊',
              color: strategy.color || '#4CAF50',
              params: strategy.parameters || {}
            };
          });
          setStrategyDetails(details);
        }
        
        if (presetsData && Array.isArray(presetsData) && presetsData.length > 0) {
          setPresets(presetsData);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

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

  // 轮询获取回测结果
  useEffect(() => {
    if (!taskId) return;

    const pollResult = async () => {
      try {
        const data = await getBacktestResult(taskId);
        
        if (data.status === 'completed') {
          setResult(data.result);
          setLoading(false);
          setTaskId(null);
        } else if (data.status === 'failed') {
          setError(data.error || '回测失败');
          setLoading(false);
          setTaskId(null);
        }
      } catch (err) {
        console.error('Failed to get result:', err);
      }
    };

    const interval = setInterval(pollResult, 1000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

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
                type="date"
                value={config.start_date}
                onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">结束日期</label>
              <input
                type="date"
                value={config.end_date}
                onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none"
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
                value={`${(result.total_return * 100).toFixed(2)}%`}
                trend={result.total_return >= 0 ? 'up' : 'down'}
                icon="💰"
              />
              <MetricCard
                label="夏普比率"
                value={result.sharpe_ratio?.toFixed(2) || 'N/A'}
                icon="📊"
              />
              <MetricCard
                label="最大回撤"
                value={`${(result.max_drawdown * 100).toFixed(2)}%`}
                trend="down"
                icon="📉"
              />
              <MetricCard
                label="胜率"
                value={`${(result.win_rate * 100).toFixed(2)}%`}
                icon="🎯"
              />
              <MetricCard
                label="交易次数"
                value={result.total_trades}
                icon="🔄"
              />
              <MetricCard
                label="盈利因子"
                value={result.profit_factor?.toFixed(2) || 'N/A'}
                icon="📈"
              />
            </div>

            {/* 交易记录 */}
            {result.trades && result.trades.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  📝 交易记录
                  <span className="text-sm text-green-400 font-normal">共 {result.trades.length} 笔</span>
                </h4>
                <div className="bg-[#0a0a0f] rounded-lg overflow-hidden border border-[#2a2a3a]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#1a1a2e] border-b border-[#2a2a3a]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">时间</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">方向</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">类型</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">价格</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">数量</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">收益</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a3a]">
                        {result.trades.map((trade, idx) => (
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
                              ${trade.price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono text-right">
                              {trade.quantity.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-sm font-semibold font-mono ${
                                trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2) || '-'}
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
