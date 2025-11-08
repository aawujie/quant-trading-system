import { useState, useEffect } from 'react';
import HistoricalDownload from './HistoricalDownload';
import DataStats from './DataStats';
import './DataManager.css';

export default function DataManager() {
  const [activeTab, setActiveTab] = useState('download');

  return (
    <div className="data-manager">
      <div className="data-manager-header">
        <h2>📊 数据管理中心</h2>
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => setActiveTab('download')}
          >
            📥 历史下载
          </button>
          <button
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            📈 数据统计
          </button>
        </div>
      </div>

      <div className="data-manager-content">
        {activeTab === 'download' && <HistoricalDownload />}
        {activeTab === 'stats' && <DataStats />}
      </div>
    </div>
  );
}

