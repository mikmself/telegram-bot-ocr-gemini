/**
 * ============================================================================
 * RESIDENT MODEL - DATABASE ACCESS LAYER
 * ============================================================================
 *
 * File: ResidentModel.js
 * Path: c:\Users\Irga\Desktop\ocr-kk\src\database\ResidentModel.js
 *
 * Deskripsi:
 * Model database untuk mengelola data penduduk (residents) dalam sistem OCR KK.
 * Model ini menangani semua operasi CRUD dan query terkait data penduduk individu,
 * termasuk pencarian, statistik, dan operasi bulk dengan transaction.
 *
 * Fitur Utama:
 * - CRUD operations (Create, Read, Update, Delete) untuk data penduduk
 * - Pencarian penduduk berdasarkan NIK atau nomor KK
 * - Bulk create dengan database transaction untuk atomicity
 * - Dynamic search dengan multiple criteria
 * - Statistik penduduk (total, gender distribution, new registrations)
 * - Soft delete support melalui field is_active
 * - Foreign key relationship dengan tabel family_data
 *
 * Database Schema Dependencies:
 * - Tabel: residents (primary table)
 * - Foreign Keys:
 *   - family_card_number → family_data.no_kk
 *   - family_relationship_id → family_relationships.id
 *   - religion_id → religions.id
 *   - education_id → educations.id
 *   - occupation_id → occupations.id
 *   - marital_status_id → marital_statuses.id
 *   - citizenship_id → citizenships.id
 *   - age_category_id → age_categories.id
 *   - blood_type_id → blood_types.id
 *   - province_code → provinces.code
 *   - regency_code → regencies.code
 *   - district_code → districts.code
 *   - village_code → villages.code
 *
 * Struktur Data Penduduk:
 * - Identitas: NIK, nama, tempat/tanggal lahir, jenis kelamin, umur
 * - Keluarga: nomor KK, hubungan keluarga, nama ayah/ibu
 * - Lokasi: kode provinsi/kabupaten/kecamatan/kelurahan, RT/RW, alamat lengkap
 * - Demografi: agama, pendidikan, pekerjaan, status perkawinan, kewarganegaraan
 * - Kategori: kategori umur, golongan darah
 * - Metadata: is_active, created_at, updated_at
 *
 * Transaction Handling:
 * - Bulk operations menggunakan database transaction
 * - Automatic rollback jika terjadi error
 * - Connection pooling untuk performa optimal
 *
 * Error Handling:
 * - Semua errors di-log dengan logger utility
 * - Errors di-throw ke caller untuk handling lebih lanjut
 * - Transaction rollback otomatis pada bulk operations
 *
 * Performance Considerations:
 * - Index pada NIK (primary key) untuk pencarian cepat
 * - Index pada family_card_number untuk group queries
 * - LIMIT pada search queries untuk mencegah large result sets
 * - Prepared statements untuk semua queries (SQL injection prevention)
 *
 * Related Files:
 * - c:\Users\Irga\Desktop\ocr-kk\src\config\database.js (database connection)
 * - c:\Users\Irga\Desktop\ocr-kk\src\utils\logger.js (logging utility)
 * - c:\Users\Irga\Desktop\ocr-kk\src\database\FamilyModel.js (related model)
 * - c:\Users\Irga\Desktop\ocr-kk\database\schema.sql (database schema)
 *
 * Author: OCR-KK Development Team
 * Created: 2024
 * Last Modified: 2024
 * Version: 1.0.0
 *
 * ============================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Class ResidentModel
 *
 * Model untuk mengelola data penduduk dalam database.
 * Menyediakan static methods untuk semua operasi database terkait residents.
 *
 * Design Pattern: Static Class Pattern
 * - Semua methods adalah static (no instance creation needed)
 * - Setiap method adalah atomic operation
 * - No state management dalam class
 *
 * @class ResidentModel
 */
class ResidentModel {
  /**
   * Mencari data penduduk berdasarkan NIK (Nomor Induk Kependudukan)
   *
   * Method ini melakukan pencarian exact match terhadap NIK penduduk.
   * NIK adalah unique identifier untuk setiap penduduk di Indonesia.
   *
   * Flow:
   * 1. Query database dengan exact NIK match
   * 2. LIMIT 1 untuk optimasi (NIK adalah unique)
   * 3. Return null jika tidak ditemukan
   * 4. Return object penduduk jika ditemukan
   *
   * Use Cases:
   * - Validasi keberadaan penduduk sebelum create
   * - Mengambil detail lengkap penduduk untuk display
   * - Verifikasi data penduduk saat update
   * - Check duplicate NIK sebelum insert
   *
   * Performance Notes:
   * - NIK adalah indexed column (primary key atau unique index)
   * - LIMIT 1 untuk optimasi, hanya butuh 1 record
   * - Query sangat cepat karena index lookup
   *
   * @async
   * @param {string} nik - Nomor Induk Kependudukan (16 digit)
   *
   * @returns {Promise<Object|null>} Data penduduk jika ditemukan, null jika tidak
   *
   * @returns {Object} resident - Object data penduduk lengkap
   * @returns {string} resident.nik - Nomor Induk Kependudukan
   * @returns {string} resident.name - Nama lengkap penduduk
   * @returns {string} resident.birth_place - Tempat lahir
   * @returns {Date} resident.birth_date - Tanggal lahir
   * @returns {string} resident.gender - Jenis kelamin (L/P)
   * @returns {number} resident.age - Umur dalam tahun
   * @returns {string} resident.family_card_number - Nomor KK
   * @returns {string} resident.address - Alamat lengkap
   * @returns {number} resident.family_relationship_id - ID hubungan keluarga
   * @returns {number} resident.religion_id - ID agama
   * @returns {number} resident.education_id - ID pendidikan
   * @returns {number} resident.occupation_id - ID pekerjaan
   * @returns {number} resident.marital_status_id - ID status perkawinan
   * @returns {boolean} resident.is_active - Status aktif (1) atau tidak (0)
   * @returns {Date} resident.created_at - Waktu pembuatan record
   * @returns {Date} resident.updated_at - Waktu update terakhir
   * @returns {null} Null jika NIK tidak ditemukan di database
   *
   * @throws {Error} Database query error
   * @throws {Error} Connection error
   *
   * @example
   * // Mencari penduduk dengan NIK tertentu
   * const resident = await ResidentModel.findByNIK('3201012345678901');
   * if (resident) {
   *   console.log(`Found: ${resident.name}`);
   *   console.log(`Address: ${resident.address}`);
   * } else {
   *   console.log('NIK not found');
   * }
   *
   * @example
   * // Validasi NIK sebelum create baru
   * const existing = await ResidentModel.findByNIK(newResident.nik);
   * if (existing) {
   *   throw new Error('NIK already exists in database');
   * }
   * await ResidentModel.create(newResident);
   *
   * @see ResidentModel.findByFamilyCard - Untuk mencari semua anggota keluarga
   * @see ResidentModel.search - Untuk pencarian dengan kriteria dinamis
   */
  static async findByNIK(nik) {
    try {
      // Query SQL dengan exact match pada NIK
      // LIMIT 1 karena NIK adalah unique identifier
      const sql = 'SELECT * FROM residents WHERE nik = ? LIMIT 1';

      // Execute query dengan parameterized statement (SQL injection prevention)
      const results = await db.query(sql, [nik]);

      // Check jika tidak ada hasil
      if (results.length === 0) {
        return null; // NIK tidak ditemukan
      }

      // Return first (dan satu-satunya) result
      return results[0];
    } catch (error) {
      // Log error dengan detail untuk debugging
      logger.error('Error finding resident by NIK:', error);
      throw error; // Re-throw untuk handling di caller
    }
  }

