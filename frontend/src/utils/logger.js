/**
 * 前端日志工具
 * 根据环境变量 VITE_LOG_LEVEL 控制日志输出等级
 * 
 * 使用方法：
 * import { createLogger } from '@/utils/logger';
 * const logger = createLogger('ComponentName');
 * logger.debug('调试信息');
 * logger.info('普通信息');
 * logger.warn('警告信息');
 * logger.error('错误信息');
 */

// 日志等级映射
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// 从环境变量获取日志等级（启动时决定，运行时不变）
const currentLevel = import.meta.env.VITE_LOG_LEVEL || 'info';
const CURRENT_LOG_LEVEL = LOG_LEVELS[currentLevel] || LOG_LEVELS.info;

// 启动时打印配置
if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
  console.log(
    `%c📋 日志等级: ${currentLevel.toUpperCase()} | 环境: ${import.meta.env.MODE}`,
    'color: #4CAF50; font-weight: bold;'
  );
}

/**
 * 日志记录器类
 */
class Logger {
  constructor(module = 'App') {
    this.module = module;
  }

  /**
   * 调试日志（开发环境使用）
   */
  debug(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) {
      console.debug(`[${this.module}]`, ...args);
    }
  }

  /**
   * 信息日志（普通信息）
   */
  info(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
      console.log(`[${this.module}]`, ...args);
    }
  }

  /**
   * 警告日志
   */
  warn(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) {
      console.warn(`[${this.module}]`, ...args);
    }
  }

  /**
   * 错误日志（始终显示，除非设置为none）
   */
  error(...args) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.error) {
      console.error(`[${this.module}]`, ...args);
    }
  }
}

/**
 * 创建带模块名的日志记录器
 * @param {string} module - 模块名称
 * @returns {Logger}
 */
export function createLogger(module) {
  return new Logger(module);
}

/**
 * 默认日志记录器
 */
export default new Logger('Default');

