/**
 * ============================================================================
 * FILE: src/utils/validator.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Utility class untuk validasi berbagai jenis data dalam aplikasi OCR-KK.
 * Class ini menyediakan methods untuk validasi format data kependudukan
 * (NIK, KK, nama, tanggal, dll), validasi data authentication, serta
 * validasi data kompleks seperti data keluarga dan penduduk.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - ./logger: Untuk logging (saat ini tidak digunakan, reserved untuk future use)
 *
 * KATEGORI VALIDASI:
 * 1. Data Kependudukan: NIK, KK, nama, gender, tanggal lahir
 * 2. Data Lokasi: Kode wilayah, RT/RW, kode pos
 * 3. Data Kontak: Email, nomor telepon
 * 4. Data Authentication: Username, password
 * 5. Data Kompleks: Validasi object keluarga dan penduduk
 * 6. Security: Sanitasi input untuk mencegah injection
 *
 * FILOSOFI VALIDASI:
 * - Fail-fast: Return false untuk input invalid/null
 * - Flexible input: Terima berbagai format (string, number) dan normalisasi
 * - Clear error messages: Error messages yang descriptive
 * - Layered validation: Dari basic format check ke business logic validation
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const Validator = require('./utils/validator');
 *
 * // Validasi format data
 * if (!Validator.isValidNIK(nik)) {
 *   return res.status(400).json({ error: 'NIK tidak valid' });
 * }
 *
 * // Validasi data kompleks
 * const validation = Validator.validateFamilyData(familyData);
 * if (!validation.isValid) {
 *   console.log('Errors:', validation.errors);
 * }
 *
 * // Sanitasi input
 * const safeInput = Validator.sanitize(userInput);
 * ```
 *
 * ============================================================================
 */

// ============================================================================
// IMPORT DEPENDENCIES
// ============================================================================

/**
 * logger - Logging utility
 * Saat ini tidak digunakan dalam validator, tapi di-import untuk
 * kemungkinan logging validasi failures di masa depan.
 */
const logger = require('./logger');

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

/**
 * Class Validator
 *
 * Static utility class untuk berbagai jenis validasi data.
 * Semua methods adalah static karena tidak memerlukan state.
 * Class ini pure function - tidak ada side effects kecuali logging.
 */
class Validator {

  // ==========================================================================
  // VALIDASI DATA KEPENDUDUKAN
  // ==========================================================================

  /**
   * Validasi format NIK (Nomor Induk Kependudukan)
   *
   * NIK adalah nomor identitas unik setiap warga negara Indonesia.
   * Format standar NIK Indonesia:
   * - Panjang: Tepat 16 digit
   * - Karakter: Hanya angka 0-9
   * - Struktur: PPKKSSDDMMYYNNNN
   *   - PP: Kode Provinsi (2 digit)
   *   - KK: Kode Kabupaten/Kota (2 digit)
   *   - SS: Kode Kecamatan (2 digit)
   *   - DD: Tanggal lahir (2 digit, +40 untuk perempuan)
   *   - MM: Bulan lahir (2 digit)
   *   - YY: Tahun lahir (2 digit)
   *   - NNNN: Nomor urut (4 digit)
   *
   * Method ini hanya validasi FORMAT, tidak validasi kebenaran data
   * (misalnya tidak cek apakah kode provinsi benar-benar ada).
   *
   * @param {string|number} nik - NIK yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidNIK('3374051234567890') // true (16 digit)
   * isValidNIK(3374051234567890) // true (number juga diterima)
   * isValidNIK('337405123456') // false (kurang dari 16 digit)
   * isValidNIK('337405123456789X') // false (ada karakter non-digit)
   * isValidNIK('  3374051234567890  ') // true (whitespace di-trim)
   * isValidNIK(null) // false
   * isValidNIK('') // false
   */
  static isValidNIK(nik) {
    // Guard clause: return false untuk null/undefined
    if (!nik) return false;

    // Convert ke string untuk handling input number
    // Trim untuk menghilangkan whitespace di awal/akhir
    const nikStr = String(nik).trim();

    // Regex pattern: ^ = start, \d{16} = tepat 16 digit, $ = end
    // ^ dan $ penting untuk memastikan TEPAT 16 digit, tidak lebih tidak kurang
    return /^\d{16}$/.test(nikStr);
  }

