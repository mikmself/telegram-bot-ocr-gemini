const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const TextCleaner = require('../utils/textCleaner');

class GeminiOcrService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
    this.maxRetries = parseInt(process.env.OCR_MAX_RETRIES) || 2;
    this.timeout = parseInt(process.env.OCR_TIMEOUT) || 30000;
    this.tempDir = process.env.TEMP_DIR || './temp';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.generativeModel = this.genAI.getGenerativeModel({ model: this.model });

    this.ensureTempDir();
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

  async processImage(imagePath) {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        logger.info(`Processing image with Gemini AI (attempt ${attempt}/${this.maxRetries}): ${imagePath}`);

        
        await fs.access(imagePath);

        
        const optimizedPath = await this.optimizeImage(imagePath);

        
        const imageBuffer = await fs.readFile(optimizedPath);
        const base64Image = imageBuffer.toString('base64');

        
        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        };

        
        const prompt = this.createPrompt();

        
        logger.info('Calling Gemini API...');
        const result = await this.generativeModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        logger.info('Gemini API response received');
        logger.info(`Raw response length: ${text.length} characters`);

        
        if (optimizedPath !== imagePath) {
          await fs.unlink(optimizedPath).catch(() => {});
        }

        
        const parsedData = this.parseGeminiResponse(text);

        
        if (!this.validateParsedData(parsedData)) {
          throw new Error('Parsed data validation failed');
        }

        
        const cleanedData = await this.postProcessData(parsedData);

        const processingTime = Date.now() - startTime;

        logger.info(`Gemini OCR completed successfully`);
        logger.info(`- Members found: ${cleanedData.table.length}`);
        logger.info(`- Processing time: ${processingTime}ms`);

        return {
          success: true,
          confidence: 95, 
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

        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  createPrompt() {
    return `Analyze this Indonesian Family Card (Kartu Keluarga/KK) image and extract ALL data with PERFECT accuracy.

CRITICAL INSTRUCTIONS:
1. This is an official Indonesian government document - accuracy is CRITICAL
2. Extract the 16-digit family card number (Nomor KK) from the header
3. Extract ALL family members from the table (usually 1-10 people)
4. For EACH member, extract ALL fields accurately
5. Pay special attention to NIK (16 digits) - this is the most important field
6. Preserve exact names, do not translate or modify
7. Extract dates in DD-MM-YYYY format
8. For gender: use "LAKI-LAKI" or "PEREMPUAN" exactly
9. For family relationship, use exact Indonesian terms like "KEPALA KELUARGA", "ISTRI", "ANAK", etc.

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

  getStats() {
    return {
      model: this.model,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      tempDir: this.tempDir
    };
  }
}

module.exports = new GeminiOcrService();
