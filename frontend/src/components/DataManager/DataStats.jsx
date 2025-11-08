import { useState, useEffect } from 'react';
import { getDataStats } from '../../services/dataManagerApi';

export default function DataStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
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

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">数据库统计</h3>
          <button 
            onClick={loadStats} 
            className="px-3 py-1.5 bg-[#0f0f17] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-md text-sm text-gray-300 transition-colors"
            title="刷新"
          >
            🔄 刷新
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
            <div className="text-3xl mb-1">📊</div>
            <div className="text-sm text-gray-400 mb-1">K线总数</div>
            <div className="text-2xl font-bold text-white">{formatNumber(stats?.total_klines)}</div>
          </div>

          <div className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-xs text-gray-400 mb-1">币种</div>
            <div className="text-xl font-semibold text-white">{stats?.symbols?.length || 0}</div>
          </div>

          <div className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">⏱️</div>
            <div className="text-xs text-gray-400 mb-1">周期</div>
            <div className="text-xl font-semibold text-white">{stats?.timeframes?.length || 0}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">📅 时间范围</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">最早:</span>
                <span className="text-gray-200">{formatTimestamp(stats?.earliest_timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">最新:</span>
                <span className="text-gray-200">{formatTimestamp(stats?.latest_timestamp)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">💰 币种 ({stats?.symbols?.length || 0})</h4>
            <div className="flex flex-wrap gap-1.5">
              {stats?.symbols?.map(symbol => (
                <span key={symbol} className="px-2 py-1 bg-[#0f0f17] border border-[#2a2a3a] rounded text-xs text-gray-200">
                  {symbol}
                </span>
              ))}
              {(!stats?.symbols || stats.symbols.length === 0) && (
                <span className="text-xs text-gray-500">暂无数据</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">⏱️ 周期 ({stats?.timeframes?.length || 0})</h4>
            <div className="flex flex-wrap gap-1.5">
              {stats?.timeframes?.map(tf => (
                <span key={tf} className="px-2 py-1 bg-[#0f0f17] border border-[#2a2a3a] rounded text-xs text-gray-200">
                  {tf}
                </span>
              ))}
              {(!stats?.timeframes || stats.timeframes.length === 0) && (
                <span className="text-xs text-gray-500">暂无数据</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">🏪 市场 ({stats?.market_types?.length || 0})</h4>
            <div className="flex flex-wrap gap-1.5">
              {stats?.market_types?.map(mt => (
                <span key={mt} className="px-2 py-1 bg-[#0f0f17] border border-[#2a2a3a] rounded text-xs text-gray-200">
                  {mt === 'spot' ? '现货' : mt === 'future' ? '永续合约' : mt}
                </span>
              ))}
              {(!stats?.market_types || stats.market_types.length === 0) && (
                <span className="text-xs text-gray-500">暂无数据</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center pt-4 border-t border-[#2a2a3a]">
          最后更新: {new Date().toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}

