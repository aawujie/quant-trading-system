/**
 * 合约计算器 P&L 矩形绘制工具
 * 
 * 类似 TradingView 测量工具，在 Canvas 上绘制盈亏区域矩形
 */

/**
 * 在 Canvas 上绘制 P&L 矩形
 * 
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @param {object} chart - TradingView Lightweight Charts 实例
 * @param {object} series - candlestick series
 * @param {object} result - 计算结果对象
 */
export function drawPnLBoxOnCanvas(canvas, chart, series, result) {
  if (!canvas || !chart || !series || !result || result.error) {
    return;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  try {
    const { entry, tp, sl, liquidationPrice, direction, marginYield, marginLossRate } = result;
    
    // 获取最新K线数据（时间戳）
    const seriesData = series.data();
    if (!seriesData || seriesData.length === 0) {
      console.warn('⚠️ 无K线数据');
      return;
    }
    
    // 最新K线的时间戳
    const latestKline = seriesData[seriesData.length - 1];
    const latestTimestamp = latestKline.time;
    
    // 获取时间间隔（相邻K线的时间差）
    let timeInterval = 3600; // 默认1小时（秒）
    if (seriesData.length >= 2) {
      const prevKline = seriesData[seriesData.length - 2];
      timeInterval = latestTimestamp - prevKline.time;
    }
    
    // 矩形时间宽度：占用40根K线的宽度
    const boxTimeWidth = timeInterval * 40;
    
    // 计算矩形的起点和终点时间（中心对齐最新K线）
    const boxStartTime = latestTimestamp - boxTimeWidth / 2;
    const boxEndTime = latestTimestamp + boxTimeWidth / 2;
    
    // 获取时间轴和价格轴
    const timeScale = chart.timeScale();
    
    // 将时间转换为屏幕X坐标
    const centerX = timeScale.timeToCoordinate(latestTimestamp);
    let leftX = timeScale.timeToCoordinate(boxStartTime);
    let rightX = timeScale.timeToCoordinate(boxEndTime);
    
    // 中心点必须有效
    if (centerX === null) {
      console.warn('⚠️ 最新K线时间坐标转换失败');
      return;
    }
    
    // 如果起点或终点超出范围（返回null），使用中心点推算
    // 先获取相邻K线的屏幕间距
    let barSpacing = 10; // 默认10像素
    if (seriesData.length >= 2) {
      const prevKline = seriesData[seriesData.length - 2];
      const prevX = timeScale.timeToCoordinate(prevKline.time);
      if (prevX !== null) {
        barSpacing = centerX - prevX;
      }
    }
    
    // 矩形宽度 = 40根K线 * 每根K线的屏幕宽度
    const boxWidth = Math.abs(barSpacing * 40);
    
    // 如果起点或终点无法转换，直接基于中心点和宽度计算
    if (leftX === null) {
      leftX = centerX - boxWidth / 2;
    }
    if (rightX === null) {
      rightX = centerX + boxWidth / 2;
    }
    
    // 价格转换为 Y 坐标
    const entryY = series.priceToCoordinate(entry);
    const tpY = series.priceToCoordinate(tp);
    const slY = series.priceToCoordinate(sl);
    const liqY = series.priceToCoordinate(liquidationPrice);
    
    // 检查坐标是否有效
    if (entryY === null || tpY === null || slY === null || liqY === null) {
      console.warn('⚠️ 价格坐标转换失败:', { entryY, tpY, slY, liqY });
      return;
    }
    
    ctx.save();
    
    // 1. 绘制盈利区域（绿色半透明矩形）
    ctx.fillStyle = 'rgba(38, 166, 154, 0.25)';
    const profitHeight = Math.abs(entryY - tpY);
    const profitY = Math.min(tpY, entryY);
    ctx.fillRect(leftX, profitY, boxWidth, profitHeight);
    
    // 2. 绘制亏损区域（红色半透明矩形）
    ctx.fillStyle = 'rgba(239, 83, 80, 0.25)';
    const lossHeight = Math.abs(slY - entryY);
    const lossY = Math.min(slY, entryY);
    ctx.fillRect(leftX, lossY, boxWidth, lossHeight);
    
    // 3. 绘制缓冲区（黄色半透明矩形，从止损价到强平价）
    ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
    const bufferHeight = Math.abs(liqY - slY);
    const bufferY = Math.min(liqY, slY);
    ctx.fillRect(leftX, bufferY, boxWidth, bufferHeight);
    
    // 4. 绘制矩形边框
    // 上边（止盈价）
    ctx.strokeStyle = 'rgba(38, 166, 154, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, tpY);
    ctx.lineTo(rightX, tpY);
    ctx.stroke();
    
    // 中间线（开仓价）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(leftX, entryY);
    ctx.lineTo(rightX, entryY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 下边（止损价）
    ctx.strokeStyle = 'rgba(239, 83, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, slY);
    ctx.lineTo(rightX, slY);
    ctx.stroke();
    
    // 左右边框（连接矩形，从止盈到强平价）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    // 左边
    ctx.beginPath();
    ctx.moveTo(leftX, tpY);
    ctx.lineTo(leftX, liqY);
    ctx.stroke();
    // 右边
    ctx.beginPath();
    ctx.moveTo(rightX, tpY);
    ctx.lineTo(rightX, liqY);
    ctx.stroke();
    
    // 强平价线（底部边框）
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, liqY);
    ctx.lineTo(rightX, liqY);
    ctx.stroke();
    
    // 5. 绘制文字标签（在矩形内部，右对齐，紧贴对应线条）
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    const labelX = rightX - 10;  // 矩形右边，留10px内边距
    
    // 止盈标签（绿色线下方）
    ctx.fillStyle = '#26a69a';
    ctx.fillText(`TP ${tp.toFixed(2)} +${marginYield.toFixed(1)}%`, labelX, tpY + 18);
    
    // 止损标签（红色线上方）
    ctx.fillStyle = '#ef5350';
    ctx.fillText(`SL ${sl.toFixed(2)} -${marginLossRate.toFixed(1)}%`, labelX, slY - 6);
    
    // 强平标签（黄色线上方）
    ctx.fillStyle = '#ff9800';
    ctx.fillText(`Liq ${liquidationPrice.toFixed(2)}`, labelX, liqY - 6);
    
    ctx.restore();
  } catch (err) {
    console.error('❌ 绘制 P&L 矩形失败:', err);
  }
}

/**
 * 清除 Canvas
 * 
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 */
export function clearPnLBoxCanvas(canvas) {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

