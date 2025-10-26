/**
 * ============================================================================
 * FILE: src/config/env.js
 * ============================================================================
 *
 * DESKRIPSI:
 * File konfigurasi utama aplikasi SmartGov Gemini Bot yang mengelola semua
 * environment variables dan pengaturan sistem. File ini bertindak sebagai
 * central configuration hub yang digunakan oleh seluruh modul aplikasi.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - dotenv: Library untuk memuat environment variables dari file .env
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const config = require('./config/env');
 * console.log(config.telegram.token);
 * console.log(config.database.host);
 * ```
 *
 * CATATAN PENTING:
 * - File ini harus dimuat di awal aplikasi sebelum modul lain
 * - Semua nilai sensitif harus disimpan di file .env (tidak di-commit ke Git)
 * - Setiap konfigurasi memiliki nilai default untuk mencegah error
 * - Gunakan parseInt() untuk nilai numerik dari environment variables
 *
 * ============================================================================
 */

// ============================================================================
// IMPORT DEPENDENCIES
// ============================================================================

/**
 * dotenv - Library untuk memuat environment variables dari file .env
 * Method .config() akan membaca file .env di root direktori dan
 * meng-inject variabelnya ke dalam process.env
 */
require('dotenv').config();

// ============================================================================
// KONFIGURASI APLIKASI
// ============================================================================

/**
 * Object konfigurasi utama yang di-export untuk digunakan di seluruh aplikasi.
 * Setiap section mengelompokkan konfigurasi berdasarkan domain/fungsinya.
 */
