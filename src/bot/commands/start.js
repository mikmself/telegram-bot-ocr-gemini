/**
 * ============================================================================
 * FILE: src/bot/commands/start.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Command handler untuk perintah /start pada Telegram bot. Menampilkan
 * informasi sistem, status login user, dan panduan penggunaan bot.
 * Merupakan entry point utama untuk user yang baru menggunakan bot.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - logger: Logging utility untuk tracking command usage
 * - AuthService: Authentication service untuk cek login status
 *
 * FITUR UTAMA:
 * 1. Welcome Message
 *    - Menampilkan informasi sistem dan teknologi
 *    - Personalisasi berdasarkan username user
 *    - Branding dan identitas aplikasi
 *
 * 2. Authentication Status Display
 *    - Cek status login user
 *    - Tampilkan informasi user jika sudah login
 *    - Panduan login jika belum login
 *
 * 3. Village Code Status
 *    - Cek status kode wilayah
 *    - Tampilkan informasi wilayah jika sudah diatur
 *    - Panduan setting kode wilayah jika belum
 *
 * 4. Usage Instructions
 *    - Daftar perintah yang tersedia
 *    - Langkah-langkah penggunaan sistem
 *    - Contoh penggunaan perintah
 *
 * 5. System Information
 *    - Informasi teknologi yang digunakan
 *    - Fitur-fitur utama sistem
 *    - Panduan troubleshooting
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * // Command dipanggil otomatis saat user mengetik /start
 * bot.on('message', (msg) => {
 *   if (msg.text === '/start') {
 *     const startHandler = require('./commands/start');
 *     startHandler(bot, msg);
 *   }
 * });
 * ```
 *
 * CATATAN PENTING:
 * - Command ini tidak memerlukan authentication
 * - Menampilkan informasi berbeda berdasarkan login status
 * - Memberikan panduan lengkap untuk new users
 * - Support Markdown formatting untuk rich text
 *
 * ============================================================================
 */

const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');

/**
 * Handler untuk perintah /start
 * 
 * Menampilkan welcome message dan informasi sistem berdasarkan
 * status authentication dan village code user.
 * 
 * MESSAGE STRUCTURE:
 * 1. Welcome Header
 *    - Sistem informasi dan teknologi
 *    - Personalisasi dengan username
 * 
 * 2. Authentication Status
 *    - Login status (BERHASIL/BELUM LOGIN)
 *    - User information jika sudah login
 *    - Login instructions jika belum
 * 
 * 3. Village Code Status
 *    - Village code status (DIATUR/BELUM DIATUR)
 *    - Village information jika sudah diatur
 *    - Setup instructions jika belum
 * 
 * 4. Usage Instructions
 *    - Available commands list
 *    - Step-by-step usage guide
 *    - Examples dan best practices
 * 
 * 5. System Information
 *    - Technology stack information
 *    - Features overview
 *    - Support information
 * 
 * @async
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {number} msg.chat.id - Chat ID (user identifier)
 * @param {Object} msg.from - User information
 * @param {string} msg.from.username - Telegram username
 * @param {string} msg.from.first_name - User first name
 * 
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // User mengetik /start
 * // Bot akan menampilkan welcome message dengan status login
 */
