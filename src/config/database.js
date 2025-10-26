/**
 * ============================================================================
 * FILE: src/config/database.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Module pengelolaan koneksi database MySQL menggunakan connection pooling.
 * File ini menyediakan fungsi-fungsi untuk mengelola koneksi database,
 * menjalankan query, dan menangani transaksi dengan aman dan efisien.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - mysql2/promise: Driver MySQL dengan Promise API untuk async/await
 * - ./env: Konfigurasi database (host, port, credentials, dll)
 * - ../utils/logger: Logging utility untuk mencatat aktivitas database
 *
 * KONSEP PENTING:
 *
 * 1. CONNECTION POOLING:
 *    Menggunakan pool koneksi untuk meningkatkan performa dengan cara
 *    menggunakan kembali koneksi yang sudah ada daripada membuat koneksi
 *    baru setiap kali ada query. Ini mengurangi overhead dan meningkatkan
 *    throughput aplikasi.
 *
 * 2. TRANSACTION MANAGEMENT:
 *    Menyediakan fungsi untuk menjalankan multiple queries dalam satu
 *    transaksi dengan ACID compliance (Atomicity, Consistency, Isolation,
 *    Durability). Jika salah satu query gagal, semua perubahan di-rollback.
 *
 * 3. PREPARED STATEMENTS:
 *    Menggunakan prepared statements untuk mencegah SQL injection dan
 *    meningkatkan performa query yang sering dijalankan.
 *
 * CARA PENGGUNAAN:
 *
 * // Query sederhana
 * const users = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
 *
 * // Menggunakan transaction
 * await db.executeTransaction(async (conn) => {
 *   await db.queryInTransaction(conn, 'INSERT INTO users ...', [params]);
 *   await db.queryInTransaction(conn, 'INSERT INTO logs ...', [params]);
 * });
 *
 * ============================================================================
 */

// ============================================================================
// IMPORT DEPENDENCIES
// ============================================================================

/**
 * mysql2/promise - MySQL driver dengan Promise API
 *
 * Menggunakan mysql2 (bukan mysql) karena:
 * - Performa lebih cepat (native prepared statements)
 * - Support Promise/async-await natively
 * - Support untuk features MySQL terbaru
 * - Aktif dimaintain dengan bug fixes reguler
 */
const mysql = require('mysql2/promise');

/**
 * config - Konfigurasi database dari environment variables
 * Berisi: host, port, database name, credentials, dan pool settings
 */
const config = require('./env');

/**
 * logger - Winston logger untuk mencatat aktivitas database
 * Digunakan untuk debugging, monitoring, dan audit trail
 */
const logger = require('../utils/logger');

// ============================================================================
// MODULE-LEVEL VARIABLES
// ============================================================================

/**
 * Pool koneksi database (singleton pattern)
 * @type {mysql.Pool|null}
 *
 * Disimpan sebagai module-level variable untuk memastikan hanya ada
 * satu pool instance di seluruh aplikasi. Null di awal, akan dibuat
 * saat pertama kali dibutuhkan (lazy initialization).
 *
 * CATATAN: Menggunakan let (bukan const) karena nilai akan berubah
 * dari null ke Pool instance, dan kembali ke null saat pool ditutup.
 */
let pool = null;

// ============================================================================
// CONNECTION POOL MANAGEMENT
// ============================================================================

/**
 * Membuat connection pool ke database MySQL
 *
 * Connection pool adalah kumpulan koneksi database yang sudah dibuat
 * sebelumnya dan siap digunakan. Ketika aplikasi butuh koneksi:
 * 1. Ambil koneksi dari pool (jika tersedia)
 * 2. Gunakan untuk query
 * 3. Kembalikan ke pool (bukan ditutup)
 * 4. Koneksi bisa digunakan lagi untuk request berikutnya
 *
 * Keuntungan connection pooling:
 * - Mengurangi latency (tidak perlu handshake setiap query)
 * - Mengurangi overhead di MySQL server
 * - Mengontrol jumlah koneksi simultan
 * - Menangani connection errors dengan graceful
 *
 * @returns {mysql.Pool} Pool instance yang sudah dibuat atau yang sudah ada
 *
 * @example
 * const pool = createPool();
 * const connection = await pool.getConnection();
 */
