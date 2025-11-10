import { useState } from 'react';

/**
 * 绘图列表组件
 * 显示所有已绘制的图形，支持删除、可见性切换和颜色修改
 */
export default function DrawingList({ drawings, onDelete, onToggleVisibility, onChangeColor }) {
  const [showColorPicker, setShowColorPicker] = useState(null); // 当前显示颜色选择器的drawingId
  
  // 预设颜色列表
  const presetColors = [
    '#2962FF', // 蓝色
    '#00C853', // 绿色
    '#FF6D00', // 橙色
    '#D500F9', // 紫色
    '#FFEB3B', // 黄色
    '#F44336', // 红色
    '#00BCD4', // 青色
    '#E91E63', // 粉色
    '#9C27B0', // 紫红
    '#FFFFFF', // 白色
  ];
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
      <div style={styles.list}>
        {drawings.map((drawing, index) => {
          const points = drawing.getPoints ? drawing.getPoints() : [];
          const firstPoint = points[0];
          const isVisible = drawing.visible !== false; // 默认可见
          const currentColor = drawing.style?.color || '#2962FF';
          
          return (
            <div 
              key={drawing.drawingId || index} 
              style={{
                ...styles.item,
                opacity: isVisible ? 1 : 0.5
              }}
            >
              <div style={styles.itemInfo}>
                <div style={styles.itemType}>
                  <span style={styles.typeIcon}>
                    {getDrawingIcon(drawing.type)}
                  </span>
                  <span style={styles.typeName}>
                    {getDrawingTypeName(drawing.type)}
                  </span>
                  {/* 颜色指示器 */}
                  <span 
                    style={{
                      ...styles.colorIndicator,
                      backgroundColor: currentColor
                    }}
                  />
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
              
              <div style={styles.buttonGroup}>
                {/* 可见性按钮 */}
                <button
                  onClick={() => onToggleVisibility(drawing.drawingId)}
                  style={styles.actionButton}
                  title={isVisible ? "隐藏" : "显示"}
                >
                  {isVisible ? '👁️' : '👁️‍🗨️'}
                </button>
                
                {/* 颜色按钮 */}
                <div style={styles.colorButtonContainer}>
                  <button
                    onClick={() => setShowColorPicker(
                      showColorPicker === drawing.drawingId ? null : drawing.drawingId
                    )}
                    style={styles.actionButton}
                    title="修改颜色"
                  >
                    🎨
                  </button>
                  
                  {/* 颜色选择器弹窗 */}
                  {showColorPicker === drawing.drawingId && (
                    <div style={styles.colorPicker}>
                      <div style={styles.colorPickerHeader}>
                        <span style={styles.colorPickerTitle}>选择颜色</span>
                        <button
                          onClick={() => setShowColorPicker(null)}
                          style={styles.closeButton}
                        >
                          ×
                        </button>
                      </div>
                      <div style={styles.colorGrid}>
                        {presetColors.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              onChangeColor(drawing.drawingId, color);
                              setShowColorPicker(null);
                            }}
                            style={{
                              ...styles.colorOption,
                              backgroundColor: color,
                              border: currentColor === color ? '2px solid #fff' : '1px solid #555'
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 删除按钮 */}
                <button
                  onClick={() => onDelete(drawing.drawingId)}
                  style={styles.deleteButton}
                  title="删除此绘图"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
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
  buttonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  actionButton: {
    padding: '0.375rem 0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a5a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
    color: '#9ca3b0',
    minWidth: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteButton: {
    padding: '0.375rem 0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #4a4a5a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
    color: '#ef5350',
    minWidth: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  colorIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    marginLeft: '0.25rem'
  },
  colorButtonContainer: {
    position: 'relative'
  },
  colorPicker: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '0.5rem',
    backgroundColor: '#2a2a3a',
    border: '1px solid #4a4a5a',
    borderRadius: '8px',
    padding: '0.75rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    minWidth: '200px'
  },
  colorPickerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #3a3a4a'
  },
  colorPickerTitle: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: '#d1d4dc'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#9ca3b0',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '0.5rem'
  },
  colorOption: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: 0
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

