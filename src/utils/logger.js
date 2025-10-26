/**
 * ============================================================================
 * FILE: src/utils/logger.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Module logging menggunakan Winston untuk mencatat semua aktivitas aplikasi.
 * Logger ini mendukung multiple transports (console, file) dengan format yang
 * konsisten, rotation otomatis, dan custom log methods untuk domain spesifik.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - winston: Library logging yang powerful dan flexible
 * - path: Node.js path module untuk manipulasi path file
 * - fs: Node.js file system module untuk operasi file/direktori
 * - ../config/env: Konfigurasi logging (level, directory)
 *
 * FITUR UTAMA:
 * 1. Multiple transports (console + file)
 * 2. Automatic log rotation (10MB per file, max 5 files)
 * 3. Colored console output untuk readability
 * 4. Timestamp pada setiap log entry
 * 5. Stack trace untuk error logging
 * 6. Custom methods untuk domain-specific logging (bot, ocr, db)
 * 7. Metadata support untuk context tambahan
 *
 * LOG LEVELS (dari paling verbose ke paling strict):
 * - debug: Informasi detail untuk debugging
 * - info: Informasi umum operasional
 * - warn: Warning yang perlu diperhatikan
 * - error: Error yang perlu segera ditangani
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const logger = require('./utils/logger');
 *
 * // Standard logging
 * logger.info('Application started');
 * logger.error('Connection failed', error);
 * logger.debug('User data:', { userId: 123, action: 'login' });
 *
 * // Domain-specific logging
 * logger.bot(chatId, 'User sent photo');
 * logger.ocr('Processing image', { imageSize: '2MB' });
 * logger.db('Query executed', { queryTime: '45ms' });
 * ```
 *
 * ============================================================================
 */

// ============================================================================
// IMPORT DEPENDENCIES
// ============================================================================

/**
 * winston - Library logging yang powerful dengan support untuk:
 * - Multiple transports (console, file, HTTP, dll)
 * - Custom formats dan levels
 * - Log rotation
 * - Async logging
 * - Query/search logs
 */
const winston = require('winston');

/**
 * path - Node.js built-in module untuk manipulasi path
 * Digunakan untuk membangun path file log dengan benar
 * (cross-platform: Windows menggunakan \, Linux menggunakan /)
 */
const path = require('path');

/**
 * fs - Node.js built-in module untuk operasi file system
 * Digunakan untuk membuat direktori log jika belum ada
 */
const fs = require('fs');

/**
 * config - Konfigurasi aplikasi yang berisi:
 * - logging.level: Level log yang akan dicatat (debug/info/warn/error)
 * - logging.dir: Direktori tempat menyimpan file log
 */
const config = require('../config/env');

// ============================================================================
// SETUP LOG DIRECTORY
// ============================================================================

/**
 * Direktori untuk menyimpan file log
 * @type {string}
 *
 * Diambil dari konfigurasi (default: './logs')
 */
const logDir = config.logging.dir;

/**
 * Membuat direktori log jika belum ada
 *
 * Menggunakan fs.existsSync() untuk cek keberadaan direktori,
 * kemudian fs.mkdirSync() untuk membuat jika tidak ada.
 *
 * Option { recursive: true } memastikan parent directories juga dibuat.
 * Contoh: jika logDir = './logs/app', maka './logs' juga akan dibuat.
 *
 * CATATAN: Ini adalah synchronous operation yang dijalankan saat startup.
 * Tidak masalah karena hanya dijalankan sekali dan harus selesai sebelum
 * logging dimulai.
 */
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ============================================================================
// LOG FORMAT CONFIGURATION
// ============================================================================

/**
 * Format log yang digunakan untuk semua log entries
 *
 * Winston format adalah chainable function yang mem-transform log object.
 * Format ini menggunakan combine() untuk menggabungkan multiple formats:
 *
 * 1. timestamp: Menambahkan timestamp ke setiap log entry
 * 2. errors: Memformat error objects dengan stack trace
 * 3. splat: Mengaktifkan string interpolation (printf-style)
 * 4. printf: Custom formatter untuk output final
 *
 * Output format:
 * YYYY-MM-DD HH:mm:ss [LEVEL]: message { metadata }
 *
 * Contoh:
 * 2025-10-26 14:30:45 [INFO]: User logged in { chatId: 123456, username: "john" }
 * 2025-10-26 14:31:12 [ERROR]: Database connection failed { error: "ECONNREFUSED" }
 */