  /**
   * Mencari semua anggota keluarga berdasarkan nomor Kartu Keluarga (KK)
   *
   * Method ini mengambil semua penduduk yang terdaftar dalam satu KK.
   * Hasil di-sort berdasarkan hubungan keluarga dan nama untuk organisasi data.
   *
   * Flow:
   * 1. Query semua residents dengan family_card_number yang sama
   * 2. Sort berdasarkan family_relationship_id (Kepala Keluarga dulu)
   * 3. Sort kedua berdasarkan nama (alphabetical)
   * 4. Return array of residents (bisa kosong jika KK tidak ada)
   *
   * Sorting Logic:
   * - family_relationship_id: Mengurutkan berdasarkan hubungan keluarga
   *   (biasanya 1=Kepala Keluarga, 2=Istri, 3=Anak, dst)
   * - name: Secondary sort untuk members dengan relationship yang sama
   *
   * Use Cases:
   * - Menampilkan daftar anggota keluarga di UI
   * - Validasi completeness data KK
   * - Export data keluarga untuk laporan
   * - Bulk operations pada satu keluarga
   * - Verifikasi foreign key sebelum delete family_data
   *
   * Return Characteristics:
   * - Return empty array [] jika KK tidak ada/tidak punya anggota
   * - Return array of objects untuk multiple members
   * - Typical family size: 3-7 members
   *
   * Performance Notes:
   * - Index pada family_card_number untuk query cepat
   * - No LIMIT, return semua anggota (expected: small dataset per family)
   * - Sort di database level, lebih efisien dari sort di aplikasi
   *
   * @async
   * @param {string} familyCardNumber - Nomor Kartu Keluarga (16 digit)
   *
   * @returns {Promise<Array<Object>>} Array of resident objects, kosong jika tidak ada
   *
   * @returns {Object[]} residents - Array of resident data objects
   * @returns {string} residents[].nik - NIK anggota keluarga
   * @returns {string} residents[].name - Nama anggota keluarga
   * @returns {string} residents[].family_card_number - Nomor KK (sama semua)
   * @returns {number} residents[].family_relationship_id - Hubungan keluarga
   * @returns {string} residents[].gender - Jenis kelamin
   * @returns {number} residents[].age - Umur
   * @returns {string} residents[].address - Alamat (sama untuk satu keluarga)
   * @returns {boolean} residents[].is_active - Status aktif
   * @returns {...} residents[]... - Field lainnya sama seperti resident table
   *
   * @throws {Error} Database query error
   * @throws {Error} Connection error
   *
   * @example
   * // Mendapatkan semua anggota keluarga
   * const members = await ResidentModel.findByFamilyCard('3201012023456789');
   * console.log(`Family has ${members.length} members`);
   * members.forEach(member => {
   *   console.log(`- ${member.name} (${member.gender})`);
   * });
   *
   * @example
   * // Check jika keluarga ada sebelum operasi
   * const family = await ResidentModel.findByFamilyCard(kkNumber);
   * if (family.length === 0) {
   *   console.log('No residents found for this family card');
   * } else {
   *   const headOfFamily = family[0]; // First is usually head of family
   *   console.log(`Head: ${headOfFamily.name}`);
   * }
   *
   * @example
   * // Validasi sebelum delete family_data
   * const residents = await ResidentModel.findByFamilyCard(kkNumber);
   * if (residents.length > 0) {
   *   // Delete residents first to maintain referential integrity
   *   await ResidentModel.deleteByFamilyCard(kkNumber);
   * }
   * await FamilyModel.delete(kkNumber);
   *
   * @see ResidentModel.findByNIK - Untuk mencari individual resident
   * @see ResidentModel.deleteByFamilyCard - Untuk menghapus semua anggota
   * @see FamilyModel.findByKK - Untuk data KK (header data)
   */
  static async findByFamilyCard(familyCardNumber) {
    try {
      // Query semua residents dengan KK yang sama
      // ORDER BY untuk mengurutkan: Kepala Keluarga first, lalu alphabetical
      const sql = `
        SELECT * FROM residents
        WHERE family_card_number = ?
        ORDER BY family_relationship_id, name
      `;

      // Execute query dengan parameter
      const results = await db.query(sql, [familyCardNumber]);

      // Return results (bisa empty array)
      return results;
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error finding residents by family card:', error);
      throw error; // Re-throw untuk caller
    }
  }

