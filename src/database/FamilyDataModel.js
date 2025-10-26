/**
 * ============================================================================
 * FAMILY DATA MODEL - MODEL DATABASE UNTUK DATA KARTU KELUARGA
 * ============================================================================
 *
 * File: FamilyDataModel.js
 * Path: src/database/FamilyDataModel.js
 * Tujuan: Model untuk mengelola data Kartu Keluarga (KK) dalam database
 *
 * DESKRIPSI:
 * Model ini bertanggung jawab untuk semua operasi database yang berkaitan
 * dengan data Kartu Keluarga. Menyediakan fungsionalitas CRUD lengkap,
 * pencarian, statistik, dan pengelolaan jumlah anggota keluarga.
 *
 * FITUR UTAMA:
 * 1. CRUD Operations (Create, Read, Update, Delete)
 *    - Pencarian berdasarkan nomor KK
 *    - Pembuatan data KK baru
 *    - Update informasi KK
 *    - Penghapusan data KK
 *
 * 2. Member Count Management
 *    - Auto-update total anggota keluarga
 *    - Tracking anggota aktif vs non-aktif
 *    - Sinkronisasi dengan tabel residents
 *
 * 3. Search Functionality
 *    - Pencarian berdasarkan nomor KK (partial match)
 *    - Filter berdasarkan wilayah (village, district)
 *    - Filter berdasarkan status KK
 *
 * 4. Statistics Generation
 *    - Total KK dalam sistem
 *    - Jumlah KK aktif
 *    - Statistik penambahan hari ini
 *    - Statistik penambahan bulan ini
 *
 * 5. Relationship Management
 *    - Relasi dengan ResidentModel (1 KK -> Many Residents)
 *    - Fetch KK beserta semua anggotanya
 *    - Cascade operations untuk konsistensi data
 *
 * STRUKTUR DATA FAMILY:
 * - family_card_number: Nomor KK (16 digit, unique)
 * - province_code: Kode provinsi
 * - regency_code: Kode kabupaten/kota
 * - district_code: Kode kecamatan
 * - village_code: Kode kelurahan/desa
 * - hamlet_code: Kode dusun
 * - community_unit_code: Kode RW
 * - citizen_association_code: Kode RT
 * - address: Alamat lengkap
 * - postal_code: Kode pos
 * - total_members: Total anggota keluarga
 * - active_members: Jumlah anggota yang masih aktif
 * - status: Status KK (active/inactive)
 * - created_at: Timestamp pembuatan
 * - updated_at: Timestamp update terakhir
 *
 * DEPENDENCIES:
 * - database.js: Koneksi dan query executor MySQL
 * - logger.js: Logging untuk tracking operasi dan error
 * - ResidentModel.js: Model terkait untuk data anggota keluarga
 *
 * RELASI DATABASE:
 * family_data (1) <---> (N) residents
 * - One-to-Many: Satu KK memiliki banyak anggota
 * - Foreign Key: residents.family_card_number -> family_data.family_card_number
 * - Cascade: Update member counts ketika ada perubahan di residents
 *
 * CATATAN PENTING:
 * - Semua method bersifat static (class methods)
 * - Menggunakan async/await untuk operasi database
 * - Error handling dengan try-catch dan logging
 * - SQL injection prevention dengan parameterized queries
 * - Member counts harus di-update secara manual setelah perubahan residents
 * - Limit default untuk search adalah 100 records
 *
 * PENGGUNAAN:
 * const FamilyDataModel = require('./database/FamilyDataModel');
 *
 * // Cari KK
 * const family = await FamilyDataModel.findByFamilyCard('3201234567890001');
 *
 * // Buat KK baru
 * const newFamily = await FamilyDataModel.create({ family_card_number: '...' });
 *
 * // Update member counts
 * await FamilyDataModel.updateMemberCounts('3201234567890001');
 *
 * // Get statistik
 * const stats = await FamilyDataModel.getStats();
 *
 * @author OCR-KK System
 * @version 1.0.0
 * @since 2024
 */

// Import dependencies
const db = require('../config/database');       // Database connection dan query executor
const logger = require('../utils/logger');      // Logger untuk tracking dan debugging

/**
 * ============================================================================
 * CLASS: FamilyDataModel
 * ============================================================================
 * Model utama untuk operasi data Kartu Keluarga
 */
class FamilyDataModel {

