/**
 * Logger - 확장 프로그램 로깅 시스템
 */

const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success'
};

const MAX_LOGS = 1000; // 최대 저장 로그 수

class Logger {
  constructor() {
    this.storageKey = 'autopost_logs';
  }

  /**
   * 로그 저장
   */
  async log(level, message, data = null) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    try {
      const { [this.storageKey]: logs = [] } = await chrome.storage.local.get(this.storageKey);
      
      // 새 로그 추가
      logs.unshift(logEntry);
      
      // 최대 개수 제한
      if (logs.length > MAX_LOGS) {
        logs.splice(MAX_LOGS);
      }
      
      await chrome.storage.local.set({ [this.storageKey]: logs });
      
      // 콘솔에도 출력
      const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' : 
                           level === LOG_LEVELS.WARNING ? 'warn' : 'log';
      console[consoleMethod](`[AutoPost ${level.toUpperCase()}]`, message, data || '');
      
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  /**
   * INFO 레벨 로그
   */
  info(message, data) {
    return this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * WARNING 레벨 로그
   */
  warning(message, data) {
    return this.log(LOG_LEVELS.WARNING, message, data);
  }

  /**
   * ERROR 레벨 로그
   */
  error(message, data) {
    return this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * SUCCESS 레벨 로그
   */
  success(message, data) {
    return this.log(LOG_LEVELS.SUCCESS, message, data);
  }

  /**
   * 모든 로그 가져오기
   */
  async getLogs(limit = 100) {
    try {
      const { [this.storageKey]: logs = [] } = await chrome.storage.local.get(this.storageKey);
      return logs.slice(0, limit);
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * 로그 삭제
   */
  async clearLogs() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: [] });
      console.log('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * 특정 레벨의 로그만 가져오기
   */
  async getLogsByLevel(level, limit = 100) {
    const logs = await this.getLogs(limit * 2); // 여유있게 가져오기
    return logs.filter(log => log.level === level).slice(0, limit);
  }
}

// Singleton 인스턴스
const logger = new Logger();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
}
