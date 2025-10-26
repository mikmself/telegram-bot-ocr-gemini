const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const GeminiOcrService = require('../../services/GeminiOcrService');
const AutoCreateService = require('../../services/AutoCreateService');
const config = require('../../config/env');

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  logger.info(`Photo received from chat ${chatId}`);

  try {
    // Check authentication
    const isLoggedIn = AuthService.isLoggedIn(chatId);

    if (!isLoggedIn) {
      await bot.sendMessage(chatId, 
        '❌ Anda harus login terlebih dahulu.\n\n' +
        'Gunakan perintah:\n/login <username> <password>'
      );
      return;
    }

    const userInfo = AuthService.getUserInfo(chatId);

    if (!userInfo) {
      await bot.sendMessage(chatId, '❌ Gagal mendapatkan informasi user. Silakan login ulang.');
      return;
    }

    // Check if user has set village code
    if (!AuthService.hasVillageCode(chatId)) {
      await bot.sendMessage(chatId, 
        '❌ Kode wilayah belum di-set.\n\n' +
        'Silakan set kode wilayah terlebih dahulu dengan /kode-wilayah\n\n' +
        'Kode wilayah diperlukan untuk menyimpan data KK ke wilayah yang benar.'
      );
      return;
    }

    // Send initial processing message
    const statusMsg = await bot.sendMessage(
      chatId,
      '📸 Foto diterima!\n\n' +
      '⏳ Memproses gambar...',
      { reply_to_message_id: messageId }
    );

    // Get photo file
    const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
    const fileId = photo.file_id;

    logger.info(`Processing photo file_id: ${fileId}`);

    // Download photo
    await bot.editMessageText(
      '📸 Foto diterima!\n\n' +
      '⬇️ Mengunduh gambar...',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

    const file = await bot.getFile(fileId);
    const filePath = file.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;

    // Download to temp directory
    const tempDir = config.upload.tempDir;
    await fs.mkdir(tempDir, { recursive: true });

    const localFileName = `kk_${Date.now()}_${chatId}.jpg`;
    const localFilePath = path.join(tempDir, localFileName);

    const fileStream = await bot.downloadFile(fileId, tempDir);
    logger.info(`Photo downloaded to: ${localFilePath}`);

    // Process with Gemini OCR
    await bot.editMessageText(
      '📸 Foto diterima!\n\n' +
      '🤖 Memproses dengan Gemini AI...\n' +
      'Ini mungkin memakan waktu 5-15 detik.',
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );

    const ocrResult = await GeminiOcrService.processImage(fileStream);

    if (!ocrResult.success) {
      logger.error(`OCR failed: ${ocrResult.error}`);

      await bot.editMessageText(
        '❌ *Gagal memproses gambar*\n\n' +
        `Error: ${ocrResult.error}\n\n` +
        'Silakan coba lagi dengan foto yang lebih jelas.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Clean up
      await fs.unlink(fileStream).catch(() => {});

      return;
    }

    logger.info('OCR processing completed successfully');

    // Validate OCR result
    const validation = GeminiOcrService.validateOcrResult(ocrResult);

    if (!validation.valid) {
      logger.warn('OCR validation failed:', validation.errors);

      await bot.editMessageText(
        '⚠️ *Data tidak lengkap*\n\n' +
        'Hasil OCR tidak memenuhi kriteria:\n' +
        validation.errors.map(e => `• ${e}`).join('\n') + '\n\n' +
        'Silakan coba lagi dengan foto yang lebih jelas.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Clean up
      await fs.unlink(fileStream).catch(() => {});

      return;
    }

    // Show extracted data
    const data = ocrResult.parsedData;

    let extractedMessage = '✅ *Data berhasil diekstrak!*\n\n';
    extractedMessage += `*Nomor KK:* \`${data.nomor_kk}\`\n`;
    extractedMessage += `*Kepala Keluarga:* ${data.nama_kepala_keluarga}\n`;
    extractedMessage += `*Alamat:* ${data.alamat}\n`;

    if (data.rt_rw) {
      extractedMessage += `*RT/RW:* ${data.rt_rw}\n`;
    }

    if (data.desa_kelurahan) {
      extractedMessage += `*Desa/Kelurahan:* ${data.desa_kelurahan}\n`;
    }

    if (data.kecamatan) {
      extractedMessage += `*Kecamatan:* ${data.kecamatan}\n`;
    }

    if (data.kabupaten_kota) {
      extractedMessage += `*Kabupaten/Kota:* ${data.kabupaten_kota}\n`;
    }

    if (data.provinsi) {
      extractedMessage += `*Provinsi:* ${data.provinsi}\n`;
    }

    extractedMessage += `\n*Jumlah Anggota Keluarga:* ${data.table.length} orang\n\n`;

    // Show first 3 members
    extractedMessage += '*Anggota Keluarga:*\n';
    data.table.slice(0, 3).forEach((member, index) => {
      extractedMessage += `${index + 1}. ${member.nama_lengkap} (${member.nik})\n`;
    });

    if (data.table.length > 3) {
      extractedMessage += `... dan ${data.table.length - 3} orang lainnya\n`;
    }

    extractedMessage += '\n⏳ Menyimpan ke database...';

    await bot.editMessageText(extractedMessage, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown'
    });

    // Auto-create family and residents
    const createResult = await AutoCreateService.autoCreate(data, userInfo.userId);

    // Clean up temp file
    await fs.unlink(fileStream).catch(() => {});

    if (createResult.success) {
      logger.info('Auto-create successful:', createResult.data);

      let successMessage = '✅ *Data berhasil disimpan!*\n\n';
      successMessage += `*Nomor KK:* \`${data.nomor_kk}\`\n`;
      successMessage += `*Kepala Keluarga:* ${data.nama_kepala_keluarga}\n`;
      successMessage += `*Jumlah Anggota:* ${createResult.data.residentCount} orang\n\n`;
      successMessage += `*Waktu Proses:* ${Math.round(ocrResult.processingTime / 1000)} detik\n`;
      successMessage += `*Akurasi:* ${ocrResult.confidence}%\n\n`;
      successMessage += `Diproses oleh: ${userInfo.nama_lengkap}\n`;
      successMessage += `Powered by Google Gemini AI 🤖`;

      await bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown'
      });

    } else if (createResult.exists) {
      logger.warn('Family already exists:', data.nomor_kk);

      await bot.editMessageText(
        '⚠️ *KK sudah terdaftar*\n\n' +
        `Nomor KK: \`${data.nomor_kk}\` sudah ada dalam database.\n\n` +
        'Jika ingin memperbarui data, hubungi administrator.',
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        }
      );

    } else {
      logger.error('Auto-create failed:', createResult.error);

      await bot.editMessageText(
        '❌ *Gagal menyimpan data*\n\n' +
        `Error: ${createResult.message}\n\n` +
        'Data berhasil diekstrak tetapi gagal disimpan ke database.\n' +
        'Silakan hubungi administrator.',
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
      '❌ Terjadi kesalahan saat memproses foto.\n\n' +
      'Silakan coba lagi atau hubungi administrator.',
      { reply_to_message_id: messageId }
    );
  }
};
