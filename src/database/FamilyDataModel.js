const db = require('../config/database');
const logger = require('../utils/logger');

class FamilyDataModel {
  // Find family by family card number
  static async findByFamilyCard(familyCardNumber) {
    try {
      const sql = 'SELECT * FROM family_data WHERE family_card_number = ? LIMIT 1';
      const results = await db.query(sql, [familyCardNumber]);

      if (results.length === 0) {
        return null;
      }

      return results[0];
    } catch (error) {
      logger.error('Error finding family by family card:', error);
      throw error;
    }
  }

  // Create new family record
  static async create(familyData) {
    try {
      const sql = `
        INSERT INTO family_data (
          family_card_number,
          province_code,
          regency_code,
          district_code,
          village_code,
          hamlet_code,
          community_unit_code,
          citizen_association_code,
          address,
          postal_code,
          total_members,
          active_members,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const params = [
        familyData.family_card_number,
        familyData.province_code || null,
        familyData.regency_code || null,
        familyData.district_code || null,
        familyData.village_code || null,
        familyData.hamlet_code || null,
        familyData.community_unit_code || null,
        familyData.citizen_association_code || null,
        familyData.address || null,
        familyData.postal_code || null,
        familyData.total_members || 0,
        familyData.active_members || 0,
        familyData.status || 'active'
      ];

      const result = await db.query(sql, params);

      logger.info(`Family created: ${familyData.family_card_number}`);

      return {
        id: result.insertId,
        family_card_number: familyData.family_card_number
      };
    } catch (error) {
      logger.error('Error creating family:', error);
      throw error;
    }
  }

  // Update family record
  static async update(familyCardNumber, familyData) {
    try {
      const sql = `
        UPDATE family_data
        SET
          province_code = ?,
          regency_code = ?,
          district_code = ?,
          village_code = ?,
          hamlet_code = ?,
          community_unit_code = ?,
          citizen_association_code = ?,
          address = ?,
          postal_code = ?,
          total_members = ?,
          active_members = ?,
          status = ?,
          updated_at = NOW()
        WHERE family_card_number = ?
      `;

      const params = [
        familyData.province_code || null,
        familyData.regency_code || null,
        familyData.district_code || null,
        familyData.village_code || null,
        familyData.hamlet_code || null,
        familyData.community_unit_code || null,
        familyData.citizen_association_code || null,
        familyData.address || null,
        familyData.postal_code || null,
        familyData.total_members || 0,
        familyData.active_members || 0,
        familyData.status || 'active',
        familyCardNumber
      ];

      await db.query(sql, params);

      logger.info(`Family updated: ${familyCardNumber}`);

      return true;
    } catch (error) {
      logger.error('Error updating family:', error);
      throw error;
    }
  }

  // Delete family record
  static async delete(familyCardNumber) {
    try {
      const sql = 'DELETE FROM family_data WHERE family_card_number = ?';
      await db.query(sql, [familyCardNumber]);

      logger.info(`Family deleted: ${familyCardNumber}`);

      return true;
    } catch (error) {
      logger.error('Error deleting family:', error);
      throw error;
    }
  }

  // Get family with members
  static async getFamilyWithMembers(familyCardNumber) {
    try {
      const familySql = 'SELECT * FROM family_data WHERE family_card_number = ? LIMIT 1';
      const familyResults = await db.query(familySql, [familyCardNumber]);

      if (familyResults.length === 0) {
        return null;
      }

      const family = familyResults[0];

      const membersSql = `
        SELECT * FROM residents
        WHERE family_card_number = ?
        ORDER BY family_relationship_id, name
      `;
      const members = await db.query(membersSql, [familyCardNumber]);

      return {
        ...family,
        members
      };
    } catch (error) {
      logger.error('Error getting family with members:', error);
      throw error;
    }
  }

  // Update member counts
  static async updateMemberCounts(familyCardNumber) {
    try {
      const sql = `
        UPDATE family_data
        SET
          total_members = (
            SELECT COUNT(*) FROM residents WHERE family_card_number = ?
          ),
          active_members = (
            SELECT COUNT(*) FROM residents WHERE family_card_number = ? AND is_active = 1
          ),
          updated_at = NOW()
        WHERE family_card_number = ?
      `;

      await db.query(sql, [familyCardNumber, familyCardNumber, familyCardNumber]);

      logger.info(`Member counts updated for family: ${familyCardNumber}`);

      return true;
    } catch (error) {
      logger.error('Error updating member counts:', error);
      throw error;
    }
  }

  // Search families
  static async search(criteria) {
    try {
      let sql = 'SELECT * FROM family_data WHERE 1=1';
      const params = [];

      if (criteria.family_card_number) {
        sql += ' AND family_card_number LIKE ?';
        params.push(`%${criteria.family_card_number}%`);
      }

      if (criteria.village_code) {
        sql += ' AND village_code = ?';
        params.push(criteria.village_code);
      }

      if (criteria.district_code) {
        sql += ' AND district_code = ?';
        params.push(criteria.district_code);
      }

      if (criteria.status) {
        sql += ' AND status = ?';
        params.push(criteria.status);
      }

      sql += ' ORDER BY created_at DESC LIMIT 100';

      const results = await db.query(sql, params);

      return results;
    } catch (error) {
      logger.error('Error searching families:', error);
      throw error;
    }
  }

  // Get statistics
  static async getStats() {
    try {
      const totalSql = 'SELECT COUNT(*) as total FROM family_data';
      const totalResult = await db.query(totalSql);

      const activeSql = 'SELECT COUNT(*) as active FROM family_data WHERE status = "active"';
      const activeResult = await db.query(activeSql);

      const todaySql = 'SELECT COUNT(*) as today FROM family_data WHERE DATE(created_at) = CURDATE()';
      const todayResult = await db.query(todaySql);

      const monthSql = 'SELECT COUNT(*) as month FROM family_data WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
      const monthResult = await db.query(monthSql);

      return {
        total: totalResult[0].total,
        active: activeResult[0].active,
        today: todayResult[0].today,
        month: monthResult[0].month
      };
    } catch (error) {
      logger.error('Error getting family stats:', error);
      throw error;
    }
  }
}

module.exports = FamilyDataModel;
