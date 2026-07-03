require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || './data/wecom-chat.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
};
