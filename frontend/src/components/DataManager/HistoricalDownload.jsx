import { useState, useEffect } from 'react';
import {
  createDownloadTask,
  listDownloadTasks,
  getDownloadTask,
  cancelDownloadTask
} from '../../services/dataManagerApi';

export default function HistoricalDownload() {
  const [formData, setFormData] = useState({
    symbols: ['BTCUSDT'],
    timeframes: ['1h'],
    startDate: '',
    endDate: '',
    marketType: 'future'
  });

  const [tasks, setTasks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const availableSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'MATICUSDT'];
  const availableTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

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

  const toggleSymbol = (symbol) => {
    setFormData(prev => {
      const symbols = prev.symbols.includes(symbol)
        ? prev.symbols.filter(s => s !== symbol)
        : [...prev.symbols, symbol];
      return { ...prev, symbols };
    });
  };

  const toggleTimeframe = (timeframe) => {
    setFormData(prev => {
      const timeframes = prev.timeframes.includes(timeframe)
        ? prev.timeframes.filter(t => t !== timeframe)
        : [...prev.timeframes, timeframe];
      return { ...prev, timeframes };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (formData.symbols.length === 0) {
      setError('请至少选择一个币种');
      return;
    }
    
    if (formData.timeframes.length === 0) {
      setError('请至少选择一个时间周期');
      return;
    }

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

      // 为每个币种和时间周期组合创建任务
      const tasks = [];
      for (const symbol of formData.symbols) {
        for (const timeframe of formData.timeframes) {
          tasks.push(
            createDownloadTask({
              symbol,
              timeframe,
              startTime,
              endTime,
              marketType: formData.marketType,
              autoStart: true
            })
          );
        }
      }

      await Promise.all(tasks);
      console.log(`✅ 已创建 ${tasks.length} 个下载任务`);
      
      // 重新加载任务列表
      await loadTasks();
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
    <div className="space-y-6">
      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">创建下载任务</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择币种 ({formData.symbols.length} 个)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSymbols.map(symbol => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    formData.symbols.includes(symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择时间周期 ({formData.timeframes.length} 个)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTimeframes.map(tf => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    formData.timeframes.includes(tf)
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              市场类型
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, marketType: 'spot' }))}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  formData.marketType === 'spot'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                }`}
              >
                现货
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, marketType: 'future' }))}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  formData.marketType === 'future'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a3a] text-gray-300 hover:bg-[#3a3a4a]'
                }`}
              >
                永续合约
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                开始时间
              </label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-[#0f0f17] border border-[#2a2a3a] rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                结束时间
              </label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-[#0f0f17] border border-[#2a2a3a] rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-300 text-sm">
            将创建 <span className="font-semibold">{formData.symbols.length} × {formData.timeframes.length} = {formData.symbols.length * formData.timeframes.length}</span> 个下载任务
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          >
            {isSubmitting ? '创建中...' : '开始下载'}
          </button>
        </form>
      </div>

      <div className="bg-[#1a1a24] rounded-lg border border-[#2a2a3a] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">下载任务列表 ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">暂无下载任务</p>
            <p className="text-sm text-gray-500">
              创建第一个任务开始下载历史数据
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.task_id} className="bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{task.symbol}</span>
                    <span className="px-2 py-0.5 bg-[#2a2a3a] rounded text-xs text-gray-300">{task.timeframe}</span>
                    <span className="px-2 py-0.5 bg-[#2a2a3a] rounded text-xs text-gray-300">
                      {task.market_type === 'spot' ? '现货' : '永续'}
                    </span>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ 
                      color: getStatusColor(task.status),
                      backgroundColor: `${getStatusColor(task.status)}20`
                    }}
                  >
                    {getStatusText(task.status)}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <span>📅 {formatTimestamp(task.start_time)}</span>
                  <span>→</span>
                  <span>{formatTimestamp(task.end_time)}</span>
                </div>

                {task.status === 'downloading' && (
                  <div className="space-y-2">
                    <div className="w-full bg-[#2a2a3a] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                      {task.progress}% ({task.downloaded_count.toLocaleString()} / {task.total_count.toLocaleString()})
                    </div>
                    <button
                      onClick={() => handleCancel(task.task_id)}
                      className="w-full px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 text-sm rounded transition-colors"
                    >
                      取消
                    </button>
                  </div>
                )}

                {task.status === 'completed' && (
                  <div className="text-sm text-green-400">
                    ✅ 已完成 - 下载了 {task.downloaded_count.toLocaleString()} 条K线
                  </div>
                )}

                {task.status === 'failed' && task.error_message && (
                  <div className="text-sm text-red-400">
                    ❌ 错误: {task.error_message}
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

