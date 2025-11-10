import { useState, useEffect } from 'react';
import { getStrategies, getPositionPresets, getAIConfig } from '../../services/tradingEngineApi';

/**
 * 实盘交易配置组件 - PC端优化版
 */
export default function LiveTrading() {
  const [config, setConfig] = useState({
    strategy: 'dual_ma',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    position_preset: 'conservative',
    enable_ai: false,
    params: {},
  });

  const [strategies, setStrategies] = useState([]);
  const [presets, setPresets] = useState([
    { name: 'conservative', display_name: '保守型' },
    { name: 'balanced', display_name: '平衡型' },
    { name: 'aggressive', display_name: '激进型' },
  ]); // 默认值防止崩溃
  const [aiConfig, setAiConfig] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  // 策略详细信息（与BacktestConfig保持一致）
  const strategyDetails = {
    dual_ma: {
      name: '双均线策略',
      description: '基于快慢均线交叉的经典趋势跟踪策略',
      icon: '📊',
      color: '#4CAF50',
      params: {
        fast_period: { label: '快线周期', default: 5, min: 2, max: 50, step: 1 },
        slow_period: { label: '慢线周期', default: 20, min: 5, max: 200, step: 1 },
      }
    },
    macd: {
      name: 'MACD策略',
      description: 'MACD指标金叉死叉交易策略',
      icon: '📈',
      color: '#2196F3',
      params: {
        fast_period: { label: '快线周期', default: 12, min: 5, max: 50, step: 1 },
        slow_period: { label: '慢线周期', default: 26, min: 10, max: 100, step: 1 },
        signal_period: { label: '信号周期', default: 9, min: 3, max: 30, step: 1 },
      }
    },
    rsi: {
      name: 'RSI策略',
      description: 'RSI超买超卖区间交易策略',
      icon: '📉',
      color: '#FF9800',
      params: {
        period: { label: 'RSI周期', default: 14, min: 5, max: 50, step: 1 },
        oversold: { label: '超卖阈值', default: 30, min: 10, max: 40, step: 1 },
        overbought: { label: '超买阈值', default: 70, min: 60, max: 90, step: 1 },
      }
    },
    bollinger: {
      name: '布林带策略',
      description: '基于布林带突破的波动率交易策略',
      icon: '📐',
      color: '#9C27B0',
      params: {
        period: { label: '周期', default: 20, min: 10, max: 50, step: 1 },
        std_dev: { label: '标准差倍数', default: 2.0, min: 1, max: 3, step: 0.1 },
      }
    },
  };

  // 加载配置
  useEffect(() => {
    const loadData = async () => {
      try {
        const [strategiesData, presetsData, aiConfigData] = await Promise.all([
          getStrategies().catch(() => []),
          getPositionPresets().catch(() => [
            { name: 'conservative', display_name: '保守型' },
            { name: 'balanced', display_name: '平衡型' },
            { name: 'aggressive', display_name: '激进型' },
          ]),
          getAIConfig().catch(() => ({ enabled: false })),
        ]);
        
        if (strategiesData && strategiesData.length > 0) {
          setStrategies(strategiesData);
        }
        if (presetsData && Array.isArray(presetsData) && presetsData.length > 0) {
          setPresets(presetsData);
        }
        if (aiConfigData) {
          setAiConfig(aiConfigData);
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
    if (strategyDetail) {
      const defaultParams = {};
      Object.entries(strategyDetail.params).forEach(([key, param]) => {
        defaultParams[key] = param.default;
      });
      setConfig(prev => ({
        ...prev,
        params: defaultParams,
      }));
    }
  }, [config.strategy]);

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
    <div style={styles.container}>
      {/* 左侧：配置面板 */}
      <div style={styles.leftPanel}>
        {/* 风险警告 */}
        <div style={styles.warningBox}>
          <div style={styles.warningHeader}>
            <span style={styles.warningIcon}>⚠️</span>
            <span style={styles.warningTitle}>实盘交易风险提示</span>
          </div>
          <div style={styles.warningText}>
            实盘交易涉及真实资金，存在亏损风险。请确保您已充分测试策略并了解相关风险。建议先进行纸面交易验证。
          </div>
        </div>

        {/* 策略选择 */}
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
                onClick={() => !isRunning && setConfig({ ...config, strategy: key })}
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
            交易配置
          </h3>
          <div style={styles.configGrid}>
            <div style={styles.configItem}>
              <label style={styles.label}>交易对</label>
              <select
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                style={styles.select}
                disabled={isRunning}
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
                disabled={isRunning}
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
              <label style={styles.label}>仓位管理</label>
              <select
                value={config.position_preset}
                onChange={(e) => setConfig({ ...config, position_preset: e.target.value })}
                style={styles.select}
                disabled={isRunning}
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
              <div style={styles.configItem}>
                <label style={styles.aiLabel}>
                  <input
                    type="checkbox"
                    checked={config.enable_ai}
                    onChange={(e) => setConfig({ ...config, enable_ai: e.target.checked })}
                    disabled={isRunning}
                    style={styles.checkbox}
                  />
                  <span>启用AI信号增强</span>
                </label>
                {config.enable_ai && (
                  <div style={styles.aiInfo}>
                    🤖 使用 {aiConfig.model} 进行信号验证
                  </div>
                )}
              </div>
            )}
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
                  disabled={isRunning}
                />
                <div style={styles.paramRange}>
                  <span>{param.min}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 控制按钮 */}
        {!isRunning ? (
          <button onClick={handleStart} style={styles.startButton}>
            <span>▶️</span>
            开始实盘交易
          </button>
        ) : (
          <button onClick={handleStop} style={styles.stopButton}>
            <span>⏹️</span>
            停止交易
          </button>
        )}

        {error && (
          <div style={styles.error}>
            <span style={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}
      </div>

      {/* 右侧：状态面板 */}
      <div style={styles.rightPanel}>
        {!isRunning ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🚀</div>
            <div style={styles.emptyTitle}>准备启动</div>
            <div style={styles.emptyText}>
              配置好策略参数后，点击"开始实盘交易"启动自动化交易
            </div>
            <div style={styles.featureList}>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✅</span>
                <span>实时监控市场数据</span>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✅</span>
                <span>自动执行交易策略</span>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✅</span>
                <span>智能仓位管理</span>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✅</span>
                <span>风险控制保护</span>
              </div>
              {aiConfig?.enabled && (
                <div style={styles.featureItem}>
                  <span style={styles.featureIcon}>✅</span>
                  <span>AI信号验证增强</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.runningState}>
            {/* 状态头部 */}
            <div style={styles.statusHeader}>
              <div style={styles.statusBadge}>
                <span style={styles.statusDot}></span>
                <span>策略运行中</span>
              </div>
              <div style={styles.statusTime}>
                运行时间: 00:00:00
              </div>
            </div>

            {/* 核心指标 */}
            <div style={styles.metricsGrid}>
              <StatusCard
                label="当前持仓"
                value="无持仓"
                icon="📊"
                color="#fff"
              />
              <StatusCard
                label="今日收益"
                value="+0.00%"
                icon="💰"
                color="#4CAF50"
              />
              <StatusCard
                label="今日交易"
                value="0 笔"
                icon="🔄"
                color="#fff"
              />
              <StatusCard
                label="信号数量"
                value="0"
                icon="📡"
                color="#fff"
              />
              <StatusCard
                label="胜率"
                value="0.00%"
                icon="🎯"
                color="#fff"
              />
              <StatusCard
                label="总收益"
                value="+0.00 USDT"
                icon="💵"
                color="#4CAF50"
              />
            </div>

            {/* 持仓信息 */}
            <section style={styles.positionSection}>
              <h4 style={styles.subsectionTitle}>
                <span style={styles.titleIcon}>📈</span>
                当前持仓
              </h4>
              <div style={styles.emptyPosition}>
                <div style={styles.emptyPositionIcon}>💤</div>
                <div style={styles.emptyPositionText}>暂无持仓</div>
              </div>
            </section>

            {/* 实时日志 */}
            <section style={styles.logSection}>
              <h4 style={styles.subsectionTitle}>
                <span style={styles.titleIcon}>📝</span>
                实时日志
              </h4>
              <div style={styles.logContainer}>
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
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// 状态卡片组件
function StatusCard({ label, value, icon, color }) {
  return (
    <div style={styles.statusCard}>
      <div style={styles.statusIcon}>{icon}</div>
      <div style={styles.statusContent}>
        <div style={styles.statusLabel}>{label}</div>
        <div style={{...styles.statusValue, color}}>{value}</div>
      </div>
    </div>
  );
}

// 日志条目组件
function LogEntry({ time, message, type = 'info' }) {
  const getTypeColor = () => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'warning': return '#FF9800';
      default: return '#fff';
    }
  };

  return (
    <div style={styles.logEntry}>
      <span style={styles.logTime}>{time}</span>
      <span style={{...styles.logMessage, color: getTypeColor()}}>{message}</span>
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
  warningBox: {
    background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))',
    border: '2px solid rgba(255, 152, 0, 0.3)',
    borderRadius: '12px',
    padding: '1.2rem',
  },
  warningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.8rem',
  },
  warningIcon: {
    fontSize: '1.5rem',
  },
  warningTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#FF9800',
  },
  warningText: {
    fontSize: '0.85rem',
    color: '#FFB74D',
    lineHeight: '1.6',
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
  aiLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#fff',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  aiInfo: {
    fontSize: '0.75rem',
    color: '#4CAF50',
    padding: '0.5rem',
    background: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '4px',
    marginTop: '0.5rem',
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
  startButton: {
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
  stopButton: {
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #f44336, #d32f2f)',
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
    boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
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
    padding: '4rem 3rem',
  },
  emptyIcon: {
    fontSize: '7rem',
    marginBottom: '2rem',
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: '2rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#fff',
  },
  emptyText: {
    fontSize: '1.05rem',
    color: '#888',
    textAlign: 'center',
    maxWidth: '600px',
    lineHeight: '1.8',
    marginBottom: '3rem',
  },
  featureList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.2rem',
    width: '100%',
    maxWidth: '700px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.95rem',
    color: '#aaa',
    padding: '0.8rem',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  featureIcon: {
    fontSize: '1.5rem',
  },
  runningState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '1.5rem',
  },
  statusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4CAF50',
    animation: 'pulse 2s infinite',
  },
  statusTime: {
    fontSize: '0.85rem',
    color: '#888',
    fontFamily: 'monospace',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  statusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '1.2rem',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statusIcon: {
    fontSize: '2rem',
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: '0.8rem',
    color: '#aaa',
    marginBottom: '0.4rem',
  },
  statusValue: {
    fontSize: '1.3rem',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  positionSection: {
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
  emptyPosition: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  emptyPositionIcon: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
    opacity: 0.3,
  },
  emptyPositionText: {
    fontSize: '0.9rem',
    color: '#666',
  },
  logSection: {
    marginTop: '1rem',
  },
  logContainer: {
    background: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '10px',
    padding: '1rem',
    maxHeight: '300px',
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logEntry: {
    display: 'flex',
    gap: '1rem',
    padding: '0.6rem 0',
    fontSize: '0.85rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  logTime: {
    color: '#666',
    minWidth: '90px',
    fontFamily: 'monospace',
  },
  logMessage: {
    flex: 1,
  },
};