const createPool = () => {
  // Jika pool sudah ada, return pool yang sama (singleton pattern)
  // Ini mencegah pembuatan multiple pools yang bisa menghabiskan resources
  if (pool) {
    return pool;
  }

  // Membuat pool baru dengan konfigurasi dari env.js
  pool = mysql.createPool({
    /**
     * Host MySQL server (hostname atau IP address)
     * Contoh: 'localhost', '127.0.0.1', 'mysql.example.com'
     */
    host: config.database.host,

    /**
     * Port MySQL server (default MySQL: 3306)
     */
    port: config.database.port,

    /**
     * Nama database yang akan digunakan
     * Database ini harus sudah dibuat sebelumnya
     */
    database: config.database.database,

    /**
     * Username untuk autentikasi ke MySQL
     */
    user: config.database.user,

    /**
     * Password untuk autentikasi ke MySQL
     */
    password: config.database.password,

    /**
     * Jumlah maksimal koneksi dalam pool
     *
     * Jika semua 10 koneksi sedang dipakai dan ada request ke-11:
     * - Jika waitForConnections=true: Request mengantri
     * - Jika waitForConnections=false: Error langsung di-throw
     */
    connectionLimit: config.database.connectionLimit,

    /**
     * Batas maksimal antrian untuk mendapatkan koneksi
     *
     * 0 = unlimited (bisa berbahaya jika traffic sangat tinggi)
     * Nilai tertentu (contoh: 100) = batasi antrian untuk prevent memory overflow
     */
    queueLimit: config.database.queueLimit,

    /**
     * Apakah mengantri jika tidak ada koneksi available
     *
     * true: Request akan menunggu sampai ada koneksi free
     * false: Langsung throw error jika tidak ada koneksi
     */
    waitForConnections: config.database.waitForConnections,

    /**
     * Aktifkan TCP keep-alive untuk koneksi
     *
     * Keep-alive mengirim packet kecil secara berkala untuk:
     * - Deteksi koneksi yang terputus
     * - Mencegah timeout dari firewall/load balancer
     * - Menjaga koneksi tetap alive saat idle
     */
    enableKeepAlive: config.database.enableKeepAlive,

    /**
     * Delay sebelum mengirim keep-alive pertama (ms)
     *
     * 0 = langsung aktif setelah koneksi dibuat
     */
    keepAliveInitialDelay: config.database.keepAliveInitialDelay
  });

  // Log informasi pool yang dibuat (untuk debugging dan monitoring)
  // CATATAN: Tidak log password untuk security reasons
  logger.info('MySQL connection pool created', {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database
  });

  return pool;
};

/**
 * Mendapatkan koneksi dari pool
 *
 * Fungsi ini mengambil satu koneksi dari pool untuk digunakan.
 * Koneksi HARUS di-release setelah selesai digunakan dengan
 * connection.release() agar bisa digunakan lagi oleh request lain.
 *
 * Flow eksekusi:
 * 1. Cek apakah pool sudah dibuat, jika belum maka buat dulu
 * 2. Ambil koneksi dari pool (akan menunggu jika semua koneksi sedang dipakai)
 * 3. Return koneksi untuk digunakan
 *
 * @async
 * @returns {Promise<mysql.PoolConnection>} Koneksi database yang siap digunakan
 * @throws {Error} Jika gagal mendapatkan koneksi (misalnya database down)
 *
 * @example
 * const connection = await getConnection();
 * try {
 *   const [rows] = await connection.execute('SELECT * FROM users');
 * } finally {
 *   connection.release(); // PENTING: Jangan lupa release!
 * }
 */
const getConnection = async () => {
  // Lazy initialization: Buat pool jika belum ada
  // Ini berguna karena pool baru dibuat saat pertama kali dibutuhkan
  if (!pool) {
    createPool();
  }

  try {
    // Ambil koneksi dari pool
    // Jika semua koneksi sedang dipakai, akan menunggu sesuai konfigurasi
    const connection = await pool.getConnection();

    // Log untuk debugging (hanya di level debug, tidak akan muncul di production)
    logger.debug('Database connection acquired');

    return connection;
  } catch (error) {
    // Log error dengan detail untuk troubleshooting
    // Error umum:
    // - ER_ACCESS_DENIED_ERROR: Credentials salah
    // - ECONNREFUSED: MySQL server tidak running
    // - ER_BAD_DB_ERROR: Database tidak ada
    logger.error('Failed to get database connection:', error);
    throw error;
  }
};

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * Menjalankan SQL query dengan prepared statement
 *
 * Fungsi helper untuk menjalankan query dengan cara yang aman dan mudah.
 * Koneksi akan otomatis di-acquire dari pool dan di-release setelah selesai.
 *
 * KEAMANAN: Menggunakan prepared statements (parameterized queries) untuk
 * mencegah SQL injection. JANGAN PERNAH concat user input langsung ke SQL!
 *
 * Flow eksekusi:
 * 1. Ambil koneksi dari pool
 * 2. Execute query dengan parameters
 * 3. Release koneksi kembali ke pool (di blok finally)
 * 4. Return hasil query
 *
 * @async
 * @param {string} sql - Query SQL dengan placeholder (?)
 * @param {Array} params - Array parameter untuk mengganti placeholder
 * @returns {Promise<Array>} Hasil query (rows untuk SELECT, info untuk INSERT/UPDATE/DELETE)
 * @throws {Error} Jika query gagal (syntax error, constraint violation, dll)
 *
 * @example
 * // SELECT query
 * const users = await query('SELECT * FROM users WHERE age > ?', [18]);
 *
 * // INSERT query
 * const result = await query(
 *   'INSERT INTO users (name, email) VALUES (?, ?)',
 *   ['John Doe', 'john@example.com']
 * );
 * console.log(result.insertId); // ID record yang baru dibuat
 *
 * // UPDATE query
 * const result = await query(
 *   'UPDATE users SET status = ? WHERE id = ?',
 *   ['active', 123]
 * );
 * console.log(result.affectedRows); // Jumlah rows yang diupdate
 */
