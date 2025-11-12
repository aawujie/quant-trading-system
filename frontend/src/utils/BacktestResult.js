import { getKlines } from '../services/tradingEngineApi';

/**
 * 回测结果数据类
 * 
 * 用于封装回测数据，提供便捷的数据访问和计算方法
 */
export class BacktestResult {
  constructor(data) {
    console.log('🔨 BacktestResult: Constructor called with data =', data);
    
    this.data = data;
    
    // 基础标识
    this.runId = data.run_id;
    this.strategy = data.strategy_name;
    this.symbol = data.symbol;
    this.timeframe = data.timeframe;
    this.marketType = data.market_type || 'future';
    
    // 核心指标
    this.totalReturn = data.total_return || 0;
    this.sharpeRatio = data.sharpe_ratio || 0;
    this.maxDrawdown = data.max_drawdown || 0;
    this.winRate = data.win_rate || 0;
    this.totalTrades = data.total_trades || 0;
    this.profitFactor = data.profit_factor || 0;
    
    // 资金指标
    this.initialBalance = data.initial_balance || 10000;
    this.finalBalance = data.final_balance || 10000;
    this.avgHoldingTime = data.avg_holding_time || 0;
    this.maxPositionPct = data.max_position_pct || 0;
    this.avgPositionSize = data.avg_position_size || 0;
    
    // 详细数据
    this.signals = data.signals || [];
    this.metrics = data.metrics || data;
    
    // 时间范围
    this.startTime = data.start_time;
    this.endTime = data.end_time;
    this.createdAt = data.created_at;
    
    // 验证必要字段
    if (!this.startTime || !this.endTime) {
      console.error('⚠️ BacktestResult: Missing time range!', {
        startTime: this.startTime,
        endTime: this.endTime,
        data
      });
    }
    
    console.log('🔨 BacktestResult: Initialized with:', {
      runId: this.runId,
      symbol: this.symbol,
      timeframe: this.timeframe,
      startTime: this.startTime,
      endTime: this.endTime,
      signals: this.signals?.length
    });
    
    // 配置信息
    this.strategyParams = data.strategy_params || {};
    this.positionPreset = data.position_preset;
    
    // 缓存
    this._klines = null;
    this._equityCurve = null;
    this._balanceCurve = null;
  }
  
  /**
   * 加载K线数据
   * @returns {Promise<Array>} K线数据数组
   */
  async loadKlineData() {
    console.log('📊 BacktestResult.loadKlineData: Called');
    console.log('📊 Cached klines:', this._klines?.length || 0);
    
    if (this._klines) {
      console.log('📊 Using cached klines:', this._klines.length);
      return this._klines;
    }
    
    try {
      const params = {
        start_time: this.startTime,
        end_time: this.endTime,
        market_type: this.marketType,
        limit: 10000
      };
      
      console.log('📊 Fetching klines with params:', {
        symbol: this.symbol,
        timeframe: this.timeframe,
        params
      });
      
      const result = await getKlines(this.symbol, this.timeframe, params);
      console.log('📊 Got klines result:', result);
      console.log('📊 Result type:', Array.isArray(result) ? 'Array' : 'Object');
      
      // 后端可能直接返回数组，也可能返回 {klines: [...]} 对象
      this._klines = Array.isArray(result) ? result : (result.klines || []);
      console.log('📊 Cached', this._klines.length, 'klines');
      
      return this._klines;
    } catch (error) {
      console.error('❌ Failed to load kline data:', error);
      return [];
    }
  }
  
  /**
   * 计算权益曲线（累计收益率）
   * @returns {Array} [{time, return, balance}, ...]
   */
  getEquityCurve() {
    if (this._equityCurve) {
      return this._equityCurve;
    }
    
    const curve = [];
    let balance = this.initialBalance;
    
    // 初始点
    curve.push({
      time: this.startTime,
      return: 0,
      balance: balance
    });
    
    // 遍历所有平仓信号，计算累计收益率
    const closeTrades = this.signals
      .filter(s => s.action === 'CLOSE' && s.pnl != null)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    closeTrades.forEach(signal => {
      balance += signal.pnl;
      const returnPct = ((balance / this.initialBalance) - 1) * 100;
      
      curve.push({
        time: signal.timestamp,
        return: returnPct,
        balance: balance
      });
    });
    
    this._equityCurve = curve;
    return curve;
  }
  
