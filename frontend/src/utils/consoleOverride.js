/**
 * 全局Console拦截器
 * 根据环境变量控制原生console输出
 * 
 * 优点：现有代码无需修改，console.log自动根据环境变量控制
 */

// 日志等级映射
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// 从环境变量获取日志等级
const currentLevel = import.meta.env.VITE_LOG_LEVEL || 'info';
const CURRENT_LOG_LEVEL = LOG_LEVELS[currentLevel] || LOG_LEVELS.info;
const isDevelopment = import.meta.env.MODE === 'development';

// 保存原生console方法
const originalConsole = {
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

/**
 * 初始化console拦截
 * 在应用启动时调用一次即可
 */
export function initConsoleOverride() {
  // 覆盖console.debug
  console.debug = (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) {
      originalConsole.debug(...args);
    }
  };

  // 覆盖console.log（视为info级别）
  console.log = (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
      originalConsole.log(...args);
    }
  };

  // 覆盖console.info
  console.info = (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
      originalConsole.info(...args);
    }
  };

  // 覆盖console.warn
  console.warn = (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) {
      originalConsole.warn(...args);
    }
  };

  // 覆盖console.error（通常始终显示）
  console.error = (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.error) {
      originalConsole.error(...args);
    }
  };

  // 启动时提示当前配置
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
    originalConsole.log(
      `%c📋 日志等级: ${currentLevel.toUpperCase()} | 环境: ${import.meta.env.MODE} | 拦截模式: 已启用`,
      'color: #4CAF50; font-weight: bold; font-size: 12px;'
    );
  }
}

/**
 * 恢复原生console（调试用）
 */
export function restoreConsole() {
  console.debug = originalConsole.debug;
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  
  originalConsole.log('✅ Console已恢复为原生模式');
}

// 挂载到window，方便浏览器控制台调试
if (typeof window !== 'undefined') {
  window.__restoreConsole = restoreConsole;
}

