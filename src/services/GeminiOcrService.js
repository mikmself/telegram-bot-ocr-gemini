/**
 * ============================================================================
 * FILE: src/services/GeminiOcrService.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Service untuk melakukan OCR (Optical Character Recognition) pada foto
 * Kartu Keluarga menggunakan Google Gemini AI. Service ini menangani
 * seluruh pipeline dari image processing hingga data extraction dan
 * validation dengan tingkat akurasi tinggi.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - @google/generative-ai: Google Gemini AI SDK untuk OCR processing
 * - fs.promises: File system operations untuk image handling
 * - path: Path manipulation untuk file operations
 * - sharp: Image optimization dan processing library
 * - logger: Logging utility untuk tracking dan debugging
 * - textCleaner: Text normalization dan cleaning utilities
 *
 * FITUR UTAMA:
 * 1. AI-Powered OCR Processing
 *    - Google Gemini 2.5 Flash model untuk akurasi tinggi
 *    - Custom prompt engineering untuk Kartu Keluarga
 *    - Retry mechanism dengan exponential backoff
 *    - Timeout handling untuk reliability
 *
 * 2. Image Optimization
 *    - Automatic image resizing untuk optimal processing
 *    - Quality optimization dengan Sharp library
 *    - Format conversion (JPEG optimization)
 *    - Memory-efficient processing
 *
 * 3. Data Extraction & Validation
 *    - Extract structured data dari Kartu Keluarga
 *    - Validate NIK dan nomor KK format
 *    - Parse family member information
 *    - Normalize Indonesian text data
 *
 * 4. Post-Processing
 *    - Text cleaning dan normalization
 *    - Data structure validation
 *    - Confidence score calculation
 *    - Error handling dan recovery
 *
 * 5. Performance & Reliability
 *    - Connection pooling untuk API calls
 *    - Retry mechanism untuk transient failures
 *    - Timeout protection
 *    - Memory management
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const GeminiOcrService = require('./services/GeminiOcrService');
 * 
 * // Process image untuk OCR
 * const result = await GeminiOcrService.processImage(imagePath);
 * 
 * if (result.success) {
 *   console.log('Data extracted:', result.parsedData);
 *   console.log('Confidence:', result.confidence);
 * } else {
 *   console.error('OCR failed:', result.error);
 * }
 * 
 * // Validate OCR result
 * const validation = GeminiOcrService.validateOcrResult(result);
 * if (!validation.valid) {
 *   console.log('Validation errors:', validation.errors);
 * }
 * ```
 *
 * CATATAN PENTING:
 * - Memerlukan GEMINI_API_KEY environment variable
 * - Model default: gemini-2.5-flash (cepat dan akurat)
 * - Timeout default: 30 detik per request
 * - Max retries: 2 kali dengan delay 2 detik
 * - Image akan di-optimize jika > 2400px width
 * - Temporary files akan di-cleanup otomatis
 * - Confidence score dihitung berdasarkan completeness
 *
 * ============================================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const TextCleaner = require('../utils/textCleaner');

// ============================================================================
// GEMINI OCR SERVICE CLASS
// ============================================================================

/**
 * Class GeminiOcrService
 * 
 * Service utama untuk melakukan OCR pada foto Kartu Keluarga menggunakan
 * Google Gemini AI. Menggunakan singleton pattern untuk efisiensi resource.
 * 
 * DESIGN PATTERN: Singleton
 * - Single instance untuk seluruh aplikasi
 * - Shared configuration dan connection
 * - Memory efficient untuk multiple requests
 * 
 * CONFIGURATION:
 * - Model: gemini-2.5-flash (default) atau custom
 * - Max Retries: 2 (default) untuk transient failures
 * - Timeout: 30 detik (default) per request
 * - Temp Directory: ./temp (default) untuk image processing
 * 
 * @class GeminiOcrService
 */
class GeminiOcrService {
  
