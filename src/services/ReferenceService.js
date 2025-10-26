const db = require('../config/database');
const logger = require('../utils/logger');

class ReferenceService {
  constructor() {
    // Cache for reference data
    this.cache = {
      religions: null,
      educations: null,
      occupations: null,
      maritalStatuses: null,
      bloodTypes: null,
      citizenships: null,
      familyRelationships: null,
      ageCategories: null
    };

    // Fallback data (if database is not available)
    this.fallbackData = {
      religions: [
        { id: 1, name: 'Islam' },
        { id: 2, name: 'Kristen' },
        { id: 3, name: 'Katholik' },
        { id: 4, name: 'Hindu' },
        { id: 5, name: 'Budha' },
        { id: 6, name: 'Konghucu' },
        { id: 7, name: 'Kepercayaan Terhadap Tuhan YME' }
      ],
      educations: [
        { id: 1, name: 'TIDAK/BELUM SEKOLAH' },
        { id: 2, name: 'SD/SEDERAJAT' },
        { id: 3, name: 'SMP/SEDERAJAT' },
        { id: 4, name: 'SLTA/SEDERAJAT' },
        { id: 5, name: 'DIPLOMA I' },
        { id: 6, name: 'DIPLOMA II' },
        { id: 7, name: 'DIPLOMA III' },
        { id: 8, name: 'DIPLOMA IV' },
        { id: 9, name: 'STRATA I' },
        { id: 10, name: 'STRATA II' },
        { id: 11, name: 'STRATA III' }
      ],
      occupations: [
        { id: 1, name: 'KARYAWAN' },
        { id: 2, name: 'SWASTA' },
        { id: 3, name: 'PNS' },
        { id: 4, name: 'WIRASWASTA' },
        { id: 5, name: 'PELAJAR' },
        { id: 6, name: 'MAHASISWA' },
        { id: 7, name: 'GURU' },
        { id: 8, name: 'DOSEN' },
        { id: 9, name: 'PETANI' },
        { id: 10, name: 'BURUH' },
        { id: 11, name: 'NELAYAN' }
      ],
      maritalStatuses: [
        { id: 1, name: 'BELUM KAWIN' },
        { id: 2, name: 'KAWIN' },
        { id: 3, name: 'CERAI HIDUP' },
        { id: 4, name: 'CERAI MATI' }
      ],
      bloodTypes: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'AB' },
        { id: 4, name: 'O' },
        { id: 5, name: 'A+' },
        { id: 6, name: 'A-' },
        { id: 7, name: 'B+' },
        { id: 8, name: 'B-' },
        { id: 9, name: 'AB+' },
        { id: 10, name: 'AB-' },
        { id: 11, name: 'O+' },
        { id: 12, name: 'O-' }
      ],
      citizenships: [
        { id: 1, name: 'WNI' },
        { id: 2, name: 'WNA' }
      ],
      familyRelationships: [
        { id: 1, name: 'KEPALA KELUARGA' },
        { id: 2, name: 'SUAMI' },
        { id: 3, name: 'ISTRI' },
        { id: 4, name: 'ANAK' },
        { id: 5, name: 'MENANTU' },
        { id: 6, name: 'CUCU' },
        { id: 7, name: 'ORANG TUA' },
        { id: 8, name: 'MERTUA' },
        { id: 9, name: 'FAMILI' },
        { id: 10, name: 'LAINNYA' }
      ],
      ageCategories: [
        { id: 1, name: 'Bayi', min_age: 0, max_age: 1 },
        { id: 2, name: 'Balita', min_age: 2, max_age: 5 },
        { id: 3, name: 'Anak-anak', min_age: 6, max_age: 12 },
        { id: 4, name: 'Remaja', min_age: 13, max_age: 17 },
        { id: 5, name: 'Dewasa Muda', min_age: 18, max_age: 30 },
        { id: 6, name: 'Dewasa', min_age: 31, max_age: 50 },
        { id: 7, name: 'Lansia', min_age: 51, max_age: 65 },
        { id: 8, name: 'Manula', min_age: 66, max_age: 999 }
      ]
    };
  }

  // ===================================
  // RELIGION METHODS
  // ===================================

  async getReligions() {
    if (this.cache.religions) {
      return this.cache.religions;
    }

    try {
      const sql = 'SELECT id, name FROM religions ORDER BY id';
      const results = await db.query(sql);
      this.cache.religions = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch religions from database, using fallback');
      return this.fallbackData.religions;
    }
  }

  async getReligionId(name) {
    if (!name) return null;

    const religions = await this.getReligions();
    const normalized = name.toUpperCase().trim();

    // Direct match
    let religion = religions.find(r => r.name.toUpperCase() === normalized);
    if (religion) return religion.id;

    // Partial match
    religion = religions.find(r => r.name.toUpperCase().includes(normalized) || normalized.includes(r.name.toUpperCase()));
    if (religion) return religion.id;

    // Default to Islam (id: 1)
    return 1;
  }

  // ===================================
  // EDUCATION METHODS
  // ===================================

  async getEducations() {
    if (this.cache.educations) {
      return this.cache.educations;
    }

    try {
      const sql = 'SELECT id, name FROM educations ORDER BY id';
      const results = await db.query(sql);
      this.cache.educations = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch educations from database, using fallback');
      return this.fallbackData.educations;
    }
  }

  async getEducationId(name) {
    if (!name) return null;

    const educations = await this.getEducations();
    const normalized = name.toUpperCase().trim();

    // Mapping untuk normalisasi
    const educationMap = {
      'TIDAK': 'TIDAK/BELUM SEKOLAH',
      'BELUM': 'TIDAK/BELUM SEKOLAH',
      'SD': 'SD/SEDERAJAT',
      'SEKOLAH DASAR': 'SD/SEDERAJAT',
      'SMP': 'SMP/SEDERAJAT',
      'SLTP': 'SMP/SEDERAJAT',
      'SMA': 'SLTA/SEDERAJAT',
      'SLTA': 'SLTA/SEDERAJAT',
      'SMK': 'SLTA/SEDERAJAT',
      'D1': 'DIPLOMA I',
      'D2': 'DIPLOMA II',
      'D3': 'DIPLOMA III',
      'D4': 'DIPLOMA IV',
      'S1': 'STRATA I',
      'S2': 'STRATA II',
      'S3': 'STRATA III'
    };

    // Try mapping first
    const mappedName = educationMap[normalized];
    if (mappedName) {
      const education = educations.find(e => e.name.toUpperCase() === mappedName);
      if (education) return education.id;
    }

    // Direct match
    let education = educations.find(e => e.name.toUpperCase() === normalized);
    if (education) return education.id;

    // Partial match
    education = educations.find(e =>
      e.name.toUpperCase().includes(normalized) ||
      normalized.includes(e.name.toUpperCase())
    );
    if (education) return education.id;

    // Default to TIDAK/BELUM SEKOLAH (id: 1)
    return 1;
  }

  // ===================================
  // OCCUPATION METHODS
  // ===================================

  async getOccupations() {
    if (this.cache.occupations) {
      return this.cache.occupations;
    }

    try {
      const sql = 'SELECT id, name FROM occupations ORDER BY id';
      const results = await db.query(sql);
      this.cache.occupations = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch occupations from database, using fallback');
      return this.fallbackData.occupations;
    }
  }

  async getOccupationId(name) {
    if (!name) return null;

    const occupations = await this.getOccupations();
    const normalized = name.toUpperCase().trim();

    // Direct match
    let occupation = occupations.find(o => o.name.toUpperCase() === normalized);
    if (occupation) return occupation.id;

    // Partial match
    occupation = occupations.find(o =>
      o.name.toUpperCase().includes(normalized) ||
      normalized.includes(o.name.toUpperCase())
    );
    if (occupation) return occupation.id;

    return null;
  }

  // ===================================
  // MARITAL STATUS METHODS
  // ===================================

  async getMaritalStatuses() {
    if (this.cache.maritalStatuses) {
      return this.cache.maritalStatuses;
    }

    try {
      const sql = 'SELECT id, name FROM marital_statuses ORDER BY id';
      const results = await db.query(sql);
      this.cache.maritalStatuses = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch marital statuses from database, using fallback');
      return this.fallbackData.maritalStatuses;
    }
  }

  async getMaritalStatusId(name) {
    if (!name) return null;

    const statuses = await this.getMaritalStatuses();
    const normalized = name.toUpperCase().trim();

    // Direct match
    let status = statuses.find(s => s.name.toUpperCase() === normalized);
    if (status) return status.id;

    // Partial match
    status = statuses.find(s =>
      s.name.toUpperCase().includes(normalized) ||
      normalized.includes(s.name.toUpperCase())
    );
    if (status) return status.id;

    // Default to BELUM KAWIN (id: 1)
    return 1;
  }

  // ===================================
  // BLOOD TYPE METHODS
  // ===================================

  async getBloodTypes() {
    if (this.cache.bloodTypes) {
      return this.cache.bloodTypes;
    }

    try {
      const sql = 'SELECT id, name FROM blood_types ORDER BY id';
      const results = await db.query(sql);
      this.cache.bloodTypes = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch blood types from database, using fallback');
      return this.fallbackData.bloodTypes;
    }
  }

  async getBloodTypeId(name) {
    if (!name) return null;

    const bloodTypes = await this.getBloodTypes();
    const normalized = name.toUpperCase().trim();

    const bloodType = bloodTypes.find(b => b.name.toUpperCase() === normalized);
    return bloodType ? bloodType.id : null;
  }

  // ===================================
  // CITIZENSHIP METHODS
  // ===================================

  async getCitizenships() {
    if (this.cache.citizenships) {
      return this.cache.citizenships;
    }

    try {
      const sql = 'SELECT id, name FROM citizenships ORDER BY id';
      const results = await db.query(sql);
      this.cache.citizenships = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch citizenships from database, using fallback');
      return this.fallbackData.citizenships;
    }
  }

  async getCitizenshipId(name) {
    if (!name) return 1; // Default to WNI

    const citizenships = await this.getCitizenships();
    const normalized = name.toUpperCase().trim();

    const citizenship = citizenships.find(c => c.name.toUpperCase() === normalized);
    return citizenship ? citizenship.id : 1; // Default to WNI (id: 1)
  }

  // ===================================
  // FAMILY RELATIONSHIP METHODS
  // ===================================

  async getFamilyRelationships() {
    if (this.cache.familyRelationships) {
      return this.cache.familyRelationships;
    }

    try {
      const sql = 'SELECT id, name FROM family_relationships ORDER BY id';
      const results = await db.query(sql);
      this.cache.familyRelationships = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch family relationships from database, using fallback');
      return this.fallbackData.familyRelationships;
    }
  }

  async getFamilyRelationshipId(name) {
    if (!name) return null;

    const relationships = await this.getFamilyRelationships();
    const normalized = name.toUpperCase().trim();

    // Mapping untuk normalisasi
    const relationshipMap = {
      'KEPALA': 'KEPALA KELUARGA',
      'KK': 'KEPALA KELUARGA',
      'ORANGTUA': 'ORANG TUA',
      'ORANG TUA': 'ORANG TUA',
      'FAMILI LAIN': 'FAMILI',
      'LAIN': 'LAINNYA'
    };

    // Try mapping first
    const mappedName = relationshipMap[normalized];
    if (mappedName) {
      const relationship = relationships.find(r => r.name.toUpperCase() === mappedName);
      if (relationship) return relationship.id;
    }

    // Direct match
    let relationship = relationships.find(r => r.name.toUpperCase() === normalized);
    if (relationship) return relationship.id;

    // Partial match
    relationship = relationships.find(r =>
      r.name.toUpperCase().includes(normalized) ||
      normalized.includes(r.name.toUpperCase())
    );
    if (relationship) return relationship.id;

    return null;
  }

  // ===================================
  // AGE CATEGORY METHODS
  // ===================================

  async getAgeCategories() {
    if (this.cache.ageCategories) {
      return this.cache.ageCategories;
    }

    try {
      const sql = 'SELECT id, name, min_age, max_age FROM age_categories ORDER BY min_age';
      const results = await db.query(sql);
      this.cache.ageCategories = results;
      return results;
    } catch (error) {
      logger.warn('Failed to fetch age categories from database, using fallback');
      return this.fallbackData.ageCategories;
    }
  }

  async getAgeCategoryId(age) {
    if (age === null || age === undefined) return null;

    const categories = await this.getAgeCategories();

    const category = categories.find(c => age >= c.min_age && age <= c.max_age);
    return category ? category.id : null;
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  async getAllReferences() {
    return {
      religions: await this.getReligions(),
      educations: await this.getEducations(),
      occupations: await this.getOccupations(),
      maritalStatuses: await this.getMaritalStatuses(),
      bloodTypes: await this.getBloodTypes(),
      citizenships: await this.getCitizenships(),
      familyRelationships: await this.getFamilyRelationships(),
      ageCategories: await this.getAgeCategories()
    };
  }

  clearCache() {
    this.cache = {
      religions: null,
      educations: null,
      occupations: null,
      maritalStatuses: null,
      bloodTypes: null,
      citizenships: null,
      familyRelationships: null,
      ageCategories: null
    };
    logger.info('Reference cache cleared');
  }
}

module.exports = new ReferenceService();
