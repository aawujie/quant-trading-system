import { useState } from 'react';

/**
 * Tab容器组件
 * 用于在多个面板之间切换
 */
export default function TabContainer({ tabs }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={styles.container}>
      {/* Tab标签栏 */}
      <div style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            style={{
              ...styles.tab,
              ...(activeTab === index ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab(index)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
            {tab.count !== undefined && (
              <span style={styles.tabCount}>({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab内容区域 */}
      <div style={styles.content}>
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #3a3a4a',
    backgroundColor: '#2b2b43',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#9ca3b0',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    userSelect: 'none',
  },
  activeTab: {
    color: '#4CAF50',
    borderBottomColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  tabIcon: {
    fontSize: '1rem',
  },
  tabLabel: {
    whiteSpace: 'nowrap',
  },
  tabCount: {
    fontSize: '0.75rem',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

