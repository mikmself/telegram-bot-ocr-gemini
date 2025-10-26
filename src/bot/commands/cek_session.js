/**
 * ============================================================================
 * FILE: src/bot/commands/cek_session.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Command handler untuk perintah /cek-session dan /help pada Telegram bot.
 * Menampilkan informasi status sesi login user, session details, dan
 * panduan lengkap penggunaan sistem bot.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - logger: Logging utility untuk tracking command usage
 * - AuthService: Authentication service untuk session management
 * - moment-timezone: Date manipulation dengan timezone support
 *
 * FITUR UTAMA:
 * 1. Session Status Check
 *    - Validasi status login user
 *    - Tampilkan informasi sesi lengkap
 *    - Hitung waktu tersisa sesi
 *    - Informasi teknis session
 *
 * 2. User Information Display
 *    - Username dan nama lengkap
 *    - Level akses user
 *    - Waktu login dan aktivitas terakhir
 *    - Chat ID untuk debugging
 *
 * 3. Help System
 *    - Panduan lengkap penggunaan bot
 *    - Daftar perintah yang tersedia
 *    - Langkah-langkah OCR workflow
 *    - Tips foto untuk hasil optimal
 *    - Informasi teknis sistem
 *
 * 4. Error Handling
 *    - Session validation errors
 *    - Database connection errors
 *    - System error recovery
 *    - User-friendly error messages
 *
 * 5. Timezone Support
 *    - Waktu Indonesia (Asia/Jakarta)
 *    - Format tanggal yang user-friendly
 *    - Perhitungan durasi sesi
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * // Command dipanggil otomatis saat user mengetik /cek-session atau /help
 * bot.on('message', (msg) => {
 *   if (msg.text === '/cek-session') {
 *     const { cekSessionCommand } = require('./commands/cek_session');
 *     cekSessionCommand(bot, msg);
 *   } else if (msg.text === '/help') {
 *     const { helpCommand } = require('./commands/cek_session');
 *     helpCommand(bot, msg);
 *   }
 * });
 * ```
 *
 * CATATAN PENTING:
 * - /cek-session memerlukan user sudah login
 * - /help dapat diakses tanpa login
 * - Waktu ditampilkan dalam timezone Asia/Jakarta
 * - Session timeout: 24 jam dari aktivitas terakhir
 * - Error messages memberikan panduan yang jelas
 *
 * ============================================================================
 */

const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const moment = require('moment-timezone');

/**
 * Handler untuk perintah /cek-session
 * 
 * Menampilkan informasi lengkap tentang status sesi login user
 * termasuk waktu login, aktivitas terakhir, dan waktu tersisa.
 * 
 * SESSION INFORMATION DISPLAY:
 * 1. User Information
 *    - Username dan nama lengkap
 *    - Level akses
 *    - Chat ID untuk debugging
 * 
 * 2. Session Details
 *    - Waktu login (formatted dengan timezone)
 *    - Aktivitas terakhir
 *    - Waktu berakhir sesi
 *    - Durasi tersisa
 * 
 * 3. Technical Information
 *    - Chat ID untuk support
 *    - Session status
 *    - Next steps guidance
 * 
 * @async
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {number} msg.chat.id - Chat ID (user identifier)
 * 
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // User mengetik /cek-session
 * // Bot akan menampilkan informasi sesi lengkap
 */
const cekSessionCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/cek-session command from chat ${chatId}`);

  try {
    // ========================================================================
    // SESSION VALIDATION
    // ========================================================================
    
    /**
     * Cek status login user
     * Return early jika user belum login
     */
    const isLoggedIn = AuthService.isLoggedIn(chatId);

    if (!isLoggedIn) {
      /**
       * User belum login
       * Tampilkan instruksi login
       */
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

    // ========================================================================
    // USER INFO RETRIEVAL
    // ========================================================================
    
    /**
     * Ambil informasi user dari session
     * Handle error jika data tidak valid
     */
    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      /**
       * User info tidak ditemukan
       * Kemungkinan session expired atau corrupt
       */
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

    // ========================================================================
    // SESSION TIME CALCULATIONS
    // ========================================================================
    
    /**
     * Hitung waktu sesi dengan timezone Asia/Jakarta
     * Format waktu yang user-friendly
     */
    const loginAt = moment(userInfo.loginAt).tz('Asia/Jakarta');
    const lastActivity = moment(userInfo.lastActivity).tz('Asia/Jakarta');
    const now = moment().tz('Asia/Jakarta');
    
    /**
     * Hitung waktu berakhir sesi (24 jam dari aktivitas terakhir)
     * Hitung durasi tersisa
     */
    const expiresAt = moment(userInfo.lastActivity).add(24, 'hours').tz('Asia/Jakarta');
    const timeLeft = moment.duration(expiresAt.diff(now));

    const hours = Math.floor(timeLeft.asHours());
    const minutes = Math.floor(timeLeft.asMinutes() % 60);

    // ========================================================================
    // SESSION INFORMATION MESSAGE
    // ========================================================================
    
    /**
     * Build comprehensive session information message
     * Include user info, session details, dan technical info
     */
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

/**
 * Handler untuk perintah /help
 * 
 * Menampilkan panduan lengkap penggunaan sistem bot termasuk
 * daftar perintah, workflow OCR, tips foto, dan informasi teknis.
 * 
 * HELP CONTENT STRUCTURE:
 * 1. System Introduction
 *    - Purpose dan target users
 *    - Technology overview
 * 
 * 2. Command Reference
 *    - Authentication commands
 *    - Utility commands
 *    - Usage examples
 * 
 * 3. OCR Workflow Guide
 *    - Step-by-step process
 *    - Prerequisites
 *    - Expected results
 * 
 * 4. Photo Guidelines
 *    - Quality requirements
 *    - Best practices
 *    - Supported formats
 * 
 * 5. Technical Information
 *    - System specifications
 *    - Performance metrics
 *    - Database information
 * 
 * @async
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {number} msg.chat.id - Chat ID (user identifier)
 * 
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // User mengetik /help
 * // Bot akan menampilkan panduan lengkap
 */
const helpCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/help command from chat ${chatId}`);

  // ========================================================================
  // HELP MESSAGE CONSTRUCTION
  // ========================================================================
  
  /**
   * Build comprehensive help message
   * Include all system information dan usage guidelines
   */
  let message = `Panduan Lengkap Penggunaan Sistem Bot SmartGov Gemini\n\n`;

  /**
   * System introduction dan purpose
   */
  message += `Sistem ini dirancang khusus untuk membantu aparatur desa dalam memproses data Kartu Keluarga (KK) secara otomatis menggunakan teknologi kecerdasan buatan.\n\n`;

  /**
   * Authentication commands reference
   */
  message += `Perintah Autentikasi:\n`;
  message += `/start - Menampilkan informasi sistem dan status login\n`;
  message += `/login username password - Melakukan autentikasi ke dalam sistem\n`;
  message += `/logout - Keluar dari sistem dan mengakhiri sesi\n`;
  message += `/stop - Menghentikan bot dan keluar dari sistem\n`;
  message += `/cek-session - Memeriksa status sesi login saat ini\n\n`;

  /**
   * Utility commands reference
   */
  message += `Perintah Utilitas:\n`;
  message += `/kode-wilayah kode - Mengatur atau memeriksa kode wilayah kerja\n`;
  message += `/help - Menampilkan panduan lengkap penggunaan sistem\n\n`;

  /**
   * OCR workflow step-by-step guide
   */
  message += `Langkah-langkah Menggunakan Sistem OCR:\n`;
  message += `1. Lakukan login menggunakan akun SmartGov yang valid\n`;
  message += `2. Atur kode wilayah sesuai dengan wilayah kerja Anda\n`;
  message += `   Gunakan: /kode-wilayah kode_wilayah\n`;
  message += `3. Kirim foto Kartu Keluarga (KK) dengan kualitas yang baik\n`;
  message += `4. Sistem akan mengekstrak data secara otomatis menggunakan AI\n`;
  message += `5. Data hasil ekstraksi akan disimpan ke database SmartGov\n\n`;

  /**
   * Photo quality guidelines untuk optimal results
   */
  message += `Panduan Foto untuk Hasil Terbaik:\n`;
  message += `- Pastikan foto KK jelas dan tidak blur\n`;
  message += `- Ambil foto dengan pencahayaan yang baik dan merata\n`;
  message += `- Hindari bayangan yang menutupi teks pada KK\n`;
  message += `- Pastikan seluruh bagian KK terlihat dengan jelas\n`;
  message += `- Format file yang didukung: JPG, PNG (maksimal 10MB)\n`;
  message += `- Posisikan kamera tegak lurus dengan KK untuk hasil optimal\n\n`;

  /**
   * Technical system information
   */
  message += `Informasi Teknis Sistem:\n`;
  message += `- Mesin OCR: Google Gemini 2.5 Flash\n`;
  message += `- Tingkat akurasi: 90-95%\n`;
  message += `- Waktu pemrosesan: 5-15 detik per foto\n`;
  message += `- Database: MySQL (SmartGov)\n`;
  message += `- Dukungan format: Kartu Keluarga (KK) standar Indonesia\n\n`;

  /**
   * Support contact information
   */
  message += `Jika mengalami masalah atau memerlukan bantuan teknis, silakan hubungi administrator sistem.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * SESSION MANAGEMENT:
 * ------------------
 * 1. Session Validation
 *    - Check login status sebelum display info
 *    - Validate user info availability
 *    - Handle session corruption gracefully
 *    - Provide clear error messages
 *
 * 2. Time Calculations
 *    - Use moment-timezone untuk consistent timezone
 *    - Calculate session expiry (24 hours dari last activity)
 *    - Format waktu yang user-friendly
 *    - Handle negative time values
 *
 * 3. User Experience
 *    - Clear session information display
 *    - Technical details untuk debugging
 *    - Next steps guidance
 *    - Error recovery instructions
 *
 * HELP SYSTEM:
 * ------------
 * 1. Content Organization
 *    - Logical grouping of commands
 *    - Step-by-step workflow guide
 *    - Technical specifications
 *    - Best practices untuk photo quality
 *
 * 2. User Guidance
 *    - Clear command descriptions
 *    - Usage examples
 *    - Prerequisites dan requirements
 *    - Troubleshooting information
 *
 * 3. Technical Information
 *    - System capabilities
 *    - Performance metrics
 *    - Supported formats
 *    - Database information
 *
 * ERROR HANDLING:
 * ---------------
 * 1. Session Errors
 *    - Login required errors
 *    - Session corruption errors
 *    - Database connection errors
 *    - System errors
 *
 * 2. User Communication
 *    - Clear error messages
 *    - Possible causes explanation
 *    - Recovery instructions
 *    - Support contact information
 *
 * 3. Logging
 *    - Command usage tracking
 *    - Error logging untuk debugging
 *    - Performance monitoring
 *    - User behavior analytics
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk session validation
 * [ ] Integration tests dengan AuthService
 * [ ] Error scenario testing
 * [ ] Timezone handling tests
 * [ ] Help content accuracy tests
 * [ ] User experience testing
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. Command Usage Metrics
 *    - /cek-session usage frequency
 *    - /help usage patterns
 *    - Error rates by command
 *    - User session durations
 *
 * 2. Performance Monitoring
 *    - Response times untuk session checks
 *    - Help message generation time
 *    - Timezone calculation performance
 *    - Memory usage patterns
 *
 * 3. User Experience Metrics
 *    - Help content effectiveness
 *    - Error message clarity
 *    - User satisfaction scores
 *    - Support ticket reduction
 *
 * RELATED FILES:
 * --------------
 * - src/services/AuthService.js: Session management
 * - src/utils/logger.js: Logging utilities
 * - src/bot/commands/start.js: Welcome message
 * - src/bot/commands/login.js: Authentication
 * - src/bot/commands/kode_wilayah.js: Region setup
 *
 * ============================================================================
 */

module.exports = {
  cekSessionCommand,
  helpCommand
};
