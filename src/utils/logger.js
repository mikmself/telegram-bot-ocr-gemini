const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');


const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}


const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);


const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),

    
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, 
      maxFiles: 5
    }),

    
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, 
      maxFiles: 5
    })
  ],
  exitOnError: false
});


logger.bot = (chatId, message, metadata = {}) => {
  logger.info(message, { chatId, ...metadata });
};

logger.ocr = (message, metadata = {}) => {
  logger.info(`[OCR] ${message}`, metadata);
};

logger.db = (message, metadata = {}) => {
  logger.debug(`[DB] ${message}`, metadata);
};

module.exports = logger;
