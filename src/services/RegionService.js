const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class RegionService {
  constructor() {
    this.apiUrl = config.regionApi.url;
    this.apiKey = config.regionApi.key;

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  // Get region by code
  async getRegion(code) {
    try {
      logger.info(`Fetching region data for code: ${code}`);

      // Try different endpoints based on code length
      let response;
      
      if (code.length === 2) {
        // Province
        response = await this.client.get(`/provinces/${code}`);
      } else if (code.length === 4) {
        // Regency - need to find by searching all provinces
        const provinces = await this.client.get('/provinces');
        if (provinces.data && provinces.data.data) {
          for (const province of provinces.data.data) {
            try {
              response = await this.client.get(`/provinces/${province.code}/regencies`);
              if (response.data && response.data.data) {
                const regency = response.data.data.find(r => r.code === code);
                if (regency) {
                  response.data = { success: true, data: regency };
                  break;
                }
              }
            } catch (e) {
              // Continue to next province
            }
          }
        }
      } else if (code.length === 6) {
        // District - need to find by searching all regencies
        const provinces = await this.client.get('/provinces');
        if (provinces.data && provinces.data.data) {
          for (const province of provinces.data.data) {
            try {
              const regencies = await this.client.get(`/provinces/${province.code}/regencies`);
              if (regencies.data && regencies.data.data) {
                for (const regency of regencies.data.data) {
                  try {
                    response = await this.client.get(`/regencies/${regency.code}/districts`);
                    if (response.data && response.data.data) {
                      const district = response.data.data.find(d => d.code === code);
                      if (district) {
                        response.data = { success: true, data: district };
                        break;
                      }
                    }
                  } catch (e) {
                    // Continue to next regency
                  }
                }
                if (response && response.data && response.data.success) break;
              }
            } catch (e) {
              // Continue to next province
            }
          }
        }
      } else if (code.length === 10) {
        // Village - search in villages endpoint
        // Convert 3301062016 to 33.01.06.2016 format
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
        // Hamlet - search in hamlets endpoint
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
        logger.error(`Unsupported code length: ${code.length}`);
        return null;
      }

      if (response && response.data && response.data.success) {
        logger.info(`Region data retrieved: ${response.data.data.name}`);
        return response.data.data;
      }

      return null;

    } catch (error) {
      logger.error(`Error fetching region ${code}:`, error.message);
      return null;
    }
  }

  // Get province by code
  async getProvince(code) {
    return await this.getRegion(code);
  }

  // Get regency/city by code
  async getRegency(code) {
    return await this.getRegion(code);
  }

  // Get district by code
  async getDistrict(code) {
    return await this.getRegion(code);
  }

  // Get village by code
  async getVillage(code) {
    return await this.getRegion(code);
  }

  // Parse region codes from address
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
      
      // Search province
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
      
      // Search regency
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
      
      // Search district
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
      
      // Search village
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

  // Search province by name
  async searchProvince(name) {
    try {
      logger.info(`Searching province: ${name}`);
      
      // Normalize search term
      const searchTerm = name.trim().toUpperCase();
      
      // Try API search first
      let response = await this.client.get('/provinces', {
        params: { search: name }
      });
      
      // Get all provinces if search returns nothing
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all provinces');
        response = await this.client.get('/provinces');
      }
      
      if (response.data && response.data.data) {
        const provinces = response.data.data;
        
        // Try exact match first (case-insensitive)
        let found = provinces.find(p => 
          p.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`Province found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try contains match
        found = provinces.find(p =>
          p.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(p.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`Province found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try partial word match
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

  // Search regency by name
  async searchRegency(provinceCode, name) {
    try {
      logger.info(`Searching regency: ${name} in province ${provinceCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      // Try API search first
      let response = await this.client.get('/regencies', {
        params: { search: name }
      });
      
      // Get all regencies if search returns nothing
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all regencies');
        response = await this.client.get('/regencies');
      }
      
      if (response.data && response.data.data) {
        const regencies = response.data.data;
        
        // Filter by province code first
        const provinceRegencies = regencies.filter(r => r.provinceCode === provinceCode);
        logger.info(`Found ${provinceRegencies.length} regencies in province ${provinceCode}`);
        
        // Try exact match first
        let found = provinceRegencies.find(r => 
          r.name.toUpperCase() === searchTerm ||
          r.name.toUpperCase() === `KABUPATEN ${searchTerm}` ||
          r.name.toUpperCase() === `KOTA ${searchTerm}`
        );
        
        if (found) {
          logger.info(`Regency found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try contains match (remove KABUPATEN/KOTA prefix)
        found = provinceRegencies.find(r => {
          const cleanName = r.name.toUpperCase().replace(/^(KABUPATEN|KOTA)\s+/, '');
          return cleanName.includes(searchTerm) || searchTerm.includes(cleanName);
        });
        
        if (found) {
          logger.info(`Regency found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try partial word match
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

  // Search district by name
  async searchDistrict(regencyCode, name) {
    try {
      logger.info(`Searching district: ${name} in regency ${regencyCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      // Try API search first
      let response = await this.client.get('/districts', {
        params: { search: name }
      });
      
      // Get all districts if search returns nothing
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all districts');
        response = await this.client.get('/districts');
      }
      
      if (response.data && response.data.data) {
        const districts = response.data.data;
        
        // Filter by regency code first
        const regencyDistricts = districts.filter(d => d.regencyCode === regencyCode);
        logger.info(`Found ${regencyDistricts.length} districts in regency ${regencyCode}`);
        
        // Try exact match first
        let found = regencyDistricts.find(d => 
          d.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`District found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try contains match
        found = regencyDistricts.find(d =>
          d.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(d.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`District found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try partial word match
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

  // Search village by name
  async searchVillage(districtCode, name) {
    try {
      logger.info(`Searching village: ${name} in district ${districtCode}`);
      
      const searchTerm = name.trim().toUpperCase();
      
      // Try API search first
      let response = await this.client.get('/villages', {
        params: { search: name }
      });
      
      // Get all villages if search returns nothing
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.info('API search returned no results, fetching all villages');
        response = await this.client.get('/villages');
      }
      
      if (response.data && response.data.data) {
        const villages = response.data.data;
        
        // Filter by district code first
        const districtVillages = villages.filter(v => v.districtCode === districtCode);
        logger.info(`Found ${districtVillages.length} villages in district ${districtCode}`);
        
        // Try exact match first
        let found = districtVillages.find(v => 
          v.name.toUpperCase() === searchTerm
        );
        
        if (found) {
          logger.info(`Village found (exact match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try contains match
        found = districtVillages.find(v =>
          v.name.toUpperCase().includes(searchTerm) ||
          searchTerm.includes(v.name.toUpperCase())
        );
        
        if (found) {
          logger.info(`Village found (contains match): ${found.name} (${found.code})`);
          return found;
        }
        
        // Try partial word match
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

  // Get full region hierarchy
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

module.exports = new RegionService();
