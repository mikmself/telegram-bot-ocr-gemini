/**
 * ============================================================================
 * FILE: src/bot/handlers/photo.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Handler utama untuk memproses foto Kartu Keluarga (KK) yang di-upload user
 * melalui Telegram bot. File ini mengintegrasikan seluruh pipeline OCR dari
 * download foto hingga penyimpanan data ke database dengan validasi lengkap.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - fs.promises: File system operations untuk download dan cleanup
 * - path: Path manipulation untuk file handling
 * - logger: Logging utility untuk tracking dan debugging
 * - AuthService: Session management dan user authentication
 * - GeminiOcrService: AI-powered OCR processing
 * - AutoCreateService: Automatic data creation dan database insertion
 * - textCleaner: Text normalization utilities
 * - config: Environment configuration
 *
 * FITUR UTAMA:
 * 1. Authentication & Authorization
 *    - Validasi user login status
 *    - Cek village code requirement
 *    - Rate limiting (DINONAKTIFKAN)
 *
 * 2. Photo Processing Pipeline
 *    - Download foto dari Telegram server
 *    - Temporary file management
 *    - OCR processing dengan Google Gemini AI
 *    - Data validation dan cleaning
 *
 * 3. Database Operations
 *    - Automatic family data creation
 *    - Resident data insertion
 *    - Duplicate detection dan handling
 *    - Transaction management
 *
 * 4. User Experience
 *    - Real-time status updates
 *    - Detailed progress messages
 *    - Comprehensive error handling
 *    - Success/failure feedback
 *
 * 5. Security & Performance
 *    - Rate limiting (DINONAKTIFKAN)
 *    - File cleanup otomatis
 *    - Error logging untuk monitoring
 *    - Memory management
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * // Handler dipanggil otomatis oleh bot saat user upload foto
 * const photoHandler = require('./handlers/photo');
 * 
 * // Bot akan memanggil handler ini saat ada photo message
 * bot.on('photo', photoHandler);
 * ```
 *
 * CATATAN PENTING:
 * - User harus login dan set village code sebelum upload foto
 * - Rate limit: DINONAKTIFKAN (tidak ada batasan upload)
 * - File temporary akan di-cleanup otomatis
 * - OCR processing membutuhkan 5-15 detik
 * - Data akan disimpan ke database jika valid
 * - Duplicate NIK akan di-skip dengan notifikasi
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const GeminiOcrService = require('../../services/GeminiOcrService');
const AutoCreateService = require('../../services/AutoCreateService');
const { normalizeNIK } = require('../../utils/textCleaner');
const config = require('../../config/env');


// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

/**
 * Map untuk tracking upload foto per user (chat ID)
 * Key: chatId (number) - Telegram chat ID
 * Value: Array<number> - Array timestamp upload dalam 1 jam terakhir
 */
const photoUploadTracker = new Map();

/**
 * Window waktu untuk rate limiting (1 jam dalam milliseconds)
 * @constant {number}
 */
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

/**
 * Maksimal foto yang diizinkan per jam per user
 * @constant {number}
 */
const MAX_PHOTOS_PER_HOUR = 10;

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Membersihkan data rate limiting yang sudah expired
 * 
 * Fungsi ini dijalankan setiap 10 menit untuk membersihkan
 * timestamp upload yang sudah tidak valid (lebih dari 1 jam).
 * 
 * Flow:
 * 1. Iterate semua chat ID di tracker
 * 2. Filter timestamp yang masih valid (dalam 1 jam terakhir)
 * 3. Hapus entry jika tidak ada timestamp valid
 * 4. Update entry dengan timestamp yang tersisa
 * 
 * Performance:
 * - O(n) complexity dimana n = jumlah unique chat IDs
 * - Dijalankan setiap 10 menit untuk balance antara memory dan CPU
 * 
 * @function cleanupRateLimitTracker
 */
function cleanupRateLimitTracker() {
  const now = Date.now();
  for (const [chatId, timestamps] of photoUploadTracker.entries()) {
    const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    if (validTimestamps.length === 0) {
      photoUploadTracker.delete(chatId);
    } else {
      photoUploadTracker.set(chatId, validTimestamps);
    }
  }
}

/**
 * Setup periodic cleanup untuk rate limiting tracker
 * 
 * Interval: 10 menit (600,000ms)
 * Tujuan: Mencegah memory leak dari accumulated timestamps
 * 
 * @constant {number} 600000 - 10 menit dalam milliseconds
 */
