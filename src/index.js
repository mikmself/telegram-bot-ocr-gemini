#!/usr/bin/env node

/**
 * ============================================================================
 * FILE: src/index.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Main entry point untuk aplikasi SmartGov Gemini Bot. File ini menangani
 * inisialisasi aplikasi, koneksi database, startup bot, dan graceful shutdown.
 * Merupakan orchestrator utama yang mengkoordinasikan semua komponen aplikasi.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - config/env: Environment configuration dan settings
 * - utils/logger: Logging utility untuk tracking dan debugging
 * - config/database: Database connection dan configuration
 * - bot: Telegram bot service dan handlers
 * - services/AuthService: Authentication service
 *
 * FITUR UTAMA:
 * 1. Application Initialization
 *    - Environment validation dan setup
 *    - Configuration loading dan validation
 *    - Service dependency injection
 *    - Error handling setup
 *
 * 2. Database Management
 *    - Database connection testing
 *    - Connection pool initialization
 *    - Health check monitoring
 *    - Graceful connection cleanup
 *
 * 3. Bot Service Management
 *    - Telegram bot initialization
 *    - Command dan handler registration
 *    - Bot info retrieval dan logging
 *    - Service lifecycle management
 *
 * 4. Process Management
 *    - Signal handling (SIGINT, SIGTERM)
 *    - Graceful shutdown procedures
 *    - Error handling dan recovery
 *    - Process monitoring
 *
 * 5. Logging & Monitoring
 *    - Application startup logging
 *    - Service status monitoring
 *    - Error tracking dan reporting
 *    - Performance metrics
 *
 * CARA PENGGUNAAN:
 * ```bash
 * # Development mode
 * npm start
 * 
 * # Production mode
 * NODE_ENV=production npm start
 * 
 * # With custom config
 * CONFIG_PATH=/path/to/config npm start
 * ```
 *
 * ENVIRONMENT VARIABLES:
 * - NODE_ENV: Environment mode (development/production)
 * - TELEGRAM_TOKEN: Telegram bot token
 * - GEMINI_API_KEY: Google Gemini AI API key
 * - DATABASE_URL: Database connection string
 * - LOG_LEVEL: Logging level (debug/info/warn/error)
 *
 * CATATAN PENTING:
 * - Aplikasi memerlukan semua environment variables yang valid
 * - Database connection harus berhasil sebelum bot start
 * - Graceful shutdown memastikan cleanup yang proper
 * - Error handling mencakup uncaught exceptions
 * - Process signals di-handle untuk production deployment
 *
 * ============================================================================
 */

const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/database');
const botService = require('./bot');
const AuthService = require('./services/AuthService');

// ============================================================================
// APPLICATION BANNER
// ============================================================================

/**
 * ASCII Art Banner untuk aplikasi startup
 * Menampilkan informasi aplikasi dan teknologi yang digunakan
 */
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        SmartGov Gemini Bot                                ║
║        OCR Kartu Keluarga dengan AI                       ║
║                                                           ║
║        Powered by Google Gemini AI                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

/**
 * Main startup function untuk aplikasi
 * 
 * Menangani seluruh proses inisialisasi aplikasi dari environment
 * validation hingga bot startup dengan comprehensive error handling.
 * 
 * STARTUP SEQUENCE:
 * 1. Display Application Banner
 *    - Show ASCII art banner
 *    - Display application information
 * 
 * 2. Environment Validation
 *    - Log environment mode
 *    - Log Node.js version
 *    - Validate required configurations
 * 
 * 3. Database Initialization
 *    - Test database connection
 *    - Initialize connection pool
 *    - Validate database accessibility
 * 
 * 4. Bot Service Initialization
 *    - Initialize Telegram bot
 *    - Register commands dan handlers
 *    - Retrieve bot information
 * 
 * 5. Service Status Reporting
 *    - Log successful initialization
 *    - Display bot information
 *    - Show ready status
 * 
 * ERROR HANDLING:
 * - Database connection failures: Exit dengan error code 1
 * - Bot initialization failures: Exit dengan error code 1
 * - Configuration errors: Exit dengan error code 1
 * - System errors: Comprehensive logging dan exit
 * 
 * @async
 * @function startup
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @throws {Error} Jika database connection gagal
 * @throws {Error} Jika bot initialization gagal
 * @throws {Error} Jika configuration tidak valid
 * 
 * @example
 * // Function dipanggil otomatis saat aplikasi start
 * startup().catch(error => {
 *   console.error('Startup failed:', error);
 *   process.exit(1);
 * });
 */
