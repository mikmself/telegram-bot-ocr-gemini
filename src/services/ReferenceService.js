/**
 * ============================================================================
 * FILE: src/services/ReferenceService.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Service untuk mengelola reference data (agama, pendidikan, pekerjaan, dll)
 * dengan caching strategy dan fallback data. Service ini menyediakan
 * lookup functionality untuk data referensi yang digunakan dalam
 * proses OCR dan data creation.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - config/database: Database connection untuk reference data
 * - utils/logger: Logging utility untuk tracking dan debugging
 *
 * FITUR UTAMA:
 * 1. Reference Data Management
 *    - Agama, pendidikan, pekerjaan, status perkawinan
 *    - Golongan darah, kewarganegaraan, hubungan keluarga
 *    - Kategori umur dengan range validation
 *
 * 2. Caching Strategy
 *    - In-memory caching untuk performance
 *    - Lazy loading dari database
 *    - Cache invalidation dan refresh
 *    - Fallback data untuk reliability
 *
 * 3. Data Lookup & Mapping
 *    - Fuzzy matching untuk data lookup
 *    - Normalization dan standardization
 *    - Multiple mapping strategies
 *    - Default value handling
 *
 * 4. Database Integration
 *    - Database query optimization
 *    - Error handling dan fallback
 *    - Connection management
 *    - Data consistency
 *
 * 5. Performance Optimization
 *    - Caching untuk reduce database calls
 *    - Efficient lookup algorithms
 *    - Memory management
 *    - Query optimization
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const ReferenceService = require('./services/ReferenceService');
 *
 * // Get religion ID by name
 * const religionId = await ReferenceService.getReligionId('Islam');
 *
 * // Get education ID with fuzzy matching
 * const educationId = await ReferenceService.getEducationId('SMA');
 *
 * // Get all reference data
 * const allRefs = await ReferenceService.getAllReferences();
 * ```
 *
 * CATATAN PENTING:
 * - Service menggunakan singleton pattern
 * - Cache data di memory untuk performance
 * - Fallback data tersedia jika database error
 * - Fuzzy matching untuk handle variations
 * - Default values untuk missing data
 *
 * ============================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * ReferenceService Class
 * 
 * Mengelola reference data dengan caching dan fallback strategy.
 * Menyediakan lookup functionality untuk data referensi yang digunakan
 * dalam proses OCR dan data creation.
 * 
 * CACHING STRATEGY:
 * 1. Lazy Loading
 *    - Load data dari database saat pertama kali diakses
 *    - Cache di memory untuk subsequent calls
 *    - Cache invalidation untuk data refresh
 * 
 * 2. Fallback Data
 *    - Hardcoded fallback data jika database error
 *    - Ensure service tetap berfungsi
 *    - Log warnings untuk monitoring
 * 
 * 3. Performance Optimization
 *    - Reduce database calls dengan caching
 *    - Efficient lookup algorithms
 *    - Memory management
 * 
 * @class ReferenceService
 */