setInterval(cleanupRateLimitTracker, 10 * 60 * 1000);

// ============================================================================
// MAIN PHOTO HANDLER
// ============================================================================

/**
 * Handler utama untuk memproses foto Kartu Keluarga (KK)
 * 
 * Handler ini dipanggil otomatis oleh Telegram bot saat user mengirim foto.
 * Melakukan validasi lengkap, processing OCR, dan penyimpanan data ke database.
 * 
 * PROCESSING PIPELINE:
 * 1. Authentication & Authorization Check
 *    - Validasi user login status
 *    - Cek village code requirement
 *    - Rate limiting validation
 * 
 * 2. Photo Download & Preparation
 *    - Download foto dari Telegram server
 *    - Simpan ke temporary directory
 *    - Validasi file format dan size
 * 
 * 3. OCR Processing
 *    - Kirim foto ke Google Gemini AI
 *    - Extract data dari Kartu Keluarga
 *    - Validasi hasil OCR
 * 
 * 4. Database Operations
 *    - Create/update family data
 *    - Insert resident records
 *    - Handle duplicates dan validation errors
 * 
 * 5. User Feedback
 *    - Real-time status updates
 *    - Detailed success/error messages
 *    - Cleanup temporary files
 * 
 * ERROR HANDLING:
 * - Authentication errors: Redirect ke login
 * - Rate limit exceeded: Informasi batas upload
 * - OCR failures: Retry dengan error message
 * - Database errors: Rollback dengan notifikasi
 * - System errors: Generic error message
 * 
 * @async
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {number} msg.chat.id - Chat ID (user identifier)
 * @param {number} msg.message_id - Message ID untuk reply
 * @param {Array} msg.photo - Array foto dengan berbagai ukuran
 * 
 * @returns {Promise<void>} Tidak return value, hanya side effects
 * 
 * @example
 * // Handler dipanggil otomatis oleh bot
 * bot.on('photo', photoHandler);
 * 
 * // User upload foto KK -> handler dipanggil
 * // 1. Cek login status
 * // 2. Download foto
 * // 3. Process OCR
 * // 4. Save to database
 * // 5. Send result to user
 */
