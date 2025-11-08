/**
 * 指标管理按钮组件
 * 显示在工具栏上，点击打开指标选择弹窗
 */
export default function IndicatorButton({ onClick, indicatorCount = 0 }) {
  return (
    <button
      onClick={onClick}
      style={styles.button}
      onMouseOver={(e) => {
        e.target.style.background = '#444';
        e.target.style.borderColor = '#555';
      }}
      onMouseOut={(e) => {
        e.target.style.background = 'transparent';
        e.target.style.borderColor = '#444';
      }}
      title="Indicator Settings"
    >
      <span style={styles.icon}>📊</span>
      {indicatorCount > 0 && (
        <span style={styles.badge}>{indicatorCount}</span>
      )}
    </button>
  );
}

const styles = {
  button: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1rem',
    background: 'transparent',
    color: '#888',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
    minWidth: '42px'
  },
  icon: {
    fontSize: '16px'
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: '#2962FF',
    color: '#fff',
    borderRadius: '10px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: '600',
    minWidth: '18px',
    textAlign: 'center'
  }
};

