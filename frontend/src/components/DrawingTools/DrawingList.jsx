/**
 * 绘图列表组件
 * 显示所有已绘制的图形，支持删除
 */
export default function DrawingList({ drawings, onDelete }) {
  const getDrawingTypeName = (type) => {
    const typeMap = {
      'trend_line': '趋势线',
      'rectangle': '矩形',
      'horizontal_line': '水平线',
      'vertical_line': '垂直线',
      'fibonacci': '斐波那契',
      'parallel_line': '平行线'
    };
    return typeMap[type] || type;
  };

  const getDrawingIcon = (type) => {
    const iconMap = {
      'trend_line': '📈',
      'rectangle': '▭',
      'horizontal_line': '—',
      'vertical_line': '│',
      'fibonacci': 'φ',
      'parallel_line': '||'
    };
    return iconMap[type] || '🎨';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (drawings.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>🎨</span>
        <p style={styles.emptyText}>暂无绘图</p>
        <p style={styles.emptyHint}>选择工具开始绘制</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>绘图列表 ({drawings.length})</span>
      </div>
      
      <div style={styles.list}>
        {[...drawings].reverse().map((drawing, index) => {
          const points = drawing.getPoints ? drawing.getPoints() : [];
          const firstPoint = points[0];
          
          return (
            <div key={drawing.drawingId || index} style={styles.item}>
              <div style={styles.itemInfo}>
                <div style={styles.itemType}>
                  <span style={styles.typeIcon}>
                    {getDrawingIcon(drawing.type)}
                  </span>
                  <span style={styles.typeName}>
                    {getDrawingTypeName(drawing.type)}
                  </span>
                </div>
                
                {firstPoint && (
                  <div style={styles.itemDetail}>
                    <span style={styles.detailText}>
                      ${firstPoint.price?.toFixed(2) || 'N/A'}
                    </span>
                    {drawing.created_at && (
                      <span style={styles.detailTime}>
                        {formatTime(drawing.created_at)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => onDelete(drawing.drawingId)}
                style={styles.deleteButton}
                title="删除此绘图"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    padding: '0.75rem 1rem',
    backgroundColor: '#3a3a4a',
    borderBottom: '1px solid #4a4a5a'
  },
  title: {
    color: '#d1d4dc',
    fontSize: '0.875rem',
    fontWeight: '600'
  },
  list: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #3a3a4a',
    transition: 'background-color 0.2s'
  },
  itemInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  itemType: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  typeIcon: {
    fontSize: '1rem'
  },
  typeName: {
    color: '#d1d4dc',
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  itemDetail: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: '#9ca3b0'
  },
  detailText: {
    fontWeight: '500'
  },
  detailTime: {
    opacity: 0.7
  },
  deleteButton: {
    padding: '0.375rem 0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a5a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
    color: '#ef5350'
  },
  emptyState: {
    padding: '2rem 1rem',
    textAlign: 'center',
    color: '#9ca3b0'
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '0.5rem'
  },
  emptyText: {
    fontSize: '0.875rem',
    fontWeight: '500',
    margin: '0.5rem 0'
  },
  emptyHint: {
    fontSize: '0.75rem',
    opacity: 0.7,
    margin: '0.25rem 0'
  }
};