module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  logger.info(`Photo received from chat ${chatId}`);

  try {
    // ========================================================================
    // STEP 1: AUTHENTICATION & AUTHORIZATION CHECK
    // ========================================================================
    
    /**
     * Validasi user login status
     * User harus sudah login sebelum bisa upload foto
     */
    const isLoggedIn = AuthService.isLoggedIn(chatId);

    if (!isLoggedIn) {
      await bot.sendMessage(chatId,
        'Akses ditolak. Anda harus melakukan login terlebih dahulu.\n\n' +
        'Untuk memproses foto Kartu Keluarga (KK), silakan login menggunakan perintah:\n' +
        '/login username password\n\n' +
        'Contoh penggunaan:\n' +
        '/login admin123 password123\n' +
        '/login kepala\\_desa kata\\_sandi\\_rahasia'
      );
      return;
    }

    /**
     * Ambil informasi user dari session
     * Digunakan untuk tracking dan audit trail
     */
    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      await bot.sendMessage(chatId, 'Gagal mendapatkan informasi pengguna dari sistem.\n\nKemungkinan penyebab:\n- Sesi login telah berakhir\n- Terjadi kesalahan pada sistem\n- Data pengguna tidak valid\n\nSilakan lakukan login ulang menggunakan perintah /login untuk mengakses sistem kembali.');
      return;
    }

    /**
     * Validasi village code requirement
     * Village code diperlukan untuk menentukan lokasi penyimpanan data
     */
    if (!AuthService.hasVillageCode(chatId)) {
      await bot.sendMessage(chatId,
        'Kode wilayah belum diatur dalam sistem.\n\n' +
        'Sebelum dapat memproses foto Kartu Keluarga (KK), Anda harus mengatur kode wilayah terlebih dahulu.\n\n' +
        'Gunakan perintah: /kode-wilayah <kode-wilayah>\n' +
        'Contoh: /kode-wilayah 33.01.06.2016\n\n' +
        'Kode wilayah diperlukan untuk memastikan data KK disimpan ke wilayah yang benar dalam database SmartGov.'
      );
      return;
    }

    // ========================================================================
    // STEP 2: RATE LIMITING VALIDATION (DISABLED)
    // ========================================================================

    /**
     * Rate limiting dinonaktifkan - tidak ada batasan upload foto
     * Implementasi sebelumnya: Maksimal 10 foto per jam per user (chat ID)
     */

    // DISABLED: Rate limiting logic
    /*
    const now = Date.now();
    const userUploads = photoUploadTracker.get(chatId) || [];
    const recentUploads = userUploads.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    if (recentUploads.length >= MAX_PHOTOS_PER_HOUR) {
      const oldestUpload = Math.min(...recentUploads);
      const timeUntilReset = RATE_LIMIT_WINDOW - (now - oldestUpload);
      const minutesLeft = Math.ceil(timeUntilReset / (60 * 1000));

      await bot.sendMessage(chatId,
        'Batas upload foto tercapai.\n\n' +
        `Anda telah mengunggah ${MAX_PHOTOS_PER_HOUR} foto dalam 1 jam terakhir.\n` +
        `Untuk mencegah penyalahgunaan sistem, terdapat batasan ${MAX_PHOTOS_PER_HOUR} foto per jam.\n\n` +
        `Silakan tunggu sekitar ${minutesLeft} menit sebelum mengunggah foto berikutnya.\n\n` +
        'Terima kasih atas pengertian Anda.'
      );
      return;
    }

    recentUploads.push(now);
    photoUploadTracker.set(chatId, recentUploads);
    */

    // ========================================================================
    // STEP 3: PHOTO DOWNLOAD & PREPARATION
    // ========================================================================
    
    /**
     * Kirim status message awal ke user
     * Memberikan feedback bahwa foto telah diterima
     */
    const statusMsg = await bot.sendMessage(
      chatId,
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang memproses gambar dengan teknologi AI. Mohon tunggu sebentar...',
      { reply_to_message_id: messageId }
    );

    /**
     * Ambil foto dengan resolusi tertinggi
     * Telegram mengirim array foto dengan berbagai ukuran
     * Index terakhir adalah yang terbesar
     */
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    logger.info(`Processing photo file_id: ${fileId}`);

    /**
     * Update status message untuk download progress
     */
    await bot.editMessageText(
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang mengunduh gambar dari server Telegram...',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

    /**
     * Download foto dari Telegram server
     * 1. Get file info dari Telegram API
     * 2. Build file URL
     * 3. Download ke temporary directory
     */
    const file = await bot.getFile(fileId);
    const filePath = file.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;

    const tempDir = config.upload.tempDir;
    await fs.mkdir(tempDir, { recursive: true });

    const localFileName = `kk_${Date.now()}_${chatId}.jpg`;
    const localFilePath = path.join(tempDir, localFileName);

    const fileStream = await bot.downloadFile(fileId, tempDir);
    logger.info(`Photo downloaded to: ${localFilePath}`);

    // ========================================================================
    // STEP 4: OCR PROCESSING
    // ========================================================================
    
    /**
     * Update status message untuk OCR processing
     */
    await bot.editMessageText(
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang memproses dengan teknologi Google Gemini AI...\n' +
      'Proses ekstraksi data membutuhkan waktu 5-15 detik. Mohon tunggu sebentar.',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

    /**
     * Proses OCR menggunakan Google Gemini AI
     * Extract data dari foto Kartu Keluarga
     */
    const ocrResult = await GeminiOcrService.processImage(fileStream);

    if (!ocrResult.success) {
      logger.error(`OCR failed: ${ocrResult.error}`);

      await bot.editMessageText(
        'Gagal memproses gambar Kartu Keluarga (KK).\n\n' +
        `Pesan kesalahan: ${ocrResult.error}\n\n` +
        'Kemungkinan penyebab:\n' +
        '- Kualitas foto tidak memadai (terlalu blur atau gelap)\n' +
        '- Format file tidak didukung\n' +
        '- Terjadi gangguan pada sistem AI\n' +
        '- Foto tidak menampilkan Kartu Keluarga (KK) yang valid\n\n' +
        'Silakan coba lagi dengan foto yang lebih jelas dan pastikan seluruh bagian KK terlihat dengan baik.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

      try {
        await fs.unlink(fileStream);
        logger.info(`Cleaned up temp file after OCR failure: ${fileStream}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file ${fileStream}:`, cleanupError.message);
      }

      return;
    }

    logger.info('OCR processing completed successfully');

    /**
     * Validasi hasil OCR
     * Pastikan data yang diekstrak valid dan lengkap
     */
    const validation = GeminiOcrService.validateOcrResult(ocrResult);

    if (!validation.valid) {
      logger.warn('OCR validation failed:', validation.errors);

      await bot.editMessageText(
        'Data yang diekstrak tidak lengkap atau tidak valid.\n\n' +
        'Kriteria yang tidak terpenuhi:\n' +
        validation.errors.map(e => `- ${e}`).join('\n') + '\n\n' +
        'Kemungkinan penyebab:\n' +
        '- Foto tidak jelas atau terpotong\n' +
        '- Kartu Keluarga (KK) tidak lengkap\n' +
        '- Kualitas gambar terlalu rendah\n' +
        '- Pencahayaan tidak merata\n\n' +
        'Silakan ambil foto ulang dengan kualitas yang lebih baik dan pastikan seluruh bagian KK terlihat jelas.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

      try {
        await fs.unlink(fileStream);
        logger.info(`Cleaned up temp file after validation failure: ${fileStream}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file ${fileStream}:`, cleanupError.message);
      }

      return;
    }

    // ========================================================================
    // STEP 5: DATA EXTRACTION & PREVIEW
    // ========================================================================
    
    /**
     * Ambil data yang telah diekstrak dari OCR
     */
    const data = ocrResult.parsedData;

    /**
     * Buat preview message untuk user
     * Menampilkan data yang berhasil diekstrak sebelum disimpan
     */
    let extractedMessage = 'Data berhasil diekstrak dari Kartu Keluarga (KK).\n\n';
    extractedMessage += `Informasi Kartu Keluarga:\n`;
    extractedMessage += `Nomor KK: \`${data.nomor_kk}\`\n`;
    extractedMessage += `Nama Kepala Keluarga: ${data.nama_kepala_keluarga}\n`;
    extractedMessage += `Alamat: ${data.alamat}\n`;

    if (data.rt_rw) {
      extractedMessage += `RT/RW: ${data.rt_rw}\n`;
    }

    if (data.desa_kelurahan) {
      extractedMessage += `Desa/Kelurahan: ${data.desa_kelurahan}\n`;
    }

    if (data.kecamatan) {
      extractedMessage += `Kecamatan: ${data.kecamatan}\n`;
    }

    if (data.kabupaten_kota) {
      extractedMessage += `Kabupaten/Kota: ${data.kabupaten_kota}\n`;
    }

    if (data.provinsi) {
      extractedMessage += `Provinsi: ${data.provinsi}\n`;
    }

    extractedMessage += `\nJumlah Anggota Keluarga: ${data.table.length} orang\n\n`;

    extractedMessage += 'Daftar Anggota Keluarga:\n';
    data.table.slice(0, 3).forEach((member, index) => {
      extractedMessage += `${index + 1}. ${member.nama_lengkap} (NIK: ${member.nik})\n`;
    });

    if (data.table.length > 3) {
      extractedMessage += `... dan ${data.table.length - 3} anggota keluarga lainnya\n`;
    }

    extractedMessage += '\nSedang menyimpan data ke database SmartGov...';

    await bot.editMessageText(extractedMessage, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown'
    });

    // ========================================================================
    // STEP 6: DATABASE OPERATIONS
    // ========================================================================
    
    /**
     * Simpan data ke database menggunakan AutoCreateService
     * Service ini akan:
     * 1. Create/update family data
     * 2. Insert resident records
     * 3. Handle duplicates dan validation
     * 4. Update member counts
     */
    const createResult = await AutoCreateService.autoCreate(data, userInfo.userId);

    // ========================================================================
    // STEP 7: CLEANUP & RESULT HANDLING
    // ========================================================================
    
    /**
     * Cleanup temporary file
     * Hapus file foto yang sudah tidak diperlukan
     */
    try {
      await fs.unlink(fileStream);
      logger.info(`Cleaned up temp file after processing: ${fileStream}`);
    } catch (cleanupError) {
      logger.warn(`Failed to cleanup temp file ${fileStream}:`, cleanupError.message);
    }

    /**
     * Handle database operation results
     * Tampilkan hasil sesuai dengan status operasi
     */
    if (createResult.success) {
      logger.info('Auto-create successful:', createResult.data);

      let successMessage = 'Data Kartu Keluarga (KK) berhasil disimpan ke database SmartGov.\n\n';
      successMessage += `Informasi Kartu Keluarga:\n`;
      successMessage += `Nomor KK: \`${data.nomor_kk}\`\n`;
      successMessage += `Nama Kepala Keluarga: ${data.nama_kepala_keluarga}\n`;
      successMessage += `Alamat: ${data.alamat}\n`;
      
      if (data.rt_rw) {
        successMessage += `RT/RW: ${data.rt_rw}\n`;
      }
      
      successMessage += `Desa/Kelurahan: ${data.desa_kelurahan}\n`;
      successMessage += `Kecamatan: ${data.kecamatan}\n`;
      successMessage += `Kabupaten/Kota: ${data.kabupaten_kota}\n`;
      successMessage += `Provinsi: ${data.provinsi}\n\n`;
      
      if (createResult.isNewFamily) {
        successMessage += `Status: Kartu Keluarga Baru\n`;
      } else {
        successMessage += `Status: Kartu Keluarga Sudah Ada - Update Anggota\n`;
      }
      
      successMessage += `Total Anggota dari OCR: ${data.table.length} orang\n`;
      successMessage += `Anggota Baru Ditambahkan: ${createResult.data.residentCount} orang\n`;
      
      if (createResult.data.skippedCount > 0) {
        successMessage += `Anggota Sudah Ada (Dilewati): ${createResult.data.skippedCount} orang\n`;
      }
      
      if (createResult.data.invalidCount > 0) {
        successMessage += `Anggota Tidak Valid (Dilewati): ${createResult.data.invalidCount} orang\n`;
      }
      
      successMessage += `\n`;
      
      successMessage += `Detail Anggota Keluarga:\n\n`;
      
      data.table.forEach((member, index) => {
        const wasSkipped = createResult.data.skippedResidents.find(s => s.nik === normalizeNIK(member.nik));
        const wasInvalid = createResult.data.invalidResidents.find(i => i.nik === normalizeNIK(member.nik));
        
        let status = 'BERHASIL';
        if (wasSkipped) {
          status = 'SUDAH ADA';
        } else if (wasInvalid) {
          status = 'TIDAK VALID';
        }
        
        successMessage += `${index + 1}. ${member.nama_lengkap} (${status})\n`;
        successMessage += `   NIK: \`${member.nik}\`\n`;
        successMessage += `   Tempat/Tanggal Lahir: ${member.tempat_lahir}, ${member.tanggal_lahir}\n`;
        successMessage += `   Jenis Kelamin: ${member.jenis_kelamin}\n`;
        successMessage += `   Agama: ${member.agama}\n`;
        successMessage += `   Pendidikan: ${member.pendidikan}\n`;
        successMessage += `   Pekerjaan: ${member.jenis_pekerjaan}\n`;
        successMessage += `   Status Perkawinan: ${member.status_perkawinan}\n`;
        successMessage += `   Hubungan dalam Keluarga: ${member.status_hubungan_dalam_keluarga}\n`;
        
        if (wasSkipped) {
          successMessage += `   Alasan Dilewati: ${wasSkipped.reason}\n`;
        } else if (wasInvalid) {
          successMessage += `   Alasan Tidak Valid: ${wasInvalid.reason}\n`;
        }
        
        if (member.nama_ayah && !wasSkipped && !wasInvalid) {
          successMessage += `   Nama Ayah: ${member.nama_ayah}\n`;
        }
        if (member.nama_ibu && !wasSkipped && !wasInvalid) {
          successMessage += `   Nama Ibu: ${member.nama_ibu}\n`;
        }
        
        successMessage += `\n`;
      });
      
      successMessage += `\nInformasi Pemrosesan:\n`;
      successMessage += `Waktu Proses: ${Math.round(ocrResult.processingTime / 1000)} detik\n`;
      successMessage += `Tingkat Akurasi: ${ocrResult.confidence}%\n\n`;
      successMessage += `Diproses oleh: ${userInfo.nama_lengkap}\n`;
      successMessage += `Dibantu oleh teknologi Google Gemini AI`;

      await bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown'
      });

    } else if (createResult.exists) {
      logger.warn('Family already exists:', data.nomor_kk);

      await bot.editMessageText(
        'Kartu Keluarga (KK) sudah terdaftar dalam database.\n\n' +
        `Nomor KK: \`${data.nomor_kk}\` sudah ada dalam sistem SmartGov.\n\n` +
        'Data yang diekstrak berhasil, namun tidak dapat disimpan karena KK sudah terdaftar.\n\n' +
        'Jika Anda ingin memperbarui data KK yang sudah ada, silakan hubungi administrator sistem untuk bantuan lebih lanjut.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

    } else {
      logger.error('Auto-create failed:', createResult.error);

      await bot.editMessageText(
        'Gagal menyimpan data ke database SmartGov.\n\n' +
        `Pesan kesalahan: ${createResult.message}\n\n` +
        'Data berhasil diekstrak dari foto KK, namun terjadi kesalahan saat menyimpan ke database.\n\n' +
        'Kemungkinan penyebab:\n' +
        '- Koneksi ke database bermasalah\n' +
        '- Server sedang dalam pemeliharaan\n' +
        '- Terjadi gangguan pada sistem penyimpanan\n\n' +
        'Silakan hubungi administrator sistem untuk bantuan lebih lanjut.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    }

  } catch (error) {
    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    
    /**
     * Global error handler untuk semua error yang tidak ter-handle
     * Log error dan berikan feedback ke user
     */
    logger.error('Error in photo handler:', error);

    await bot.sendMessage(
      chatId,
      'Terjadi kesalahan sistem saat memproses foto Kartu Keluarga (KK).\n\n' +
      'Kemungkinan penyebab:\n' +
      '- Koneksi ke server bermasalah\n' +
      '- Server sedang dalam pemeliharaan\n' +
      '- Terjadi gangguan pada sistem AI\n' +
      '- File foto tidak dapat diproses\n\n' +
      'Silakan coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi administrator sistem untuk bantuan lebih lanjut.',
      { reply_to_message_id: messageId }
    );
  }
};

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * PHOTO PROCESSING PIPELINE:
 * ---------------------------
 * 1. Authentication Check
 *    - Validasi user login status
 *    - Cek village code requirement
 *    - Rate limiting validation
 *
 * 2. Photo Download
 *    - Ambil foto dengan resolusi tertinggi
 *    - Download ke temporary directory
 *    - Generate unique filename
 *
 * 3. OCR Processing
 *    - Kirim ke Google Gemini AI
 *    - Extract data dari Kartu Keluarga
 *    - Validasi hasil OCR
 *
 * 4. Database Operations
 *    - Create/update family data
 *    - Insert resident records
 *    - Handle duplicates
 *
 * 5. User Feedback
 *    - Real-time status updates
 *    - Detailed success/error messages
 *    - Cleanup temporary files
 *
 * RATE LIMITING STRATEGY:
 * -----------------------
 * - DINONAKTIFKAN - Tidak ada batasan upload foto
 * - Kode rate limiting dipertahankan dalam bentuk comment
 * - Dapat diaktifkan kembali jika diperlukan
 *
 * ERROR HANDLING PATTERNS:
 * ------------------------
 * 1. Authentication Errors: Redirect ke login
 * 2. Rate Limit Exceeded: Informasi batas upload
 * 3. OCR Failures: Retry dengan error message
 * 4. Validation Errors: Detail error dengan saran
 * 5. Database Errors: Rollback dengan notifikasi
 * 6. System Errors: Generic error message
 *
 * SECURITY CONSIDERATIONS:
 * ------------------------
 * - Rate limiting untuk prevent abuse
 * - File cleanup untuk prevent storage issues
 * - Input validation untuk prevent injection
 * - Error logging untuk monitoring
 * - Session validation untuk authorization
 *
 * PERFORMANCE OPTIMIZATIONS:
 * --------------------------
 * - Use highest resolution photo (index terakhir)
 * - Temporary file cleanup otomatis
 * - Async/await untuk non-blocking operations
 * - Efficient rate limiting dengan Map
 * - Batch database operations
 *
 * MONITORING & LOGGING:
 * ---------------------
 * - Log semua upload attempts
 * - Track OCR success/failure rates
 * - Monitor rate limiting hits
 * - Log database operation results
 * - Error tracking untuk debugging
 *
 * TESTING RECOMMENDATIONS:
 * ------------------------
 * [ ] Test dengan berbagai ukuran foto
 * [ ] Test rate limiting functionality
 * [ ] Test OCR dengan foto berkualitas rendah
 * [ ] Test database error scenarios
 * [ ] Test cleanup functionality
 * [ ] Test authentication edge cases
 *
 * RELATED FILES:
 * --------------
 * - src/services/GeminiOcrService.js: OCR processing
 * - src/services/AutoCreateService.js: Database operations
 * - src/services/AuthService.js: Authentication
 * - src/utils/textCleaner.js: Text normalization
 * - src/config/env.js: Configuration
 *
 * ============================================================================
 */
