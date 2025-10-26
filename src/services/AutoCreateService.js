const FamilyDataModel = require('../database/FamilyDataModel');
const ResidentModel = require('../database/ResidentModel');
const RegionService = require('./RegionService');
const ReferenceService = require('./ReferenceService');
const logger = require('../utils/logger');
const dateParser = require('../utils/dateParser');
const { normalizeKK, normalizeNIK } = require('../utils/textCleaner');
const moment = require('moment');

class AutoCreateService {
  // Auto create family and residents from OCR data
  static async autoCreate(ocrData, userId) {
    try {
      logger.info('Starting auto-create process...');

      // Validate OCR data
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

      // Check if family already exists
      const existingFamily = await FamilyDataModel.findByFamilyCard(familyCardNumber);

      if (existingFamily) {
        logger.warn(`Family already exists: ${familyCardNumber}`);
        return {
          success: false,
          message: `KK ${familyCardNumber} sudah terdaftar dalam database`,
          exists: true
        };
      }

      // Parse region codes
      const regionCodes = await this.parseRegionCodes(ocrData);

      // Extract RT/RW
      const { citizenAssociationCode, communityUnitCode } = this.parseRTRW(ocrData.rt_rw);

      // Create family data
      const familyData = {
        family_card_number: familyCardNumber,
        province_code: regionCodes.province_code,
        regency_code: regionCodes.regency_code,
        district_code: regionCodes.district_code,
        village_code: regionCodes.village_code,
        hamlet_code: null, // OCR tidak extract hamlet
        community_unit_code: communityUnitCode,     // RW
        citizen_association_code: citizenAssociationCode, // RT
        address: ocrData.alamat || '',
        postal_code: ocrData.kode_pos || null,
        total_members: ocrData.table.length,
        active_members: ocrData.table.length,
        status: 'active'
      };

      // Create family record
      logger.info(`Creating family record: ${familyCardNumber}`);
      const familyResult = await FamilyDataModel.create(familyData);

      // Prepare residents data
      const residentsData = [];

      for (const member of ocrData.table) {
        const nik = normalizeNIK(member.nik);

        if (!nik) {
          logger.warn(`Skipping member with invalid NIK: ${member.nik}`);
          continue;
        }

        // Check if resident already exists
        const existingResident = await ResidentModel.findByNIK(nik);

        if (existingResident) {
          logger.warn(`Resident already exists: ${nik}`);
          continue;
        }

        // Convert date format for MySQL
        const birthDate = dateParser.toMySQLDate(member.tanggal_lahir);

        if (!birthDate) {
          logger.warn(`Invalid birth date for ${member.nama_lengkap}: ${member.tanggal_lahir}`);
          continue;
        }

        // Calculate age
        const age = this.calculateAge(birthDate);

        // Convert strings to IDs using ReferenceService
        const religionId = await ReferenceService.getReligionId(member.agama);
        const educationId = await ReferenceService.getEducationId(member.pendidikan);
        const occupationId = await ReferenceService.getOccupationId(member.jenis_pekerjaan);
        const maritalStatusId = await ReferenceService.getMaritalStatusId(member.status_perkawinan);
        const familyRelationshipId = await ReferenceService.getFamilyRelationshipId(member.status_hubungan_dalam_keluarga);
        const citizenshipId = await ReferenceService.getCitizenshipId(member.kewarganegaraan);
        const ageCategoryId = await ReferenceService.getAgeCategoryId(age);

        // Normalize gender to L/P for database
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
          blood_type_id: null, // OCR tidak extract blood type
          province_code: regionCodes.province_code,
          regency_code: regionCodes.regency_code,
          district_code: regionCodes.district_code,
          village_code: regionCodes.village_code,
          hamlet_code: null,
          community_unit_code: communityUnitCode,     // RW
          citizen_association_code: citizenAssociationCode, // RT
          is_active: 1
        };

        residentsData.push(residentData);
      }

      // Create residents
      logger.info(`Creating ${residentsData.length} resident records...`);
      const residentsResult = await ResidentModel.bulkCreate(residentsData);

      // Update member counts in family_data
      await FamilyDataModel.updateMemberCounts(familyCardNumber);

      logger.info('Auto-create completed successfully');

      return {
        success: true,
        message: `Berhasil membuat KK ${familyCardNumber} dengan ${residentsResult.length} anggota keluarga`,
        data: {
          family: familyResult,
          residents: residentsResult,
          familyCount: 1,
          residentCount: residentsResult.length
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

  // Parse region codes from OCR data
  static async parseRegionCodes(ocrData) {
    try {
      const regionCodes = await RegionService.parseRegionCodes(
        ocrData.provinsi,
        ocrData.kabupaten_kota,
        ocrData.kecamatan,
        ocrData.desa_kelurahan
      );

      // Convert from Indonesian keys to English keys
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

  // Parse RT/RW
  // RT = citizen_association_code (format: 001, 002, etc)
  // RW = community_unit_code (format: 001, 002, etc)
  static parseRTRW(rtRw) {
    if (!rtRw) {
      return { citizenAssociationCode: null, communityUnitCode: null };
    }

    const parts = rtRw.split('/');

    if (parts.length === 2) {
      return {
        citizenAssociationCode: parts[0].trim(),  // RT
        communityUnitCode: parts[1].trim()        // RW
      };
    }

    return { citizenAssociationCode: null, communityUnitCode: null };
  }

  // Calculate age from birth date
  static calculateAge(birthDate) {
    if (!birthDate) return null;

    const birth = moment(birthDate, 'YYYY-MM-DD');
    if (!birth.isValid()) return null;

    const age = moment().diff(birth, 'years');
    return age >= 0 ? age : null;
  }

  // Get create summary
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

  // Validate OCR data before creating
  static validateOcrData(ocrData) {
    const errors = [];

    // Validate KK number
    const familyCardNumber = normalizeKK(ocrData.nomor_kk);
    if (!familyCardNumber) {
      errors.push('Nomor KK tidak valid (harus 16 digit)');
    }

    // Validate family members
    if (!ocrData.table || ocrData.table.length === 0) {
      errors.push('Tidak ada anggota keluarga yang ditemukan');
    } else {
      // Validate each member
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
