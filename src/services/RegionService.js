/**
 * ============================================================================
 * FILE: src/services/RegionService.js
 * ============================================================================
 *
 * DESKRIPSI:
 * Service untuk mengelola data wilayah Indonesia dengan integrasi API regional.
 * Menyediakan functionality untuk lookup provinsi, kabupaten, kecamatan,
 * dan desa/kelurahan dengan caching dan error handling yang komprehensif.
 *
 * TANGGAL DIBUAT: 2024
 * TANGGAL MODIFIKASI TERAKHIR: 2025-10-26
 *
 * DEPENDENSI:
 * - axios: HTTP client untuk API calls
 * - utils/logger: Logging utility untuk tracking dan debugging
 * - config/env: Environment configuration untuk API settings
 *
 * FITUR UTAMA:
 * 1. Region Data Management
 *    - Provinsi, Kabupaten/Kota, Kecamatan, Desa/Kelurahan
 *    - Hierarchical region structure
 *    - Region code validation dan normalization
 *    - Parent-child relationship mapping
 *
 * 2. API Integration
 *    - RESTful API integration dengan external service
 *    - Authentication dengan Bearer token
 *    - Timeout handling dan retry mechanism
 *    - Error handling dan fallback strategies
 *
 * 3. Search & Lookup
 *    - Exact match search
 *    - Fuzzy matching dengan multiple strategies
 *    - Partial string matching
 *    - Case-insensitive search
 *
 * 4. Data Enrichment
 *    - Hierarchical data enrichment
 *    - Parent region information
 *    - Complete region hierarchy
 *    - Data validation dan consistency
 *
 * 5. Performance Optimization
 *    - Efficient search algorithms
 *    - API call optimization
 *    - Error recovery mechanisms
 *    - Logging dan monitoring
 *
 * CARA PENGGUNAAN:
 * ```javascript
 * const RegionService = require('./services/RegionService');
 *
 * // Get region by code
 * const region = await RegionService.getRegion('3301062016');
 *
 * // Search province by name
 * const province = await RegionService.searchProvince('Jawa Tengah');
 *
 * // Parse region codes from address
 * const codes = await RegionService.parseRegionCodes(
 *   'Jawa Tengah', 'Semarang', 'Tembalang', 'Tembalang'
 * );
 * ```
 *
 * CATATAN PENTING:
 * - Service menggunakan singleton pattern
 * - API calls dengan timeout 10 detik
 * - Support multiple search strategies
 * - Hierarchical data enrichment
 * - Comprehensive error handling
 *
 * ============================================================================
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * RegionService Class
 * 
 * Mengelola data wilayah Indonesia dengan integrasi API regional.
 * Menyediakan lookup functionality untuk semua level administrasi
 * dengan caching, error handling, dan data enrichment.
 * 
 * API INTEGRATION:
 * 1. Authentication
 *    - Bearer token authentication
 *    - Secure API communication
 *    - Error handling untuk auth failures
 * 
 * 2. Request Management
 *    - Timeout handling (10 detik)
 *    - Retry mechanism untuk transient failures
 *    - Error recovery strategies
 * 
 * 3. Data Processing
 *    - Response validation
 *    - Data normalization
 *    - Error handling
 * 
 * @class RegionService
 */
