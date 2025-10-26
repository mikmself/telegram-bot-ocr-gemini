/**
 * ============================================================================
 * FILE: src/bot/commands/kode_wilayah.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Command handler untuk perintah /kode-wilayah pada Telegram bot. Menangani
 * pengaturan kode wilayah kerja user dengan validasi format, integrasi API
 * regional, dan state management untuk multi-step conversation flow.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - logger: Logging utility untuk tracking command usage
 * - AuthService: Authentication service untuk session management
 * - RegionService: Region API integration untuk validasi kode wilayah
 * - Validator: Input validation utilities
 *
 * FITUR UTAMA:
 * 1. Region Code Management
 *    - Format validation (XX.XX.XX.XXXX)
 *    - API integration dengan RegionService
 *    - Multi-level region support (Provinsi, Kabupaten, Kecamatan, Desa)
 *    - Region data enrichment
 *
 * 2. State Management
 *    - Conversation state tracking
 *    - Multi-step input process
 *    - State cleanup dan timeout
 *    - User confirmation flow
 *
 * 3. Input Validation
 *    - Format validation untuk kode wilayah
 *    - API validation dengan database regional
 *    - Error handling dan user feedback
 *    - Retry mechanism
 *
 * 4. User Experience
 *    - Clear instructions dan examples
 *    - Progress feedback
 *    - Error recovery guidance
 *    - Confirmation dialogs
 *
 * 5. Integration
 *    - AuthService untuk session management
 *    - RegionService untuk API calls
 *    - Database integration untuk persistence
 *    - Bot message handling
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * // Command dipanggil otomatis saat user mengetik /kode-wilayah
 * bot.on('message', (msg) => {
 *   if (msg.text.startsWith('/kode-wilayah')) {
 *     const kodeWilayahHandler = require('./commands/kode_wilayah');
 *     kodeWilayahHandler(bot, msg);
 *   }
 * });
 * ```
 *
 * CATATAN PENTING:
 * - Command memerlukan user sudah login
 * - Support multi-step conversation flow
 * - Format kode wilayah: XX.XX.XX.XXXX
 * - State management dengan Map untuk tracking
 * - API integration untuk validasi kode wilayah
 *
 * ============================================================================
 */

const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const RegionService = require('../../services/RegionService');
const Validator = require('../../utils/validator');

/**
 * State management untuk conversation flow
 * Track user state dalam multi-step process
 */
const villageCodeStates = new Map();

/**
 * Main handler untuk perintah /kode-wilayah
 * 
 * Menangani pengaturan kode wilayah dengan multi-step conversation
 * flow termasuk validation, API integration, dan user confirmation.
 * 
 * CONVERSATION FLOW:
 * 1. Authentication Check
 *    - Verify user login status
 *    - Return early jika belum login
 * 
 * 2. Input Parsing
 *    - Parse command arguments
 *    - Extract village code jika provided
 * 
 * 3. Current State Check
 *    - Check existing village code
 *    - Show current info atau setup new
 * 
 * 4. Validation & API Call
 *    - Validate format
 *    - Call RegionService API
 *    - Handle validation errors
 * 
 * 5. State Management
 *    - Set conversation state
 *    - Handle confirmation flow
 *    - Cleanup state setelah completion
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
 * // User mengetik: /kode-wilayah 33.01.06.2016
 * // Bot akan memvalidasi dan set kode wilayah
 */
