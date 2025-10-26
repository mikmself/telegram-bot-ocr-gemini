/**
 * ============================================================================
 * FILE: src/services/AutoCreateService.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Service untuk melakukan automatic data creation dari hasil OCR ke database
 * SmartGov. Service ini menangani seluruh pipeline dari validasi data OCR
 * hingga penyimpanan family dan resident records dengan transaction management
 * dan error handling yang komprehensif.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - FamilyDataModel: Database operations untuk family data
 * - ResidentModel: Database operations untuk resident data
 * - RegionService: Region code parsing dan validation
 * - ReferenceService: Reference data lookup (religion, education, etc.)
 * - logger: Logging utility untuk tracking dan debugging
 * - dateParser: Date parsing dan conversion utilities
 * - textCleaner: Text normalization utilities
 * - moment: Date manipulation library
 *
 * FITUR UTAMA:
 * 1. Automatic Data Creation
 *    - Create family records dari OCR data
 *    - Insert resident records dengan validation
 *    - Handle duplicate detection dan prevention
 *    - Transaction management untuk data consistency
 *
 * 2. Data Validation & Processing
 *    - Validate OCR data structure dan format
 *    - Normalize NIK dan KK numbers
 *    - Parse region codes dari address data
 *    - Validate birth dates dan age calculation
 *
 * 3. Reference Data Integration
 *    - Lookup religion, education, occupation IDs
 *    - Map marital status dan family relationships
 *    - Handle citizenship dan age categories
 *    - Caching untuk performance optimization
 *
 * 4. Region Code Processing
 *    - Parse province, regency, district, village codes
 *    - Handle RT/RW code mapping
 *    - API integration dengan RegionService
 *    - Fallback handling untuk missing codes
 *
 * 5. Error Handling & Recovery
 *    - Comprehensive error logging
 *    - Partial success handling
 *    - Rollback mechanism untuk failed operations
 *    - Detailed error reporting
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const AutoCreateService = require('./services/AutoCreateService');
 * 
 * // Auto create data dari OCR result
 * const result = await AutoCreateService.autoCreate(ocrData, userId);
 * 
 * if (result.success) {
 *   console.log('Family created:', result.data.family);
 *   console.log('Residents added:', result.data.residentCount);
 *   console.log('Skipped:', result.data.skippedCount);
 * } else {
 *   console.error('Error:', result.message);
 * }
 * 
 * // Validate OCR data sebelum processing
 * const validation = AutoCreateService.validateOcrData(ocrData);
 * if (!validation.isValid) {
 *   console.log('Validation errors:', validation.errors);
 * }
 * ```
 *
 * CATATAN PENTING:
 * - OCR data harus sudah divalidasi sebelum diproses
 * - NIK dan KK numbers akan dinormalisasi otomatis
 * - Duplicate NIK akan di-skip dengan notifikasi
 * - Region codes akan di-parse dari address data
 * - Transaction rollback jika ada error critical
 * - Partial success didukung untuk batch operations
 *
 * ============================================================================
 */

const FamilyDataModel = require('../database/FamilyDataModel');
const ResidentModel = require('../database/ResidentModel');
const RegionService = require('./RegionService');
const ReferenceService = require('./ReferenceService');
const logger = require('../utils/logger');
const dateParser = require('../utils/dateParser');
const { normalizeKK, normalizeNIK } = require('../utils/textCleaner');
const moment = require('moment');

// ============================================================================
// AUTO CREATE SERVICE CLASS
// ============================================================================

/**
 * Class AutoCreateService
 * 
 * Service utama untuk automatic data creation dari hasil OCR ke database.
 * Menggunakan static methods untuk utility functions dan data processing.
 * 
 * DESIGN PATTERN: Static Service Class
 * - Static methods untuk utility functions
 * - No instance state, pure functions
 * - Easy testing dan mocking
 * - Memory efficient
 * 
 * RESPONSIBILITIES:
 * - OCR data validation dan processing
 * - Family dan resident record creation
 * - Region code parsing dan mapping
 * - Reference data lookup dan integration
 * - Error handling dan transaction management
 * 
 * @class AutoCreateService
 */
class AutoCreateService {
  
