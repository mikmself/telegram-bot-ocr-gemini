const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const moment = require('moment-timezone');

// Cek session command
const cekSessionCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/cek-session command from chat ${chatId}`);

  try {
    const isLoggedIn = AuthService.isLoggedIn(chatId);

    if (!isLoggedIn) {
      await bot.sendMessage(
        chatId,
        '❌ Anda belum login.\n\n' +
        'Gunakan perintah:\n' +
        '/login <username> <password>'
      );
      return;
    }

    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      await bot.sendMessage(
        chatId,
        '❌ Gagal mendapatkan informasi session.\n\n' +
        'Silakan login ulang.'
      );
      return;
    }

    const loginAt = moment(userInfo.loginAt).tz('Asia/Jakarta');
    const lastActivity = moment(userInfo.lastActivity).tz('Asia/Jakarta');
    const now = moment().tz('Asia/Jakarta');
    
    // Calculate session expiry (24 hours from last activity)
    const expiresAt = moment(userInfo.lastActivity).add(24, 'hours').tz('Asia/Jakarta');
    const timeLeft = moment.duration(expiresAt.diff(now));

    const hours = Math.floor(timeLeft.asHours());
    const minutes = Math.floor(timeLeft.asMinutes() % 60);

    let message = `✅ *Status Login*\n\n`;
    message += `Username: ${userInfo.username}\n`;
    message += `Nama: ${userInfo.nama_lengkap}\n`;
    message += `Level: ${userInfo.level}\n\n`;
    message += `Login sejak: ${loginAt.format('DD-MM-YYYY HH:mm')}\n`;
    message += `Aktivitas terakhir: ${lastActivity.format('DD-MM-YYYY HH:mm')}\n`;
    message += `Sesi berakhir: ${expiresAt.format('DD-MM-YYYY HH:mm')}\n`;
    message += `Waktu tersisa: ${hours} jam ${minutes} menit\n\n`;
    message += `Chat ID: \`${chatId}\``;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error in cek-session command:', error);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat mengecek session.');
  }
};

// Help command
const helpCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/help command from chat ${chatId}`);

  let message = `📚 *Bantuan Penggunaan Bot*\n\n`;

  message += `*Perintah Autentikasi:*\n`;
  message += `/start - Mulai bot dan lihat petunjuk\n`;
  message += `/login <username> <password> - Login ke sistem\n`;
  message += `/logout - Keluar dari sistem\n`;
  message += `/cek-session - Cek status login Anda\n\n`;

  message += `*Perintah Utilitas:*\n`;
  message += `/kode-wilayah <kode> - Cek informasi kode wilayah\n`;
  message += `/help - Tampilkan bantuan ini\n\n`;

  message += `*Cara Menggunakan OCR:*\n`;
  message += `1. Login terlebih dahulu dengan /login\n`;
  message += `2. Kirim foto Kartu Keluarga (KK) yang jelas\n`;
  message += `3. Bot akan otomatis memproses dengan AI\n`;
  message += `4. Data akan disimpan ke database\n\n`;

  message += `*Tips untuk Hasil Terbaik:*\n`;
  message += `• Pastikan foto KK jelas dan tidak blur\n`;
  message += `• Ambil foto dengan pencahayaan yang baik\n`;
  message += `• Hindari bayangan pada foto\n`;
  message += `• Foto harus menampilkan seluruh KK\n`;
  message += `• Format file: JPG, PNG (max 10MB)\n\n`;

  message += `*Informasi Teknis:*\n`;
  message += `• OCR Engine: Google Gemini 1.5 Flash\n`;
  message += `• Akurasi: ~90-95%\n`;
  message += `• Waktu proses: 5-15 detik\n`;
  message += `• Database: MySQL (SmartGov)\n\n`;

  message += `Jika ada masalah, hubungi administrator.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

module.exports = {
  cekSessionCommand,
  helpCommand
};