const logFormat = winston.format.combine(
  /**
   * Menambahkan timestamp dengan format custom
   * Format: YYYY-MM-DD HH:mm:ss (24-hour format)
   *
   * Menggunakan format ini karena:
   * - Mudah dibaca manusia
   * - Sortable (bisa di-sort alphabetically)
   * - ISO-like tapi lebih readable daripada full ISO format
   */
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

  /**
   * Memformat error objects dengan stack trace
   * stack: true berarti include stack trace di output
   *
   * Berguna untuk debugging error karena menunjukkan:
   * - File dan line number dimana error terjadi
   * - Call stack yang mengarah ke error
   * - Error message dan type
   */
  winston.format.errors({ stack: true }),

  /**
   * Mengaktifkan string interpolation (printf-style)
   *
   * Memungkinkan syntax seperti:
   * logger.info('User %s logged in at %s', username, time);
   *
   * Mirip dengan console.log() behavior di Node.js
   */
  winston.format.splat(),

  /**
   * Custom formatter untuk menghasilkan string output final
   *
   * Menerima log object dengan properties:
   * - level: Log level (debug/info/warn/error)
   * - message: Log message
   * - timestamp: Timestamp dari format.timestamp()
   * - ...metadata: Additional data yang di-pass saat logging
   *
   * Output format: timestamp [LEVEL]: message metadata_json
   */
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    // Mulai dengan format dasar: timestamp [LEVEL]: message
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Jika ada metadata tambahan, append sebagai JSON
    // Ini berguna untuk menambahkan context tanpa memodifikasi message
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);

// ============================================================================
// LOGGER INSTANCE
// ============================================================================

/**
 * Instance logger utama yang digunakan di seluruh aplikasi
 *
 * Winston logger dengan konfigurasi:
 * - Level: Dari config (debug/info/warn/error)
 * - Format: Custom format yang sudah didefinisikan
 * - Transports: Console + File (combined + error-only)
 * - exitOnError: false (tidak exit saat logging error)
 *
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  /**
   * Log level dari konfigurasi
   * Menentukan log level minimum yang akan dicatat
   *
   * Contoh: jika level = 'info', maka:
   * - debug logs: TIDAK dicatat
   * - info logs: dicatat
   * - warn logs: dicatat
   * - error logs: dicatat
   */
  level: config.logging.level,

  /**
   * Format yang digunakan untuk semua transports
   * (kecuali jika transport memiliki format sendiri)
   */
  format: logFormat,

  /**
   * Array of transports (tempat output log ditulis)
   * Setiap transport bisa memiliki konfigurasi sendiri
   */
  transports: [
    /**
     * CONSOLE TRANSPORT
     * ----------------------------------------------------------------
     * Output log ke console (stdout/stderr)
     *
     * Berguna untuk:
     * - Development: Melihat log real-time saat coding
     * - Docker: Log muncul di docker logs
     * - PM2: Log muncul di PM2 logs
     *
     * Format khusus dengan colorize untuk readability:
     * - ERROR: red
     * - WARN: yellow
     * - INFO: green
     * - DEBUG: blue
     */
    new winston.transports.Console({
      format: winston.format.combine(
        // Tambahkan color pada console output
        // Tidak digunakan di file karena ANSI color codes mengotori file
        winston.format.colorize(),

        // Gunakan format yang sama dengan transport lain
        logFormat
      )
    }),

    /**
     * COMBINED LOG FILE TRANSPORT
     * ----------------------------------------------------------------
     * Output SEMUA log ke file combined.log
     *
     * File ini berisi log dari semua levels (debug/info/warn/error)
     * untuk audit trail dan debugging lengkap.
     *
     * Rotation settings:
     * - maxsize: 10485760 bytes (10 MB)
     * - maxFiles: 5
     *
     * Behavior: Ketika file mencapai 10MB, Winston akan:
     * 1. Rename combined.log menjadi combined.log.1
     * 2. Rename combined.log.1 menjadi combined.log.2 (jika ada)
     * 3. ... dan seterusnya sampai maxFiles
     * 4. Hapus file tertua jika sudah ada 5 files
     * 5. Buat combined.log baru
     *
     * Ini mencegah file log tumbuh tanpa batas dan menghabiskan disk.
     */
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10 MB dalam bytes
      maxFiles: 5        // Simpan max 5 files (total ~50MB)
    }),

    /**
     * ERROR LOG FILE TRANSPORT
     * ----------------------------------------------------------------
     * Output HANYA error logs ke file error.log
     *
     * Pisah error logs ke file terpisah untuk:
     * - Mudah monitoring errors tanpa noise dari info logs
     * - Alerting: Bisa setup monitoring yang watch error.log
     * - Debugging: Fokus pada errors saja
     *
     * level: 'error' berarti hanya log dengan level error yang masuk
     *
     * Rotation settings sama dengan combined.log untuk konsistensi.
     */
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',    // Hanya error logs
      maxsize: 10485760, // 10 MB
      maxFiles: 5        // Max 5 files
    })
  ],

  /**
   * exitOnError: false berarti logger tidak akan menyebabkan process exit
   * jika terjadi error saat logging.
   *
   * Ini penting karena:
   * - Logging error seharusnya tidak crash aplikasi
   * - Aplikasi tetap bisa jalan meskipun logging gagal
   * - Error logging akan di-handle internal oleh winston
   */
  exitOnError: false
});

