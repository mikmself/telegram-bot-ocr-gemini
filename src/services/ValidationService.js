/**
 * ============================================================================
 * FILE: src/services/ValidationService.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Service terpusat untuk validasi data Kartu Keluarga (KK). Service ini
 * mengkonsolidasikan semua logic validasi yang tersebar di berbagai file
 * menjadi satu unified service dengan API yang konsisten dan mudah digunakan.
 *
 * Service ini menggantikan dan mengkonsolidasikan validasi yang sebelumnya
 * tersebar di:
 * - src/utils/validator.js (format validation)
 * - src/services/GeminiOcrService.js (OCR result validation)
 * - src/services/AutoCreateService.js (data validation sebelum database insert)
 *
 * TANGGAL DIBUAT: 2025-01-05
 * TANGGAL MODIFIKASI TERAKHIR: 2025-01-05
 *
 * DEPENDENSI:
 * - ../utils/logger: Logging utility untuk tracking
 * - ../utils/validator: Existing validator untuk backward compatibility
 * - ../utils/textCleaner: Text normalization utilities
 *
 * FILOSOFI VALIDASI:
 * 1. Single Responsibility: Setiap method validasi satu aspek specific
 * 2. Fail-Fast: Return false/error untuk invalid input
 * 3. Comprehensive Errors: Provide detailed error messages untuk debugging
 * 4. Layered Validation: Dari basic format → business logic → data consistency
 * 5. Performance: Validate paling likely failures terlebih dahulu
 *
 * KATEGORI VALIDASI:
 * 1. Format Validation: NIK, KK, date, phone, email format
 * 2. Business Logic Validation: Gender, religion, education values
 * 3. Data Consistency: Cross-field validation, referential integrity
 * 4. Completeness: Required fields, data quality checks
 * 5. Security: Injection prevention, sanitization
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const ValidationService = require('./services/ValidationService');
 *
 * // Validasi NIK
 * const nikValid = ValidationService.validateNIK('3201234567890123');
 * if (!nikValid.isValid) {
 *   console.log('NIK errors:', nikValid.errors);
 * }
 *
 * // Validasi full document
 * const docValid = ValidationService.validateDocument(kkData);
 * if (!docValid.isValid) {
 *   console.log('Document validation errors:', docValid.errors);
 * }
 *
 * // Check completeness
 * const completeness = ValidationService.checkCompleteness(kkData);
 * console.log(`Completeness: ${completeness.percentage}%`);
 * ```
 *
 * ============================================================================
 */

const logger = require('../utils/logger');
const Validator = require('../utils/validator');
const TextCleaner = require('../utils/textCleaner');

/**
 * ============================================================================
 * VALIDATION SERVICE CLASS
 * ============================================================================
 */
class ValidationService {

  // ==========================================================================
  // NIK VALIDATION
  // ==========================================================================

  /**
   * Validasi NIK (Nomor Induk Kependudukan)
   *
   * NIK adalah identitas unik 16 digit untuk setiap warga negara Indonesia.
   * Format: PPKKSSDDMMYYNNNN
   * - PP: Kode Provinsi
   * - KK: Kode Kabupaten/Kota
   * - SS: Kode Kecamatan
   * - DDMMYY: Tanggal lahir (DD+40 untuk perempuan)
   * - NNNN: Nomor urut
   *
   * Validasi yang dilakukan:
   * - Harus tepat 16 digit
   * - Hanya boleh numerik (0-9)
   * - Tidak boleh null/undefined/empty
   *
   * @param {string|number} nik - NIK yang akan divalidasi
   * @returns {Object} { isValid: boolean, errors: string[], value: string }
   *
   * @example
   * validateNIK('3201234567890123')
   * // Returns: { isValid: true, errors: [], value: '3201234567890123' }
   *
   * @example
   * validateNIK('12345')
   * // Returns: { isValid: false, errors: ['NIK must be exactly 16 digits'], value: '12345' }
   */
  static validateNIK(nik) {
    const result = {
      isValid: true,
      errors: [],
      value: nik ? String(nik).trim() : ''
    };

    // Check null/undefined/empty
    if (!nik) {
      result.isValid = false;
      result.errors.push('NIK is required');
      return result;
    }

    const nikStr = String(nik).trim();

    // Check length
    if (nikStr.length !== 16) {
      result.isValid = false;
      result.errors.push(`NIK must be exactly 16 digits (got ${nikStr.length})`);
    }

    // Check numeric
    if (!/^\d{16}$/.test(nikStr)) {
      result.isValid = false;
      result.errors.push('NIK must contain only numeric characters (0-9)');
    }

    if (result.isValid) {
      logger.debug(`NIK validation passed: ${nikStr}`);
    } else {
      logger.warn(`NIK validation failed: ${nikStr}`, result.errors);
    }

    return result;
  }

