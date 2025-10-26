/**
 * ============================================================================
 * FILE: src/utils/textCleaner.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Utility class untuk pembersihan dan normalisasi teks hasil OCR dari Kartu
 * Keluarga. Class ini menangani berbagai format input yang tidak konsisten
 * dari OCR dan menormalisasinya ke format standar database SmartGov.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - ./logger: Untuk logging warning saat normalisasi gagal
 *
 * FUNGSI UTAMA:
 * - Pembersihan karakter tidak valid dari hasil OCR
 * - Normalisasi data ke format standar (jenis kelamin, agama, pendidikan, dll)
 * - Ekstraksi pola tertentu (RT/RW, kode pos)
 * - Validasi format NIK dan KK
 * - Standarisasi singkatan dan format alamat
 *
 * ============================================================================
 */

const logger = require('./logger');

/**
 * Class TextCleaner
 *
 * Static utility class untuk text cleaning dan normalization.
 * Semua methods adalah static karena tidak memerlukan state.
 */
class TextCleaner {

  /**
   * Membersihkan teks hasil OCR dari karakter tidak valid
   *
   * Menghilangkan:
   * - Multiple whitespace/newline/tab menjadi satu spasi
   * - Karakter control dan non-printable
   * - Leading/trailing whitespace
   *
   * @param {string} text - Teks yang akan dibersihkan
   * @returns {string} Teks yang sudah dibersihkan
   *
   * @example
   * cleanOcrText('NAMA\n\nLENGKAP   ') // 'NAMA LENGKAP'
   * cleanOcrText('Text\twith\ttabs') // 'Text with tabs'
   */
  static cleanOcrText(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .trim()
      // Ganti multiple spasi dengan satu spasi
      .replace(/\s+/g, ' ')
      // Ganti multiple newline dengan satu spasi
      .replace(/\n+/g, ' ')
      // Ganti multiple tab dengan satu spasi
      .replace(/\t+/g, ' ')
      // Hapus karakter non-printable (control chars)
      // Rentang \x20-\x7E = ASCII printable
      // Rentang \u00A0-\uFFFF = Unicode characters (untuk nama Indonesia)
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
      .trim();
  }

  /**
   * Normalisasi nama lengkap
   *
   * Proses:
   * 1. Clean OCR artifacts
   * 2. Convert ke UPPERCASE
   * 3. Fix OCR confusions (0/O, 1/I, 5/S)
   *
   * @param {string} name - Nama yang akan dinormalisasi
   * @returns {string} Nama yang sudah dinormalisasi
   *
   * @example
   * normalizeName('j0hn d0e') // 'JOHN DOE'
   * normalizeName('5usant0') // 'SUSANTO'
   */
  static normalizeName(name) {
    if (!name || typeof name !== 'string') return '';

    let cleaned = this.cleanOcrText(name);

    // Convert ke uppercase untuk konsistensi
    cleaned = cleaned.toUpperCase();

    // Fix common OCR errors
    // 0 (angka nol) dan O (huruf) sering tertukar di OCR
    // 1 (angka satu) dan I (huruf) sering tertukar
    // 5 (angka lima) dan S (huruf) sering tertukar
    cleaned = cleaned
      .replace(/[0O]/g, 'O')
      .replace(/[1I]/g, 'I')
      .replace(/[5S]/g, 'S')
      .trim();

    return cleaned;
  }

  /**
   * Normalisasi jenis kelamin ke format standar
   *
   * Input yang diterima:
   * - Text: LAKI-LAKI, PEREMPUAN, PRIA, WANITA, MALE, FEMALE
   * - Singkatan: L, P, M, F
   * - Angka: 1 (laki-laki), 2 (perempuan)
   *
   * Output: 'L' atau 'P'
   *
   * @param {string} gender - Jenis kelamin dari OCR
   * @returns {string|null} 'L' atau 'P', null jika tidak valid
   *
   * @example
   * normalizeGender('LAKI-LAKI') // 'L'
   * normalizeGender('perempuan') // 'P'
   * normalizeGender('1') // 'L'
   * normalizeGender('invalid') // null (dengan warning log)
   */
  static normalizeGender(gender) {
    if (!gender || typeof gender !== 'string') return null;

    const cleaned = gender.toUpperCase().trim();

    // Pattern matching untuk laki-laki
    if (cleaned.includes('LAKI')) return 'L';
    if (cleaned.includes('PRIA')) return 'L';
    if (cleaned.includes('MALE')) return 'L';

    // Pattern matching untuk perempuan
    if (cleaned.includes('PEREMPUAN')) return 'P';
    if (cleaned.includes('WANITA')) return 'P';
    if (cleaned.includes('FEMALE')) return 'P';

    // Singkatan exact match
    if (cleaned === 'L' || cleaned === 'M') return 'L';
    if (cleaned === 'P' || cleaned === 'F') return 'P';

    // Format angka (beberapa form menggunakan kode angka)
    if (cleaned === '1') return 'L';
    if (cleaned === '2') return 'P';

    // Jika tidak match, log warning dan return null
    logger.warn(`Unable to normalize gender: ${gender}`);
    return null;
  }

