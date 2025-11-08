import { useState } from 'react';
import HistoricalDownload from './HistoricalDownload';
import DataStats from './DataStats';
import DataRepair from './DataRepair';

export default function DataManager() {
  const [activeTab, setActiveTab] = useState('download'); // 'download' | 'repair'

  return (
    <div className="w-full h-full bg-[#0a0a0f] overflow-auto">
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">数据管理中心</h2>
          
          {/* Tab切换 */}
          <div className="flex gap-2 border-b border-[#2a2a3a]">
            <button
              onClick={() => setActiveTab('download')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'download'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📥 历史数据下载
            </button>
            <button
              onClick={() => setActiveTab('repair')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'repair'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🔧 数据修复
            </button>
          </div>
        </div>

        {/* Tab内容 */}
        {activeTab === 'download' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <HistoricalDownload />
            </div>
            <div className="lg:col-span-1">
              <DataStats />
            </div>
          </div>
        )}

        {activeTab === 'repair' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DataRepair />
            </div>
            <div className="lg:col-span-1">
              <DataStats />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

