// logger.js
// Structured logging with Winston — console.log() ki jagah production-grade
// logging. Console mein bhi dikhega (colored) aur files mein bhi save hoga
// (rotate karke), taaki baad mein debug karna aasan ho.
//
// Usage:
//   const logger = require('./logger');
//   logger.info('Server started', { port: 5002 });
//   logger.warn('Low stock', { item: 'X', qty: 2 });
//   logger.error('Payment failed', { userId, err: err.message });

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Console ke liye human-readable format
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    // Sab kuch console mein bhi dikhta rahega (dev + pm2 logs ke liye)
    new winston.transports.Console({ format: consoleFormat }),
    // Sirf errors alag file mein — jaldi grep karne ke liye
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB, phir rotate
      maxFiles: 5
    }),
    // Combined log — sab levels
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  exitOnError: false
});

module.exports = logger;
