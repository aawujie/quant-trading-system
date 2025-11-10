import { useState } from 'react';
import TabContainer from '../TabContainer';
import LiveTrading from './LiveTrading';
import BacktestConfig from './BacktestConfig';

/**
 * 交易引擎主组件
 * 包含实盘交易和回测两个tab
 */
export default function TradingEngine() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🚀 交易引擎</h2>
        <p style={styles.subtitle}>策略回测与实盘交易</p>
      </div>

      <TabContainer
        tabs={[
          {
            icon: '📈',
            label: '实盘交易',
            content: <LiveTrading />,
          },
          {
            icon: '🔬',
            label: '策略回测',
            content: <BacktestConfig />,
          },
        ]}
      />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    background: '#1a1a2e',
    overflow: 'hidden',
  },
  header: {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.02)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#aaa',
    margin: 0,
  },
};

