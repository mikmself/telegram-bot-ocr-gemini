#!/usr/bin/env node

const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/database');
const botService = require('./bot');
const AuthService = require('./services/AuthService');

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

    logger.info('Testing database connection...');
    const dbConnected = await db.testConnection();

    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    logger.info('Database connection successful');

    db.createPool();

    logger.info('Initializing Telegram bot...');
    const bot = botService.initialize();

    logger.info('Bot initialized successfully');

    const botInfo = await bot.getMe();
    logger.info(`Bot username: @${botInfo.username}`);
    logger.info(`Bot name: ${botInfo.first_name}`);

    logger.info('Bot is now running and listening for messages...');
    logger.info('Press Ctrl+C to stop');

    console.log('\nBot is running successfully!\n');

  } catch (error) {
    logger.error('Startup failed:', error);
    console.error('\nFailed to start bot:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await botService.stop();

    await db.closePool();

    logger.info('Shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('Unhandled rejection:', reason);
});

startup();
