import { useState, useEffect } from 'react';
import { INDICATORS, INDICATOR_CATEGORIES, INDICATOR_TYPES } from './IndicatorConfig';

/**
 * 指标选择弹窗组件
 * 
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {function} onClose - 关闭弹窗回调
 * @param {string[]} selectedIndicators - 当前选中的指标ID列表
 * @param {function} onConfirm - 确认选择回调
 */
export default function IndicatorModal({ isOpen, onClose, selectedIndicators, onConfirm }) {
  const [tempSelected, setTempSelected] = useState([]);

  // 同步选中状态
  useEffect(() => {
    if (isOpen) {
      setTempSelected([...selectedIndicators]);
    }
  }, [isOpen, selectedIndicators]);

  if (!isOpen) return null;

  // 切换指标选中状态
  const toggleIndicator = (indicatorId) => {
    if (tempSelected.includes(indicatorId)) {
      setTempSelected(tempSelected.filter(id => id !== indicatorId));
    } else {
      setTempSelected([...tempSelected, indicatorId]);
    }
  };

  // 全选分类
  const selectCategory = (categoryId) => {
    const category = INDICATOR_CATEGORIES[categoryId];
    const newSelected = [...tempSelected];
    
    category.indicators.forEach(id => {
      if (!newSelected.includes(id)) {
        newSelected.push(id);
      }
    });
    
    setTempSelected(newSelected);
  };

  // 取消选择分类
  const deselectCategory = (categoryId) => {
    const category = INDICATOR_CATEGORIES[categoryId];
    setTempSelected(tempSelected.filter(id => !category.indicators.includes(id)));
  };

  // 确认选择
  const handleConfirm = () => {
    onConfirm(tempSelected);
    onClose();
  };

  // 重置为默认
  const handleReset = () => {
    const defaultIndicators = Object.values(INDICATORS)
      .filter(ind => ind.defaultVisible)
      .map(ind => ind.id);
    setTempSelected(defaultIndicators);
  };

  // 渲染指标项
  const renderIndicatorItem = (indicator) => {
    const isSelected = tempSelected.includes(indicator.id);
    
    return (
      <div
        key={indicator.id}
        onClick={() => toggleIndicator(indicator.id)}
        style={{
          ...styles.indicatorItem,
          ...(isSelected ? styles.indicatorItemSelected : {})
        }}
      >
        <div style={styles.indicatorInfo}>
          <div style={styles.indicatorColor} 
               data-color={typeof indicator.color === 'string' ? indicator.color : indicator.color.line}>
            <div style={{
              width: '20px',
              height: '3px',
              backgroundColor: typeof indicator.color === 'string' ? indicator.color : indicator.color.line,
              borderRadius: '2px'
            }} />
          </div>
          <div>
            <div style={styles.indicatorName}>{indicator.name}</div>
            <div style={styles.indicatorDesc}>{indicator.description}</div>
          </div>
        </div>
        <div style={styles.indicatorType}>
          <span style={{
            ...styles.typeBadge,
            ...(indicator.type === INDICATOR_TYPES.MAIN ? styles.mainBadge : styles.subBadge)
          }}>
            {indicator.type === INDICATOR_TYPES.MAIN ? 'Main' : 'Sub'}
          </span>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            style={styles.checkbox}
          />
        </div>
      </div>
    );
  };

  // 渲染分类
  const renderCategory = (categoryId) => {
    const category = INDICATOR_CATEGORIES[categoryId];
    const indicators = category.indicators.map(id => INDICATORS[id]);
    const allSelected = indicators.every(ind => tempSelected.includes(ind.id));
    const someSelected = indicators.some(ind => tempSelected.includes(ind.id)) && !allSelected;

    return (
      <div key={categoryId} style={styles.category}>
        <div style={styles.categoryHeader}>
          <div style={styles.categoryTitle}>{category.name}</div>
          <button
            onClick={() => allSelected ? deselectCategory(categoryId) : selectCategory(categoryId)}
            style={{
              ...styles.categoryButton,
              ...(allSelected ? styles.categoryButtonActive : {})
            }}
          >
            {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
          </button>
        </div>
        <div style={styles.indicatorList}>
          {indicators.map(ind => renderIndicatorItem(ind))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Indicator Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        {/* Stats */}
        <div style={styles.stats}>
          <span>{tempSelected.length} indicators selected</span>
          <button onClick={handleReset} style={styles.resetButton}>
            Reset to Default
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {Object.keys(INDICATOR_CATEGORIES).map(categoryId => renderCategory(categoryId))}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={handleConfirm} style={styles.confirmButton}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#1e1e2e',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #2a2a3a'
  },
  title: {
    margin: 0,
    color: '#d1d4dc',
    fontSize: '1.5rem',
    fontWeight: '600'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3b0',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    backgroundColor: '#2a2a3a',
    color: '#9ca3b0',
    fontSize: '0.875rem'
  },
  resetButton: {
    padding: '0.375rem 0.75rem',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#9ca3b0',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.5rem'
  },
  category: {
    marginBottom: '1.5rem'
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem'
  },
  categoryTitle: {
    color: '#d1d4dc',
    fontSize: '1rem',
    fontWeight: '600'
  },
  categoryButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#9ca3b0',
    cursor: 'pointer',
    fontSize: '0.75rem',
    transition: 'all 0.2s'
  },
  categoryButtonActive: {
    backgroundColor: '#2962FF',
    borderColor: '#2962FF',
    color: '#fff'
  },
  indicatorList: {
    display: 'grid',
    gap: '0.5rem'
  },
  indicatorItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#2a2a3a',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid transparent'
  },
  indicatorItemSelected: {
    backgroundColor: '#2962FF20',
    borderColor: '#2962FF'
  },
  indicatorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1
  },
  indicatorColor: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  indicatorName: {
    color: '#d1d4dc',
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '0.125rem'
  },
  indicatorDesc: {
    color: '#9ca3b0',
    fontSize: '0.75rem'
  },
  indicatorType: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  typeBadge: {
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  mainBadge: {
    backgroundColor: '#4CAF5020',
    color: '#4CAF50'
  },
  subBadge: {
    backgroundColor: '#FF980020',
    color: '#FF9800'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #2a2a3a'
  },
  cancelButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#9ca3b0',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  confirmButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#2962FF',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s'
  }
};