module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  logger.info(`/start command from chat ${chatId}`);

  // ========================================================================
  // AUTHENTICATION STATUS CHECK
  // ========================================================================
  
  /**
   * Cek status login user
   * Digunakan untuk menampilkan informasi yang sesuai
   */
  const isLoggedIn = AuthService.isLoggedIn(chatId);

  // ========================================================================
  // WELCOME MESSAGE CONSTRUCTION
  // ========================================================================
  
  /**
   * Build welcome message dengan informasi sistem
   * Personalisasi berdasarkan status login user
   */
  let message = `Selamat datang di *Sistem Bot SmartGov Gemini*!\n\n`;
  message += `Sistem ini dirancang khusus untuk membantu aparatur desa dalam memproses data Kartu Keluarga (KK) secara otomatis menggunakan teknologi kecerdasan buatan Google Gemini.\n\n`;

  if (isLoggedIn) {
    // ========================================================================
    // LOGGED IN USER INFORMATION
    // ========================================================================
    
    /**
     * Ambil informasi user dan village code status
     * Tampilkan informasi yang relevan untuk user yang sudah login
     */
    const userInfo = AuthService.getUserInfo(chatId);
    const hasVillageCode = AuthService.hasVillageCode(chatId);
    
    message += `Status autentikasi: *BERHASIL LOGIN*\n`;
    message += `Nama lengkap: *${userInfo.nama_lengkap}*\n`;
    message += `Username: ${userInfo.username}\n`;
    message += `Level akses: ${userInfo.level}\n\n`;
    
    if (hasVillageCode) {
      // ========================================================================
      // VILLAGE CODE SET - READY TO USE
      // ========================================================================
      
      /**
       * User sudah login dan set village code
       * Sistem siap untuk memproses foto KK
       */
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
      // ========================================================================
      // VILLAGE CODE NOT SET - NEEDS SETUP
      // ========================================================================
      
      /**
       * User sudah login tapi belum set village code
       * Berikan instruksi untuk setting village code
       */
      message += `Status kode wilayah: *BELUM DIATUR*\n\n`;
      message += `Sebelum dapat memproses data KK, Anda harus mengatur kode wilayah terlebih dahulu.\n`;
      message += `Gunakan perintah: /kode-wilayah kode_wilayah\n`;
      message += `Contoh: /kode-wilayah 33.01.06.2016\n\n`;
    }
  } else {
    // ========================================================================
    // NOT LOGGED IN - LOGIN REQUIRED
    // ========================================================================
    
    /**
     * User belum login
     * Berikan instruksi login dan informasi sistem
     */
    message += `Status autentikasi: *BELUM LOGIN*\n\n`;
    message += `Untuk menggunakan sistem ini, Anda harus melakukan login terlebih dahulu.\n`;
    message += `Format perintah login:\n`;
    message += `/login username password\n\n`;
    message += `Contoh penggunaan:\n`;
    message += `/login admin123 password123\n`;
    message += `/login kepala\\_desa kata\\_sandi\\_rahasia\n\n`;
  }

  // ========================================================================
  // COMMAND REFERENCE & USAGE GUIDE
  // ========================================================================
  
  /**
   * Tambahkan daftar perintah yang tersedia
   * Memberikan quick reference untuk user
   */
  message += `*Daftar perintah yang tersedia:*\n`;
  message += `/start - Menampilkan informasi sistem dan status login\n`;
  message += `/login - Melakukan autentikasi ke dalam sistem\n`;
  message += `/logout - Keluar dari sistem\n`;
  message += `/stop - Menghentikan bot dan keluar dari sistem\n`;
  message += `/cek-session - Memeriksa status sesi login saat ini\n`;
  message += `/kode-wilayah - Mengatur atau memeriksa kode wilayah\n`;
  message += `/help - Menampilkan panduan lengkap penggunaan sistem\n\n`;

  /**
   * Tambahkan langkah-langkah penggunaan sistem
   * Step-by-step guide untuk new users
   */
  message += `*Langkah-langkah penggunaan sistem:*\n`;
  message += `1. Lakukan login menggunakan akun SmartGov yang valid\n`;
  message += `2. Atur kode wilayah sesuai dengan wilayah kerja Anda\n`;
  message += `3. Kirim foto Kartu Keluarga (KK) dengan kualitas yang baik\n`;
  message += `4. Sistem akan mengekstrak data secara otomatis menggunakan AI\n`;
  message += `5. Data hasil ekstraksi akan disimpan ke database SmartGov\n\n`;

  /**
   * Tambahkan informasi teknologi
   * Highlight teknologi yang digunakan untuk credibility
   */
  message += `Sistem ini didukung oleh teknologi Google Gemini AI untuk akurasi ekstraksi data yang optimal.`;

  // ========================================================================
  // SEND MESSAGE TO USER
  // ========================================================================
  
  /**
   * Kirim message ke user dengan Markdown formatting
   * Parse mode Markdown untuk rich text display
   */
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};
