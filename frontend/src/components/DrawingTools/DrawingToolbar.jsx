/**
 * 绘图工具栏组件
 * 提供绘图工具的选择按钮
 */
export default function DrawingToolbar({ activeTool, onToolSelect }) {
  const tools = [
    {
      id: 'line',
      name: '趋势线',
      icon: '📈',
      tooltip: '绘制趋势线'
    },
    {
      id: 'rectangle',
      name: '矩形',
      icon: '▭',
      tooltip: '绘制矩形'
    },
    {
      id: 'horizontal_line',
      name: '水平线',
      icon: '—',
      tooltip: '绘制水平线（支撑/阻力）'
    },
    {
      id: 'vertical_line',
      name: '垂直线',
      icon: '│',
      tooltip: '绘制垂直线（时间标记）'
    }
  ];

  return (
    <div className="drawing-toolbar" style={styles.toolbar}>
      <div style={styles.label}>绘图工具：</div>
      
      {tools.map(tool => (
        <button
          key={tool.id}
          className={activeTool === tool.id ? 'active' : ''}
          onClick={() => onToolSelect(tool.id)}
          title={tool.tooltip}
          style={{
            ...styles.button,
            ...(activeTool === tool.id ? styles.activeButton : {})
          }}
        >
          <span style={styles.icon}>{tool.icon}</span>
        </button>
      ))}
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    marginLeft: '1rem'
  },
  label: {
    color: '#d1d4dc',
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem',
    backgroundColor: '#3a3a4a',
    color: '#d1d4dc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s',
    outline: 'none',
    minWidth: '36px',
    minHeight: '36px'
  },
  activeButton: {
    backgroundColor: '#2962FF',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(41, 98, 255, 0.3)'
  },
  icon: {
    fontSize: '1.25rem'
  }
};

