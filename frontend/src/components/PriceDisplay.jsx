import React, { useState, useEffect } from 'react';
import './PriceDisplay.css';

/**
 * 实时价格显示面板（参考 Binance/TradingView 风格）
 */
const PriceDisplay = ({ symbol, currentPrice, priceChange, priceChangePercent, high24h, low24h, volume24h }) => {
  const [flashClass, setFlashClass] = useState('');
  const [prevPrice, setPrevPrice] = useState(currentPrice);

  // 价格闪烁效果
  useEffect(() => {
    if (currentPrice && prevPrice && currentPrice !== prevPrice) {
      const isUp = currentPrice > prevPrice;
      setFlashClass(isUp ? 'flash-up' : 'flash-down');
      
      const timer = setTimeout(() => {
        setFlashClass('');
      }, 300);
      
      setPrevPrice(currentPrice);
      
      return () => clearTimeout(timer);
    }
  }, [currentPrice, prevPrice]);

  // 判断涨跌
  const isPositive = priceChange >= 0;
  const changeClass = isPositive ? 'positive' : 'negative';

  // 格式化数字
  const formatPrice = (price) => {
    if (!price) return '--';
    return parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatPercent = (percent) => {
    if (!percent && percent !== 0) return '--';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${parseFloat(percent).toFixed(2)}%`;
  };

  const formatVolume = (volume) => {
    if (!volume) return '--';
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  return (
    <div className="price-display">
      {/* 主价格区域 */}
      <div className="price-main">
        <div className="symbol-name">{symbol || 'BTC/USDT'}</div>
        <div className={`current-price ${flashClass}`}>
          <span className="price-value">${formatPrice(currentPrice)}</span>
          <div className={`price-change ${changeClass}`}>
            <span className="change-value">
              {isPositive ? '+' : ''}{formatPrice(Math.abs(priceChange || 0))}
            </span>
            <span className="change-percent">
              {formatPercent(priceChangePercent)}
            </span>
          </div>
        </div>
      </div>

      {/* 24小时统计 */}
      <div className="price-stats">
        <div className="stat-item">
          <span className="stat-label">24h 最高</span>
          <span className="stat-value">${formatPrice(high24h)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">24h 最低</span>
          <span className="stat-value">${formatPrice(low24h)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">24h 成交量</span>
          <span className="stat-value">{formatVolume(volume24h)}</span>
        </div>
      </div>
    </div>
  );
};

export default PriceDisplay;