  /**
   * 计算账户资金曲线
   * @returns {Array} [{time, balance}, ...]
   */
  getBalanceCurve() {
    if (this._balanceCurve) {
      return this._balanceCurve;
    }
    
    const curve = [];
    let balance = this.initialBalance;
    
    // 初始点
    curve.push({
      time: this.startTime,
      balance: balance
    });
    
    // 遍历所有平仓信号
    const closeTrades = this.signals
      .filter(s => s.action === 'CLOSE' && s.pnl != null)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    closeTrades.forEach(signal => {
      balance += signal.pnl;
      curve.push({
        time: signal.timestamp,
        balance: balance
      });
    });
    
    // 结束点
    curve.push({
      time: this.endTime,
      balance: balance
    });
    
    this._balanceCurve = curve;
    return curve;
  }
  
  /**
   * 获取交易标记点（用于在K线图上显示）
   * @returns {Array} 标记点数组
   */
  getTradeMarkers() {
    return this.signals.map(signal => {
      const isLong = signal.side === 'LONG';
      const isOpen = signal.action === 'OPEN';
      
      return {
        time: signal.timestamp,
        position: isOpen ? 'belowBar' : 'aboveBar',
        color: isLong ? '#26a69a' : '#ef5350',
        shape: isOpen ? 'arrowUp' : 'arrowDown',
        text: `${signal.side} ${signal.action}`,
        price: signal.price,
        signal: signal  // 保留完整信号数据，用于tooltip
      };
    });
  }
  
  /**
   * 获取开仓信号标记
   */
  getOpenMarkers() {
    return this.signals
      .filter(s => s.action === 'OPEN')
      .map(signal => ({
        time: signal.timestamp,
        position: 'belowBar',
        color: signal.side === 'LONG' ? '#26a69a' : '#ef5350',
        shape: 'arrowUp',
        text: `${signal.side}`,
        size: 1
      }));
  }
  
  /**
   * 获取平仓信号标记
   */
  getCloseMarkers() {
    return this.signals
      .filter(s => s.action === 'CLOSE')
      .map(signal => ({
        time: signal.timestamp,
        position: 'aboveBar',
        color: (signal.pnl || 0) >= 0 ? '#26a69a' : '#ef5350',
        shape: 'arrowDown',
        text: signal.pnl ? `${signal.pnl >= 0 ? '+' : ''}${signal.pnl.toFixed(2)}` : 'CLOSE',
        size: 1
      }));
  }
  
  /**
   * 获取显示信息（用于UI展示）
   */
  getDisplayInfo() {
    const startDate = new Date(this.startTime * 1000);
    const endDate = new Date(this.endTime * 1000);
    const createdDate = this.createdAt ? new Date(this.createdAt) : null;
    
    return {
      // 标题
      title: `${this.strategy} - ${this.symbol} ${this.timeframe}`,
      subtitle: `${startDate.toLocaleDateString('zh-CN')} - ${endDate.toLocaleDateString('zh-CN')}`,
      
      // 收益率标签
      returnLabel: `${this.totalReturn >= 0 ? '+' : ''}${(this.totalReturn * 100).toFixed(2)}%`,
      returnClass: this.totalReturn >= 0 ? 'text-green-400' : 'text-red-400',
      
      // 时间信息
      createdAtLabel: createdDate ? createdDate.toLocaleString('zh-CN') : '',
      
      // 策略参数
      paramsText: Object.entries(this.strategyParams)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
    };
  }
  
  /**
   * 获取交易统计信息
   */
  getTradeStats() {
    const openTrades = this.signals.filter(s => s.action === 'OPEN');
    const closeTrades = this.signals.filter(s => s.action === 'CLOSE');
    const winTrades = closeTrades.filter(s => (s.pnl || 0) > 0);
    const lossTrades = closeTrades.filter(s => (s.pnl || 0) < 0);
    
    const totalPnl = closeTrades.reduce((sum, s) => sum + (s.pnl || 0), 0);
    const avgWin = winTrades.length > 0 
      ? winTrades.reduce((sum, s) => sum + s.pnl, 0) / winTrades.length 
      : 0;
    const avgLoss = lossTrades.length > 0
      ? lossTrades.reduce((sum, s) => sum + s.pnl, 0) / lossTrades.length
      : 0;
    
    return {
      totalTrades: closeTrades.length,
      winTrades: winTrades.length,
      lossTrades: lossTrades.length,
      winRate: closeTrades.length > 0 ? winTrades.length / closeTrades.length : 0,
      totalPnl: totalPnl,
      avgWin: avgWin,
      avgLoss: avgLoss,
      profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0
    };
  }
  
  /**
   * 导出为JSON
   */
  toJSON() {
    return this.data;
  }
}

export default BacktestResult;

