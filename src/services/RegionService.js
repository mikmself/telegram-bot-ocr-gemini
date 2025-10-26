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

      const result = {
        kode_provinsi: null,
        kode_kabupaten: null,
        kode_kecamatan: null,
        kode_kelurahan: null
      };

      // Search province
      if (provinsi) {
        const province = await this.searchProvince(provinsi);
        if (province) {
          result.kode_provinsi = province.code;
        }
      }

      // Search regency
      if (kabupatenKota && result.kode_provinsi) {
        const regency = await this.searchRegency(result.kode_provinsi, kabupatenKota);
        if (regency) {
          result.kode_kabupaten = regency.code;
        }
      }

      // Search district
      if (kecamatan && result.kode_kabupaten) {
        const district = await this.searchDistrict(result.kode_kabupaten, kecamatan);
        if (district) {
          result.kode_kecamatan = district.code;
        }
      }

      // Search village
      if (desaKelurahan && result.kode_kecamatan) {
        const village = await this.searchVillage(result.kode_kecamatan, desaKelurahan);
        if (village) {
          result.kode_kelurahan = village.code;
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
      const response = await this.client.get('/provinces', {
        params: { search: name }
      });

      if (response.data && response.data.success && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;

    } catch (error) {
      logger.error(`Error searching province ${name}:`, error.message);
      return null;
    }
  }

  // Search regency by name
  async searchRegency(provinceCode, name) {
    try {
      const response = await this.client.get(`/provinces/${provinceCode}/regencies`, {
        params: { search: name }
      });

      if (response.data && response.data.success && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;

    } catch (error) {
      logger.error(`Error searching regency ${name}:`, error.message);
      return null;
    }
  }

  // Search district by name
  async searchDistrict(regencyCode, name) {
    try {
      const response = await this.client.get(`/regencies/${regencyCode}/districts`, {
        params: { search: name }
      });

      if (response.data && response.data.success && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;

    } catch (error) {
      logger.error(`Error searching district ${name}:`, error.message);
      return null;
    }
  }

  // Search village by name
  async searchVillage(districtCode, name) {
    try {
      const response = await this.client.get(`/districts/${districtCode}/villages`, {
        params: { search: name }
      });

      if (response.data && response.data.success && response.data.data.length > 0) {
        return response.data.data[0];
      }

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