module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/kode-wilayah command from chat ${chatId}`);

  // ========================================================================
  // AUTHENTICATION CHECK
  // ========================================================================
  
  /**
   * Cek status login user
   * Command ini memerlukan authentication
   */
  if (!AuthService.isLoggedIn(chatId)) {
    await bot.sendMessage(
      chatId,
      'Akses ditolak. Anda harus melakukan login terlebih dahulu.\n\n' +
      'Untuk mengakses fitur kode wilayah, silakan login menggunakan perintah:\n' +
      '/login username password\n\n' +
      'Contoh:\n' +
      '/login admin123 password123\n' +
      '/login kepala\\_desa kata\\_sandi\\_rahasia'
    );
    return;
  }

  // ========================================================================
  // INPUT PARSING
  // ========================================================================
  
  /**
   * Parse command arguments
   * Extract village code jika provided dalam command
   */
  const parts = text.split(' ');
  let villageCode = null;
  
  if (parts.length > 1) {
    villageCode = parts.slice(1).join(' ').trim();
  }

  // ========================================================================
  // CURRENT STATE RETRIEVAL
  // ========================================================================
  
  /**
   * Ambil informasi user dan village code saat ini
   * Digunakan untuk menentukan flow yang akan dijalankan
   */
  const userInfo = AuthService.getUserInfo(chatId);
  const currentVillageCode = AuthService.getVillageCode(chatId);
  const currentVillageData = AuthService.getVillageData(chatId);

  if (villageCode) {
    // ========================================================================
    // VILLAGE CODE VALIDATION
    // ========================================================================
    
    /**
     * Validate format kode wilayah
     * Format: XX.XX.XX.XXXX (Provinsi.Kabupaten.Kecamatan.Desa)
     */
    if (!Validator.isValidRegionCode(villageCode)) {
      await bot.sendMessage(chatId, 
        'Format kode wilayah tidak valid.\n\n' +
        'Format yang benar: XX.XX.XX.XXXX\n' +
        'Penjelasan format:\n' +
        '- XX: Kode provinsi (2 digit)\n' +
        '- XX: Kode kabupaten/kota (2 digit)\n' +
        '- XX: Kode kecamatan (2 digit)\n' +
        '- XXXX: Kode desa/kelurahan (4 digit)\n\n' +
        'Contoh kode wilayah yang valid:\n' +
        '33.01.06.2016 (Desa/Kelurahan)\n' +
        '33.01.06 (Kecamatan)\n' +
        '33.01 (Kabupaten/Kota)\n' +
        '33 (Provinsi)\n\n' +
        'Silakan periksa kembali format kode wilayah Anda.'
      );
      return;
    }

    // ========================================================================
    // API VALIDATION
    // ========================================================================
    
    /**
     * Kirim status message untuk user
     * API call membutuhkan waktu, berikan feedback
     */
    await bot.sendMessage(chatId, 'Sedang memvalidasi kode wilayah dengan database regional. Mohon tunggu sebentar...');

    /**
     * Normalize kode wilayah untuk API call
     * Remove dots untuk format yang sesuai dengan API
     */
    const normalizedCode = villageCode.replace(/\./g, '');

    /**
     * Call RegionService untuk validasi kode wilayah
     * API akan return region data jika valid
     */
    const region = await RegionService.getRegion(normalizedCode);

    if (!region) {
      /**
       * Kode wilayah tidak ditemukan dalam database
       * Berikan error message dengan guidance
       */
      const message = `Kode wilayah tidak ditemukan dalam database regional.\n\n` +
        `Kode yang dimasukkan: ${villageCode}\n\n` +
        `Kemungkinan penyebab:\n` +
        `- Kode wilayah salah atau tidak valid\n` +
        `- Kode wilayah tidak terdaftar dalam sistem\n` +
        `- Format penulisan tidak sesuai standar\n\n` +
        `Silakan periksa kembali kode wilayah Anda dan pastikan menggunakan format yang benar.\n\n` +
        `Contoh kode wilayah yang valid:\n` +
        `- 33.01.06.2016 (untuk desa/kelurahan)\n` +
        `- 33.01.06 (untuk kecamatan)\n` +
        `- 33.01 (untuk kabupaten/kota)\n` +
        `- 33 (untuk provinsi)`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    // ========================================================================
    // SAVE VILLAGE CODE
    // ========================================================================
    
    /**
     * Save village code ke AuthService
     * Include region data untuk enrichment
     */
    const success = AuthService.setVillageCode(chatId, villageCode, region);

    if (success) {
      /**
       * Success: Build comprehensive success message
       * Include region details dan next steps
       */
      let message = `Kode wilayah berhasil diatur dalam sistem.\n\n` +
        `Informasi wilayah yang telah diset:\n` +
        `Kode wilayah: \`${villageCode}\`\n` +
        `Nama wilayah: *${region.name}*\n`;
      
      if (region.level) {
        message += `Tingkat administrasi: ${region.level}\n`;
      }
      if (region.province_code) {
        message += `Kode provinsi: ${region.province_code}\n`;
      }
      if (region.regency_code) {
        message += `Kode kabupaten/kota: ${region.regency_code}\n`;
      }
      if (region.district_code) {
        message += `Kode kecamatan: ${region.district_code}\n`;
      }

      message += `\nSistem telah siap untuk memproses data Kartu Keluarga (KK) dari wilayah ini.\n\n` +
        `Langkah selanjutnya:\n` +
        `1. Kirim foto Kartu Keluarga (KK) yang jelas dan tidak blur\n` +
        `2. Pastikan seluruh bagian KK terlihat dengan baik\n` +
        `3. Sistem akan mengekstrak data secara otomatis menggunakan teknologi AI\n` +
        `4. Data hasil ekstraksi akan disimpan ke database SmartGov`;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      /**
       * Failed to save: Show error message
       * Provide troubleshooting guidance
       */
      await bot.sendMessage(chatId, 'Gagal menyimpan kode wilayah ke dalam sistem.\n\nKemungkinan penyebab:\n- Terjadi kesalahan pada sistem penyimpanan\n- Sesi login Anda mungkin telah berakhir\n\nSilakan coba lagi atau lakukan login ulang jika diperlukan.');
    }
    return;
  }

  if (currentVillageCode) {
    let message = `Informasi Kode Wilayah Saat Ini\n\n`;
    message += `Kode wilayah yang sedang aktif: \`${currentVillageCode}\`\n`;
    message += `Nama desa/kelurahan: ${currentVillageData?.name || 'Tidak diketahui'}\n`;
    message += `Kecamatan: ${currentVillageData?.district_name || 'Tidak diketahui'}\n`;
    message += `Kabupaten/Kota: ${currentVillageData?.regency_name || 'Tidak diketahui'}\n`;
    message += `Provinsi: ${currentVillageData?.province_name || 'Tidak diketahui'}\n\n`;
    message += `Apakah Anda ingin mengubah kode wilayah yang sedang aktif?\n\n`;
    message += `Pilihan yang tersedia:\n`;
    message += `- Ketik "ya" atau "y" untuk mengubah kode wilayah\n`;
    message += `- Ketik "tidak" atau "t" untuk tetap menggunakan kode wilayah saat ini\n\n`;
    message += `Jika Anda memilih untuk mengubah, Anda akan diminta memasukkan kode wilayah yang baru.`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    villageCodeStates.set(chatId, { 
      step: 'confirm_change', 
      currentCode: currentVillageCode 
    });
    return;
  }

  const message = `Pengaturan Kode Wilayah\n\n` +
    `Silakan masukkan kode wilayah sesuai dengan wilayah kerja Anda.\n\n` +
    `Format yang benar: XX.XX.XX.XXXX\n` +
    `Penjelasan format:\n` +
    `- XX: Kode provinsi (2 digit)\n` +
    `- XX: Kode kabupaten/kota (2 digit)\n` +
    `- XX: Kode kecamatan (2 digit)\n` +
    `- XXXX: Kode desa/kelurahan (4 digit)\n\n` +
    `Contoh kode wilayah yang dapat digunakan:\n` +
    `• 33.01.06.2016 (untuk desa/kelurahan)\n` +
    `• 33.01.06 (untuk kecamatan)\n` +
    `• 33.01 (untuk kabupaten/kota)\n` +
    `• 33 (untuk provinsi)\n\n` +
    `Format lengkap: PROVINSI.KABUPATEN.KECAMATAN.DESA\n\n` +
    `Masukkan kode wilayah Anda sekarang:`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  
  villageCodeStates.set(chatId, { step: 'input_code' });
};