// ============================================================================
// CUSTOM LOGGING METHODS
// ============================================================================

/**
 * Log aktivitas bot dengan context chat ID
 *
 * Method khusus untuk logging aktivitas yang berhubungan dengan Telegram bot.
 * Otomatis menambahkan chatId ke metadata untuk tracking per-user.
 *
 * Berguna untuk:
 * - Tracking user behavior
 * - Debugging user-specific issues
 * - Audit trail per user
 *
 * @param {number} chatId - Telegram chat ID dari user
 * @param {string} message - Pesan log
 * @param {Object} metadata - Additional context data
 *
 * @example
 * logger.bot(123456, 'User sent photo', { fileSize: '2MB' });
 * // Output: 2025-10-26 14:30:45 [INFO]: User sent photo { chatId: 123456, fileSize: "2MB" }
 *
 * @example
 * logger.bot(789012, 'Login attempt failed', { reason: 'Invalid password' });
 * // Output: 2025-10-26 14:31:00 [INFO]: Login attempt failed { chatId: 789012, reason: "Invalid password" }
 */
logger.bot = (chatId, message, metadata = {}) => {
  // Gunakan logger.info dengan chatId di metadata
  // Spread operator {...metadata} menggabungkan chatId dengan metadata lain
  logger.info(message, { chatId, ...metadata });
};

/**
 * Log aktivitas OCR processing
 *
 * Method khusus untuk logging proses OCR dengan Gemini AI.
 * Menambahkan prefix [OCR] untuk mudah filtering di log files.
 *
 * Berguna untuk:
 * - Monitoring OCR performance
 * - Debugging OCR failures
 * - Tracking OCR usage dan quota
 *
 * @param {string} message - Pesan log
 * @param {Object} metadata - Additional context (confidence, processingTime, dll)
 *
 * @example
 * logger.ocr('Processing started', { imageSize: '2MB', chatId: 123456 });
 * // Output: 2025-10-26 14:30:45 [INFO]: [OCR] Processing started { imageSize: "2MB", chatId: 123456 }
 *
 * @example
 * logger.ocr('OCR completed', { confidence: 95, processingTime: '3.2s', memberCount: 4 });
 * // Output: 2025-10-26 14:30:48 [INFO]: [OCR] OCR completed { confidence: 95, processingTime: "3.2s", memberCount: 4 }
 */
logger.ocr = (message, metadata = {}) => {
  // Prefix message dengan [OCR] untuk mudah identify di logs
  logger.info(`[OCR] ${message}`, metadata);
};