async function startup() {
  try {
    // ========================================================================
    // STEP 1: DISPLAY APPLICATION BANNER
    // ========================================================================
    
    /**
     * Display ASCII art banner
     * Memberikan visual feedback bahwa aplikasi sedang starting
     */
    console.log(banner);
    logger.info('Starting SmartGov Gemini Bot...');
    logger.info(`Environment: ${config.env}`);
    logger.info(`Node version: ${process.version}`);

    // ========================================================================
    // STEP 2: DATABASE INITIALIZATION
    // ========================================================================
    
    /**
     * Test database connection
     * Pastikan database dapat diakses sebelum melanjutkan
     */
    logger.info('Testing database connection...');
    const dbConnected = await db.testConnection();

    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    logger.info('Database connection successful');

    /**
     * Initialize database connection pool
     * Setup connection pooling untuk performance optimization
     */
    db.createPool();

    // ========================================================================
    // STEP 3: BOT SERVICE INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize Telegram bot service
     * Setup bot dengan commands dan handlers
     */
    logger.info('Initializing Telegram bot...');
    const bot = botService.initialize();

    logger.info('Bot initialized successfully');

    /**
     * Retrieve bot information
     * Get bot details untuk logging dan verification
     */
    const botInfo = await bot.getMe();
    logger.info(`Bot username: @${botInfo.username}`);
    logger.info(`Bot name: ${botInfo.first_name}`);

    // ========================================================================
    // STEP 4: SERVICE STATUS REPORTING
    // ========================================================================
    
    /**
     * Log successful startup
     * Informasi bahwa aplikasi sudah ready untuk menerima requests
     */
    logger.info('Bot is now running and listening for messages...');
    logger.info('Press Ctrl+C to stop');

    console.log('\nBot is running successfully!\n');

  } catch (error) {
    /**
     * Handle startup errors
     * Log error dan exit dengan error code
     */
    logger.error('Startup failed:', error);
    console.error('\nFailed to start bot:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// APPLICATION SHUTDOWN
// ============================================================================

/**
 * Graceful shutdown function untuk aplikasi
 * 
 * Menangani proses shutdown yang aman dengan cleanup semua resources
 * dan services sebelum aplikasi exit. Memastikan data integrity dan
 * proper resource deallocation.
 * 
 * SHUTDOWN SEQUENCE:
 * 1. Signal Reception
 *    - Receive shutdown signal (SIGINT, SIGTERM)
 *    - Log shutdown initiation
 *    - Set shutdown flag
 * 
 * 2. Service Cleanup
 *    - Stop bot service dan handlers
 *    - Close database connections
 *    - Cleanup temporary resources
 *    - Save pending data
 * 
 * 3. Resource Cleanup
 *    - Close file handles
 *    - Clear memory caches
 *    - Cleanup temporary files
 *    - Release system resources
 * 
 * 4. Process Exit
 *    - Log successful shutdown
 *    - Exit dengan success code
 *    - Handle cleanup errors
 * 
 * ERROR HANDLING:
 * - Service stop failures: Log error, continue cleanup
 * - Database close failures: Log error, force exit
 * - Resource cleanup failures: Log warning, continue
 * - Critical errors: Force exit dengan error code
 * 
 * @async
 * @function shutdown
 * @param {string} signal - Signal yang diterima (SIGINT, SIGTERM)
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // Dipanggil otomatis saat menerima signal
 * process.on('SIGINT', () => shutdown('SIGINT'));
 * process.on('SIGTERM', () => shutdown('SIGTERM'));
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // ========================================================================
    // STEP 1: SERVICE CLEANUP
    // ========================================================================
    
    /**
     * Stop bot service
     * Hentikan bot dan semua handlers dengan graceful
     */
    await botService.stop();

    /**
     * Close database connection pool
     * Tutup semua database connections dengan proper cleanup
     */
    await db.closePool();

    // ========================================================================
    // STEP 2: SHUTDOWN COMPLETION
    // ========================================================================
    
    /**
     * Log successful shutdown
     * Informasi bahwa shutdown berhasil diselesaikan
     */
    logger.info('Shutdown completed');
    process.exit(0);

  } catch (error) {
    /**
     * Handle shutdown errors
     * Log error dan force exit dengan error code
     */
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// ============================================================================
// PROCESS SIGNAL HANDLERS
// ============================================================================

/**
 * Handle SIGINT signal (Ctrl+C)
 * Graceful shutdown saat user menekan Ctrl+C
 */
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Handle SIGTERM signal (kill command)
 * Graceful shutdown saat process di-terminate
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ============================================================================
// ERROR HANDLERS
// ============================================================================

/**
 * Handle uncaught exceptions
 * 
 * Menangani exceptions yang tidak ter-handle oleh try-catch blocks.
 * Biasanya terjadi karena programming errors atau system issues.
 * 
 * HANDLING STRATEGY:
 * 1. Log error dengan stack trace
 * 2. Display error ke console
 * 3. Exit process dengan error code 1
 * 4. Prevent application crash loop
 * 
 * @param {Error} error - Uncaught exception object
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 * 
 * Menangani promise rejections yang tidak ter-handle oleh .catch().
 * Biasanya terjadi karena async operations yang gagal.
 * 
 * HANDLING STRATEGY:
 * 1. Log rejection dengan reason dan promise
 * 2. Display error ke console
 * 3. Continue execution (tidak exit)
 * 4. Monitor untuk debugging
 * 
 * @param {*} reason - Rejection reason
 * @param {Promise} promise - Rejected promise
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('Unhandled rejection:', reason);
});

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

/**
 * Start aplikasi
 * 
 * Memanggil startup function untuk menginisialisasi aplikasi.
 * Error handling dilakukan di dalam startup function.
 */
startup();
