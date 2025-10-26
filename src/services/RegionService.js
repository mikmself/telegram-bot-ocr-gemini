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

  
  async getRegion(code) {
    try {
      logger.info(`Fetching region data for code: ${code}`);


      let response;

      if (code.length === 2) {

        response = await this.client.get(`/provinces/${code}`);
      } else if (code.length === 4) {

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

module.exports = new RegionService();