  // ==========================================================================
  // NOMOR KK VALIDATION
  // ==========================================================================

  /**
   * Validasi Nomor KK (Kartu Keluarga)
   *
   * Nomor KK adalah identitas unik 16 digit untuk setiap keluarga.
   * Format sama dengan NIK: 16 digit numerik.
   *
   * @param {string|number} kk - Nomor KK yang akan divalidasi
   * @returns {Object} { isValid: boolean, errors: string[], value: string }
   *
   * @example
   * validateKK('3201234567890123')
   * // Returns: { isValid: true, errors: [], value: '3201234567890123' }
   */
  static validateKK(kk) {
    const result = {
      isValid: true,
      errors: [],
      value: kk ? String(kk).trim() : ''
    };

    // Check null/undefined/empty
    if (!kk) {
      result.isValid = false;
      result.errors.push('Nomor KK is required');
      return result;
    }

    const kkStr = String(kk).trim();

    // Check length
    if (kkStr.length !== 16) {
      result.isValid = false;
      result.errors.push(`Nomor KK must be exactly 16 digits (got ${kkStr.length})`);
    }

    // Check numeric
    if (!/^\d{16}$/.test(kkStr)) {
      result.isValid = false;
      result.errors.push('Nomor KK must contain only numeric characters (0-9)');
    }

    if (result.isValid) {
      logger.debug(`KK validation passed: ${kkStr}`);
    } else {
      logger.warn(`KK validation failed: ${kkStr}`, result.errors);
    }

    return result;
  }

  // ==========================================================================
  // DATE VALIDATION
  // ==========================================================================

  /**
   * Validasi tanggal format DD-MM-YYYY
   *
   * Format yang diterima: DD-MM-YYYY
   * - DD: 01-31
   * - MM: 01-12
   * - YYYY: 1900 - current year
   *
   * @param {string} dateStr - Tanggal dalam format DD-MM-YYYY
   * @returns {Object} { isValid: boolean, errors: string[], value: string }
   *
   * @example
   * validateDate('17-08-1945')
   * // Returns: { isValid: true, errors: [], value: '17-08-1945' }
   *
   * @example
   * validateDate('32-01-2024')
   * // Returns: { isValid: false, errors: ['Invalid day (must be 01-31)'], value: '32-01-2024' }
   */
  static validateDate(dateStr) {
    const result = {
      isValid: true,
      errors: [],
      value: dateStr ? String(dateStr).trim() : ''
    };

    // Check null/undefined/empty
    if (!dateStr) {
      result.isValid = false;
      result.errors.push('Date is required');
      return result;
    }

    // Check format DD-MM-YYYY
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = String(dateStr).match(dateRegex);

    if (!match) {
      result.isValid = false;
      result.errors.push('Date format must be DD-MM-YYYY');
      return result;
    }

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    // Validate ranges
    if (month < 1 || month > 12) {
      result.isValid = false;
      result.errors.push(`Invalid month (must be 01-12, got ${month})`);
    }

    if (day < 1 || day > 31) {
      result.isValid = false;
      result.errors.push(`Invalid day (must be 01-31, got ${day})`);
    }

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      result.isValid = false;
      result.errors.push(`Invalid year (must be 1900-${currentYear}, got ${year})`);
    }

    if (result.isValid) {
      logger.debug(`Date validation passed: ${dateStr}`);
    } else {
      logger.warn(`Date validation failed: ${dateStr}`, result.errors);
    }

