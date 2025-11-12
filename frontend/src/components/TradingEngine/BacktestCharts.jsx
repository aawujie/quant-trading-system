import KlineChart from './KlineChart';
import EquityCurve from './EquityCurve';
import BalanceCurve from './BalanceCurve';

/**
 * 回测图表组件容器
 * 
 * 统一管理K线图、收益率曲线、资金曲线三个图表
 */
export default function BacktestCharts({ backtestResult, onClose }) {
  if (!backtestResult) return null;
  
  const displayInfo = backtestResult.getDisplayInfo();
  
  return (
    <div className="bg-[#0a0a0f] rounded-lg p-6 border border-[#2a2a3a] space-y-4">
      {/* 头部信息 */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xl font-semibold text-white">
            {displayInfo.title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {displayInfo.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-bold ${displayInfo.returnClass}`}>
            {displayInfo.returnLabel}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-[#2a2a3a] hover:bg-[#3a3a4a] text-gray-300 rounded transition-colors"
            >
              关闭图表
            </button>
          )}
        </div>
      </div>
      
      {/* K线图 */}
      <KlineChart backtestResult={backtestResult} />
      
      {/* 曲线图（并排） */}
      <div className="grid grid-cols-2 gap-4">
        <EquityCurve backtestResult={backtestResult} />
        <BalanceCurve backtestResult={backtestResult} />
      </div>
      
      {/* 提示信息 */}
      <div className="text-xs text-gray-500 text-center">
        💡 提示：鼠标悬停在图表上可查看详细数据
      </div>
    </div>
  );
}

