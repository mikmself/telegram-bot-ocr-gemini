/**
 * ============================================================================
 * AUTH SERVICE - LAYANAN AUTENTIKASI DAN MANAJEMEN SESI
 * ============================================================================
 *
 * File: AuthService.js
 * Deskripsi: Service untuk mengelola autentikasi user dan session management
 *            menggunakan in-memory storage (Map) untuk Telegram bot
 *
 * Fitur Utama:
 * - Login/Logout user dengan validasi credentials
 * - In-memory session management menggunakan JavaScript Map
 * - Session expiry otomatis setelah 24 jam inaktivitas
 * - Village code management untuk setiap user session
 * - Auto cleanup expired sessions setiap 1 jam
 * - Activity tracking untuk setiap interaksi user
 * - Session statistics monitoring
 *
 * Teknologi:
 * - JavaScript Map untuk session storage (in-memory)
 * - setInterval untuk periodic cleanup
 * - Async/await untuk database operations
 *
 * Keamanan:
 * - Password validation melalui UserModel
 * - Session expiry 24 jam
 * - Auto cleanup untuk mencegah memory leak
 * - Activity-based session refresh
 * - Isolated sessions per chat ID
 *
 * Dependencies:
 * - UserModel: Autentikasi dan data user dari database
 * - logger: Logging aktivitas dan error
 * - dateParser: (imported tapi tidak digunakan di file ini)
 * - config: (imported tapi tidak digunakan di file ini)
 *
 * Author: Development Team
 * Created: 2024
 * Last Modified: 2025
 *
 * CATATAN PENTING:
 * - Sessions disimpan di memory, akan hilang jika aplikasi restart
 * - Satu chat ID = satu session (user tidak bisa login dari multiple chats)
 * - Session timeout: 24 jam dari lastActivity (bukan loginAt)
 * - Cleanup berjalan setiap 1 jam untuk membersihkan expired sessions
 * - Village code bersifat optional, bisa null jika belum dipilih
 *
 * ============================================================================
 */

const UserModel = require('../database/UserModel');
const logger = require('../utils/logger');
const dateParser = require('../utils/dateParser');
const config = require('../config/env');

/**
 * AuthService Class
 *
 * Class singleton untuk mengelola autentikasi dan session management.
 * Menggunakan Map untuk menyimpan session data di memory.
 *
 * Session Structure:
 * {
 *   userId: number,           // ID user dari database
 *   username: string,         // Username untuk login
 *   nama_lengkap: string,     // Nama lengkap user
 *   level: number,            // User type/role ID
 *   villageCode: string|null, // Kode desa yang dipilih (optional)
 *   villageData: object|null, // Data lengkap desa (optional)
 *   loginAt: Date,            // Waktu login
 *   lastActivity: Date        // Waktu aktivitas terakhir (untuk expiry check)
 * }
 *
 * @class AuthService
 */
class AuthService {
  /**
   * Constructor - Inisialisasi Service
   *
   * Membuat Map untuk session storage dan menjalankan auto cleanup timer.
   *
   * Flow:
   * 1. Inisialisasi Map kosong untuk sessions
   * 2. Setup interval timer untuk cleanup setiap 1 jam
   * 3. Timer akan menjalankan cleanupExpiredSessions() secara periodik
   *
   * CATATAN TEKNIS:
   * - Map dipilih karena performance O(1) untuk get/set/delete
   * - Key: chatId (Telegram chat ID)
   * - Value: session object
   * - Interval 60 menit (3600000ms) untuk balance antara memory dan overhead
   *
   * @constructor
   */
  constructor() {
    // In-memory session storage menggunakan Map
    // Key: chatId (number/string) - Telegram chat ID
    // Value: session object - Data session user
    this.sessions = new Map();

    // Setup auto cleanup untuk expired sessions
    // Berjalan setiap 1 jam (60 * 60 * 1000 ms)
    // Mencegah memory leak dari sessions yang tidak terpakai
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // 3600000 ms = 1 jam
  }

