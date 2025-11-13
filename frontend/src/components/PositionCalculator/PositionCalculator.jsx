import { useState, useEffect, useRef } from 'react';
import { calculatePositionByDistance, formatPrice, formatPercent, formatSize } from '../../utils/positionCalculator';
import { drawPnLBoxOnCanvas, clearPnLBoxCanvas } from '../../utils/drawPriceLines';
import './styles.css';

/**
 * 合约仓位计算器组件
 * 
 * 功能：
 * 1. 基于相对距离输入（止盈/止损距离）
 * 2. 实时计算仓位、保证金、杠杆、强平价
 * 3. 在图表上绘制价格线（可开关）
 * 4. 支持高级参数配置（MMR、强平缓冲）
 */
export default function PositionCalculator({ 
  symbol, 
  currentPrice,
  chart,
  candlestickSeries,
  onResultChange,  // 回调函数，通知父组件结果变化
  onVisibilityChange,  // 回调函数，通知父组件显示状态变化
}) {
  // UI 状态
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPnLBox, setShowPnLBox] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 基础输入参数
  const [maxLoss, setMaxLoss] = useState(100);
  const [tpPercent, setTpPercent] = useState(2);      // 止盈百分比 (%)
  const [slPercent, setSlPercent] = useState(-0.5);   // 止损百分比 (%)
  
  // 开仓价设置
  const [useCustomEntry, setUseCustomEntry] = useState(false);
  const [customEntry, setCustomEntry] = useState('');
  
  // 高级参数
  const [mmr, setMmr] = useState(0.5);           // 维持保证金率 (%)
  const [liqBuffer, setLiqBuffer] = useState(10); // 强平缓冲 (%)
  
  // 计算结果
  const [result, setResult] = useState(null);
  
  // 用于优化重绘：只在开仓价变化时才通知父组件
  const lastEntryRef = useRef(null);
  
  // 实时计算
  useEffect(() => {
    // 确定使用哪个开仓价
    const entryPrice = useCustomEntry && customEntry 
      ? Number(customEntry) 
      : currentPrice;
    
    if (!entryPrice || entryPrice <= 0) {
      setResult(null);
      return;
    }
    
    // 百分比转换为绝对距离
    const tpDistance = entryPrice * (tpPercent / 100);
    const slDistance = entryPrice * (slPercent / 100);
    
    const calculated = calculatePositionByDistance(
      maxLoss,
      tpDistance,
      slDistance,
      entryPrice,
      mmr / 100,        // 转换为小数 0.005
      liqBuffer / 100   // 转换为小数 0.1
    );
    
    setResult(calculated);
  }, [maxLoss, tpPercent, slPercent, currentPrice, useCustomEntry, customEntry, mmr, liqBuffer]);
  
  // 通知父组件结果变化（只在开仓价变化时触发，避免不必要的重绘）
  useEffect(() => {
    if (!onResultChange) return;
    
    // 获取当前开仓价
    const currentEntry = result && !result.error ? result.entry : null;
    
    // 如果开仓价没变，不通知父组件（避免重绘）
    if (currentEntry === lastEntryRef.current) {
      return;
    }
    
    // 更新记录并通知父组件
    lastEntryRef.current = currentEntry;
    onResultChange(result);
  }, [result, onResultChange]);
  
  // 通知父组件显示状态变化
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(showPnLBox);
    }
  }, [showPnLBox, onVisibilityChange]);
  
  // 重置到默认值
  const handleReset = () => {
    setMaxLoss(100);
    setTpPercent(2);
    setSlPercent(-0.5);
  };
  
  // 重置高级参数
  const handleResetAdvanced = () => {
    setMmr(0.5);
    setLiqBuffer(10);
  };
  
  // 切换 P&L 矩形显示
  const togglePnLBox = () => {
    setShowPnLBox(!showPnLBox);
  };
  
  // 获取币种名称（去掉USDT）
  const coinName = symbol ? symbol.replace('USDT', '') : 'BTC';
  
  return (
    <div className="position-calculator">
      {/* 标题栏 */}
      <div 
        className="calculator-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>📐 合约计算器</span>
        <span className="collapse-icon">{isCollapsed ? '▼' : '▲'}</span>
      </div>
      
      {!isCollapsed && (
        <>
          {/* 基础输入区域 */}
          <div className="calculator-section">
            <div className="section-title">═════ 输入参数 ═════</div>
            
            <div className="calculator-input">
              <label>
                📌 开仓价 (USDT)
                <span className="hint"> 留空=实时价格</span>
              </label>
              <div className="entry-input-group">
                <input
                  type="number"
                  value={customEntry}
                  onChange={(e) => {
                    setCustomEntry(e.target.value);
                    setUseCustomEntry(e.target.value !== '');
                  }}
                  placeholder={currentPrice ? formatPrice(currentPrice) : '使用实时价格'}
                  step="0.1"
                  className={useCustomEntry ? 'custom-entry-active' : ''}
                />
                {customEntry && (
                  <button
                    className="btn-clear-entry"
                    onClick={() => {
                      setCustomEntry('');
                      setUseCustomEntry(false);
                    }}
                    title="清除自定义开仓价"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <div className="calculator-input">
              <label>💰 最大亏损 (USDT)</label>
              <input
                type="number"
                value={maxLoss}
                onChange={(e) => setMaxLoss(Number(e.target.value))}
                placeholder="100"
                min="0"
                step="10"
              />
            </div>
            
            <div className="calculator-input">
              <label>
                📍 止盈幅度
                <span className="hint"> 做多:+, 做空:-</span>
              </label>
              <div className="input-with-unit">
                <input
                  type="number"
                  value={tpPercent}
                  onChange={(e) => setTpPercent(Number(e.target.value))}
                  placeholder="2"
                  step="0.1"
                />
                <span className="unit">%</span>
              </div>
            </div>
            
            <div className="calculator-input">
              <label>
                🛡️ 止损幅度
                <span className="hint"> 做多:-, 做空:+</span>
              </label>
              <div className="input-with-unit">
                <input
                  type="number"
                  value={slPercent}
                  onChange={(e) => setSlPercent(Number(e.target.value))}
                  placeholder="-0.5"
                  step="0.1"
                />
                <span className="unit">%</span>
              </div>
            </div>
          </div>
          
          {/* 高级设置 */}
          <div className="advanced-settings">
            <div 
              className="advanced-header"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>⚙️ 高级设置</span>
              <span className="collapse-icon">{showAdvanced ? '▲' : '▼'}</span>
            </div>
            
            {showAdvanced && (
              <div className="advanced-content">
                <div className="calculator-input">
                  <label>
                    🔧 维持保证金率 (MMR)
                    <span className="hint"> 交易所规则</span>
                  </label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={mmr}
                      onChange={(e) => setMmr(Number(e.target.value))}
                      step="0.1"
                      min="0.1"
                      max="10"
                    />
                    <span className="unit">%</span>
                  </div>
                  <div className="hint-text">
                    默认 0.5% | 常见: 0.4%-5.0%
                  </div>
                </div>
                
                <div className="calculator-input">
                  <label>
                    🛡️ 强平缓冲比例
                    <span className="hint"> 安全边际</span>
                  </label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={liqBuffer}
                      onChange={(e) => setLiqBuffer(Number(e.target.value))}
                      step="1"
                      min="0"
                      max="50"
                    />
                    <span className="unit">%</span>
                  </div>
                  <div className="hint-text">
                    默认 10% | 保守:15-20%, 激进:5%
                  </div>
                </div>
                
                <div className="advanced-info">
                  <div className="info-item">
                    💡 <strong>MMR</strong>: 越高强平越远
                  </div>
                  <div className="info-item">
                    💡 <strong>缓冲</strong>: 越大保证金越多
                  </div>
                </div>
                
                <button 
                  className="btn-reset-advanced"
                  onClick={handleResetAdvanced}
                >
                  恢复默认值
                </button>
              </div>
            )}
          </div>
          
          {/* 实时价格显示 */}
          <div className="calculator-section">
            <div className="section-title">═════ 实时价格 ═════</div>
            
            <div className="price-display">
              {result && !result.error && (
                <>
                  <div className="price-row">
                    <span className="price-label">🎯 止盈价:</span>
                    <span className="price-value profit">
                      {formatPrice(result.tp)} ({tpPercent > 0 ? '+' : ''}{tpPercent}%)
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">🔴 止损价:</span>
                    <span className="price-value loss">
                      {formatPrice(result.sl)} ({slPercent > 0 ? '+' : ''}{slPercent}%)
                    </span>
                  </div>
                  <div className="price-row">
                    <span className="price-label">⚠️ 强平价:</span>
                    <span className={`price-value ${Math.abs(result.distanceToLiqPercent) < 2 ? 'danger-color' : 'warning-color'}`}>
                      {formatPrice(result.liquidationPrice)} ({result.distanceToLiqPercent > 0 ? '+' : ''}{formatPercent(result.distanceToLiqPercent)}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* 错误提示 */}
          {result?.error && (
            <div className="error-message">
              ⚠️ {result.error}
            </div>
          )}
          
          {/* 计算结果 */}
          {result && !result.error && (
            <div className="calculator-section">
              <div className="section-title">═════ 计算结果 ═════</div>
              
              <div className="calculator-result">
                {/* 方向和盈亏比 */}
                <div className="result-row-highlight">
                  <span>📈 交易方向:</span>
                  <span className={result.direction === 'Long' ? 'long-color' : 'short-color'}>
                    {result.direction === 'Long' ? '做多 🟢' : '做空 🔴'}
                  </span>
                </div>
                
                <div className="result-row-highlight">
                  <span>🎲 盈亏比:</span>
                  <span className="profit-color">{result.rrRatio.toFixed(2)}:1</span>
                </div>
                
                {/* 仓位信息 */}
                <div className="result-subsection">
                  <div className="result-row">
                    <span>💼 持仓数量:</span>
                    <span>{formatSize(result.positionSize)} {coinName}</span>
                  </div>
                  
                  <div className="result-row">
                    <span>💵 仓位价值:</span>
                    <span>{formatPrice(result.positionValue)} USDT</span>
                  </div>
                  
                  <div className="result-row">
                    <span>💎 所需保证金:</span>
                    <span className="highlight">{formatPrice(result.margin)} USDT</span>
                  </div>
                  
                  <div className="result-row">
                    <span>⚡ 杠杆倍数:</span>
                    <span className={result.leverage > 20 ? 'warning-color' : ''}>
                      {result.leverage.toFixed(1)}x
                    </span>
                  </div>
                </div>
                
                {/* 盈亏信息 */}
                <div className="result-subsection">
                  <div className="result-row">
                    <span>💰 潜在盈利:</span>
                    <span className="profit-color">+{formatPrice(result.totalProfit)} USDT</span>
                  </div>
                  
                  <div className="result-row">
                    <span>📊 保证金收益率:</span>
                    <span className="profit-color">+{formatPercent(result.marginYield)}%</span>
                  </div>
                  
                  <div className="result-row">
                    <span>📉 保证金亏损率:</span>
                    <span className="loss-color">-{formatPercent(result.marginLossRate)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 操作按钮 */}
          <div className="calculator-actions">
            <button 
              className={`btn-toggle-lines ${showPnLBox ? 'active' : ''}`}
              onClick={togglePnLBox}
              disabled={!result || result.error}
              title={showPnLBox ? '隐藏 P&L 矩形' : '显示 P&L 矩形'}
            >
              {showPnLBox ? '👁️ 隐藏矩形' : '👁️ 显示矩形'}
            </button>
            <button 
              className="btn-reset"
              onClick={handleReset}
              title="重置所有参数"
            >
              🔄 重置
            </button>
          </div>
        </>
      )}
    </div>
  );
}

