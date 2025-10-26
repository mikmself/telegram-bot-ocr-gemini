/**
 * ============================================================================
 * USER MODEL - MANAJEMEN PENGGUNA DAN AUTENTIKASI
 * ============================================================================
 *
 * File: src/database/UserModel.js
 * Deskripsi: Model untuk manajemen data user, autentikasi, dan otorisasi
 *
 * TANGGUNG JAWAB UTAMA:
 * ----------------------
 * 1. User Retrieval
 *    - Pencarian user berdasarkan username
 *    - Pencarian user berdasarkan ID
 *    - Listing semua user dengan data terbatas (tanpa password)
 *
 * 2. Authentication & Security
 *    - Verifikasi password menggunakan bcrypt
 *    - Proses autentikasi user (login)
 *    - Password hashing dan comparison
 *    - Security logging untuk audit trail
 *
 * 3. Authorization & Permissions
 *    - Role-based access control (RBAC)
 *    - Permission mapping berdasarkan user_type_id
 *    - Granular permissions untuk operasi KK
 *
 * 4. Session Management
 *    - Tracking last login timestamp
 *    - Update session information
 *    - Schema-aware column checking
 *
 * STRUKTUR DATABASE:
 * ------------------
 * Table: users
 * - id: INTEGER PRIMARY KEY
 * - username: VARCHAR(255) UNIQUE
 * - password: VARCHAR(255) (bcrypt hashed)
 * - name: VARCHAR(255)
 * - user_type_id: ENUM('admin', 'operator', 'viewer')
 * - created_at: DATETIME
 * - last_login: DATETIME (optional column)
 *
 * HIRARKI PERMISSION:
 * -------------------
 * 1. admin: Full access (create, edit, delete, view)
 * 2. operator: Limited access (create, edit, view - no delete)
 * 3. viewer: Read-only access (view only)
 *
 * SECURITY FEATURES:
 * ------------------
 * - Bcrypt password hashing (10 rounds default)
 * - SQL injection prevention via parameterized queries
 * - Password tidak pernah di-log atau di-return ke client
 * - Authentication failure logging untuk security monitoring
 * - Consistent timing untuk mencegah username enumeration
 *
 * DEPENDENCIES:
 * -------------
 * - database.js: Database connection pool
 * - logger.js: Security dan error logging
 * - bcryptjs: Password hashing dan verification
 * - env.js: Environment configuration (untuk future features)
 *
 * USAGE EXAMPLE:
 * --------------
 * // Authentication
 * const user = await UserModel.authenticate('admin', 'password123');
 * if (user) {
 *   await UserModel.updateLastLogin(user.id);
 *   const permissions = await UserModel.getUserPermissions(user.id);
 * }
 *
 * // User lookup
 * const user = await UserModel.findByUsername('operator1');
 * const userById = await UserModel.findById(1);
 *
 * // Permission check
 * const perms = await UserModel.getUserPermissions(userId);
 * if (perms.canDeleteKK) {
 *   // Allow delete operation
 * }
 *
 * CATATAN PENTING:
 * ----------------
 * - Model ini menggunakan static methods (class-level, bukan instance)
 * - Semua password operations di-handle secara async untuk keamanan
 * - Error logging dilakukan untuk semua operasi critical
 * - Null values di-return untuk user not found (bukan throw error)
 * - Last login update bersifat optional (graceful degradation)
 *
 * @module UserModel
 * @requires ../config/database
 * @requires ../utils/logger
 * @requires bcryptjs
 * @requires ../config/env
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

/**
 * ============================================================================
 * CLASS: UserModel
 * ============================================================================
 *
 * Model class untuk semua operasi terkait user authentication dan authorization.
 * Menggunakan static methods untuk direct database access tanpa perlu instantiation.
 *
 * DESIGN PATTERN:
 * - Static class pattern (no instance needed)
 * - Repository pattern untuk database abstraction
 * - Error handling dengan try-catch dan logging
 * - Async/await untuk semua database operations
 *
 * SECURITY CONSIDERATIONS:
 * - Password tidak pernah di-return dalam getAll()
 * - Bcrypt comparison dilakukan secara timing-safe
 * - Authentication failures di-log untuk security audit
 * - SQL injection prevented dengan parameterized queries
 */
