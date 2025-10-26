const UserModel = require('../database/UserModel');
const logger = require('../utils/logger');
const dateParser = require('../utils/dateParser');
const config = require('../config/env');

class AuthService {
  constructor() {
    this.sessions = new Map();
    
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  async login(chatId, username, password) {
    try {
      logger.info(`Login attempt for user: ${username}, chat: ${chatId}`);

      const user = await UserModel.authenticate(username, password);

      if (!user) {
        logger.warn(`Login failed for user: ${username}`);
        return {
          success: false,
          message: 'Username atau password salah'
        };
      }

      await UserModel.updateLastLogin(user.id);

      const session = {
        userId: user.id,
        username: user.username,
        nama_lengkap: user.name,
        level: user.user_type_id,
        villageCode: null,
        villageData: null,
        loginAt: new Date(),
        lastActivity: new Date()
      };

      this.sessions.set(chatId, session);

      logger.info(`Login successful for user: ${username}, session created for chat: ${chatId}`);

      return {
        success: true,
        message: `Selamat datang, ${user.name}!`,
        user: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.name,
          level: user.user_type_id
        }
      };

    } catch (error) {
      logger.error('Error in login:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat login. Silakan coba lagi.'
      };
    }
  }

  async logout(chatId) {
    try {
      logger.info(`Logout for chat: ${chatId}`);

      const session = this.sessions.get(chatId);
      
      if (session) {
        this.sessions.delete(chatId);
        logger.info(`Session deleted for chat: ${chatId}`);
        return {
          success: true,
          message: 'Anda telah logout. Sampai jumpa!'
        };
      }

      return {
        success: false,
        message: 'Anda belum login.'
      };

    } catch (error) {
      logger.error('Error in logout:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat logout.'
      };
    }
  }

  isLoggedIn(chatId) {
    const session = this.sessions.get(chatId);
    
    if (!session) {
      return false;
    }

    const now = new Date();
    const sessionAge = now - session.lastActivity;
    const maxAge = 24 * 60 * 60 * 1000;

    if (sessionAge > maxAge) {
      this.sessions.delete(chatId);
      logger.info(`Session expired for chat: ${chatId}`);
      return false;
    }

    session.lastActivity = now;
    return true;
  }

  getSession(chatId) {
    if (!this.isLoggedIn(chatId)) {
      return null;
    }

    return this.sessions.get(chatId);
  }

  getUserInfo(chatId) {
    const session = this.getSession(chatId);
    
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      username: session.username,
      nama_lengkap: session.nama_lengkap,
      level: session.level,
      villageCode: session.villageCode,
      villageData: session.villageData,
      loginAt: session.loginAt,
      lastActivity: session.lastActivity
    };
  }

  setVillageCode(chatId, villageCode, villageData) {
    const session = this.getSession(chatId);
    if (!session) {
      return false;
    }

    session.villageCode = villageCode;
    session.villageData = villageData;
    session.lastActivity = new Date();

    logger.info(`Village code set for user ${session.username}: ${villageCode}`);
    return true;
  }

  getVillageCode(chatId) {
    const session = this.getSession(chatId);
    return session ? session.villageCode : null;
  }

  getVillageData(chatId) {
    const session = this.getSession(chatId);
    return session ? session.villageData : null;
  }

  hasVillageCode(chatId) {
    const session = this.getSession(chatId);
    return session && session.villageCode !== null;
  }

  requireAuth(chatId) {
    if (this.isLoggedIn(chatId)) {
      return {
        success: true,
        user: this.getUserInfo(chatId)
      };
    }

    return {
      success: false,
      message: 'Anda harus login terlebih dahulu.\n\nGunakan perintah:\n/login <username> <password>'
    };
  }

  cleanupExpiredSessions() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000;
    let removedCount = 0;

    for (const [chatId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActivity;
      if (sessionAge > maxAge) {
        this.sessions.delete(chatId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} expired sessions`);
    }
  }

  getSessionStats() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000;
    
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      const sessionAge = now - session.lastActivity;
      if (sessionAge <= maxAge) {
        activeSessions++;
      } else {
        expiredSessions++;
      }
    }

    return {
      total: this.sessions.size,
      active: activeSessions,
      expired: expiredSessions
    };
  }
}

module.exports = new AuthService();
