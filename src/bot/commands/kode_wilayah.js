const logger = require('../../utils/logger');
const AuthService = require('../../services/AuthService');
const RegionService = require('../../services/RegionService');
const Validator = require('../../utils/validator');

const villageCodeStates = new Map();

module.exports = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  logger.info(`/kode-wilayah command from chat ${chatId}`);

  if (!AuthService.isLoggedIn(chatId)) {
    await bot.sendMessage(
      chatId,
      'Akses ditolak. Anda harus melakukan login terlebih dahulu.\n\n' +
      'Untuk mengakses fitur kode wilayah, silakan login menggunakan perintah:\n' +
      '/login <username> <password>\n\n' +
      'Contoh:\n' +
      '/login admin123 password123\n' +
      '/login kepala_desa kata_sandi_rahasia'
    );
    return;
  }

  const parts = text.split(' ');
  let villageCode = null;
  
  if (parts.length > 1) {
    villageCode = parts.slice(1).join(' ').trim();
  }

  const userInfo = AuthService.getUserInfo(chatId);
  const currentVillageCode = AuthService.getVillageCode(chatId);
  const currentVillageData = AuthService.getVillageData(chatId);

  if (villageCode) {
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

module.exports.isInVillageCodeProcess = (chatId) => {
  return villageCodeStates.has(chatId);
};

module.exports.clearVillageCodeState = (chatId) => {
  villageCodeStates.delete(chatId);
};
