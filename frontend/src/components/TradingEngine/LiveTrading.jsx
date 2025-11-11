import { useState, useEffect } from 'react';
import { useTradingEngineConfig } from '../../contexts/TradingEngineContext';

/**
 * 实盘交易组件 - Tailwind风格
 */
export default function LiveTrading() {
  // 从Context获取共享配置
  const { strategyDetails, presets, aiConfig } = useTradingEngineConfig();
  
  const [config, setConfig] = useState({
    strategy: 'dual_ma',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    position_preset: 'conservative',
    enable_ai: false,
    params: {},
  });

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

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

  const handleStart = () => {
    setIsRunning(true);
    console.log('Starting live trading with config:', config);
  };

  const handleStop = () => {
    setIsRunning(false);
    console.log('Stopping live trading');
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
        {/* 风险警告 */}
        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-2 border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <div className="text-lg font-semibold text-orange-400 mb-1">实盘交易风险提示</div>
              <div className="text-sm text-orange-300/80 leading-relaxed">
                实盘交易涉及真实资金，存在亏损风险。请确保您已充分测试策略并了解相关风险。
              </div>
            </div>
          </div>
        </div>

        {/* 策略选择 */}
        <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            🎯 选择策略
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(strategyDetails).map(([key, strategy]) => (
              <button
                key={key}
                onClick={() => !isRunning && setConfig({ ...config, strategy: key })}
                disabled={isRunning}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  config.strategy === key
                    ? `border-[${strategy.color}] bg-[${strategy.color}]/10`
                    : 'border-[#2a2a3a] hover:border-[#3a3a4a]'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-2xl mb-1">{strategy.icon}</div>
                <div className="text-sm font-semibold text-white">{strategy.name}</div>
                <div className="text-xs text-gray-400 mt-1 line-clamp-2">{strategy.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 交易配置 */}
        <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            ⚙️ 交易配置
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">交易对</label>
              <select
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                disabled={isRunning}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
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
                disabled={isRunning}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1d">1天</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">仓位管理</label>
              <select
                value={config.position_preset}
                onChange={(e) => setConfig({ ...config, position_preset: e.target.value })}
                disabled={isRunning}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                {presets.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* AI增强 */}
            {aiConfig?.enabled && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enable_ai}
                    onChange={(e) => setConfig({ ...config, enable_ai: e.target.checked })}
                    disabled={isRunning}
                    className="w-4 h-4 text-green-500 bg-[#0a0a0f] border-[#2a2a3a] rounded focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-300">启用AI信号增强</span>
                </label>
                {config.enable_ai && (
                  <div className="mt-2 text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded border border-green-500/20">
                    🤖 使用 {aiConfig.model} 进行信号验证
                  </div>
                )}
              </div>
            )}
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
                    disabled={isRunning}
                    className="w-full h-2 bg-[#2a2a3a] rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
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

        {/* 控制按钮 */}
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              ▶️ 开始实盘交易
            </span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 transition-all"
          >
            <span className="flex items-center justify-center gap-2">
              ⏹️ 停止交易
            </span>
          </button>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 右侧状态 */}
      <div className="col-span-7 bg-[#1a1a2e] rounded-lg border border-[#2a2a3a] overflow-hidden">
        {!isRunning ? (
          <div className="flex flex-col items-center justify-center h-[600px] px-8 text-center">
            <div className="text-6xl mb-6 opacity-30">🚀</div>
            <h3 className="text-2xl font-semibold text-white mb-4">准备启动</h3>
            <p className="text-gray-400 mb-8 max-w-md">
              配置好策略参数后，点击"开始实盘交易"启动自动化交易
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-xl w-full">
              {[
                { icon: '✅', text: '实时监控市场数据' },
                { icon: '✅', text: '自动执行交易策略' },
                { icon: '✅', text: '智能仓位管理' },
                { icon: '✅', text: '风险控制保护' },
                ...(aiConfig?.enabled ? [{ icon: '✅', text: 'AI信号验证增强' }] : [])
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#0a0a0f]/50 p-4 rounded-lg border border-[#2a2a3a]">
                  <span className="text-xl">{feature.icon}</span>
                  <span className="text-sm text-gray-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[800px] overflow-y-auto">
            {/* 状态头部 */}
            <div className="flex justify-between items-center pb-4 border-b border-[#2a2a3a]">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm text-green-400 font-semibold">策略运行中</span>
              </div>
              <div className="text-sm text-gray-400 font-mono">
                运行时间: 00:00:00
              </div>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-3 gap-4">
              <StatusCard label="当前持仓" value="无持仓" icon="📊" />
              <StatusCard label="今日收益" value="+0.00%" icon="💰" color="text-green-400" />
              <StatusCard label="今日交易" value="0 笔" icon="🔄" />
              <StatusCard label="信号数量" value="0" icon="📡" />
              <StatusCard label="胜率" value="0.00%" icon="🎯" />
              <StatusCard label="总收益" value="+0.00 USDT" icon="💵" color="text-green-400" />
            </div>

            {/* 持仓信息 */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                📈 当前持仓
              </h4>
              <div className="bg-[#0a0a0f] rounded-lg border border-[#2a2a3a] p-8 text-center">
                <div className="text-4xl mb-2 opacity-30">💤</div>
                <div className="text-sm text-gray-400">暂无持仓</div>
              </div>
            </div>

            {/* 实时日志 */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                📝 实时日志
              </h4>
              <div className="bg-[#0a0a0f] rounded-lg border border-[#2a2a3a] p-4 max-h-[300px] overflow-y-auto space-y-2">
                <LogEntry
                  time={new Date().toLocaleTimeString('zh-CN')}
                  message="策略启动成功"
                  type="success"
                />
                <LogEntry
                  time={new Date().toLocaleTimeString('zh-CN')}
                  message={`开始监控 ${config.symbol} ${config.timeframe}`}
                  type="info"
                />
                <LogEntry
                  time={new Date().toLocaleTimeString('zh-CN')}
                  message="等待交易信号..."
                  type="info"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 状态卡片组件
function StatusCard({ label, value, icon, color = 'text-white' }) {
  return (
    <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 hover:border-[#3a3a4a] transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">{label}</div>
          <div className={`text-xl font-bold ${color} font-mono truncate`}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

// 日志条目组件
function LogEntry({ time, message, type = 'info' }) {
  const getTypeColor = () => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-orange-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="flex gap-3 text-sm py-2 border-b border-[#2a2a3a] last:border-0">
      <span className="text-gray-500 font-mono text-xs min-w-[80px]">{time}</span>
      <span className={getTypeColor()}>{message}</span>
    </div>
  );
}
