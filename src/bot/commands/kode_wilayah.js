const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const RegionService = require('../../services/RegionService');
const Validator = require('../../utils/validator');

// State management for village code setting
const villageCodeStates = new Map();

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/kode-wilayah command from chat ${chatId}`);

  // Check if user is logged in
  if (!AuthService.isLoggedIn(chatId)) {
    await bot.sendMessage(
      chatId,
      '❌ Anda harus login terlebih dahulu.\n\n' +
      'Gunakan perintah:\n/login <username> <password>'
    );
    return;
  }

  // Parse kode wilayah from command if provided
  const parts = text.split(' ');
  let villageCode = null;
  
  if (parts.length > 1) {
    villageCode = parts.slice(1).join(' ').trim();
  }

  const userInfo = AuthService.getUserInfo(chatId);
  const currentVillageCode = AuthService.getVillageCode(chatId);
  const currentVillageData = AuthService.getVillageData(chatId);

  // If kode wilayah provided directly in command, process it
  if (villageCode) {
    // Validate kode
    if (!Validator.isValidRegionCode(villageCode)) {
      await bot.sendMessage(chatId, 
        '❌ Format kode wilayah tidak valid.\n\n' +
        'Gunakan format: XX.XX.XX.XXXX\n' +
        'Contoh: 33.01.06.2016\n\n' +
        'Silakan coba lagi:'
      );
      return;
    }

    await bot.sendMessage(chatId, '🔍 Memvalidasi kode wilayah...');

    // Normalize kode (remove dots)
    const normalizedCode = villageCode.replace(/\./g, '');

    // Validate with Region API
    const region = await RegionService.getRegion(normalizedCode);

    if (!region) {
      const message = `❌ Kode wilayah tidak valid\n\n` +
        `Kode ${villageCode} tidak ditemukan dalam database.\n\n` +
        `Silakan coba lagi dengan kode yang benar.`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    // Set village code in session
    const success = AuthService.setVillageCode(chatId, villageCode, region);

    if (success) {
      let message = `✅ *Kode wilayah berhasil diset!*\n\n` +
        `Kode: \`${villageCode}\`\n` +
        `Nama: *${region.name}*\n`;
      
      if (region.level) {
        message += `Level: ${region.level}\n`;
      }
      if (region.province_code) {
        message += `Kode Provinsi: ${region.province_code}\n`;
      }
      if (region.regency_code) {
        message += `Kode Kabupaten/Kota: ${region.regency_code}\n`;
      }
      if (region.district_code) {
        message += `Kode Kecamatan: ${region.district_code}\n`;
      }

      message += `\n🎉 Anda sekarang bisa mengirim foto KK untuk diproses!`;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '❌ Gagal menyimpan kode wilayah. Silakan coba lagi.');
    }
    return;
  }

  // If user already has village code, ask if they want to change it
  if (currentVillageCode) {
    let message = `🏘️ *Kode Wilayah Saat Ini*\n\n`;
    message += `Kode: \`${currentVillageCode}\`\n`;
    message += `Desa/Kelurahan: ${currentVillageData?.name || 'Tidak diketahui'}\n`;
    message += `Kecamatan: ${currentVillageData?.district_name || 'Tidak diketahui'}\n`;
    message += `Kabupaten/Kota: ${currentVillageData?.regency_name || 'Tidak diketahui'}\n`;
    message += `Provinsi: ${currentVillageData?.province_name || 'Tidak diketahui'}\n\n`;
    message += `Apakah Anda ingin mengubah kode wilayah?\n`;
    message += `Ketik "ya" untuk mengubah, atau "tidak" untuk membatalkan.`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    villageCodeStates.set(chatId, { 
      step: 'confirm_change', 
      currentCode: currentVillageCode 
    });
    return;
  }

  // If no village code, ask for input
  const message = `🏘️ *Set Kode Wilayah*\n\n` +
    `Masukkan kode wilayah Anda (format: 33.01.06.2016):\n\n` +
    `Contoh:\n` +
    `• 33.01.06.2016 (Desa/Kelurahan)\n` +
    `• 33.01.06 (Kecamatan)\n` +
    `• 33.01 (Kabupaten/Kota)\n` +
    `• 33 (Provinsi)\n\n` +
    `Format: PROVINSI.KABUPATEN.KECAMATAN.DESA`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  
  villageCodeStates.set(chatId, { step: 'input_code' });
};

