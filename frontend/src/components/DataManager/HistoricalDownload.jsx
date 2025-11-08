import { useState, useEffect } from 'react';
import {
  createDownloadTask,
  listDownloadTasks,
  getDownloadTask,
  cancelDownloadTask
} from '../../services/dataManagerApi';

export default function HistoricalDownload() {
  const [formData, setFormData] = useState({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: '',
    endDate: '',
    marketType: 'future'
  });

  const [tasks, setTasks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 加载任务列表
  useEffect(() => {
    loadTasks();
    
    // 每3秒刷新一次任务状态
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    try {
      const response = await listDownloadTasks();
      if (response.status === 'success') {
        setTasks(response.tasks);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 转换日期为时间戳
      const startTime = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(formData.endDate).getTime() / 1000);

      if (startTime >= endTime) {
        setError('开始时间必须早于结束时间');
        setIsSubmitting(false);
        return;
      }

      const response = await createDownloadTask({
        symbol: formData.symbol,
        timeframe: formData.timeframe,
        startTime,
        endTime,
        marketType: formData.marketType,
        autoStart: true
      });

      if (response.status === 'success') {
        console.log('✅ 下载任务已创建:', response.task);
        // 重新加载任务列表
        await loadTasks();
        
        // 清空表单（可选）
        // setFormData({ ...formData, startDate: '', endDate: '' });
      }
    } catch (err) {
      console.error('Failed to create download task:', err);
      setError(err.response?.data?.detail || '创建任务失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (taskId) => {
    try {
      await cancelDownloadTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'downloading': return '#2196F3';
      case 'failed': return '#f44336';
      case 'cancelled': return '#9E9E9E';
      default: return '#FFC107';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '等待中';
      case 'downloading': return '下载中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="historical-download">
      <div className="download-form-section">
        <h3>创建下载任务</h3>
        <form onSubmit={handleSubmit} className="download-form">
          <div className="form-row">
            <div className="form-group">
              <label>币种</label>
              <select
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                required
              >
                <option value="BTCUSDT">BTCUSDT</option>
                <option value="ETHUSDT">ETHUSDT</option>
                <option value="BNBUSDT">BNBUSDT</option>
                <option value="SOLUSDT">SOLUSDT</option>
                <option value="ADAUSDT">ADAUSDT</option>
              </select>
            </div>

            <div className="form-group">
              <label>时间周期</label>
              <select
                name="timeframe"
                value={formData.timeframe}
                onChange={handleInputChange}
                required
              >
                <option value="1m">1分钟</option>
                <option value="3m">3分钟</option>
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1d">1天</option>
              </select>
            </div>

            <div className="form-group">
              <label>市场类型</label>
              <select
                name="marketType"
                value={formData.marketType}
                onChange={handleInputChange}
                required
              >
                <option value="spot">现货</option>
                <option value="future">永续合约</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>开始时间</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>结束时间</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? '创建中...' : '🚀 开始下载'}
          </button>
        </form>
      </div>

      <div className="tasks-section">
        <h3>下载任务列表 ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <div className="no-tasks">
            <p>暂无下载任务</p>
            <p style={{ fontSize: '0.9em', color: '#888' }}>
              创建第一个任务开始下载历史数据
            </p>
          </div>
        ) : (
          <div className="tasks-list">
            {tasks.map(task => (
              <div key={task.task_id} className="task-card">
                <div className="task-header">
                  <div className="task-title">
                    <strong>{task.symbol}</strong>
                    <span className="task-timeframe">{task.timeframe}</span>
                    <span className="task-market-type">
                      {task.market_type === 'spot' ? '现货' : '永续'}
                    </span>
                  </div>
                  <div
                    className="task-status"
                    style={{ color: getStatusColor(task.status) }}
                  >
                    {getStatusText(task.status)}
                  </div>
                </div>

                <div className="task-time-range">
                  <span>📅 {formatTimestamp(task.start_time)}</span>
                  <span>→</span>
                  <span>{formatTimestamp(task.end_time)}</span>
                </div>

                {task.status === 'downloading' && (
                  <div className="task-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {task.progress}% ({task.downloaded_count.toLocaleString()} / {task.total_count.toLocaleString()})
                    </div>
                  </div>
                )}

                {task.status === 'completed' && (
                  <div className="task-result">
                    ✅ 已完成 - 下载了 {task.downloaded_count.toLocaleString()} 条K线
                  </div>
                )}

                {task.status === 'failed' && task.error_message && (
                  <div className="task-error">
                    ❌ 错误: {task.error_message}
                  </div>
                )}

                {task.status === 'downloading' && (
                  <div className="task-actions">
                    <button
                      onClick={() => handleCancel(task.task_id)}
                      className="cancel-button"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