  /**
   * Membuat record penduduk baru di database
   *
   * Method ini melakukan INSERT data penduduk baru dengan semua field yang lengkap.
   * Termasuk handling NULL values untuk optional fields dan auto-timestamp.
   *
   * Flow:
   * 1. Prepare SQL INSERT statement dengan semua columns
   * 2. Map residentData ke array parameters dengan NULL handling
   * 3. Execute INSERT query
   * 4. Log successful creation
   * 5. Return insertId dan NIK untuk reference
   *
   * Field Categories:
   * - Required: nik, name, gender, family_card_number
   * - Optional: semua field lainnya (di-set NULL jika tidak ada)
   * - Auto-generated: id (auto_increment), created_at, updated_at (NOW())
   * - Default: is_active (default 1 jika tidak specified)
   *
   * NULL Handling Strategy:
   * - Menggunakan `|| null` untuk convert falsy values ke NULL
   * - NULL lebih baik dari empty string untuk optional fields
   * - Database constraints akan validate required fields
   *
   * Timestamp Handling:
   * - created_at: Set ke NOW() saat insert
   * - updated_at: Set ke NOW() saat insert (akan di-update saat UPDATE)
   *
   * Foreign Key Validation:
   * - family_card_number harus exist di family_data.no_kk
   * - Semua *_id fields harus valid atau NULL
   * - Database akan throw error jika foreign key invalid
   *
   * Duplicate Prevention:
   * - NIK adalah unique constraint
   * - Database akan throw duplicate key error jika NIK sudah ada
   * - Caller harus handle duplicate error atau pre-check dengan findByNIK
   *
   * Use Cases:
   * - Menambah penduduk baru dari form input
   * - Import data penduduk dari OCR hasil
   * - Registrasi penduduk baru ke KK existing
   * - Migration data dari sistem lain
   *
   * @async
   * @param {Object} residentData - Data penduduk lengkap untuk di-insert
   *
   * @param {string} residentData.nik - NIK (REQUIRED, 16 digit, unique)
   * @param {string} residentData.name - Nama lengkap (REQUIRED)
   * @param {string} residentData.gender - Jenis kelamin (REQUIRED, L/P)
   * @param {string} residentData.family_card_number - Nomor KK (REQUIRED, FK ke family_data)
   * @param {string} [residentData.birth_place] - Tempat lahir (optional)
   * @param {Date|string} [residentData.birth_date] - Tanggal lahir (optional, format: YYYY-MM-DD)
   * @param {number} [residentData.age] - Umur dalam tahun (optional)
   * @param {string} [residentData.postal_code] - Kode pos (optional)
   * @param {string} [residentData.address] - Alamat lengkap (optional)
   * @param {string} [residentData.father_name] - Nama ayah (optional)
   * @param {string} [residentData.mother_name] - Nama ibu (optional)
   * @param {number} [residentData.family_relationship_id] - ID hubungan keluarga (optional, FK)
   * @param {number} [residentData.religion_id] - ID agama (optional, FK)
   * @param {number} [residentData.education_id] - ID pendidikan (optional, FK)
   * @param {number} [residentData.occupation_id] - ID pekerjaan (optional, FK)
   * @param {number} [residentData.marital_status_id] - ID status perkawinan (optional, FK)
   * @param {number} [residentData.citizenship_id] - ID kewarganegaraan (optional, FK)
   * @param {number} [residentData.age_category_id] - ID kategori umur (optional, FK)
   * @param {number} [residentData.blood_type_id] - ID golongan darah (optional, FK)
   * @param {string} [residentData.province_code] - Kode provinsi (optional, FK)
   * @param {string} [residentData.regency_code] - Kode kabupaten (optional, FK)
   * @param {string} [residentData.district_code] - Kode kecamatan (optional, FK)
   * @param {string} [residentData.village_code] - Kode kelurahan (optional, FK)
   * @param {string} [residentData.hamlet_code] - Kode dusun/hamlet (optional)
   * @param {string} [residentData.community_unit_code] - Kode RW (optional)
   * @param {string} [residentData.citizen_association_code] - Kode RT (optional)
   * @param {number} [residentData.is_active=1] - Status aktif (optional, default 1)
   *
   * @returns {Promise<Object>} Object berisi insertId dan NIK
   * @returns {number} return.id - Auto-increment ID dari database
   * @returns {string} return.nik - NIK yang baru di-insert (untuk confirmation)
   *
   * @throws {Error} Duplicate key error jika NIK sudah ada
   * @throws {Error} Foreign key constraint error jika referensi invalid
   * @throws {Error} NOT NULL constraint error jika required field missing
   * @throws {Error} Database connection error
   *
   * @example
   * // Create penduduk baru dengan data lengkap
   * const newResident = {
   *   nik: '3201012345678901',
   *   name: 'Budi Santoso',
   *   birth_place: 'Jakarta',
   *   birth_date: '1990-05-15',
   *   gender: 'L',
   *   age: 33,
   *   family_card_number: '3201012023456789',
   *   address: 'Jl. Merdeka No. 123',
   *   family_relationship_id: 1, // Kepala Keluarga
   *   religion_id: 1,
   *   education_id: 5,
   *   occupation_id: 3
   * };
   * const result = await ResidentModel.create(newResident);
   * console.log(`Created with ID: ${result.id}`);
   *
   * @example
   * // Create dengan minimal data (required only)
   * const minimalResident = {
   *   nik: '3201019876543210',
   *   name: 'Siti Aminah',
   *   gender: 'P',
   *   family_card_number: '3201012023456789'
   * };
   * const result = await ResidentModel.create(minimalResident);
   *
   * @example
   * // Handle duplicate NIK error
   * try {
   *   await ResidentModel.create(residentData);
   * } catch (error) {
   *   if (error.code === 'ER_DUP_ENTRY') {
   *     console.error('NIK already exists');
   *   } else {
   *     throw error;
   *   }
   * }
   *
   * @see ResidentModel.findByNIK - Check duplicate sebelum create
   * @see ResidentModel.update - Update data existing resident
   * @see ResidentModel.bulkCreate - Create multiple residents dengan transaction
   */
  static async create(residentData) {
    try {
      // SQL INSERT statement dengan semua columns
      // created_at dan updated_at di-set NOW() otomatis
      const sql = `
        INSERT INTO residents (
          nik,
          name,
          birth_place,
          birth_date,
          gender,
          age,
          family_card_number,
          postal_code,
          address,
          father_name,
          mother_name,
          family_relationship_id,
          religion_id,
          education_id,
          occupation_id,
          marital_status_id,
          citizenship_id,
          age_category_id,
          blood_type_id,
          province_code,
          regency_code,
          district_code,
          village_code,
          hamlet_code,
          community_unit_code,
          citizen_association_code,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      // Array parameters dengan NULL handling untuk optional fields
      // Urutan harus exact match dengan SQL columns
      const params = [
        residentData.nik, // Required
        residentData.name, // Required
        residentData.birth_place || null, // Optional - NULL jika falsy
        residentData.birth_date || null, // Optional
        residentData.gender, // Required
        residentData.age || null, // Optional
        residentData.family_card_number, // Required - FK ke family_data
        residentData.postal_code || null, // Optional
        residentData.address || null, // Optional
        residentData.father_name || null, // Optional
        residentData.mother_name || null, // Optional
        residentData.family_relationship_id || null, // Optional FK
        residentData.religion_id || null, // Optional FK
        residentData.education_id || null, // Optional FK
        residentData.occupation_id || null, // Optional FK
        residentData.marital_status_id || null, // Optional FK
        residentData.citizenship_id || null, // Optional FK
        residentData.age_category_id || null, // Optional FK
        residentData.blood_type_id || null, // Optional FK
        residentData.province_code || null, // Optional FK
        residentData.regency_code || null, // Optional FK
        residentData.district_code || null, // Optional FK
        residentData.village_code || null, // Optional FK
        residentData.hamlet_code || null, // Optional
        residentData.community_unit_code || null, // Optional
        residentData.citizen_association_code || null, // Optional
        residentData.is_active !== undefined ? residentData.is_active : 1 // Default 1
      ];

      // Execute INSERT query
      const result = await db.query(sql, params);

      // Log successful creation untuk audit trail
      logger.info(`Resident created: NIK ${residentData.nik}, Name ${residentData.name}`);

      // Return insertId dan NIK untuk reference
      return {
        id: result.insertId, // Auto-increment ID dari database
        nik: residentData.nik // NIK untuk confirmation
      };
    } catch (error) {
      // Log error dengan detail
      logger.error('Error creating resident:', error);
      throw error; // Re-throw untuk caller handling
    }
  }

  /**
   * Update data penduduk berdasarkan NIK
   *
   * Method ini melakukan UPDATE semua field (kecuali NIK dan is_active) dari resident.
   * NIK tidak bisa di-update karena digunakan sebagai identifier.
   * Timestamp updated_at akan di-update otomatis ke NOW().
   *
   * Flow:
   * 1. Prepare UPDATE SQL dengan semua editable columns
   * 2. Map residentData ke parameters dengan NULL handling
   * 3. Execute UPDATE dengan WHERE nik = ?
   * 4. Log successful update
   * 5. Return true untuk indicate success
   *
   * Update Strategy:
   * - Replace all fields (bukan merge) - semua field harus provided
   * - NIK tidak di-update (digunakan di WHERE clause)
   * - is_active tidak di-update (gunakan method terpisah untuk soft delete)
   * - created_at tetap unchanged (hanya updated_at yang berubah)
   * - Auto-update updated_at ke NOW()
   *
   * NULL Handling:
   * - Sama seperti create, gunakan `|| null` untuk optional fields
   * - Jika ingin clear field, bisa pass null explicitly
   *
   * Foreign Key Validation:
   * - family_card_number baru harus exist di family_data
   * - Semua *_id fields harus valid atau NULL
   * - Database akan throw FK constraint error jika invalid
   *
   * No Existence Check:
   * - Method TIDAK check apakah NIK exists sebelum update
   * - Jika NIK tidak ada, update akan "success" tapi affectedRows = 0
   * - Caller harus pre-check dengan findByNIK jika perlu validasi
   *
   * Use Cases:
   * - Update info penduduk dari form edit
   * - Koreksi data yang salah input
   * - Update alamat saat pindah rumah (dalam satu KK)
   * - Update status perkawinan, pekerjaan, dll
   * - Sync data dari sumber eksternal
   *
   * @async
   * @param {string} nik - NIK penduduk yang akan di-update (WHERE clause)
   * @param {Object} residentData - Data baru untuk semua fields
   *
   * @param {string} residentData.name - Nama lengkap (REQUIRED)
   * @param {string} residentData.gender - Jenis kelamin (REQUIRED, L/P)
   * @param {string} residentData.family_card_number - Nomor KK (REQUIRED, FK)
   * @param {string} [residentData.birth_place] - Tempat lahir (optional)
   * @param {Date|string} [residentData.birth_date] - Tanggal lahir (optional)
   * @param {number} [residentData.age] - Umur (optional)
   * @param {string} [residentData.postal_code] - Kode pos (optional)
   * @param {string} [residentData.address] - Alamat lengkap (optional)
   * @param {string} [residentData.father_name] - Nama ayah (optional)
   * @param {string} [residentData.mother_name] - Nama ibu (optional)
   * @param {number} [residentData.family_relationship_id] - ID hubungan keluarga (optional FK)
   * @param {number} [residentData.religion_id] - ID agama (optional FK)
   * @param {number} [residentData.education_id] - ID pendidikan (optional FK)
   * @param {number} [residentData.occupation_id] - ID pekerjaan (optional FK)
   * @param {number} [residentData.marital_status_id] - ID status perkawinan (optional FK)
   * @param {number} [residentData.citizenship_id] - ID kewarganegaraan (optional FK)
   * @param {number} [residentData.age_category_id] - ID kategori umur (optional FK)
   * @param {number} [residentData.blood_type_id] - ID golongan darah (optional FK)
   * @param {string} [residentData.province_code] - Kode provinsi (optional FK)
   * @param {string} [residentData.regency_code] - Kode kabupaten (optional FK)
   * @param {string} [residentData.district_code] - Kode kecamatan (optional FK)
   * @param {string} [residentData.village_code] - Kode kelurahan (optional FK)
   * @param {string} [residentData.hamlet_code] - Kode dusun (optional)
   * @param {string} [residentData.community_unit_code] - Kode RW (optional)
   * @param {string} [residentData.citizen_association_code] - Kode RT (optional)
   *
   * @returns {Promise<boolean>} true jika update berhasil
   *
   * @throws {Error} Foreign key constraint error jika referensi invalid
   * @throws {Error} Database connection error
   *
   * @example
   * // Update data penduduk lengkap
   * const updatedData = {
   *   name: 'Budi Santoso, S.Kom',
   *   birth_place: 'Jakarta',
   *   birth_date: '1990-05-15',
   *   gender: 'L',
   *   age: 34, // Updated age
   *   family_card_number: '3201012023456789',
   *   address: 'Jl. Merdeka No. 456', // Changed address
   *   family_relationship_id: 1,
   *   religion_id: 1,
   *   education_id: 6, // Updated education
   *   occupation_id: 5  // Changed occupation
   * };
   * await ResidentModel.update('3201012345678901', updatedData);
   *
   * @example
   * // Update hanya beberapa field (tetap harus pass semua)
   * const existing = await ResidentModel.findByNIK(nik);
   * const updated = {
   *   ...existing,
   *   address: 'New Address', // Change only address
   *   occupation_id: 10       // Change only occupation
   * };
   * await ResidentModel.update(nik, updated);
   *
   * @example
   * // Check existence sebelum update
   * const existing = await ResidentModel.findByNIK(nik);
   * if (!existing) {
   *   throw new Error('Resident not found');
   * }
   * await ResidentModel.update(nik, updatedData);
   *
   * @see ResidentModel.findByNIK - Check existence sebelum update
   * @see ResidentModel.create - Create resident baru
   */
  static async update(nik, residentData) {
    try {
      // SQL UPDATE statement untuk semua editable columns
      // NIK tidak di-update (digunakan di WHERE)
      // is_active tidak di-update (gunakan soft delete method)
      // updated_at auto-update ke NOW()
      const sql = `
        UPDATE residents
        SET
          name = ?,
          birth_place = ?,
          birth_date = ?,
          gender = ?,
          age = ?,
          family_card_number = ?,
          postal_code = ?,
          address = ?,
          father_name = ?,
          mother_name = ?,
          family_relationship_id = ?,
          religion_id = ?,
          education_id = ?,
          occupation_id = ?,
          marital_status_id = ?,
          citizenship_id = ?,
          age_category_id = ?,
          blood_type_id = ?,
          province_code = ?,
          regency_code = ?,
          district_code = ?,
          village_code = ?,
          hamlet_code = ?,
          community_unit_code = ?,
          citizen_association_code = ?,
          updated_at = NOW()
        WHERE nik = ?
      `;

      // Array parameters dengan NULL handling
      // Urutan harus exact match dengan SQL SET clause
      const params = [
        residentData.name, // Required
        residentData.birth_place || null, // Optional
        residentData.birth_date || null, // Optional
        residentData.gender, // Required
        residentData.age || null, // Optional
        residentData.family_card_number, // Required FK
        residentData.postal_code || null, // Optional
        residentData.address || null, // Optional
        residentData.father_name || null, // Optional
        residentData.mother_name || null, // Optional
        residentData.family_relationship_id || null, // Optional FK
        residentData.religion_id || null, // Optional FK
        residentData.education_id || null, // Optional FK
        residentData.occupation_id || null, // Optional FK
        residentData.marital_status_id || null, // Optional FK
        residentData.citizenship_id || null, // Optional FK
        residentData.age_category_id || null, // Optional FK
        residentData.blood_type_id || null, // Optional FK
        residentData.province_code || null, // Optional FK
        residentData.regency_code || null, // Optional FK
        residentData.district_code || null, // Optional FK
        residentData.village_code || null, // Optional FK
        residentData.hamlet_code || null, // Optional
        residentData.community_unit_code || null, // Optional
        residentData.citizen_association_code || null, // Optional
        nik // WHERE clause parameter
      ];

      // Execute UPDATE query
      await db.query(sql, params);

      // Log successful update untuk audit trail
      logger.info(`Resident updated: NIK ${nik}`);

      // Return true untuk indicate success
      return true;
    } catch (error) {
      // Log error dengan detail
      logger.error('Error updating resident:', error);
      throw error; // Re-throw untuk caller handling
    }
  }

  /**
   * Menghapus data penduduk berdasarkan NIK (Hard Delete)
   *
   * Method ini melakukan HARD DELETE (permanent removal) dari database.
   * Record akan benar-benar dihapus, tidak bisa di-recover.
   *
   * PENTING - Hard Delete Consideration:
   * - Data hilang permanent dari database
   * - Tidak ada audit trail untuk data yang dihapus
   * - Tidak bisa di-restore/undo
   * - Consider soft delete (set is_active = 0) sebagai alternatif
   *
   * Flow:
   * 1. Execute DELETE FROM residents WHERE nik = ?
   * 2. Log deletion untuk audit trail
   * 3. Return true untuk indicate success
   *
   * Foreign Key Impact:
   * - Jika ada tabel lain yang reference NIK ini, delete akan fail
   * - Database akan throw FK constraint error
   * - Harus delete child records dulu sebelum parent
   *
   * No Existence Check:
   * - Method TIDAK check apakah NIK exists sebelum delete
   * - Jika NIK tidak ada, delete akan "success" tapi affectedRows = 0
   * - Caller harus pre-check dengan findByNIK jika perlu validasi
   *
   * Use Cases:
   * - Hapus data duplicate/salah input
   * - Cleanup test data
   * - Remove data tidak valid
   * - Data migration cleanup
   *
   * Alternative: Soft Delete
   * - UPDATE residents SET is_active = 0 WHERE nik = ?
   * - Data tetap ada tapi di-mark inactive
   * - Bisa di-restore dengan set is_active = 1
   * - Better untuk audit trail
   *
   * @async
   * @param {string} nik - NIK penduduk yang akan dihapus
   *
   * @returns {Promise<boolean>} true jika delete berhasil (atau NIK tidak ada)
   *
   * @throws {Error} Foreign key constraint error jika ada referensi
   * @throws {Error} Database connection error
   *
   * @example
   * // Delete penduduk dengan validation
   * const resident = await ResidentModel.findByNIK(nik);
   * if (!resident) {
   *   throw new Error('Resident not found');
   * }
   * await ResidentModel.delete(nik);
   * console.log('Resident deleted successfully');
   *
   * @example
   * // Delete tanpa validation (silent delete)
   * await ResidentModel.delete(nik); // Success even if NIK doesn't exist
   *
   * @example
   * // Soft delete alternative (recommended)
   * const resident = await ResidentModel.findByNIK(nik);
   * await ResidentModel.update(nik, {
   *   ...resident,
   *   is_active: 0 // Mark as inactive instead of delete
   * });
   *
   * @see ResidentModel.deleteByFamilyCard - Delete semua anggota keluarga
   * @see ResidentModel.findByNIK - Check existence sebelum delete
   */
  static async delete(nik) {
    try {
      // Hard DELETE query - permanent removal
      const sql = 'DELETE FROM residents WHERE nik = ?';

      // Execute delete
      await db.query(sql, [nik]);

      // Log deletion untuk audit trail
      logger.info(`Resident deleted: NIK ${nik}`);

      // Return true untuk indicate success
      return true;
    } catch (error) {
      // Log error dengan detail
      logger.error('Error deleting resident:', error);
      throw error; // Re-throw untuk caller handling
    }
  }

  /**
   * Menghapus semua anggota keluarga berdasarkan nomor KK (Bulk Hard Delete)
   *
   * Method ini menghapus SEMUA penduduk yang terdaftar dalam satu KK.
   * Ini adalah bulk delete operation - multiple records dihapus sekaligus.
   *
   * PENTING - Bulk Delete Consideration:
   * - Menghapus SEMUA anggota keluarga sekaligus (irreversible)
   * - Typical use: cleanup sebelum delete family_data (maintain referential integrity)
   * - Tidak ada confirmation - langsung hapus semua
   * - Harus hati-hati, bisa menghapus banyak records
   *
   * Flow:
   * 1. Execute DELETE untuk semua residents dengan family_card_number yang sama
   * 2. Get affectedRows untuk tahu berapa records yang dihapus
   * 3. Log deletion count untuk audit trail
   * 4. Return jumlah records yang dihapus
   *
   * Use Cases:
   * - Cleanup sebelum delete family_data (untuk maintain FK integrity)
   * - Remove semua anggota keluarga yang pindah
   * - Bulk cleanup untuk data tidak valid
   * - Migration data cleanup
   *
   * Typical Workflow:
   * 1. Delete all residents dengan deleteByFamilyCard()
   * 2. Kemudian delete family_data dengan FamilyModel.delete()
   * 3. Ini maintain referential integrity (delete child dulu, baru parent)
   *
   * Return Value:
   * - Return 0 jika KK tidak punya anggota atau tidak exist
   * - Return positive integer untuk jumlah records dihapus
   * - Typical family: 3-7 anggota
   *
   * Foreign Key Consideration:
   * - Biasanya digunakan sebelum delete dari family_data
   * - Mencegah FK constraint error saat delete parent record
   *
   * @async
   * @param {string} familyCardNumber - Nomor Kartu Keluarga
   *
   * @returns {Promise<number>} Jumlah resident yang dihapus (0 jika tidak ada)
   *
   * @throws {Error} Database connection error
   * @throws {Error} Foreign key constraint error jika ada referensi lain
   *
   * @example
   * // Delete semua anggota keluarga dengan count
   * const deletedCount = await ResidentModel.deleteByFamilyCard('3201012023456789');
   * console.log(`Deleted ${deletedCount} residents`);
   *
   * @example
   * // Proper cleanup workflow: delete residents first, then family_data
   * const kkNumber = '3201012023456789';
   *
   * // Step 1: Delete all residents (child records)
   * const residentCount = await ResidentModel.deleteByFamilyCard(kkNumber);
   * console.log(`Deleted ${residentCount} residents`);
   *
   * // Step 2: Delete family_data (parent record)
   * await FamilyModel.delete(kkNumber);
   * console.log('Family card deleted');
   *
   * @example
   * // Check sebelum delete untuk confirmation
   * const members = await ResidentModel.findByFamilyCard(kkNumber);
   * if (members.length > 0) {
   *   console.log(`About to delete ${members.length} residents`);
   *   // User confirmation here
   *   const count = await ResidentModel.deleteByFamilyCard(kkNumber);
   *   console.log(`Deleted ${count} residents`);
   * } else {
   *   console.log('No residents to delete');
   * }
   *
   * @example
   * // Handle jika tidak ada yang dihapus
   * const deletedCount = await ResidentModel.deleteByFamilyCard(kkNumber);
   * if (deletedCount === 0) {
   *   console.log('No residents found for this family card');
   * } else {
   *   console.log(`Successfully deleted ${deletedCount} residents`);
   * }
   *
   * @see ResidentModel.findByFamilyCard - Check anggota sebelum delete
   * @see ResidentModel.delete - Delete single resident by NIK
   * @see FamilyModel.delete - Delete family_data setelah delete residents
   */
  static async deleteByFamilyCard(familyCardNumber) {
    try {
      // Bulk DELETE query - hapus semua residents dengan KK yang sama
      const sql = 'DELETE FROM residents WHERE family_card_number = ?';

      // Execute delete dan get result untuk affectedRows
      const result = await db.query(sql, [familyCardNumber]);

      // Log deletion count untuk audit trail
      logger.info(`Deleted ${result.affectedRows} residents for family card ${familyCardNumber}`);

      // Return jumlah records yang dihapus
      return result.affectedRows;
    } catch (error) {
      // Log error dengan detail
      logger.error('Error deleting residents by family card:', error);
      throw error; // Re-throw untuk caller handling
    }
  }

  /**
   * Mencari penduduk dengan criteria dinamis (Dynamic Search)
   *
   * Method ini menyediakan flexible search dengan multiple criteria.
   * Query SQL di-build secara dinamis berdasarkan criteria yang provided.
   *
   * Search Capabilities:
   * - NIK: Partial match dengan LIKE (cari substring)
   * - Name: Partial match dengan LIKE (case-insensitive di MySQL)
   * - Family Card Number: Exact match
   * - Kombinasi multiple criteria (AND logic)
   *
   * Dynamic SQL Building:
   * - Start dengan WHERE 1=1 (always true base condition)
   * - Tambah AND conditions secara dinamis sesuai criteria
   * - Build params array parallel dengan conditions
   * - Safe dari SQL injection (gunakan parameterized queries)
   *
   * Search Logic:
   * - NIK LIKE %value% : Partial match (e.g., "1234" match "3201012345678901")
   * - name LIKE %value% : Partial match, case-insensitive
   * - family_card_number = value : Exact match
   *
   * Result Limitation:
   * - ORDER BY created_at DESC : Terbaru dulu
   * - LIMIT 100 : Max 100 results untuk prevent overload
   * - Jika butuh lebih, consider pagination
   *
   * Performance Notes:
   * - LIKE queries dengan leading % tidak pakai index (slow untuk large data)
   * - Consider full-text search untuk production large dataset
   * - LIMIT 100 untuk prevent large result sets
   *
   * Use Cases:
   * - Search bar di UI untuk cari penduduk
   * - Autocomplete NIK/nama
   * - Filter residents untuk admin panel
   * - Quick lookup untuk verifikasi data
   *
   * @async
   * @param {Object} criteria - Object berisi search criteria
   *
   * @param {string} [criteria.nik] - NIK untuk dicari (partial match)
   * @param {string} [criteria.name] - Nama untuk dicari (partial match)
   * @param {string} [criteria.family_card_number] - Nomor KK (exact match)
   *
   * @returns {Promise<Array<Object>>} Array of residents yang match criteria
   * @returns {Object[]} results - Array maksimal 100 residents
   * @returns {string} results[].nik - NIK penduduk
   * @returns {string} results[].name - Nama penduduk
   * @returns {string} results[].family_card_number - Nomor KK
   * @returns {...} results[]... - Field lainnya dari resident table
   *
   * @throws {Error} Database query error
   * @throws {Error} Connection error
   *
   * @example
   * // Search by NIK (partial)
   * const results = await ResidentModel.search({
   *   nik: '3201' // Match semua NIK yang contain "3201"
   * });
   * console.log(`Found ${results.length} residents`);
   *
   * @example
   * // Search by nama (partial, case-insensitive)
   * const results = await ResidentModel.search({
   *   name: 'budi' // Match "Budi", "Budiman", "Budi Santoso", dll
   * });
   * results.forEach(r => console.log(r.name));
   *
   * @example
   * // Search by nomor KK (exact)
   * const results = await ResidentModel.search({
   *   family_card_number: '3201012023456789'
   * });
   * // Sama seperti findByFamilyCard tapi dengan LIMIT 100
   *
   * @example
   * // Combined search (multiple criteria dengan AND)
   * const results = await ResidentModel.search({
   *   name: 'siti',
   *   family_card_number: '3201012023456789'
   * });
   * // Find residents dengan nama mengandung "siti" DAN di KK tertentu
   *
   * @example
   * // Empty criteria (return latest 100 residents)
   * const results = await ResidentModel.search({});
   * // Return 100 residents terbaru (ORDER BY created_at DESC)
   *
   * @example
   * // Search dengan validation
   * const criteria = {
   *   nik: userInput.trim() // Clean user input
   * };
   * const results = await ResidentModel.search(criteria);
   * if (results.length === 0) {
   *   console.log('No results found');
   * } else if (results.length === 100) {
   *   console.log('Too many results, showing first 100. Refine your search.');
   * } else {
   *   console.log(`Found ${results.length} results`);
   * }
   *
   * @see ResidentModel.findByNIK - Untuk exact NIK match
   * @see ResidentModel.findByFamilyCard - Untuk semua anggota KK (no limit)
   */
  static async search(criteria) {
    try {
      // Base SQL dengan WHERE 1=1 (always true, untuk dynamic AND clauses)
      let sql = 'SELECT * FROM residents WHERE 1=1';
      const params = []; // Parameters array untuk prepared statement

      // Dynamic condition: NIK partial match
      if (criteria.nik) {
        sql += ' AND nik LIKE ?'; // Append AND condition
        params.push(`%${criteria.nik}%`); // Wrap dengan % untuk partial match
      }

      // Dynamic condition: Name partial match
      if (criteria.name) {
        sql += ' AND name LIKE ?'; // Append AND condition
        params.push(`%${criteria.name}%`); // Case-insensitive di MySQL
      }

      // Dynamic condition: Family Card exact match
      if (criteria.family_card_number) {
        sql += ' AND family_card_number = ?'; // Exact match
        params.push(criteria.family_card_number);
      }

      // Sort dan limit untuk optimization
      // Terbaru dulu, max 100 results
      sql += ' ORDER BY created_at DESC LIMIT 100';

      // Execute dynamic query dengan parameters
      const results = await db.query(sql, params);

      // Return results (bisa empty array)
      return results;
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error searching residents:', error);
      throw error; // Re-throw untuk caller
    }
  }

  /**
   * Mengambil statistik penduduk untuk dashboard/reporting
   *
   * Method ini menjalankan multiple aggregate queries untuk generate statistik.
   * Digunakan untuk dashboard admin, reporting, dan data visualization.
   *
   * Statistics Generated:
   * 1. Total: Total penduduk aktif (is_active = 1)
   * 2. Today: Penduduk baru yang di-register hari ini
   * 3. By Gender: Breakdown penduduk berdasarkan jenis kelamin
   *
   * Query Strategy:
   * - 3 separate queries (not JOINed) untuk clarity dan debugging
   * - All queries filter by is_active = 1 (hanya active residents)
   * - Use aggregate functions: COUNT(), GROUP BY
   * - Today query menggunakan DATE() dan CURDATE()
   *
   * Active Filter Rationale:
   * - is_active = 1 : Hanya count penduduk yang masih aktif
   * - Exclude soft-deleted records (is_active = 0)
   * - Memberikan statistik yang accurate untuk current population
   *
   * Gender Breakdown:
   * - GROUP BY gender untuk count per gender
   * - Typical values: 'L' (Laki-laki), 'P' (Perempuan)
   * - Return array: [{gender: 'L', count: 150}, {gender: 'P', count: 145}]
   *
   * Today Count:
   * - DATE(created_at) = CURDATE() : Match hanya today's date
   * - Ignore timestamp, hanya compare date portion
   * - Berguna untuk monitor daily registration activity
   *
   * Use Cases:
   * - Dashboard admin panel
   * - Statistical reports
   * - Data visualization (charts, graphs)
   * - Monitoring registration trends
   * - Population demographics overview
   *
   * Performance Notes:
   * - COUNT() dengan WHERE is_active adalah indexed query (fast)
   * - GROUP BY gender efisien karena low cardinality (2 values)
   * - DATE() function bisa slow untuk large tables (no index on DATE(created_at))
   * - Consider materialized views untuk very large datasets
   *
   * @async
   *
   * @returns {Promise<Object>} Object berisi statistik penduduk
   *
   * @returns {number} return.total - Total penduduk aktif
   * @returns {number} return.today - Penduduk baru hari ini
   * @returns {Array<Object>} return.byGender - Breakdown by gender
   * @returns {string} return.byGender[].gender - Gender ('L' atau 'P')
   * @returns {number} return.byGender[].count - Jumlah penduduk gender tersebut
   *
   * @throws {Error} Database query error
   * @throws {Error} Connection error
   *
   * @example
   * // Get stats untuk dashboard
   * const stats = await ResidentModel.getStats();
   * console.log(`Total Active Residents: ${stats.total}`);
   * console.log(`New Registrations Today: ${stats.today}`);
   * console.log('Gender Distribution:');
   * stats.byGender.forEach(g => {
   *   console.log(`  ${g.gender}: ${g.count} (${(g.count/stats.total*100).toFixed(1)}%)`);
   * });
   *
   * @example
   * // Display stats in admin panel
   * const stats = await ResidentModel.getStats();
   * const maleCount = stats.byGender.find(g => g.gender === 'L')?.count || 0;
   * const femaleCount = stats.byGender.find(g => g.gender === 'P')?.count || 0;
   *
   * console.log('=== RESIDENT STATISTICS ===');
   * console.log(`Total Population: ${stats.total}`);
   * console.log(`Male: ${maleCount}`);
   * console.log(`Female: ${femaleCount}`);
   * console.log(`Today's Registrations: ${stats.today}`);
   *
   * @example
   * // Monitor daily activity
   * const stats = await ResidentModel.getStats();
   * if (stats.today === 0) {
   *   console.log('No new registrations today');
   * } else {
   *   console.log(`${stats.today} new residents registered today`);
   * }
   *
   * @example
   * // Calculate gender ratio
   * const stats = await ResidentModel.getStats();
   * const male = stats.byGender.find(g => g.gender === 'L')?.count || 0;
   * const female = stats.byGender.find(g => g.gender === 'P')?.count || 0;
   * const ratio = male / female;
   * console.log(`Gender Ratio (M:F): ${ratio.toFixed(2)}:1`);
   *
   * @see ResidentModel.search - Untuk filter dan count custom criteria
   */
  static async getStats() {
    try {
      // Query 1: Total active residents
      // Count semua residents dengan is_active = 1
      const totalSql = 'SELECT COUNT(*) as total FROM residents WHERE is_active = 1';
      const totalResult = await db.query(totalSql);

      // Query 2: Gender distribution (GROUP BY)
      // Breakdown count berdasarkan gender untuk active residents
      const genderSql = `
        SELECT
          gender,
          COUNT(*) as count
        FROM residents
        WHERE is_active = 1
        GROUP BY gender
      `;
      const genderResult = await db.query(genderSql);

      // Query 3: Today's new registrations
      // Count residents yang created_at adalah hari ini (DATE match)
      const todaySql = 'SELECT COUNT(*) as today FROM residents WHERE DATE(created_at) = CURDATE()';
      const todayResult = await db.query(todaySql);

      // Combine results ke single stats object
      return {
        total: totalResult[0].total, // Total active residents
        today: todayResult[0].today, // New registrations today
        byGender: genderResult // Array: [{gender: 'L', count: n}, {gender: 'P', count: m}]
      };
    } catch (error) {
      // Log error untuk debugging
      logger.error('Error getting resident stats:', error);
      throw error; // Re-throw untuk caller
    }
  }

  
  static async bulkCreate(residentsData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const results = [];

      for (const resident of residentsData) {
        const sql = `
          INSERT INTO residents (
            nik,
            name,
            birth_place,
            birth_date,
            gender,
            age,
            family_card_number,
            postal_code,
            address,
            father_name,
            mother_name,
            family_relationship_id,
            religion_id,
            education_id,
            occupation_id,
            marital_status_id,
            citizenship_id,
            age_category_id,
            blood_type_id,
            province_code,
            regency_code,
            district_code,
            village_code,
            hamlet_code,
            community_unit_code,
            citizen_association_code,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const params = [
          resident.nik,
          resident.name,
          resident.birth_place || null,
          resident.birth_date || null,
          resident.gender,
          resident.age || null,
          resident.family_card_number,
          resident.postal_code || null,
          resident.address || null,
          resident.father_name || null,
          resident.mother_name || null,
          resident.family_relationship_id || null,
          resident.religion_id || null,
          resident.education_id || null,
          resident.occupation_id || null,
          resident.marital_status_id || null,
          resident.citizenship_id || null,
          resident.age_category_id || null,
          resident.blood_type_id || null,
          resident.province_code || null,
          resident.regency_code || null,
          resident.district_code || null,
          resident.village_code || null,
          resident.hamlet_code || null,
          resident.community_unit_code || null,
          resident.citizen_association_code || null,
          resident.is_active !== undefined ? resident.is_active : 1
        ];

        const [result] = await connection.execute(sql, params);
        results.push({ id: result.insertId, nik: resident.nik });
      }

      await connection.commit();

      logger.info(`Bulk created ${results.length} residents`);

      return results;
    } catch (error) {
      await connection.rollback();
      logger.error('Error in bulk create residents:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ResidentModel;
