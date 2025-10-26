/**
 * ============================================================================
 * FILE: src/utils/dateParser.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Utility class untuk parsing, formatting, dan validasi tanggal menggunakan
 * moment.js. Class ini menangani berbagai format tanggal dari OCR dan
 * menormalisasinya ke format standar aplikasi (DD-MM-YYYY).
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - moment-timezone: Library powerful untuk manipulasi tanggal/waktu
 * - ./logger: Untuk logging warning saat parsing gagal
 *
 * FORMAT STANDAR:
 * - Aplikasi: DD-MM-YYYY (contoh: 17-08-1945)
 * - Database: YYYY-MM-DD (MySQL format)
 * - DateTime: YYYY-MM-DD HH:mm:ss
 *
 * TIMEZONE:
 * Semua operasi tanggal menggunakan timezone Asia/Jakarta (WIB)
 *
 * ============================================================================
 */

const moment = require('moment-timezone');
const logger = require('./logger');

/**
 * Set default timezone ke Asia/Jakarta (WIB)
 *
 * Ini memastikan semua operasi moment.js menggunakan timezone Indonesia,
 * penting untuk:
 * - Timestamp yang konsisten
 * - Session expiry yang akurat
 * - Log timestamp yang sesuai dengan waktu lokal server
 */
moment.tz.setDefault('Asia/Jakarta');

/**
 * Class DateParser
 *
 * Static utility class untuk date parsing dan manipulation.
 * Semua methods adalah static karena tidak memerlukan state.
 */
class DateParser {

  /**
   * Parse tanggal dari berbagai format ke format standar DD-MM-YYYY
   *
   * Method ini mencoba berbagai format tanggal yang umum digunakan di
   * Indonesia dan dalam hasil OCR, kemudian menormalisasinya ke format
   * standar aplikasi.
   *
   * Format yang didukung:
   * - DD-MM-YYYY (sudah standar, langsung return)
   * - DD/MM/YYYY (slash separator)
   * - DD.MM.YYYY (dot separator)
   * - DD MM YYYY (space separator)
   * - YYYY-MM-DD (ISO/MySQL format)
   * - YYYY/MM/DD
   * - DD-MM-YY (2-digit year)
   * - DD/MM/YY
   * - D-M-YYYY (tanpa leading zeros)
   * - D/M/YYYY
   * - D-M-YY
   * - D/M/YY
   *
   * @param {string} dateString - String tanggal yang akan di-parse
   * @returns {string|null} Tanggal dalam format DD-MM-YYYY, null jika gagal
   *
   * @example
   * parse('17/08/1945') // '17-08-1945'
   * parse('1945-08-17') // '17-08-1945'
   * parse('17.08.45') // '17-08-2045' atau '17-08-1945' (tergantung moment logic)
   * parse('invalid') // null (dengan warning log)
   */
  static parse(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const cleaned = dateString.trim();

    // Quick check: jika sudah dalam format DD-MM-YYYY, return langsung
    // Regex: ^\d{2}-\d{2}-\d{4}$ = tepat 2 digit, dash, 2 digit, dash, 4 digit
    if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
      return cleaned;
    }

    // Array format yang akan dicoba secara berurutan
    // Urutan penting: format yang lebih spesifik harus di awal
    const formats = [
      'DD-MM-YYYY',
      'DD/MM/YYYY',
      'DD.MM.YYYY',
      'DD MM YYYY',
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'DD-MM-YY',
      'DD/MM/YY',
      'D-M-YYYY',    // Tanpa leading zeros
      'D/M/YYYY',
      'D-M-YY',
      'D/M/YY'
    ];

    // Coba parse dengan setiap format
    for (const format of formats) {
      // true = strict parsing (harus exact match format)
      const parsed = moment(cleaned, format, true);

      if (parsed.isValid()) {
        // Convert ke format standar DD-MM-YYYY
        return parsed.format('DD-MM-YYYY');
      }
    }

