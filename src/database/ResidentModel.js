const db = require('../config/database');
const logger = require('../utils/logger');

class ResidentModel {
  // Find resident by NIK
  static async findByNIK(nik) {
    try {
      const sql = 'SELECT * FROM residents WHERE nik = ? LIMIT 1';
      const results = await db.query(sql, [nik]);

      if (results.length === 0) {
        return null;
      }

      return results[0];
    } catch (error) {
      logger.error('Error finding resident by NIK:', error);
      throw error;
    }
  }

  // Find residents by family card number
  static async findByFamilyCard(familyCardNumber) {
    try {
      const sql = `
        SELECT * FROM residents
        WHERE family_card_number = ?
        ORDER BY family_relationship_id, name
      `;
      const results = await db.query(sql, [familyCardNumber]);

      return results;
    } catch (error) {
      logger.error('Error finding residents by family card:', error);
      throw error;
    }
  }

  // Create new resident record
  static async create(residentData) {
    try {
      const sql = `
        INSERT INTO residents (
          nik,
          name,
          birth_place,
          birth_date,
          gender,
          age,
          family_card_number,
          postal_code,
          address,
          father_name,
          mother_name,
          family_relationship_id,
          religion_id,
          education_id,
          occupation_id,
          marital_status_id,
          citizenship_id,
          age_category_id,
          blood_type_id,
          province_code,
          regency_code,
          district_code,
          village_code,
          hamlet_code,
          community_unit_code,
          citizen_association_code,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const params = [
        residentData.nik,
        residentData.name,
        residentData.birth_place || null,
        residentData.birth_date || null,
        residentData.gender,
        residentData.age || null,
        residentData.family_card_number,
        residentData.postal_code || null,
        residentData.address || null,
        residentData.father_name || null,
        residentData.mother_name || null,
        residentData.family_relationship_id || null,
        residentData.religion_id || null,
        residentData.education_id || null,
        residentData.occupation_id || null,
        residentData.marital_status_id || null,
        residentData.citizenship_id || null,
        residentData.age_category_id || null,
        residentData.blood_type_id || null,
        residentData.province_code || null,
        residentData.regency_code || null,
        residentData.district_code || null,
        residentData.village_code || null,
        residentData.hamlet_code || null,
        residentData.community_unit_code || null,
        residentData.citizen_association_code || null,
        residentData.is_active !== undefined ? residentData.is_active : 1
      ];

      const result = await db.query(sql, params);

      logger.info(`Resident created: NIK ${residentData.nik}, Name ${residentData.name}`);

      return {
        id: result.insertId,
        nik: residentData.nik
      };
    } catch (error) {
      logger.error('Error creating resident:', error);
      throw error;
    }
  }

  // Update resident record
  static async update(nik, residentData) {
    try {
      const sql = `
        UPDATE residents
        SET
          name = ?,
          birth_place = ?,
          birth_date = ?,
          gender = ?,
          age = ?,
          family_card_number = ?,
          postal_code = ?,
          address = ?,
          father_name = ?,
          mother_name = ?,
          family_relationship_id = ?,
          religion_id = ?,
          education_id = ?,
          occupation_id = ?,
          marital_status_id = ?,
          citizenship_id = ?,
          age_category_id = ?,
          blood_type_id = ?,
          province_code = ?,
          regency_code = ?,
          district_code = ?,
          village_code = ?,
          hamlet_code = ?,
          community_unit_code = ?,
          citizen_association_code = ?,
          updated_at = NOW()
        WHERE nik = ?
      `;

      const params = [
        residentData.name,
        residentData.birth_place || null,
        residentData.birth_date || null,
        residentData.gender,
        residentData.age || null,
        residentData.family_card_number,
        residentData.postal_code || null,
        residentData.address || null,
        residentData.father_name || null,
        residentData.mother_name || null,
        residentData.family_relationship_id || null,
        residentData.religion_id || null,
        residentData.education_id || null,
        residentData.occupation_id || null,
        residentData.marital_status_id || null,
        residentData.citizenship_id || null,
        residentData.age_category_id || null,
        residentData.blood_type_id || null,
        residentData.province_code || null,
        residentData.regency_code || null,
        residentData.district_code || null,
        residentData.village_code || null,
        residentData.hamlet_code || null,
        residentData.community_unit_code || null,
        residentData.citizen_association_code || null,
        nik
      ];

      await db.query(sql, params);

      logger.info(`Resident updated: NIK ${nik}`);

      return true;
    } catch (error) {
      logger.error('Error updating resident:', error);
      throw error;
    }
  }

  // Delete resident record
  static async delete(nik) {
    try {
      const sql = 'DELETE FROM residents WHERE nik = ?';
      await db.query(sql, [nik]);

      logger.info(`Resident deleted: NIK ${nik}`);

      return true;
    } catch (error) {
      logger.error('Error deleting resident:', error);
      throw error;
    }
  }

  // Delete all residents by family card
  static async deleteByFamilyCard(familyCardNumber) {
    try {
      const sql = 'DELETE FROM residents WHERE family_card_number = ?';
      const result = await db.query(sql, [familyCardNumber]);

      logger.info(`Deleted ${result.affectedRows} residents for family card ${familyCardNumber}`);

      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting residents by family card:', error);
      throw error;
    }
  }

  // Search residents
  static async search(criteria) {
    try {
      let sql = 'SELECT * FROM residents WHERE 1=1';
      const params = [];

      if (criteria.nik) {
        sql += ' AND nik LIKE ?';
        params.push(`%${criteria.nik}%`);
      }

      if (criteria.name) {
        sql += ' AND name LIKE ?';
        params.push(`%${criteria.name}%`);
      }

      if (criteria.family_card_number) {
        sql += ' AND family_card_number = ?';
        params.push(criteria.family_card_number);
      }

      sql += ' ORDER BY created_at DESC LIMIT 100';

      const results = await db.query(sql, params);

      return results;
    } catch (error) {
      logger.error('Error searching residents:', error);
      throw error;
    }
  }

  // Get statistics
  static async getStats() {
    try {
      const totalSql = 'SELECT COUNT(*) as total FROM residents WHERE is_active = 1';
      const totalResult = await db.query(totalSql);

      const genderSql = `
        SELECT
          gender,
          COUNT(*) as count
        FROM residents
        WHERE is_active = 1
        GROUP BY gender
      `;
      const genderResult = await db.query(genderSql);

      const todaySql = 'SELECT COUNT(*) as today FROM residents WHERE DATE(created_at) = CURDATE()';
      const todayResult = await db.query(todaySql);

      return {
        total: totalResult[0].total,
        today: todayResult[0].today,
        byGender: genderResult
      };
    } catch (error) {
      logger.error('Error getting resident stats:', error);
      throw error;
    }
  }

  // Bulk create residents (for OCR batch insert)
  static async bulkCreate(residentsData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const results = [];

      for (const resident of residentsData) {
        const sql = `
          INSERT INTO residents (
            nik,
            name,
            birth_place,
            birth_date,
            gender,
            age,
            family_card_number,
            postal_code,
            address,
            father_name,
            mother_name,
            family_relationship_id,
            religion_id,
            education_id,
            occupation_id,
            marital_status_id,
            citizenship_id,
            age_category_id,
            blood_type_id,
            province_code,
            regency_code,
            district_code,
            village_code,
            hamlet_code,
            community_unit_code,
            citizen_association_code,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const params = [
          resident.nik,
          resident.name,
          resident.birth_place || null,
          resident.birth_date || null,
          resident.gender,
          resident.age || null,
          resident.family_card_number,
          resident.postal_code || null,
          resident.address || null,
          resident.father_name || null,
          resident.mother_name || null,
          resident.family_relationship_id || null,
          resident.religion_id || null,
          resident.education_id || null,
          resident.occupation_id || null,
          resident.marital_status_id || null,
          resident.citizenship_id || null,
          resident.age_category_id || null,
          resident.blood_type_id || null,
          resident.province_code || null,
          resident.regency_code || null,
          resident.district_code || null,
          resident.village_code || null,
          resident.hamlet_code || null,
          resident.community_unit_code || null,
          resident.citizen_association_code || null,
          resident.is_active !== undefined ? resident.is_active : 1
        ];

        const [result] = await connection.execute(sql, params);
        results.push({ id: result.insertId, nik: resident.nik });
      }

      await connection.commit();

      logger.info(`Bulk created ${results.length} residents`);

      return results;
    } catch (error) {
      await connection.rollback();
      logger.error('Error in bulk create residents:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ResidentModel;