  /**
   * Login User
   *
   * Melakukan autentikasi user dan membuat session baru.
   * Menggantikan session lama jika user sudah login dari chat yang sama.
   *
   * Flow Login:
   * 1. Log attempt untuk security audit
   * 2. Validasi credentials melalui UserModel.authenticate()
   * 3. Jika gagal, return error message
   * 4. Jika sukses, update last_login di database
   * 5. Buat session object dengan data user
   * 6. Simpan session ke Map dengan chatId sebagai key
   * 7. Return success dengan user info
   *
   * Session Behavior:
   * - Jika chatId sudah ada session, akan di-overwrite (re-login)
   * - villageCode dan villageData diset null (harus dipilih lagi)
   * - loginAt dan lastActivity diset ke waktu sekarang
   *
   * Security:
   * - Password tidak di-log untuk keamanan
   * - Failed attempts di-log untuk monitoring
   * - Credentials validation di UserModel (terpisah dari service layer)
   *
   * @async
   * @param {number|string} chatId - Telegram chat ID
   * @param {string} username - Username untuk login
   * @param {string} password - Password user (plain text, akan di-hash di UserModel)
   * @returns {Promise<Object>} Response object
   * @returns {boolean} response.success - Status login
   * @returns {string} response.message - Pesan untuk user
   * @returns {Object} [response.user] - User data jika berhasil
   *
   * @example
   * const result = await authService.login(123456, 'admin', 'pass123');
   * if (result.success) {
   *   console.log(result.user.nama_lengkap);
   * }
   */
  async login(chatId, username, password) {
    try {
      // Log login attempt untuk security monitoring
      // Tidak log password untuk keamanan
      logger.info(`Login attempt for user: ${username}, chat: ${chatId}`);

      // Validasi credentials melalui UserModel
      // UserModel.authenticate() akan:
      // 1. Cari user by username
      // 2. Compare password dengan bcrypt
      // 3. Return user object jika valid, null jika tidak
      const user = await UserModel.authenticate(username, password);

      // Handle failed authentication
      if (!user) {
        logger.warn(`Login failed for user: ${username}`);
        return {
          success: false,
          message: 'Username atau password salah'
        };
      }

      // Update last_login timestamp di database
      // Untuk tracking aktivitas user
      await UserModel.updateLastLogin(user.id);

      // Buat session object
      // Struktur session yang akan disimpan di Map
      const session = {
        userId: user.id,                    // ID dari database
        username: user.username,            // Username
        nama_lengkap: user.name,            // Nama lengkap
        level: user.user_type_id,           // Role/permission level
        villageCode: null,                  // Belum pilih desa, diset null
        villageData: null,                  // Data desa belum ada
        loginAt: new Date(),                // Waktu login
        lastActivity: new Date()            // Waktu aktivitas terakhir
      };

      // Simpan session ke Map
      // Key: chatId (unik per chat)
      // Value: session object
      // Jika chatId sudah ada, akan overwrite (re-login)
      this.sessions.set(chatId, session);

      // Log successful login
      logger.info(`Login successful for user: ${username}, session created for chat: ${chatId}`);

      // Return success response dengan user info
      return {
        success: true,
        message: `Selamat datang, ${user.name}!`,
        user: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.name,
          level: user.user_type_id
        }
      };

    } catch (error) {
      // Handle unexpected errors (database errors, dll)
      logger.error('Error in login:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat login. Silakan coba lagi.'
      };
    }
  }

  /**
   * Logout User
   *
   * Menghapus session user dari memory.
   * Tidak melakukan validasi expiry, langsung delete jika ada.
   *
   * Flow Logout:
   * 1. Log logout attempt
   * 2. Ambil session dari Map
   * 3. Jika session ada, delete dari Map
   * 4. Jika tidak ada, return message belum login
   * 5. Return success/failure response
   *
   * Cleanup Behavior:
   * - Session langsung dihapus dari Map
   * - Semua data session (termasuk villageCode) hilang
   * - User harus login ulang untuk akses sistem
   *
   * CATATAN:
   * - Method ini tidak async tapi dibuat async untuk konsistensi API
   * - Tidak ada database operation, pure in-memory
   * - Tidak perlu check expiry karena akan delete anyway
   *
   * @async
   * @param {number|string} chatId - Telegram chat ID
   * @returns {Promise<Object>} Response object
   * @returns {boolean} response.success - Status logout
   * @returns {string} response.message - Pesan untuk user
   *
   * @example
   * const result = await authService.logout(123456);
   * // { success: true, message: 'Anda telah logout. Sampai jumpa!' }
   */
  async logout(chatId) {
    try {
      // Log logout attempt
      logger.info(`Logout for chat: ${chatId}`);

      // Ambil session dari Map
      // Menggunakan get() untuk check apakah session exists
      const session = this.sessions.get(chatId);

      // Jika session ada, hapus dari Map
      if (session) {
        // Delete session dari Map
        // Map.delete() return true jika key ditemukan dan dihapus
        this.sessions.delete(chatId);

        // Log successful logout
        logger.info(`Session deleted for chat: ${chatId}`);

        return {
          success: true,
          message: 'Anda telah logout. Sampai jumpa!'
        };
      }

      // Session tidak ditemukan = user belum login
      return {
        success: false,
        message: 'Anda belum login.'
      };

    } catch (error) {
      // Handle unexpected errors
      logger.error('Error in logout:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat logout.'
      };
    }
  }

  /**
   * Check Login Status
   *
   * Mengecek apakah user sudah login dan session masih valid.
   * Melakukan auto-cleanup jika session sudah expired.
   * Update lastActivity jika session masih valid (activity-based refresh).
   *
   * Flow Check:
   * 1. Ambil session dari Map
   * 2. Jika session tidak ada, return false
   * 3. Hitung session age dari lastActivity
   * 4. Jika > 24 jam, delete session dan return false
   * 5. Jika masih valid, update lastActivity ke sekarang
   * 6. Return true
   *
   * Session Expiry Logic:
   * - Timeout: 24 jam (86400000 ms)
   * - Dihitung dari lastActivity (bukan loginAt)
   * - Setiap check yang valid akan refresh lastActivity
   * - Expired session otomatis dihapus (lazy deletion)
   *
   * Activity-Based Refresh:
   * - Setiap kali method ini dipanggil dan session valid
   * - lastActivity di-update ke waktu sekarang
   * - Ini membuat session "sliding window" - perpanjang otomatis jika aktif
   *
   * PENTING:
   * - Method ini dipanggil di hampir semua method lain
   * - Berfungsi sebagai guard untuk protected resources
   * - Lazy deletion: expired sessions dihapus saat dicek, bukan di timer
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {boolean} True jika logged in dan valid, false jika tidak
   *
   * @example
   * if (authService.isLoggedIn(chatId)) {
   *   // Session valid, lanjutkan operasi
   * } else {
   *   // Session expired atau belum login
   * }
   */
  isLoggedIn(chatId) {
    // Ambil session dari Map
    const session = this.sessions.get(chatId);

    // Session tidak ada = belum login
    if (!session) {
      return false;
    }

    // Hitung session age dari lastActivity (bukan loginAt)
    const now = new Date();
    const sessionAge = now - session.lastActivity; // Dalam milliseconds

    // Max age: 24 jam = 24 * 60 * 60 * 1000 ms = 86400000 ms
    const maxAge = 24 * 60 * 60 * 1000;

    // Check apakah session sudah expired
    if (sessionAge > maxAge) {
      // Session expired: hapus dari Map (lazy deletion)
      this.sessions.delete(chatId);
      logger.info(`Session expired for chat: ${chatId}`);
      return false;
    }

    // Session masih valid: update lastActivity (sliding window)
    // Setiap activity akan memperpanjang session 24 jam dari sekarang
    session.lastActivity = now;

    return true;
  }

  /**
   * Get Session Data
   *
   * Mengambil session object dari Map dengan validasi expiry.
   * Return null jika session tidak ada atau expired.
   *
   * Flow:
   * 1. Check login status via isLoggedIn() (includes expiry check)
   * 2. Jika tidak valid, return null
   * 3. Jika valid, return session object
   *
   * CATATAN:
   * - Method ini menggunakan isLoggedIn() untuk validasi
   * - lastActivity otomatis ter-update karena isLoggedIn() dipanggil
   * - Return reference langsung ke session object (not a copy)
   * - Caller bisa modify session object (be careful!)
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {Object|null} Session object atau null jika tidak valid
   *
   * @example
   * const session = authService.getSession(chatId);
   * if (session) {
   *   console.log(session.username);
   * }
   */
  getSession(chatId) {
    // Validasi session dengan expiry check
    // isLoggedIn() akan:
    // 1. Check session exists
    // 2. Check expiry (24 jam)
    // 3. Update lastActivity jika valid
    // 4. Delete session jika expired
    if (!this.isLoggedIn(chatId)) {
      return null;
    }

    // Return session object dari Map
    // PENTING: Ini return reference, bukan copy
    return this.sessions.get(chatId);
  }

  /**
   * Get User Information
   *
   * Mengambil informasi user dari session dengan validasi.
   * Return copy of user data (not reference) untuk safety.
   *
   * Flow:
   * 1. Get session via getSession() (includes validation)
   * 2. Jika tidak ada, return null
   * 3. Extract dan return copy of user info
   *
   * Data yang Di-return:
   * - userId: ID user di database
   * - username: Username untuk login
   * - nama_lengkap: Nama lengkap user
   * - level: User type/role ID
   * - villageCode: Kode desa yang dipilih (bisa null)
   * - villageData: Data lengkap desa (bisa null)
   * - loginAt: Waktu login
   * - lastActivity: Waktu aktivitas terakhir
   *
   * Safety:
   * - Return object baru (copy), bukan reference
   * - Caller tidak bisa modify session secara tidak sengaja
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {Object|null} User info object atau null jika tidak login
   *
   * @example
   * const userInfo = authService.getUserInfo(chatId);
   * if (userInfo) {
   *   console.log(`User: ${userInfo.nama_lengkap}, Level: ${userInfo.level}`);
   * }
   */
  getUserInfo(chatId) {
    // Get session dengan validasi
    const session = this.getSession(chatId);

    // Session tidak valid atau tidak ada
    if (!session) {
      return null;
    }

    // Return copy of user info (not reference)
    // Mencegah modification tidak sengaja ke session object
    return {
      userId: session.userId,
      username: session.username,
      nama_lengkap: session.nama_lengkap,
      level: session.level,
      villageCode: session.villageCode,
      villageData: session.villageData,
      loginAt: session.loginAt,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Set Village Code untuk User
   *
   * Menyimpan kode desa dan data desa ke session user.
   * Digunakan setelah user memilih desa untuk processing OCR.
   *
   * Flow:
   * 1. Get session dengan validasi
   * 2. Jika tidak valid, return false
   * 3. Update villageCode dan villageData di session
   * 4. Update lastActivity (activity refresh)
   * 5. Log perubahan
   * 6. Return true
   *
   * Village Code Purpose:
   * - Menyimpan konteks desa yang sedang diproses user
   * - Digunakan untuk validasi data OCR
   * - Persist selama session aktif
   * - Hilang saat logout atau session expired
   *
   * CATATAN:
   * - villageCode: string kode desa (ex: "3201012001")
   * - villageData: object dengan detail desa (nama, kecamatan, etc)
   * - User bisa ganti village code kapan saja
   * - lastActivity di-update untuk refresh session
   *
   * @param {number|string} chatId - Telegram chat ID
   * @param {string} villageCode - Kode desa
   * @param {Object} villageData - Data lengkap desa
   * @returns {boolean} True jika berhasil, false jika session tidak valid
   *
   * @example
   * const success = authService.setVillageCode(
   *   chatId,
   *   '3201012001',
   *   { name: 'Desa ABC', kecamatan: 'Kec XYZ' }
   * );
   */
  setVillageCode(chatId, villageCode, villageData) {
    // Get session dengan validasi
    const session = this.getSession(chatId);

    // Session tidak valid = return false
    if (!session) {
      return false;
    }

    // Update village code dan data di session
    session.villageCode = villageCode;
    session.villageData = villageData;

    // Update lastActivity untuk refresh session
    session.lastActivity = new Date();

    // Log untuk monitoring
    logger.info(`Village code set for user ${session.username}: ${villageCode}`);

    return true;
  }

  /**
   * Get Village Code
   *
   * Mengambil kode desa dari session user.
   * Return null jika session tidak valid atau village code belum diset.
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {string|null} Village code atau null
   *
   * @example
   * const villageCode = authService.getVillageCode(chatId);
   * if (villageCode) {
   *   console.log(`Processing for village: ${villageCode}`);
   * }
   */
  getVillageCode(chatId) {
    // Get session dengan validasi
    const session = this.getSession(chatId);

    // Return villageCode jika session valid, null jika tidak
    return session ? session.villageCode : null;
  }

  /**
   * Get Village Data
   *
   * Mengambil data lengkap desa dari session user.
   * Return null jika session tidak valid atau village data belum diset.
   *
   * CATATAN:
   * - Return reference ke object (not a copy)
   * - Caller bisa modify object (be careful!)
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {Object|null} Village data atau null
   *
   * @example
   * const villageData = authService.getVillageData(chatId);
   * if (villageData) {
   *   console.log(`Village: ${villageData.name}`);
   * }
   */
  getVillageData(chatId) {
    // Get session dengan validasi
    const session = this.getSession(chatId);

    // Return villageData jika session valid, null jika tidak
    return session ? session.villageData : null;
  }

  /**
   * Check Village Code Existence
   *
   * Mengecek apakah user sudah memilih village code.
   * Return false jika session tidak valid atau village code null.
   *
   * Use Case:
   * - Guard untuk operasi yang membutuhkan village code
   * - Validasi sebelum processing OCR
   * - Check apakah user perlu diminta pilih desa dulu
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {boolean} True jika village code sudah diset, false jika belum
   *
   * @example
   * if (!authService.hasVillageCode(chatId)) {
   *   return 'Silakan pilih desa terlebih dahulu dengan /pilihdesa';
   * }
   */
  hasVillageCode(chatId) {
    // Get session dengan validasi
    const session = this.getSession(chatId);

    // Check session valid DAN villageCode tidak null
    return session && session.villageCode !== null;
  }

  /**
   * Require Authentication (Guard)
   *
   * Helper method untuk memvalidasi autentikasi dengan response terstruktur.
   * Digunakan sebagai guard di command handlers untuk protected resources.
   *
   * Flow:
   * 1. Check login status
   * 2. Jika logged in, return success dengan user info
   * 3. Jika tidak, return failure dengan instruction message
   *
   * Use Case:
   * - Guard di awal command handlers
   * - Simplify authentication check + response
   * - Consistent error messages untuk unauthenticated access
   *
   * Response Structure:
   * Success: { success: true, user: {...} }
   * Failure: { success: false, message: '...' }
   *
   * @param {number|string} chatId - Telegram chat ID
   * @returns {Object} Response object dengan status dan data/message
   *
   * @example
   * const auth = authService.requireAuth(chatId);
   * if (!auth.success) {
   *   return auth.message; // Return error message ke user
   * }
   * // Lanjutkan dengan auth.user
   */
  requireAuth(chatId) {
    // Check login status dengan expiry validation
    if (this.isLoggedIn(chatId)) {
      // User authenticated dan session valid
      return {
        success: true,
        user: this.getUserInfo(chatId) // Return user info untuk digunakan caller
      };
    }

    // User tidak authenticated atau session expired
    return {
      success: false,
      message: 'Anda harus login terlebih dahulu.\n\nGunakan perintah:\n/login username password'
    };
  }

  /**
   * Cleanup Expired Sessions (Auto Cleanup)
   *
   * Menghapus semua session yang sudah expired dari Map.
   * Dipanggil otomatis setiap 1 jam oleh timer di constructor.
   *
   * Flow Cleanup:
   * 1. Get current timestamp
   * 2. Iterate semua sessions di Map
   * 3. Hitung session age dari lastActivity
   * 4. Jika > 24 jam, delete dari Map
   * 5. Count dan log jumlah sessions yang dihapus
   *
   * Cleanup Strategy:
   * - Proactive cleanup: Berjalan periodik (setiap 1 jam)
   * - Lazy cleanup: Juga dilakukan saat isLoggedIn() check
   * - Dual strategy mencegah memory leak
   *
   * Why This Needed:
   * - Sessions di Map tidak pernah auto-expire
   * - Without cleanup, memory akan terus bertambah
   * - Inactive users akan memenuhi memory
   * - Cleanup berkala menjaga memory usage tetap rendah
   *
   * Performance:
   * - O(n) complexity, n = jumlah sessions
   * - Acceptable karena:
   *   1. Berjalan di background (setInterval)
   *   2. Hanya setiap 1 jam
   *   3. Typical bot tidak punya ribuan concurrent sessions
   *
   * CATATAN:
   * - Method ini called by setInterval, bukan oleh user
   * - Silent operation (hanya log jika ada yang dihapus)
   * - Tidak throw error untuk menjaga stability timer
   *
   * @returns {void}
   */
  cleanupExpiredSessions() {
    // Get current timestamp untuk comparison
    const now = new Date();

    // Max age: 24 jam dalam milliseconds
    const maxAge = 24 * 60 * 60 * 1000;

    // Counter untuk logging
    let removedCount = 0;

    // Iterate semua entries di Map
    // entries() return iterator of [key, value] pairs
    for (const [chatId, session] of this.sessions.entries()) {
      // Hitung session age dari lastActivity
      const sessionAge = now - session.lastActivity;

      // Check apakah expired
      if (sessionAge > maxAge) {
        // Delete expired session dari Map
        this.sessions.delete(chatId);
        removedCount++;
      }
    }

    // Log hanya jika ada sessions yang dihapus
    // Mengurangi noise di logs
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} expired sessions`);
    }
  }

  /**
   * Get Session Statistics
   *
   * Mengambil statistik tentang sessions yang ada di Map.
   * Berguna untuk monitoring dan debugging.
   *
   * Statistics Returned:
   * - total: Total semua sessions di Map (active + expired)
   * - active: Jumlah sessions yang masih valid (< 24 jam)
   * - expired: Jumlah sessions yang sudah expired (> 24 jam)
   *
   * Use Case:
   * - Monitoring berapa banyak active users
   * - Debugging memory issues
   * - Dashboard/admin panel
   * - Health check endpoint
   *
   * CATATAN:
   * - Method ini tidak delete expired sessions (read-only)
   * - Expired sessions tetap counted sampai cleanup berjalan
   * - Untuk get real-time status, bukan historical data
   *
   * @returns {Object} Statistics object
   * @returns {number} stats.total - Total sessions di Map
   * @returns {number} stats.active - Sessions yang masih valid
   * @returns {number} stats.expired - Sessions yang sudah expired
   *
   * @example
   * const stats = authService.getSessionStats();
   * console.log(`Active: ${stats.active}, Expired: ${stats.expired}`);
   */
  getSessionStats() {
    // Get current timestamp untuk comparison
    const now = new Date();

    // Max age: 24 jam
    const maxAge = 24 * 60 * 60 * 1000;

    // Counters untuk active dan expired sessions
    let activeSessions = 0;
    let expiredSessions = 0;

    // Iterate semua sessions di Map
    // values() return iterator of values only (tidak perlu chatId)
    for (const session of this.sessions.values()) {
      // Hitung session age
      const sessionAge = now - session.lastActivity;

      // Classify sebagai active atau expired
      if (sessionAge <= maxAge) {
        activeSessions++;
      } else {
        expiredSessions++;
      }
    }

    // Return statistics object
    return {
      total: this.sessions.size,      // Total sessions (size of Map)
      active: activeSessions,          // Valid sessions
      expired: expiredSessions         // Expired tapi belum dihapus
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Export singleton instance of AuthService
 *
 * Pattern: Singleton
 * - Hanya satu instance AuthService untuk seluruh aplikasi
 * - Shared sessions Map untuk semua yang import module ini
 * - Cleanup timer hanya berjalan satu kali
 *
 * Why Singleton:
 * - Session storage harus centralized
 * - Tidak boleh ada multiple instances dengan sessions terpisah
 * - Cleanup timer tidak boleh duplicate
 *
 * Usage:
 * const authService = require('./services/AuthService');
 * authService.login(chatId, username, password);
 *
 * CATATAN:
 * - Instance dibuat saat module pertama kali di-require
 * - Constructor langsung executed
 * - Cleanup timer langsung berjalan
 */
module.exports = new AuthService();

// ============================================================================
// CATATAN UNTUK DEVELOPER
// ============================================================================

/**
 * SESSION MANAGEMENT ARCHITECTURE
 * ================================
 *
 * 1. IN-MEMORY STORAGE
 *    - Sessions disimpan di JavaScript Map (in-memory)
 *    - Pros: Super cepat, O(1) operations, simple
 *    - Cons: Hilang saat restart, tidak shared across processes
 *    - Cocok untuk: Single-process bot dengan session temporary
 *
 * 2. SESSION EXPIRY STRATEGY
 *    Menggunakan dual strategy untuk optimal performance:
 *
 *    a) Lazy Deletion (On-Access)
 *       - Check expiry saat isLoggedIn() dipanggil
 *       - Delete session jika sudah expired
 *       - Advantage: Immediate cleanup saat user mencoba akses
 *
 *    b) Proactive Cleanup (Periodic)
 *       - Auto cleanup setiap 1 jam via setInterval
 *       - Scan semua sessions dan delete yang expired
 *       - Advantage: Cleanup inactive sessions yang tidak pernah di-access
 *
 *    Kombinasi keduanya mencegah memory leak secara efektif.
 *
 * 3. SESSION TIMEOUT LOGIC
 *    - Timeout: 24 jam dari LAST ACTIVITY (bukan login time)
 *    - Sliding window: Setiap activity refresh lastActivity
 *    - User yang aktif akan stay logged in indefinitely
 *    - User yang idle 24 jam akan auto logout
 *
 * 4. SECURITY CONSIDERATIONS
 *    - Password TIDAK disimpan di session (hanya di validasi login)
 *    - Session isolated per chatId (tidak bisa cross-access)
 *    - Failed login attempts di-log untuk monitoring
 *    - No session token/JWT (karena Telegram chatId sudah unik)
 *
 * 5. VILLAGE CODE MANAGEMENT
 *    - villageCode optional, bisa null
 *    - Diset setelah user pilih desa via command
 *    - Hilang saat logout atau session expired
 *    - User harus pilih ulang jika re-login
 *
 * 6. SCALABILITY LIMITATIONS
 *    - Single process only (tidak support multi-process/cluster)
 *    - Sessions tidak shared across bot instances
 *    - Max sessions limited by server memory
 *    - Untuk production scale, consider:
 *      * Redis untuk session storage
 *      * Database-backed sessions
 *      * Stateless JWT tokens
 *
 * 7. PERFORMANCE CHARACTERISTICS
 *    - Login: O(1) Map.set + 1 DB query
 *    - Logout: O(1) Map.delete
 *    - Check auth: O(1) Map.get
 *    - Cleanup: O(n) iterate all sessions (acceptable karena hourly)
 *    - Memory: ~1KB per session (estimate)
 *
 * 8. ERROR HANDLING
 *    - Semua async methods wrapped dalam try-catch
 *    - Database errors tidak crash service
 *    - Return structured response (success/failure + message)
 *    - Errors di-log untuk debugging
 *
 * 9. BEST PRACTICES
 *    - Selalu gunakan isLoggedIn() sebelum operasi yang butuh auth
 *    - Gunakan requireAuth() untuk simplified guard logic
 *    - Check hasVillageCode() sebelum operasi yang butuh village
 *    - Update lastActivity setiap kali modify session
 *    - Log important events (login, logout, expiry)
 *
 * 10. MIGRATION PATH (Jika Butuh Scale)
 *     Jika aplikasi perlu scale, migration steps:
 *     a) Implement Redis adapter
 *     b) Wrap Map operations dengan Redis commands
 *     c) Keep same interface (no caller code change)
 *     d) Add session serialization/deserialization
 *     e) Handle Redis connection failures gracefully
 *
 * 11. TESTING CONSIDERATIONS
 *     - Mock time untuk test expiry logic
 *     - Test concurrent logins (same chatId)
 *     - Test session cleanup (manual trigger)
 *     - Test village code persistence
 *     - Test memory leak (long-running test)
 *
 * 12. MONITORING METRICS
 *     Metrics yang berguna untuk production:
 *     - Total active sessions (getSessionStats)
 *     - Login success/failure rate
 *     - Session expiry frequency
 *     - Average session duration
 *     - Memory usage trend
 *     - Cleanup efficiency (expired sessions count)
 */

// ============================================================================
// TROUBLESHOOTING GUIDE
// ============================================================================

/**
 * COMMON ISSUES & SOLUTIONS
 * =========================
 *
 * Q: User complaint "session expired" padahal baru login
 * A: Check:
 *    - Apakah ada multiple bot instances (sessions tidak shared)
 *    - Server clock accuracy (timezone issues)
 *    - Application restart (in-memory sessions hilang)
 *
 * Q: Memory usage terus naik
 * A: Check:
 *    - Cleanup timer berjalan? (log "Cleaned up X sessions")
 *    - Banyak inactive sessions? (getSessionStats)
 *    - Consider tuning cleanup interval atau session timeout
 *
 * Q: User login dari multiple chats
 * A: By design, satu chatId = satu session
 *    - User perlu login di setiap chat
 *    - Sessions isolated per chat
 *    - Ini feature, bukan bug (privacy & security)
 *
 * Q: Village code hilang setelah beberapa waktu
 * A: Kemungkinan:
 *    - Session expired (24 jam idle)
 *    - User logout
 *    - Application restart
 *    - All expected behavior
 *
 * Q: Bagaimana migrate ke Redis?
 * A: Steps:
 *    1. Install ioredis
 *    2. Replace Map dengan Redis commands:
 *       - Map.set -> redis.setex (with TTL)
 *       - Map.get -> redis.get
 *       - Map.delete -> redis.del
 *    3. Serialize/deserialize session objects (JSON)
 *    4. Update expiry logic (Redis TTL-based)
 *    5. Handle Redis connection errors
 *    6. Keep interface sama untuk backward compatibility
 */
