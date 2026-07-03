const config = require('../config');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
  return LOG_LEVELS[level] <= (LOG_LEVELS[config.logLevel] || 2);
}

const logger = {
  error: (...args) => shouldLog('error') && console.error('[ERROR]', ...args),
  warn: (...args) => shouldLog('warn') && console.warn('[WARN]', ...args),
  info: (...args) => shouldLog('info') && console.log('[INFO]', ...args),
  debug: (...args) => shouldLog('debug') && console.log('[DEBUG]', ...args),
};

module.exports = logger;
