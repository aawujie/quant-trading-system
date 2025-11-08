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
      <div className="data-stats">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-stats">
        <div className="error-message">⚠️ {error}</div>
        <button onClick={loadStats} className="retry-button">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="data-stats">
      <div className="stats-header">
        <h3>数据库统计信息</h3>
        <button onClick={loadStats} className="refresh-button" title="刷新">
          🔄
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">K线总数</div>
            <div className="stat-value">{formatNumber(stats?.total_klines)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">监控币种</div>
            <div className="stat-value">{stats?.symbols?.length || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-label">时间周期</div>
            <div className="stat-value">{stats?.timeframes?.length || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏪</div>
          <div className="stat-content">
            <div className="stat-label">市场类型</div>
            <div className="stat-value">{stats?.market_types?.length || 0}</div>
          </div>
        </div>
      </div>

      <div className="stats-details">
        <div className="detail-section">
          <h4>📅 数据时间范围</h4>
          <div className="detail-content">
            <div className="detail-item">
              <span className="detail-label">最早数据:</span>
              <span className="detail-value">{formatTimestamp(stats?.earliest_timestamp)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">最新数据:</span>
              <span className="detail-value">{formatTimestamp(stats?.latest_timestamp)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>💰 币种列表 ({stats?.symbols?.length || 0})</h4>
          <div className="detail-content">
            <div className="tag-list">
              {stats?.symbols?.map(symbol => (
                <span key={symbol} className="tag tag-symbol">
                  {symbol}
                </span>
              ))}
              {(!stats?.symbols || stats.symbols.length === 0) && (
                <span className="no-data">暂无数据</span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>⏱️ 时间周期 ({stats?.timeframes?.length || 0})</h4>
          <div className="detail-content">
            <div className="tag-list">
              {stats?.timeframes?.map(tf => (
                <span key={tf} className="tag tag-timeframe">
                  {tf}
                </span>
              ))}
              {(!stats?.timeframes || stats.timeframes.length === 0) && (
                <span className="no-data">暂无数据</span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>🏪 市场类型 ({stats?.market_types?.length || 0})</h4>
          <div className="detail-content">
            <div className="tag-list">
              {stats?.market_types?.map(mt => (
                <span key={mt} className="tag tag-market">
                  {mt === 'spot' ? '现货' : mt === 'future' ? '永续合约' : mt}
                </span>
              ))}
              {(!stats?.market_types || stats.market_types.length === 0) && (
                <span className="no-data">暂无数据</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-footer">
        <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
      </div>
    </div>
  );
}

