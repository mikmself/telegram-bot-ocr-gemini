require('dotenv').config();

module.exports = {
  // Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    polling: {
      interval: 1000,
      autoStart: true
    }
  },

  // Google Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },

  // MySQL Database
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3320,
    database: process.env.DB_DATABASE || 'smartgov',
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  },

  // Region API
  regionApi: {
    url: process.env.REGION_API_URL || 'https://region.smartsociety.id/api',
    key: process.env.REGION_API_KEY
  },

  // Session & Security
  session: {
    expireHours: parseInt(process.env.SESSION_EXPIRE_HOURS) || 24,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  },

  // OCR Configuration
  ocr: {
    confidenceThreshold: parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 80,
    maxRetries: parseInt(process.env.OCR_MAX_RETRIES) || 2,
    timeout: parseInt(process.env.OCR_TIMEOUT) || 30000
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    tempDir: process.env.TEMP_DIR || './temp'
  },

  // Environment
  env: process.env.NODE_ENV || 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};