    // Jika semua format gagal, log warning dan return null
    logger.warn(`Failed to parse date: ${dateString}`);
    return null;
  }

  /**
   * Convert tanggal dari format aplikasi (DD-MM-YYYY) ke format MySQL (YYYY-MM-DD)
   *
   * Method ini digunakan sebelum menyimpan tanggal ke database MySQL,
   * karena MySQL menggunakan format DATE standard YYYY-MM-DD.
   *
   * @param {string} dateString - Tanggal dalam format DD-MM-YYYY
   * @returns {string|null} Tanggal dalam format YYYY-MM-DD, null jika invalid
   *
   * @example
   * toMySQLDate('17-08-1945') // '1945-08-17'
   * toMySQLDate('invalid') // null
   */
  static toMySQLDate(dateString) {
    if (!dateString) return null;

    // Parse dengan strict mode untuk memastikan format DD-MM-YYYY
    const parsed = moment(dateString, 'DD-MM-YYYY', true);

    if (parsed.isValid()) {
      // Format ke MySQL DATE format
      return parsed.format('YYYY-MM-DD');
    }

    return null;
  }

  /**
   * Convert tanggal dari format MySQL (YYYY-MM-DD) ke format aplikasi (DD-MM-YYYY)
   *
   * Method ini digunakan setelah membaca tanggal dari database MySQL,
   * untuk ditampilkan ke user atau diproses dalam aplikasi.
   *
   * @param {string} dateString - Tanggal dalam format YYYY-MM-DD
   * @returns {string|null} Tanggal dalam format DD-MM-YYYY, null jika invalid
   *
   * @example
   * fromMySQLDate('1945-08-17') // '17-08-1945'
   * fromMySQLDate('invalid') // null
   */
  static fromMySQLDate(dateString) {
    if (!dateString) return null;

    // Parse dengan strict mode untuk memastikan format YYYY-MM-DD
    const parsed = moment(dateString, 'YYYY-MM-DD', true);

    if (parsed.isValid()) {
      // Format ke aplikasi format
      return parsed.format('DD-MM-YYYY');
    }

    return null;
  }

  /**
   * Mendapatkan tanggal hari ini dalam format aplikasi (DD-MM-YYYY)
   *
   * @returns {string} Tanggal hari ini dalam format DD-MM-YYYY
   *
   * @example
   * now() // '26-10-2025' (jika dipanggil pada 26 Oktober 2025)
   */
  static now() {
    return moment().format('DD-MM-YYYY');
  }

  /**
   * Mendapatkan tanggal dan waktu sekarang dalam format MySQL DATETIME
   *
   * Format: YYYY-MM-DD HH:mm:ss
   * Digunakan untuk timestamp created_at, updated_at, dll.
   *
   * @returns {string} DateTime sekarang dalam format YYYY-MM-DD HH:mm:ss
   *
   * @example
   * nowMySQL() // '2025-10-26 14:30:45'
   */
  static nowMySQL() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Menghitung umur berdasarkan tanggal lahir
   *
   * Method ini menghitung umur dalam tahun penuh (integer) berdasarkan
   * tanggal lahir yang diberikan. Umur dihitung dari tanggal lahir sampai
   * hari ini.
   *
   * @param {string} birthDate - Tanggal lahir dalam format DD-MM-YYYY
   * @returns {number|null} Umur dalam tahun, null jika invalid atau negatif
   *
   * @example
   * calculateAge('17-08-1945') // 80 (jika dipanggil di 2025)
   * calculateAge('01-01-2025') // 0 (jika dipanggil di 2025)
   * calculateAge('01-01-2026') // null (tanggal di masa depan)
   * calculateAge('invalid') // null
   */
  static calculateAge(birthDate) {
    if (!birthDate) return null;

    // Parse tanggal lahir
    const parsed = moment(birthDate, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return null;

    // Hitung difference dalam tahun
    // moment().diff(parsed, 'years') menghitung tahun penuh (integer)
    const age = moment().diff(parsed, 'years');

    // Return age hanya jika >= 0 (tidak boleh negatif)
    // Age negatif berarti tanggal lahir di masa depan
    return age >= 0 ? age : null;
  }

  /**
   * Cek apakah tanggal sudah lewat (in the past)
   *
   * Method ini berguna untuk validasi, misalnya memastikan tanggal lahir
   * atau tanggal dokumen adalah di masa lalu.
   *
   * @param {string} dateString - Tanggal dalam format DD-MM-YYYY
   * @returns {boolean} true jika tanggal sudah lewat, false otherwise
   *
   * @example
   * isInPast('17-08-1945') // true
   * isInPast('01-01-2026') // false
   * isInPast('invalid') // false
   */
  static isInPast(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    // isBefore() checks if parsed date is before now
    return parsed.isBefore(moment());
  }

  /**
   * Validasi apakah tanggal valid sebagai tanggal lahir
   *
   * Validasi:
   * 1. Format harus valid
   * 2. Tanggal harus antara 150 tahun lalu dan hari ini
   *
   * Batas 150 tahun adalah reasonable upper limit untuk umur manusia.
   *
   * @param {string} dateString - Tanggal dalam format DD-MM-YYYY
   * @returns {boolean} true jika valid sebagai tanggal lahir
   *
   * @example
   * isValidBirthDate('01-01-2000') // true
   * isValidBirthDate('01-01-1800') // false (lebih dari 150 tahun lalu)
   * isValidBirthDate('01-01-2026') // false (masa depan)
   * isValidBirthDate('invalid') // false
   */
  static isValidBirthDate(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    // Batas bawah: 150 tahun lalu
    const minDate = moment().subtract(150, 'years');

    // Batas atas: hari ini
    const maxDate = moment();

    // isBetween(min, max, null, '[]')
    // null = granularity (default: milliseconds)
    // '[]' = inclusive (termasuk min dan max)
    return parsed.isBetween(minDate, maxDate, null, '[]');
  }

  /**
   * Format tanggal ke format custom
   *
   * Method flexible untuk formatting tanggal ke berbagai format.
   * Secara default output ke format aplikasi (DD-MM-YYYY).
   *
   * Input bisa dari format aplikasi (DD-MM-YYYY) atau MySQL (YYYY-MM-DD).
   *
   * @param {string} dateString - Tanggal dalam format DD-MM-YYYY atau YYYY-MM-DD
   * @param {string} formatString - Format output (moment.js format tokens)
   * @returns {string} Tanggal dalam format yang diminta, atau string original jika invalid
   *
   * @example
   * format('17-08-1945', 'DD MMMM YYYY') // '17 August 1945'
   * format('1945-08-17', 'dddd, DD/MM/YYYY') // 'Friday, 17/08/1945'
   * format('17-08-1945', 'YYYY') // '1945'
   * format('invalid', 'DD-MM-YYYY') // 'invalid' (return as-is)
   */
  static format(dateString, formatString = 'DD-MM-YYYY') {
    if (!dateString) return '';

    // Coba parse sebagai format aplikasi dulu
    const parsed = moment(dateString, 'DD-MM-YYYY', true);

    if (!parsed.isValid()) {
      // Fallback: coba parse sebagai MySQL format
      const mysqlParsed = moment(dateString, 'YYYY-MM-DD', true);

      if (mysqlParsed.isValid()) {
        return mysqlParsed.format(formatString);
      }

      // Jika kedua format gagal, return original string
      return dateString;
    }

    // Format ke format yang diminta
    return parsed.format(formatString);
  }

  /**
   * Parse tanggal dalam format Indonesia (dengan nama bulan)
   *
   * Format yang didukung: "17 Agustus 1945", "1 Januari 2000"
   *
   * Method ini berguna untuk parsing tanggal dari dokumen atau form
   * yang menggunakan nama bulan Indonesia.
   *
   * @param {string} dateString - Tanggal dalam format Indonesia
   * @returns {string|null} Tanggal dalam format DD-MM-YYYY, null jika gagal
   *
   * @example
   * parseIndonesian('17 Agustus 1945') // '17-08-1945'
   * parseIndonesian('1 Januari 2000') // '01-01-2000'
   * parseIndonesian('invalid') // null
   */
  static parseIndonesian(dateString) {
    if (!dateString) return null;

    // Mapping nama bulan Indonesia ke nomor bulan
    const monthMap = {
      'januari': '01',
      'februari': '02',
      'maret': '03',
      'april': '04',
      'mei': '05',
      'juni': '06',
      'juli': '07',
      'agustus': '08',
      'september': '09',
      'oktober': '10',
      'november': '11',
      'desember': '12'
    };

    const cleaned = dateString.toLowerCase().trim();

    // Regex pattern: <1-2 digit> <whitespace> <word> <whitespace> <4 digit>
    // Contoh: "17 agustus 1945"
    const match = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);

    if (match) {
      // Extract parts
      const day = match[1].padStart(2, '0');  // Pad dengan leading zero jika perlu
      const monthName = match[2];
      const year = match[3];

      // Lookup month number
      const month = monthMap[monthName];

      if (month) {
        // Construct date string
        return `${day}-${month}-${year}`;
      }
    }

    return null;
  }

  /**
   * Menghitung waktu expiry session berdasarkan jam dari sekarang
   *
   * Method ini digunakan untuk session management, menghitung kapan
   * session user akan expired.
   *
   * Output dalam format MySQL DATETIME untuk disimpan di database.
   *
   * @param {number} hours - Jumlah jam dari sekarang (default: 24)
   * @returns {string} Waktu expiry dalam format YYYY-MM-DD HH:mm:ss
   *
   * @example
   * getSessionExpiry(24) // '2025-10-27 14:30:45' (jika now = 2025-10-26 14:30:45)
   * getSessionExpiry(1) // '2025-10-26 15:30:45' (1 jam dari sekarang)
   */
  static getSessionExpiry(hours = 24) {
    // moment().add(hours, 'hours') menambah hours ke waktu sekarang
    return moment().add(hours, 'hours').format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Cek apakah session sudah expired
   *
   * Method ini membandingkan waktu expiry dengan waktu sekarang.
   * Digunakan untuk validasi session user sebelum memproses request.
   *
   * @param {string} expiryTime - Waktu expiry dalam format YYYY-MM-DD HH:mm:ss
   * @returns {boolean} true jika sudah expired atau invalid, false jika masih valid
   *
   * @example
   * isSessionExpired('2025-10-27 14:30:45') // false (jika now < expiry)
   * isSessionExpired('2025-10-25 14:30:45') // true (sudah lewat)
   * isSessionExpired('invalid') // true (dianggap expired)
   * isSessionExpired(null) // true (dianggap expired)
   */
  static isSessionExpired(expiryTime) {
    if (!expiryTime) return true;

    // Parse expiry time dengan strict mode
    const expiry = moment(expiryTime, 'YYYY-MM-DD HH:mm:ss', true);

    // Jika format invalid, anggap expired (untuk security)
    if (!expiry.isValid()) return true;

    // isAfter() checks if now is after expiry
    return moment().isAfter(expiry);
  }
}