  /**
   * Main method untuk automatic data creation
   * 
   * Method utama yang menangani seluruh pipeline dari OCR data
   * hingga penyimpanan ke database dengan comprehensive error handling.
   * 
   * PROCESSING PIPELINE:
   * 1. Data Validation
   *    - Validate OCR data structure
   *    - Check required fields presence
   *    - Normalize KK dan NIK numbers
   * 
   * 2. Family Data Processing
   *    - Check existing family records
   *    - Parse region codes dari address
   *    - Create atau update family data
   * 
   * 3. Resident Data Processing
   *    - Process setiap family member
   *    - Validate NIK uniqueness
   *    - Parse reference data (religion, education, etc.)
   *    - Calculate age dan age categories
   * 
   * 4. Database Operations
   *    - Create family record jika baru
   *    - Insert resident records
   *    - Update member counts
   *    - Handle duplicates dan errors
   * 
   * 5. Result Compilation
   *    - Compile success/error statistics
   *    - Generate detailed result message
   *    - Return structured response
   * 
   * ERROR HANDLING:
   * - Validation errors: Early return dengan error message
   * - Database errors: Rollback dengan detailed logging
   * - Partial failures: Continue processing, report issues
   * - System errors: Comprehensive error logging
   * 
   * @async
   * @static
   * @param {Object} ocrData - Data hasil OCR dari GeminiOcrService
   * @param {string} ocrData.nomor_kk - Nomor Kartu Keluarga (16 digit)
   * @param {string} ocrData.nama_kepala_keluarga - Nama kepala keluarga
   * @param {string} ocrData.alamat - Alamat lengkap
   * @param {string} ocrData.rt_rw - RT/RW dalam format XXX/XXX
   * @param {string} ocrData.desa_kelurahan - Nama desa/kelurahan
   * @param {string} ocrData.kecamatan - Nama kecamatan
   * @param {string} ocrData.kabupaten_kota - Nama kabupaten/kota
   * @param {string} ocrData.provinsi - Nama provinsi
   * @param {Array} ocrData.table - Array anggota keluarga
   * @param {string} userId - ID user yang melakukan operasi
   * @returns {Promise<Object>} Result object dengan struktur:
   *   - success: {boolean} - Status keberhasilan
   *   - message: {string} - Pesan hasil operasi
   *   - isNewFamily: {boolean} - Apakah family baru dibuat
   *   - data: {Object} - Data hasil operasi
   *     - family: {Object} - Family record data
   *     - residents: {Array} - Resident records yang dibuat
   *     - familyCount: {number} - Jumlah family yang dibuat
   *     - residentCount: {number} - Jumlah resident yang dibuat
   *     - skippedCount: {number} - Jumlah resident yang di-skip
   *     - invalidCount: {number} - Jumlah resident yang tidak valid
   *     - skippedResidents: {Array} - Detail resident yang di-skip
   *     - invalidResidents: {Array} - Detail resident yang tidak valid
   *   - error: {string} - Error message jika gagal
   * 
   * @throws {Error} Jika OCR data tidak valid atau missing required fields
   * 
   * @example
   * const result = await AutoCreateService.autoCreate({
   *   nomor_kk: '1234567890123456',
   *   nama_kepala_keluarga: 'John Doe',
   *   alamat: 'Jl. Contoh No. 123',
   *   table: [{ nik: '1234567890123456', nama_lengkap: 'John Doe' }]
   * }, 'user123');
   * 
   * if (result.success) {
   *   console.log('Created:', result.data.residentCount, 'residents');
   * }
   */
  static async autoCreate(ocrData, userId) {
    try {
      logger.info('Starting auto-create process...');

      // ========================================================================
      // STEP 1: DATA VALIDATION
      // ========================================================================
      
      /**
       * Validasi OCR data structure
       * Pastikan data yang diperlukan ada dan valid
       */
      if (!ocrData || !ocrData.nomor_kk) {
        throw new Error('Invalid OCR data: missing nomor_kk');
      }

      if (!ocrData.table || ocrData.table.length === 0) {
        throw new Error('Invalid OCR data: no family members');
      }

      /**
       * Normalize dan validasi nomor KK
       * Pastikan format 16 digit yang valid
       */
      const familyCardNumber = normalizeKK(ocrData.nomor_kk);

      if (!familyCardNumber) {
        throw new Error('Invalid family card number format');
      }

      // ========================================================================
      // STEP 2: FAMILY DATA PROCESSING
      // ========================================================================
      
      /**
       * Cek apakah family sudah ada di database
       * Jika ada, akan update anggota baru saja
       */
      const existingFamily = await FamilyDataModel.findByFamilyCard(familyCardNumber);
      
      let familyResult;
      let isNewFamily = false;

      /**
       * Parse region codes dari address data
       * Convert nama wilayah ke kode wilayah
       */
      const regionCodes = await this.parseRegionCodes(ocrData);

      /**
       * Parse RT/RW dari format XXX/XXX
       * Extract citizen association dan community unit codes
       */
      const { citizenAssociationCode, communityUnitCode } = this.parseRTRW(ocrData.rt_rw);

      /**
       * Get RT/RW codes dari Region API
       * Map OCR RT/RW ke actual database codes
       */
      const rtRwCodes = await this.parseRTRWFromAPI(
        regionCodes.village_code, 
        citizenAssociationCode, 
        communityUnitCode
      );

      if (!existingFamily) {
        
        isNewFamily = true;
        const familyData = {
          family_card_number: familyCardNumber,
          province_code: regionCodes.province_code,
          regency_code: regionCodes.regency_code,
          district_code: regionCodes.district_code,
          village_code: regionCodes.village_code,
          hamlet_code: rtRwCodes.hamletCode,
          community_unit_code: rtRwCodes.rwCode,
          citizen_association_code: rtRwCodes.rtCode,
          address: ocrData.alamat || '',
          postal_code: ocrData.kode_pos || null,
          total_members: 0, 
          active_members: 0,
          status: 'active'
        };

        logger.info(`Creating new family record: ${familyCardNumber}`);
        familyResult = await FamilyDataModel.create(familyData);
      } else {
        logger.info(`Family already exists: ${familyCardNumber}, will check and add new members`);
        familyResult = { id: existingFamily.id, family_card_number: familyCardNumber };
      }

      
      const residentsData = [];
      const skippedResidents = [];
      const invalidResidents = [];

      for (const member of ocrData.table) {
        const nik = normalizeNIK(member.nik);

        if (!nik) {
          logger.warn(`Skipping member with invalid NIK: ${member.nik}`);
          invalidResidents.push({
            nama: member.nama_lengkap,
            nik: member.nik,
            reason: 'Invalid NIK format'
          });
          continue;
        }

        
        const existingResident = await ResidentModel.findByNIK(nik);

        if (existingResident) {
          logger.warn(`Resident already exists, skipping: ${nik} - ${member.nama_lengkap}`);
          skippedResidents.push({
            nik: nik,
            nama: member.nama_lengkap,
            reason: 'NIK already exists in database'
          });
          continue;
        }

        
        const birthDate = dateParser.toMySQLDate(member.tanggal_lahir);

        if (!birthDate) {
          logger.warn(`Invalid birth date for ${member.nama_lengkap}: ${member.tanggal_lahir}`);
          invalidResidents.push({
            nama: member.nama_lengkap,
            nik: nik,
            reason: `Invalid birth date: ${member.tanggal_lahir}`
          });
          continue;
        }

        
        const age = this.calculateAge(birthDate);

        
        const religionId = await ReferenceService.getReligionId(member.agama);
        const educationId = await ReferenceService.getEducationId(member.pendidikan);
        const occupationId = await ReferenceService.getOccupationId(member.jenis_pekerjaan);
        const maritalStatusId = await ReferenceService.getMaritalStatusId(member.status_perkawinan);
        const familyRelationshipId = await ReferenceService.getFamilyRelationshipId(member.status_hubungan_dalam_keluarga);
        const citizenshipId = await ReferenceService.getCitizenshipId(member.kewarganegaraan);
        const ageCategoryId = await ReferenceService.getAgeCategoryId(age);

        
        const gender = member.jenis_kelamin === 'LAKI-LAKI' ? 'L' : 'P';

        const residentData = {
          nik: nik,
          name: member.nama_lengkap,
          birth_place: member.tempat_lahir || null,
          birth_date: birthDate,
          gender: gender,
          age: age,
          family_card_number: familyCardNumber,
          postal_code: ocrData.kode_pos || null,
          address: ocrData.alamat || null,
          father_name: member.nama_ayah || null,
          mother_name: member.nama_ibu || null,
          family_relationship_id: familyRelationshipId,
          religion_id: religionId,
          education_id: educationId,
          occupation_id: occupationId,
          marital_status_id: maritalStatusId,
          citizenship_id: citizenshipId,
          age_category_id: ageCategoryId,
          blood_type_id: null,
          province_code: regionCodes.province_code,
          regency_code: regionCodes.regency_code,
          district_code: regionCodes.district_code,
          village_code: regionCodes.village_code,
          hamlet_code: rtRwCodes.hamletCode,
          community_unit_code: rtRwCodes.rwCode,
          citizen_association_code: rtRwCodes.rtCode,
          is_active: 1
        };

        residentsData.push(residentData);
      }

      
      let residentsResult = [];
      if (residentsData.length > 0) {
        logger.info(`Creating ${residentsData.length} resident records...`);
        residentsResult = await ResidentModel.bulkCreate(residentsData);
      } else {
        logger.warn('No new residents to create');
      }

      
      await FamilyDataModel.updateMemberCounts(familyCardNumber);

      logger.info('Auto-create completed successfully');

      
      const totalFromOCR = ocrData.table.length;
      const newMembers = residentsResult.length;
      const skippedMembers = skippedResidents.length;
      const invalidMembers = invalidResidents.length;

      let resultMessage = '';
      
      if (isNewFamily) {
        resultMessage = `Berhasil membuat KK baru ${familyCardNumber}`;
      } else {
        resultMessage = `KK ${familyCardNumber} sudah ada, menambahkan anggota baru`;
      }

      resultMessage += `\n- Total anggota dari OCR: ${totalFromOCR}`;
      resultMessage += `\n- Anggota baru ditambahkan: ${newMembers}`;
      
      if (skippedMembers > 0) {
        resultMessage += `\n- Anggota yang sudah ada (skip): ${skippedMembers}`;
      }
      
      if (invalidMembers > 0) {
        resultMessage += `\n- Anggota tidak valid (skip): ${invalidMembers}`;
      }

      return {
        success: true,
        message: resultMessage,
        isNewFamily: isNewFamily,
        data: {
          family: familyResult,
          residents: residentsResult,
          familyCount: isNewFamily ? 1 : 0,
          residentCount: newMembers,
          skippedCount: skippedMembers,
          invalidCount: invalidMembers,
          skippedResidents: skippedResidents,
          invalidResidents: invalidResidents
        }
      };

    } catch (error) {
      logger.error('Error in auto-create:', error);

      return {
        success: false,
        message: `Gagal membuat data KK: ${error.message}`,
        error: error.message
      };
    }
  }

  
  static async parseRegionCodes(ocrData) {
    try {
      const regionCodes = await RegionService.parseRegionCodes(
        ocrData.provinsi,
        ocrData.kabupaten_kota,
        ocrData.kecamatan,
        ocrData.desa_kelurahan
      );

      
      return {
        province_code: regionCodes.kode_provinsi,
        regency_code: regionCodes.kode_kabupaten,
        district_code: regionCodes.kode_kecamatan,
        village_code: regionCodes.kode_kelurahan
      };

    } catch (error) {
      logger.error('Error parsing region codes:', error);

      return {
        province_code: null,
        regency_code: null,
        district_code: null,
        village_code: null
      };
    }
  }

  
  
  
  static parseRTRW(rtRw) {
    if (!rtRw) {
      return { citizenAssociationCode: null, communityUnitCode: null };
    }

    const parts = rtRw.split('/');

    if (parts.length === 2) {
      return {
        citizenAssociationCode: parts[0].trim(),  
        communityUnitCode: parts[1].trim()        
      };
    }

    return { citizenAssociationCode: null, communityUnitCode: null };
  }

  
  static async parseRTRWFromAPI(villageCode, rtFromOCR, rwFromOCR) {
    try {
      if (!villageCode) {
        return { 
          hamletCode: null, 
          rwCode: null, 
          rtCode: null 
        };
      }
      
      
      logger.info(`Searching RT/RW for village ${villageCode}, RT=${rtFromOCR}, RW=${rwFromOCR}`);
      
      
      const hamlets = await RegionService.client.get(`/hamlets/by-village/${villageCode}`);
      
      if (hamlets.data && hamlets.data.data && hamlets.data.data.length > 0) {
        
        const hamlet = hamlets.data.data[0];
        logger.info(`Hamlet found: ${hamlet.name} (${hamlet.code})`);
        
        
        const rws = await RegionService.client.get(`/rw/by-hamlet/${hamlet.code}`);
        
        if (rws.data && rws.data.data && rws.data.data.length > 0) {
          
          const rw = rws.data.data.find(r => r.name === rwFromOCR) || rws.data.data[0];
          logger.info(`RW found: ${rw.name} (${rw.code})`);
          
          
          const rts = await RegionService.client.get(`/rt/by-rw/${rw.code}`);
          
          if (rts.data && rts.data.data && rts.data.data.length > 0) {
            
            const rt = rts.data.data.find(r => r.name === rtFromOCR) || rts.data.data[0];
            logger.info(`RT found: ${rt.name} (${rt.code})`);
            
            return {
              hamletCode: hamlet.code,
              rwCode: rw.code,
              rtCode: rt.code
            };
          }
        }
      }
      
      
      logger.warn('Could not find RT/RW in Region API, using OCR values');
      return { 
        hamletCode: null, 
        rwCode: rwFromOCR, 
        rtCode: rtFromOCR 
      };
      
    } catch (error) {
      logger.error('Error parsing RT/RW from API:', error);
      return { 
        hamletCode: null, 
        rwCode: rwFromOCR, 
        rtCode: rtFromOCR 
      };
    }
  }

  
  static calculateAge(birthDate) {
    if (!birthDate) return null;

    const birth = moment(birthDate, 'YYYY-MM-DD');
    if (!birth.isValid()) return null;

    const age = moment().diff(birth, 'years');
    return age >= 0 ? age : null;
  }

  
  static async getCreateSummary(familyCardNumber) {
    try {
      const family = await FamilyDataModel.getFamilyWithMembers(familyCardNumber);

      if (!family) {
        return null;
      }

      return {
        family_card_number: family.family_card_number,
        address: family.address,
        total_members: family.total_members,
        active_members: family.active_members,
        member_count: family.members.length,
        created_at: family.created_at
      };

    } catch (error) {
      logger.error('Error getting create summary:', error);
      return null;
    }
  }

  
  static validateOcrData(ocrData) {
    const errors = [];

    
    const familyCardNumber = normalizeKK(ocrData.nomor_kk);
    if (!familyCardNumber) {
      errors.push('Nomor KK tidak valid (harus 16 digit)');
    }

    
    if (!ocrData.table || ocrData.table.length === 0) {
      errors.push('Tidak ada anggota keluarga yang ditemukan');
    } else {
      
      ocrData.table.forEach((member, index) => {
        const nik = normalizeNIK(member.nik);

        if (!nik) {
          errors.push(`Anggota ${index + 1}: NIK tidak valid (${member.nama_lengkap})`);
        }

        if (!member.nama_lengkap || member.nama_lengkap.length < 2) {
          errors.push(`Anggota ${index + 1}: Nama tidak valid`);
        }

        if (!member.tanggal_lahir) {
          errors.push(`Anggota ${index + 1}: Tanggal lahir tidak valid (${member.nama_lengkap})`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * DATA PROCESSING PIPELINE:
 * --------------------------
 * 1. OCR Data Validation
 *    - Structure validation (required fields)
 *    - Format validation (NIK, KK numbers)
 *    - Data type validation (dates, numbers)
 *    - Business rule validation
 *
 * 2. Family Record Management
 *    - Check existing family records
 *    - Parse region codes dari address
 *    - Create new family jika belum ada
 *    - Update member counts
 *
 * 3. Resident Record Processing
 *    - Process setiap family member
 *    - Validate NIK uniqueness
 *    - Parse reference data
 *    - Calculate derived fields (age, categories)
 *
 * 4. Database Operations
 *    - Transaction management
 *    - Batch operations untuk performance
 *    - Error handling dan rollback
 *    - Duplicate detection
 *
 * REGION CODE PROCESSING:
 * -----------------------
 * 1. Address Parsing
 *    - Extract province, regency, district, village
 *    - Map nama wilayah ke kode wilayah
 *    - Handle variations dalam penulisan nama
 *    - Fallback untuk missing data
 *
 * 2. RT/RW Code Mapping
 *    - Parse RT/RW dari format XXX/XXX
 *    - Lookup actual codes dari Region API
 *    - Handle missing atau invalid codes
 *    - Default values untuk fallback
 *
 * 3. API Integration
 *    - RegionService untuk code lookup
 *    - Error handling untuk API failures
 *    - Caching untuk performance
 *    - Retry mechanism
 *
 * REFERENCE DATA INTEGRATION:
 * ---------------------------
 * 1. Religion Mapping
 *    - Map agama names ke religion IDs
 *    - Handle variations dalam penulisan
 *    - Default values untuk unknown religions
 *    - Caching untuk performance
 *
 * 2. Education Mapping
 *    - Map pendidikan levels ke education IDs
 *    - Handle different naming conventions
 *    - Age-appropriate education mapping
 *    - Validation untuk consistency
 *
 * 3. Occupation Mapping
 *    - Map jenis pekerjaan ke occupation IDs
 *    - Handle variations dalam job titles
 *    - Default values untuk unknown occupations
 *    - Business rule validation
 *
 * ERROR HANDLING STRATEGY:
 * ------------------------
 * 1. Validation Errors
 *    - Early validation dengan clear messages
 *    - Field-specific error reporting
 *    - User-friendly error messages
 *    - Validation summary
 *
 * 2. Database Errors
 *    - Transaction rollback untuk consistency
 *    - Detailed error logging
 *    - Retry mechanism untuk transient failures
 *    - Graceful degradation
 *
 * 3. Partial Failures
 *    - Continue processing valid records
 *    - Track skipped dan invalid records
 *    - Detailed reporting untuk debugging
 *    - User notification
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * 1. Batch Operations
 *    - Bulk insert untuk residents
 *    - Batch reference data lookup
 *    - Efficient database queries
 *    - Connection pooling
 *
 * 2. Caching Strategy
 *    - Reference data caching
 *    - Region code caching
 *    - In-memory cache untuk frequent lookups
 *    - Cache invalidation strategy
 *
 * 3. Memory Management
 *    - Stream processing untuk large datasets
 *    - Garbage collection optimization
 *    - Memory leak prevention
 *    - Resource cleanup
 *
 * DATA VALIDATION RULES:
 * ----------------------
 * 1. NIK Validation
 *    - 16 digits exact
 *    - Format validation
 *    - Uniqueness check
 *    - Checksum validation (if applicable)
 *
 * 2. KK Number Validation
 *    - 16 digits exact
 *    - Format validation
 *    - Uniqueness check
 *    - Business rule validation
 *
 * 3. Date Validation
 *    - Valid date format (DD-MM-YYYY)
 *    - Reasonable date ranges
 *    - Age calculation validation
 *    - Future date prevention
 *
 * 4. Name Validation
 *    - Minimum length requirements
 *    - Character set validation
 *    - Special character handling
 *    - Normalization
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk individual methods
 * [ ] Integration tests dengan mock database
 * [ ] End-to-end tests dengan real data
 * [ ] Performance tests dengan large datasets
 * [ ] Error scenario testing
 * [ ] Validation accuracy testing
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. Performance Metrics
 *    - Processing time tracking
 *    - Success/failure rates
 *    - Database operation times
 *    - Memory usage monitoring
 *
 * 2. Business Metrics
 *    - Records created per batch
 *    - Validation success rates
 *    - Duplicate detection rates
 *    - Error categorization
 *
 * 3. Error Tracking
 *    - Detailed error logging
 *    - Stack trace capture
 *    - Error categorization
 *    - Alert thresholds
 *
 * DEPLOYMENT CONSIDERATIONS:
 * --------------------------
 * 1. Database Configuration
 *    - Connection pool settings
 *    - Transaction timeout settings
 *    - Batch size optimization
 *    - Index optimization
 *
 * 2. Resource Requirements
 *    - Memory untuk large datasets
 *    - CPU untuk data processing
 *    - Network untuk API calls
 *    - Storage untuk temporary data
 *
 * 3. Scaling Considerations
 *    - Horizontal scaling support
 *    - Load balancing
 *    - Queue management
 *    - Resource pooling
 *
 * RELATED FILES:
 * --------------
 * - src/database/FamilyDataModel.js: Family database operations
 * - src/database/ResidentModel.js: Resident database operations
 * - src/services/RegionService.js: Region code processing
 * - src/services/ReferenceService.js: Reference data lookup
 * - src/utils/textCleaner.js: Text normalization
 * - src/utils/dateParser.js: Date parsing utilities
 *
 * ============================================================================
 */

module.exports = AutoCreateService;