const query = async (sql, params = []) => {
  // Ambil koneksi dari pool
  const connection = await getConnection();

  try {
    // Execute query dengan prepared statement
    // connection.execute() menggunakan native prepared statements
    // yang lebih aman dan efisien daripada connection.query()
    //
    // Return format: [rows, fields]
    // - rows: Array hasil query atau info object (insertId, affectedRows, dll)
    // - fields: Metadata kolom (jarang digunakan, makanya di-destructure hanya rows)
    const [results] = await connection.execute(sql, params);

    return results;
  } catch (error) {
    // Log error dengan detail SQL query (untuk debugging)
    // CATATAN: Tidak log params untuk security (bisa contain sensitive data)
    logger.error('Database query error:', { sql, error: error.message });

    // Re-throw error agar caller bisa handle
    // Error umum:
    // - ER_DUP_ENTRY: Duplicate key (unique constraint violation)
    // - ER_NO_REFERENCED_ROW: Foreign key constraint violation
    // - ER_PARSE_ERROR: SQL syntax error
    throw error;
  } finally {
    // PENTING: Release koneksi kembali ke pool
    // Ini akan selalu dijalankan, baik query sukses maupun error
    // Jika lupa release, koneksi akan "bocor" dan pool bisa kehabisan koneksi
    connection.release();
  }
};

/**
 * Menguji koneksi ke database
 *
 * Fungsi ini digunakan saat aplikasi startup untuk memastikan database
 * bisa diakses sebelum bot mulai menerima request dari user.
 *
 * Flow eksekusi:
 * 1. Ambil koneksi dari pool
 * 2. Kirim ping ke MySQL server
 * 3. Release koneksi
 * 4. Return true jika sukses, false jika gagal
 *
 * @async
 * @returns {Promise<boolean>} true jika koneksi berhasil, false jika gagal
 *
 * @example
 * const isConnected = await testConnection();
 * if (!isConnected) {
 *   console.error('Cannot connect to database!');
 *   process.exit(1);
 * }
 */
const testConnection = async () => {
  try {
    // Ambil koneksi dari pool
    const connection = await getConnection();

    // Ping MySQL server untuk cek apakah masih alive
    // Ping adalah perintah ringan yang cepat dan tidak membebani server
    await connection.ping();

    // Release koneksi kembali ke pool
    connection.release();

    // Log success untuk monitoring
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    // Log error detail untuk troubleshooting
    // Error disini biasanya berarti:
    // - MySQL server tidak running
    // - Credentials salah
    // - Network issue
    // - Database tidak ada
    logger.error('Database connection test failed:', error);
    return false;
  }
};

/**
 * Menutup connection pool
 *
 * Fungsi ini dipanggil saat aplikasi shutdown untuk menutup semua koneksi
 * dengan graceful. Penting untuk dipanggil saat shutdown agar tidak ada
 * koneksi yang "hanging" di MySQL server.
 *
 * Flow eksekusi:
 * 1. Cek apakah pool ada
 * 2. Tunggu semua koneksi aktif selesai
 * 3. Tutup semua koneksi
 * 4. Set pool ke null
 *
 * @async
 * @returns {Promise<void>}
 *
 * @example
 * // Di shutdown handler
 * process.on('SIGTERM', async () => {
 *   await closePool();
 *   process.exit(0);
 * });
 */
