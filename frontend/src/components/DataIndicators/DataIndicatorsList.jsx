import { dataIndicators } from '../../config/dataIndicators';

/**
 * 数据指标列表组件
 * 显示所有数据指标链接
 */
export default function DataIndicatorsList() {
  if (dataIndicators.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>暂无数据指标</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {dataIndicators.map((indicator) => (
          <a
            key={indicator.id}
            href={indicator.url}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.item}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={indicator.description}
          >
            <div style={styles.itemContent}>
              <span style={styles.name}>{indicator.name}</span>
            </div>
            <span style={styles.externalIcon}>↗</span>
          </a>
        ))}
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
    minHeight: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    textDecoration: 'none',
    color: '#d1d4dc',
    transition: 'background-color 0.2s',
    cursor: 'pointer',
  },
  itemContent: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#d1d4dc',
  },
  externalIcon: {
    fontSize: '0.875rem',
    color: '#9ca3b0',
    opacity: 0.6,
    flexShrink: 0,
    marginLeft: '0.5rem',
  },
  emptyState: {
    padding: '2rem 1rem',
    textAlign: 'center',
    color: '#9ca3b0',
  },
  emptyText: {
    fontSize: '0.875rem',
    fontWeight: '500',
    margin: '0.5rem 0',
  },
};

