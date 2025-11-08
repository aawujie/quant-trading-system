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
    },
    {
      id: 'fibonacci',
      name: '斐波那契',
      icon: 'φ',
      tooltip: '绘制斐波那契回撤'
    },
    {
      id: 'parallel_line',
      name: '平行线',
      icon: '∥',
      tooltip: '绘制平行线'
    }
  ];

  return (
    <>
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
    </>
  );
}

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    backgroundColor: '#3a3a4a',
    color: '#d1d4dc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
    outline: 'none',
    minWidth: '42px'
  },
  activeButton: {
    backgroundColor: '#2962FF',
    color: '#ffffff',
    boxShadow: '0 2px 4px rgba(41, 98, 255, 0.3)'
  },
  icon: {
    fontSize: '16px'
  }
};

