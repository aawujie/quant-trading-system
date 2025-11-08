import HistoricalDownload from './HistoricalDownload';
import DataStats from './DataStats';

export default function DataManager() {
  return (
    <div className="w-full h-full bg-[#0a0a0f] overflow-auto">
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">数据管理中心</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HistoricalDownload />
          </div>
          <div className="lg:col-span-1">
            <DataStats />
          </div>
        </div>
      </div>
    </div>
  );
}

