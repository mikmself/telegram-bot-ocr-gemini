const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/env');
const logger = require('../utils/logger');

// Import commands
const startCommand = require('./commands/start');
const { loginCommand, logoutCommand } = require('./commands/login');
const kodeWilayahCommand = require('./commands/kode_wilayah');
const { cekSessionCommand, helpCommand } = require('./commands/cek_session');

// Import handlers
const photoHandler = require('./handlers/photo');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
  }

  initialize() {
    try {
      if (!config.telegram.token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
      }

      // Create bot instance
      this.bot = new TelegramBot(config.telegram.token, {
        polling: config.telegram.polling
      });

      logger.info('Telegram bot initialized');

      // Setup commands
      this.setupCommands();

      // Setup handlers
      this.setupHandlers();

      // Setup error handling
      this.setupErrorHandling();

      this.isRunning = true;

      logger.info('Telegram bot started successfully');

      return this.bot;

    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  setupCommands() {
    // Start command
    this.bot.onText(/\/start/, (msg) => {
      startCommand(this.bot, msg);
    });

    // Login command
    this.bot.onText(/\/login(.*)/, (msg) => {
      loginCommand(this.bot, msg);
    });

    // Logout command
    this.bot.onText(/\/logout/, (msg) => {
      logoutCommand(this.bot, msg);
    });

    // Kode wilayah command
    this.bot.onText(/\/kode-wilayah(.*)/, (msg) => {
      kodeWilayahCommand(this.bot, msg);
    });

    // Cek session command
    this.bot.onText(/\/cek-session/, (msg) => {
      cekSessionCommand(this.bot, msg);
    });

    // Help command
    this.bot.onText(/\/help/, (msg) => {
      helpCommand(this.bot, msg);
    });

    logger.info('Bot commands registered');
  }

  setupHandlers() {
    // Photo handler
    this.bot.on('photo', (msg) => {
      photoHandler(this.bot, msg);
    });

    // Document handler (for images sent as documents)
    this.bot.on('document', (msg) => {
      if (msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
        // Treat image documents as photos
        logger.info('Image document received, treating as photo');

        // Convert document to photo-like object
        msg.photo = [{
          file_id: msg.document.file_id,
          file_unique_id: msg.document.file_unique_id,
          file_size: msg.document.file_size,
          width: 0,
          height: 0
        }];

        photoHandler(this.bot, msg);
      }
    });

    // Text handler for village code responses only
    this.bot.on('message', async (msg) => {
      // Only handle non-command text messages for village code process
      if (msg.text && !msg.text.startsWith('/')) {
        if (kodeWilayahCommand.isInVillageCodeProcess && kodeWilayahCommand.isInVillageCodeProcess(msg.chat.id)) {
          await kodeWilayahCommand.handleVillageCodeMessage(this.bot, msg);
          return;
        }
      }

      // Handle unknown commands
      if (msg.text && msg.text.startsWith('/')) {
        const command = msg.text.split(' ')[0];
        const knownCommands = ['/start', '/login', '/logout', '/kode-wilayah', '/cek-session', '/help'];

        if (!knownCommands.includes(command)) {
          this.bot.sendMessage(
            msg.chat.id,
            '❓ Perintah tidak dikenali.\n\n' +
            'Gunakan /help untuk melihat daftar perintah yang tersedia.'
          );
        }
      }
    });

    logger.info('Bot handlers registered');
  }

  setupErrorHandling() {
    // Polling error
    this.bot.on('polling_error', (error) => {
      logger.error('Polling error:', error);
    });

    // Webhook error (if used)
    this.bot.on('webhook_error', (error) => {
      logger.error('Webhook error:', error);
    });

    // General error
    this.bot.on('error', (error) => {
      logger.error('Bot error:', error);
    });

    logger.info('Error handlers registered');
  }

  async stop() {
    if (this.bot && this.isRunning) {
      try {
        await this.bot.stopPolling();
        this.isRunning = false;
        logger.info('Telegram bot stopped');
      } catch (error) {
        logger.error('Error stopping bot:', error);
      }
    }
  }

  getBot() {
    return this.bot;
  }

  isActive() {
    return this.isRunning;
  }
}

module.exports = new TelegramBotService();