  /**
   * Validasi format Nomor KK (Kartu Keluarga)
   *
   * Nomor KK adalah nomor identitas unik setiap keluarga di Indonesia.
   * Format standar sama dengan NIK: 16 digit numerik.
   *
   * Struktur Nomor KK mirip dengan NIK:
   * - Panjang: Tepat 16 digit
   * - Karakter: Hanya angka 0-9
   * - 6 digit pertama: Kode wilayah
   * - 6 digit berikutnya: Tanggal pembuatan
   * - 4 digit terakhir: Nomor urut
   *
   * @param {string|number} kk - Nomor KK yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidKK('3374051234567890') // true
   * isValidKK('337405123456') // false (kurang dari 16 digit)
   * isValidKK('33740512345678901') // false (lebih dari 16 digit)
   * isValidKK(null) // false
   */
  static isValidKK(kk) {
    // Guard clause untuk null/undefined
    if (!kk) return false;

    // Convert ke string dan trim whitespace
    const kkStr = String(kk).trim();

    // Validasi: tepat 16 digit numerik
    return /^\d{16}$/.test(kkStr);
  }

  /**
   * Validasi format nomor telepon Indonesia
   *
   * Format nomor telepon yang diterima:
   * - Awalan: +62, 62, atau 0
   * - Panjang setelah awalan: 8-12 digit
   * - Total panjang: 9-14 karakter (dengan awalan)
   *
   * Contoh format valid:
   * - +628123456789 (format internasional dengan +)
   * - 628123456789 (format internasional tanpa +)
   * - 08123456789 (format lokal)
   *
   * @param {string|number} phone - Nomor telepon yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidPhone('08123456789') // true (format lokal)
   * isValidPhone('+628123456789') // true (format internasional)
   * isValidPhone('628123456789') // true (tanpa +)
   * isValidPhone('021123456') // false (tidak diawali 08/62/+62)
   * isValidPhone('0812') // false (terlalu pendek)
   * isValidPhone('081234567890123') // false (terlalu panjang)
   * isValidPhone(null) // false
   */
  static isValidPhone(phone) {
    // Guard clause
    if (!phone) return false;

    // Convert dan trim
    const phoneStr = String(phone).trim();

    // Regex breakdown:
    // ^ = start
    // (\+62|62|0) = awalan: +62 atau 62 atau 0
    // [0-9]{8,12} = 8-12 digit setelah awalan
    // $ = end
    return /^(\+62|62|0)[0-9]{8,12}$/.test(phoneStr);
  }

  /**
   * Validasi format email
   *
   * Validasi email menggunakan pattern sederhana tapi cukup untuk
   * sebagian besar kasus penggunaan:
   * - Minimal ada 1 karakter sebelum @
   * - Ada @ sebagai separator
   * - Minimal ada 1 karakter setelah @ dan sebelum .
   * - Ada . setelah @
   * - Minimal ada 1 karakter setelah . (TLD)
   * - Tidak boleh ada whitespace
   *
   * CATATAN: Ini bukan RFC 5322 compliant email validation (yang sangat
   * kompleks), tapi cukup untuk validasi praktis.
   *
   * @param {string} email - Email yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidEmail('user@example.com') // true
   * isValidEmail('user.name+tag@example.co.id') // true
   * isValidEmail('user@domain') // false (tidak ada TLD)
   * isValidEmail('@example.com') // false (tidak ada local part)
   * isValidEmail('user @example.com') // false (ada whitespace)
   * isValidEmail(null) // false
   */
  static isValidEmail(email) {
    // Guard clause
    if (!email) return false;

    // Regex pattern sederhana untuk email
    // [^\s@]+ = 1+ karakter yang bukan whitespace dan bukan @
    // @ = literal @
    // [^\s@]+ = 1+ karakter yang bukan whitespace dan bukan @ (domain)
    // \. = literal dot
    // [^\s@]+ = 1+ karakter untuk TLD
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Test email yang sudah di-trim
    return emailRegex.test(email.trim());
  }

