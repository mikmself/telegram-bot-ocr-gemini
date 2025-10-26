const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const Validator = require('../../utils/validator');

// Login command
const loginCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/login command from chat ${chatId}`);

  // Parse username and password
  const parts = text.split(' ');

  if (parts.length < 3) {
    await bot.sendMessage(
      chatId,
      '❌ Format salah!\n\n' +
      'Gunakan: /login <username> <password>\n\n' +
      'Contoh:\n' +
      '/login admin password123'
    );
    return;
  }

  const username = parts[1];
  const password = parts.slice(2).join(' '); // Support password with spaces

  // Validate credentials
  const validation = Validator.validateLogin(username, password);

  if (!validation.isValid) {
    await bot.sendMessage(
      chatId,
      `❌ ${validation.errors.join('\n')}`
    );
    return;
  }

  // Show processing message
  const processingMsg = await bot.sendMessage(chatId, '🔐 Memproses login...');

  try {
    // Attempt login
    const result = await AuthService.login(chatId, username, password);

    if (result.success) {
      await bot.editMessageText(
        `✅ ${result.message}\n\n` +
        `Username: ${result.user.username}\n` +
        `Level: ${result.user.level || 'Tidak ada'}\n\n` +
        `Sekarang Anda dapat mengirim foto Kartu Keluarga (KK) untuk diproses.`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
    } else {
      await bot.editMessageText(
        `❌ ${result.message}`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
    }

  } catch (error) {
    logger.error('Error in login command:', error);

    await bot.editMessageText(
      '❌ Terjadi kesalahan saat login. Silakan coba lagi.',
      {
        chat_id: chatId,
        message_id: processingMsg.message_id
      }
    );
  }
};

// Logout command
const logoutCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/logout command from chat ${chatId}`);

  try {
    const result = await AuthService.logout(chatId);

    if (result.success) {
      await bot.sendMessage(chatId, `✅ ${result.message}`);
    } else {
      await bot.sendMessage(chatId, `❌ ${result.message}`);
    }

  } catch (error) {
    logger.error('Error in logout command:', error);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat logout.');
  }
};

module.exports = {
  loginCommand,
  logoutCommand
};