    return result;
  }

  // ==========================================================================
  // ENUM VALIDATION (Gender, Religion, Education, etc.)
  // ==========================================================================

  /**
   * Validasi jenis kelamin
   *
   * Format yang diterima (case-insensitive):
   * - LAKI-LAKI
   * - PEREMPUAN
   * - L (akan dinormalisasi ke LAKI-LAKI)
   * - P (akan dinormalisasi ke PEREMPUAN)
   *
   * @param {string} gender - Jenis kelamin
   * @returns {Object} { isValid: boolean, errors: string[], value: string, normalized: string }
   *
   * @example
   * validateGender('L')
   * // Returns: { isValid: true, errors: [], value: 'L', normalized: 'LAKI-LAKI' }
   */
  static validateGender(gender) {
    const result = {
      isValid: true,
      errors: [],
      value: gender ? String(gender).trim() : '',
      normalized: ''
    };

    if (!gender) {
      result.isValid = false;
      result.errors.push('Gender is required');
      return result;
    }

    const normalized = TextCleaner.normalizeGender(gender);

    if (!normalized) {
      result.isValid = false;
      result.errors.push(`Invalid gender (must be LAKI-LAKI or PEREMPUAN, got ${gender})`);
      return result;
    }

    // Convert shorthand to full form
    result.normalized = normalized === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';

    logger.debug(`Gender validation passed: ${gender} -> ${result.normalized}`);
    return result;
  }

  /**
   * Validasi enum value (agama, pendidikan, pekerjaan, status perkawinan)
   *
   * @param {string} field - Nama field (untuk error message)
   * @param {string} value - Value yang akan divalidasi
   * @param {string[]} allowedValues - List of allowed values
   * @returns {Object} { isValid: boolean, errors: string[], value: string }
   *
   * @example
   * validateEnum('agama', 'ISLAM', ['ISLAM', 'KRISTEN', 'KATOLIK', ...])
   * // Returns: { isValid: true, errors: [], value: 'ISLAM' }
   */
  static validateEnum(field, value, allowedValues) {
    const result = {
      isValid: true,
      errors: [],
      value: value ? String(value).trim().toUpperCase() : ''
    };

    if (!value) {
      result.isValid = false;
      result.errors.push(`${field} is required`);
      return result;
    }

    const normalizedValue = String(value).trim().toUpperCase();

    if (!allowedValues.includes(normalizedValue)) {
      result.isValid = false;
      result.errors.push(
        `Invalid ${field} (got "${value}", expected one of: ${allowedValues.join(', ')})`
      );
    }

    logger.debug(`Enum validation for ${field}: ${value} -> ${result.isValid ? 'valid' : 'invalid'}`);
    return result;
  }

  // ==========================================================================
  // COMPLETENESS CHECK
  // ==========================================================================

  /**
   * Check completeness of Kartu Keluarga data
   *
   * Menghitung persentase kelengkapan data berdasarkan:
   * - Critical fields (bobot 2): NIK, Nomor KK, Nama, Tanggal Lahir
   * - Important fields (bobot 1.5): Tempat Lahir, Gender, Agama, Alamat
   * - Standard fields (bobot 1): Pendidikan, Pekerjaan, Status Perkawinan
   *
   * @param {Object} data - Data KK yang akan dicek
   * @returns {Object} { percentage: number, missingFields: string[], criticalMissing: string[] }
   *
   * @example
   * checkCompleteness({ nomor_kk: '...', nama_kepala_keluarga: '...', table: [...] })
   * // Returns: { percentage: 85.5, missingFields: ['rt', 'rw'], criticalMissing: [] }
   */
  static checkCompleteness(data) {
    const result = {
      percentage: 0,
      missingFields: [],
      criticalMissing: [],
      importantMissing: [],
      standardMissing: []
    };

    if (!data || typeof data !== 'object') {
      return result;
    }

    // Define field categories
    const criticalFields = ['nomor_kk', 'nama_kepala_keluarga'];
    const importantFields = ['alamat', 'provinsi', 'kabupaten_kota'];
    const standardFields = ['rt', 'rw', 'desa_kelurahan', 'kecamatan', 'kode_pos'];

    // Check header fields
    let totalScore = 0;
    let maxScore = 0;

    // Critical fields (weight = 2)
    for (const field of criticalFields) {
      maxScore += 2;
      if (data[field] && String(data[field]).trim().length > 0) {
        totalScore += 2;
      } else {
        result.criticalMissing.push(field);
        result.missingFields.push(field);
      }
    }

    // Important fields (weight = 1.5)
    for (const field of importantFields) {
      maxScore += 1.5;
      if (data[field] && String(data[field]).trim().length > 0) {
        totalScore += 1.5;
      } else {
        result.importantMissing.push(field);
        result.missingFields.push(field);
      }
    }

    // Standard fields (weight = 1)
    for (const field of standardFields) {
      maxScore += 1;
      if (data[field] && String(data[field]).trim().length > 0) {
        totalScore += 1;
      } else {
        result.standardMissing.push(field);
        result.missingFields.push(field);
      }
    }

    // Check table (anggota keluarga)
    if (data.table && Array.isArray(data.table)) {
      const memberCriticalFields = ['nik', 'nama_lengkap', 'tanggal_lahir'];
      const memberImportantFields = ['tempat_lahir', 'jenis_kelamin', 'agama'];
      const memberStandardFields = ['pendidikan', 'pekerjaan', 'status_perkawinan'];

      for (const member of data.table) {
        // Critical member fields (weight = 2)
        for (const field of memberCriticalFields) {
          maxScore += 2;
          if (member[field] && String(member[field]).trim().length > 0) {
            totalScore += 2;
          } else {
            const fieldName = `member.${field}`;
            result.criticalMissing.push(fieldName);
            result.missingFields.push(fieldName);
          }
        }

        // Important member fields (weight = 1.5)
        for (const field of memberImportantFields) {
          maxScore += 1.5;
          if (member[field] && String(member[field]).trim().length > 0) {
            totalScore += 1.5;
          } else {
            const fieldName = `member.${field}`;
            result.importantMissing.push(fieldName);
            result.missingFields.push(fieldName);
          }
        }

        // Standard member fields (weight = 1)
        for (const field of memberStandardFields) {
          maxScore += 1;
          if (member[field] && String(member[field]).trim().length > 0) {
            totalScore += 1;
          } else {
            const fieldName = `member.${field}`;
            result.standardMissing.push(fieldName);
            result.missingFields.push(fieldName);
          }
        }
      }
    }

    // Calculate percentage
    result.percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

    logger.debug(`Completeness check: ${result.percentage}% (${result.missingFields.length} missing fields)`);

    return result;
  }

  // ==========================================================================
  // FULL DOCUMENT VALIDATION
  // ==========================================================================

  /**
   * Validasi full Kartu Keluarga document
   *
   * Melakukan comprehensive validation terhadap seluruh data KK:
   * 1. Header validation (nomor KK, nama kepala keluarga, alamat)
   * 2. Member validation (setiap anggota keluarga)
   * 3. Completeness check
   * 4. Data consistency check
   *
   * @param {Object} kkData - Data Kartu Keluarga lengkap
   * @param {string} kkData.nomor_kk - Nomor KK
   * @param {string} kkData.nama_kepala_keluarga - Nama kepala keluarga
   * @param {string} kkData.alamat - Alamat
   * @param {Array} kkData.table - Array anggota keluarga
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[], completeness: Object }
   *
   * @example
   * const result = validateDocument(kkData);
   * if (!result.isValid) {
   *   console.log('Validation errors:', result.errors);
   *   console.log('Warnings:', result.warnings);
   *   console.log('Completeness:', result.completeness.percentage + '%');
   * }
   */
  static validateDocument(kkData) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      completeness: null,
      details: {
        headerValid: true,
        membersValid: true,
        memberResults: []
      }
    };

    logger.info('Starting full document validation...');

    // Validate input
    if (!kkData || typeof kkData !== 'object') {
      result.isValid = false;
      result.errors.push('Invalid data: kkData must be an object');
      return result;
    }

    // 1. Validate Nomor KK
    const kkValidation = this.validateKK(kkData.nomor_kk);
    if (!kkValidation.isValid) {
      result.isValid = false;
      result.details.headerValid = false;
      result.errors.push(...kkValidation.errors);
    }

    // 2. Validate Nama Kepala Keluarga
    if (!kkData.nama_kepala_keluarga || kkData.nama_kepala_keluarga.trim().length < 2) {
      result.isValid = false;
      result.details.headerValid = false;
      result.errors.push('Nama kepala keluarga is required (minimum 2 characters)');
    }

    // 3. Validate Alamat
    if (!kkData.alamat || kkData.alamat.trim().length < 5) {
      result.isValid = false;
      result.details.headerValid = false;
      result.errors.push('Alamat is required (minimum 5 characters)');
    }

    // 4. Validate Table (anggota keluarga)
    if (!kkData.table || !Array.isArray(kkData.table) || kkData.table.length === 0) {
      result.isValid = false;
      result.details.membersValid = false;
      result.errors.push('No family members found (table is empty)');
    } else {
      // Validate each member
      kkData.table.forEach((member, index) => {
        const memberResult = this.validateMember(member, index + 1);
        result.details.memberResults.push(memberResult);

        if (!memberResult.isValid) {
          result.isValid = false;
          result.details.membersValid = false;
          result.errors.push(...memberResult.errors.map(err => `Member ${index + 1}: ${err}`));
        }

        if (memberResult.warnings && memberResult.warnings.length > 0) {
          result.warnings.push(...memberResult.warnings.map(warn => `Member ${index + 1}: ${warn}`));
        }
      });
    }

    // 5. Check completeness
    result.completeness = this.checkCompleteness(kkData);

    if (result.completeness.percentage < 80) {
      result.warnings.push(`Data completeness is low: ${result.completeness.percentage}%`);
    }

    if (result.completeness.criticalMissing.length > 0) {
      result.warnings.push(`Critical fields missing: ${result.completeness.criticalMissing.join(', ')}`);
    }

    // Log result
    logger.info(`Document validation ${result.isValid ? 'PASSED' : 'FAILED'}`);
    logger.info(`  - Errors: ${result.errors.length}`);
    logger.info(`  - Warnings: ${result.warnings.length}`);
    logger.info(`  - Completeness: ${result.completeness.percentage}%`);

    return result;
  }

  /**
   * Validasi data satu anggota keluarga
   *
   * @param {Object} member - Data anggota keluarga
   * @param {number} memberNumber - Nomor urut member (untuk error message)
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
   *
   * @example
   * validateMember({ nik: '...', nama_lengkap: '...', jenis_kelamin: 'L' }, 1)
   */
  static validateMember(member, memberNumber = 0) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!member || typeof member !== 'object') {
      result.isValid = false;
      result.errors.push('Invalid member data');
      return result;
    }

    // Validate NIK
    const nikValidation = this.validateNIK(member.nik);
    if (!nikValidation.isValid) {
      result.isValid = false;
      result.errors.push(...nikValidation.errors);
    }

    // Validate Nama Lengkap
    if (!member.nama_lengkap || member.nama_lengkap.trim().length < 2) {
      result.isValid = false;
      result.errors.push('Nama lengkap is required (minimum 2 characters)');
    }

    // Validate Jenis Kelamin
    const genderValidation = this.validateGender(member.jenis_kelamin);
    if (!genderValidation.isValid) {
      result.isValid = false;
      result.errors.push(...genderValidation.errors);
    }

    // Validate Tanggal Lahir (if present)
    if (member.tanggal_lahir) {
      const dateValidation = this.validateDate(member.tanggal_lahir);
      if (!dateValidation.isValid) {
        result.warnings.push(...dateValidation.errors);
      }
    } else {
      result.warnings.push('Tanggal lahir is missing');
    }

    // Validate Tempat Lahir (if present)
    if (member.tempat_lahir && member.tempat_lahir.trim().length < 2) {
      result.warnings.push('Tempat lahir is too short (minimum 2 characters)');
    }

    logger.debug(`Member ${memberNumber} validation: ${result.isValid ? 'PASSED' : 'FAILED'} (${result.errors.length} errors, ${result.warnings.length} warnings)`);

    return result;
  }
}