  /**
   * Validasi format tanggal
   *
   * Format tanggal yang diterima: DD-MM-YYYY
   * - DD: Tanggal 01-31 (2 digit)
   * - MM: Bulan 01-12 (2 digit)
   * - YYYY: Tahun 1900 sampai tahun sekarang (4 digit)
   *
   * Validasi yang dilakukan:
   * 1. Format string sesuai DD-MM-YYYY
   * 2. Bulan dalam range 1-12
   * 3. Tanggal dalam range 1-31
   * 4. Tahun dalam range 1900 sampai tahun sekarang
   *
   * CATATAN: Validasi ini tidak memeriksa validitas tanggal secara
   * calendar (misalnya 31 Februari tetap dianggap valid di sini).
   * Untuk validasi calendar yang lebih ketat, gunakan DateParser.
   *
   * @param {string} dateString - Tanggal dalam format DD-MM-YYYY
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidDate('17-08-1945') // true
   * isValidDate('01-01-2025') // true
   * isValidDate('31-02-2024') // true (tidak validasi calendar, hanya format)
   * isValidDate('32-01-2024') // false (tanggal > 31)
   * isValidDate('01-13-2024') // false (bulan > 12)
   * isValidDate('01-01-1899') // false (tahun < 1900)
   * isValidDate('01-01-2026') // false (tahun > tahun sekarang)
   * isValidDate('2024-01-01') // false (format salah)
   * isValidDate(null) // false
   */
  static isValidDate(dateString) {
    // Guard clause
    if (!dateString) return false;

    // Regex untuk format DD-MM-YYYY
    // (\d{2}) = capture group untuk day (2 digit)
    // - = literal dash
    // (\d{2}) = capture group untuk month (2 digit)
    // - = literal dash
    // (\d{4}) = capture group untuk year (4 digit)
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(dateRegex);

    // Jika tidak match pattern, return false
    if (!match) return false;

    // Extract day, month, year dari capture groups
    // match[0] = full match, match[1] = group 1, dst
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    // Validasi range bulan
    if (month < 1 || month > 12) return false;

    // Validasi range tanggal
    // Simplified check: 1-31 (tidak cek jumlah hari per bulan)
    if (day < 1 || day > 31) return false;

    // Validasi range tahun
    // Lower bound: 1900 (reasonable untuk data kependudukan)
    // Upper bound: tahun sekarang (tidak boleh masa depan)
    if (year < 1900 || year > new Date().getFullYear()) return false;

    return true;
  }