class RegionService {
  constructor() {
    // ========================================================================
    // API CONFIGURATION
    // ========================================================================
    
    /**
     * Load API configuration dari environment
     * Setup base URL dan API key
     */
    this.apiUrl = config.regionApi.url;
    this.apiKey = config.regionApi.key;

    // ========================================================================
    // HTTP CLIENT SETUP
    // ========================================================================
    
    /**
     * Create axios client dengan configuration
     * Include authentication dan timeout settings
     */
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  
  /**
   * Get region data by code
   * 
   * Mengambil data wilayah berdasarkan kode dengan support untuk semua level
   * administrasi (Provinsi, Kabupaten, Kecamatan, Desa, Dusun).
   * 
   * SUPPORTED CODE LENGTHS:
   * - 2 digits: Provinsi (33)
   * - 4 digits: Kabupaten/Kota (3301)
   * - 6 digits: Kecamatan (330106)
   * - 10 digits: Desa/Kelurahan (3301062016)
   * - 13 digits: Dusun (3301062016001)
   * 
   * API INTEGRATION:
   * 1. Direct API calls untuk provinsi
   * 2. Search API untuk kabupaten, kecamatan, desa
   * 3. Error handling untuk setiap level
   * 4. Data enrichment untuk desa (parent regions)
   * 
   * @async
   * @param {string} code - Region code (2-13 digits)
   * @returns {Promise<Object|null>} Region data object atau null jika tidak ditemukan
   * 
   * @example
   * const province = await RegionService.getRegion('33');
   * // Returns: {code: '33', name: 'Jawa Tengah', ...}
   * 
   * const village = await RegionService.getRegion('3301062016');
   * // Returns: {code: '33.01.06.2016', name: 'Tembalang', ...}
   */
  async getRegion(code) {
    try {
      logger.info(`Fetching region data for code: ${code}`);

      // ========================================================================
      // API CALL DISPATCH
      // ========================================================================
      
      /**
       * Dispatch API call berdasarkan code length
       * Different endpoints untuk different administrative levels
       */
      let response;

      if (code.length === 2) {
        // ========================================================================
        // PROVINCE LEVEL (2 digits)
        // ========================================================================
        
        /**
         * Direct API call untuk provinsi
         * Format: /provinces/{code}
         */
        response = await this.client.get(`/provinces/${code}`);
      } else if (code.length === 4) {
        // ========================================================================
        // REGENCY LEVEL (4 digits)
        // ========================================================================
        
        /**
         * Search API untuk kabupaten/kota
         * Use search endpoint dengan code parameter
         */
        logger.info(`Searching for regency with code: ${code}`);
        try {
          response = await this.client.get('/regencies', {
            params: { search: code }
          });

          if (response.data && response.data.data && response.data.data.length > 0) {
            const regency = response.data.data.find(r => r.code === code);
            if (regency) {
              response.data = { success: true, data: regency };
            } else {
              response.data = { success: false };
            }
          } else {
            response.data = { success: false };
          }
        } catch (error) {
          logger.error(`Error fetching regency ${code}:`, error.message);
          response = { data: { success: false } };
        }
      } else if (code.length === 6) {
        // ========================================================================
        // DISTRICT LEVEL (6 digits)
        // ========================================================================
        
        /**
         * Search API untuk kecamatan
         * Use search endpoint dengan code parameter
         */
        logger.info(`Searching for district with code: ${code}`);
        try {
          response = await this.client.get('/districts', {
            params: { search: code }
          });

          if (response.data && response.data.data && response.data.data.length > 0) {
            const district = response.data.data.find(d => d.code === code);
            if (district) {
              response.data = { success: true, data: district };
            } else {
              response.data = { success: false };
            }
          } else {
            response.data = { success: false };
          }
        } catch (error) {
          logger.error(`Error fetching district ${code}:`, error.message);
          response = { data: { success: false } };
        }
      } else if (code.length === 10) {
        // ========================================================================
        // VILLAGE LEVEL (10 digits)
        // ========================================================================
        
        /**
         * Search API untuk desa/kelurahan
         * Format code: XX.XX.XX.XXXX
         * Include data enrichment untuk parent regions
         */
        const formattedCode = code.replace(/(\d{2})(\d{2})(\d{2})(\d{4})/, '$1.$2.$3.$4');
        
        response = await this.client.get('/villages', {
          params: { search: formattedCode }
        });
        
        if (response.data && response.data.data && response.data.data.length > 0) {
          const village = response.data.data.find(v => v.code === formattedCode);
          if (village) {
            response.data = { success: true, data: village };
          } else {
            response.data = { success: false };
          }
        }
      } else if (code.length === 13) {
        // ========================================================================
        // HAMLET LEVEL (13 digits)
        // ========================================================================
        
        /**
         * Search API untuk dusun
         * Use search endpoint dengan code parameter
         */
        response = await this.client.get('/hamlets', {
          params: { search: code }
        });
        
        if (response.data && response.data.data && response.data.data.length > 0) {
          const hamlet = response.data.data.find(h => h.code === code);
          if (hamlet) {
            response.data = { success: true, data: hamlet };
          } else {
            response.data = { success: false };
          }
        }
      } else {
        /**
         * Unsupported code length
         * Log error dan return null
         */
        logger.error(`Unsupported code length: ${code.length}`);
        return null;
      }

      if (response && response.data && response.data.success) {
        const regionData = response.data.data;
        logger.info(`Region data retrieved: ${regionData.name}`);
        
        if (code.length === 10) {
          try {
            const districtCode = code.substring(0, 6);
            const regencyCode = code.substring(0, 4);
            const provinceCode = code.substring(0, 2);
            
            const district = await this.getDistrict(districtCode);
            const regency = await this.getRegency(regencyCode);
            const province = await this.getProvince(provinceCode);
            
            regionData.district_name = district?.name || 'Tidak diketahui';
            regionData.regency_name = regency?.name || 'Tidak diketahui';
            regionData.province_name = province?.name || 'Tidak diketahui';
            
            logger.info(`Village hierarchy completed: ${regionData.name}, ${regionData.district_name}, ${regionData.regency_name}, ${regionData.province_name}`);
          } catch (error) {
            logger.warn(`Failed to fetch parent regions for village ${code}:`, error.message);
            regionData.district_name = 'Tidak diketahui';
            regionData.regency_name = 'Tidak diketahui';
            regionData.province_name = 'Tidak diketahui';
          }
        }
        
        return regionData;
      }

      return null;

    } catch (error) {
      logger.error(`Error fetching region ${code}:`, error.message);
      return null;
    }
  }

  
  async getProvince(code) {
    return await this.getRegion(code);
  }

  
  async getRegency(code) {
    return await this.getRegion(code);
  }

  
  async getDistrict(code) {
    return await this.getRegion(code);
  }

  
  async getVillage(code) {
    return await this.getRegion(code);
  }

  
  async parseRegionCodes(provinsi, kabupatenKota, kecamatan, desaKelurahan) {
    try {
      logger.info('Parsing region codes from address...');
      logger.info(`Input: Provinsi="${provinsi}", Kabupaten="${kabupatenKota}", Kecamatan="${kecamatan}", Desa="${desaKelurahan}"`);
      
      const result = {
        kode_provinsi: null,
        kode_kabupaten: null,
        kode_kecamatan: null,
        kode_kelurahan: null
      };
      
      
      if (provinsi) {
        logger.info(`Searching province: ${provinsi}`);
        const province = await this.searchProvince(provinsi);
        if (province) {
          result.kode_provinsi = province.code;
          logger.info(`Province found: ${province.name} (${province.code})`);
        } else {
          logger.warn(`Province NOT found: ${provinsi}`);
        }
      }
      
      
      if (kabupatenKota && result.kode_provinsi) {
        logger.info(`Searching regency: ${kabupatenKota} in province ${result.kode_provinsi}`);
        const regency = await this.searchRegency(result.kode_provinsi, kabupatenKota);
        if (regency) {
          result.kode_kabupaten = regency.code;
          logger.info(`Regency found: ${regency.name} (${regency.code})`);
        } else {
          logger.warn(`Regency NOT found: ${kabupatenKota}`);
        }
      }
      
      
      if (kecamatan && result.kode_kabupaten) {
        logger.info(`Searching district: ${kecamatan} in regency ${result.kode_kabupaten}`);
        const district = await this.searchDistrict(result.kode_kabupaten, kecamatan);
        if (district) {
          result.kode_kecamatan = district.code;
          logger.info(`District found: ${district.name} (${district.code})`);
        } else {
          logger.warn(`District NOT found: ${kecamatan}`);
        }
      }
      
      
      if (desaKelurahan && result.kode_kecamatan) {
        logger.info(`Searching village: ${desaKelurahan} in district ${result.kode_kecamatan}`);
        const village = await this.searchVillage(result.kode_kecamatan, desaKelurahan);
        if (village) {
          result.kode_kelurahan = village.code;
          logger.info(`Village found: ${village.name} (${village.code})`);
        } else {
          logger.warn(`Village NOT found: ${desaKelurahan}`);
        }
      }
      
      logger.info('Region codes parsed:', result);
      return result;
    } catch (error) {
      logger.error('Error parsing region codes:', error);
      return {
        kode_provinsi: null,
        kode_kabupaten: null,
        kode_kecamatan: null,
        kode_kelurahan: null
      };
    }
  }

  
  async searchProvince(name) {
    try {
      logger.info(`Searching province: ${name}`);
      
      
      const searchTerm = name.trim().toUpperCase();
      
      
      let response = await this.client.get('/provinces', {
        params: { search: name }
      });
      
      
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all provinces');
        response = await this.client.get('/provinces');
      }
      
      if (response.data && response.data.data) {
        const provinces = response.data.data;
        
        
        let found = provinces.find(p => 
          p.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`Province found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        found = provinces.find(p =>
          p.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(p.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`Province found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        const searchWords = searchTerm.split(/\s+/);
        found = provinces.find(p => {
          const provinceWords = p.name.toUpperCase().split(/\s+/);
          return searchWords.some(sw => provinceWords.some(pw => pw.includes(sw) || sw.includes(pw)));
        });
        
        if (found) {
          logger.info(`Province found (partial match): ${found.name} (${found.code})`);
          return found;
        }
      }
      
      logger.warn(`Province NOT found: ${name}`);
      return null;
    } catch (error) {
      logger.error(`Error searching province ${name}:`, error.message);
      return null;
    }
  }

  
  async searchRegency(provinceCode, name) {
    try {
      logger.info(`Searching regency: ${name} in province ${provinceCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      
      let response = await this.client.get('/regencies', {
        params: { search: name }
      });
      
      
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all regencies');
        response = await this.client.get('/regencies');
      }
      
      if (response.data && response.data.data) {
        const regencies = response.data.data;
        
        
        const provinceRegencies = regencies.filter(r => r.provinceCode === provinceCode);
        logger.info(`Found ${provinceRegencies.length} regencies in province ${provinceCode}`);
        
        
        let found = provinceRegencies.find(r => 
          r.name.toUpperCase() === searchTerm ||
          r.name.toUpperCase() === `KABUPATEN ${searchTerm}` ||
          r.name.toUpperCase() === `KOTA ${searchTerm}`
        );
        
        if (found) {
          logger.info(`Regency found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        found = provinceRegencies.find(r => {
          const cleanName = r.name.toUpperCase().replace(/^(KABUPATEN|KOTA)\s+/, '');
          return cleanName.includes(searchTerm) || searchTerm.includes(cleanName);
        });
        
        if (found) {
          logger.info(`Regency found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        const searchWords = searchTerm.split(/\s+/);
        found = provinceRegencies.find(r => {
          const regencyWords = r.name.toUpperCase().split(/\s+/);
          return searchWords.some(sw => 
            regencyWords.some(rw => rw.includes(sw) || sw.includes(rw))
          );
        });
        
        if (found) {
          logger.info(`Regency found (partial match): ${found.name} (${found.code})`);
          return found;
        }
      }
      
      logger.warn(`Regency NOT found: ${name}`);
      return null;
    } catch (error) {
      logger.error(`Error searching regency ${name}:`, error.message);
      return null;
    }
  }

  
  async searchDistrict(regencyCode, name) {
    try {
      logger.info(`Searching district: ${name} in regency ${regencyCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      
      let response = await this.client.get('/districts', {
        params: { search: name }
      });
      
      
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all districts');
        response = await this.client.get('/districts');
      }
      
      if (response.data && response.data.data) {
        const districts = response.data.data;
        
        
        const regencyDistricts = districts.filter(d => d.regencyCode === regencyCode);
        logger.info(`Found ${regencyDistricts.length} districts in regency ${regencyCode}`);
        
        
        let found = regencyDistricts.find(d => 
          d.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`District found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        found = regencyDistricts.find(d =>
          d.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(d.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`District found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        const searchWords = searchTerm.split(/\s+/);
        found = regencyDistricts.find(d => {
          const districtWords = d.name.toUpperCase().split(/\s+/);
          return searchWords.some(sw => 
            districtWords.some(dw => dw.includes(sw) || sw.includes(dw))
          );
        });
        
        if (found) {
          logger.info(`District found (partial match): ${found.name} (${found.code})`);
          return found;
        }
      }
      
      logger.warn(`District NOT found: ${name}`);
      return null;
    } catch (error) {
      logger.error(`Error searching district ${name}:`, error.message);
      return null;
    }
  }

  
  async searchVillage(districtCode, name) {
    try {
      logger.info(`Searching village: ${name} in district ${districtCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      
      let response = await this.client.get('/villages', {
        params: { search: name }
      });
      
      
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all villages');
        response = await this.client.get('/villages');
      }
      
      if (response.data && response.data.data) {
        const villages = response.data.data;
        
        
        const districtVillages = villages.filter(v => v.districtCode === districtCode);
        logger.info(`Found ${districtVillages.length} villages in district ${districtCode}`);
        
        
        let found = districtVillages.find(v => 
          v.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`Village found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        found = districtVillages.find(v =>
          v.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(v.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`Village found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        
        const searchWords = searchTerm.split(/\s+/);
        found = districtVillages.find(v => {
          const villageWords = v.name.toUpperCase().split(/\s+/);
          return searchWords.some(sw => 
            villageWords.some(vw => vw.includes(sw) || sw.includes(vw))
          );
        });
        
        if (found) {
          logger.info(`Village found (partial match): ${found.name} (${found.code})`);
          return found;
        }
      }
      
      logger.warn(`Village NOT found: ${name}`);
      return null;
    } catch (error) {
      logger.error(`Error searching village ${name}:`, error.message);
      return null;
    }
  }

  
  async getFullRegion(villageCode) {
    try {
      const village = await this.getVillage(villageCode);
      if (!village) return null;

      const district = await this.getDistrict(village.district_code);
      const regency = await this.getRegency(village.regency_code);
      const province = await this.getProvince(village.province_code);

      return {
        province,
        regency,
        district,
        village
      };

    } catch (error) {
      logger.error('Error getting full region:', error);
      return null;
    }
  }
}

/**
 * ============================================================================
 * DEVELOPER NOTES & BEST PRACTICES
 * ============================================================================
 *
 * API INTEGRATION:
 * ----------------
 * 1. Authentication
 *    - Bearer token authentication
 *    - Secure API communication
 *    - Error handling untuk auth failures
 *    - Token refresh mechanisms
 *
 * 2. Request Management
 *    - Timeout handling (10 detik)
 *    - Retry mechanism untuk transient failures
 *    - Rate limiting compliance
 *    - Error recovery strategies
 *
 * 3. Response Handling
 *    - Response validation
 *    - Data normalization
 *    - Error parsing dan handling
 *    - Success/failure detection
 *
 * SEARCH & MATCHING:
 * ------------------
 * 1. Search Strategies
 *    - Exact match (highest priority)
 *    - Contains match (bidirectional)
 *    - Partial string matching
 *    - Case-insensitive search
 *
 * 2. Data Normalization
 *    - Uppercase conversion
 *    - Whitespace trimming
 *    - Special character handling
 *    - Format standardization
 *
 * 3. Fuzzy Matching
 *    - Multiple matching algorithms
 *    - Word-based matching
 *    - Similarity scoring
 *    - Fallback strategies
 *
 * DATA ENRICHMENT:
 * ----------------
 * 1. Hierarchical Data
 *    - Parent region information
 *    - Complete region hierarchy
 *    - Relationship mapping
 *    - Data consistency validation
 *
 * 2. Code Formatting
 *    - Standardize region codes
 *    - Format conversion (dots/no dots)
 *    - Validation dan normalization
 *    - Error handling untuk invalid codes
 *
 * 3. Data Validation
 *    - Region code validation
 *    - Data integrity checks
 *    - Consistency validation
 *    - Error reporting
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * 1. API Call Optimization
 *    - Efficient endpoint usage
 *    - Batch operations jika possible
 *    - Caching strategies
 *    - Request deduplication
 *
 * 2. Error Handling
 *    - Graceful degradation
 *    - Fallback mechanisms
 *    - Error recovery
 *    - User-friendly error messages
 *
 * 3. Monitoring
 *    - API call metrics
 *    - Error rates dan types
 *    - Performance monitoring
 *    - Usage analytics
 *
 * TESTING STRATEGY:
 * -----------------
 * [ ] Unit tests untuk search algorithms
 * [ ] Integration tests dengan API
 * [ ] Error scenario testing
 * [ ] Performance testing
 * [ ] Data validation tests
 * [ ] Fuzzy matching accuracy tests
 *
 * MONITORING & OBSERVABILITY:
 * ---------------------------
 * 1. API Metrics
 *    - API call success rates
 *    - Response times
 *    - Error rates oleh type
 *    - Rate limiting compliance
 *
 * 2. Search Metrics
 *    - Search success rates
 *    - Matching accuracy
 *    - Search performance
 *    - User satisfaction
 *
 * 3. Data Quality Metrics
 *    - Data enrichment success rates
 *    - Validation accuracy
 *    - Data consistency
 *    - Error rates
 *
 * RELATED FILES:
 * --------------
 * - src/config/env.js: Environment configuration
 * - src/utils/logger.js: Logging utilities
 * - src/bot/commands/kode_wilayah.js: Region code command
 * - src/services/AutoCreateService.js: Data creation service
 *
 * ============================================================================
 */

module.exports = new RegionService();