class ReferenceService {
  constructor() {
    // ========================================================================
    // CACHE INITIALIZATION
    // ========================================================================
    
    /**
     * In-memory cache untuk reference data
     * Lazy loading dari database
     */
    this.cache = {
      religions: null,
      educations: null,
      occupations: null,
      maritalStatuses: null,
      bloodTypes: null,
      citizenships: null,
      familyRelationships: null,
      ageCategories: null
    };

    // ========================================================================
    // FALLBACK DATA INITIALIZATION
    // ========================================================================
    
    /**
     * Fallback data jika database tidak accessible
     * Ensure service tetap berfungsi
     */
    this.fallbackData = {
      religions: [
        { id: 1, name: 'Islam' },
        { id: 2, name: 'Kristen' },
        { id: 3, name: 'Katholik' },
        { id: 4, name: 'Hindu' },
        { id: 5, name: 'Budha' },
        { id: 6, name: 'Konghucu' },
        { id: 7, name: 'Kepercayaan Terhadap Tuhan YME' }
      ],
      educations: [
        { id: 1, name: 'TIDAK/BELUM SEKOLAH' },
        { id: 2, name: 'SD/SEDERAJAT' },
        { id: 3, name: 'SMP/SEDERAJAT' },
        { id: 4, name: 'SLTA/SEDERAJAT' },
        { id: 5, name: 'DIPLOMA I' },
        { id: 6, name: 'DIPLOMA II' },
        { id: 7, name: 'DIPLOMA III' },
        { id: 8, name: 'DIPLOMA IV' },
        { id: 9, name: 'STRATA I' },
        { id: 10, name: 'STRATA II' },
        { id: 11, name: 'STRATA III' }
      ],
      occupations: [
        { id: 1, name: 'KARYAWAN' },
        { id: 2, name: 'SWASTA' },
        { id: 3, name: 'PNS' },
        { id: 4, name: 'WIRASWASTA' },
        { id: 5, name: 'PELAJAR' },
        { id: 6, name: 'MAHASISWA' },
        { id: 7, name: 'GURU' },
        { id: 8, name: 'DOSEN' },
        { id: 9, name: 'PETANI' },
        { id: 10, name: 'BURUH' },
        { id: 11, name: 'NELAYAN' }
      ],
      maritalStatuses: [
        { id: 1, name: 'BELUM KAWIN' },
        { id: 2, name: 'KAWIN' },
        { id: 3, name: 'CERAI HIDUP' },
        { id: 4, name: 'CERAI MATI' }
      ],
      bloodTypes: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'AB' },
        { id: 4, name: 'O' },
        { id: 5, name: 'A+' },
        { id: 6, name: 'A-' },
        { id: 7, name: 'B+' },
        { id: 8, name: 'B-' },
        { id: 9, name: 'AB+' },
        { id: 10, name: 'AB-' },
        { id: 11, name: 'O+' },
        { id: 12, name: 'O-' }
      ],
      citizenships: [
        { id: 1, name: 'WNI' },
        { id: 2, name: 'WNA' }
      ],
      familyRelationships: [
        { id: 1, name: 'KEPALA KELUARGA' },
        { id: 2, name: 'SUAMI' },
        { id: 3, name: 'ISTRI' },
        { id: 4, name: 'ANAK' },
        { id: 5, name: 'MENANTU' },
        { id: 6, name: 'CUCU' },
        { id: 7, name: 'ORANG TUA' },
        { id: 8, name: 'MERTUA' },
        { id: 9, name: 'FAMILI' },
        { id: 10, name: 'LAINNYA' }
      ],
      ageCategories: [
        { id: 1, name: 'Bayi', min_age: 0, max_age: 1 },
        { id: 2, name: 'Balita', min_age: 2, max_age: 5 },
        { id: 3, name: 'Anak-anak', min_age: 6, max_age: 12 },
        { id: 4, name: 'Remaja', min_age: 13, max_age: 17 },
        { id: 5, name: 'Dewasa Muda', min_age: 18, max_age: 30 },
        { id: 6, name: 'Dewasa', min_age: 31, max_age: 50 },
        { id: 7, name: 'Lansia', min_age: 51, max_age: 65 },
        { id: 8, name: 'Manula', min_age: 66, max_age: 999 }
      ]
    };
  }

  
  
  

  /**
   * Get all religions data
   * 
   * Mengambil data agama dari database dengan caching strategy.
   * Jika cache kosong, load dari database dan cache hasilnya.
   * Jika database error, gunakan fallback data.
   * 
   * CACHING STRATEGY:
   * 1. Check cache first
   * 2. Load from database jika cache kosong
   * 3. Cache hasil untuk subsequent calls
   * 4. Fallback ke hardcoded data jika error
   * 
   * @async
   * @returns {Promise<Array>} Array of religion objects dengan {id, name}
   * 
   * @example
   * const religions = await ReferenceService.getReligions();
   * // Returns: [{id: 1, name: 'Islam'}, {id: 2, name: 'Kristen'}, ...]
   */
  async getReligions() {
    // ========================================================================
    // CACHE CHECK
    // ========================================================================
    
    /**
     * Check cache first untuk performance
     * Return cached data jika available
     */
    if (this.cache.religions) {
      return this.cache.religions;
    }

    // ========================================================================
    // DATABASE LOADING
    // ========================================================================
    
    try {
      /**
       * Load data dari database
       * Order by ID untuk consistent ordering
       */
      const sql = 'SELECT id, name FROM religions ORDER BY id';
      const results = await db.query(sql);
      
      /**
       * Cache hasil untuk subsequent calls
       * Improve performance untuk future requests
       */
      this.cache.religions = results;
      return results;
    } catch (error) {
      /**
       * Database error: use fallback data
       * Log warning untuk monitoring
       */
      logger.warn('Failed to fetch religions from database, using fallback');
      return this.fallbackData.religions;
    }
  }

  /**
   * Get religion ID by name with fuzzy matching
   * 
   * Mencari ID agama berdasarkan nama dengan multiple matching strategies.
   * Menggunakan exact match, contains match, dan default fallback.
   * 
   * MATCHING STRATEGIES:
   * 1. Exact Match
   *    - Case-insensitive exact match
   *    - Highest priority
   * 
   * 2. Contains Match
   *    - Partial string matching
   *    - Bidirectional contains check
   * 
   * 3. Default Fallback
   *    - Return default ID (1) jika tidak ditemukan
   *    - Ensure function selalu return valid ID
   * 
   * @async
   * @param {string} name - Religion name untuk dicari
   * @returns {Promise<number|null>} Religion ID atau null jika name kosong
   * 
   * @example
   * const religionId = await ReferenceService.getReligionId('Islam');
   * // Returns: 1
   * 
   * const religionId2 = await ReferenceService.getReligionId('islam');
   * // Returns: 1 (case-insensitive)
   * 
   * const religionId3 = await ReferenceService.getReligionId('Kristen');
   * // Returns: 2
   */
  async getReligionId(name) {
    /**
     * Early return jika name kosong
     * Prevent unnecessary processing
     */
    if (!name) return null;

    // ========================================================================
    // DATA RETRIEVAL
    // ========================================================================
    
    /**
     * Get religions data (dengan caching)
     * Normalize input untuk consistent matching
     */
    const religions = await this.getReligions();
    const normalized = name.toUpperCase().trim();

    // ========================================================================
    // EXACT MATCH
    // ========================================================================
    
    /**
     * Try exact match first (highest priority)
     * Case-insensitive comparison
     */
    let religion = religions.find(r => r.name.toUpperCase() === normalized);
    if (religion) return religion.id;

    // ========================================================================
    // CONTAINS MATCH
    // ========================================================================
    
    /**
     * Try contains match (bidirectional)
     * Handle partial matches dan variations
     */
    religion = religions.find(r => r.name.toUpperCase().includes(normalized) || normalized.includes(r.name.toUpperCase()));
    if (religion) return religion.id;

    // ========================================================================
    // DEFAULT FALLBACK
    // ========================================================================
    
    /**
     * Return default ID jika tidak ditemukan
     * Ensure function selalu return valid ID
     */
    return 1;
  }

  
  
  

  async getEducations() {
    if (this.cache.educations) {
      return this.cache.educations;
    }

    try {
      const sql = 'SELECT id, name FROM educations ORDER BY id';
      const results = await db.query(sql);
      this.cache.educations = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch educations from database, using fallback');
      return this.fallbackData.educations;
    }
  }

  async getEducationId(name) {
    if (!name) return null;

    const educations = await this.getEducations();
    const normalized = name.toUpperCase().trim();

    
    const educationMap = {
      'TIDAK': 'TIDAK/BELUM SEKOLAH',
      'BELUM': 'TIDAK/BELUM SEKOLAH',
      'SD': 'SD/SEDERAJAT',
      'SEKOLAH DASAR': 'SD/SEDERAJAT',
      'SMP': 'SMP/SEDERAJAT',
      'SLTP': 'SMP/SEDERAJAT',
      'SMA': 'SLTA/SEDERAJAT',
      'SLTA': 'SLTA/SEDERAJAT',
      'SMK': 'SLTA/SEDERAJAT',
      'D1': 'DIPLOMA I',
      'D2': 'DIPLOMA II',
      'D3': 'DIPLOMA III',
      'D4': 'DIPLOMA IV',
      'S1': 'STRATA I',
      'S2': 'STRATA II',
      'S3': 'STRATA III'
    };

    
    const mappedName = educationMap[normalized];
    if (mappedName) {
      const education = educations.find(e => e.name.toUpperCase() === mappedName);
      if (education) return education.id;
    }

    
    let education = educations.find(e => e.name.toUpperCase() === normalized);
    if (education) return education.id;

    
    education = educations.find(e =>
      e.name.toUpperCase().includes(normalized) ||
      normalized.includes(e.name.toUpperCase())
    );
    if (education) return education.id;

    
    return 1;
  }

  
  
  

  async getOccupations() {
    if (this.cache.occupations) {
      return this.cache.occupations;
    }

    try {
      const sql = 'SELECT id, name FROM occupations ORDER BY id';
      const results = await db.query(sql);
      this.cache.occupations = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch occupations from database, using fallback');
      return this.fallbackData.occupations;
    }
  }

  async getOccupationId(name) {
    if (!name) return null;

    const occupations = await this.getOccupations();
    const normalized = name.toUpperCase().trim();

    
    let occupation = occupations.find(o => o.name.toUpperCase() === normalized);
    if (occupation) return occupation.id;

    
    occupation = occupations.find(o =>
      o.name.toUpperCase().includes(normalized) ||
      normalized.includes(o.name.toUpperCase())
    );
    if (occupation) return occupation.id;

    return null;
  }

  
  
  

  async getMaritalStatuses() {
    if (this.cache.maritalStatuses) {
      return this.cache.maritalStatuses;
    }

    try {
      const sql = 'SELECT id, name FROM marital_statuses ORDER BY id';
      const results = await db.query(sql);
      this.cache.maritalStatuses = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch marital statuses from database, using fallback');
      return this.fallbackData.maritalStatuses;
    }
  }

  async getMaritalStatusId(name) {
    if (!name) return null;

    const statuses = await this.getMaritalStatuses();
    const normalized = name.toUpperCase().trim();

    
    let status = statuses.find(s => s.name.toUpperCase() === normalized);
    if (status) return status.id;

    
    status = statuses.find(s =>
      s.name.toUpperCase().includes(normalized) ||
      normalized.includes(s.name.toUpperCase())
    );
    if (status) return status.id;

    
    return 1;
  }

  
  
  

  async getBloodTypes() {
    if (this.cache.bloodTypes) {
      return this.cache.bloodTypes;
    }

    try {
      const sql = 'SELECT id, name FROM blood_types ORDER BY id';
      const results = await db.query(sql);
      this.cache.bloodTypes = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch blood types from database, using fallback');
      return this.fallbackData.bloodTypes;
    }
  }

  async getBloodTypeId(name) {
    if (!name) return null;

    const bloodTypes = await this.getBloodTypes();
    const normalized = name.toUpperCase().trim();

    const bloodType = bloodTypes.find(b => b.name.toUpperCase() === normalized);
    return bloodType ? bloodType.id : null;
  }

  
  
  

  async getCitizenships() {
    if (this.cache.citizenships) {
      return this.cache.citizenships;
    }

    try {
      const sql = 'SELECT id, name FROM citizenships ORDER BY id';
      const results = await db.query(sql);
      this.cache.citizenships = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch citizenships from database, using fallback');
      return this.fallbackData.citizenships;
    }
  }

  async getCitizenshipId(name) {
    if (!name) return 1; 

    const citizenships = await this.getCitizenships();
    const normalized = name.toUpperCase().trim();

    const citizenship = citizenships.find(c => c.name.toUpperCase() === normalized);
    return citizenship ? citizenship.id : 1; 
  }

  
  
  

  async getFamilyRelationships() {
    if (this.cache.familyRelationships) {
      return this.cache.familyRelationships;
    }

    try {
      const sql = 'SELECT id, name FROM family_relationships ORDER BY id';
      const results = await db.query(sql);
      this.cache.familyRelationships = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch family relationships from database, using fallback');
      return this.fallbackData.familyRelationships;
    }
  }

  async getFamilyRelationshipId(name) {
    if (!name) return null;

    const relationships = await this.getFamilyRelationships();
    const normalized = name.toUpperCase().trim();

    
    const relationshipMap = {
      'KEPALA': 'KEPALA KELUARGA',
      'KK': 'KEPALA KELUARGA',
      'ORANGTUA': 'ORANG TUA',
      'ORANG TUA': 'ORANG TUA',
      'FAMILI LAIN': 'FAMILI',
      'LAIN': 'LAINNYA'
    };

    
    const mappedName = relationshipMap[normalized];
    if (mappedName) {
      const relationship = relationships.find(r => r.name.toUpperCase() === mappedName);
      if (relationship) return relationship.id;
    }

    
    let relationship = relationships.find(r => r.name.toUpperCase() === normalized);
    if (relationship) return relationship.id;

    
    relationship = relationships.find(r =>
      r.name.toUpperCase().includes(normalized) ||
      normalized.includes(r.name.toUpperCase())
    );
    if (relationship) return relationship.id;

    return null;
  }

  
  
  

  async getAgeCategories() {
    if (this.cache.ageCategories) {
      return this.cache.ageCategories;
    }

    try {
      const sql = 'SELECT id, name, min_age, max_age FROM age_categories ORDER BY min_age';
      const results = await db.query(sql);
      this.cache.ageCategories = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch age categories from database, using fallback');
      return this.fallbackData.ageCategories;
    }
  }

  async getAgeCategoryId(age) {
    if (age === null || age === undefined) return null;

    const categories = await this.getAgeCategories();

    const category = categories.find(c => age >= c.min_age && age <= c.max_age);
    return category ? category.id : null;
  }

  
  
  

  async getAllReferences() {
    return {
      religions: await this.getReligions(),
      educations: await this.getEducations(),
      occupations: await this.getOccupations(),
      maritalStatuses: await this.getMaritalStatuses(),
      bloodTypes: await this.getBloodTypes(),
      citizenships: await this.getCitizenships(),
      familyRelationships: await this.getFamilyRelationships(),
      ageCategories: await this.getAgeCategories()
    };
  }

  clearCache() {
    this.cache = {
      religions: null,
      educations: null,
      occupations: null,
      maritalStatuses: null,
      bloodTypes: null,
      citizenships: null,
      familyRelationships: null,
      ageCategories: null
    };
    logger.info('Reference cache cleared');
  }
}

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * CACHING STRATEGY:
 * -----------------
 * 1. Lazy Loading
 *    - Load data dari database saat pertama kali diakses
 *    - Cache di memory untuk subsequent calls
 *    - Reduce database load dan improve performance
 *    - Cache invalidation untuk data refresh
 *
 * 2. Fallback Data
 *    - Hardcoded fallback data jika database error
 *    - Ensure service tetap berfungsi
 *    - Log warnings untuk monitoring
 *    - Graceful degradation
 *
 * 3. Memory Management
 *    - Monitor cache size dan memory usage
 *    - Implement cache cleanup jika diperlukan
 *    - Handle memory leaks
 *    - Optimize cache structure
 *
 * DATA LOOKUP & MATCHING:
 * ------------------------
 * 1. Fuzzy Matching
 *    - Exact match (highest priority)
 *    - Contains match (bidirectional)
 *    - Partial string matching
 *    - Case-insensitive comparison
 *
 * 2. Normalization
 *    - Uppercase conversion untuk consistency
 *    - Trim whitespace
 *    - Handle special characters
 *    - Standardize input format
 *
 * 3. Default Values
 *    - Provide sensible defaults
 *    - Ensure function selalu return valid data
 *    - Handle missing atau invalid input
 *    - Graceful error handling
 *
 * DATABASE INTEGRATION:
 * ---------------------
 * 1. Query Optimization
 *    - Use appropriate indexes
 *    - Optimize SQL queries
 *    - Connection pooling
 *    - Error handling
 *
 * 2. Error Handling
 *    - Database connection errors
 *    - Query execution errors
 *    - Data validation errors
 *    - Fallback mechanisms
 *
 * 3. Data Consistency
 *    - Validate data integrity
 *    - Handle missing data
 *    - Ensure data consistency
 *    - Monitor data quality
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * 1. Caching Benefits
 *    - Reduce database calls
 *    - Improve response times
 *    - Lower database load
 *    - Better scalability
 *
 * 2. Lookup Optimization
 *    - Efficient search algorithms
 *    - Early returns
 *    - Optimized data structures
 *    - Memory usage optimization
 *
 * 3. Monitoring
 *    - Cache hit rates
 *    - Database query performance
 *    - Memory usage patterns
 *    - Error rates
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk caching logic
 * [ ] Integration tests dengan database
 * [ ] Fuzzy matching accuracy tests
 * [ ] Fallback data validation tests
 * [ ] Performance tests untuk cache
 * [ ] Error scenario testing
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. Cache Metrics
 *    - Cache hit/miss rates
 *    - Cache size dan memory usage
 *    - Cache invalidation frequency
 *    - Performance improvements
 *
 * 2. Database Metrics
 *    - Query execution times
 *    - Database connection health
 *    - Error rates dan types
 *    - Fallback usage frequency
 *
 * 3. Lookup Metrics
 *    - Lookup success rates
 *    - Matching accuracy
 *    - Default value usage
 *    - Performance metrics
 *
 * RELATED FILES:
 * --------------
 * - src/config/database.js: Database connection
 * - src/utils/logger.js: Logging utilities
 * - src/services/AutoCreateService.js: Data creation service
 * - src/services/GeminiOcrService.js: OCR processing
 *
 * ============================================================================
 */

module.exports = new ReferenceService();