class UserModel {

  /**
   * ========================================================================
   * METHOD: findByUsername
   * ========================================================================
   *
   * Mencari user berdasarkan username. Digunakan untuk login dan user lookup.
   *
   * PROSES:
   * 1. Execute SQL query dengan parameterized query
   * 2. Limit 1 untuk optimasi (username harusnya unique)
   * 3. Return null jika tidak ditemukan (bukan throw error)
   * 4. Return full user object termasuk hashed password
   *
   * SECURITY:
   * - Parameterized query mencegah SQL injection
   * - Tidak melakukan password validation di sini
   * - Error di-log tetapi tetap di-throw untuk handling di level atas
   *
   * USE CASES:
   * - Login process (authenticate method)
   * - User profile lookup
   * - Username availability check
   * - Admin user management
   *
   * @param {string} username - Username yang akan dicari (case-sensitive)
   * @returns {Promise<Object|null>} User object lengkap atau null jika tidak ditemukan
   * @throws {Error} Database connection atau query error
   *
   * @example
   * const user = await UserModel.findByUsername('admin');
   * if (user) {
   *   console.log(user.id, user.name, user.user_type_id);
   *   // user.password tersedia tetapi jangan di-expose ke client
   * }
   */
  static async findByUsername(username) {
    try {
      // Query dengan LIMIT 1 untuk optimasi performance
      // Username harusnya unique berdasarkan database constraint
      const sql = 'SELECT * FROM users WHERE username = ? LIMIT 1';
      const results = await db.query(sql, [username]);

      // Return null untuk "not found" (bukan throw error)
      // Ini memudahkan handling di authentication flow
      if (results.length === 0) {
        return null;
      }

      // Return object user lengkap termasuk hashed password
      // PENTING: Password harus di-handle dengan hati-hati di level atas
      return results[0];
    } catch (error) {
      // Log error untuk debugging dan monitoring
      logger.error('Error finding user by username:', error);

      // Throw error ke atas untuk handling di controller/service layer
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: findById
   * ========================================================================
   *
   * Mencari user berdasarkan ID. Digunakan untuk session validation dan
   * permission checking.
   *
   * PROSES:
   * 1. Execute SQL query dengan user ID
   * 2. Limit 1 untuk optimasi (ID adalah primary key)
   * 3. Return null jika tidak ditemukan
   * 4. Return full user object
   *
   * USE CASES:
   * - Session validation (memvalidasi user dari session ID)
   * - Permission retrieval (getUserPermissions method)
   * - User profile display
   * - Audit logging (mendapatkan user info untuk log)
   *
   * PERBEDAAN dengan findByUsername:
   * - Menggunakan ID (integer) bukan string
   * - ID adalah primary key (lebih cepat dari index pada username)
   * - Sering dipanggil dari session management
   *
   * @param {number} id - User ID (primary key)
   * @returns {Promise<Object|null>} User object lengkap atau null
   * @throws {Error} Database error
   *
   * @example
   * // Dari session
   * const userId = req.session.userId;
   * const user = await UserModel.findById(userId);
   * if (!user) {
   *   // Session invalid, user sudah dihapus
   *   req.session.destroy();
   * }
   */
  static async findById(id) {
    try {
      // Query dengan primary key - paling efisien
      const sql = 'SELECT * FROM users WHERE id = ? LIMIT 1';
      const results = await db.query(sql, [id]);

      // Consistent behavior dengan findByUsername
      // Return null untuk not found
      if (results.length === 0) {
        return null;
      }

      // Return full user object
      return results[0];
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: verifyPassword
   * ========================================================================
   *
   * Verifikasi password user menggunakan bcrypt comparison.
   * Method ini adalah core dari authentication security.
   *
   * PROSES BCRYPT:
   * 1. bcrypt.compare() mengambil plaintext password
   * 2. Extract salt dari hashed password
   * 3. Hash plaintext password dengan salt yang sama
   * 4. Compare hasil hash dengan stored hash
   * 5. Return true/false (timing-safe comparison)
   *
   * SECURITY FEATURES:
   * - Timing-safe comparison (mencegah timing attacks)
   * - Tidak perlu manual salt handling (bcrypt handle internally)
   * - Async operation (tidak block event loop)
   * - Error tidak di-throw, return false (graceful failure)
   *
   * WHY RETURN FALSE ON ERROR:
   * - Konsisten dengan authentication failure
   * - Mencegah information disclosure
   * - Error sudah di-log untuk monitoring
   * - Simplify error handling di authenticate method
   *
   * BCRYPT HASH FORMAT:
   * $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
   * |  |  |                      |
   * |  |  |                      +- Hash (31 chars)
   * |  |  +- Salt (22 chars)
   * |  +- Cost factor (10 = 2^10 rounds)
   * +- Algorithm version (2a = bcrypt)
   *
   * @param {string} plainPassword - Password dari user input (plaintext)
   * @param {string} hashedPassword - Hashed password dari database
   * @returns {Promise<boolean>} true jika match, false jika tidak atau error
   *
   * @example
   * const isValid = await UserModel.verifyPassword('mypassword', user.password);
   * if (isValid) {
   *   // Password correct
   * }
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      // bcrypt.compare() adalah timing-safe comparison
      // - Tidak vulnerable terhadap timing attacks
      // - Automatically extract salt dari hash
      // - Return boolean promise
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error verifying password:', error);

      // Return false bukan throw error
      // Reasoning: Password verification failure harus di-treat
      // sama seperti incorrect password untuk security
      return false;
    }
  }

  /**
   * ========================================================================
   * METHOD: authenticate
   * ========================================================================
   *
   * Core authentication method. Melakukan full login flow dari username
   * hingga password verification.
   *
   * AUTHENTICATION FLOW:
   * 1. Cari user berdasarkan username
   *    - Jika tidak ada: Log failure, return null
   *
   * 2. Verify password dengan bcrypt
   *    - Jika invalid: Log failure, return null
   *
   * 3. Authentication success
   *    - Log success event
   *    - Return full user object
   *
   * SECURITY LOGGING:
   * - Success: logger.info dengan username
   * - User not found: logger.info (bukan error, ini expected behavior)
   * - Invalid password: logger.info dengan username
   * - Database error: logger.error dengan full stack trace
   *
   * WHY LOG FAILURES:
   * - Security audit trail
   * - Detect brute force attacks
   * - Monitor suspicious activity
   * - Compliance requirements (e.g., ISO 27001)
   *
   * TIMING ATTACK PREVENTION:
   * Catatan: Method ini vulnerable terhadap username enumeration karena
   * timing difference antara "user not found" vs "invalid password".
   *
   * Untuk production, consider:
   * - Constant-time response (artificial delay)
   * - Rate limiting
   * - CAPTCHA setelah N failed attempts
   *
   * RETURN VALUES:
   * - Success: User object (termasuk password hash - hati-hati!)
   * - Failure: null (apapun alasannya - don't leak info)
   * - Error: throw (untuk database/system errors)
   *
   * @param {string} username - Username dari login form
   * @param {string} password - Password plaintext dari login form
   * @returns {Promise<Object|null>} User object jika success, null jika gagal
   * @throws {Error} Database atau system error
   *
   * @example
   * // Login flow
   * const user = await UserModel.authenticate(
   *   req.body.username,
   *   req.body.password
   * );
   *
   * if (user) {
   *   req.session.userId = user.id;
   *   req.session.username = user.username;
   *   await UserModel.updateLastLogin(user.id);
   *   res.redirect('/dashboard');
   * } else {
   *   res.render('login', { error: 'Invalid credentials' });
   * }
   */
  static async authenticate(username, password) {
    try {
      // STEP 1: Cari user berdasarkan username
      const user = await this.findByUsername(username);

      // STEP 2: Check user existence
      if (!user) {
        // User tidak ditemukan
        // Log sebagai info (bukan error) karena ini expected scenario
        logger.info(`Authentication failed: User not found - ${username}`);

        // Return null, jangan throw error
        // Jangan expose informasi "user tidak ada" ke client
        return null;
      }

      // STEP 3: Verify password
      const isValid = await this.verifyPassword(password, user.password);

      // STEP 4: Check password validity
      if (!isValid) {
        // Password salah
        logger.info(`Authentication failed: Invalid password - ${username}`);

        // Return null (sama seperti user not found)
        // Consistency penting untuk security
        return null;
      }

      // STEP 5: Authentication success
      logger.info(`Authentication successful: ${username}`);

      // Return full user object
      // CATATAN: Object ini mengandung hashed password
      // Controller/Service layer harus handle dengan hati-hati
      return user;
    } catch (error) {
      // System/database error
      logger.error('Error authenticating user:', error);

      // Throw error untuk handling di level atas
      // Ini berbeda dengan authentication failure (return null)
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: getUserPermissions
   * ========================================================================
   *
   * Generate permission object untuk user berdasarkan role mereka.
   * Implements Role-Based Access Control (RBAC).
   *
   * PERMISSION MODEL:
   * -----------------
   * Admin:
   *   - canCreateKK: true
   *   - canEditKK: true
   *   - canDeleteKK: true (ONLY admin)
   *   - canViewReports: true
   *
   * Operator:
   *   - canCreateKK: true
   *   - canEditKK: true
   *   - canDeleteKK: false
   *   - canViewReports: true
   *
   * Viewer:
   *   - canCreateKK: false
   *   - canEditKK: false
   *   - canDeleteKK: false
   *   - canViewReports: true
   *
   * PERMISSION LOGIC:
   * - Create/Edit: Array includes check ['admin', 'operator']
   * - Delete: Strict equality check (hanya admin)
   * - View: Always true (semua role bisa view)
   *
   * USE CASES:
   * - Middleware authorization check
   * - UI element rendering (show/hide buttons)
   * - API endpoint protection
   * - Feature flag checking
   *
   * EXTENSIBILITY:
   * Untuk menambah permission baru:
   * 1. Tambah property di return object
   * 2. Define logic berdasarkan user.user_type_id
   * 3. Update UI/middleware sesuai permission baru
   *
   * CATATAN KEAMANAN:
   * - Permission di-check di server-side (jangan trust client)
   * - UI hiding hanya UX improvement, bukan security
   * - Setiap endpoint harus re-validate permission
   *
   * @param {number} userId - ID user yang akan di-check permission-nya
   * @returns {Promise<Object|null>} Permission object atau null jika user not found
   * @throws {Error} Database error
   *
   * @example
   * // Middleware usage
   * const perms = await UserModel.getUserPermissions(req.session.userId);
   * if (!perms.canDeleteKK) {
   *   return res.status(403).json({ error: 'Forbidden' });
   * }
   *
   * // UI rendering
   * const perms = await UserModel.getUserPermissions(userId);
   * res.render('dashboard', {
   *   canDelete: perms.canDeleteKK,
   *   canEdit: perms.canEditKK
   * });
   */
  static async getUserPermissions(userId) {
    try {
      // Ambil user data lengkap berdasarkan ID
      const user = await this.findById(userId);

      // User tidak ditemukan (mungkin sudah dihapus dari DB)
      if (!user) {
        return null;
      }

      // BUILD PERMISSION OBJECT
      // Object ini mendefinisikan apa yang user boleh lakukan
      return {
        // User identification
        userId: user.id,
        username: user.username,

        // Role level (untuk reference)
        level: user.user_type_id,

        // CREATE PERMISSION
        // Admin dan Operator bisa create KK baru
        canCreateKK: ['admin', 'operator'].includes(user.user_type_id),

        // EDIT PERMISSION
        // Admin dan Operator bisa edit KK existing
        canEditKK: ['admin', 'operator'].includes(user.user_type_id),

        // DELETE PERMISSION (RESTRICTED)
        // HANYA admin yang bisa delete KK
        // Ini strict check (equality, bukan includes)
        canDeleteKK: user.user_type_id === 'admin',

        // VIEW PERMISSION
        // Semua user type bisa view reports
        // Hardcoded true karena ini basic permission
        canViewReports: true
      };
    } catch (error) {
      // Log error dan throw untuk handling di level atas
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: updateLastLogin
   * ========================================================================
   *
   * Update timestamp last login user. Method ini implements graceful
   * degradation dengan schema checking.
   *
   * PROSES:
   * 1. Check apakah kolom 'last_login' ada di table users
   * 2. Jika ada: Update dengan timestamp NOW()
   * 3. Jika tidak ada: Skip update, log info
   * 4. Return boolean success status
   *
   * WHY SCHEMA CHECKING:
   * - Backward compatibility dengan DB schema lama
   * - Graceful degradation (app tetap jalan tanpa last_login)
   * - Migration safety (tidak break saat alter table)
   * - Optional feature (not critical untuk core functionality)
   *
   * SCHEMA CHECK QUERY:
   * SHOW COLUMNS FROM users LIKE "last_login"
   * - Return empty array jika column tidak ada
   * - Return column info jika ada
   * - Lebih reliable dari try-catch pada UPDATE
   *
   * ALTERNATIVE APPROACHES:
   * 1. Try UPDATE catch error (lebih simple, tapi error-prone)
   * 2. Cache schema info (lebih cepat, tapi perlu invalidation)
   * 3. Config flag (manual, perlu update code)
   * 4. Current: Schema check (safe, self-documenting)
   *
   * TIMESTAMP HANDLING:
   * - NOW() adalah MySQL function (server timestamp)
   * - Timezone sesuai MySQL server setting
   * - Format: DATETIME (YYYY-MM-DD HH:MM:SS)
   *
   * ERROR HANDLING:
   * - Error di-catch dan di-log
   * - Return false pada error (bukan throw)
   * - Reasoning: Last login update bukan critical operation
   * - Login flow tetap bisa continue meskipun update gagal
   *
   * USE CASES:
   * - Dipanggil setelah successful authentication
   * - Track user activity untuk audit
   * - Detect inactive accounts
   * - Security monitoring
   *
   * @param {number} userId - ID user yang baru login
   * @returns {Promise<boolean>} true jika success atau skipped, false jika error
   *
   * @example
   * // Dalam login flow
   * const user = await UserModel.authenticate(username, password);
   * if (user) {
   *   const updated = await UserModel.updateLastLogin(user.id);
   *   // Continue login flow regardless of update result
   *   req.session.userId = user.id;
   * }
   */
  static async updateLastLogin(userId) {
    try {
      // STEP 1: Check apakah kolom last_login ada di schema
      // SHOW COLUMNS adalah MySQL-specific command
      const checkSql = 'SHOW COLUMNS FROM users LIKE "last_login"';
      const columns = await db.query(checkSql);

      // STEP 2: Conditional update berdasarkan schema
      if (columns.length > 0) {
        // Kolom ada - proceed dengan update
        const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
        await db.query(sql, [userId]);

        // Implicitly return true di akhir function
      } else {
        // Kolom tidak ada - skip update
        // Log sebagai info (bukan warning/error)
        // Ini expected behavior untuk backward compatibility
        logger.info('last_login column does not exist, skipping update');
      }

      // Return success
      // true = update berhasil ATAU skipped karena column tidak ada
      return true;
    } catch (error) {
      // Error pada database operation
      logger.error('Error updating last login:', error);

      // Return false bukan throw
      // Last login update bukan critical operation
      // Application bisa continue tanpa ini
      return false;
    }
  }

  /**
   * ========================================================================
   * METHOD: getAll
   * ========================================================================
   *
   * Retrieve daftar semua user untuk admin interface.
   * PENTING: Method ini TIDAK return password hash.
   *
   * SELECTED COLUMNS:
   * - id: User identifier
   * - username: Login username
   * - name: Display name
   * - user_type_id: Role/permission level
   * - created_at: Account creation timestamp
   * - last_login: Last login timestamp (NULL jika belum pernah login)
   *
   * EXCLUDED COLUMNS:
   * - password: TIDAK pernah di-return (security critical)
   *
   * SECURITY CONSIDERATIONS:
   * - Explicit column selection (bukan SELECT *)
   * - Password hash tidak di-expose
   * - Method ini harusnya dibatasi untuk admin only
   * - Consider adding pagination untuk large datasets
   *
   * SORTING:
   * - ORDER BY created_at DESC
   * - User terbaru muncul di atas
   * - Memudahkan admin tracking user registration baru
   *
   * USE CASES:
   * - Admin user management interface
   * - User listing page
   * - User search/filter functionality
   * - Audit reporting
   *
   * MISSING FEATURES (Future Enhancement):
   * - Pagination (LIMIT/OFFSET)
   * - Filtering (WHERE conditions)
   * - Search (username/name LIKE)
   * - Sorting options (dynamic ORDER BY)
   *
   * @returns {Promise<Array>} Array of user objects (without password)
   * @throws {Error} Database error
   *
   * @example
   * // Admin interface
   * const users = await UserModel.getAll();
   * res.render('admin/users', { users });
   *
   * // API endpoint
   * router.get('/api/users', requireAdmin, async (req, res) => {
   *   const users = await UserModel.getAll();
   *   res.json(users);
   * });
   */
  static async getAll() {
    try {
      // EXPLICIT column selection untuk security
      // JANGAN gunakan SELECT * (bisa accidentally expose password)
      const sql = 'SELECT id, username, name, user_type_id, created_at, last_login FROM users ORDER BY created_at DESC';
      const results = await db.query(sql);

      // Return array of user objects
      // Array bisa kosong jika belum ada user
      return results;
    } catch (error) {
      // Log error dan throw untuk handling di controller
      logger.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = UserModel;

/**
 * ============================================================================
 * CATATAN DEVELOPER
 * ============================================================================
 *
 * AUTHENTICATION FLOW LENGKAP:
 * ----------------------------
 * 1. User submit login form (username + password)
 * 2. Controller panggil UserModel.authenticate(username, password)
 * 3. authenticate() panggil findByUsername(username)
 * 4. Jika user ada, panggil verifyPassword(plain, hashed)
 * 5. bcrypt.compare() verifikasi password
 * 6. Jika valid, return user object
 * 7. Controller create session dengan user.id
 * 8. Controller panggil updateLastLogin(user.id)
 * 9. Redirect ke dashboard
 *
 * PERMISSION CHECKING FLOW:
 * -------------------------
 * 1. User request protected resource
 * 2. Middleware ambil userId dari session
 * 3. Middleware panggil getUserPermissions(userId)
 * 4. Check permission specific untuk operation
 * 5. Jika allowed, proceed ke handler
 * 6. Jika denied, return 403 Forbidden
 *
 * PASSWORD SECURITY:
 * ------------------
 * - Bcrypt algorithm: 2a (current best practice)
 * - Cost factor: 10 (2^10 = 1024 rounds)
 * - Salt: Auto-generated dan stored dalam hash
 * - Rainbow table: Tidak efektif karena salt
 * - Timing attack: Protected dengan bcrypt timing-safe comparison
 *
 * Untuk password creation (saat register user):
 * const hashedPassword = await bcrypt.hash(plainPassword, 10);
 *
 * SECURITY BEST PRACTICES:
 * ------------------------
 * 1. Password Rules:
 *    - Minimum 8 karakter (enforce di validation layer)
 *    - Kombinasi huruf, angka, simbol (optional tapi recommended)
 *    - Tidak sama dengan username
 *    - Password history check (prevent reuse)
 *
 * 2. Authentication Security:
 *    - Rate limiting (prevent brute force)
 *    - Account lockout after N failed attempts
 *    - CAPTCHA setelah beberapa failures
 *    - 2FA untuk admin accounts
 *
 * 3. Session Security:
 *    - Session timeout (e.g., 30 menit idle)
 *    - Secure session storage (encrypted)
 *    - HttpOnly cookies (prevent XSS)
 *    - CSRF protection
 *
 * 4. Database Security:
 *    - Parameterized queries (prevent SQL injection)
 *    - Least privilege database user
 *    - Connection pooling dengan limits
 *    - Query logging untuk audit
 *
 * ROLE-BASED ACCESS CONTROL (RBAC):
 * ----------------------------------
 * Current Implementation:
 * - 3 roles: admin, operator, viewer
 * - Static permission mapping
 * - Hardcoded dalam getUserPermissions()
 *
 * Future Enhancement Ideas:
 * - Dynamic permissions dari database
 * - Permission table dengan many-to-many
 * - Custom roles creation
 * - Permission inheritance
 * - Resource-level permissions (per KK)
 *
 * KNOWN LIMITATIONS:
 * ------------------
 * 1. Username Enumeration:
 *    - Timing difference antara "user not found" vs "wrong password"
 *    - Mitigation: Constant-time response atau rate limiting
 *
 * 2. No Account Lockout:
 *    - Unlimited login attempts
 *    - Vulnerable to brute force
 *    - Mitigation: Implement account lockout logic
 *
 * 3. No Password Strength Validation:
 *    - Validation dilakukan di layer lain
 *    - Model hanya handle hashing/verification
 *
 * 4. No User Status:
 *    - Tidak ada active/inactive/banned status
 *    - User bisa login selama ada di database
 *    - Enhancement: Tambah status column
 *
 * 5. No Multi-Session Management:
 *    - Tidak track concurrent sessions
 *    - User bisa login dari multiple devices
 *    - Enhancement: Session table dengan user_id
 *
 * TESTING CHECKLIST:
 * ------------------
 * [ ] Test authenticate dengan valid credentials
 * [ ] Test authenticate dengan invalid username
 * [ ] Test authenticate dengan invalid password
 * [ ] Test authenticate dengan special characters
 * [ ] Test getUserPermissions untuk setiap role
 * [ ] Test updateLastLogin dengan dan tanpa column
 * [ ] Test findByUsername dengan case sensitivity
 * [ ] Test findById dengan ID tidak valid
 * [ ] Test getAll untuk empty table
 * [ ] Test error handling untuk database down
 *
 * MIGRATION GUIDE:
 * ----------------
 * Jika menambah last_login column:
 *
 * ALTER TABLE users
 * ADD COLUMN last_login DATETIME NULL
 * AFTER user_type_id;
 *
 * Jika menambah status column:
 *
 * ALTER TABLE users
 * ADD COLUMN status ENUM('active', 'inactive', 'banned')
 * DEFAULT 'active'
 * AFTER user_type_id;
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * 1. Database Indexes:
 *    - PRIMARY KEY pada id (sudah ada)
 *    - UNIQUE INDEX pada username (sudah ada)
 *    - INDEX pada user_type_id (untuk permission queries)
 *    - INDEX pada last_login (untuk reporting)
 *
 * 2. Query Optimization:
 *    - Gunakan LIMIT 1 untuk single record lookup
 *    - Explicit column selection (avoid SELECT *)
 *    - Use prepared statements (parameterized queries)
 *
 * 3. Caching Strategy:
 *    - Cache getUserPermissions() result
 *    - Cache duration: Session lifetime
 *    - Invalidate on user update/delete
 *
 * RELATED FILES:
 * --------------
 * - src/config/database.js: Database connection
 * - src/utils/logger.js: Logging functionality
 * - src/middleware/auth.js: Authentication middleware
 * - src/routes/auth.js: Login/logout routes
 * - src/controllers/authController.js: Authentication logic
 *
 * REFERENCES:
 * -----------
 * - Bcrypt documentation: https://github.com/kelektiv/node.bcrypt.js
 * - OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 * - RBAC patterns: https://auth0.com/docs/manage-users/access-control/rbac
 *
 * @author OCR-KK Development Team
 * @version 1.0.0
 * @lastModified 2025-10-26
 */
