#!/usr/bin/env node

const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/database');
const botService = require('./bot');
const AuthService = require('./services/AuthService');

// ASCII Art Banner
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

async function startup() {
  try {
    console.log(banner);
    logger.info('Starting SmartGov Gemini Bot...');
    logger.info(`Environment: ${config.env}`);
    logger.info(`Node version: ${process.version}`);

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await db.testConnection();

    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    logger.info('Database connection successful');

    // Create database connection pool
    db.createPool();

    // Initialize Telegram bot
    logger.info('Initializing Telegram bot...');
    const bot = botService.initialize();

    logger.info('Bot initialized successfully');

    // Get bot info
    const botInfo = await bot.getMe();
    logger.info(`Bot username: @${botInfo.username}`);
    logger.info(`Bot name: ${botInfo.first_name}`);

    // Session cleanup removed - no longer using database sessions

    logger.info('Bot is now running and listening for messages...');
    logger.info('Press Ctrl+C to stop');

    console.log('\n✅ Bot is running successfully!\n');

  } catch (error) {
    logger.error('Startup failed:', error);
    console.error('\n❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop bot
    await botService.stop();

    // Close database connections
    await db.closePool();

    logger.info('Shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('Unhandled rejection:', reason);
});

// Start the application
startup();
