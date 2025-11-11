import { createContext, useContext, useState, useEffect } from 'react';
import { getStrategies, getPositionPresets, getAIConfig } from '../services/tradingEngineApi';

const TradingEngineContext = createContext(null);

export function TradingEngineProvider({ children }) {
  // 共享的配置数据
  const [strategies, setStrategies] = useState([]);
  const [strategyDetails, setStrategyDetails] = useState({});
  const [presets, setPresets] = useState([]);
  const [aiConfig, setAiConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 只在Provider挂载时加载一次
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [strategiesData, presetsData, aiConfigData] = await Promise.all([
          getStrategies().catch(() => []),
          getPositionPresets().catch(() => []),
          getAIConfig().catch(() => ({ enabled: false })),
        ]);
        
        if (strategiesData && strategiesData.length > 0) {
          setStrategies(strategiesData);
          
          const details = {};
          strategiesData.forEach(strategy => {
            details[strategy.name] = {
              name: strategy.display_name || strategy.name,
              description: strategy.description || '',
              icon: strategy.icon || '📊',
              color: strategy.color || '#4CAF50',
              params: strategy.parameters || {}
            };
          });
          setStrategyDetails(details);
        }
        
        if (presetsData && Array.isArray(presetsData)) {
          setPresets(presetsData);
        }
        
        if (aiConfigData) {
          setAiConfig(aiConfigData);
        }
      } catch (err) {
        console.error('Failed to load trading engine config:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const value = {
    strategies,
    strategyDetails,
    presets,
    aiConfig,
    loading,
    error,
  };

  return (
    <TradingEngineContext.Provider value={value}>
      {children}
    </TradingEngineContext.Provider>
  );
}

// 自定义Hook方便使用
export function useTradingEngineConfig() {
  const context = useContext(TradingEngineContext);
  if (!context) {
    throw new Error('useTradingEngineConfig must be used within TradingEngineProvider');
  }
  return context;
}

