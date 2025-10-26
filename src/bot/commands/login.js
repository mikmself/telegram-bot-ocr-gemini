/**
 * ============================================================================
 * FILE: src/bot/commands/login.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Command handler untuk perintah /login pada Telegram bot. Menangani
 * proses autentikasi user ke sistem SmartGov dengan validasi input,
 * error handling, dan session management yang komprehensif.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - logger: Logging utility untuk tracking authentication attempts
 * - AuthService: Authentication service untuk login processing
 * - Validator: Input validation utilities
 *
 * FITUR UTAMA:
 * 1. Input Validation
 *    - Format command validation
 *    - Username dan password validation
 *    - Input sanitization dan security
 *
 * 2. Authentication Processing
 *    - SmartGov API integration
 *    - Credential verification
 *    - Session creation dan management
 *
 * 3. User Feedback
 *    - Real-time processing status
 *    - Success/failure notifications
 *    - Detailed error messages
 *    - Usage instructions
 *
 * 4. Error Handling
 *    - Input validation errors
 *    - Authentication failures
 *    - Network errors
 *    - System errors
 *
 * 5. Security Features
 *    - Input sanitization
 *    - Credential protection
 *    - Session management
 *    - Error logging
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * // Command dipanggil otomatis saat user mengetik /login
 * bot.on('message', (msg) => {
 *   if (msg.text.startsWith('/login')) {
 *     const loginHandler = require('./commands/login');
 *     loginHandler(bot, msg);
 *   }
 * });
 * ```
 *
 * CATATAN PENTING:
 * - Command memerlukan username dan password sebagai parameter
 * - Password dapat mengandung spasi (gunakan quotes jika perlu)
 * - Authentication dilakukan melalui SmartGov API
 * - Session akan dibuat jika login berhasil
 * - Error messages memberikan panduan yang jelas
 *
 * ============================================================================
 */

const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const Validator = require('../../utils/validator');

/**
 * Handler untuk perintah /login
 * 
 * Menangani proses autentikasi user ke sistem SmartGov dengan
 * validasi input, error handling, dan session management.
 * 
 * AUTHENTICATION FLOW:
 * 1. Input Validation
 *    - Parse command arguments
 *    - Validate format dan structure
 *    - Sanitize input data
 * 
 * 2. Credential Validation
 *    - Validate username format
 *    - Validate password requirements
 *    - Check input security
 * 
 * 3. Authentication Processing
 *    - Call SmartGov API
 *    - Verify credentials
 *    - Create user session
 * 
 * 4. Result Handling
 *    - Success: Create session, show user info
 *    - Failure: Show error message, retry instructions
 * 
 * @async
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {number} msg.chat.id - Chat ID (user identifier)
 * @param {string} msg.text - Message text dengan command
 * 
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // User mengetik: /login admin123 password123
 * // Bot akan memproses authentication dan memberikan feedback
 */
const loginCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/login command from chat ${chatId}`);

  // ========================================================================
  // INPUT PARSING & VALIDATION
  // ========================================================================
  
  /**
   * Parse command arguments
   * Split text berdasarkan spasi untuk mendapatkan username dan password
   */
  const parts = text.split(' ');

  if (parts.length < 3) {
    /**
     * Format command tidak valid
     * Berikan instruksi yang jelas untuk user
     */
    await bot.sendMessage(
      chatId,
      'Format perintah tidak valid.\n\n' +
      'Format yang benar: /login username password\n\n' +
      'Penjelasan:\n' +
      '- username: Nama pengguna akun SmartGov Anda\n' +
      '- password: Kata sandi akun SmartGov Anda\n\n' +
      'Contoh penggunaan:\n' +
      '/login admin123 password123\n' +
      '/login kepala\\_desa kata\\_sandi\\_rahasia\n' +
      '/login sekretaris\\_desa sandi123456'
    );
    return;
  }

  /**
   * Extract username dan password dari command
   * Username: argumen kedua
   * Password: semua argumen setelah username (support spasi)
   */
  const username = parts[1];
  const password = parts.slice(2).join(' ');

  // ========================================================================
  // CREDENTIAL VALIDATION
  // ========================================================================
  
  /**
   * Validate username dan password format
   * Pastikan input memenuhi requirements keamanan
   */
  const validation = Validator.validateLogin(username, password);

  if (!validation.isValid) {
    /**
     * Validation gagal
     * Tampilkan error details dan instruksi perbaikan
     */
    await bot.sendMessage(
      chatId,
      `Validasi gagal. Kesalahan yang ditemukan:\n\n${validation.errors.join('\n')}\n\n` +
      'Silakan periksa kembali format input Anda dan coba lagi.'
    );
    return;
  }

  // ========================================================================
  // AUTHENTICATION PROCESSING
  // ========================================================================
  
  /**
   * Kirim status message untuk user
   * Memberikan feedback bahwa proses sedang berjalan
   */
  const processingMsg = await bot.sendMessage(chatId, 'Sedang memproses autentikasi pengguna. Mohon tunggu sebentar...');

  try {
    /**
     * Call AuthService untuk proses login
     * Integrate dengan SmartGov API untuk verifikasi credentials
     */
    const result = await AuthService.login(chatId, username, password);

    if (result.success) {
      await bot.editMessageText(
        `Autentikasi berhasil! Selamat datang di sistem SmartGov Gemini Bot.\n\n` +
        `Status login: BERHASIL\n` +
        `Nama pengguna: ${result.user.nama_lengkap}\n` +
        `Username: ${result.user.username}\n` +
        `Level akses: ${result.user.level}\n\n` +
        `Langkah selanjutnya:\n` +
        `1. Login menggunakan akun SmartGov (Selesai)\n` +
        `2. Atur kode wilayah menggunakan perintah: /kode-wilayah <kode-wilayah>\n` +
        `   Contoh: /kode-wilayah 33.01.06.2016\n` +
        `3. Kirim foto Kartu Keluarga (KK) untuk diproses\n` +
        `4. Bot akan otomatis extract data menggunakan AI\n` +
        `5. Data akan disimpan ke database SmartGov\n\n` +
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

const stopCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  logger.info(`/stop command from chat ${chatId}`);

  try {
    const result = await AuthService.logout(chatId);

    if (result.success) {
      await bot.sendMessage(chatId, 
        'Bot telah dihentikan.\n\n' +
        'Sesi Anda telah berakhir dan semua data sementara telah dihapus.\n\n' +
        'Untuk menggunakan bot kembali, gunakan perintah /start atau /login.'
      );
    } else {
      await bot.sendMessage(chatId, 
        'Anda belum login.\n\n' +
        'Gunakan perintah /start untuk memulai.'
      );
    }

  } catch (error) {
    logger.error('Error in stop command:', error);
    await bot.sendMessage(chatId, 'Terjadi kesalahan sistem saat menghentikan bot.\n\nSilakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator sistem.');
  }
};

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * AUTHENTICATION FLOW:
 * --------------------
 * 1. Input Parsing
 *    - Split command text berdasarkan spasi
 *    - Extract username (argumen kedua)
 *    - Extract password (argumen sisanya)
 *    - Support password dengan spasi
 *
 * 2. Input Validation
 *    - Format validation (minimal 3 argumen)
 *    - Username format validation
 *    - Password requirements validation
 *    - Security input sanitization
 *
 * 3. Authentication Processing
 *    - Call SmartGov API melalui AuthService
 *    - Verify credentials dengan server
 *    - Create user session jika berhasil
 *    - Handle authentication errors
 *
 * 4. Result Handling
 *    - Success: Show user info dan next steps
 *    - Failure: Show error message dan retry instructions
 *    - Network errors: Show connection issues
 *    - System errors: Show generic error
 *
 * SECURITY CONSIDERATIONS:
 * ------------------------
 * 1. Input Sanitization
 *    - Validate input format sebelum processing
 *    - Prevent injection attacks
 *    - Sanitize special characters
 *    - Length validation
 *
 * 2. Credential Protection
 *    - Tidak log password dalam plain text
 *    - Secure transmission ke API
 *    - Session management yang aman
 *    - Error messages tidak expose sensitive info
 *
 * 3. Error Handling
 *    - Generic error messages untuk security
 *    - Detailed logging untuk debugging
 *    - Rate limiting untuk prevent brute force
 *    - Input validation untuk prevent attacks
 *
 * USER EXPERIENCE:
 * -----------------
 * 1. Clear Instructions
 *    - Format command yang jelas
 *    - Contoh penggunaan yang lengkap
 *    - Error messages yang informatif
 *    - Step-by-step guidance
 *
 * 2. Real-time Feedback
 *    - Processing status messages
 *    - Success/failure notifications
 *    - Progress indicators
 *    - Clear next steps
 *
 * 3. Error Recovery
 *    - Retry instructions yang jelas
 *    - Common error solutions
 *    - Support contact information
 *    - Troubleshooting guide
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk input validation
 * [ ] Integration tests dengan AuthService
 * [ ] Error scenario testing
 * [ ] Security testing untuk input validation
 * [ ] User experience testing
 * [ ] Performance testing dengan concurrent logins
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. Authentication Metrics
 *    - Login success/failure rates
 *    - Authentication response times
 *    - Error rates by type
 *    - User session durations
 *
 * 2. Security Monitoring
 *    - Failed login attempts
 *    - Suspicious activity patterns
 *    - Input validation failures
 *    - API error rates
 *
 * 3. User Experience Metrics
 *    - Command usage patterns
 *    - Error message effectiveness
 *    - User satisfaction scores
 *    - Support ticket volumes
 *
 * RELATED FILES:
 * --------------
 * - src/services/AuthService.js: Authentication logic
 * - src/utils/validator.js: Input validation utilities
 * - src/utils/logger.js: Logging utilities
 * - src/bot/commands/start.js: Welcome message
 * - src/bot/commands/cek_session.js: Session checking
 *
 * ============================================================================
 */

module.exports = {
  loginCommand,
  logoutCommand,
  stopCommand
};