module.exports = {

  /**
   * TELEGRAM BOT CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk Telegram Bot API dan mekanisme polling
   */
  telegram: {
    /**
     * Token autentikasi bot dari BotFather
     * @type {string}
     * Cara mendapatkan: Chat dengan @BotFather di Telegram, gunakan /newbot
     * Format: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
     *
     * PENTING: Token ini bersifat rahasia dan memberikan akses penuh ke bot.
     * Jangan pernah commit token ke repository atau share secara publik.
     */
    token: process.env.TELEGRAM_BOT_TOKEN,

    /**
     * Pengaturan polling untuk menerima update dari Telegram
     * Polling adalah metode dimana bot secara berkala mengecek pesan baru
     */
    polling: {
      /**
       * Interval waktu (dalam milliseconds) antara setiap polling request
       * @type {number}
       * Default: 1000ms (1 detik)
       *
       * Nilai yang lebih kecil = response lebih cepat tapi lebih banyak request
       * Nilai yang lebih besar = hemat resource tapi response lebih lambat
       */
      interval: 1000,

      /**
       * Flag untuk memulai polling secara otomatis saat bot diinisialisasi
       * @type {boolean}
       * Default: true
       *
       * Jika false, polling harus dimulai manual dengan bot.startPolling()
       */
      autoStart: true
    }
  },

  /**
   * GOOGLE GEMINI AI CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk Google Generative AI (Gemini) yang digunakan untuk OCR
   */
  gemini: {
    /**
     * API Key untuk mengakses Google Gemini AI
     * @type {string}
     * Cara mendapatkan: https://makersuite.google.com/app/apikey
     *
     * PENTING: API key ini memiliki quota dan billing. Monitor penggunaan
     * untuk menghindari biaya tak terduga atau quota habis.
     */
    apiKey: process.env.GEMINI_API_KEY,

    /**
     * Model Gemini yang digunakan untuk OCR
     * @type {string}
     * Default: 'gemini-2.5-flash'
     *
     * Pilihan model:
     * - gemini-2.5-flash: Paling cepat, cocok untuk OCR sederhana
     * - gemini-2.5-pro: Lebih akurat, lebih lambat, lebih mahal
     * - gemini-1.5-pro: Generasi sebelumnya, lebih stabil
     *
     * CATATAN: Model yang lebih advanced memberikan akurasi lebih tinggi
     * namun memakan waktu dan biaya lebih besar per request.
     */
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },

  /**
   * DATABASE CONFIGURATION (MySQL)
   * ----------------------------------------------------------------------------
   * Konfigurasi koneksi ke database MySQL untuk menyimpan data KK dan user
   */
  database: {
    /**
     * Hostname atau IP address server MySQL
     * @type {string}
     * Default: '127.0.0.1' (localhost)
     *
     * Untuk production gunakan hostname server database yang sebenarnya.
     * Untuk Docker, gunakan nama service container (contoh: 'mysql').
     */
    host: process.env.DB_HOST || '127.0.0.1',

    /**
     * Port MySQL server
     * @type {number}
     * Default: 3320
     * Standard MySQL port: 3306
     *
     * CATATAN: Default di sini adalah 3320, pastikan sesuai dengan
     * port yang dikonfigurasi di MySQL server Anda.
     */
    port: parseInt(process.env.DB_PORT) || 3320,

    /**
     * Nama database yang digunakan
     * @type {string}
     * Default: 'smartgov'
     *
     * Database ini harus sudah dibuat sebelum menjalankan aplikasi.
     * Jalankan script SQL untuk membuat schema dan tabel yang diperlukan.
     */
    database: process.env.DB_DATABASE || 'smartgov',

    /**
     * Username untuk autentikasi database
     * @type {string}
     * Default: 'root'
     *
     * Untuk production, gunakan user dengan privilege minimal yang dibutuhkan
     * (jangan gunakan root user untuk security reasons).
     */
    user: process.env.DB_USERNAME || 'root',

    /**
     * Password untuk autentikasi database
     * @type {string}
     * Default: '' (empty string)
     *
     * PENTING: Gunakan password yang kuat di production.
     * Jangan biarkan password kosong di production environment.
     */
    password: process.env.DB_PASSWORD || '',

    /**
     * Jumlah maksimal koneksi simultan dalam connection pool
     * @type {number}
     * Default: 10
     *
     * Connection pooling meningkatkan performa dengan menggunakan kembali
     * koneksi yang sudah ada daripada membuat koneksi baru setiap query.
     *
     * Pertimbangan:
     * - Nilai terlalu kecil: Bottleneck saat traffic tinggi
     * - Nilai terlalu besar: Beban berlebih pada MySQL server
     * - Sesuaikan dengan kapasitas server dan expected load
     */
    connectionLimit: 10,

    /**
     * Jumlah maksimal request yang mengantri untuk mendapat koneksi
     * @type {number}
     * Default: 0 (unlimited)
     *
     * Jika semua koneksi sedang dipakai, request baru akan mengantri.
     * 0 berarti tidak ada batasan antrian (bisa menyebabkan memory issue).
     * Untuk production, pertimbangkan set nilai tertentu (contoh: 100).
     */
    queueLimit: 0,

    /**
     * Apakah mengantri jika semua koneksi sedang dipakai
     * @type {boolean}
     * Default: true
     *
     * true: Request mengantri sampai ada koneksi available
     * false: Langsung throw error jika tidak ada koneksi available
     */
    waitForConnections: true,

    /**
     * Aktifkan TCP keep-alive untuk mencegah koneksi timeout
     * @type {boolean}
     * Default: true
     *
     * Keep-alive mengirim packet secara berkala untuk menjaga koneksi tetap
     * hidup, berguna untuk koneksi yang idle dalam waktu lama.
     */
    enableKeepAlive: true,

    /**
     * Delay sebelum mengirim keep-alive packet pertama (dalam milliseconds)
     * @type {number}
     * Default: 0 (langsung aktif)
     *
     * 0 berarti keep-alive aktif segera setelah koneksi dibuat.
     */
    keepAliveInitialDelay: 0
  },

  /**
   * REGION API CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk integrasi dengan API wilayah Indonesia (provinsi,
   * kabupaten/kota, kecamatan, kelurahan/desa)
   */
  regionApi: {
    /**
     * Base URL endpoint API wilayah
     * @type {string}
     * Default: 'https://api.example.com'
     *
     * API ini digunakan untuk validasi dan normalisasi kode wilayah
     * pada data Kartu Keluarga. Ganti dengan URL API wilayah yang sebenarnya.
     *
     * Contoh: 'https://wilayah-api.smartgov.id/api/v1'
     */
    url: process.env.REGION_API_URL || 'https://api.example.com',

    /**
     * API Key untuk autentikasi ke Region API
     * @type {string|undefined}
     *
     * Beberapa API wilayah memerlukan API key untuk autentikasi.
     * Jika API yang digunakan tidak memerlukan key, kosongkan saja.
     */
    key: process.env.REGION_API_KEY
  },

  /**
   * SESSION MANAGEMENT CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk pengelolaan session user dan keamanan password
   */
  session: {
    /**
     * Durasi session sebelum expired (dalam jam)
     * @type {number}
     * Default: 24 jam
     *
     * Setelah durasi ini, user harus login ulang.
     * Pertimbangan:
     * - Nilai kecil (1-4 jam): Lebih aman, tapi user sering login ulang
     * - Nilai besar (24-48 jam): Lebih convenient, tapi risiko lebih tinggi
     *
     * Untuk data sensitif seperti kependudukan, disarankan 4-8 jam.
     */
    expireHours: parseInt(process.env.SESSION_EXPIRE_HOURS) || 24,

    /**
     * Jumlah rounds untuk bcrypt hashing
     * @type {number}
     * Default: 10
     *
     * Bcrypt rounds menentukan seberapa 'berat' proses hashing.
     * Setiap increment menggandakan waktu komputasi.
     *
     * Rekomendasi:
     * - 10: Standar, balance antara keamanan dan performa
     * - 12: Lebih aman, sedikit lebih lambat (recommended untuk production)
     * - 8: Lebih cepat, tapi kurang aman (hanya untuk development)
     *
     * CATATAN: Nilai ini tidak bisa diubah setelah password di-hash.
     * Mengubah nilai ini akan membuat password lama tidak bisa diverifikasi.
     */
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },

  /**
   * LOGGING CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk sistem logging menggunakan Winston
   */
  logging: {
    /**
     * Level logging yang akan dicatat
     * @type {string}
     * Default: 'info'
     *
     * Level dari yang paling verbose ke paling strict:
     * - 'debug': Semua informasi termasuk debugging detail
     * - 'info': Informasi umum operasional (recommended untuk production)
     * - 'warn': Hanya warning dan error
     * - 'error': Hanya error
     *
     * Development: Gunakan 'debug' untuk detail lengkap
     * Production: Gunakan 'info' atau 'warn' untuk mengurangi disk usage
     */
    level: process.env.LOG_LEVEL || 'info',

    /**
     * Direktori tempat menyimpan file log
     * @type {string}
     * Default: './logs'
     *
     * Pastikan aplikasi memiliki write permission ke direktori ini.
     * Log file akan dibuat otomatis dengan nama berdasarkan tanggal.
     *
     * Contoh struktur:
     * logs/
     *   ├── error-2025-10-26.log
     *   ├── combined-2025-10-26.log
     *   └── ...
     *
     * CATATAN: Monitor ukuran log file dan setup log rotation untuk
     * mencegah disk penuh.
     */
    dir: process.env.LOG_DIR || './logs'
  },

  /**
   * OCR PROCESSING CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk proses OCR menggunakan Gemini AI
   */
  ocr: {
    /**
     * Threshold minimum confidence score untuk menerima hasil OCR (dalam %)
     * @type {number}
     * Default: 80%
     *
     * Hasil OCR dengan confidence di bawah threshold akan ditolak dan
     * user diminta upload foto yang lebih jelas.
     *
     * Pertimbangan:
     * - Threshold tinggi (90-95%): Lebih akurat, tapi lebih banyak reject
     * - Threshold sedang (80-85%): Balance antara akurasi dan acceptance rate
     * - Threshold rendah (60-70%): Lebih banyak diterima, tapi risiko error tinggi
     *
     * Untuk data kependudukan, disarankan minimal 80% untuk menghindari
     * data error dalam database.
     */
    confidenceThreshold: parseInt(process.env.OCR_CONFIDENCE_THRESHOLD) || 80,

    /**
     * Jumlah maksimal retry jika OCR gagal
     * @type {number}
     * Default: 2
     *
     * Jika OCR gagal (timeout, error API, dll), sistem akan retry sebelum
     * memberikan error final ke user.
     *
     * Nilai 2 berarti total 3 percobaan (1 awal + 2 retry).
     *
     * CATATAN: Setiap retry mengkonsumsi quota Gemini API dan waktu user.
     * Jangan set terlalu tinggi.
     */
    maxRetries: parseInt(process.env.OCR_MAX_RETRIES) || 2,

    /**
     * Timeout untuk request OCR ke Gemini API (dalam milliseconds)
     * @type {number}
     * Default: 30000ms (30 detik)
     *
     * Jika Gemini tidak merespon dalam waktu ini, request dianggap gagal.
     *
     * Pertimbangan:
     * - Gambar besar atau kompleks butuh waktu lebih lama
     * - Koneksi internet lambat juga mempengaruhi
     * - 30 detik adalah balance yang baik antara patience dan responsiveness
     *
     * CATATAN: Jika sering timeout, cek ukuran gambar atau koneksi internet.
     */
    timeout: parseInt(process.env.OCR_TIMEOUT) || 30000
  },

  /**
   * FILE UPLOAD CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi untuk pengelolaan file upload (foto KK)
   */
  upload: {
    /**
     * Ukuran maksimal file yang diizinkan (dalam bytes)
     * @type {number}
     * Default: 10485760 bytes (10 MB)
     *
     * Telegram memiliki batas 20MB untuk foto, tapi kita batasi lebih kecil
     * untuk menghemat bandwidth dan storage.
     *
     * Konversi ukuran:
     * - 5 MB = 5242880 bytes
     * - 10 MB = 10485760 bytes
     * - 20 MB = 20971520 bytes
     *
     * CATATAN: File yang terlalu besar juga memperlambat proses OCR.
     * 10MB sudah cukup untuk foto KK dengan resolusi tinggi.
     */
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,

    /**
     * Direktori temporary untuk menyimpan file upload
     * @type {string}
     * Default: './temp'
     *
     * File foto yang di-upload user akan disimpan sementara di sini
     * sebelum diproses OCR, kemudian dihapus setelah selesai.
     *
     * PENTING:
     * - Pastikan direktori ini ada dan writable
     * - Setup cron job untuk membersihkan file lama (>24 jam)
     * - Monitor disk space, jangan sampai penuh
     *
     * Untuk production, pertimbangkan gunakan:
     * - /tmp untuk Linux (auto-cleanup)
     * - Cloud storage (S3, GCS) untuk scalability
     */
    tempDir: process.env.TEMP_DIR || './temp'
  },

  /**
   * ENVIRONMENT CONFIGURATION
   * ----------------------------------------------------------------------------
   * Konfigurasi environment aplikasi
   */

  /**
   * Environment mode aplikasi
   * @type {string}
   * Default: 'production'
   *
   * Nilai yang valid: 'development', 'production', 'test'
   *
   * Perbedaan behavior:
   * - development: Verbose logging, error details ditampilkan
   * - production: Minimal logging, error generic untuk security
   * - test: Untuk unit testing, mock external services
   */
  env: process.env.NODE_ENV || 'production',

  /**
   * Flag boolean untuk cek apakah dalam mode development
   * @type {boolean}
   *
   * Berguna untuk conditional logic:
   * if (config.isDevelopment) {
   *   console.log('Debug info...');
   * }
   */
  isDevelopment: process.env.NODE_ENV === 'development',

  /**
   * Flag boolean untuk cek apakah dalam mode production
   * @type {boolean}
   *
   * Berguna untuk conditional logic:
   * if (config.isProduction) {
   *   enableStrictMode();
   * }
   */
  isProduction: process.env.NODE_ENV === 'production'
};

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. ENVIRONMENT VARIABLES PRIORITY:
 *    - Nilai di .env file akan override nilai default
 *    - Nilai di system environment akan override .env file
 *    - Urutan: System ENV > .env file > Default value
 *
 * 2. SECURITY BEST PRACTICES:
 *    - Jangan commit file .env ke repository (sudah ada di .gitignore)
 *    - Gunakan .env.example sebagai template untuk .env
 *    - Rotasi API keys dan passwords secara berkala
 *    - Gunakan secrets management untuk production (AWS Secrets Manager, dll)
 *
 * 3. VALIDASI KONFIGURASI:
 *    - Saat startup, aplikasi akan validasi konfigurasi critical
 *    - Jika konfigurasi invalid, aplikasi akan exit dengan error message
 *    - Lihat src/index.js untuk validation logic
 *
 * 4. PERUBAHAN KONFIGURASI:
 *    - Perubahan di file ini memerlukan restart aplikasi
 *    - Gunakan nodemon di development untuk auto-restart
 *    - Di production, gunakan process manager (PM2, systemd)
 *
 * 5. PERFORMANCE TUNING:
 *    - Database connection pool: Sesuaikan dengan load
 *    - OCR timeout: Sesuaikan dengan kecepatan koneksi
 *    - Session expiry: Balance antara security dan UX
 *    - File size limit: Sesuaikan dengan storage capacity
 *
 * 6. MONITORING:
 *    - Monitor log files untuk detect issues
 *    - Track Gemini API usage untuk avoid quota limit
 *    - Monitor database connection pool usage
 *    - Setup alerts untuk disk space temp directory
 *
 * ============================================================================
 */
