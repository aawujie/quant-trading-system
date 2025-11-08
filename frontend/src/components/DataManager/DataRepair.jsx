import { useState } from 'react';
import { checkDataStatus, triggerDataRepair } from '../../services/dataRepairApi';

export default function DataRepair() {
  const [formData, setFormData] = useState({
    symbols: ['BTCUSDT', 'ETHUSDT'],
    timeframes: ['1h'],
    days: 7,
    marketType: 'future'
  });

  const [statusData, setStatusData] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [message, setMessage] = useState(null);

  const availableSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT'];
  const availableTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];
  const availableDays = [1, 3, 7, 14, 30, 60, 90];

  const toggleSymbol = (symbol) => {
    setFormData(prev => {
      const symbols = prev.symbols.includes(symbol)
        ? prev.symbols.filter(s => s !== symbol)
        : [...prev.symbols, symbol];
      return { ...prev, symbols };
    });
  };

  const toggleTimeframe = (timeframe) => {
    setFormData(prev => {
      const timeframes = prev.timeframes.includes(timeframe)
        ? prev.timeframes.filter(t => t !== timeframe)
        : [...prev.timeframes, timeframe];
      return { ...prev, timeframes };
    });
  };

  const handleCheckStatus = async () => {
    if (formData.symbols.length === 0 || formData.timeframes.length === 0) {
      setMessage({ type: 'error', text: '请至少选择一个币种和一个时间周期' });
      return;
    }

    setIsChecking(true);
    setMessage(null);

    try {
      const result = await checkDataStatus({
        symbols: formData.symbols.join(','),
        timeframes: formData.timeframes.join(','),
        days: formData.days,
        marketType: formData.marketType
      });

      setStatusData(result.data);
      setMessage({ type: 'success', text: '✅ 检查完成' });
    } catch (err) {
      console.error('Failed to check data status:', err);
      setMessage({ type: 'error', text: `检查失败: ${err.message}` });
    } finally {
      setIsChecking(false);
    }
  };

  const handleRepair = async () => {
    if (formData.symbols.length === 0 || formData.timeframes.length === 0) {
      setMessage({ type: 'error', text: '请至少选择一个币种和一个时间周期' });
      return;
    }

    setIsRepairing(true);
    setMessage(null);

    try {
      const result = await triggerDataRepair({
        symbols: formData.symbols.join(','),
        timeframes: formData.timeframes.join(','),
        days: formData.days,
        marketType: formData.marketType
      });

      setMessage({ type: 'success', text: '✅ 修复任务已启动，正在后台执行...' });
      
      // 5秒后自动重新检查状态
      setTimeout(() => {
        handleCheckStatus();
      }, 5000);
    } catch (err) {
      console.error('Failed to trigger repair:', err);
      setMessage({ type: 'error', text: `修复失败: ${err.message}` });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 配置表单 */}
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">修复配置</h3>

        <div className="space-y-4">
          {/* 币种选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择币种 ({formData.symbols.length} 个)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSymbols.map(symbol => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    formData.symbols.includes(symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* 时间周期选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择时间周期 ({formData.timeframes.length} 个)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTimeframes.map(timeframe => (
                <button
                  key={timeframe}
                  type="button"
                  onClick={() => toggleTimeframe(timeframe)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    formData.timeframes.includes(timeframe)
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                  }`}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>

          {/* 检查天数 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              检查最近天数
            </label>
            <div className="flex flex-wrap gap-2">
              {availableDays.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, days }))}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    formData.days === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                  }`}
                >
                  {days}天
                </button>
              ))}
            </div>
          </div>

          {/* 市场类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              市场类型
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, marketType: 'spot' }))}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  formData.marketType === 'spot'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                }`}
              >
                现货
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, marketType: 'future' }))}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  formData.marketType === 'future'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                }`}
              >
                永续合约
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
            >
              {isChecking ? '检查中...' : '🔍 检查状态'}
            </button>
            <button
              onClick={handleRepair}
              disabled={isRepairing}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
            >
              {isRepairing ? '修复中...' : '🔧 开始修复'}
            </button>
          </div>

          {/* 消息提示 */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-600/20 border border-green-600/30 text-green-400'
                  : 'bg-red-600/20 border border-red-600/30 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* 状态报告 */}
      {statusData && (
        <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">数据状态报告</h3>
          <div className="space-y-3">
            {Object.entries(statusData).map(([key, data]) => {
              const [symbol, timeframe] = key.split('_');
              const isComplete = data.status === 'complete';
              const hasIssues = data.kline_gaps > 0 || data.indicator_gaps > 0;

              return (
                <div
                  key={key}
                  className={`bg-[#0f0f17] border rounded-lg p-4 ${
                    isComplete
                      ? 'border-green-600/30'
                      : 'border-yellow-600/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{symbol}</span>
                      <span className="px-2 py-0.5 bg-[#2a2a3a] rounded text-xs text-gray-300">
                        {timeframe}
                      </span>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isComplete
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-yellow-600/20 text-yellow-400'
                      }`}
                    >
                      {isComplete ? '✅ 完整' : '⚠️ 有缺失'}
                    </div>
                  </div>

                  {hasIssues && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {data.kline_gaps > 0 && (
                        <div className="text-yellow-400">
                          📊 K线缺失: {data.kline_gaps} 段 ({data.kline_missing_count || '?'} 根)
                        </div>
                      )}
                      {data.indicator_gaps > 0 && (
                        <div className="text-yellow-400">
                          📈 指标缺失: {data.indicator_gaps} 个
                        </div>
                      )}
                    </div>
                  )}

                  {isComplete && (
                    <div className="text-sm text-green-400">
                      所有数据完整，无需修复
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <h3 className="text-lg font-semibold text-white mb-3">💡 使用说明</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong className="text-gray-300">检查状态</strong>：扫描数据库，识别缺失的K线和指标</p>
          <p>• <strong className="text-gray-300">开始修复</strong>：自动从交易所获取缺失数据并重新计算指标</p>
          <p>• <strong className="text-gray-300">推荐检查天数</strong>：1-7天（快速），30-90天（全面）</p>
          <p>• <strong className="text-gray-300">修复时长</strong>：1天约2秒，7天约15秒，30天约1分钟</p>
          <p className="pt-2 border-t border-[#2a2a3a] text-yellow-400">
            ⚠️ 修复任务在后台执行，不会影响正常使用
          </p>
        </div>
      </div>
    </div>
  );
}

