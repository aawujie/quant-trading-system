import { useState, useEffect } from 'react';
import { BacktestResult } from '../../utils/BacktestResult';

/**
 * 回测历史列表组件
 * 
 * 功能：
 * - 显示历史回测记录列表
 * - 支持按symbol筛选（显示所有策略）
 * - 支持排序（时间/收益率/夏普比率/胜率）
 * - 点击加载完整回测数据
 */
export default function BacktestHistoryList({ onSelect, selectedRunId, symbol }) {
  const [backtests, setBacktests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  
  // 当筛选条件变化时重新加载
  useEffect(() => {
    loadBacktests();
  }, [filters, symbol]); // 移除 strategy 依赖
  
  const loadBacktests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: 20,
        offset: 0,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder
      });
      
      // 只按交易对筛选，不筛选策略（显示所有策略的历史）
      if (symbol) params.append('symbol', symbol);
      
      const response = await fetch(`/api/backtest/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 直接使用返回的数据（Pydantic 模型不再包含 status 字段）
      setBacktests(result.data || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Failed to load backtest history:', error);
      setBacktests([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = async (backtest) => {
    try {
      // 加载完整数据（包含signals）
      const response = await fetch(`/api/backtest/detail/${backtest.run_id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load backtest detail: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 直接使用返回的数据
      if (result.data) {
        const backtestResult = new BacktestResult(result.data);
        onSelect(backtestResult);
      }
    } catch (error) {
      console.error('Failed to load backtest detail:', error);
      alert('加载回测详情失败：' + error.message);
    }
  };
  
  const handleDelete = async (runId, event) => {
    event.stopPropagation(); // 阻止触发选择事件
    
    if (!confirm('确定要删除这条回测记录吗？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/backtest/${runId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
      
      // 删除成功，重新加载列表
      loadBacktests();
      
      // 如果删除的是当前选中的，清空选中
      if (selectedRunId === runId) {
        onSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete backtest:', error);
      alert('删除失败：' + error.message);
    }
  };
  
  return (
    <div className="space-y-3">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          📚 回测历史
          {total > 0 && (
            <span className="text-sm text-gray-400 font-normal">
              共 {total} 条
            </span>
          )}
        </h3>
      </div>
      
      {/* 排序选择器 */}
      <div className="flex gap-2">
        <select 
          className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-sm text-white focus:border-blue-500 focus:outline-none"
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
        >
          <option value="created_at">最新创建</option>
          <option value="total_return">收益率</option>
          <option value="sharpe_ratio">夏普比率</option>
          <option value="win_rate">胜率</option>
        </select>
        
        <button
          className="px-3 py-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded text-white hover:border-[#3a3a4a] transition-colors"
          onClick={loadBacktests}
          title="刷新"
        >
          🔄
        </button>
      </div>
      
      {/* 列表 */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-2 animate-spin">⏳</div>
            <div className="text-sm text-gray-400">加载中...</div>
          </div>
        ) : backtests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-2 opacity-30">📭</div>
            <div className="text-sm text-gray-400">暂无回测记录</div>
          </div>
        ) : (
          backtests.map(bt => (
            <BacktestItem
              key={bt.id}
              backtest={bt}
              isSelected={bt.run_id === selectedRunId}
              onClick={() => handleSelect(bt)}
              onDelete={(e) => handleDelete(bt.run_id, e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 单个回测记录项
 */
function BacktestItem({ backtest, isSelected, onClick, onDelete }) {
  const returnValue = backtest.total_return || 0;
  const returnClass = returnValue >= 0 ? 'text-green-400' : 'text-red-400';
  const returnLabel = `${returnValue >= 0 ? '+' : ''}${(returnValue * 100).toFixed(2)}%`;
  
  const winRate = backtest.win_rate || 0;
  const totalTrades = backtest.total_trades || 0;
  
  // 策略图标映射
  const strategyIcons = {
    'dual_ma': '📊',
    'macd': '📈',
    'rsi': '📉',
    'bollinger': '🎯'
  };
  const icon = strategyIcons[backtest.strategy_name] || '📊';
  
  return (
    <div
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all group ${
        isSelected 
          ? 'border-blue-400 bg-blue-400/10' 
          : 'border-[#2a2a3a] hover:border-[#3a3a4a] bg-[#1a1a2e] hover:bg-[#1a1a2e]/80'
      }`}
      onClick={onClick}
    >
      {/* 第一行：策略名称和收益率 */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="font-semibold text-white text-sm">
              {backtest.strategy_name}
            </div>
            <div className="text-xs text-gray-400">
              {backtest.symbol} {backtest.timeframe}
            </div>
          </div>
        </div>
        <div className={`font-bold text-lg ${returnClass}`}>
          {returnLabel}
        </div>
      </div>
      
      {/* 第二行：核心指标 */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center">
          <div className="text-xs text-gray-500">夏普</div>
          <div className="text-sm font-semibold text-gray-300">
            {backtest.sharpe_ratio?.toFixed(2) || '-'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">胜率</div>
          <div className="text-sm font-semibold text-gray-300">
            {(winRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">交易</div>
          <div className="text-sm font-semibold text-gray-300">
            {totalTrades}笔
          </div>
        </div>
      </div>
      
      {/* 第三行：时间和操作按钮 */}
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {new Date(backtest.created_at).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        
        {/* 删除按钮 */}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-all"
          title="删除"
        >
          🗑️ 删除
        </button>
      </div>
    </div>
  );
}

