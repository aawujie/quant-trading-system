/**
 * Lightweight Charts 工具类
 * 封装常用的图表操作和配置
 */

export class ChartManager {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.chart = null;
        this.series = new Map();
        this.defaultOptions = {
            width: this.container.clientWidth,
            height: 400,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#333',
            },
            grid: {
                vertLines: { color: '#e1e1e1' },
                horzLines: { color: '#e1e1e1' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            ...options
        };
        this.init();
    }

    init() {
        this.chart = LightweightCharts.createChart(this.container, this.defaultOptions);
        this.setupResponsive();
    }

    /**
     * 添加蜡烛图系列
     */
    addCandlestickSeries(name = 'main', options = {}) {
        const defaultOptions = {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            ...options
        };
        const series = this.chart.addSeries(LightweightCharts.CandlestickSeries, defaultOptions);
        this.series.set(name, series);
        return series;
    }

    /**
     * 添加线形图系列
     */
    addLineSeries(name, options = {}) {
        const defaultOptions = {
            color: '#2962FF',
            lineWidth: 2,
            ...options
        };
        const series = this.chart.addSeries(LightweightCharts.LineSeries, defaultOptions);
        this.series.set(name, series);
        return series;
    }

    /**
     * 添加面积图系列
     */
    addAreaSeries(name, options = {}) {
        const defaultOptions = {
            topColor: 'rgba(38, 166, 154, 0.4)',
            bottomColor: 'rgba(38, 166, 154, 0.0)',
            lineColor: 'rgba(38, 166, 154, 1)',
            lineWidth: 2,
            ...options
        };
        const series = this.chart.addSeries(LightweightCharts.AreaSeries, defaultOptions);
        this.series.set(name, series);
        return series;
    }

    /**
     * 添加柱状图系列
     */
    addHistogramSeries(name, options = {}) {
        const defaultOptions = {
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            ...options
        };
        const series = this.chart.addSeries(LightweightCharts.HistogramSeries, defaultOptions);
        this.series.set(name, series);
        return series;
    }

    /**
     * 获取指定系列
     */
    getSeries(name) {
        return this.series.get(name);
    }

    /**
     * 更新系列数据
     */
    updateSeriesData(name, data) {
        const series = this.series.get(name);
        if (series) {
            series.setData(data);
        }
    }

    /**
     * 追加单个数据点
     */
    appendData(name, dataPoint) {
        const series = this.series.get(name);
        if (series) {
            series.update(dataPoint);
        }
    }

    /**
     * 切换主题
     */
    setTheme(isDark = false) {
        this.chart.applyOptions({
            layout: {
                background: { color: isDark ? '#1e1e1e' : '#ffffff' },
                textColor: isDark ? '#d1d4dc' : '#333',
            },
            grid: {
                vertLines: { color: isDark ? '#2a2a2a' : '#e1e1e1' },
                horzLines: { color: isDark ? '#2a2a2a' : '#e1e1e1' },
            },
        });
    }

    /**
     * 重置缩放
     */
    fitContent() {
        this.chart.timeScale().fitContent();
    }

    /**
     * 设置响应式
     */
    setupResponsive() {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !entries[0].target) return;
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({ width: newRect.width });
        });

        resizeObserver.observe(this.container);
    }

    /**
     * 销毁图表
     */
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        this.series.clear();
    }
}

/**
 * 技术指标计算工具
 */