module.exports = DateParser;

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. TIMEZONE AWARENESS:
 *    - Semua operasi menggunakan timezone Asia/Jakarta (WIB)
 *    - Untuk aplikasi multi-timezone, perlu modifikasi
 *    - moment.tz.setDefault() mempengaruhi semua operasi moment di app
 *
 * 2. STRICT PARSING:
 *    - Selalu gunakan strict mode (parameter true di moment)
 *    - Strict mode mencegah parsing yang ambiguous
 *    - Contoh: moment('2025', 'DD-MM-YYYY', true) akan invalid
 *
 * 3. FORMAT CONSISTENCY:
 *    - Aplikasi: DD-MM-YYYY (user-facing, lebih familiar untuk Indonesia)
 *    - Database: YYYY-MM-DD (MySQL standard, sortable)
 *    - DateTime: YYYY-MM-DD HH:mm:ss (MySQL DATETIME)
 *
 *    Selalu convert antara format saat boundary (UI <-> Logic <-> DB)
 *
 * 4. 2-DIGIT YEAR AMBIGUITY:
 *    - Format DD-MM-YY bisa ambiguous (45 = 1945 atau 2045?)
 *    - moment.js default: 00-68 = 2000-2068, 69-99 = 1969-1999
 *    - Hindari 2-digit year jika memungkinkan, atau validate context
 *
 * 5. VALIDATION:
 *    - Selalu validate date sebelum operasi critical (save to DB, dll)
 *    - Check isValid() setelah parsing
 *    - Use isValidBirthDate() untuk tanggal lahir
 *    - Check range untuk business logic (contoh: minimal age 17 tahun)
 *
 * 6. PERFORMANCE:
 *    - moment.js relatif heavy (consider day.js untuk alternatif ringan)
 *    - Avoid membuat moment object berulang dalam loop
 *    - Cache hasil parsing jika digunakan multiple times
 *
 * 7. LEAP YEARS & EDGE CASES:
 *    - moment.js handle leap years otomatis
 *    - 29 Februari di non-leap year akan invalid
 *    - Dates seperti 31 April juga invalid (April hanya 30 hari)
 *
 * 8. SESSION EXPIRY:
 *    - Always check expiry sebelum memproses user request
 *    - Gunakan database timestamp untuk avoid clock skew issues
 *    - Consider refresh token mechanism untuk better UX
 *
 * ============================================================================
 */
