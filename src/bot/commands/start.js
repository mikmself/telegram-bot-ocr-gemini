const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  logger.info(`/start command from chat ${chatId}`);

  // Check if already logged in
  const isLoggedIn = AuthService.isLoggedIn(chatId);

  let message = `✅ Selamat datang di *SmartGov Gemini Bot*! 👋\n\n`;

  if (isLoggedIn) {
    const userInfo = AuthService.getUserInfo(chatId);
    const hasVillageCode = AuthService.hasVillageCode(chatId);
    
    message += `Anda sudah login sebagai: *${userInfo.nama_lengkap}*\n`;
    message += `Username: ${userInfo.username}\n`;
    message += `Level: ${userInfo.level}\n\n`;
    
    if (hasVillageCode) {
      const villageData = AuthService.getVillageData(chatId);
      message += `🏘️ Kode Wilayah: \`${userInfo.villageCode}\`\n`;
      message += `${villageData?.name || 'Tidak diketahui'}, ${villageData?.district_name || 'Tidak diketahui'}\n\n`;
      message += `📸 Kirim foto Kartu Keluarga (KK) untuk memulai proses OCR.\n\n`;
    } else {
      message += `❌ Kode wilayah belum di-set\n\n`;
      message += `Silakan set kode wilayah terlebih dahulu dengan /kode-wilayah\n\n`;
    }
  } else {
    message += `Silakan login terlebih dahulu dengan perintah:\n`;
    message += `/login <username> <password>\n\n`;
    message += `Contoh:\n`;
    message += `/login admin password123\n\n`;
  }

  message += `*Perintah yang tersedia:*\n`;
  message += `/start - Mulai bot\n`;
  message += `/login - Login ke sistem\n`;
  message += `/logout - Logout dari sistem\n`;
  message += `/cek-session - Cek status login\n`;
  message += `/kode-wilayah - Cek informasi kode wilayah\n`;
  message += `/help - Bantuan penggunaan bot\n\n`;

  message += `*Cara penggunaan:*\n`;
  message += `1. Login menggunakan akun SmartGov\n`;
  message += `2. Kirim foto Kartu Keluarga (KK)\n`;
  message += `3. Bot akan otomatis extract data menggunakan AI\n`;
  message += `4. Data akan disimpan ke database SmartGov\n\n`;

  message += `Powered by Google Gemini AI 🤖`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};