  /**
   * ========================================================================
   * METHOD: findByFamilyCard
   * ========================================================================
   * Mencari data Kartu Keluarga berdasarkan nomor KK
   *
   * DESKRIPSI:
   * Method ini melakukan pencarian exact match untuk nomor KK tertentu.
   * Hanya mengembalikan 1 record pertama yang ditemukan.
   *
   * BUSINESS LOGIC:
   * - Nomor KK bersifat unique, jadi hanya akan ada 1 hasil max
   * - Jika tidak ditemukan, return null (bukan error)
   * - Digunakan untuk validasi apakah KK sudah ada sebelum create
   *
   * @async
   * @static
   * @param {string} familyCardNumber - Nomor Kartu Keluarga (16 digit)
   *
   * @returns {Promise<Object|null>} Data KK jika ditemukan, null jika tidak ada
   * @returns {number} return.id - Primary key dari tabel family_data
   * @returns {string} return.family_card_number - Nomor KK
   * @returns {string} return.province_code - Kode provinsi
   * @returns {string} return.regency_code - Kode kabupaten/kota
   * @returns {string} return.district_code - Kode kecamatan
   * @returns {string} return.village_code - Kode kelurahan/desa
   * @returns {string} return.hamlet_code - Kode dusun
   * @returns {string} return.community_unit_code - Kode RW
   * @returns {string} return.citizen_association_code - Kode RT
   * @returns {string} return.address - Alamat lengkap
   * @returns {string} return.postal_code - Kode pos
   * @returns {number} return.total_members - Total anggota keluarga
   * @returns {number} return.active_members - Jumlah anggota aktif
   * @returns {string} return.status - Status KK (active/inactive)
   * @returns {Date} return.created_at - Waktu pembuatan record
   * @returns {Date} return.updated_at - Waktu update terakhir
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Cari KK yang ada
   * const family = await FamilyDataModel.findByFamilyCard('3201234567890001');
   * if (family) {
   *   console.log(`KK ditemukan: ${family.address}`);
   * } else {
   *   console.log('KK tidak ditemukan');
   * }
   *
   * @example
   * // Validasi sebelum create
   * const existing = await FamilyDataModel.findByFamilyCard(kkNumber);
   * if (existing) {
   *   throw new Error('KK sudah terdaftar');
   * }
   */
  static async findByFamilyCard(familyCardNumber) {
    try {
      // Query untuk mencari KK berdasarkan nomor
      // LIMIT 1 untuk efisiensi karena nomor KK unique
      const sql = 'SELECT * FROM family_data WHERE family_card_number = ? LIMIT 1';

      // Execute query dengan parameter binding (prevent SQL injection)
      const results = await db.query(sql, [familyCardNumber]);

      // Jika tidak ada hasil, return null
      if (results.length === 0) {
        return null;
      }

      // Return record pertama (seharusnya hanya ada 1)
      return results[0];
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error finding family by family card:', error);

      // Re-throw error agar bisa di-handle oleh caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: create
   * ========================================================================
   * Membuat data Kartu Keluarga baru di database
   *
   * DESKRIPSI:
   * Method ini menambahkan record baru ke tabel family_data.
   * Semua field optional kecuali family_card_number.
   *
   * BUSINESS LOGIC:
   * - family_card_number adalah required dan harus unique
   * - total_members dan active_members default 0 (akan di-update kemudian)
   * - status default 'active'
   * - created_at dan updated_at di-set otomatis oleh NOW()
   * - Semua kode wilayah optional (bisa null)
   *
   * DATA FLOW:
   * 1. Terima data KK dari parameter
   * 2. Build SQL INSERT statement
   * 3. Prepare parameters dengan default values
   * 4. Execute INSERT query
   * 5. Return ID dan nomor KK yang baru dibuat
   * 6. Log operasi untuk audit trail
   *
   * @async
   * @static
   * @param {Object} familyData - Data KK yang akan dibuat
   * @param {string} familyData.family_card_number - Nomor KK (REQUIRED, 16 digit)
   * @param {string} [familyData.province_code] - Kode provinsi
   * @param {string} [familyData.regency_code] - Kode kabupaten/kota
   * @param {string} [familyData.district_code] - Kode kecamatan
   * @param {string} [familyData.village_code] - Kode kelurahan/desa
   * @param {string} [familyData.hamlet_code] - Kode dusun
   * @param {string} [familyData.community_unit_code] - Kode RW
   * @param {string} [familyData.citizen_association_code] - Kode RT
   * @param {string} [familyData.address] - Alamat lengkap
   * @param {string} [familyData.postal_code] - Kode pos
   * @param {number} [familyData.total_members=0] - Total anggota
   * @param {number} [familyData.active_members=0] - Anggota aktif
   * @param {string} [familyData.status='active'] - Status KK
   *
   * @returns {Promise<Object>} Data KK yang baru dibuat
   * @returns {number} return.id - ID auto-generated dari database
   * @returns {string} return.family_card_number - Nomor KK yang dibuat
   *
   * @throws {Error} Jika family_card_number sudah ada (duplicate)
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Create KK baru dengan data minimal
   * const result = await FamilyDataModel.create({
   *   family_card_number: '3201234567890001'
   * });
   * console.log(`KK dibuat dengan ID: ${result.id}`);
   *
   * @example
   * // Create KK dengan data lengkap
   * const result = await FamilyDataModel.create({
   *   family_card_number: '3201234567890001',
   *   province_code: '32',
   *   regency_code: '01',
   *   district_code: '02',
   *   village_code: '001',
   *   address: 'Jl. Merdeka No. 123',
   *   postal_code: '40123',
   *   status: 'active'
   * });
   */
  static async create(familyData) {
    try {
      // SQL INSERT statement
      // Semua field di-list explicitly untuk clarity dan security
      const sql = `
        INSERT INTO family_data (
          family_card_number,
          province_code,
          regency_code,
          district_code,
          village_code,
          hamlet_code,
          community_unit_code,
          citizen_association_code,
          address,
          postal_code,
          total_members,
          active_members,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      // Prepare parameters dengan default values
      // Gunakan || operator untuk fallback ke default value
      const params = [
        familyData.family_card_number,                    // REQUIRED field
        familyData.province_code || null,                 // Optional, default null
        familyData.regency_code || null,                  // Optional, default null
        familyData.district_code || null,                 // Optional, default null
        familyData.village_code || null,                  // Optional, default null
        familyData.hamlet_code || null,                   // Optional, default null
        familyData.community_unit_code || null,           // Optional, default null
        familyData.citizen_association_code || null,      // Optional, default null
        familyData.address || null,                       // Optional, default null
        familyData.postal_code || null,                   // Optional, default null
        familyData.total_members || 0,                    // Default 0 (akan di-update)
        familyData.active_members || 0,                   // Default 0 (akan di-update)
        familyData.status || 'active'                     // Default 'active'
      ];

      // Execute INSERT query
      const result = await db.query(sql, params);

      // Log successful operation untuk audit trail
      logger.info(`Family created: ${familyData.family_card_number}`);

      // Return ID dan nomor KK yang baru dibuat
      return {
        id: result.insertId,                              // Auto-generated primary key
        family_card_number: familyData.family_card_number
      };
    } catch (error) {
      // Log error dengan context untuk debugging
      logger.error('Error creating family:', error);

      // Re-throw error ke caller
      // Bisa jadi duplicate key error atau constraint violation
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: update
   * ========================================================================
   * Mengupdate data Kartu Keluarga yang sudah ada
   *
   * DESKRIPSI:
   * Method ini mengupdate semua field KK kecuali family_card_number.
   * Nomor KK tidak bisa diubah (digunakan sebagai identifier).
   *
   * BUSINESS LOGIC:
   * - family_card_number digunakan sebagai WHERE clause (tidak di-update)
   * - Semua field lain akan di-overwrite dengan nilai baru
   * - updated_at otomatis di-set ke waktu sekarang
   * - Jika field tidak ada di parameter, akan di-set ke default/null
   *
   * DATA FLOW:
   * 1. Terima nomor KK dan data baru
   * 2. Build SQL UPDATE statement
   * 3. Prepare parameters (semua field yang bisa di-update)
   * 4. Execute UPDATE dengan WHERE family_card_number
   * 5. Log operasi untuk audit trail
   * 6. Return true jika berhasil
   *
   * CATATAN:
   * - Method ini tidak mengupdate member counts
   * - Gunakan updateMemberCounts() untuk sync jumlah anggota
   * - Tidak ada validasi apakah KK exist (silent fail jika tidak ada)
   *
   * @async
   * @static
   * @param {string} familyCardNumber - Nomor KK yang akan diupdate
   * @param {Object} familyData - Data baru untuk KK
   * @param {string} [familyData.province_code] - Kode provinsi baru
   * @param {string} [familyData.regency_code] - Kode kabupaten/kota baru
   * @param {string} [familyData.district_code] - Kode kecamatan baru
   * @param {string} [familyData.village_code] - Kode kelurahan/desa baru
   * @param {string} [familyData.hamlet_code] - Kode dusun baru
   * @param {string} [familyData.community_unit_code] - Kode RW baru
   * @param {string} [familyData.citizen_association_code] - Kode RT baru
   * @param {string} [familyData.address] - Alamat baru
   * @param {string} [familyData.postal_code] - Kode pos baru
   * @param {number} [familyData.total_members] - Total anggota baru
   * @param {number} [familyData.active_members] - Anggota aktif baru
   * @param {string} [familyData.status] - Status baru
   *
   * @returns {Promise<boolean>} true jika update berhasil
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Update alamat KK
   * await FamilyDataModel.update('3201234567890001', {
   *   address: 'Jl. Proklamasi No. 45',
   *   postal_code: '40124'
   * });
   *
   * @example
   * // Update status KK menjadi inactive
   * await FamilyDataModel.update('3201234567890001', {
   *   status: 'inactive'
   * });
   */
  static async update(familyCardNumber, familyData) {
    try {
      // SQL UPDATE statement
      // Semua field yang bisa di-update di-list explicitly
      // updated_at otomatis di-set ke NOW()
      const sql = `
        UPDATE family_data
        SET
          province_code = ?,
          regency_code = ?,
          district_code = ?,
          village_code = ?,
          hamlet_code = ?,
          community_unit_code = ?,
          citizen_association_code = ?,
          address = ?,
          postal_code = ?,
          total_members = ?,
          active_members = ?,
          status = ?,
          updated_at = NOW()
        WHERE family_card_number = ?
      `;

      // Prepare parameters dengan default values
      // Order harus match dengan kolom di SQL statement
      const params = [
        familyData.province_code || null,                 // Default null jika tidak ada
        familyData.regency_code || null,
        familyData.district_code || null,
        familyData.village_code || null,
        familyData.hamlet_code || null,
        familyData.community_unit_code || null,
        familyData.citizen_association_code || null,
        familyData.address || null,
        familyData.postal_code || null,
        familyData.total_members || 0,                    // Default 0
        familyData.active_members || 0,                   // Default 0
        familyData.status || 'active',                    // Default 'active'
        familyCardNumber                                   // WHERE clause parameter
      ];

      // Execute UPDATE query
      await db.query(sql, params);

      // Log successful operation
      logger.info(`Family updated: ${familyCardNumber}`);

      // Return true untuk indicate success
      return true;
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error updating family:', error);

      // Re-throw error ke caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: delete
   * ========================================================================
   * Menghapus data Kartu Keluarga dari database
   *
   * DESKRIPSI:
   * Method ini melakukan hard delete terhadap record KK.
   * Operasi ini PERMANENT dan tidak bisa di-undo.
   *
   * BUSINESS LOGIC:
   * - Hard delete (bukan soft delete)
   * - Tidak ada CASCADE automatic ke residents table
   * - Developer harus manually delete residents dulu atau handle orphans
   * - No validation apakah KK masih punya anggota
   *
   * PERINGATAN:
   * - Pastikan hapus semua residents dulu sebelum hapus family
   * - Atau gunakan ON DELETE CASCADE di database schema
   * - Bisa menyebabkan orphaned records di residents table
   * - Tidak ada rollback setelah operasi ini
   *
   * REKOMENDASI:
   * Sebaiknya gunakan soft delete (update status = 'deleted') untuk:
   * - Audit trail
   * - Data recovery
   * - Referential integrity
   *
   * @async
   * @static
   * @param {string} familyCardNumber - Nomor KK yang akan dihapus
   *
   * @returns {Promise<boolean>} true jika delete berhasil
   *
   * @throws {Error} Jika terjadi database error
   * @throws {Error} Jika ada foreign key constraint (residents masih ada)
   *
   * @example
   * // Delete KK (pastikan tidak ada residents)
   * await ResidentModel.deleteByFamilyCard('3201234567890001');
   * await FamilyDataModel.delete('3201234567890001');
   *
   * @example
   * // Soft delete (recommended)
   * await FamilyDataModel.update('3201234567890001', {
   *   status: 'deleted'
   * });
   */
  static async delete(familyCardNumber) {
    try {
      // SQL DELETE statement
      // PERINGATAN: Ini adalah HARD DELETE
      const sql = 'DELETE FROM family_data WHERE family_card_number = ?';

      // Execute DELETE query
      await db.query(sql, [familyCardNumber]);

      // Log operation untuk audit trail
      logger.info(`Family deleted: ${familyCardNumber}`);

      // Return true untuk indicate success
      return true;
    } catch (error) {
      // Log error (bisa jadi foreign key constraint)
      logger.error('Error deleting family:', error);

      // Re-throw error ke caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: getFamilyWithMembers
   * ========================================================================
   * Mengambil data KK beserta semua anggota keluarganya
   *
   * DESKRIPSI:
   * Method ini melakukan JOIN logic antara family_data dan residents.
   * Mengembalikan data KK lengkap dengan array members-nya.
   *
   * BUSINESS LOGIC:
   * - Fetch data KK dulu (single record)
   * - Fetch semua residents dengan KK yang sama
   * - Combine kedua hasil menjadi 1 object
   * - Members di-sort berdasarkan hubungan keluarga dan nama
   *
   * DATA FLOW:
   * 1. Query family_data untuk data KK
   * 2. Jika tidak ada, return null
   * 3. Query residents dengan family_card_number yang sama
   * 4. Combine data: spread family + array members
   * 5. Return combined object
   *
   * SORTING LOGIC:
   * - ORDER BY family_relationship_id: Kepala keluarga dulu (id=1)
   * - Kemudian istri, anak, dll sesuai ID hubungan
   * - ORDER BY name: Jika relationship sama, sort alphabetically
   *
   * RELATIONSHIP:
   * family_data (1) <---> (N) residents
   * - One KK has Many residents
   * - Join condition: family_card_number
   *
   * @async
   * @static
   * @param {string} familyCardNumber - Nomor KK yang dicari
   *
   * @returns {Promise<Object|null>} Data KK dengan array members, null jika tidak ada
   * @returns {number} return.id - ID dari family_data
   * @returns {string} return.family_card_number - Nomor KK
   * @returns {string} return.address - Alamat KK
   * @returns {number} return.total_members - Total anggota
   * @returns {number} return.active_members - Anggota aktif
   * @returns {Array<Object>} return.members - Array anggota keluarga
   * @returns {string} return.members[].nik - NIK anggota
   * @returns {string} return.members[].name - Nama anggota
   * @returns {number} return.members[].family_relationship_id - Hubungan keluarga
   * @returns {string} return.members[].gender - Jenis kelamin
   * @returns {boolean} return.members[].is_active - Status aktif
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Get KK dengan semua anggotanya
   * const family = await FamilyDataModel.getFamilyWithMembers('3201234567890001');
   * console.log(`Alamat: ${family.address}`);
   * console.log(`Jumlah anggota: ${family.members.length}`);
   * family.members.forEach(member => {
   *   console.log(`- ${member.name} (${member.nik})`);
   * });
   *
   * @example
   * // Check apakah KK punya anggota
   * const family = await FamilyDataModel.getFamilyWithMembers('3201234567890001');
   * if (family.members.length === 0) {
   *   console.log('KK ini tidak punya anggota');
   * }
   */
  static async getFamilyWithMembers(familyCardNumber) {
    try {
      // Step 1: Query data KK
      const familySql = 'SELECT * FROM family_data WHERE family_card_number = ? LIMIT 1';
      const familyResults = await db.query(familySql, [familyCardNumber]);

      // Jika KK tidak ditemukan, return null
      if (familyResults.length === 0) {
        return null;
      }

      // Ambil data KK (record pertama)
      const family = familyResults[0];

      // Step 2: Query semua anggota keluarga
      // ORDER BY untuk sorting: kepala keluarga dulu, lalu alphabetical
      const membersSql = `
        SELECT * FROM residents
        WHERE family_card_number = ?
        ORDER BY family_relationship_id, name
      `;
      const members = await db.query(membersSql, [familyCardNumber]);

      // Step 3: Combine data KK dengan members
      // Spread operator untuk copy semua properties dari family
      // Tambah property members sebagai array
      return {
        ...family,      // All family data fields
        members         // Array of residents
      };
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error getting family with members:', error);

      // Re-throw error ke caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: updateMemberCounts
   * ========================================================================
   * Mengupdate jumlah anggota keluarga secara otomatis dari tabel residents
   *
   * DESKRIPSI:
   * Method ini melakukan sinkronisasi antara family_data dan residents.
   * Menghitung ulang total_members dan active_members berdasarkan data actual.
   *
   * BUSINESS LOGIC:
   * - total_members: COUNT semua residents dengan KK ini
   * - active_members: COUNT residents yang is_active = 1
   * - Update dilakukan dengan subquery untuk accuracy
   * - Trigger bisa di-set untuk auto-call method ini
   *
   * WHEN TO CALL:
   * Method ini harus dipanggil setiap kali ada perubahan di residents:
   * 1. Setelah create resident baru
   * 2. Setelah delete resident
   * 3. Setelah update is_active status resident
   * 4. Setelah bulk operations di residents
   *
   * DATA ACCURACY:
   * - Menggunakan subquery untuk real-time counting
   * - Tidak rely on cached values
   * - Atomic operation (1 query untuk 2 field)
   *
   * PERFORMANCE:
   * - Efficient dengan subquery dalam 1 UPDATE statement
   * - Indexed pada family_card_number untuk fast counting
   * - Sebaiknya dipanggil async (tidak block main flow)
   *
   * @async
   * @static
   * @param {string} familyCardNumber - Nomor KK yang akan diupdate
   *
   * @returns {Promise<boolean>} true jika update berhasil
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Update member counts setelah tambah resident
   * await ResidentModel.create(residentData);
   * await FamilyDataModel.updateMemberCounts(residentData.family_card_number);
   *
   * @example
   * // Update member counts setelah delete resident
   * await ResidentModel.delete(nik);
   * await FamilyDataModel.updateMemberCounts(familyCardNumber);
   *
   * @example
   * // Update member counts setelah ubah status
   * await ResidentModel.update(nik, { is_active: 0 });
   * await FamilyDataModel.updateMemberCounts(familyCardNumber);
   */
  static async updateMemberCounts(familyCardNumber) {
    try {
      // SQL UPDATE dengan subqueries untuk counting
      // Subquery 1: COUNT semua residents
      // Subquery 2: COUNT residents yang aktif
      // Parameter yang sama digunakan 3x (untuk 2 subquery + WHERE)
      const sql = `
        UPDATE family_data
        SET
          total_members = (
            SELECT COUNT(*) FROM residents WHERE family_card_number = ?
          ),
          active_members = (
            SELECT COUNT(*) FROM residents WHERE family_card_number = ? AND is_active = 1
          ),
          updated_at = NOW()
        WHERE family_card_number = ?
      `;

      // Execute UPDATE dengan 3 parameters (same value, different positions)
      // Param 1: untuk COUNT total
      // Param 2: untuk COUNT active
      // Param 3: untuk WHERE clause
      await db.query(sql, [familyCardNumber, familyCardNumber, familyCardNumber]);

      // Log operation untuk tracking
      logger.info(`Member counts updated for family: ${familyCardNumber}`);

      // Return true untuk indicate success
      return true;
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error updating member counts:', error);

      // Re-throw error ke caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: search
   * ========================================================================
   * Mencari data Kartu Keluarga dengan berbagai kriteria filter
   *
   * DESKRIPSI:
   * Method ini menyediakan flexible search untuk KK dengan multiple filters.
   * Menggunakan dynamic SQL building berdasarkan criteria yang diberikan.
   *
   * SEARCH CAPABILITIES:
   * 1. family_card_number: Partial match (LIKE %value%)
   * 2. village_code: Exact match
   * 3. district_code: Exact match
   * 4. status: Exact match (active/inactive)
   *
   * BUSINESS LOGIC:
   * - Semua criteria bersifat optional
   * - Jika criteria kosong, return semua (max 100)
   * - Criteria bisa di-combine (AND logic)
   * - Results di-sort descending by created_at (newest first)
   *
   * DYNAMIC SQL:
   * - Base SQL: WHERE 1=1 (untuk easy appending)
   * - Append AND clause sesuai criteria yang ada
   * - Parameters array di-build parallel dengan SQL
   *
   * LIMITATIONS:
   * - Maximum 100 results (LIMIT 100)
   * - Tidak support pagination
   * - Tidak support OR logic
   * - Tidak support sorting custom
   *
   * PERFORMANCE:
   * - Index pada family_card_number untuk LIKE search
   * - Index pada village_code, district_code untuk filter
   * - LIMIT 100 untuk prevent large result set
   *
   * @async
   * @static
   * @param {Object} criteria - Kriteria pencarian
   * @param {string} [criteria.family_card_number] - Nomor KK (partial match)
   * @param {string} [criteria.village_code] - Kode kelurahan (exact match)
   * @param {string} [criteria.district_code] - Kode kecamatan (exact match)
   * @param {string} [criteria.status] - Status KK (exact match)
   *
   * @returns {Promise<Array<Object>>} Array data KK yang match criteria
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Search by nomor KK (partial)
   * const results = await FamilyDataModel.search({
   *   family_card_number: '3201'
   * });
   * // Returns semua KK yang nomornya mengandung '3201'
   *
   * @example
   * // Search by wilayah
   * const results = await FamilyDataModel.search({
   *   district_code: '02',
   *   village_code: '001'
   * });
   * // Returns KK di kecamatan 02, kelurahan 001
   *
   * @example
   * // Search by status
   * const results = await FamilyDataModel.search({
   *   status: 'active'
   * });
   * // Returns semua KK yang aktif
   *
   * @example
   * // Combine multiple criteria
   * const results = await FamilyDataModel.search({
   *   village_code: '001',
   *   status: 'active',
   *   family_card_number: '32'
   * });
   */
  static async search(criteria) {
    try {
      // Base SQL dengan WHERE 1=1 untuk easy dynamic appending
      let sql = 'SELECT * FROM family_data WHERE 1=1';

      // Array untuk parameter binding
      const params = [];

      // Append filter: family_card_number (LIKE untuk partial match)
      if (criteria.family_card_number) {
        sql += ' AND family_card_number LIKE ?';
        params.push(`%${criteria.family_card_number}%`);  // Wrap dengan % untuk LIKE
      }

      // Append filter: village_code (exact match)
      if (criteria.village_code) {
        sql += ' AND village_code = ?';
        params.push(criteria.village_code);
      }

      // Append filter: district_code (exact match)
      if (criteria.district_code) {
        sql += ' AND district_code = ?';
        params.push(criteria.district_code);
      }

      // Append filter: status (exact match)
      if (criteria.status) {
        sql += ' AND status = ?';
        params.push(criteria.status);
      }

      // Append ORDER BY dan LIMIT
      // Sort by created_at DESC: newest records first
      // LIMIT 100: prevent excessive results
      sql += ' ORDER BY created_at DESC LIMIT 100';

      // Execute dynamic SQL dengan parameters
      const results = await db.query(sql, params);

      // Return array results (bisa kosong jika tidak ada match)
      return results;
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error searching families:', error);

      // Re-throw error ke caller
      throw error;
    }
  }

  /**
   * ========================================================================
   * METHOD: getStats
   * ========================================================================
   * Mengambil statistik data Kartu Keluarga untuk dashboard/reporting
   *
   * DESKRIPSI:
   * Method ini menghitung berbagai metrik statistik tentang KK dalam sistem.
   * Digunakan untuk dashboard admin, reporting, dan monitoring.
   *
   * STATISTICS GENERATED:
   * 1. total: Total semua KK di database
   * 2. active: Total KK dengan status 'active'
   * 3. today: Total KK yang dibuat hari ini
   * 4. month: Total KK yang dibuat bulan ini
   *
   * BUSINESS LOGIC:
   * - Semua stats dihitung real-time (tidak cached)
   * - Menggunakan aggregate functions (COUNT)
   * - Date filtering dengan MySQL functions
   * - 4 separate queries untuk clarity dan flexibility
   *
   * DATE CALCULATIONS:
   * - CURDATE(): Current date (tanpa time)
   * - YEAR(NOW()): Current year
   * - MONTH(NOW()): Current month
   * - DATE(created_at): Extract date part dari timestamp
   *
   * PERFORMANCE:
   * - 4 queries berjalan sequential (bisa di-optimize dengan JOIN)
   * - Index pada created_at untuk fast date filtering
   * - Index pada status untuk fast filtering
   * - Cocok untuk cron job atau scheduled tasks
   *
   * USE CASES:
   * - Dashboard admin (total KK, growth rate)
   * - Daily reports (penambahan hari ini)
   * - Monthly reports (trend bulanan)
   * - Health monitoring (active vs inactive)
   *
   * @async
   * @static
   *
   * @returns {Promise<Object>} Object berisi berbagai statistik
   * @returns {number} return.total - Total semua KK
   * @returns {number} return.active - Total KK aktif
   * @returns {number} return.today - Total KK dibuat hari ini
   * @returns {number} return.month - Total KK dibuat bulan ini
   *
   * @throws {Error} Jika terjadi database error
   *
   * @example
   * // Get stats untuk dashboard
   * const stats = await FamilyDataModel.getStats();
   * console.log(`Total KK: ${stats.total}`);
   * console.log(`KK Aktif: ${stats.active}`);
   * console.log(`Penambahan Hari Ini: ${stats.today}`);
   * console.log(`Penambahan Bulan Ini: ${stats.month}`);
   *
   * @example
   * // Calculate growth rate
   * const stats = await FamilyDataModel.getStats();
   * const growthRate = (stats.today / stats.total) * 100;
   * console.log(`Growth rate hari ini: ${growthRate.toFixed(2)}%`);
   *
   * @example
   * // Check active ratio
   * const stats = await FamilyDataModel.getStats();
   * const activeRatio = (stats.active / stats.total) * 100;
   * console.log(`Ratio KK aktif: ${activeRatio.toFixed(2)}%`);
   */
  static async getStats() {
    try {
      // Query 1: Total semua KK
      const totalSql = 'SELECT COUNT(*) as total FROM family_data';
      const totalResult = await db.query(totalSql);

      // Query 2: Total KK dengan status 'active'
      const activeSql = 'SELECT COUNT(*) as active FROM family_data WHERE status = "active"';
      const activeResult = await db.query(activeSql);

      // Query 3: Total KK yang dibuat hari ini
      // DATE(created_at) = CURDATE(): Compare hanya date part (ignore time)
      const todaySql = 'SELECT COUNT(*) as today FROM family_data WHERE DATE(created_at) = CURDATE()';
      const todayResult = await db.query(todaySql);

      // Query 4: Total KK yang dibuat bulan ini
      // Filter by YEAR dan MONTH untuk akurasi
      const monthSql = 'SELECT COUNT(*) as month FROM family_data WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
      const monthResult = await db.query(monthSql);

      // Combine semua results menjadi 1 object
      // Extract nilai dari result[0] karena COUNT return single row
      return {
        total: totalResult[0].total,      // Total KK
        active: activeResult[0].active,   // KK aktif
        today: todayResult[0].today,      // Penambahan hari ini
        month: monthResult[0].month       // Penambahan bulan ini
      };
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error getting family stats:', error);

      // Re-throw error ke caller
      throw error;
    }
  }
}

// Export model untuk digunakan di bagian lain aplikasi
module.exports = FamilyDataModel;

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * USAGE PATTERNS:
 *
 * 1. CREATE NEW FAMILY:
 *    const result = await FamilyDataModel.create({
 *      family_card_number: '3201234567890001',
 *      address: 'Jl. Merdeka No. 123',
 *      status: 'active'
 *    });
 *
 * 2. ADD RESIDENT THEN UPDATE COUNTS:
 *    await ResidentModel.create(residentData);
 *    await FamilyDataModel.updateMemberCounts(familyCardNumber);
 *
 * 3. GET FAMILY WITH ALL MEMBERS:
 *    const family = await FamilyDataModel.getFamilyWithMembers(kkNumber);
 *    console.log(`Total anggota: ${family.members.length}`);
 *
 * 4. SEARCH FAMILIES:
 *    const results = await FamilyDataModel.search({
 *      village_code: '001',
 *      status: 'active'
 *    });
 *
 * 5. DELETE FAMILY (WITH CASCADE):
 *    await ResidentModel.deleteByFamilyCard(kkNumber);
 *    await FamilyDataModel.delete(kkNumber);
 *
 * ============================================================================
 * RELATIONSHIP MANAGEMENT:
 * ============================================================================
 *
 * FamilyDataModel <---> ResidentModel:
 *
 * 1. One-to-Many Relationship:
 *    - 1 KK memiliki banyak residents
 *    - family_card_number adalah foreign key di residents
 *
 * 2. Operations Order:
 *    CREATE:
 *      a. Create family first
 *      b. Create residents
 *      c. Update member counts
 *
 *    DELETE:
 *      a. Delete residents first
 *      b. Delete family
 *
 *    UPDATE:
 *      a. Update family data
 *      b. Update residents if needed
 *      c. Update member counts
 *
 * 3. Data Consistency:
 *    - Always call updateMemberCounts after residents operations
 *    - Consider using database triggers for auto-update
 *    - Validate family exists before creating residents
 *
 * ============================================================================
 * PERFORMANCE OPTIMIZATION:
 * ============================================================================
 *
 * 1. Database Indexes:
 *    - PRIMARY KEY on id
 *    - UNIQUE INDEX on family_card_number
 *    - INDEX on village_code, district_code (for search)
 *    - INDEX on status (for filtering)
 *    - INDEX on created_at (for stats and sorting)
 *
 * 2. Query Optimization:
 *    - Use LIMIT to prevent large result sets
 *    - Use specific columns instead of SELECT *
 *    - Use parameterized queries (prevent SQL injection)
 *
 * 3. Caching Strategy:
 *    - Cache getStats() results for dashboard (refresh every 5 min)
 *    - Cache search results for common queries
 *    - Invalidate cache on create/update/delete
 *
 * 4. Batch Operations:
 *    - Consider bulk insert for multiple families
 *    - Use transactions for consistency
 *    - Batch updateMemberCounts for multiple families
 *
 * ============================================================================
 * ERROR HANDLING:
 * ============================================================================
 *
 * 1. Common Errors:
 *    - Duplicate family_card_number (1062)
 *    - Foreign key constraint (1451/1452)
 *    - Connection timeout
 *    - Invalid data type
 *
 * 2. Error Handling Pattern:
 *    try {
 *      // Database operation
 *    } catch (error) {
 *      logger.error('Context:', error);
 *      throw error;  // Re-throw for caller to handle
 *    }
 *
 * 3. Validation:
 *    - Validate family_card_number format (16 digits)
 *    - Check family exists before update/delete
 *    - Validate status values ('active'/'inactive')
 *
 * ============================================================================
 * SECURITY CONSIDERATIONS:
 * ============================================================================
 *
 * 1. SQL Injection Prevention:
 *    - ALWAYS use parameterized queries
 *    - NEVER concatenate user input into SQL
 *    - Validate and sanitize all inputs
 *
 * 2. Data Access Control:
 *    - Implement authorization checks in routes
 *    - Log all data access for audit
 *    - Mask sensitive data in logs
 *
 * 3. Data Privacy:
 *    - family_card_number adalah PII (Personal Identifiable Information)
 *    - Implement encryption for sensitive fields
 *    - Follow GDPR/data privacy regulations
 *
 * ============================================================================
 * TESTING RECOMMENDATIONS:
 * ============================================================================
 *
 * 1. Unit Tests:
 *    - Test each method dengan valid/invalid inputs
 *    - Mock database untuk isolated testing
 *    - Test error handling paths
 *
 * 2. Integration Tests:
 *    - Test dengan real database
 *    - Test relationship dengan ResidentModel
 *    - Test cascade operations
 *
 * 3. Test Cases:
 *    - Create dengan data minimal
 *    - Create dengan data lengkap
 *    - Update partial fields
 *    - Delete dengan/tanpa residents
 *    - Search dengan berbagai kombinasi criteria
 *    - updateMemberCounts accuracy
 *    - getFamilyWithMembers dengan 0/many members
 *
 * ============================================================================
 * FUTURE IMPROVEMENTS:
 * ============================================================================
 *
 * 1. Features:
 *    - Soft delete support (add deleted_at field)
 *    - Pagination untuk search results
 *    - Advanced search (OR logic, ranges, etc)
 *    - Export to Excel/PDF
 *    - Import dari CSV/Excel
 *
 * 2. Performance:
 *    - Implement caching layer
 *    - Use read replicas untuk queries
 *    - Optimize getStats() dengan single query
 *    - Add database connection pooling
 *
 * 3. Architecture:
 *    - Move to repository pattern
 *    - Add service layer untuk business logic
 *    - Implement event system untuk auto-updates
 *    - Add data validation layer
 *
 * 4. Monitoring:
 *    - Add performance metrics
 *    - Track slow queries
 *    - Monitor member count accuracy
 *    - Alert on data inconsistencies
 *
 * ============================================================================
 */
