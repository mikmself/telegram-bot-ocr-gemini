const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/env');
const logger = require('../utils/logger');

const startCommand = require('./commands/start');
const { loginCommand, logoutCommand } = require('./commands/login');
const kodeWilayahCommand = require('./commands/kode_wilayah');
const { cekSessionCommand, helpCommand } = require('./commands/cek_session');

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

      this.bot = new TelegramBot(config.telegram.token, {
        polling: config.telegram.polling
      });

      logger.info('Telegram bot initialized');

      this.setupCommands();

      this.setupHandlers();

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
    this.bot.onText(/\/start/, (msg) => {
      startCommand(this.bot, msg);
    });

    this.bot.onText(/\/login(.*)/, (msg) => {
      loginCommand(this.bot, msg);
    });

    this.bot.onText(/\/logout/, (msg) => {
      logoutCommand(this.bot, msg);
    });

    this.bot.onText(/\/kode-wilayah(.*)/, (msg) => {
      kodeWilayahCommand(this.bot, msg);
    });

    this.bot.onText(/\/cek-session/, (msg) => {
      cekSessionCommand(this.bot, msg);
    });

    this.bot.onText(/\/help/, (msg) => {
      helpCommand(this.bot, msg);
    });

    logger.info('Bot commands registered');
  }

  setupHandlers() {
    this.bot.on('photo', (msg) => {
      photoHandler(this.bot, msg);
    });

    this.bot.on('document', (msg) => {
      if (msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
        logger.info('Image document received, treating as photo');

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

    this.bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        if (kodeWilayahCommand.isInVillageCodeProcess && kodeWilayahCommand.isInVillageCodeProcess(msg.chat.id)) {
          await kodeWilayahCommand.handleVillageCodeMessage(this.bot, msg);
          return;
        }
      }

      if (msg.text && msg.text.startsWith('/')) {
        const command = msg.text.split(' ')[0];
        const knownCommands = ['/start', '/login', '/logout', '/kode-wilayah', '/cek-session', '/help'];

        if (!knownCommands.includes(command)) {
          this.bot.sendMessage(
            msg.chat.id,
            'Perintah tidak dikenali oleh sistem.\n\n' +
            'Perintah yang Anda masukkan tidak valid atau tidak tersedia dalam sistem ini.\n\n' +
            'Untuk melihat daftar perintah yang tersedia, gunakan perintah /help.\n\n' +
            'Daftar perintah yang valid:\n' +
            '- /start - Menampilkan informasi sistem\n' +
            '- /login - Melakukan autentikasi\n' +
            '- /logout - Keluar dari sistem\n' +
            '- /cek-session - Memeriksa status sesi\n' +
            '- /kode-wilayah - Mengatur kode wilayah\n' +
            '- /help - Menampilkan panduan lengkap'
          );
        }
      }
    });

    logger.info('Bot handlers registered');
  }

  setupErrorHandling() {
    this.bot.on('polling_error', (error) => {
      logger.error('Polling error:', error);
    });

    this.bot.on('webhook_error', (error) => {
      logger.error('Webhook error:', error);
    });

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
