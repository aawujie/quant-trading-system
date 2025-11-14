import { useState, useEffect } from 'react';

/**
 * 通用可折叠容器组件
 * 用于创建可折叠/展开的区块，支持localStorage持久化
 */
export default function CollapsibleSection({
  title,
  icon,
  count,
  children,
  storageKey,  // localStorage的key
  defaultCollapsed = false,
}) {
  // 从localStorage读取折叠状态
  const getInitialCollapsed = () => {
    if (!storageKey) return defaultCollapsed;
    try {
      const stored = localStorage.getItem(`collapsible_${storageKey}`);
      return stored !== null ? JSON.parse(stored) : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  // 保存折叠状态到localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`collapsible_${storageKey}`, JSON.stringify(isCollapsed));
      } catch (error) {
        console.warn(`保存折叠状态失败 (${storageKey}):`, error);
      }
    }
  }, [isCollapsed, storageKey]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div style={styles.container}>
      {/* 标题栏 */}
      <div style={styles.header} onClick={toggleCollapse}>
        <span style={styles.titleContent}>
          {icon && <span style={styles.icon}>{icon}</span>}
          <span style={styles.title}>{title}</span>
          {count !== undefined && (
            <span style={styles.count}>({count})</span>
          )}
        </span>
        <span style={styles.collapseIcon}>
          {isCollapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* 内容区域 */}
      {!isCollapsed && (
        <div style={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(42, 42, 58, 0.6)',
    borderRadius: '8px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s',
  },
  titleContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    fontWeight: '600',
    color: '#fff',
    fontSize: '13px',
  },
  icon: {
    fontSize: '16px',
  },
  title: {
    flex: 1,
  },
  count: {
    fontSize: '11px',
    color: '#888',
    fontWeight: '400',
  },
  collapseIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
};

