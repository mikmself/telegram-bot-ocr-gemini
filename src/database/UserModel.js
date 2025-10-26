const db = require('../config/database');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

class UserModel {
  static async findByUsername(username) {
    try {
      const sql = 'SELECT * FROM users WHERE username = ? LIMIT 1';
      const results = await db.query(sql, [username]);

      if (results.length === 0) {
        return null;
      }

      return results[0];
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const sql = 'SELECT * FROM users WHERE id = ? LIMIT 1';
      const results = await db.query(sql, [id]);

      if (results.length === 0) {
        return null;
      }

      return results[0];
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  
  static async authenticate(username, password) {
    try {
      const user = await this.findByUsername(username);

      if (!user) {
        logger.info(`Authentication failed: User not found - ${username}`);
        return null;
      }

      const isValid = await this.verifyPassword(password, user.password);

      if (!isValid) {
        logger.info(`Authentication failed: Invalid password - ${username}`);
        return null;
      }

      logger.info(`Authentication successful: ${username}`);
      return user;
    } catch (error) {
      logger.error('Error authenticating user:', error);
      throw error;
    }
  }

  

  
  static async getUserPermissions(userId) {
    try {
      const user = await this.findById(userId);

      if (!user) {
        return null;
      }

      
      return {
        userId: user.id,
        username: user.username,
        level: user.user_type_id,
        canCreateKK: ['admin', 'operator'].includes(user.user_type_id),
        canEditKK: ['admin', 'operator'].includes(user.user_type_id),
        canDeleteKK: user.user_type_id === 'admin',
        canViewReports: true
      };
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  
  static async updateLastLogin(userId) {
    try {
      
      const checkSql = 'SHOW COLUMNS FROM users LIKE "last_login"';
      const columns = await db.query(checkSql);
      
      if (columns.length > 0) {
        const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
        await db.query(sql, [userId]);
      } else {
        
        logger.info('last_login column does not exist, skipping update');
      }

      return true;
    } catch (error) {
      logger.error('Error updating last login:', error);
      return false;
    }
  }

  
  static async getAll() {
    try {
      const sql = 'SELECT id, username, name, user_type_id, created_at, last_login FROM users ORDER BY created_at DESC';
      const results = await db.query(sql);

      return results;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = UserModel;