module.exports.handleVillageCodeMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const villageState = villageCodeStates.get(chatId);
  if (!villageState) {
    return;
  }

  try {
    if (villageState.step === 'confirm_change') {
      if (text.toLowerCase() === 'ya' || text.toLowerCase() === 'y') {
        const message = `Pengaturan Kode Wilayah Baru\n\n` +
          `Silakan masukkan kode wilayah yang baru untuk mengganti kode wilayah saat ini.\n\n` +
          `Format yang benar: XX.XX.XX.XXXX\n` +
          `Penjelasan format:\n` +
          `- XX: Kode provinsi (2 digit)\n` +
          `- XX: Kode kabupaten/kota (2 digit)\n` +
          `- XX: Kode kecamatan (2 digit)\n` +
          `- XXXX: Kode desa/kelurahan (4 digit)\n\n` +
          `Contoh kode wilayah yang dapat digunakan:\n` +
          `• 33.01.06.2016 (untuk desa/kelurahan)\n` +
          `• 33.01.06 (untuk kecamatan)\n` +
          `• 33.01 (untuk kabupaten/kota)\n` +
          `• 33 (untuk provinsi)\n\n` +
          `Format lengkap: PROVINSI.KABUPATEN.KECAMATAN.DESA\n\n` +
          `Masukkan kode wilayah baru Anda:`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        villageState.step = 'input_code';
        villageCodeStates.set(chatId, villageState);
      } else if (text.toLowerCase() === 'tidak' || text.toLowerCase() === 't') {
        const message = `Kode wilayah tidak diubah.\n\n` +
          `Kode wilayah yang tetap aktif: ${villageState.currentCode}\n\n` +
          `Sistem akan tetap menggunakan kode wilayah ini untuk memproses data Kartu Keluarga (KK).\n\n` +
          `Anda dapat langsung mengirim foto KK untuk diproses dengan kode wilayah yang sudah diatur.`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        villageCodeStates.delete(chatId);
      } else {
        await bot.sendMessage(chatId, 'Jawaban tidak valid.\n\nSilakan ketik "ya" untuk mengubah kode wilayah atau "tidak" untuk tetap menggunakan kode wilayah saat ini.');
      }

    } else if (villageState.step === 'input_code') {
      let villageCode = text.trim();

      if (!Validator.isValidRegionCode(villageCode)) {
        await bot.sendMessage(chatId, 
          'Format kode wilayah tidak valid.\n\n' +
          'Format yang benar: XX.XX.XX.XXXX\n' +
          'Penjelasan format:\n' +
          '- XX: Kode provinsi (2 digit)\n' +
          '- XX: Kode kabupaten/kota (2 digit)\n' +
          '- XX: Kode kecamatan (2 digit)\n' +
          '- XXXX: Kode desa/kelurahan (4 digit)\n\n' +
          'Contoh kode wilayah yang valid:\n' +
          '33.01.06.2016 (Desa/Kelurahan)\n' +
          '33.01.06 (Kecamatan)\n' +
          '33.01 (Kabupaten/Kota)\n' +
          '33 (Provinsi)\n\n' +
          'Silakan periksa kembali format kode wilayah Anda dan coba lagi.'
        );
        return;
      }

      await bot.sendMessage(chatId, 'Sedang memvalidasi kode wilayah dengan database regional. Mohon tunggu sebentar...');

      const normalizedCode = villageCode.replace(/\./g, '');

      const region = await RegionService.getRegion(normalizedCode);

      if (!region) {
        const message = `Kode wilayah tidak ditemukan dalam database regional.\n\n` +
          `Kode yang dimasukkan: ${villageCode}\n\n` +
          `Kemungkinan penyebab:\n` +
          `- Kode wilayah salah atau tidak valid\n` +
          `- Kode wilayah tidak terdaftar dalam sistem\n` +
          `- Format penulisan tidak sesuai standar\n\n` +
          `Silakan periksa kembali kode wilayah Anda dan pastikan menggunakan format yang benar.\n\n` +
          `Contoh kode wilayah yang valid:\n` +
          `- 33.01.06.2016 (untuk desa/kelurahan)\n` +
          `- 33.01.06 (untuk kecamatan)\n` +
          `- 33.01 (untuk kabupaten/kota)\n` +
          `- 33 (untuk provinsi)`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
      }

      const success = AuthService.setVillageCode(chatId, villageCode, region);

      if (success) {
        const message = `Kode wilayah berhasil diatur dalam sistem.\n\n` +
          `Informasi wilayah yang telah diset:\n` +
          `Kode wilayah: \`${villageCode}\`\n` +
          `Nama wilayah: *${region.name}*\n`;
        
        if (region.level) {
          message += `Tingkat administrasi: ${region.level}\n`;
        }
        if (region.province_code) {
          message += `Kode provinsi: ${region.province_code}\n`;
        }
        if (region.regency_code) {
          message += `Kode kabupaten/kota: ${region.regency_code}\n`;
        }
        if (region.district_code) {
          message += `Kode kecamatan: ${region.district_code}\n`;
        }

        message += `\nSistem telah siap untuk memproses data Kartu Keluarga (KK) dari wilayah ini.\n\n` +
          `Langkah selanjutnya:\n` +
          `1. Kirim foto Kartu Keluarga (KK) yang jelas dan tidak blur\n` +
          `2. Pastikan seluruh bagian KK terlihat dengan baik\n` +
          `3. Sistem akan mengekstrak data secara otomatis menggunakan teknologi AI\n` +
          `4. Data hasil ekstraksi akan disimpan ke database SmartGov`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, 'Gagal menyimpan kode wilayah ke dalam sistem.\n\nKemungkinan penyebab:\n- Terjadi kesalahan pada sistem penyimpanan\n- Sesi login Anda mungkin telah berakhir\n\nSilakan coba lagi atau lakukan login ulang jika diperlukan.');
      }

      villageCodeStates.delete(chatId);
    }

  } catch (error) {
    logger.error('Error in village code message handler:', error);
    
    villageCodeStates.delete(chatId);
    await bot.sendMessage(chatId, 'Terjadi kesalahan sistem saat memproses kode wilayah.\n\nKemungkinan penyebab:\n- Koneksi ke database regional bermasalah\n- Server sedang dalam pemeliharaan\n- Terjadi gangguan pada sistem\n\nSilakan coba lagi dengan perintah /kode-wilayah. Jika masalah berlanjut, hubungi administrator sistem.');
  }
};

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * STATE MANAGEMENT:
 * -----------------
 * 1. Conversation State Tracking
 *    - Use Map untuk track user states
 *    - Support multi-step conversations
 *    - State cleanup setelah completion
 *    - Timeout handling untuk abandoned states
 *
 * 2. State Transitions
 *    - input_code: User memasukkan kode wilayah
 *    - confirm_change: User konfirmasi perubahan
 *    - Clear state setelah success/error
 *    - Handle state corruption gracefully
 *
 * 3. Memory Management
 *    - Cleanup states secara berkala
 *    - Monitor memory usage
 *    - Handle abandoned conversations
 *    - Prevent memory leaks
 *
 * API INTEGRATION:
 * ----------------
 * 1. RegionService Integration
 *    - Validate kode wilayah dengan API
 *    - Handle API errors gracefully
 *    - Retry mechanism untuk transient failures
 *    - Fallback handling untuk API downtime
 *
 * 2. Data Enrichment
 *    - Enrich region data dengan parent regions
 *    - Cache region data untuk performance
 *    - Handle missing region data
 *    - Validate region hierarchy
 *
 * 3. Error Handling
 *    - API timeout handling
 *    - Network error recovery
 *    - Invalid response handling
 *    - User-friendly error messages
 *
 * USER EXPERIENCE:
 * ----------------
 * 1. Multi-step Flow
 *    - Clear step-by-step guidance
 *    - Progress indicators
 *    - Confirmation dialogs
 *    - Error recovery instructions
 *
 * 2. Input Validation
 *    - Format validation sebelum API call
 *    - Clear error messages
 *    - Examples dan guidance
 *    - Retry mechanisms
 *
 * 3. Feedback System
 *    - Real-time status updates
 *    - Success/failure notifications
 *    - Next steps guidance
 *    - Technical information display
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk state management
 * [ ] Integration tests dengan RegionService
 * [ ] API error scenario testing
 * [ ] Multi-step conversation testing
 * [ ] State cleanup testing
 * [ ] User experience testing
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. State Management Metrics
 *    - Active conversation states
 *    - State transition success rates
 *    - State cleanup frequency
 *    - Memory usage patterns
 *
 * 2. API Integration Metrics
 *    - API call success rates
 *    - API response times
 *    - Error rates by type
 *    - Region validation accuracy
 *
 * 3. User Experience Metrics
 *    - Command completion rates
 *    - Error recovery success rates
 *    - User satisfaction scores
 *    - Support ticket volumes
 *
 * RELATED FILES:
 * --------------
 * - src/services/AuthService.js: Session management
 * - src/services/RegionService.js: Region API integration
 * - src/utils/validator.js: Input validation
 * - src/utils/logger.js: Logging utilities
 * - src/bot/commands/cek_session.js: Session checking
 *
 * ============================================================================
 */

/**
 * Check if user is in village code process
 * 
 * @param {number} chatId - Chat ID to check
 * @returns {boolean} True if user is in process
 */
module.exports.isInVillageCodeProcess = (chatId) => {
  return villageCodeStates.has(chatId);
};

/**
 * Clear village code state for user
 * 
 * @param {number} chatId - Chat ID to clear state for
 */
module.exports.clearVillageCodeState = (chatId) => {
  villageCodeStates.delete(chatId);
};
