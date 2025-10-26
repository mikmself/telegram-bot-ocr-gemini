const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  logger.info(`/start command from chat ${chatId}`);

  const isLoggedIn = AuthService.isLoggedIn(chatId);

  let message = `Selamat datang di *Sistem Bot SmartGov Gemini*!\n\n`;
  message += `Sistem ini dirancang khusus untuk membantu aparatur desa dalam memproses data Kartu Keluarga (KK) secara otomatis menggunakan teknologi kecerdasan buatan Google Gemini.\n\n`;

  if (isLoggedIn) {
    const userInfo = AuthService.getUserInfo(chatId);
    const hasVillageCode = AuthService.hasVillageCode(chatId);
    
    message += `Status autentikasi: *BERHASIL LOGIN*\n`;
    message += `Nama lengkap: *${userInfo.nama_lengkap}*\n`;
    message += `Username: ${userInfo.username}\n`;
    message += `Level akses: ${userInfo.level}\n\n`;
    
    if (hasVillageCode) {
      const villageData = AuthService.getVillageData(chatId);
      message += `Kode Wilayah: \`${userInfo.villageCode}\`\n`;
      message += `Lokasi: ${villageData?.name || 'Tidak diketahui'}, ${villageData?.district_name || 'Tidak diketahui'}\n\n`;
      message += `Sistem siap memproses data KK.\n\n`;
      message += `Cara penggunaan:\n`;
      message += `1. Login menggunakan akun SmartGov (Selesai)\n`;
      message += `2. Atur kode wilayah (Selesai)\n`;
      message += `3. Kirim foto Kartu Keluarga (KK)\n`;
      message += `4. Bot akan otomatis extract data menggunakan AI\n`;
      message += `5. Data akan disimpan ke database SmartGov\n\n`;
      message += `Silakan kirim foto KK untuk memulai proses OCR.\n\n`;
    } else {
      message += `Status kode wilayah: *BELUM DIATUR*\n\n`;
      message += `Sebelum dapat memproses data KK, Anda harus mengatur kode wilayah terlebih dahulu.\n`;
      message += `Gunakan perintah: /kode-wilayah kode_wilayah\n`;
      message += `Contoh: /kode-wilayah 33.01.06.2016\n\n`;
    }
  } else {
    message += `Status autentikasi: *BELUM LOGIN*\n\n`;
    message += `Untuk menggunakan sistem ini, Anda harus melakukan login terlebih dahulu.\n`;
    message += `Format perintah login:\n`;
    message += `/login username password\n\n`;
    message += `Contoh penggunaan:\n`;
    message += `/login admin123 password123\n`;
    message += `/login kepala\\_desa kata\\_sandi\\_rahasia\n\n`;
  }

  message += `*Daftar perintah yang tersedia:*\n`;
  message += `/start - Menampilkan informasi sistem dan status login\n`;
  message += `/login - Melakukan autentikasi ke dalam sistem\n`;
  message += `/logout - Keluar dari sistem\n`;
  message += `/stop - Menghentikan bot dan keluar dari sistem\n`;
  message += `/cek-session - Memeriksa status sesi login saat ini\n`;
  message += `/kode-wilayah - Mengatur atau memeriksa kode wilayah\n`;
  message += `/help - Menampilkan panduan lengkap penggunaan sistem\n\n`;

  message += `*Langkah-langkah penggunaan sistem:*\n`;
  message += `1. Lakukan login menggunakan akun SmartGov yang valid\n`;
  message += `2. Atur kode wilayah sesuai dengan wilayah kerja Anda\n`;
  message += `3. Kirim foto Kartu Keluarga (KK) dengan kualitas yang baik\n`;
  message += `4. Sistem akan mengekstrak data secara otomatis menggunakan AI\n`;
  message += `5. Data hasil ekstraksi akan disimpan ke database SmartGov\n\n`;

  message += `Sistem ini didukung oleh teknologi Google Gemini AI untuk akurasi ekstraksi data yang optimal.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};