  /**
   * Normalisasi agama ke format standar
   *
   * Mapping agama resmi di Indonesia:
   * - Islam
   * - Kristen (Protestan)
   * - Katholik
   * - Hindu
   * - Budha
   * - Konghucu
   * - Kepercayaan Terhadap Tuhan YME
   *
   * @param {string} religion - Agama dari OCR
   * @returns {string} Agama dalam format standar
   *
   * @example
   * normalizeReligion('ISLAM') // 'Islam'
   * normalizeReligion('buddha') // 'Budha'
   * normalizeReligion('KONG HU CU') // 'Konghucu'
   */
  static normalizeReligion(religion) {
    if (!religion || typeof religion !== 'string') return '';

    const cleaned = religion.toUpperCase().trim();

    // Mapping agama dengan berbagai variasi input
    const religionMap = {
      'ISLAM': 'Islam',
      'KRISTEN': 'Kristen',
      'KATOLIK': 'Katholik',
      'KATHOLIK': 'Katholik',
      'HINDU': 'Hindu',
      'BUDHA': 'Budha',
      'BUDDHA': 'Budha',
      'KONGHUCU': 'Konghucu',
      'KONG HU CU': 'Konghucu',
      'KEPERCAYAAN': 'Kepercayaan Terhadap Tuhan YME'
    };

    // Cari pattern yang match (includes, bukan exact match)
    for (const [key, value] of Object.entries(religionMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    // Jika tidak match, return as-is setelah cleaning
    return this.cleanOcrText(religion);
  }

  /**
   * Normalisasi pendidikan ke format standar
   *
   * Format standar pendidikan di Indonesia:
   * - TIDAK/BELUM SEKOLAH
   * - SD (Sekolah Dasar)
   * - SLTP (Sekolah Lanjutan Tingkat Pertama)
   * - SLTA (Sekolah Lanjutan Tingkat Atas)
   * - DIPLOMA I/II
   * - AKADEMI/DIPLOMA III/S.MUDA
   * - DIPLOMA IV/STRATA I
   * - STRATA II
   * - STRATA III
   *
   * @param {string} education - Pendidikan dari OCR
   * @returns {string} Pendidikan dalam format standar
   *
   * @example
   * normalizeEducation('SMA') // 'SLTA'
   * normalizeEducation('S1') // 'DIPLOMA IV/STRATA I'
   * normalizeEducation('D3') // 'AKADEMI/DIPLOMA III/S.MUDA'
   */
  static normalizeEducation(education) {
    if (!education || typeof education !== 'string') return '';

    const cleaned = education.toUpperCase().trim();

    const educationMap = {
      'TIDAK': 'TIDAK/BELUM SEKOLAH',
      'BELUM': 'TIDAK/BELUM SEKOLAH',
      'SD': 'SD',
      'SEKOLAH DASAR': 'SD',
      'SLTP': 'SLTP',
      'SMP': 'SLTP',
      'SLTA': 'SLTA',
      'SMA': 'SLTA',
      'SMK': 'SLTA',
      'D1': 'DIPLOMA I/II',
      'D2': 'DIPLOMA I/II',
      'D3': 'AKADEMI/DIPLOMA III/S.MUDA',
      'D4': 'DIPLOMA IV/STRATA I',
      'S1': 'DIPLOMA IV/STRATA I',
      'S2': 'STRATA II',
      'S3': 'STRATA III'
    };

    for (const [key, value] of Object.entries(educationMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(education);
  }

  /**
   * Normalisasi status perkawinan ke format standar
   *
   * Format standar:
   * - BELUM KAWIN
   * - KAWIN
   * - CERAI HIDUP
   * - CERAI MATI
   *
   * @param {string} status - Status perkawinan dari OCR
   * @returns {string} Status dalam format standar
   *
   * @example
   * normalizeMaritalStatus('MENIKAH') // 'KAWIN'
   * normalizeMaritalStatus('JANDA') // 'CERAI MATI'
   * normalizeMaritalStatus('BELUM') // 'BELUM KAWIN'
   */
  static normalizeMaritalStatus(status) {
    if (!status || typeof status !== 'string') return '';

    const cleaned = status.toUpperCase().trim();

    const statusMap = {
      'BELUM KAWIN': 'BELUM KAWIN',
      'BELUM': 'BELUM KAWIN',
      'KAWIN': 'KAWIN',
      'MENIKAH': 'KAWIN',
      'CERAI HIDUP': 'CERAI HIDUP',
      'CERAI MATI': 'CERAI MATI',
      'JANDA': 'CERAI MATI',
      'DUDA': 'CERAI MATI'
    };

    for (const [key, value] of Object.entries(statusMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(status);
  }

  /**
   * Normalisasi hubungan dalam keluarga ke format standar
   *
   * Format standar:
   * - KEPALA KELUARGA
   * - SUAMI
   * - ISTRI
   * - ANAK
   * - MENANTU
   * - CUCU
   * - ORANG TUA
   * - MERTUA
   * - FAMILI
   * - LAINNYA
   *
   * @param {string} relationship - Hubungan dari OCR
   * @returns {string} Hubungan dalam format standar
   *
   * @example
   * normalizeFamilyRelationship('KK') // 'KEPALA KELUARGA'
   * normalizeFamilyRelationship('ISTERI') // 'ISTRI'
   * normalizeFamilyRelationship('FAMILI LAIN') // 'FAMILI'
   */
  static normalizeFamilyRelationship(relationship) {
    if (!relationship || typeof relationship !== 'string') return '';

    const cleaned = relationship.toUpperCase().trim();

    const relationshipMap = {
      'KEPALA KELUARGA': 'KEPALA KELUARGA',
      'KEPALA': 'KEPALA KELUARGA',
      'KK': 'KEPALA KELUARGA',
      'SUAMI': 'SUAMI',
      'ISTRI': 'ISTRI',
      'ISTERI': 'ISTRI',
      'ANAK': 'ANAK',
      'MENANTU': 'MENANTU',
      'CUCU': 'CUCU',
      'ORANGTUA': 'ORANG TUA',
      'ORANG TUA': 'ORANG TUA',
      'MERTUA': 'MERTUA',
      'FAMILI LAIN': 'FAMILI',
      'FAMILI': 'FAMILI',
      'LAINNYA': 'LAINNYA',
      'LAIN': 'LAINNYA'
    };

    for (const [key, value] of Object.entries(relationshipMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(relationship);
  }

  /**
   * Normalisasi pekerjaan
   *
   * Untuk pekerjaan tidak ada mapping khusus karena sangat bervariasi.
   * Hanya dibersihkan dan diubah ke UPPERCASE untuk konsistensi.
   *
   * @param {string} occupation - Pekerjaan dari OCR
   * @returns {string} Pekerjaan dalam format uppercase
   *
   * @example
   * normalizeOccupation('petani') // 'PETANI'
   * normalizeOccupation('Wiraswasta  ') // 'WIRASWASTA'
   */
  static normalizeOccupation(occupation) {
    if (!occupation || typeof occupation !== 'string') return '';

    const cleaned = this.cleanOcrText(occupation);

    // Convert ke uppercase untuk konsistensi
    return cleaned.toUpperCase();
  }

  /**
   * Normalisasi kewarganegaraan
   *
   * Format standar:
   * - WNI (Warga Negara Indonesia)
   * - WNA (Warga Negara Asing)
   *
   * Default: WNI (mayoritas penduduk Indonesia)
   *
   * @param {string} citizenship - Kewarganegaraan dari OCR
   * @returns {string} 'WNI' atau 'WNA'
   *
   * @example
   * normalizeCitizenship('INDONESIA') // 'WNI'
   * normalizeCitizenship('ASING') // 'WNA'
   * normalizeCitizenship('') // 'WNI' (default)
   */
  static normalizeCitizenship(citizenship) {
    if (!citizenship || typeof citizenship !== 'string') return 'WNI';

    const cleaned = citizenship.toUpperCase().trim();

    if (cleaned.includes('WNI') || cleaned.includes('INDONESIA')) return 'WNI';
    if (cleaned.includes('WNA') || cleaned.includes('ASING')) return 'WNA';

    // Default ke WNI jika tidak jelas
    return 'WNI';
  }

  /**
   * Normalisasi alamat dengan ekspansi singkatan
   *
   * Singkatan yang diubah:
   * - JL → Jalan
   * - RT → RT (tetap)
   * - RW → RW (tetap)
   * - No → No.
   * - Kel → Kel.
   * - Kec → Kec.
   *
   * @param {string} address - Alamat dari OCR
   * @returns {string} Alamat dengan singkatan yang sudah distandarisasi
   *
   * @example
   * normalizeAddress('JL. Merdeka No 10 RT 001 RW 002')
   * // 'Jalan Merdeka No. 10 RT 001 RW 002'
   */
  static normalizeAddress(address) {
    if (!address || typeof address !== 'string') return '';

    let cleaned = this.cleanOcrText(address);

    // Ekspansi dan standarisasi singkatan
    // \b = word boundary, untuk match whole word
    // \.? = optional dot setelah singkatan
    // gi = global case-insensitive
    cleaned = cleaned
      .replace(/\bJL\b\.?/gi, 'Jalan')
      .replace(/\bRT\b\.?/gi, 'RT')
      .replace(/\bRW\b\.?/gi, 'RW')
      .replace(/\bNo\b\.?/gi, 'No.')
      .replace(/\bKel\b\.?/gi, 'Kel.')
      .replace(/\bKec\b\.?/gi, 'Kec.');

    return cleaned;
  }

  /**
   * Ekstraksi RT/RW dari text
   *
   * Format yang dikenali:
   * - RT 001 / RW 002
   * - RT:001/RW:002
   * - RT.001\\RW.002
   * - 001/002 (format sederhana)
   *
   * Output: '001/002' (3 digit dengan leading zeros)
   *
   * @param {string} text - Text yang mengandung RT/RW
   * @returns {string|null} RT/RW dalam format '001/002', null jika tidak ditemukan
   *
   * @example
   * extractRTRW('RT 5 / RW 12') // '005/012'
   * extractRTRW('RT:001/RW:002') // '001/002'
   * extractRTRW('alamat tanpa RT/RW') // null
   */
  static extractRTRW(text) {
    if (!text || typeof text !== 'string') return null;

    // Pattern lengkap: RT <sep> <digits> <slash> RW <sep> <digits>
    // <sep> = separator optional: spasi, colon, dash, dot
    // <slash> = / atau \
    const pattern = /RT\s*[:\-\.]?\s*(\d+)\s*[\/\\]\s*RW\s*[:\-\.]?\s*(\d+)/i;
    const match = text.match(pattern);

    if (match) {
      // Pad dengan leading zeros untuk format 3 digit
      const rt = match[1].padStart(3, '0');
      const rw = match[2].padStart(3, '0');
      return `${rt}/${rw}`;
    }

    // Fallback: pattern sederhana tanpa label RT/RW
    // Mencari format: <digits> / <digits>
    const simplePattern = /(\d{1,3})\s*[\/\\]\s*(\d{1,3})/;
    const simpleMatch = text.match(simplePattern);

    if (simpleMatch) {
      const rt = simpleMatch[1].padStart(3, '0');
      const rw = simpleMatch[2].padStart(3, '0');
      return `${rt}/${rw}`;
    }

    return null;
  }

  /**
   * Menghapus karakter spesial dari text
   *
   * Karakter yang dipertahankan:
   * - Alphanumeric (a-z, A-Z, 0-9)
   * - Whitespace
   * - Dash (-)
   * - Dot (.)
   * - Comma (,)
   *
   * Semua karakter lain dihapus.
   *
   * @param {string} text - Text yang akan dibersihkan
   * @returns {string} Text tanpa karakter spesial
   *
   * @example
   * removeSpecialChars('Nama (Alias)') // 'Nama Alias'
   * removeSpecialChars('Text@#$%^&*') // 'Text'
   */
  static removeSpecialChars(text) {
    if (!text || typeof text !== 'string') return '';

    // \w = word characters (a-z, A-Z, 0-9, _)
    // \s = whitespace
    // \- = dash
    // . = dot
    // , = comma
    // [^...] = negation (hapus yang tidak match)
    return text
      .replace(/[^\w\s\-.,]/gi, '')
      .trim();
  }

  /**
   * Normalisasi NIK (Nomor Induk Kependudukan)
   *
   * Proses:
   * 1. Hapus semua karakter non-digit
   * 2. Validasi panjang harus 16 digit
   * 3. Return null jika tidak valid
   *
   * Format NIK: 16 digit
   * Contoh: 3374051234567890
   *
   * @param {string|number} nik - NIK dari OCR
   * @returns {string|null} NIK 16 digit atau null jika tidak valid
   *
   * @example
   * normalizeNIK('3374-0512-3456-7890') // '3374051234567890'
   * normalizeNIK('337405123456') // null (kurang dari 16 digit)
   */
  static normalizeNIK(nik) {
    if (!nik) return null;

    // Convert ke string dan hapus semua non-digit
    // \D = non-digit characters
    const cleaned = String(nik).replace(/\D/g, '');

    // Validasi panjang harus tepat 16 digit
    if (cleaned.length === 16) {
      return cleaned;
    }

    // Log warning jika panjang tidak valid
    logger.warn(`Invalid NIK length: ${nik} (length: ${cleaned.length})`);
    return null;
  }

  /**
   * Normalisasi Nomor KK (Kartu Keluarga)
   *
   * Proses:
   * 1. Hapus semua karakter non-digit
   * 2. Validasi panjang harus 16 digit
   * 3. Return null jika tidak valid
   *
   * Format KK: 16 digit (sama seperti NIK)
   * Contoh: 3374051234567890
   *
   * @param {string|number} kk - Nomor KK dari OCR
   * @returns {string|null} KK 16 digit atau null jika tidak valid
   *
   * @example
   * normalizeKK('3374-0512-3456-7890') // '3374051234567890'
   * normalizeKK('33740512345678901') // null (lebih dari 16 digit)
   */
  static normalizeKK(kk) {
    if (!kk) return null;

    // Convert ke string dan hapus semua non-digit
    const cleaned = String(kk).replace(/\D/g, '');

    // Validasi panjang harus tepat 16 digit
    if (cleaned.length === 16) {
      return cleaned;
    }

    // Log warning jika panjang tidak valid
    logger.warn(`Invalid KK length: ${kk} (length: ${cleaned.length})`);
    return null;
  }

  /**
   * Normalisasi kode pos
   *
   * Proses:
   * 1. Hapus semua karakter non-digit
   * 2. Jika tepat 5 digit, return as-is
   * 3. Jika kurang dari 5 digit, pad dengan leading zeros
   * 4. Jika lebih dari 5 digit atau 0 digit, return null
   *
   * Format kode pos Indonesia: 5 digit
   * Contoh: 50123, 10110, 80361
   *
   * @param {string|number} code - Kode pos dari OCR
   * @returns {string|null} Kode pos 5 digit atau null jika tidak valid
   *
   * @example
   * normalizePostalCode('50123') // '50123'
   * normalizePostalCode('123') // '00123' (padded)
   * normalizePostalCode('501234') // null (terlalu panjang)
   */
  static normalizePostalCode(code) {
    if (!code) return null;

    // Convert ke string dan hapus semua non-digit
    const cleaned = String(code).replace(/\D/g, '');

    // Jika tepat 5 digit, return as-is
    if (cleaned.length === 5) {
      return cleaned;
    }

    // Jika kurang dari 5 digit (tapi lebih dari 0), pad dengan leading zeros
    // Ini handle case seperti kode pos "123" → "00123"
    if (cleaned.length > 0 && cleaned.length < 5) {
      return cleaned.padStart(5, '0');
    }

    // Jika 0 digit atau lebih dari 5 digit, tidak valid
    return null;
  }
}

module.exports = TextCleaner;

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. OCR ERROR PATTERNS:
 *    OCR sering salah membaca karakter yang mirip:
 *    - 0 (zero) ↔ O (letter O)
 *    - 1 (one) ↔ I (letter I) ↔ l (lowercase L)
 *    - 5 (five) ↔ S (letter S)
 *    - 8 (eight) ↔ B (letter B)
 *
 *    Normalisasi harus mempertimbangkan context (nama vs nomor).
 *
 * 2. EXTENSIBILITY:
 *    Untuk menambah normalisasi baru:
 *    - Buat static method baru
 *    - Gunakan pattern: validate → clean → normalize → return
 *    - Log warning untuk case yang tidak bisa dinormalisasi
 *    - Tambahkan JSDoc dengan contoh
 *
 * 3. MAPPING UPDATES:
 *    Jika ada variasi baru dari OCR:
 *    - Update mapping object (religionMap, educationMap, dll)
 *    - Test dengan data real
 *    - Consider case sensitivity
 *
 * 4. PERFORMANCE:
 *    - Semua methods adalah pure functions (no side effects)
 *    - String operations bisa expensive untuk text panjang
 *    - Regex compilation di-cache otomatis oleh JavaScript engine
 *
 * 5. TESTING:
 *    Test dengan berbagai input:
 *    - Valid input (happy path)
 *    - Invalid input (edge cases)
 *    - Empty/null input
 *    - Unicode characters (nama dengan diakritik)
 *    - OCR artifacts (extra spaces, newlines, special chars)
 *
 * 6. LOCALIZATION:
 *    Class ini specific untuk Indonesia:
 *    - Format NIK/KK Indonesia (16 digit)
 *    - Agama resmi di Indonesia
 *    - Sistem pendidikan Indonesia
 *
 *    Jika deploy untuk negara lain, perlu modifikasi mapping.
 *
 * ============================================================================
 */
