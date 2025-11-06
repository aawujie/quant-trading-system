# Lightweight Charts Demo

这是一个完整的 Lightweight Charts 使用演示项目，展示了多种图表类型和交互功能。

## 📦 已安装的依赖

- `lightweight-charts`: ^5.0.9

## 🚀 快速开始

### 方法 1：使用 npm scripts（推荐）

```bash
# 启动开发服务器（自动打开浏览器）
npm start

# 或者使用开发模式（禁用缓存）
npm run dev
```

服务器将在 http://localhost:8080 启动

### 方法 2：直接打开文件

直接用浏览器打开 `index.html` 或 `advanced-demo.html` 文件即可（某些浏览器可能会有 CORS 限制）。

## 📁 演示文件

- **`home.html`** - 主页：展示所有演示的导航页面（推荐从这里开始）
- **`index.html`** - 基础演示：包含 5 种图表类型的基本用法
- **`advanced-demo.html`** - 高级演示：实时数据更新、技术指标（RSI、MACD）、订单深度图
- **`module-demo.html`** - 模块化示例：展示如何使用封装好的工具类
- **`chart-utils.js`** - 工具类库：包含 ChartManager、IndicatorCalculator 等实用工具

> 💡 **提示**：启动服务器后访问 http://localhost:8080/home.html 查看所有演示

## 📊 Demo 包含的图表类型

### 1. 蜡烛图（K线图）
- 展示 OHLC 数据（开盘价、最高价、最低价、收盘价）
- 支持主题切换（亮色/暗色）
- 可添加新数据点
- 支持缩放和平移

### 2. 线形图
- 简洁的价格趋势展示
- 可更新数据
- 支持动态改变颜色

### 3. 面积图
- 带渐变填充的面积图
- 可切换渐变效果
- 动态添加数据点

### 4. 柱状图（成交量）
- 展示成交量或其他离散数据
- 支持彩色柱状图
- 随机数据生成

### 5. 多系列组合图表
- K线 + 移动平均线 + 成交量
- 可切换各个系列的显示/隐藏
- 展示如何在一个图表中组合多种数据

## 🎯 主要功能特性

### 基础演示 (index.html)
- ✅ 多种图表类型（K线、线形、面积、柱状）
- ✅ 交互式缩放和平移
- ✅ 主题切换（亮色/暗色）
- ✅ 动态数据更新
- ✅ 响应式设计
- ✅ 移动平均线计算
- ✅ 十字光标跟踪
- ✅ 时间轴自定义

### 高级演示 (advanced-demo.html)
- 🔴 **实时数据流**：模拟 WebSocket 实时价格更新
- 📊 **技术指标 RSI**：相对强弱指数，带超买超卖线
- 📉 **技术指标 MACD**：移动平均收敛背离指标
- 💹 **订单深度图**：买卖盘分布可视化
- 📈 **EMA 均线**：指数移动平均线 (12/26)
- 🎯 **实时统计**：当前价格、24h高低、成交量
- ⏯️ **控制面板**：暂停/恢复、清空数据、调整频率
- 🎨 **专业暗色主题**：适合交易场景的深色界面

## 📝 代码示例

### 方法 1：原生 API

```javascript
const chart = LightweightCharts.createChart(document.getElementById('container'), {
    width: 600,
    height: 400,
});

const lineSeries = chart.addLineSeries();
lineSeries.setData([
    { time: '2024-01-01', value: 100 },
    { time: '2024-01-02', value: 105 },
    { time: '2024-01-03', value: 103 },
]);
```

### 方法 2：使用工具类（推荐）

```javascript
import { ChartManager, IndicatorCalculator, DataGenerator } from './chart-utils.js';

// 创建图表管理器
const manager = new ChartManager('chart-container');

// 添加蜡烛图系列
manager.addCandlestickSeries('main');

// 添加移动平均线
manager.addLineSeries('ma20', { color: '#FF6B6B' });

// 生成数据
const data = DataGenerator.generateCandlestickData(100, 100);
const ma20 = IndicatorCalculator.calculateSMA(data, 20);

// 更新数据
manager.updateSeriesData('main', data);
manager.updateSeriesData('ma20', ma20);
```

## 🛠️ 工具类说明

### ChartManager
图表管理器，封装了常用的图表操作：
- `addCandlestickSeries()` - 添加蜡烛图
- `addLineSeries()` - 添加线形图
- `addAreaSeries()` - 添加面积图
- `addHistogramSeries()` - 添加柱状图
- `setTheme(isDark)` - 切换主题
- `fitContent()` - 重置缩放

### IndicatorCalculator
技术指标计算器：
- `calculateSMA(data, period)` - 简单移动平均线
- `calculateEMA(data, period)` - 指数移动平均线
- `calculateRSI(data, period)` - 相对强弱指数
- `calculateMACD(data)` - MACD 指标
- `calculateBollingerBands(data, period, stdDev)` - 布林带

### DataGenerator
数据生成器（用于测试）：
- `generateCandlestickData(count, basePrice)` - 生成 K线数据
- `generateLineData(count, baseValue, volatility)` - 生成线形数据
- `generateVolumeData(candlestickData)` - 生成成交量数据

## 📚 更多资源

- [官方文档](https://tradingview.github.io/lightweight-charts/)
- [API 参考](https://tradingview.github.io/lightweight-charts/docs/api)
- [示例集合](https://tradingview.github.io/lightweight-charts/examples/)

## 💡 提示

- 使用鼠标滚轮可以缩放图表
- 按住鼠标左键拖动可以平移查看不同时间段
- 双击图表可以重置缩放
- 移动鼠标查看十字光标和具体数值

## 🔧 技术栈

- Lightweight Charts v5.0.9
- 原生 JavaScript
- HTML5 / CSS3

---

**Enjoy coding! 📈**