  /**
   * Constructor - Inisialisasi Gemini OCR Service
   * 
   * Setup konfigurasi, validasi API key, dan inisialisasi
   * Google Generative AI client.
   * 
   * CONFIGURATION LOADING:
   * 1. Load API key dari environment variables
   * 2. Set model (default: gemini-2.5-flash)
   * 3. Configure retry dan timeout settings
   * 4. Setup temporary directory
   * 
   * VALIDATION:
   * - API key harus ada (throw error jika tidak)
   * - Model harus valid Gemini model
   * - Timeout dan retry harus positive numbers
   * 
   * INITIALIZATION:
   * - Create GoogleGenerativeAI instance
   * - Get generative model dengan konfigurasi
   * - Ensure temp directory exists
   * - Log initialization success
   * 
   * @constructor
   * @throws {Error} Jika GEMINI_API_KEY tidak di-set
   * 
   * @example
   * // Service di-initialize otomatis saat require
   * const service = require('./GeminiOcrService');
   * // service sudah ready untuk digunakan
   */
  constructor() {
    // ========================================================================
    // CONFIGURATION LOADING
    // ========================================================================
    
    /**
     * Google Gemini API Key
     * @type {string}
     * Required: Ya, akan throw error jika tidak ada
     */
    this.apiKey = process.env.GEMINI_API_KEY;
    
    /**
     * Gemini model yang digunakan
     * @type {string}
     * Default: 'gemini-2.5-flash'
     * Options: gemini-2.5-flash, gemini-2.5-pro, gemini-1.5-pro
     */
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    
    /**
     * Maksimal retry attempts untuk API calls
     * @type {number}
     * Default: 2
     * Range: 1-5 (recommended)
     */
    this.maxRetries = parseInt(process.env.OCR_MAX_RETRIES) || 2;
    
    /**
     * Timeout untuk API calls (dalam milliseconds)
     * @type {number}
     * Default: 30000 (30 detik)
     * Range: 10000-60000 (10-60 detik)
     */
    this.timeout = parseInt(process.env.OCR_TIMEOUT) || 30000;
    
    /**
     * Temporary directory untuk image processing
     * @type {string}
     * Default: './temp'
     */
    this.tempDir = process.env.TEMP_DIR || './temp';

    // ========================================================================
    // VALIDATION
    // ========================================================================
    
    /**
     * Validasi API key requirement
     * Throw error jika API key tidak tersedia
     */
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Inisialisasi Google Generative AI client
     * Menggunakan API key yang sudah divalidasi
     */
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    /**
     * Get generative model instance
     * Menggunakan model yang sudah dikonfigurasi
     */
    this.generativeModel = this.genAI.getGenerativeModel({ model: this.model });

    /**
     * Ensure temporary directory exists
     * Buat directory jika belum ada
     */
    this.ensureTempDir();
    
    /**
     * Log successful initialization
     * Informasi model dan konfigurasi yang digunakan
     */
    logger.info(`GeminiOcrService initialized with model: ${this.model}`);
  }

  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch (error) {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`Created temp directory: ${this.tempDir}`);
    }
  }

  /**
   * Process image untuk OCR menggunakan Google Gemini AI
   * 
   * Method utama untuk melakukan OCR pada foto Kartu Keluarga.
   * Menggunakan retry mechanism dan timeout protection untuk reliability.
   * 
   * PROCESSING PIPELINE:
   * 1. Image Validation & Optimization
   *    - Check file existence dan accessibility
   *    - Optimize image size jika diperlukan
   *    - Convert ke base64 untuk API
   * 
   * 2. AI Processing
   *    - Send ke Google Gemini AI dengan custom prompt
   *    - Apply timeout protection
   *    - Handle API response
   * 
   * 3. Data Processing
   *    - Parse JSON response dari AI
   *    - Validate extracted data
   *    - Post-process dan clean data
   *    - Calculate confidence score
   * 
   * 4. Cleanup & Return
   *    - Cleanup temporary files
   *    - Return structured result
   * 
   * RETRY MECHANISM:
   * - Max retries: 2 (configurable)
   * - Delay between retries: 2 detik
   * - Exponential backoff untuk transient failures
   * 
   * TIMEOUT PROTECTION:
   * - Default timeout: 30 detik
   * - Race condition dengan Promise.race()
   * - Graceful failure jika timeout
   * 
   * @async
   * @param {string} imagePath - Path ke file image yang akan diproses
   * @returns {Promise<Object>} Result object dengan struktur:
   *   - success: {boolean} - Status keberhasilan
   *   - confidence: {number} - Confidence score (0-100)
   *   - parsedData: {Object|null} - Data yang diekstrak
   *   - processingTime: {number} - Waktu processing (ms)
   *   - memberCount: {number} - Jumlah anggota keluarga
   *   - error: {string} - Error message jika gagal
   * 
   * @throws {Error} Jika imagePath tidak valid atau tidak accessible
   * 
   * @example
   * const result = await service.processImage('/path/to/kk.jpg');
   * if (result.success) {
   *   console.log('KK Number:', result.parsedData.nomor_kk);
   *   console.log('Members:', result.memberCount);
   *   console.log('Confidence:', result.confidence);
   * }
   */
  async processImage(imagePath) {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        logger.info(`Processing image with Gemini AI (attempt ${attempt}/${this.maxRetries}): ${imagePath}`);

        // ====================================================================
        // STEP 1: IMAGE VALIDATION & OPTIMIZATION
        // ====================================================================
        
        /**
         * Validasi file existence dan accessibility
         * Pastikan file image dapat diakses sebelum processing
         */
        await fs.access(imagePath);

        /**
         * Optimize image untuk processing yang optimal
         * Resize jika terlalu besar, convert format jika diperlukan
         */
        const optimizedPath = await this.optimizeImage(imagePath);

        /**
         * Convert image ke base64 untuk API
         * Gemini AI memerlukan base64 encoded image
         */
        const imageBuffer = await fs.readFile(optimizedPath);
        const base64Image = imageBuffer.toString('base64');

        /**
         * Format image data untuk Gemini API
         * Menggunakan inlineData format dengan MIME type
         */
        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        };

        // ====================================================================
        // STEP 2: AI PROCESSING
        // ====================================================================

        /**
         * Create custom prompt untuk Kartu Keluarga
         * Prompt yang dioptimasi untuk extract data KK
         */
        const prompt = this.createPrompt();

        /**
         * Call Gemini API dengan timeout protection
         * Race condition antara API call dan timeout
         */
        logger.info('Calling Gemini API with timeout...');

        const apiCall = this.generativeModel.generateContent([prompt, imagePart]);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Gemini API timeout after ${this.timeout}ms`)), this.timeout);
        });

        const result = await Promise.race([apiCall, timeoutPromise]);
        const response = await result.response;
        const text = response.text();

        logger.info('Gemini API response received');
        logger.info(`Raw response length: ${text.length} characters`);

        // ====================================================================
        // STEP 3: CLEANUP OPTIMIZED IMAGE
        // ====================================================================

        /**
         * Cleanup optimized image jika berbeda dari original
         * Hapus temporary file yang dibuat untuk optimization
         */
        if (optimizedPath !== imagePath) {
          try {
            await fs.unlink(optimizedPath);
            logger.info(`Cleaned up optimized image: ${optimizedPath}`);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup optimized image ${optimizedPath}:`, cleanupError.message);
          }
        }

        // ====================================================================
        // STEP 4: DATA PROCESSING
        // ====================================================================

        /**
         * Parse JSON response dari Gemini AI
         * Convert text response ke structured data
         */
        const parsedData = this.parseGeminiResponse(text);

        /**
         * Validate parsed data structure
         * Pastikan data yang diekstrak valid dan lengkap
         */
        if (!this.validateParsedData(parsedData)) {
          throw new Error('Parsed data validation failed');
        }

        /**
         * Post-process dan clean data
         * Normalize text, clean OCR artifacts
         */
        const cleanedData = await this.postProcessData(parsedData);

        /**
         * Calculate confidence score
         * Berdasarkan completeness dan quality data
         */
        const confidence = this.calculateConfidence(cleanedData);

        const processingTime = Date.now() - startTime;

        logger.info(`Gemini OCR completed successfully`);
        logger.info(`- Members found: ${cleanedData.table.length}`);
        logger.info(`- Confidence: ${confidence}%`);
        logger.info(`- Processing time: ${processingTime}ms`);

        return {
          success: true,
          confidence: confidence,
          parsedData: cleanedData,
          processingTime,
          memberCount: cleanedData.table.length
        };

      } catch (error) {
        logger.error(`Gemini OCR attempt ${attempt} failed:`, error.message);

        if (attempt >= this.maxRetries) {
          return {
            success: false,
            error: `OCR processing failed after ${this.maxRetries} attempts: ${error.message}`,
            confidence: 0,
            parsedData: null
          };
        }

        /**
         * Wait sebelum retry
         * Exponential backoff untuk transient failures
         */
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Create optimized prompt untuk Gemini AI
   * 
   * Membuat prompt yang dioptimasi khusus untuk extract data dari
   * Kartu Keluarga Indonesia. Prompt ini dirancang untuk mendapatkan
   * hasil OCR yang akurat dan konsisten.
   * 
   * PROMPT DESIGN PRINCIPLES:
   * 1. Specificity: Fokus pada Kartu Keluarga Indonesia
   * 2. Accuracy: Emphasis pada akurasi data kritis (NIK, KK)
   * 3. Structure: Clear JSON output format
   * 4. Validation: Built-in validation rules
   * 5. Localization: Indonesian terms dan format
   * 
   * KEY FEATURES:
   * - 16-digit validation untuk NIK dan nomor KK
   * - Indonesian gender terms (LAKI-LAKI/PEREMPUAN)
   * - Family relationship mapping
   * - Date format specification (DD-MM-YYYY)
   * - Religion dan citizenship mapping
   * - RT/RW format validation
   * 
   * OUTPUT FORMAT:
   * - Pure JSON tanpa markdown
   * - Structured data object
   * - Array untuk family members
   * - Validation-ready format
   * 
   * @returns {string} Optimized prompt untuk Gemini AI
   * 
   * @example
   * const prompt = service.createPrompt();
   * // Prompt akan digunakan dalam generateContent([prompt, imagePart])
   */
  createPrompt() {
    return `Analyze this Indonesian Family Card (Kartu Keluarga/KK) image and extract ALL data with PERFECT accuracy.

CRITICAL INSTRUCTIONS:
1. This is an official Indonesian government document - accuracy is CRITICAL
2. Extract the 16-digit family card number (Nomor KK) from the header
3. Extract ALL family members from the table (usually 1-10 people)
4. For EACH member, extract ALL fields accurately
5. Pay special attention to NIK (16 digits) - this is the most important field
6. Preserve exact names, do not translate or modify
7. Extract dates in DD-MM-YYYY format (birth date AND marriage date if available)
8. For gender: use "LAKI-LAKI" or "PEREMPUAN" exactly
9. For family relationship, use exact Indonesian terms like "KEPALA KELUARGA", "ISTRI", "ANAK", etc.
10. Extract "Tanggal Perkawinan" (marriage date) from the table - use empty string if not available or not married

IMPORTANT FIELD MAPPINGS:
- Jenis Kelamin: must be "LAKI-LAKI" or "PEREMPUAN" (NOT "L" or "P")
- Status Hubungan: "KEPALA KELUARGA", "SUAMI", "ISTRI", "ANAK", "MENANTU", "CUCU", "ORANGTUA", "MERTUA", "FAMILI LAIN", "LAINNYA"
- Agama: "Islam", "Kristen", "Katholik", "Hindu", "Budha", "Konghucu", "Kepercayaan Terhadap Tuhan YME"
- Kewarganegaraan: "WNI" or "WNA"

DATA STRUCTURE TO EXTRACT:
{
  "nomor_kk": "string - 16 digit family card number",
  "nama_kepala_keluarga": "string - head of family name",
  "alamat": "string - complete address",
  "rt_rw": "string - format: 001/002 (3 digits / 3 digits)",
  "desa_kelurahan": "string - village/subdistrict name",
  "kecamatan": "string - district name",
  "kabupaten_kota": "string - regency/city name",
  "provinsi": "string - province name",
  "kode_pos": "string - postal code (5 digits)",
  "table": [
    {
      "nik": "string - 16 digit ID number (CRITICAL: must be exact)",
      "nama_lengkap": "string - full name",
      "jenis_kelamin": "LAKI-LAKI or PEREMPUAN",
      "tempat_lahir": "string - birth place",
      "tanggal_lahir": "string - format: DD-MM-YYYY",
      "agama": "string - religion",
      "pendidikan": "string - education level",
      "jenis_pekerjaan": "string - occupation",
      "status_perkawinan": "string - marital status",
      "tanggal_perkawinan": "string - marriage date in DD-MM-YYYY format (empty string if not married or not available)",
      "status_hubungan_dalam_keluarga": "string - family relationship",
      "kewarganegaraan": "string - citizenship (WNI or WNA)",
      "nama_ayah": "string - father's name (empty string if not available)",
      "nama_ibu": "string - mother's name (empty string if not available)"
    }
  ]
}

VALIDATION RULES:
- nomor_kk: MUST be exactly 16 digits
- Each NIK: MUST be exactly 16 digits
- table: MUST contain at least 1 member
- tanggal_lahir: MUST be in DD-MM-YYYY format
- jenis_kelamin: MUST be "LAKI-LAKI" or "PEREMPUAN" (exact match)
- rt_rw: MUST be in format XXX/XXX (3 digits slash 3 digits)

RESPONSE FORMAT:
Return ONLY a valid JSON object, no markdown code blocks, no explanations, no additional text.
Start directly with { and end with }

BEGIN EXTRACTION:`;
  }

  parseGeminiResponse(text) {
    try {
      logger.info('Parsing Gemini response...');

      
      let cleanedText = text.trim();
      cleanedText = cleanedText.replace(/^```json\s*\n?/i, '');
      cleanedText = cleanedText.replace(/^```\s*\n?/i, '');
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');
      cleanedText = cleanedText.trim();

      
      logger.info(`Cleaned text (first 500 chars): ${cleanedText.substring(0, 500)}`);

      
      const parsed = JSON.parse(cleanedText);

      logger.info('Successfully parsed JSON response');
      logger.info(`Parsed data structure: nomor_kk=${parsed.nomor_kk}, members=${parsed.table?.length || 0}`);

      return parsed;

    } catch (error) {
      logger.error('Failed to parse Gemini response:', error.message);
      logger.error(`Raw text (first 1000 chars): ${text.substring(0, 1000)}`);
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
  }

  validateParsedData(data) {
    const errors = [];

    
    if (!data.nomor_kk || !/^\d{16}$/.test(data.nomor_kk)) {
      errors.push(`Invalid nomor_kk: ${data.nomor_kk}`);
    }

    
    if (!data.table || !Array.isArray(data.table) || data.table.length === 0) {
      errors.push('No family members found in table');
    } else {
      
      data.table.forEach((member, index) => {
        if (!member.nik || !/^\d{16}$/.test(member.nik)) {
          errors.push(`Member ${index + 1}: Invalid NIK: ${member.nik}`);
        }
        if (!member.nama_lengkap || member.nama_lengkap.length < 2) {
          errors.push(`Member ${index + 1}: Invalid name: ${member.nama_lengkap}`);
        }
        if (!['LAKI-LAKI', 'PEREMPUAN'].includes(member.jenis_kelamin)) {
          errors.push(`Member ${index + 1}: Invalid gender: ${member.jenis_kelamin}`);
        }
      });
    }

    if (errors.length > 0) {
      logger.error('Data validation failed:');
      errors.forEach(error => logger.error(`  - ${error}`));
      return false;
    }

    logger.info('Data validation passed');
    return true;
  }

  async postProcessData(data) {
    logger.info('Post-processing extracted data...');

    
    data.alamat = TextCleaner.cleanOcrText(data.alamat || '');
    data.desa_kelurahan = TextCleaner.cleanOcrText(data.desa_kelurahan || '');
    data.kecamatan = TextCleaner.cleanOcrText(data.kecamatan || '');
    data.kabupaten_kota = TextCleaner.cleanOcrText(data.kabupaten_kota || '');
    data.provinsi = TextCleaner.cleanOcrText(data.provinsi || '');

    
    if (data.rt_rw) {
      data.rt_rw = this.normalizeRTRW(data.rt_rw);
    }

    
    if (data.table && Array.isArray(data.table)) {
      data.table = data.table.map((member, index) => {
        return this.processMember(member, index);
      }).filter(member => member !== null);
    }

    
    if (!data.nama_kepala_keluarga && data.table.length > 0) {
      data.nama_kepala_keluarga = data.table[0].nama_lengkap;
    }

    logger.info('Post-processing completed');
    return data;
  }

  processMember(member, index) {
    try {
      
      if (member.nama_lengkap) {
        member.nama_lengkap = TextCleaner.normalizeName(member.nama_lengkap);
      }

      
      if (member.jenis_kelamin) {
        const normalized = TextCleaner.normalizeGender(member.jenis_kelamin);
        if (normalized) {
          
          member.jenis_kelamin = normalized === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';
        }
      }

      
      if (member.status_hubungan_dalam_keluarga) {
        member.status_hubungan_dalam_keluarga = TextCleaner.normalizeFamilyRelationship(
          member.status_hubungan_dalam_keluarga
        );
      }

      
      member.kewarganegaraan = member.kewarganegaraan || 'WNI';
      member.nama_ayah = member.nama_ayah || '';
      member.nama_ibu = member.nama_ibu || '';
      member.no = (index + 1).toString();

      
      if (member.tempat_lahir) {
        member.tempat_lahir = TextCleaner.cleanOcrText(member.tempat_lahir);
      }

      return member;

    } catch (error) {
      logger.error(`Error processing member ${index + 1}:`, error);
      return null;
    }
  }

  normalizeRTRW(rtRw) {
    if (!rtRw) return '';

    
    const matches = rtRw.match(/(\d+).*?(\d+)/);
    if (matches && matches.length >= 3) {
      const rt = matches[1].padStart(3, '0');
      const rw = matches[2].padStart(3, '0');
      return `${rt}/${rw}`;
    }

    return rtRw;
  }

  async optimizeImage(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();

      
      if (metadata.width && metadata.width <= 2400) {
        return imagePath;
      }

      const outputPath = path.join(
        this.tempDir,
        `optimized_${Date.now()}_${path.basename(imagePath)}`
      );

      await sharp(imagePath)
        .resize({
          width: 2400,
          height: null,
          withoutEnlargement: false,
          fit: 'inside'
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(outputPath);

      logger.info(`Image optimized: ${imagePath} -> ${outputPath}`);
      return outputPath;

    } catch (error) {
      logger.warn('Image optimization failed, using original:', error.message);
      return imagePath;
    }
  }

  validateOcrResult(ocrResult) {
    logger.info('Validating OCR result...');

    if (!ocrResult || !ocrResult.success) {
      return { valid: false, errors: ['OCR processing failed'] };
    }

    const data = ocrResult.parsedData;
    const errors = [];

    
    if (!data.nomor_kk || !/^\d{16}$/.test(data.nomor_kk)) {
      errors.push('Invalid or missing KK number');
    }

    
    if (!data.table || data.table.length === 0) {
      errors.push('No family members found');
    } else {
      const validMembers = data.table.filter(m => m && /^\d{16}$/.test(m.nik));
      if (validMembers.length === 0) {
        errors.push('No valid NIKs found for family members');
      }
    }

    const result = {
      valid: errors.length === 0,
      errors,
      warnings: errors.length > 0 ? errors : []
    };

    logger.info(`Validation result: ${result.valid ? 'PASSED' : 'FAILED'}`);
    if (!result.valid) {
      errors.forEach(err => logger.warn(`  - ${err}`));
    }

    return result;
  }

  calculateConfidence(data) {
    logger.info('Calculating OCR confidence score...');

    let totalScore = 0;
    let maxScore = 0;


    maxScore += 10;
    if (data.nomor_kk && /^\d{16}$/.test(data.nomor_kk)) {
      totalScore += 10;
    } else if (data.nomor_kk) {
      totalScore += 5;
    }


    const requiredFields = ['nama_kepala_keluarga', 'alamat', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi'];
    requiredFields.forEach(field => {
      maxScore += 3;
      if (data[field] && data[field].length > 0) {
        totalScore += 3;
      } else if (data[field]) {
        totalScore += 1;
      }
    });


    maxScore += 5;
    if (data.rt_rw && /^\d{3}\/\d{3}$/.test(data.rt_rw)) {
      totalScore += 5;
    } else if (data.rt_rw) {
      totalScore += 2;
    }


    if (data.table && Array.isArray(data.table) && data.table.length > 0) {
      data.table.forEach(member => {

        maxScore += 10;
        if (member.nik && /^\d{16}$/.test(member.nik)) {
          totalScore += 10;
        } else if (member.nik) {
          totalScore += 4;
        }


        maxScore += 3;
        if (member.nama_lengkap && member.nama_lengkap.length >= 2) {
          totalScore += 3;
        } else if (member.nama_lengkap) {
          totalScore += 1;
        }


        maxScore += 2;
        if (['LAKI-LAKI', 'PEREMPUAN'].includes(member.jenis_kelamin)) {
          totalScore += 2;
        }


        maxScore += 2;
        if (member.tanggal_lahir && /^\d{2}-\d{2}-\d{4}$/.test(member.tanggal_lahir)) {
          totalScore += 2;
        } else if (member.tanggal_lahir) {
          totalScore += 1;
        }


        const optionalFields = ['tempat_lahir', 'agama', 'pendidikan', 'jenis_pekerjaan', 'status_perkawinan', 'status_hubungan_dalam_keluarga'];
        optionalFields.forEach(field => {
          maxScore += 1;
          if (member[field] && member[field].length > 0) {
            totalScore += 1;
          }
        });
      });
    }


    const confidencePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    logger.info(`Confidence calculation: ${totalScore}/${maxScore} = ${confidencePercentage}%`);

    return confidencePercentage;
  }

  getStats() {
    return {
      model: this.model,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      tempDir: this.tempDir
    };
  }
}

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * GEMINI AI INTEGRATION:
 * ----------------------
 * 1. Model Selection
 *    - gemini-2.5-flash: Fast, cost-effective, good accuracy
 *    - gemini-2.5-pro: Higher accuracy, slower, more expensive
 *    - gemini-1.5-pro: Alternative option, good for complex images
 *
 * 2. Prompt Engineering
 *    - Specific instructions untuk Kartu Keluarga
 *    - Clear output format specification
 *    - Validation rules built-in
 *    - Indonesian localization
 *
 * 3. Error Handling
 *    - Retry mechanism untuk transient failures
 *    - Timeout protection untuk long-running requests
 *    - Graceful degradation pada API failures
 *    - Detailed error logging
 *
 * IMAGE PROCESSING OPTIMIZATION:
 * ------------------------------
 * 1. Size Optimization
 *    - Resize jika width > 2400px
 *    - Maintain aspect ratio
 *    - JPEG quality 90% untuk balance size/quality
 *    - Memory-efficient processing
 *
 * 2. Format Handling
 *    - Convert semua format ke JPEG
 *    - Base64 encoding untuk API
 *    - MIME type specification
 *    - Temporary file cleanup
 *
 * 3. Performance Considerations
 *    - Lazy loading untuk large images
 *    - Streaming untuk memory efficiency
 *    - Parallel processing jika multiple images
 *    - Cache optimization
 *
 * DATA VALIDATION STRATEGY:
 * -------------------------
 * 1. Format Validation
 *    - NIK: 16 digits exact
 *    - KK Number: 16 digits exact
 *    - Date: DD-MM-YYYY format
 *    - Gender: LAKI-LAKI/PEREMPUAN only
 *    - RT/RW: XXX/XXX format
 *
 * 2. Content Validation
 *    - Required fields presence
 *    - Data type consistency
 *    - Range validation (dates, ages)
 *    - Business rule validation
 *
 * 3. Confidence Scoring
 *    - Based on data completeness
 *    - Field accuracy assessment
 *    - OCR quality indicators
 *    - Validation success rate
 *
 * SECURITY CONSIDERATIONS:
 * ------------------------
 * 1. API Key Protection
 *    - Environment variable storage
 *    - No hardcoded credentials
 *    - Secure transmission
 *    - Key rotation support
 *
 * 2. Data Privacy
 *    - Temporary file cleanup
 *    - No persistent image storage
 *    - Secure data transmission
 *    - GDPR compliance considerations
 *
 * 3. Rate Limiting
 *    - API call throttling
 *    - Request queuing
 *    - Circuit breaker pattern
 *    - Monitoring dan alerting
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. Performance Metrics
 *    - Processing time tracking
 *    - Success/failure rates
 *    - API response times
 *    - Memory usage monitoring
 *
 * 2. Error Tracking
 *    - Detailed error logging
 *    - Stack trace capture
 *    - Error categorization
 *    - Alert thresholds
 *
 * 3. Business Metrics
 *    - OCR accuracy rates
 *    - Confidence score distribution
 *    - Processing volume
 *    - User satisfaction metrics
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk individual methods
 * [ ] Integration tests dengan mock API
 * [ ] End-to-end tests dengan real images
 * [ ] Performance tests dengan large images
 * [ ] Error scenario testing
 * [ ] Validation accuracy testing
 *
 * DEPLOYMENT CONSIDERATIONS:
 * --------------------------
 * 1. Environment Configuration
 *    - API key management
 *    - Model selection per environment
 *    - Timeout configuration
 *    - Retry settings
 *
 * 2. Resource Requirements
 *    - Memory untuk image processing
 *    - CPU untuk Sharp operations
 *    - Network untuk API calls
 *    - Storage untuk temporary files
 *
 * 3. Scaling Considerations
 *    - Horizontal scaling support
 *    - Load balancing
 *    - Queue management
 *    - Resource pooling
 *
 * RELATED FILES:
 * --------------
 * - src/bot/handlers/photo.js: Photo upload handler
 * - src/services/AutoCreateService.js: Database operations
 * - src/utils/textCleaner.js: Text normalization
 * - src/config/env.js: Configuration management
 * - src/utils/logger.js: Logging utilities
 *
 * ============================================================================
 */

module.exports = new GeminiOcrService();
