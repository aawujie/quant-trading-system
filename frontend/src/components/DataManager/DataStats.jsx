import { useState, useEffect } from 'react';
import { getDataStats } from '../../services/dataManagerApi';

export default function DataStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('future'); // 'spot' or 'future'

  useEffect(() => {
    loadStats();
    
    // 每10秒刷新一次统计
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await getDataStats();
      if (response.status === 'success') {
        setStats(response.stats);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('加载统计信息失败');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString('zh-CN');
  };

  if (loading && !stats) {
    return (
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <div className="text-center text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <div className="text-red-400 mb-4">⚠️ {error}</div>
        <button 
          onClick={loadStats} 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  // 统计指标种类数
  const getUniqueIndicatorCount = () => {
    const indicatorNames = new Set();
    if (!stats?.by_market) return 0;
    
    Object.values(stats.by_market).forEach(marketData => {
      Object.values(marketData).forEach(symbolData => {
        if (symbolData.timeframes) {
          Object.values(symbolData.timeframes).forEach(tfData => {
            if (tfData.indicators) {
              Object.keys(tfData.indicators).forEach(indicatorName => {
                indicatorNames.add(indicatorName);
              });
            }
          });
        }
      });
    });
    
    return indicatorNames.size;
  };

  const renderSymbolStats = (marketType) => {
    const marketData = stats?.by_market?.[marketType];
    if (!marketData || Object.keys(marketData).length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          暂无{marketType === 'spot' ? '现货' : '合约'}数据
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(marketData).map(([symbol, symbolData]) => (
          <div key={symbol} className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-4">
            {/* Symbol 标题 */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#2a2a3a]">
              <h4 className="text-lg font-semibold text-white">
                {symbol}
              </h4>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400">
                  K线: {formatNumber(symbolData.total_klines)}
                </span>
              </div>
            </div>

            {/* 时间周期列表 */}
            <div className="space-y-2">
              {symbolData.timeframes && Object.entries(symbolData.timeframes).map(([timeframe, tfData]) => (
                <div key={timeframe} className="border border-[#2a2a3a] rounded-lg p-3">
                  {/* 时间周期、K线数量、时间范围 - 同一行 */}
                  {tfData.klines && (
                    <div className="flex items-center gap-3 mb-2 text-sm">
                      <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded font-mono text-red-400 font-semibold">
                        {timeframe}
                      </span>
                      <span className="text-gray-400">
                        {formatNumber(tfData.klines.count)} 根K线
                      </span>
                      <span className="text-gray-600">|</span>
                      <span className="text-xs text-gray-400">📅</span>
                      <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 font-semibold">
                        {tfData.klines.earliest_time || 'N/A'}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400 font-semibold">
                        {tfData.klines.latest_time || 'N/A'}
                      </span>
                    </div>
                  )}

                  {/* 指标详情 - 细分到每个指标 */}
                  {tfData.indicators && Object.keys(tfData.indicators).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(tfData.indicators).map(([indicatorName, count]) => (
                        <span 
                          key={indicatorName}
                          className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400"
                        >
                          {indicatorName}: {formatNumber(count)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">⚠️ 暂无指标数据</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">数据库统计</h3>
        </div>

        {/* 总览卡片 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-xs text-gray-400 mb-1">交易对</div>
            <div className="text-xl font-semibold text-white">{stats?.symbols?.length || 0}</div>
          </div>

          <div className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">⏱️</div>
            <div className="text-xs text-gray-400 mb-1">时间周期</div>
            <div className="text-xl font-semibold text-white">{stats?.timeframes?.length || 0}</div>
          </div>

          <div className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xs text-gray-400 mb-1">指标种类</div>
            <div className="text-xl font-semibold text-white">{getUniqueIndicatorCount()}</div>
          </div>
        </div>

        {/* 市场类型切换标签 */}
        <div className="flex gap-2 mb-4 border-b border-[#2a2a3a]">
          <button
            onClick={() => setActiveTab('future')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'future'
                ? 'text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            🔮 永续合约
            {activeTab === 'future' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('spot')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'spot'
                ? 'text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            💎 现货市场
            {activeTab === 'spot' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
            )}
          </button>
        </div>

        {/* 市场数据展示 */}
        {renderSymbolStats(activeTab)}

        <div className="text-xs text-gray-500 text-center pt-4 mt-4 border-t border-[#2a2a3a]">
          最后更新: {new Date().toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
