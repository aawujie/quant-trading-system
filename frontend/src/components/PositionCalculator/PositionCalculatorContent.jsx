import { useState, useEffect, useRef } from 'react';
import { calculatePositionByDistance, formatPrice, formatPercent, formatSize } from '../../utils/positionCalculator';
import './styles.css';

// localStorage 工具函数
const STORAGE_KEY_PREFIX = 'positionCalculator_';

const getStoredValue = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`读取缓存失败 (${key}):`, error);
    return defaultValue;
  }
};

const setStoredValue = (key, value) => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.warn(`保存缓存失败 (${key}):`, error);
  }
};

/**
 * 合约仓位计算器内容组件（不包含外层折叠容器）
 * 用于在 Accordion 中使用
 */
export default function PositionCalculatorContent({ 
  symbol, 
  currentPrice,
  onResultChange,
}) {
  const [showAdvanced, setShowAdvanced] = useState(() => getStoredValue('showAdvanced', false));
  
  // 基础输入参数
  const [maxLoss, setMaxLoss] = useState(() => getStoredValue('maxLoss', 100));
  const [tpPercent, setTpPercent] = useState(() => getStoredValue('tpPercent', 2));
  const [slPercent, setSlPercent] = useState(() => getStoredValue('slPercent', -0.5));
  
  // 开仓价设置
  const [useCustomEntry, setUseCustomEntry] = useState(() => getStoredValue(`useCustomEntry_${symbol}`, false));
  const [customEntry, setCustomEntry] = useState(() => getStoredValue(`customEntry_${symbol}`, ''));
  
  // 高级参数
  const [mmr, setMmr] = useState(() => getStoredValue('mmr', 0.5));
  const [liqBuffer, setLiqBuffer] = useState(() => getStoredValue('liqBuffer', 10));
  
  const [result, setResult] = useState(null);
  const lastEntryRef = useRef(null);
  
  useEffect(() => {
    const storedUseCustomEntry = getStoredValue(`useCustomEntry_${symbol}`, false);
    const storedCustomEntry = getStoredValue(`customEntry_${symbol}`, '');
    setUseCustomEntry(storedUseCustomEntry);
    setCustomEntry(storedCustomEntry);
  }, [symbol]);
  
  useEffect(() => {
    const entryPrice = useCustomEntry && customEntry 
      ? Number(customEntry) 
      : currentPrice;
    
    if (!entryPrice || entryPrice <= 0) {
      setResult(null);
      return;
    }
    
    const tpDistance = entryPrice * (tpPercent / 100);
    const slDistance = entryPrice * (slPercent / 100);
    
    const calculated = calculatePositionByDistance(
      maxLoss,
      tpDistance,
      slDistance,
      entryPrice,
      mmr / 100,
      liqBuffer / 100
    );
    
    setResult(calculated);
  }, [maxLoss, tpPercent, slPercent, currentPrice, useCustomEntry, customEntry, mmr, liqBuffer]);
  
  useEffect(() => {
    if (!onResultChange) return;
    
    const currentKey = result && !result.error 
      ? `${result.entry}_${result.tp}_${result.sl}_${result.liquidationPrice}`
      : null;
    
    if (currentKey === lastEntryRef.current) {
      return;
    }
    
    lastEntryRef.current = currentKey;
    onResultChange(result);
  }, [result, onResultChange]);
  
  useEffect(() => {
    setStoredValue('showAdvanced', showAdvanced);
  }, [showAdvanced]);
  
  useEffect(() => {
    setStoredValue('maxLoss', maxLoss);
  }, [maxLoss]);
  
  useEffect(() => {
    setStoredValue('tpPercent', tpPercent);
  }, [tpPercent]);
  
  useEffect(() => {
    setStoredValue('slPercent', slPercent);
  }, [slPercent]);
  
  useEffect(() => {
    setStoredValue(`useCustomEntry_${symbol}`, useCustomEntry);
  }, [useCustomEntry, symbol]);
  
  useEffect(() => {
    setStoredValue(`customEntry_${symbol}`, customEntry);
  }, [customEntry, symbol]);
  
  useEffect(() => {
    setStoredValue('mmr', mmr);
  }, [mmr]);
  
  useEffect(() => {
    setStoredValue('liqBuffer', liqBuffer);
  }, [liqBuffer]);
  
  const handleResetAdvanced = () => {
    setMmr(0.5);
    setLiqBuffer(10);
  };
  
  const handleEntryFocus = () => {
    if (!customEntry && currentPrice && currentPrice > 0) {
      setCustomEntry(currentPrice.toString());
      setUseCustomEntry(true);
    }
  };
  
  const coinName = symbol ? symbol.replace('USDT', '') : 'BTC';
  const priceStep = currentPrice ? Math.max(currentPrice * 0.0001, 0.01) : 1;
  
  return (
    <div className="position-calculator-content">
      {/* 方向和盈亏比 */}
      {result && !result.error && (
        <div className="result-row-highlight-single">
          <div className="highlight-item">
            <span>💹 交易方向:</span>
            <span className={result.direction === 'Long' ? 'long-color' : 'short-color'}>
              {result.direction === 'Long' ? '▲' : '▼'}
            </span>
          </div>
          <div className="highlight-item">
            <span>⚖️ 盈亏比:</span>
            <span className="profit-color">{result.rrRatio.toFixed(2)}:1</span>
          </div>
        </div>
      )}
      
      {/* 基础输入区域 */}
      <div className="calculator-section">
        <div className="calculator-input-row">
          <div className="calculator-input">
            <label>📌 开仓价</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={customEntry}
                onChange={(e) => {
                  setCustomEntry(e.target.value);
                  setUseCustomEntry(e.target.value !== '');
                }}
                onFocus={handleEntryFocus}
                placeholder={currentPrice ? formatPrice(currentPrice) : '实时'}
                step={priceStep}
              />
              <span className="unit">U</span>
            </div>
          </div>
          
          <div className="calculator-input">
            <label>💰 最大亏损</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={maxLoss}
                onChange={(e) => setMaxLoss(Number(e.target.value))}
                placeholder="100"
                min="0"
                step="10"
              />
              <span className="unit">U</span>
            </div>
          </div>
        </div>
        
        <div className="calculator-input-row">
          <div className="calculator-input">
            <label>📍 止盈</label>
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
            <label>🛡️ 止损</label>
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
      
      {/* 错误提示 */}
      {result?.error && (
        <div className="error-message">
          ⚠️ {result.error}
        </div>
      )}
      
      {/* 计算结果 */}
      {result && !result.error && (
        <div className="calculator-section">
          <div className="calculator-result">
            {/* 价格信息 */}
            <div className="result-row">
              <span>🎯 止盈价:</span>
              <span className="profit-color">
                {formatPrice(result.tp)} ({tpPercent > 0 ? '+' : ''}{tpPercent}%)
              </span>
            </div>
            <div className="result-row">
              <span>🔴 止损价:</span>
              <span className="loss-color">
                {formatPrice(result.sl)} ({slPercent > 0 ? '+' : ''}{slPercent}%)
              </span>
            </div>
            <div className="result-row">
              <span>⚠️ 强平价:</span>
              <span className={Math.abs(result.distanceToLiqPercent) < 2 ? 'danger-color' : 'warning-color'}>
                {formatPrice(result.liquidationPrice)} ({result.distanceToLiqPercent > 0 ? '+' : ''}{formatPercent(result.distanceToLiqPercent)}%)
              </span>
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
    </div>
  );
}

