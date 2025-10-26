const FamilyDataModel = require('../database/FamilyDataModel');
const ResidentModel = require('../database/ResidentModel');
const RegionService = require('./RegionService');
const ReferenceService = require('./ReferenceService');
const logger = require('../utils/logger');
const dateParser = require('../utils/dateParser');
const { normalizeKK, normalizeNIK } = require('../utils/textCleaner');
const moment = require('moment');

class AutoCreateService {
  
  static async autoCreate(ocrData, userId) {
    try {
      logger.info('Starting auto-create process...');

      
      if (!ocrData || !ocrData.nomor_kk) {
        throw new Error('Invalid OCR data: missing nomor_kk');
      }

      if (!ocrData.table || ocrData.table.length === 0) {
        throw new Error('Invalid OCR data: no family members');
      }

      const familyCardNumber = normalizeKK(ocrData.nomor_kk);

      if (!familyCardNumber) {
        throw new Error('Invalid family card number format');
      }

      
      const existingFamily = await FamilyDataModel.findByFamilyCard(familyCardNumber);
      
      let familyResult;
      let isNewFamily = false;

      
      const regionCodes = await this.parseRegionCodes(ocrData);

      
      const { citizenAssociationCode, communityUnitCode } = this.parseRTRW(ocrData.rt_rw);

      
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

module.exports = AutoCreateService;
