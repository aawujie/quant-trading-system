import { useState, useEffect } from 'react';

export default function BrowserCache() {
  const [cacheData, setCacheData] = useState({
    oldIndicators: [],
    newIndicators: [],
    klineData: [],
    indicatorData: [],
    otherKeys: []
  });
  const [message, setMessage] = useState(null);

  // 分析localStorage
  const analyzeCache = () => {
    const oldIndicators = [];
    const newIndicators = [];
    const klineData = [];
    const indicatorData = [];
    const otherKeys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const value = localStorage.getItem(key);
      const size = new Blob([value]).size;

      if (key.startsWith('indicators_')) {
        const parts = key.split('_');
        if (parts.length === 3) {
          // 旧格式：indicators_BTCUSDT_1h
          oldIndicators.push({ key, value, size });
        } else if (parts.length === 2) {
          // 新格式：indicators_BTCUSDT
          newIndicators.push({ key, value, size });
        }
      } else if (key.startsWith('kline_') || key.includes('klines')) {
        // K线缓存数据
        try {
          const data = JSON.parse(value);
          const count = Array.isArray(data) ? data.length : Object.keys(data).length;
          klineData.push({ key, value, size, count });
        } catch (e) {
          klineData.push({ key, value, size, count: 0 });
        }
      } else if (key.startsWith('indicator_') || key.includes('indicators')) {
        // 指标缓存数据
        try {
          const data = JSON.parse(value);
          const count = Array.isArray(data) ? data.length : Object.keys(data).length;
          indicatorData.push({ key, value, size, count });
        } catch (e) {
          indicatorData.push({ key, value, size, count: 0 });
        }
      } else {
        // 其他缓存
        otherKeys.push({ key, value, size });
      }
    }

    setCacheData({ oldIndicators, newIndicators, klineData, indicatorData, otherKeys });
  };

  // 清理旧的指标配置
  const cleanupOldIndicators = () => {
    let deletedCount = 0;

    cacheData.oldIndicators.forEach(item => {
      localStorage.removeItem(item.key);
      deletedCount++;
    });

    setMessage({
      type: 'success',
      text: `✅ 成功清理 ${deletedCount} 个旧的指标配置`
    });

    // 重新分析
    setTimeout(() => {
      analyzeCache();
      setMessage(null);
    }, 2000);
  };

  // 清空所有缓存
  const clearAllCache = () => {
    if (!confirm('⚠️ 确定要清空所有浏览器缓存吗？这将清除所有本地设置！')) {
      return;
    }

    localStorage.clear();
    
    setMessage({
      type: 'warning',
      text: '🗑️ 已清空所有浏览器缓存'
    });

    setTimeout(() => {
      analyzeCache();
      setMessage(null);
    }, 2000);
  };

  // 导出配置
  const exportConfig = () => {
    const config = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        config[key] = localStorage.getItem(key);
      }
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-cache-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setMessage({
      type: 'success',
      text: '✅ 配置已导出'
    });

    setTimeout(() => setMessage(null), 2000);
  };

  // 导入配置
  const importConfig = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        
        if (!confirm(`⚠️ 确定要导入配置吗？将覆盖现有的 ${Object.keys(config).length} 个配置项！`)) {
          return;
        }

        Object.keys(config).forEach(key => {
          localStorage.setItem(key, config[key]);
        });

        setMessage({
          type: 'success',
          text: `✅ 成功导入 ${Object.keys(config).length} 个配置项`
        });

        setTimeout(() => {
          analyzeCache();
          setMessage(null);
        }, 2000);
      } catch (err) {
        setMessage({
          type: 'error',
          text: '❌ 导入失败：' + err.message
        });
      }
    };
    reader.readAsText(file);
  };

  // 初始化时分析
  useEffect(() => {
    analyzeCache();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const totalSize = [...cacheData.oldIndicators, ...cacheData.newIndicators, ...cacheData.klineData, ...cacheData.indicatorData, ...cacheData.otherKeys]
    .reduce((sum, item) => sum + item.size, 0);
  
  const totalKlineCount = cacheData.klineData.reduce((sum, item) => sum + (item.count || 0), 0);
  const totalIndicatorCount = cacheData.indicatorData.reduce((sum, item) => sum + (item.count || 0), 0);

  return (
    <div className="space-y-6">
      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' :
          message.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* 缓存统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* K线缓存 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">K线缓存</div>
          <div className="text-2xl font-bold text-cyan-400">
            {totalKlineCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">{cacheData.klineData.length} 个缓存</div>
        </div>

        {/* 指标缓存 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">指标缓存</div>
          <div className="text-2xl font-bold text-green-400">
            {totalIndicatorCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">{cacheData.indicatorData.length} 个缓存</div>
        </div>

        {/* 旧格式指标配置 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">旧格式指标配置</div>
          <div className="text-2xl font-bold text-yellow-400">
            {cacheData.oldIndicators.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">需要清理</div>
        </div>

        {/* 全局指标配置 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">全局指标配置</div>
          <div className="text-2xl font-bold text-blue-400">
            {cacheData.newIndicators.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">正常</div>
        </div>

        {/* 其他缓存 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">其他缓存</div>
          <div className="text-2xl font-bold text-purple-400">
            {cacheData.otherKeys.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">条目</div>
        </div>

        {/* 总大小 */}
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <div className="text-gray-400 text-sm mb-1">总缓存大小</div>
          <div className="text-2xl font-bold text-pink-400">
            {formatBytes(totalSize)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{localStorage.length} 条目</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={analyzeCache}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          🔄 刷新缓存分析
        </button>

        {cacheData.oldIndicators.length > 0 && (
          <button
            onClick={cleanupOldIndicators}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
          >
            🧹 清理旧指标配置
          </button>
        )}

        <button
          onClick={exportConfig}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          📤 导出配置
        </button>

        <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer">
          📥 导入配置
          <input
            type="file"
            accept=".json"
            onChange={importConfig}
            className="hidden"
          />
        </label>

        <button
          onClick={clearAllCache}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          🗑️ 清空所有缓存
        </button>
      </div>

      {/* K线缓存数据 */}
      {cacheData.klineData.length > 0 && (
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3">
            📊 K线缓存数据
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cacheData.klineData.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-[#0a0a0f] rounded"
              >
                <div className="flex-1">
                  <div className="text-sm font-mono text-gray-300">{item.key}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.count || 0} 条 · {formatBytes(item.size)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除 ${item.key} 吗？`)) {
                      localStorage.removeItem(item.key);
                      analyzeCache();
                    }
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 指标缓存数据 */}
      {cacheData.indicatorData.length > 0 && (
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-green-400 mb-3">
            📈 指标缓存数据
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cacheData.indicatorData.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-[#0a0a0f] rounded"
              >
                <div className="flex-1">
                  <div className="text-sm font-mono text-gray-300">{item.key}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.count || 0} 条 · {formatBytes(item.size)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除 ${item.key} 吗？`)) {
                      localStorage.removeItem(item.key);
                      analyzeCache();
                    }
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 旧格式指标配置 */}
      {cacheData.oldIndicators.length > 0 && (
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-yellow-400 mb-3">
            ⚠️ 旧格式指标配置（按时间周期）
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cacheData.oldIndicators.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-[#0a0a0f] rounded"
              >
                <div className="flex-1">
                  <div className="text-sm font-mono text-gray-300">{item.key}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.value}</div>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem(item.key);
                    analyzeCache();
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全局指标配置 */}
      {cacheData.newIndicators.length > 0 && (
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-green-400 mb-3">
            ✅ 全局指标配置
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cacheData.newIndicators.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-[#0a0a0f] rounded"
              >
                <div className="flex-1">
                  <div className="text-sm font-mono text-gray-300">{item.key}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.value}</div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除 ${item.key} 吗？`)) {
                      localStorage.removeItem(item.key);
                      analyzeCache();
                    }
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 其他缓存 */}
      {cacheData.otherKeys.length > 0 && (
        <div className="bg-[#1a1a24] rounded-lg p-4 border border-[#2a2a3a]">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            📦 其他缓存数据
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cacheData.otherKeys.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-[#0a0a0f] rounded"
              >
                <div className="flex-1">
                  <div className="text-sm font-mono text-gray-300">{item.key}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatBytes(item.size)} · {item.value.substring(0, 100)}{item.value.length > 100 ? '...' : ''}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除 ${item.key} 吗？`)) {
                      localStorage.removeItem(item.key);
                      analyzeCache();
                    }
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

