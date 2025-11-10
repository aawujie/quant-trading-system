import { useState, useEffect } from 'react';
import { runBacktest, getBacktestResult, getPositionPresets, getStrategies } from '../../services/tradingEngineApi';

/**
 * 回测配置组件 - PC端优化版
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
  const [strategyDetails, setStrategyDetails] = useState({}); // 从后端加载
  const [presets, setPresets] = useState([]); // 从后端加载仓位管理预设
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 加载策略列表和预设
  useEffect(() => {
    const loadData = async () => {
      try {
        const [strategiesData, presetsData] = await Promise.all([
          getStrategies().catch(() => []),
          getPositionPresets().catch(() => []),
        ]);
        
        if (strategiesData && strategiesData.length > 0) {
          setStrategies(strategiesData);
          
          // 将策略数据转换为 strategyDetails 格式
          const details = {};
          strategiesData.forEach(strategy => {
            details[strategy.name] = {
              name: strategy.display_name,
              description: strategy.description,
              icon: strategy.icon,
              color: strategy.color,
              params: strategy.parameters
            };
          });
          setStrategyDetails(details);
        }
        
        if (presetsData && Array.isArray(presetsData) && presetsData.length > 0) {
          setPresets(presetsData);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        // 不设置error，使用默认值继续运行
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
    <div style={styles.container}>
      {/* 左侧：配置面板 */}
      <div style={styles.leftPanel}>
        {/* 策略选择 - 卡片式 */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>🎯</span>
            选择策略
          </h3>
          <div style={styles.strategyGrid}>
            {Object.entries(strategyDetails).map(([key, strategy]) => (
              <div
                key={key}
                style={{
                  ...styles.strategyCard,
                  ...(config.strategy === key ? {
                    ...styles.strategyCardActive,
                    borderColor: strategy.color,
                    background: `linear-gradient(135deg, ${strategy.color}15, ${strategy.color}05)`,
                  } : {}),
                }}
                onClick={() => !loading && setConfig({ ...config, strategy: key })}
              >
                <div style={styles.strategyIcon}>{strategy.icon}</div>
                <div style={styles.strategyInfo}>
                  <div style={styles.strategyName}>{strategy.name}</div>
                  <div style={styles.strategyDesc}>{strategy.description}</div>
                </div>
                {config.strategy === key && (
                  <div style={{...styles.strategyCheck, color: strategy.color}}>✓</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 基础配置 */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>⚙️</span>
            基础配置
          </h3>
          <div style={styles.configGrid}>
            <div style={styles.configItem}>
              <label style={styles.label}>交易对</label>
              <select
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                style={styles.select}
                disabled={loading}
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
              </select>
            </div>

            <div style={styles.configItem}>
              <label style={styles.label}>时间周期</label>
              <select
                value={config.timeframe}
                onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                style={styles.select}
                disabled={loading}
              >
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1d">1天</option>
              </select>
            </div>

            <div style={styles.configItem}>
              <label style={styles.label}>初始资金 (USDT)</label>
              <input
                type="number"
                value={config.initial_capital}
                onChange={(e) => setConfig({ ...config, initial_capital: parseFloat(e.target.value) })}
                style={styles.input}
                min="100"
                step="1000"
                disabled={loading}
              />
            </div>

            <div style={styles.configItem}>
              <label style={styles.label}>仓位管理</label>
              <select
                value={config.position_preset}
                onChange={(e) => setConfig({ ...config, position_preset: e.target.value })}
                style={styles.select}
                disabled={loading}
              >
                {presets.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.configItem}>
              <label style={styles.label}>开始日期</label>
              <input
                type="date"
                value={config.start_date}
                onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.configItem}>
              <label style={styles.label}>结束日期</label>
              <input
                type="date"
                value={config.end_date}
                onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>
        </section>

        {/* 策略参数 */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>🎛️</span>
            策略参数
          </h3>
          <div style={styles.paramsGrid}>
            {currentStrategy && Object.entries(currentStrategy.params).map(([key, param]) => (
              <div key={key} style={styles.paramItem}>
                <div style={styles.paramHeader}>
                  <label style={styles.label}>{param.label}</label>
                  <span style={styles.paramValue}>{config.params[key]}</span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={config.params[key] || param.default}
                  onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                  style={styles.slider}
                  disabled={loading}
                />
                <div style={styles.paramRange}>
                  <span>{param.min}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 运行按钮 */}
        <button
          onClick={handleRun}
          disabled={loading}
          style={{
            ...styles.runButton,
            ...(loading ? styles.runButtonDisabled : {}),
          }}
        >
          {loading ? (
            <>
              <span style={styles.spinner}>⏳</span>
              运行中...
            </>
          ) : (
            <>
              <span>🚀</span>
              开始回测
            </>
          )}
        </button>

        {error && (
          <div style={styles.error}>
            <span style={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}
      </div>

      {/* 右侧：结果面板 */}
      <div style={styles.rightPanel}>
        {!result && !loading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📊</div>
            <div style={styles.emptyTitle}>准备就绪</div>
            <div style={styles.emptyText}>
              配置好策略参数后，点击"开始回测"查看结果
            </div>
            <div style={styles.quickGuide}>
              <div style={styles.guideTitle}>快速指南</div>
              <div style={styles.guideSteps}>
                <div style={styles.guideStep}>
                  <div style={styles.stepNumber}>1</div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitle}>选择策略</div>
                    <div style={styles.stepDesc}>点击左侧策略卡片选择交易策略</div>
                  </div>
                </div>
                <div style={styles.guideStep}>
                  <div style={styles.stepNumber}>2</div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitle}>调整参数</div>
                    <div style={styles.stepDesc}>拖动滑块调整策略参数到最优值</div>
                  </div>
                </div>
                <div style={styles.guideStep}>
                  <div style={styles.stepNumber}>3</div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitle}>设置条件</div>
                    <div style={styles.stepDesc}>选择时间范围和初始资金</div>
                  </div>
                </div>
                <div style={styles.guideStep}>
                  <div style={styles.stepNumber}>4</div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitle}>开始回测</div>
                    <div style={styles.stepDesc}>点击运行按钮查看历史表现</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.loadingSpinner}>⏳</div>
            <div style={styles.loadingText}>回测运行中...</div>
            <div style={styles.loadingSubtext}>正在分析历史数据，请稍候</div>
          </div>
        )}

        {result && (
          <div style={styles.resultContainer}>
            <div style={styles.resultHeader}>
              <h3 style={styles.resultTitle}>
                <span style={styles.titleIcon}>📈</span>
                回测结果
              </h3>
              <button
                onClick={() => setResult(null)}
                style={styles.clearButton}
              >
                清除
              </button>
            </div>

            {/* 核心指标 */}
            <div style={styles.metricsGrid}>
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
              <section style={styles.tradesSection}>
                <h4 style={styles.subsectionTitle}>
                  <span style={styles.titleIcon}>📝</span>
                  交易记录
                  <span style={styles.tradeCount}>共 {result.trades.length} 笔</span>
                </h4>
                <div style={styles.tradesTable}>
                  <div style={styles.tableHeader}>
                    <span style={{...styles.tableCell, flex: 1.2}}>时间</span>
                    <span style={{...styles.tableCell, flex: 0.7}}>方向</span>
                    <span style={{...styles.tableCell, flex: 0.7}}>类型</span>
                    <span style={{...styles.tableCell, flex: 1}}>价格</span>
                    <span style={{...styles.tableCell, flex: 0.8}}>数量</span>
                    <span style={{...styles.tableCell, flex: 0.8}}>收益</span>
                  </div>
                  <div style={styles.tableBody}>
                    {result.trades.map((trade, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...styles.tableRow,
                          ...(idx % 2 === 0 ? styles.tableRowEven : {}),
                        }}
                      >
                        <span style={{...styles.tableCell, flex: 1.2, fontSize: '0.8rem'}}>
                          {new Date(trade.timestamp * 1000).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span style={{
                          ...styles.tableCell,
                          flex: 0.7,
                          color: trade.side === 'LONG' ? '#4CAF50' : '#f44336',
                          fontWeight: '600',
                        }}>
                          {trade.side === 'LONG' ? '做多' : '做空'}
                        </span>
                        <span style={{...styles.tableCell, flex: 0.7}}>
                          {trade.action === 'OPEN' ? '开仓' : '平仓'}
                        </span>
                        <span style={{...styles.tableCell, flex: 1, fontFamily: 'monospace'}}>
                          ${trade.price.toFixed(2)}
                        </span>
                        <span style={{...styles.tableCell, flex: 0.8, fontFamily: 'monospace'}}>
                          {trade.quantity.toFixed(4)}
                        </span>
                        <span style={{
                          ...styles.tableCell,
                          flex: 0.8,
                          color: trade.pnl >= 0 ? '#4CAF50' : '#f44336',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                        }}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2) || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
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
    if (!trend) return '#fff';
    return trend === 'up' ? '#4CAF50' : '#f44336';
  };

  return (
    <div style={styles.metricCard}>
      <div style={styles.metricIcon}>{icon}</div>
      <div style={styles.metricContent}>
        <div style={styles.metricLabel}>{label}</div>
        <div style={{
          ...styles.metricValue,
          color: getTrendColor(),
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '1.5rem',
    flex: 1,
    minHeight: 0,
    padding: '1.5rem',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    overflowY: 'auto',
    paddingRight: '0.5rem',
  },
  rightPanel: {
    flex: 1,
    minWidth: 0, // 允许flex收缩
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  section: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  titleIcon: {
    fontSize: '1.2rem',
  },
  strategyGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  strategyCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  strategyCardActive: {
    transform: 'translateX(4px)',
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)',
  },
  strategyIcon: {
    fontSize: '2rem',
    lineHeight: 1,
  },
  strategyInfo: {
    flex: 1,
  },
  strategyName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '0.25rem',
  },
  strategyDesc: {
    fontSize: '0.75rem',
    color: '#aaa',
    lineHeight: '1.4',
  },
  strategyCheck: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  configItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.85rem',
    color: '#aaa',
    fontWeight: '500',
  },
  input: {
    padding: '0.7rem',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  select: {
    padding: '0.7rem',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  paramsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  paramItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  paramHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paramValue: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#4CAF50',
    fontFamily: 'monospace',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    opacity: '0.8',
    transition: 'opacity 0.2s',
  },
  paramRange: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
    color: '#666',
  },
  runButton: {
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #4CAF50, #45a049)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.05rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
  },
  runButtonDisabled: {
    background: '#555',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  error: {
    padding: '1rem',
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: '8px',
    color: '#f44336',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  errorIcon: {
    fontSize: '1.2rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '4rem 2rem',
    color: '#666',
  },
  emptyIcon: {
    fontSize: '6rem',
    marginBottom: '2rem',
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: '1.8rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#fff',
  },
  emptyText: {
    fontSize: '1rem',
    color: '#888',
    textAlign: 'center',
    maxWidth: '600px',
    lineHeight: '1.8',
    marginBottom: '3rem',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '4rem 2rem',
  },
  loadingSpinner: {
    fontSize: '4rem',
    marginBottom: '1rem',
    animation: 'spin 2s linear infinite',
  },
  loadingText: {
    fontSize: '1.3rem',
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: '0.5rem',
  },
  loadingSubtext: {
    fontSize: '0.9rem',
    color: '#888',
  },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '1.5rem',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
  },
  clearButton: {
    padding: '0.5rem 1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#aaa',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  metricCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '1.2rem',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  metricIcon: {
    fontSize: '2rem',
  },
  metricContent: {
    flex: 1,
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: '#aaa',
    marginBottom: '0.4rem',
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  tradesSection: {
    marginTop: '1rem',
  },
  subsectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  tradeCount: {
    marginLeft: 'auto',
    fontSize: '0.85rem',
    color: '#4CAF50',
    fontWeight: '500',
  },
  tradesTable: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  tableHeader: {
    display: 'flex',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontWeight: '600',
    fontSize: '0.85rem',
    color: '#aaa',
  },
  tableBody: {
    maxHeight: '500px',
    overflowY: 'auto',
  },
  tableRow: {
    display: 'flex',
    padding: '0.9rem 1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    fontSize: '0.85rem',
    transition: 'background 0.1s',
  },
  tableRowEven: {
    background: 'rgba(255, 255, 255, 0.02)',
  },
  tableCell: {
    display: 'flex',
    alignItems: 'center',
  },
  quickGuide: {
    width: '100%',
    maxWidth: '700px',
  },
  guideTitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  guideSteps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
  },
  guideStep: {
    display: 'flex',
    gap: '1rem',
    padding: '1.5rem',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.2s',
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4CAF50, #45a049)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  stepDesc: {
    fontSize: '0.85rem',
    color: '#888',
    lineHeight: '1.5',
  },
};
