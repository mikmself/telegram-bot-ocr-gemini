const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const GeminiOcrService = require('../../services/GeminiOcrService');
const AutoCreateService = require('../../services/AutoCreateService');
const { normalizeNIK } = require('../../utils/textCleaner');
const config = require('../../config/env');


const photoUploadTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const MAX_PHOTOS_PER_HOUR = 10;


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


setInterval(cleanupRateLimitTracker, 10 * 60 * 1000);

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  logger.info(`Photo received from chat ${chatId}`);

  try {
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

    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      await bot.sendMessage(chatId, 'Gagal mendapatkan informasi pengguna dari sistem.\n\nKemungkinan penyebab:\n- Sesi login telah berakhir\n- Terjadi kesalahan pada sistem\n- Data pengguna tidak valid\n\nSilakan lakukan login ulang menggunakan perintah /login untuk mengakses sistem kembali.');
      return;
    }

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

    const statusMsg = await bot.sendMessage(
      chatId,
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang memproses gambar dengan teknologi AI. Mohon tunggu sebentar...',
      { reply_to_message_id: messageId }
    );

    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    logger.info(`Processing photo file_id: ${fileId}`);

    await bot.editMessageText(
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang mengunduh gambar dari server Telegram...',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

    const file = await bot.getFile(fileId);
    const filePath = file.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;

    const tempDir = config.upload.tempDir;
    await fs.mkdir(tempDir, { recursive: true });

    const localFileName = `kk_${Date.now()}_${chatId}.jpg`;
    const localFilePath = path.join(tempDir, localFileName);

    const fileStream = await bot.downloadFile(fileId, tempDir);
    logger.info(`Photo downloaded to: ${localFilePath}`);

    await bot.editMessageText(
      'Foto Kartu Keluarga (KK) telah diterima oleh sistem.\n\n' +
      'Sedang memproses dengan teknologi Google Gemini AI...\n' +
      'Proses ekstraksi data membutuhkan waktu 5-15 detik. Mohon tunggu sebentar.',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

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

    const data = ocrResult.parsedData;

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

    const createResult = await AutoCreateService.autoCreate(data, userInfo.userId);

    try {
      await fs.unlink(fileStream);
      logger.info(`Cleaned up temp file after processing: ${fileStream}`);
    } catch (cleanupError) {
      logger.warn(`Failed to cleanup temp file ${fileStream}:`, cleanupError.message);
    }

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