// Handle village code message responses
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
        const message = `🏘️ *Set Kode Wilayah Baru*\n\n` +
          `Masukkan kode wilayah baru (format: 33.01.06.2016):\n\n` +
          `Contoh:\n` +
          `• 33.01.06.2016 (Desa/Kelurahan)\n` +
          `• 33.01.06 (Kecamatan)\n` +
          `• 33.01 (Kabupaten/Kota)\n` +
          `• 33 (Provinsi)\n\n` +
          `Format: PROVINSI.KABUPATEN.KECAMATAN.DESA`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        villageState.step = 'input_code';
        villageCodeStates.set(chatId, villageState);
      } else if (text.toLowerCase() === 'tidak' || text.toLowerCase() === 't') {
        const message = `✅ Kode wilayah tidak diubah\n\n` +
          `Kode wilayah tetap: ${villageState.currentCode}\n\n` +
          `Anda dapat mengirim foto KK untuk diproses.`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        villageCodeStates.delete(chatId);
      } else {
        await bot.sendMessage(chatId, 'Jawaban tidak valid. Ketik "ya" atau "tidak".');
      }

    } else if (villageState.step === 'input_code') {
      let villageCode = text.trim();

      // Validate kode
      if (!Validator.isValidRegionCode(villageCode)) {
        await bot.sendMessage(chatId, 
          '❌ Format kode wilayah tidak valid.\n\n' +
          'Gunakan format: XX.XX.XX.XXXX\n' +
          'Contoh: 33.01.06.2016\n\n' +
          'Silakan coba lagi:'
        );
        return;
      }

      await bot.sendMessage(chatId, '🔍 Memvalidasi kode wilayah...');

      // Normalize kode (remove dots)
      const normalizedCode = villageCode.replace(/\./g, '');

      // Validate with Region API
      const region = await RegionService.getRegion(normalizedCode);

      if (!region) {
        const message = `❌ Kode wilayah tidak valid\n\n` +
          `Kode ${villageCode} tidak ditemukan dalam database.\n\n` +
          `Silakan coba lagi dengan kode yang benar.`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
      }

      // Set village code in session
      const success = AuthService.setVillageCode(chatId, villageCode, region);

      if (success) {
        const message = `✅ *Kode wilayah berhasil diset!*\n\n` +
          `Kode: \`${villageCode}\`\n` +
          `Nama: *${region.name}*\n`;
        
        if (region.level) {
          message += `Level: ${region.level}\n`;
        }
        if (region.province_code) {
          message += `Kode Provinsi: ${region.province_code}\n`;
        }
        if (region.regency_code) {
          message += `Kode Kabupaten/Kota: ${region.regency_code}\n`;
        }
        if (region.district_code) {
          message += `Kode Kecamatan: ${region.district_code}\n`;
        }

        message += `\n🎉 Anda sekarang bisa mengirim foto KK untuk diproses!`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, '❌ Gagal menyimpan kode wilayah. Silakan coba lagi.');
      }

      villageCodeStates.delete(chatId);
    }

  } catch (error) {
    logger.error('Error in village code message handler:', error);
    
    villageCodeStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi dengan /kode-wilayah.');
  }
};

// Check if user is in village code process
module.exports.isInVillageCodeProcess = (chatId) => {
  return villageCodeStates.has(chatId);
};

// Clear village code state
module.exports.clearVillageCodeState = (chatId) => {
  villageCodeStates.delete(chatId);
};
