import { useState, useEffect } from 'react';

/**
 * 策略列表组件
 * 显示所有交易策略及其状态、参数和最新信号
 */
export default function StrategyList({ symbol, strategies, signals, onStrategyToggle }) {
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  
  // 辅助函数：判断信号是否为做多信号
  const isLongSignal = (signalType) => {
    return ['BUY', 'OPEN_LONG', 'CLOSE_SHORT'].includes(signalType);
  };

  const getStrategyIcon = (strategyName) => {
    const iconMap = {
      'dual_ma': '📊',
      'macd': '📈',
      'rsi': '📉',
      'bollinger': '🎯'
    };
    return iconMap[strategyName] || '⚡';
  };

  const getStrategyDisplayName = (strategyName) => {
    const nameMap = {
      'dual_ma': '双均线策略',
      'macd': 'MACD策略',
      'rsi': 'RSI策略',
      'bollinger': '布林带策略'
    };
    return nameMap[strategyName] || strategyName;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStrategySignals = (strategyName) => {
    return signals.filter(s => s.strategy_name === strategyName).slice(0, 5);
  };

  const toggleStrategy = (strategyName) => {
    if (expandedStrategy === strategyName) {
      setExpandedStrategy(null);
    } else {
      setExpandedStrategy(strategyName);
    }
  };

  if (strategies.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>⚡</span>
        <p style={styles.emptyText}>暂无策略</p>
        <p style={styles.emptyHint}>等待策略加载...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {strategies.map((strategy) => {
          const strategySignals = getStrategySignals(strategy.name);
          const lastSignal = strategySignals[0];
          const isExpanded = expandedStrategy === strategy.name;
          
          return (
            <div key={strategy.name} style={styles.strategyCard}>
              {/* 策略头部 */}
              <div 
                style={styles.strategyHeader}
                onClick={() => toggleStrategy(strategy.name)}
              >
                <div style={styles.strategyInfo}>
                  <div style={styles.strategyTitle}>
                    <span style={styles.strategyIcon}>
                      {getStrategyIcon(strategy.name)}
                    </span>
                    <span style={styles.strategyName}>
                      {getStrategyDisplayName(strategy.name)}
                    </span>
                  </div>
                  
                  {/* 状态指示器 */}
                  <div style={styles.strategyStatus}>
                    <span style={{
                      ...styles.statusDot,
                      backgroundColor: strategy.enabled ? '#26a69a' : '#666'
                    }}></span>
                    <span style={styles.statusText}>
                      {strategy.enabled ? '运行中' : '已停止'}
                    </span>
                  </div>
                </div>
                
                <button
                  style={styles.expandButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStrategy(strategy.name);
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              </div>

              {/* 最新信号（折叠时显示） */}
              {!isExpanded && lastSignal && (
                <div style={styles.lastSignal}>
                  <span style={{
                    ...styles.signalBadge,
                    backgroundColor: isLongSignal(lastSignal.signal_type) ? '#26a69a' : '#ef5350'
                  }}>
                    {lastSignal.signal_type}
                  </span>
                  {lastSignal.side && (
                    <span style={styles.signalSide}>
                      {lastSignal.side} {lastSignal.action}
                    </span>
                  )}
                  <span style={styles.signalPrice}>${lastSignal.price.toFixed(2)}</span>
                  <span style={styles.signalTime}>{formatTime(lastSignal.timestamp)}</span>
                </div>
              )}

              {/* 展开内容 */}
              {isExpanded && (
                <div style={styles.strategyDetails}>
                  {/* 策略参数 */}
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>参数配置</div>
                    <div style={styles.params}>
                      {Object.entries(strategy.params || {}).map(([key, value]) => (
                        <div key={key} style={styles.paramItem}>
                          <span style={styles.paramKey}>{key}:</span>
                          <span style={styles.paramValue}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 最新信号列表 */}
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>
                      最新信号 ({strategySignals.length})
                    </div>
                    <div style={styles.signals}>
                      {strategySignals.map((signal, idx) => (
                        <div key={idx} style={styles.signalItem}>
                          <div style={styles.signalHeader}>
                            <span style={{
                              ...styles.signalBadge,
                              backgroundColor: isLongSignal(signal.signal_type) ? '#26a69a' : '#ef5350'
                            }}>
                              {signal.signal_type}
                            </span>
                            {signal.side && (
                              <span style={styles.signalSide}>
                                {signal.side} {signal.action}
                              </span>
                            )}
                            <span style={styles.signalPrice}>${signal.price.toFixed(2)}</span>
                          </div>
                          <div style={styles.signalMeta}>
                            <span style={styles.signalTime}>{formatTime(signal.timestamp)}</span>
                          </div>
                          {signal.reason && (
                            <div style={styles.signalReason}>{signal.reason}</div>
                          )}
                        </div>
                      ))}
                      {strategySignals.length === 0 && (
                        <div style={styles.noSignals}>暂无信号</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
  },
  
  // 策略卡片
  strategyCard: {
    marginBottom: '0.75rem',
    backgroundColor: '#35354a',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #3a3a4a',
  },
  strategyHeader: {
    padding: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  strategyInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  strategyTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  strategyIcon: {
    fontSize: '1.2rem',
  },
  strategyName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#d1d4dc',
  },
  strategyStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '0.75rem',
    color: '#9ca3b0',
  },
  expandButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3b0',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
  },
  
  // 最新信号（折叠状态）
  lastSignal: {
    padding: '0.5rem 0.75rem',
    borderTop: '1px solid #3a3a4a',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
  },
  signalBadge: {
    padding: '0.15rem 0.4rem',
    borderRadius: '3px',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: 'white',
  },
  signalPrice: {
    fontWeight: '600',
    color: '#d1d4dc',
  },
  signalTime: {
    color: '#9ca3b0',
    fontSize: '0.75rem',
  },
  signalSide: {
    fontSize: '0.7rem',
    color: '#9ca3b0',
    backgroundColor: '#3a3a4a',
    padding: '0.125rem 0.375rem',
    borderRadius: '3px',
    fontWeight: '500',
    marginLeft: '0.25rem',
  },
  
  // 展开的详情
  strategyDetails: {
    borderTop: '1px solid #3a3a4a',
    backgroundColor: '#2b2b43',
  },
  section: {
    padding: '0.75rem',
    borderBottom: '1px solid #3a3a4a',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#9ca3b0',
    marginBottom: '0.5rem',
  },
  
  // 参数
  params: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  paramItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
  },
  paramKey: {
    color: '#9ca3b0',
  },
  paramValue: {
    color: '#d1d4dc',
    fontWeight: '500',
  },
  
  // 信号列表
  signals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  signalItem: {
    padding: '0.5rem',
    backgroundColor: '#35354a',
    borderRadius: '4px',
    fontSize: '0.8rem',
  },
  signalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  signalMeta: {
    display: 'flex',
    gap: '0.5rem',
  },
  signalReason: {
    marginTop: '0.35rem',
    fontSize: '0.75rem',
    color: '#9ca3b0',
    fontStyle: 'italic',
  },
  noSignals: {
    textAlign: 'center',
    padding: '1rem',
    color: '#9ca3b0',
    fontSize: '0.8rem',
  },
  
  // 空状态
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#9ca3b0',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '0.95rem',
    fontWeight: '500',
    marginBottom: '0.25rem',
  },
  emptyHint: {
    fontSize: '0.8rem',
    opacity: 0.7,
  },
};

