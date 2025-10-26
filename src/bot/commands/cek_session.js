const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const moment = require('moment-timezone');

const cekSessionCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/cek-session command from chat ${chatId}`);

  try {
    const isLoggedIn = AuthService.isLoggedIn(chatId);

    if (!isLoggedIn) {
      await bot.sendMessage(
        chatId,
        'Status autentikasi: BELUM LOGIN\n\n' +
        'Anda belum melakukan login ke dalam sistem.\n\n' +
        'Untuk mengakses fitur ini, silakan login terlebih dahulu menggunakan perintah:\n' +
        '/login username password\n\n' +
        'Contoh penggunaan:\n' +
        '/login admin123 password123\n' +
        '/login kepala\\_desa kata\\_sandi\\_rahasia'
      );
      return;
    }

    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      await bot.sendMessage(
        chatId,
        'Gagal mendapatkan informasi sesi login.\n\n' +
        'Kemungkinan penyebab:\n' +
        '- Sesi login telah berakhir\n' +
        '- Terjadi kesalahan pada sistem\n' +
        '- Data sesi tidak valid\n\n' +
        'Silakan lakukan login ulang menggunakan perintah /login untuk mengakses sistem kembali.'
      );
      return;
    }

    const loginAt = moment(userInfo.loginAt).tz('Asia/Jakarta');
    const lastActivity = moment(userInfo.lastActivity).tz('Asia/Jakarta');
    const now = moment().tz('Asia/Jakarta');
    
    const expiresAt = moment(userInfo.lastActivity).add(24, 'hours').tz('Asia/Jakarta');
    const timeLeft = moment.duration(expiresAt.diff(now));

    const hours = Math.floor(timeLeft.asHours());
    const minutes = Math.floor(timeLeft.asMinutes() % 60);

    let message = `Status Sesi Login\n\n`;
    message += `Informasi pengguna:\n`;
    message += `Username: ${userInfo.username}\n`;
    message += `Nama lengkap: ${userInfo.nama_lengkap}\n`;
    message += `Level akses: ${userInfo.level}\n\n`;
    message += `Informasi sesi:\n`;
    message += `Waktu login: ${loginAt.format('DD-MM-YYYY HH:mm')} WIB\n`;
    message += `Aktivitas terakhir: ${lastActivity.format('DD-MM-YYYY HH:mm')} WIB\n`;
    message += `Sesi berakhir pada: ${expiresAt.format('DD-MM-YYYY HH:mm')} WIB\n`;
    message += `Waktu tersisa: ${hours} jam ${minutes} menit\n\n`;
    message += `Informasi teknis:\n`;
    message += `Chat ID: \`${chatId}\`\n\n`;
    message += `Sesi login Anda masih aktif dan dapat digunakan untuk mengakses semua fitur sistem.`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error in cek-session command:', error);
    await bot.sendMessage(chatId, 'Terjadi kesalahan sistem saat memeriksa status sesi login.\n\nKemungkinan penyebab:\n- Koneksi ke database bermasalah\n- Server sedang dalam pemeliharaan\n- Terjadi gangguan pada sistem\n\nSilakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator sistem.');
  }
};

const helpCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/help command from chat ${chatId}`);

  let message = `Panduan Lengkap Penggunaan Sistem Bot SmartGov Gemini\n\n`;

  message += `Sistem ini dirancang khusus untuk membantu aparatur desa dalam memproses data Kartu Keluarga (KK) secara otomatis menggunakan teknologi kecerdasan buatan.\n\n`;

  message += `Perintah Autentikasi:\n`;
  message += `/start - Menampilkan informasi sistem dan status login\n`;
  message += `/login username password - Melakukan autentikasi ke dalam sistem\n`;
  message += `/logout - Keluar dari sistem dan mengakhiri sesi\n`;
  message += `/stop - Menghentikan bot dan keluar dari sistem\n`;
  message += `/cek-session - Memeriksa status sesi login saat ini\n\n`;

  message += `Perintah Utilitas:\n`;
  message += `/kode-wilayah kode - Mengatur atau memeriksa kode wilayah kerja\n`;
  message += `/help - Menampilkan panduan lengkap penggunaan sistem\n\n`;

  message += `Langkah-langkah Menggunakan Sistem OCR:\n`;
  message += `1. Lakukan login menggunakan akun SmartGov yang valid\n`;
  message += `2. Atur kode wilayah sesuai dengan wilayah kerja Anda\n`;
  message += `   Gunakan: /kode-wilayah kode_wilayah\n`;
  message += `3. Kirim foto Kartu Keluarga (KK) dengan kualitas yang baik\n`;
  message += `4. Sistem akan mengekstrak data secara otomatis menggunakan AI\n`;
  message += `5. Data hasil ekstraksi akan disimpan ke database SmartGov\n\n`;

  message += `Panduan Foto untuk Hasil Terbaik:\n`;
  message += `- Pastikan foto KK jelas dan tidak blur\n`;
  message += `- Ambil foto dengan pencahayaan yang baik dan merata\n`;
  message += `- Hindari bayangan yang menutupi teks pada KK\n`;
  message += `- Pastikan seluruh bagian KK terlihat dengan jelas\n`;
  message += `- Format file yang didukung: JPG, PNG (maksimal 10MB)\n`;
  message += `- Posisikan kamera tegak lurus dengan KK untuk hasil optimal\n\n`;

  message += `Informasi Teknis Sistem:\n`;
  message += `- Mesin OCR: Google Gemini 2.5 Flash\n`;
  message += `- Tingkat akurasi: 90-95%\n`;
  message += `- Waktu pemrosesan: 5-15 detik per foto\n`;
  message += `- Database: MySQL (SmartGov)\n`;
  message += `- Dukungan format: Kartu Keluarga (KK) standar Indonesia\n\n`;

  message += `Jika mengalami masalah atau memerlukan bantuan teknis, silakan hubungi administrator sistem.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

module.exports = {
  cekSessionCommand,
  helpCommand
};