export class IndicatorCalculator {
    /**
     * 计算简单移动平均线 (SMA)
     */
    static calculateSMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].value || data[i - j].close;
            }
            result.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return result;
    }

    /**
     * 计算指数移动平均线 (EMA)
     */
    static calculateEMA(data, period) {
        const k = 2 / (period + 1);
        const result = [];
        let ema = data[0].value || data[0].close;

        for (let i = 0; i < data.length; i++) {
            const value = data[i].value || data[i].close;
            if (i === 0) {
                result.push({ time: data[i].time, value: ema });
            } else {
                ema = value * k + ema * (1 - k);
                result.push({ time: data[i].time, value: ema });
            }
        }
        return result;
    }

    /**
     * 计算相对强弱指数 (RSI)
     */
    static calculateRSI(data, period = 14) {
        const result = [];
        let gains = 0;
        let losses = 0;

        for (let i = 1; i < data.length; i++) {
            const value = data[i].value || data[i].close;
            const prevValue = data[i - 1].value || data[i - 1].close;
            const change = value - prevValue;

            if (i <= period) {
                gains += change > 0 ? change : 0;
                losses += change < 0 ? -change : 0;
                
                if (i === period) {
                    const avgGain = gains / period;
                    const avgLoss = losses / period;
                    const rs = avgGain / avgLoss;
                    const rsi = 100 - (100 / (1 + rs));
                    result.push({ time: data[i].time, value: rsi });
                }
            } else {
                gains = (gains * (period - 1) + (change > 0 ? change : 0)) / period;
                losses = (losses * (period - 1) + (change < 0 ? -change : 0)) / period;
                const rs = gains / losses;
                const rsi = 100 - (100 / (1 + rs));
                result.push({ time: data[i].time, value: rsi });
            }
        }
        return result;
    }

    /**
     * 计算 MACD 指标
     */
    static calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);

        const macdLine = [];
        for (let i = 0; i < fastEMA.length; i++) {
            macdLine.push({
                time: fastEMA[i].time,
                value: fastEMA[i].value - slowEMA[i].value
            });
        }

        const signalLine = this.calculateEMA(macdLine, signalPeriod);

        const histogram = [];
        for (let i = 0; i < signalLine.length; i++) {
            const macdValue = macdLine[i + (macdLine.length - signalLine.length)].value;
            const histValue = macdValue - signalLine[i].value;
            histogram.push({
                time: signalLine[i].time,
                value: histValue,
                color: histValue >= 0 ? '#26a69a' : '#ef5350'
            });
        }

        return { macdLine, signalLine, histogram };
    }

    /**
     * 计算布林带 (Bollinger Bands)
     */
    static calculateBollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(data, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < sma.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                const value = data[i + period - 1 - j].value || data[i + period - 1 - j].close;
                sum += Math.pow(value - sma[i].value, 2);
            }
            const std = Math.sqrt(sum / period);
            
            upper.push({
                time: sma[i].time,
                value: sma[i].value + stdDev * std
            });
            
            lower.push({
                time: sma[i].time,
                value: sma[i].value - stdDev * std
            });
        }

        return { upper, middle: sma, lower };
    }
}

/**
 * 数据生成工具（用于演示）
 */
export class DataGenerator {
    /**
     * 生成随机蜡烛图数据
     */
    static generateCandlestickData(count = 100, basePrice = 100) {
        const data = [];
        let price = basePrice;
        const startTime = Math.floor(Date.now() / 1000) - count * 86400;

        for (let i = 0; i < count; i++) {
            const time = startTime + i * 86400;
            const randomWalk = (Math.random() - 0.5) * 3;
            price += randomWalk;

            const open = price + (Math.random() - 0.5) * 2;
            const close = price + (Math.random() - 0.5) * 2;
            const high = Math.max(open, close) + Math.random() * 2;
            const low = Math.min(open, close) - Math.random() * 2;

            data.push({ time, open, high, low, close });
        }
        return data;
    }

    /**
     * 生成随机线形数据
     */
    static generateLineData(count = 100, baseValue = 100, volatility = 5) {
        const data = [];
        let value = baseValue;
        const startTime = Math.floor(Date.now() / 1000) - count * 86400;

        for (let i = 0; i < count; i++) {
            value += (Math.random() - 0.5) * volatility;
            data.push({
                time: startTime + i * 86400,
                value: value
            });
        }
        return data;
    }

    /**
     * 生成随机成交量数据
     */
    static generateVolumeData(candlestickData) {
        return candlestickData.map(candle => ({
            time: candle.time,
            value: Math.random() * 1000000 + 100000,
            color: candle.close >= candle.open ? '#26a69a80' : '#ef535080'
        }));
    }
}

/**
 * 图表事件处理工具
 */
export class ChartEventHandler {
    constructor(chartManager) {
        this.chartManager = chartManager;
        this.subscribers = new Map();
    }

    /**
     * 订阅十字光标移动事件
     */
    onCrosshairMove(callback) {
        this.chartManager.chart.subscribeCrosshairMove(callback);
    }

    /**
     * 订阅点击事件
     */
    onClick(callback) {
        this.chartManager.chart.subscribeClick(callback);
    }

    /**
     * 订阅可见范围变化事件
     */
    onVisibleTimeRangeChange(callback) {
        this.chartManager.chart.timeScale().subscribeVisibleTimeRangeChange(callback);
    }
}

export default {
    ChartManager,
    IndicatorCalculator,
    DataGenerator,
    ChartEventHandler
};

