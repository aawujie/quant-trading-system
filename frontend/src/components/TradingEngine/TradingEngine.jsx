import { useState } from 'react';
import LiveTrading from './LiveTrading';
import BacktestConfig from './BacktestConfig';

/**
 * 交易引擎主组件 - Tailwind风格
 */
export default function TradingEngine() {
  const [activeTab, setActiveTab] = useState('backtest'); // 'live' | 'backtest'

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

        {/* Tab内容 */}
        {activeTab === 'backtest' && <BacktestConfig />}
        {activeTab === 'live' && <LiveTrading />}
      </div>
    </div>
  );
}
