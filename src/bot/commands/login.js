const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const Validator = require('../../utils/validator');

const loginCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/login command from chat ${chatId}`);

  const parts = text.split(' ');

  if (parts.length < 3) {
    await bot.sendMessage(
      chatId,
      'Format perintah tidak valid.\n\n' +
      'Format yang benar: /login <username> <password>\n\n' +
      'Penjelasan:\n' +
      '- <username>: Nama pengguna akun SmartGov Anda\n' +
      '- <password>: Kata sandi akun SmartGov Anda\n\n' +
      'Contoh penggunaan:\n' +
      '/login admin123 password123\n' +
      '/login kepala_desa kata_sandi_rahasia\n' +
      '/login sekretaris_desa sandi123456'
    );
    return;
  }

  const username = parts[1];
  const password = parts.slice(2).join(' ');

  const validation = Validator.validateLogin(username, password);

  if (!validation.isValid) {
    await bot.sendMessage(
      chatId,
      `Validasi gagal. Kesalahan yang ditemukan:\n\n${validation.errors.join('\n')}\n\n` +
      'Silakan periksa kembali format input Anda dan coba lagi.'
    );
    return;
  }

  const processingMsg = await bot.sendMessage(chatId, 'Sedang memproses autentikasi pengguna. Mohon tunggu sebentar...');

  try {
    const result = await AuthService.login(chatId, username, password);

    if (result.success) {
      await bot.editMessageText(
        `Autentikasi berhasil! Selamat datang di sistem SmartGov Gemini Bot.\n\n` +
        `Status login: BERHASIL\n` +
        `Nama pengguna: ${result.user.nama_lengkap}\n` +
        `Username: ${result.user.username}\n` +
        `Level akses: ${result.user.level}\n\n` +
        `Langkah selanjutnya:\n` +
        `1. Atur kode wilayah menggunakan perintah: /kode-wilayah <kode-wilayah>\n` +
        `2. Contoh: /kode-wilayah 33.01.06.2016\n` +
        `3. Setelah kode wilayah diatur, Anda dapat mengirim foto Kartu Keluarga (KK) untuk diproses\n\n` +
        `Sistem siap digunakan untuk memproses data KK secara otomatis.`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
    } else {
      await bot.editMessageText(
        `Autentikasi gagal.\n\n` +
        `Pesan kesalahan: ${result.message}\n\n` +
        `Kemungkinan penyebab:\n` +
        `- Username atau password salah\n` +
        `- Akun tidak aktif\n` +
        `- Koneksi ke server bermasalah\n\n` +
        `Silakan periksa kembali kredensial Anda dan coba lagi.`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
    }

  } catch (error) {
    logger.error('Error in login command:', error);

    await bot.editMessageText(
      'Terjadi kesalahan sistem saat melakukan autentikasi.\n\n' +
      'Kemungkinan penyebab:\n' +
      '- Koneksi ke database bermasalah\n' +
      '- Server sedang dalam pemeliharaan\n' +
      '- Terjadi gangguan pada sistem\n\n' +
      'Silakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator sistem.',
      {
        chat_id: chatId,
        message_id: processingMsg.message_id
      }
    );
  }
};

const logoutCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/logout command from chat ${chatId}`);

  try {
    const result = await AuthService.logout(chatId);

    if (result.success) {
      await bot.sendMessage(chatId, `Logout berhasil.\n\n${result.message}\n\nSesi Anda telah berakhir. Untuk menggunakan sistem kembali, silakan lakukan login ulang.`);
    } else {
      await bot.sendMessage(chatId, `Logout gagal.\n\n${result.message}\n\nSilakan coba lagi atau hubungi administrator jika masalah berlanjut.`);
    }

  } catch (error) {
    logger.error('Error in logout command:', error);
    await bot.sendMessage(chatId, 'Terjadi kesalahan sistem saat melakukan logout.\n\nSilakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator sistem.');
  }
};

module.exports = {
  loginCommand,
  logoutCommand
};