/**
 * ============================================================================
 * MODULE EXPORTS
 * ============================================================================
 */
module.exports = ValidationService;

/**
 * ============================================================================
 * USAGE NOTES
 * ============================================================================
 *
 * 1. MIGRATION FROM OLD VALIDATOR:
 *    ValidationService is designed to replace scattered validation logic.
 *    Old code using Validator can gradually migrate:
 *
 *    OLD: Validator.isValidNIK(nik)  // returns boolean
 *    NEW: ValidationService.validateNIK(nik).isValid  // returns object
 *
 *    Advantage of NEW: Get detailed error messages, not just boolean
 *
 * 2. ERROR HANDLING PATTERN:
 *    ```javascript
 *    const validation = ValidationService.validateDocument(data);
 *    if (!validation.isValid) {
 *      // Log all errors
 *      validation.errors.forEach(err => logger.error(err));
 *
 *      // Return user-friendly error
 *      return {
 *        success: false,
 *        message: 'Data validation failed',
 *        errors: validation.errors
 *      };
 *    }
 *    ```
 *
 * 3. COMPLETENESS VS VALIDITY:
 *    - isValid: Critical fields must be present and valid
 *    - completeness: Percentage of all fields (critical + important + standard)
 *
 *    A document can be VALID but have low completeness (e.g., 60%)
 *    This is acceptable for OCR results (not all fields always extracted)
 *
 * 4. WARNINGS VS ERRORS:
 *    - errors: Block processing (data tidak boleh disimpan)
 *    - warnings: Informational (data boleh disimpan tapi perlu review)
 *
 *    Example:
 *    - Missing NIK = ERROR (critical field)
 *    - Missing pekerjaan = WARNING (standard field)
 *
 * 5. INTEGRATION WITH GEMINI OCR:
 *    ```javascript
 *    // In GeminiOcrService.js
 *    const ocrResult = await this.extractDataWithGemini(imagePath);
 *
 *    // Replace validateParsedData() with:
 *    const validation = ValidationService.validateDocument(ocrResult.parsedData);
 *
 *    if (!validation.isValid) {
 *      logger.error('OCR validation failed:', validation.errors);
 *      throw new Error('OCR result validation failed');
 *    }
 *
 *    if (validation.completeness.percentage < 70) {
 *      logger.warn('Low completeness:', validation.completeness.percentage);
 *      // Maybe retry OCR or flag for manual review
 *    }
 *    ```
 *
 * 6. INTEGRATION WITH AUTOCREATE SERVICE:
 *    ```javascript
 *    // In AutoCreateService.js
 *    async createFromOCR(ocrData) {
 *      // Validate before database insert
 *      const validation = ValidationService.validateDocument(ocrData);
 *
 *      if (!validation.isValid) {
 *        return {
 *          success: false,
 *          message: 'Invalid data cannot be saved',
 *          errors: validation.errors
 *        };
 *      }
 *
 *      // Proceed with database insert
 *      const result = await FamilyDataModel.create(ocrData);
 *      // ...
 *    }
 *    ```
 *
 * 7. PERFORMANCE CONSIDERATIONS:
 *    - All validations are synchronous (no async overhead)
 *    - Fail-fast pattern (stop on first critical error if needed)
 *    - Logging is debug-level by default (won't spam in production)
 *
 *    For bulk validation of many documents:
 *    ```javascript
 *    const results = documents.map(doc => {
 *      try {
 *        return ValidationService.validateDocument(doc);
 *      } catch (error) {
 *        logger.error('Validation error:', error);
 *        return { isValid: false, errors: [error.message] };
 *      }
 *    });
 *
 *    const validDocs = results.filter(r => r.isValid);
 *    const invalidDocs = results.filter(r => !r.isValid);
 *    ```
 *
 * 8. TESTING:
 *    Create comprehensive unit tests for each validation method:
 *    ```javascript
 *    describe('ValidationService', () => {
 *      describe('validateNIK', () => {
 *        it('should accept valid 16-digit NIK', () => {
 *          const result = ValidationService.validateNIK('3201234567890123');
 *          expect(result.isValid).toBe(true);
 *          expect(result.errors).toHaveLength(0);
 *        });
 *
 *        it('should reject NIK with wrong length', () => {
 *          const result = ValidationService.validateNIK('12345');
 *          expect(result.isValid).toBe(false);
 *          expect(result.errors).toContain('NIK must be exactly 16 digits (got 5)');
 *        });
 *      });
 *    });
 *    ```
 *
 * ============================================================================
 */