const closePool = async () => {
  // Cek apakah pool ada (jika null berarti sudah ditutup atau belum dibuat)
  if (pool) {
    try {
      // pool.end() akan:
      // 1. Menunggu semua koneksi yang sedang dipakai selesai
      // 2. Menutup semua koneksi idle
      // 3. Menutup pool
      await pool.end();

      // Set pool ke null agar createPool() bisa membuat pool baru jika dipanggil lagi
      pool = null;

      // Log untuk monitoring
      logger.info('MySQL connection pool closed');
    } catch (error) {
      // Log jika ada error saat menutup pool
      // Biasanya tidak critical karena ini dipanggil saat shutdown
      logger.error('Error closing connection pool:', error);
    }
  }
};

// ============================================================================
// TRANSACTION MANAGEMENT
// ============================================================================

/**
 * Menjalankan multiple queries dalam satu transaksi
 *
 * Transaksi database memastikan bahwa sekelompok operasi database
 * berjalan secara atomic (semua sukses atau semua gagal).
 *
 * ACID Properties:
 * - Atomicity: Semua operasi sukses atau semua di-rollback
 * - Consistency: Database tetap dalam state valid
 * - Isolation: Transaksi tidak interfere dengan transaksi lain
 * - Durability: Perubahan permanen setelah commit
 *
 * Flow eksekusi:
 * 1. Ambil koneksi dari pool
 * 2. BEGIN TRANSACTION
 * 3. Jalankan callback dengan koneksi
 * 4. Jika sukses: COMMIT (simpan perubahan)
 * 5. Jika error: ROLLBACK (batalkan semua perubahan)
 * 6. Release koneksi kembali ke pool
 *
 * @async
 * @param {Function} callback - Fungsi async yang menerima connection sebagai parameter
 * @returns {Promise<any>} Nilai return dari callback
 * @throws {Error} Error dari callback akan di-propagate setelah rollback
 *
 * @example
 * // Transfer uang antar rekening (classic transaction example)
 * await executeTransaction(async (conn) => {
 *   // Kurangi saldo rekening A
 *   await queryInTransaction(
 *     conn,
 *     'UPDATE accounts SET balance = balance - ? WHERE id = ?',
 *     [100, accountA]
 *   );
 *
 *   // Tambah saldo rekening B
 *   await queryInTransaction(
 *     conn,
 *     'UPDATE accounts SET balance = balance + ? WHERE id = ?',
 *     [100, accountB]
 *   );
 *
 *   // Jika salah satu query error, kedua operasi di-rollback
 * });
 *
 * @example
 * // Insert KK dengan anggota keluarga
 * const familyId = await executeTransaction(async (conn) => {
 *   // Insert data KK
 *   const kkResult = await queryInTransaction(
 *     conn,
 *     'INSERT INTO family_data (...) VALUES (...)',
 *     [...]
 *   );
 *
 *   // Insert semua anggota keluarga
 *   for (const member of members) {
 *     await queryInTransaction(
 *       conn,
 *       'INSERT INTO residents (...) VALUES (...)',
 *       [kkResult.insertId, ...]
 *     );
 *   }
 *
 *   return kkResult.insertId;
 * });
 */
const executeTransaction = async (callback) => {
  // Ambil koneksi dari pool
  const connection = await getConnection();

  try {
    // BEGIN TRANSACTION
    // Semua query setelah ini akan menjadi bagian dari transaksi
    await connection.beginTransaction();
    logger.debug('Transaction started');

    // Jalankan callback yang berisi logic business
    // Callback menerima connection sebagai parameter untuk menjalankan queries
    const result = await callback(connection);

    // COMMIT TRANSACTION
    // Simpan semua perubahan ke database secara permanen
    await connection.commit();
    logger.debug('Transaction committed');

    // Return hasil dari callback
    return result;

  } catch (error) {
    // ROLLBACK TRANSACTION
    // Batalkan semua perubahan yang sudah dilakukan dalam transaksi
    // Database akan kembali ke state sebelum BEGIN TRANSACTION
    await connection.rollback();

    // Log error untuk debugging
    logger.error('Transaction rolled back due to error:', error.message);

    // Re-throw error agar caller bisa handle
    throw error;

  } finally {
    // PENTING: Release koneksi kembali ke pool
    // Ini akan selalu dijalankan, baik transaksi sukses maupun rollback
    connection.release();
  }
};