/**
 * Log aktivitas database
 *
 * Method khusus untuk logging operasi database.
 * Menggunakan logger.debug (bukan info) karena DB logs biasanya verbose
 * dan hanya diperlukan saat debugging.
 *
 * Menambahkan prefix [DB] untuk mudah filtering.
 *
 * Berguna untuk:
 * - Debugging database queries
 * - Monitoring query performance
 * - Tracking data flow
 *
 * CATATAN: Log ini hanya muncul jika log level = 'debug'
 *
 * @param {string} message - Pesan log
 * @param {Object} metadata - Additional context (query, params, executionTime, dll)
 *
 * @example
 * logger.db('Query executed', { query: 'SELECT * FROM users', time: '45ms' });
 * // Output (hanya jika level=debug): 2025-10-26 14:30:45 [DEBUG]: [DB] Query executed { query: "SELECT * FROM users", time: "45ms" }
 *
 * @example
 * logger.db('Transaction committed', { tables: ['family_data', 'residents'], rowsAffected: 5 });
 */
logger.db = (message, metadata = {}) => {
  // Gunakan debug level karena DB logs biasanya verbose
  // Prefix dengan [DB] untuk mudah identify
  logger.debug(`[DB] ${message}`, metadata);
};

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Export logger instance untuk digunakan di seluruh aplikasi
 *
 * Logger ini adalah singleton - hanya ada satu instance di seluruh aplikasi.
 * Semua module yang import logger akan mendapat reference ke instance yang sama.
 */
module.exports = logger;

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. LOG LEVELS:
 *    Gunakan level yang tepat untuk setiap log:
 *    - debug: Detail implementasi, variable values, flow execution
 *    - info: Business events, user actions, system status
 *    - warn: Recoverable issues, deprecated usage, potential problems
 *    - error: Errors yang perlu immediate attention
 *
 * 2. SENSITIVE DATA:
 *    JANGAN log data sensitif seperti:
 *    - Password (plain atau hashed)
 *    - API keys
 *    - Session tokens
 *    - Personal data yang regulated (NIK lengkap, alamat detail)
 *
 *    Jika perlu log untuk debugging, gunakan masking:
 *    logger.info('User login', { username: 'john', password: '***' });
 *    logger.info('NIK processed', { nik: nik.substring(0,4) + '********' });
 *
 * 3. PERFORMANCE:
 *    - Logging adalah I/O operation yang bisa mempengaruhi performance
 *    - Hindari logging di tight loops
 *    - Gunakan debug level untuk verbose logs (tidak aktif di production)
 *    - Winston logging adalah async, tapi tetap ada overhead
 *
 * 4. LOG ROTATION:
 *    - Monitor disk space di log directory
 *    - Current setting: max 50MB per transport (5 files × 10MB)
 *    - Total max: ~150MB (combined.log + error.log + console tidak ke file)
 *    - Adjust maxsize dan maxFiles sesuai kebutuhan dan disk capacity
 *
 * 5. PRODUCTION BEST PRACTICES:
 *    - Set log level ke 'info' atau 'warn' di production
 *    - Setup log aggregation (ELK, Splunk, CloudWatch, dll)
 *    - Setup alerting untuk error logs
 *    - Regular backup log files penting
 *    - Setup log analysis untuk pattern detection
 *
 * 6. DEBUGGING TIPS:
 *    - Gunakan grep untuk filter logs:
 *      grep "ERROR" logs/combined.log
 *      grep "chatId.*123456" logs/combined.log
 *      grep "\[OCR\]" logs/combined.log
 *
 *    - Tail logs real-time:
 *      tail -f logs/combined.log
 *      tail -f logs/error.log | grep "database"
 *
 *    - Parse JSON metadata:
 *      cat logs/combined.log | grep "metadata" | jq
 *
 * 7. CUSTOM METHODS USAGE:
 *    - logger.bot(): Untuk user interactions via Telegram
 *    - logger.ocr(): Untuk OCR processing events
 *    - logger.db(): Untuk database operations
 *    - Bisa tambah custom methods lain sesuai domain needs
 *
 * ============================================================================
 */
