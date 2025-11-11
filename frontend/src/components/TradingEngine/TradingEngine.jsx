import { useState } from 'react';
import LiveTrading from './LiveTrading';
import BacktestConfig from './BacktestConfig';
import { TradingEngineProvider, useTradingEngineConfig } from '../../contexts/TradingEngineContext';

/**
 * 交易引擎内容组件 - 处理loading和tab切换
 */
function TradingEngineContent() {
  const [activeTab, setActiveTab] = useState('backtest'); // 'live' | 'backtest'
  const { loading, error } = useTradingEngineConfig();

  // 全局loading
  if (loading) {
    return (
      <div className="w-full h-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <div className="text-xl text-white">加载配置中...</div>
        </div>
      </div>
    );
  }

  // 全局错误
  if (error) {
    return (
      <div className="w-full h-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl text-red-400 mb-2">加载失败</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0a0a0f] overflow-auto">
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="mb-6">
          {/* Tab切换 */}
          <div className="flex gap-2 border-b border-[#2a2a3a]">
            <button
              onClick={() => setActiveTab('backtest')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'backtest'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🔬 策略回测
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'live'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📈 实盘交易
            </button>
          </div>
        </div>

        {/* Tab内容 - 改用CSS控制显示，避免组件重新挂载 */}
        <div className={activeTab === 'backtest' ? 'block' : 'hidden'}>
          <BacktestConfig />
        </div>
        <div className={activeTab === 'live' ? 'block' : 'hidden'}>
          <LiveTrading />
        </div>
      </div>
    </div>
  );
}

/**
 * 交易引擎主组件 - Tailwind风格
 */
export default function TradingEngine() {
  return (
    <TradingEngineProvider>
      <TradingEngineContent />
    </TradingEngineProvider>
  );
}