/**
 * Menjalankan query dalam konteks transaksi
 *
 * Fungsi helper untuk menjalankan query di dalam transaksi.
 * Berbeda dengan query() biasa, fungsi ini:
 * - Tidak acquire/release koneksi (menggunakan koneksi yang diberikan)
 * - Digunakan di dalam executeTransaction()
 * - Tidak auto-commit (tunggu sampai transaction di-commit)
 *
 * @async
 * @param {mysql.PoolConnection} connection - Koneksi yang sedang dalam transaksi
 * @param {string} sql - Query SQL dengan placeholder (?)
 * @param {Array} params - Array parameter untuk mengganti placeholder
 * @returns {Promise<Array>} Hasil query
 * @throws {Error} Jika query gagal
 *
 * @example
 * await executeTransaction(async (conn) => {
 *   const result1 = await queryInTransaction(
 *     conn,
 *     'INSERT INTO users (name) VALUES (?)',
 *     ['John']
 *   );
 *
 *   await queryInTransaction(
 *     conn,
 *     'INSERT INTO logs (user_id, action) VALUES (?, ?)',
 *     [result1.insertId, 'created']
 *   );
 * });
 */
const queryInTransaction = async (connection, sql, params = []) => {
  try {
    // Execute query menggunakan koneksi yang diberikan
    // Koneksi ini sedang dalam state transaction, jadi query
    // tidak akan langsung di-commit ke database
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    // Log error untuk debugging
    logger.error('Transaction query error:', { sql, error: error.message });

    // Throw error agar transaction di-rollback
    throw error;
  }
};

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  /**
   * Membuat connection pool (jarang dipanggil langsung, biasanya auto-created)
   */
  createPool,

  /**
   * Mendapatkan koneksi dari pool (untuk advanced use cases)
   */
  getConnection,

  /**
   * Menjalankan query sederhana (most commonly used)
   */
  query,

  /**
   * Test koneksi database (dipanggil saat startup)
   */
  testConnection,

  /**
   * Menutup pool (dipanggil saat shutdown)
   */
  closePool,

  /**
   * Menjalankan transaksi (untuk multiple related queries)
   */
  executeTransaction,

  /**
   * Query dalam transaksi (digunakan di dalam executeTransaction callback)
   */
  queryInTransaction,

  /**
   * Getter untuk mengakses pool instance (untuk advanced debugging)
   * Menggunakan getter agar pool selalu return nilai terbaru
   */
  get pool() {
    return pool;
  }
};

/**
 * ============================================================================
 * CATATAN PENTING UNTUK DEVELOPER
 * ============================================================================
 *
 * 1. CONNECTION LEAKS:
 *    Selalu release koneksi setelah selesai digunakan!
 *    Jika lupa release, pool akan kehabisan koneksi dan aplikasi hang.
 *
 *    GOOD:
 *    const conn = await getConnection();
 *    try {
 *      await conn.execute(...);
 *    } finally {
 *      conn.release(); // SELALU di blok finally
 *    }
 *
 *    BAD:
 *    const conn = await getConnection();
 *    await conn.execute(...);
 *    conn.release(); // Tidak akan jalan jika execute() error!
 *
 * 2. SQL INJECTION PREVENTION:
 *    JANGAN PERNAH concat user input ke SQL string!
 *
 *    GOOD:
 *    query('SELECT * FROM users WHERE email = ?', [userEmail]);
 *
 *    BAD:
 *    query(`SELECT * FROM users WHERE email = '${userEmail}'`);
 *    // Vulnerable: userEmail bisa = "' OR '1'='1"
 *
 * 3. TRANSACTION USAGE:
 *    Gunakan transaction untuk operasi yang harus atomic:
 *    - Insert ke multiple tables yang related
 *    - Update yang harus konsisten
 *    - Delete cascade manual
 *
 *    Jangan gunakan transaction untuk:
 *    - Single query (overhead tanpa benefit)
 *    - Long-running operations (lock database)
 *    - Query yang tidak related
 *
 * 4. ERROR HANDLING:
 *    Semua database errors di-throw ke caller.
 *    Caller harus handle error dengan appropriate:
 *    - Retry untuk transient errors
 *    - User-friendly message untuk permanent errors
 *    - Logging untuk debugging
 *
 * 5. PERFORMANCE TIPS:
 *    - Gunakan indexes untuk kolom yang sering di-query
 *    - Batasi hasil dengan LIMIT jika tidak butuh semua
 *    - Gunakan SELECT kolom spesifik (bukan SELECT *)
 *    - Monitor slow queries di MySQL slow query log
 *    - Adjust connection pool size sesuai load
 *
 * 6. MONITORING:
 *    Monitor metrics berikut:
 *    - Connection pool usage (jika sering penuh, naikkan limit)
 *    - Query execution time (optimize slow queries)
 *    - Transaction rollback rate (investigate causes)
 *    - Connection errors (database health)
 *
 * ============================================================================
 */
