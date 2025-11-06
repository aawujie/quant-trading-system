# 🚀 快速入门指南

## 第一步：启动服务器

```bash
npm start
```

服务器将自动在浏览器中打开 http://localhost:8080

## 第二步：浏览演示

### 方式 1：从主页开始（推荐）
访问 http://localhost:8080/home.html，查看所有演示的导航页面

### 方式 2：直接访问演示
- **基础演示**: http://localhost:8080/index.html
- **高级演示**: http://localhost:8080/advanced-demo.html
- **模块化示例**: http://localhost:8080/module-demo.html

## 📊 各个演示的特点

### 🎯 基础演示 (index.html)
适合初学者，了解基本图表类型

**包含内容：**
- 蜡烛图（K线图）- 股票/加密货币常用
- 线形图 - 简单价格趋势
- 面积图 - 带填充的趋势图
- 柱状图 - 成交量展示
- 多系列组合 - K线+均线+成交量

**交互功能：**
- 鼠标滚轮缩放
- 拖动平移
- 主题切换
- 动态添加数据

### 🚀 高级演示 (advanced-demo.html)
模拟真实交易场景

**包含内容：**
- 实时价格流（模拟 WebSocket）
- RSI 指标（相对强弱指数）
- MACD 指标（趋势和动量）
- 订单深度图（买卖盘分布）
- 实时统计面板

**特色功能：**
- 暂停/恢复实时更新
- 可调节更新频率
- 专业深色主题
- 完整的交易指标

### 🎯 模块化示例 (module-demo.html)
学习如何在实际项目中使用

**包含内容：**
- ChartManager 使用示例
- 技术指标计算演示
- 布林带指标
- 数据生成工具

**学习重点：**
- 代码组织和封装
- 工具类的使用
- 指标计算方法
- 最佳实践

## 🛠️ 如何使用工具类

### 1. 导入模块

```javascript
import { 
    ChartManager, 
    IndicatorCalculator, 
    DataGenerator 
} from './chart-utils.js';
```

### 2. 创建图表

```javascript
// 创建图表管理器
const manager = new ChartManager('chart-container');

// 添加图表系列
manager.addCandlestickSeries('main');
manager.addLineSeries('ma20', { color: '#FF6B6B' });
```

### 3. 生成数据

```javascript
// 生成测试数据
const data = DataGenerator.generateCandlestickData(100, 100);

// 计算技术指标
const ma20 = IndicatorCalculator.calculateSMA(data, 20);
const rsi = IndicatorCalculator.calculateRSI(data, 14);
```

### 4. 更新图表

```javascript
// 更新数据
manager.updateSeriesData('main', data);
manager.updateSeriesData('ma20', ma20);

// 切换主题
manager.setTheme(true); // true = 暗色主题

// 重置缩放
manager.fitContent();
```

## 📖 常见用例

### 用例 1：创建简单的价格图表

```javascript
const manager = new ChartManager('container');
manager.addLineSeries('price', { color: '#2962FF' });

const data = [
    { time: '2024-01-01', value: 100 },
    { time: '2024-01-02', value: 105 },
    { time: '2024-01-03', value: 103 }
];

manager.updateSeriesData('price', data);
```

### 用例 2：添加移动平均线

```javascript
const candleData = DataGenerator.generateCandlestickData(100, 100);
const ma20 = IndicatorCalculator.calculateSMA(candleData, 20);
const ma50 = IndicatorCalculator.calculateSMA(candleData, 50);

manager.addCandlestickSeries('main');
manager.addLineSeries('ma20', { color: '#FF6B6B' });
manager.addLineSeries('ma50', { color: '#4ECDC4' });

manager.updateSeriesData('main', candleData);
manager.updateSeriesData('ma20', ma20);
manager.updateSeriesData('ma50', ma50);
```

### 用例 3：实时更新数据

```javascript
// 定时更新
setInterval(() => {
    const newPrice = {
        time: Date.now() / 1000,
        value: Math.random() * 100 + 50
    };
    manager.appendData('price', newPrice);
}, 1000);
```

## 🎨 自定义图表样式

### 修改颜色主题

```javascript
const manager = new ChartManager('container', {
    layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
    },
    grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
    }
});
```

### 修改系列样式

```javascript
manager.addLineSeries('price', {
    color: '#2962FF',
    lineWidth: 3,
    lineStyle: LightweightCharts.LineStyle.Dashed
});
```

## 🔧 技术指标说明

### SMA (简单移动平均线)
- 计算指定周期内的平均价格
- 常用周期：20、50、200
- 用途：判断趋势方向

### EMA (指数移动平均线)
- 对近期价格给予更高权重
- 常用周期：12、26
- 用途：更快响应价格变化

### RSI (相对强弱指数)
- 范围：0-100
- RSI > 70：超买
- RSI < 30：超卖
- 用途：判断超买超卖状态

### MACD
- 由 MACD 线、信号线和柱状图组成
- MACD 线上穿信号线：买入信号
- MACD 线下穿信号线：卖出信号
- 用途：趋势和动量分析

### 布林带
- 由中轨（SMA）和上下轨（±2σ）组成
- 价格触及上轨：可能回调
- 价格触及下轨：可能反弹
- 用途：判断价格波动范围

## 💡 最佳实践

1. **性能优化**
   - 限制数据点数量（建议 < 10000）
   - 使用 `fitContent()` 适配视图
   - 避免频繁的完整数据更新

2. **响应式设计**
   - ChartManager 自动处理窗口大小变化
   - 使用百分比宽度而非固定像素

3. **数据管理**
   - 使用 Unix 时间戳（秒）
   - 确保时间序列递增
   - 处理缺失数据

4. **用户体验**
   - 提供加载状态
   - 显示数据更新时间
   - 添加交互提示

## 🐛 常见问题

### Q: 图表不显示？
A: 检查容器是否有高度，确保 DOM 元素已加载

### Q: 数据更新不生效？
A: 确保时间格式正确，使用 Unix 时间戳（秒）

### Q: 如何处理实时数据？
A: 使用 `update()` 而不是 `setData()`

### Q: 如何导出图表？
A: 使用浏览器的截图功能或 Canvas API

## 📚 延伸学习

- **官方文档**: https://tradingview.github.io/lightweight-charts/
- **API 参考**: https://tradingview.github.io/lightweight-charts/docs/api
- **GitHub 仓库**: https://github.com/tradingview/lightweight-charts

## 🎓 学习路径建议

1. **第一天**: 浏览基础演示，了解各种图表类型
2. **第二天**: 学习高级演示，理解实时数据更新
3. **第三天**: 研究模块化示例，学习代码组织
4. **第四天**: 阅读 chart-utils.js，理解实现细节
5. **第五天**: 开始构建自己的项目

---

**祝你学习愉快！如有问题，请参考 README.md 获取更多信息。** 🚀

