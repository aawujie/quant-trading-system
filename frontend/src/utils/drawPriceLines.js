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
    
    // 获取图表尺寸
    const timeScale = chart.timeScale();
    
    // 价格转换为 Y 坐标（使用 series 的坐标转换方法）
    const entryY = series.priceToCoordinate(entry);
    const tpY = series.priceToCoordinate(tp);
    const slY = series.priceToCoordinate(sl);
    const liqY = series.priceToCoordinate(liquidationPrice);
    
    // 检查坐标是否有效
    if (entryY === null || tpY === null || slY === null || liqY === null) {
      console.warn('⚠️ 价格坐标转换失败:', { entryY, tpY, slY, liqY });
      return;
    }
    
    // X 坐标（在最右侧绘制矩形）
    // 直接使用 Canvas 宽度，矩形在最右侧
    const boxWidth = 120;
    const rightX = canvas.width - 10;  // 距离右边缘 10 像素
    const leftX = rightX - boxWidth;
    
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
    
    // 3. 绘制矩形边框
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
    
    // 左右边框（连接矩形）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    // 左边
    ctx.beginPath();
    ctx.moveTo(leftX, tpY);
    ctx.lineTo(leftX, slY);
    ctx.stroke();
    // 右边
    ctx.beginPath();
    ctx.moveTo(rightX, tpY);
    ctx.lineTo(rightX, slY);
    ctx.stroke();
    
    // 强平价线（延伸到矩形外，黄色点线）
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(leftX - 20, liqY);
    ctx.lineTo(rightX + 100, liqY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 7. 绘制文字标签（在矩形右侧）
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    const labelX = rightX + 5;  // 矩形右边 + 5 像素偏移
    
    // 止盈标签（矩形上边线右上角）
    ctx.fillStyle = '#26a69a';
    ctx.fillText(`🎯 ${tp.toFixed(2)}`, labelX, tpY - 2);
    ctx.fillText(`+${marginYield.toFixed(1)}%`, labelX + 5, tpY + 10);
    
    // 开仓标签（中线右侧）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`Entry ${entry.toFixed(2)}`, labelX, entryY + 4);
    
    // 止损标签（矩形下边线右下角）
    ctx.fillStyle = '#ef5350';
    ctx.fillText(`🛡️ ${sl.toFixed(2)}`, labelX, slY + 12);
    ctx.fillText(`-${marginLossRate.toFixed(1)}%`, labelX + 5, slY + 24);
    
    // 强平标签（虚线右侧）
    ctx.fillStyle = '#ff9800';
    ctx.fillText(`⚠️ Liq ${liquidationPrice.toFixed(2)}`, labelX, liqY + 4);
    
    ctx.restore();
    
    console.log('✅ P&L 矩形绘制成功 (Canvas)');
    
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
  console.log('✅ Canvas 已清除');
}