  /**
   * Validasi jenis kelamin
   *
   * Format yang diterima (case-insensitive):
   * - Singkatan: L, P
   * - Lengkap: LAKI-LAKI, PEREMPUAN
   *
   * Method ini flexible untuk menerima berbagai format, kemudian
   * validasi apakah termasuk dalam daftar yang diterima.
   *
   * @param {string} gender - Jenis kelamin yang akan divalidasi
   * @returns {boolean} true jika valid, false jika invalid
   *
   * @example
   * isValidGender('L') // true
   * isValidGender('P') // true
   * isValidGender('LAKI-LAKI') // true
   * isValidGender('perempuan') // true (case-insensitive)
   * isValidGender('  L  ') // true (whitespace di-trim)
   * isValidGender('M') // false (tidak dalam daftar)
   * isValidGender('') // false
   * isValidGender(null) // false
   */
  static isValidGender(gender) {
    // Guard clause
    if (!gender) return false;

    // Normalize: uppercase dan trim
    const normalized = gender.toUpperCase().trim();

    // Daftar format yang diterima
    // L = Laki-laki (singkatan)
    // P = Perempuan (singkatan)
    // LAKI-LAKI = format lengkap
    // PEREMPUAN = format lengkap
    return ['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(normalized);
  }

  // ==========================================================================
  // VALIDASI DATA LOKASI
  // ==========================================================================

  /**
   * Validasi kode wilayah administrasi Indonesia
   *
   * Indonesia menggunakan sistem kode wilayah hierarkis:
   * - 2 digit: Provinsi
   * - 4 digit: Kabupaten/Kota
   * - 6 digit: Kecamatan
   * - 10 digit: Kelurahan/Desa
   * - 13 digit: Kode pos + detail
   *
   * Method ini menerima kode dengan atau tanpa separator (titik).
   * Contoh: 33.74.05 atau 337405 (sama-sama valid)
   *
   * @param {string|number} code - Kode wilayah yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidRegionCode('33') // true (kode provinsi)
   * isValidRegionCode('3374') // true (kode kabupaten/kota)
   * isValidRegionCode('337405') // true (kode kecamatan)
   * isValidRegionCode('3374051001') // true (kode kelurahan)
   * isValidRegionCode('3374051001001') // true (kode lengkap)
   * isValidRegionCode('33.74') // true (dengan separator)
   * isValidRegionCode('33.74.05') // true (dengan separator)
   * isValidRegionCode('337') // false (panjang tidak valid)
   * isValidRegionCode(null) // false
   */
  static isValidRegionCode(code) {
    // Guard clause
    if (!code) return false;

    // Convert ke string dan trim
    let codeStr = String(code).trim();

    // Hilangkan semua separator titik
    // Ini memungkinkan input seperti "33.74.05" atau "33.74"
    // \. = escape dot (karena dot adalah special char di regex)
    // g = global flag (replace semua occurrence)
    codeStr = codeStr.replace(/\./g, '');

    // Validasi panjang kode (harus salah satu dari: 2, 4, 6, 10, 13 digit)
    // ^ = start
    // (\d{2}|\d{4}|\d{6}|\d{10}|\d{13}) = alternatif panjang yang valid
    // $ = end
    return /^(\d{2}|\d{4}|\d{6}|\d{10}|\d{13})$/.test(codeStr);
  }

  /**
   * Validasi format RT/RW (Rukun Tetangga/Rukun Warga)
   *
   * Format standar RT/RW di Indonesia: XXX/XXX
   * - RT: 3 digit numerik (001-999)
   * - Separator: / (slash)
   * - RW: 3 digit numerik (001-999)
   *
   * Contoh: 001/002, 015/008, 123/456
   *
   * @param {string} rtRw - RT/RW dalam format XXX/XXX
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidRTRW('001/002') // true
   * isValidRTRW('015/008') // true
   * isValidRTRW('  001/002  ') // true (whitespace di-trim)
   * isValidRTRW('1/2') // false (harus 3 digit)
   * isValidRTRW('001-002') // false (separator harus /)
   * isValidRTRW('001/') // false (RW tidak ada)
   * isValidRTRW(null) // false
   */
  static isValidRTRW(rtRw) {
    // Guard clause
    if (!rtRw) return false;

    // Regex pattern:
    // ^ = start
    // \d{3} = tepat 3 digit untuk RT
    // \/ = literal slash (escaped karena / special char di regex)
    // \d{3} = tepat 3 digit untuk RW
    // $ = end
    return /^\d{3}\/\d{3}$/.test(rtRw.trim());
  }

  /**
   * Validasi kode pos Indonesia
   *
   * Format kode pos Indonesia: 5 digit numerik
   * Contoh: 50123, 10110, 80361
   *
   * @param {string|number} code - Kode pos yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidPostalCode('50123') // true
   * isValidPostalCode(50123) // true (number juga diterima)
   * isValidPostalCode('  50123  ') // true (whitespace di-trim)
   * isValidPostalCode('5012') // false (kurang dari 5 digit)
   * isValidPostalCode('501234') // false (lebih dari 5 digit)
   * isValidPostalCode('5012X') // false (ada non-digit)
   * isValidPostalCode(null) // false
   */
  static isValidPostalCode(code) {
    // Guard clause
    if (!code) return false;

    // Convert ke string dan trim
    const codeStr = String(code).trim();

    // Regex: ^ = start, \d{5} = tepat 5 digit, $ = end
    return /^\d{5}$/.test(codeStr);
  }

  // ==========================================================================
  // VALIDASI DATA AUTHENTICATION
  // ==========================================================================

  /**
   * Validasi nama lengkap
   *
   * Rules validasi nama:
   * - Panjang minimal: 2 karakter (untuk nama pendek seperti "AN")
   * - Karakter yang diperbolehkan:
   *   - Huruf a-z, A-Z
   *   - Whitespace (untuk nama dengan spasi)
   *   - Tanda baca: . , ' - (untuk nama seperti "O'Brien", "St. John")
   *
   * Method ini tidak validasi apakah nama "masuk akal", hanya format.
   *
   * @param {string} name - Nama yang akan divalidasi
   * @returns {boolean} true jika format valid, false jika invalid
   *
   * @example
   * isValidName('John Doe') // true
   * isValidName("O'Brien") // true (apostrof diperbolehkan)
   * isValidName('St. John') // true (titik dan spasi diperbolehkan)
   * isValidName('Mary-Jane') // true (dash diperbolehkan)
   * isValidName('A') // false (kurang dari 2 karakter)
   * isValidName('John123') // false (tidak boleh ada angka)
   * isValidName('  ') // false (hanya whitespace)
   * isValidName(null) // false
   */
  static isValidName(name) {
    // Guard clause
    if (!name) return false;

    // Trim whitespace
    const trimmed = name.trim();

    // Validasi dua kondisi:
    // 1. Panjang >= 2 karakter
    // 2. Hanya berisi karakter yang diperbolehkan
    //
    // Regex pattern:
    // ^ = start
    // [a-zA-Z\s.,'-]+ = 1 atau lebih karakter yang allowed
    //   - a-zA-Z = huruf
    //   - \s = whitespace
    //   - .,'-  = punctuation yang diperbolehkan
    // + = 1 or more
    // $ = end
    return trimmed.length >= 2 && /^[a-zA-Z\s.,'-]+$/.test(trimmed);
  }

  /**
   * Validasi username untuk authentication
   *
   * Rules username:
   * - Panjang: 3-30 karakter
   * - Karakter yang diperbolehkan:
   *   - Huruf: a-z, A-Z
   *   - Angka: 0-9
   *   - Underscore: _
   * - Tidak boleh whitespace atau karakter spesial lain
   *
   * @param {string} username - Username yang akan divalidasi
   * @returns {boolean} true jika valid, false jika invalid
   *
   * @example
   * isValidUsername('john_doe') // true
   * isValidUsername('user123') // true
   * isValidUsername('JohnDoe') // true
   * isValidUsername('ab') // false (kurang dari 3 karakter)
   * isValidUsername('a'.repeat(31)) // false (lebih dari 30 karakter)
   * isValidUsername('john-doe') // false (dash tidak diperbolehkan)
   * isValidUsername('john doe') // false (whitespace tidak diperbolehkan)
   * isValidUsername(null) // false
   */
  static isValidUsername(username) {
    // Guard clause
    if (!username) return false;

    // Regex pattern:
    // ^ = start
    // [a-zA-Z0-9_] = karakter yang diperbolehkan
    // {3,30} = panjang antara 3 sampai 30 karakter
    // $ = end
    return /^[a-zA-Z0-9_]{3,30}$/.test(username);
  }

  /**
   * Validasi password untuk authentication
   *
   * Rules password (minimal untuk MVP):
   * - Panjang minimal: 6 karakter
   *
   * CATATAN: Ini adalah validasi minimal. Untuk production, pertimbangkan
   * rules yang lebih ketat:
   * - Minimal 8 karakter
   * - Mengandung huruf besar dan kecil
   * - Mengandung angka
   * - Mengandung karakter spesial
   * - Tidak sama dengan username
   * - Tidak mengandung informasi personal yang mudah ditebak
   *
   * @param {string} password - Password yang akan divalidasi
   * @returns {boolean} true jika valid, false jika invalid
   *
   * @example
   * isValidPassword('password123') // true (>= 6 karakter)
   * isValidPassword('abc123') // true (tepat 6 karakter)
   * isValidPassword('12345') // false (kurang dari 6 karakter)
   * isValidPassword('') // false
   * isValidPassword(null) // false
   */
  static isValidPassword(password) {
    // Guard clause
    if (!password) return false;

    // Simple validation: minimal 6 karakter
    // Untuk production, tambahkan complexity requirements
    return password.length >= 6;
  }

  // ==========================================================================
  // VALIDASI DATA KOMPLEKS
  // ==========================================================================

  /**
   * Validasi data keluarga (family data) dari OCR
   *
   * Method ini melakukan validasi komprehensif terhadap data keluarga
   * yang diekstrak dari OCR Kartu Keluarga.
   *
   * Validasi yang dilakukan:
   * 1. Nomor KK harus valid (16 digit)
   * 2. Nama kepala keluarga harus ada dan minimal 2 karakter
   * 3. Alamat harus ada dan minimal 5 karakter
   * 4. Harus ada minimal 1 anggota keluarga (table tidak boleh kosong)
   *
   * Return object berisi:
   * - isValid: boolean (true jika semua validasi pass)
   * - errors: array of string (daftar error messages)
   *
   * @param {Object} data - Data keluarga hasil OCR
   * @param {string} data.nomor_kk - Nomor Kartu Keluarga
   * @param {string} data.nama_kepala_keluarga - Nama kepala keluarga
   * @param {string} data.alamat - Alamat keluarga
   * @param {Array} data.table - Array anggota keluarga
   * @returns {Object} { isValid: boolean, errors: string[] }
   *
   * @example
   * const data = {
   *   nomor_kk: '3374051234567890',
   *   nama_kepala_keluarga: 'JOHN DOE',
   *   alamat: 'Jalan Merdeka No. 10',
   *   table: [
   *     { nik: '3374051234567890', nama_lengkap: 'JOHN DOE', ... }
   *   ]
   * };
   * const result = validateFamilyData(data);
   * // result = { isValid: true, errors: [] }
   *
   * @example
   * const invalidData = {
   *   nomor_kk: '12345', // invalid KK
   *   nama_kepala_keluarga: 'J', // terlalu pendek
   *   alamat: '', // kosong
   *   table: [] // tidak ada anggota
   * };
   * const result = validateFamilyData(invalidData);
   * // result = {
   * //   isValid: false,
   * //   errors: [
   * //     'Invalid KK number (must be 16 digits)',
   * //     'Invalid or missing family head name',
   * //     'Invalid or missing address',
   * //     'No family members found'
   * //   ]
   * // }
   */
  static validateFamilyData(data) {
    // Array untuk menyimpan error messages
    const errors = [];

    // Validasi 1: Nomor KK
    // Gunakan method isValidKK untuk konsistensi
    if (!this.isValidKK(data.nomor_kk)) {
      errors.push('Invalid KK number (must be 16 digits)');
    }

    // Validasi 2: Nama kepala keluarga
    // Cek keberadaan dan panjang minimal 2 karakter
    if (!data.nama_kepala_keluarga || data.nama_kepala_keluarga.trim().length < 2) {
      errors.push('Invalid or missing family head name');
    }

    // Validasi 3: Alamat
    // Cek keberadaan dan panjang minimal 5 karakter
    // 5 karakter adalah reasonable minimum (misalnya "JL. A")
    if (!data.alamat || data.alamat.trim().length < 5) {
      errors.push('Invalid or missing address');
    }

    // Validasi 4: Anggota keluarga
    // Cek bahwa table adalah array dan tidak kosong
    // Setiap KK minimal harus ada 1 anggota (kepala keluarga)
    if (!data.table || !Array.isArray(data.table) || data.table.length === 0) {
      errors.push('No family members found');
    }

    // Return validation result
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validasi data penduduk (resident data)
   *
   * Method ini melakukan validasi komprehensif terhadap data satu penduduk
   * (anggota keluarga) dari hasil OCR.
   *
   * Validasi yang dilakukan:
   * 1. NIK harus valid (16 digit)
   * 2. Nama lengkap harus valid (minimal 2 karakter, format benar)
   * 3. Jenis kelamin harus valid (L/P/LAKI-LAKI/PEREMPUAN)
   * 4. Tanggal lahir harus valid (format DD-MM-YYYY, range valid)
   * 5. Tempat lahir harus ada dan minimal 2 karakter
   *
   * Return object berisi:
   * - isValid: boolean
   * - errors: array of string
   *
   * @param {Object} resident - Data penduduk
   * @param {string} resident.nik - NIK
   * @param {string} resident.nama_lengkap - Nama lengkap
   * @param {string} resident.jenis_kelamin - Jenis kelamin
   * @param {string} resident.tanggal_lahir - Tanggal lahir (DD-MM-YYYY)
   * @param {string} resident.tempat_lahir - Tempat lahir
   * @returns {Object} { isValid: boolean, errors: string[] }
   *
   * @example
   * const resident = {
   *   nik: '3374051234567890',
   *   nama_lengkap: 'JOHN DOE',
   *   jenis_kelamin: 'L',
   *   tanggal_lahir: '17-08-1945',
   *   tempat_lahir: 'JAKARTA'
   * };
   * const result = validateResidentData(resident);
   * // result = { isValid: true, errors: [] }
   *
   * @example
   * const invalidResident = {
   *   nik: '12345',
   *   nama_lengkap: 'A',
   *   jenis_kelamin: 'X',
   *   tanggal_lahir: '2024-01-01',
   *   tempat_lahir: 'J'
   * };
   * const result = validateResidentData(invalidResident);
   * // result = {
   * //   isValid: false,
   * //   errors: [
   * //     'Invalid NIK (must be 16 digits)',
   * //     'Invalid name',
   * //     'Invalid gender',
   * //     'Invalid birth date (must be DD-MM-YYYY)',
   * //     'Invalid birth place'
   * //   ]
   * // }
   */
  static validateResidentData(resident) {
    // Array untuk menyimpan error messages
    const errors = [];

    // Validasi 1: NIK
    if (!this.isValidNIK(resident.nik)) {
      errors.push('Invalid NIK (must be 16 digits)');
    }

    // Validasi 2: Nama lengkap
    if (!this.isValidName(resident.nama_lengkap)) {
      errors.push('Invalid name');
    }

    // Validasi 3: Jenis kelamin
    if (!this.isValidGender(resident.jenis_kelamin)) {
      errors.push('Invalid gender');
    }

    // Validasi 4: Tanggal lahir
    if (!this.isValidDate(resident.tanggal_lahir)) {
      errors.push('Invalid birth date (must be DD-MM-YYYY)');
    }

    // Validasi 5: Tempat lahir
    // Cek keberadaan dan panjang minimal 2 karakter
    if (!resident.tempat_lahir || resident.tempat_lahir.trim().length < 2) {
      errors.push('Invalid birth place');
    }

    // Return validation result
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ==========================================================================
  // SECURITY & SANITIZATION
  // ==========================================================================

  /**
   * Sanitasi input untuk mencegah XSS dan injection attacks
   *
   * Operasi sanitasi yang dilakukan:
   * 1. Trim whitespace di awal dan akhir
   * 2. Hapus tag HTML (<>)
   * 3. Hapus quotes (single dan double) untuk mencegah SQL injection
   * 4. Limit panjang maksimal 1000 karakter untuk mencegah DoS
   *
   * Method ini adalah basic sanitization. Untuk production:
   * - Gunakan library dedicated seperti DOMPurify (untuk HTML)
   * - Gunakan parameterized queries untuk database (bukan string concat)
   * - Implement rate limiting
   * - Implement input validation di layer lain juga
   *
   * CATATAN: Input non-string dikembalikan as-is (tidak di-sanitize).
   *
   * @param {*} input - Input yang akan di-sanitize
   * @returns {*} Input yang sudah di-sanitize, atau input original jika non-string
   *
   * @example
   * sanitize('  normal text  ') // 'normal text'
   * sanitize('<script>alert("XSS")</script>') // 'scriptalert(XSS)/script'
   * sanitize("'; DROP TABLE users; --") // ; DROP TABLE users; --
   * sanitize('a'.repeat(2000)) // 'a'.repeat(1000) (limited)
   * sanitize(123) // 123 (non-string dikembalikan as-is)
   * sanitize(null) // null
   */
  static sanitize(input) {
    // Guard clause: non-string dikembalikan as-is
    if (typeof input !== 'string') return input;

    return input
      // 1. Trim whitespace di awal dan akhir
      .trim()
      // 2. Hapus < dan > untuk mencegah HTML tags
      //    [<>] = character class untuk < atau >
      //    g = global flag (replace all occurrences)
      .replace(/[<>]/g, '')
      // 3. Hapus single dan double quotes
      //    ['"] = character class untuk ' atau "
      .replace(/['"]/g, '')
      // 4. Limit panjang maksimal 1000 karakter
      //    Mencegah extremely long input (DoS attack)
      .substring(0, 1000);
  }

  /**
   * Validasi dan sanitasi data login
   *
   * Method ini adalah higher-level validation yang menggabungkan:
   * 1. Validasi format username
   * 2. Validasi format password
   * 3. Sanitasi kedua input untuk security
   *
   * Return object berisi:
   * - isValid: boolean (true jika username dan password valid)
   * - errors: array of string (daftar error messages)
   * - sanitized: object dengan username dan password yang sudah di-sanitize
   *
   * CATATAN: Password tidak di-sanitize (dikembalikan as-is) karena:
   * - Password bisa mengandung karakter spesial yang valid
   * - Password akan di-hash sebelum disimpan (tidak perlu sanitasi)
   * - Sanitasi password bisa membatasi password strength
   *
   * @param {string} username - Username yang akan divalidasi
   * @param {string} password - Password yang akan divalidasi
   * @returns {Object} { isValid: boolean, errors: string[], sanitized: { username, password } }
   *
   * @example
   * validateLogin('john_doe', 'password123')
   * // {
   * //   isValid: true,
   * //   errors: [],
   * //   sanitized: { username: 'john_doe', password: 'password123' }
   * // }
   *
   * @example
   * validateLogin('ab', '12345')
   * // {
   * //   isValid: false,
   * //   errors: [
   * //     'Invalid username (3-30 alphanumeric characters)',
   * //     'Invalid password (minimum 6 characters)'
   * //   ],
   * //   sanitized: { username: 'ab', password: '12345' }
   * // }
   *
   * @example
   * validateLogin('<script>alert("xss")</script>', 'pass123')
   * // {
   * //   isValid: false,
   * //   errors: ['Invalid username (3-30 alphanumeric characters)'],
   * //   sanitized: { username: 'scriptalert(xss)/script', password: 'pass123' }
   * // }
   */
  static validateLogin(username, password) {
    // Array untuk menyimpan error messages
    const errors = [];

    // Validasi username
    if (!this.isValidUsername(username)) {
      errors.push('Invalid username (3-30 alphanumeric characters)');
    }

    // Validasi password
    if (!this.isValidPassword(password)) {
      errors.push('Invalid password (minimum 6 characters)');
    }

    // Return validation result dengan sanitized inputs
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        // Username di-sanitize untuk security
        username: this.sanitize(username),
        // Password TIDAK di-sanitize (dijelaskan di JSDoc)
        password: password
      }
    };
  }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Export Validator class untuk digunakan di seluruh aplikasi
 *
 * Validator adalah static utility class - tidak perlu instantiation.
 * Import dan gunakan methods secara langsung.
 */
module.exports = Validator;

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. LAYERED VALIDATION:
 *    Implementasikan validation di multiple layers:
 *    - Frontend: UI validation untuk UX (immediate feedback)
 *    - Backend: Server-side validation untuk security (never trust client)
 *    - Database: Constraints dan triggers sebagai last line of defense
 *
 *    Class ini adalah untuk backend validation. Frontend juga perlu validasi
 *    serupa untuk better UX.
 *
 * 2. FAIL-FAST PRINCIPLE:
 *    Semua validation methods menggunakan fail-fast approach:
 *    - Null/undefined/empty input langsung return false
 *    - Invalid format langsung return false
 *    - Tidak ada exception throwing (kecuali unexpected errors)
 *
 *    Ini membuat code yang memanggil validator lebih simple dan predictable.
 *
 * 3. ERROR MESSAGES:
 *    Error messages dibuat dalam bahasa Inggris untuk:
 *    - Konsistensi dengan standard development practices
 *    - Kemudahan debugging dan searching
 *    - Internationalization (bisa ditranslate di layer lain)
 *
 *    Untuk user-facing errors, translate error messages di controller/handler.
 *
 * 4. REGEX PERFORMANCE:
 *    - JavaScript engine meng-cache compiled regex
 *    - Inline regex (seperti yang digunakan di class ini) sama performant
 *      dengan regex yang di-define sebagai constant
 *    - Untuk extreme performance needs, consider pre-compiling regex
 *
 * 5. EXTENSIBILITY:
 *    Untuk menambah validasi baru:
 *    ```javascript
 *    static isValidCustomField(value) {
 *      if (!value) return false;
 *      // validation logic
 *      return /pattern/.test(value);
 *    }
 *    ```
 *
 *    Untuk complex validation, buat composite validator:
 *    ```javascript
 *    static validateComplexData(data) {
 *      const errors = [];
 *      if (!this.isValidField1(data.field1)) {
 *        errors.push('Error message 1');
 *      }
 *      // more validations...
 *      return { isValid: errors.length === 0, errors };
 *    }
 *    ```
 *
 * 6. SECURITY CONSIDERATIONS:
 *    - sanitize() adalah basic sanitization, BUKAN silver bullet
 *    - SELALU gunakan parameterized queries untuk database
 *    - SELALU hash password sebelum menyimpan (bcrypt, argon2)
 *    - SELALU validate di server-side (never trust client)
 *    - Consider rate limiting untuk login dan registration endpoints
 *    - Consider CAPTCHA untuk prevent automated attacks
 *
 * 7. NIK & KK VALIDATION LIMITATIONS:
 *    Methods isValidNIK dan isValidKK hanya validasi FORMAT.
 *    Validasi yang TIDAK dilakukan:
 *    - Kebenaran kode wilayah
 *    - Validitas tanggal lahir embedded di NIK
 *    - Keunikan NIK/KK (harus cek database)
 *    - Status aktif NIK/KK di Dukcapil
 *
 *    Untuk validasi lebih mendalam, integrate dengan:
 *    - Database lokal untuk cek duplikasi
 *    - API Dukcapil untuk verifikasi (jika available)
 *
 * 8. DATE VALIDATION:
 *    isValidDate() hanya validasi format dan range, TIDAK validasi:
 *    - Calendar validity (31 Feb tetap pass)
 *    - Leap year rules
 *
 *    Untuk calendar validation yang ketat, gunakan DateParser.isValidBirthDate()
 *    yang menggunakan moment.js untuk validasi proper.
 *
 * 9. PHONE VALIDATION:
 *    isValidPhone() hanya validasi format Indonesia.
 *    Untuk aplikasi internasional:
 *    - Gunakan library seperti libphonenumber-js
 *    - Support multiple country codes
 *    - Validate carrier/operator
 *
 * 10. PASSWORD STRENGTH:
 *     Current implementation (minimal 6 chars) adalah WEAK untuk production.
 *     Untuk production, implement stronger requirements:
 *     ```javascript
 *     static isStrongPassword(password) {
 *       if (!password || password.length < 8) return false;
 *       const hasUpperCase = /[A-Z]/.test(password);
 *       const hasLowerCase = /[a-z]/.test(password);
 *       const hasNumbers = /\d/.test(password);
 *       const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
 *       return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
 *     }
 *     ```
 *
 * 11. TESTING:
 *     Unit test semua validation methods dengan:
 *     - Valid inputs (happy path)
 *     - Invalid inputs (expected failures)
 *     - Edge cases (empty, null, undefined, extremely long, special chars)
 *     - Boundary values (exactly min/max length)
 *
 *     Contoh test cases:
 *     ```javascript
 *     describe('isValidNIK', () => {
 *       it('should accept valid 16-digit NIK', () => {
 *         expect(Validator.isValidNIK('3374051234567890')).toBe(true);
 *       });
 *       it('should reject NIK with less than 16 digits', () => {
 *         expect(Validator.isValidNIK('337405123456')).toBe(false);
 *       });
 *       it('should reject NIK with non-digit characters', () => {
 *         expect(Validator.isValidNIK('337405123456789X')).toBe(false);
 *       });
 *       // more test cases...
 *     });
 *     ```
 *
 * 12. PERFORMANCE MONITORING:
 *     Untuk high-traffic applications, monitor validation performance:
 *     - Track validation time untuk complex validations
 *     - Optimize regex patterns jika bottleneck detected
 *     - Consider caching validation results untuk repeated inputs
 *
 * 13. INTERNATIONALIZATION (I18N):
 *     Saat ini validator specific untuk Indonesia (NIK, KK format).
 *     Untuk multi-country support:
 *     - Parameterize country-specific validations
 *     - Create country-specific validator classes
 *     - Use factory pattern untuk select appropriate validator
 *
 * ============================================================================
 */
