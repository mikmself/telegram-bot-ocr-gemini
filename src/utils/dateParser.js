const moment = require('moment-timezone');
const logger = require('./logger');

// Set default timezone to Indonesia (Jakarta)
moment.tz.setDefault('Asia/Jakarta');

class DateParser {
  // Parse various date formats to DD-MM-YYYY
  static parse(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const cleaned = dateString.trim();

    // Already in DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
      return cleaned;
    }

    // Try various formats
    const formats = [
      'DD-MM-YYYY',
      'DD/MM/YYYY',
      'DD.MM.YYYY',
      'DD MM YYYY',
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'DD-MM-YY',
      'DD/MM/YY',
      'D-M-YYYY',
      'D/M/YYYY',
      'D-M-YY',
      'D/M/YY'
    ];

    for (const format of formats) {
      const parsed = moment(cleaned, format, true);
      if (parsed.isValid()) {
        return parsed.format('DD-MM-YYYY');
      }
    }

    logger.warn(`Failed to parse date: ${dateString}`);
    return null;
  }

  // Convert DD-MM-YYYY to YYYY-MM-DD (for MySQL)
  static toMySQLDate(dateString) {
    if (!dateString) return null;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }

    return null;
  }

  // Convert YYYY-MM-DD (from MySQL) to DD-MM-YYYY
  static fromMySQLDate(dateString) {
    if (!dateString) return null;

    const parsed = moment(dateString, 'YYYY-MM-DD', true);
    if (parsed.isValid()) {
      return parsed.format('DD-MM-YYYY');
    }

    return null;
  }

  // Get current date in DD-MM-YYYY format
  static now() {
    return moment().format('DD-MM-YYYY');
  }

  // Get current datetime in YYYY-MM-DD HH:mm:ss format (for MySQL)
  static nowMySQL() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  // Calculate age from birth date
  static calculateAge(birthDate) {
    if (!birthDate) return null;

    const parsed = moment(birthDate, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return null;

    const age = moment().diff(parsed, 'years');
    return age >= 0 ? age : null;
  }

  // Validate if date is in the past
  static isInPast(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    return parsed.isBefore(moment());
  }

  // Validate if date is in valid range for birth dates
  static isValidBirthDate(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    const minDate = moment().subtract(150, 'years');
    const maxDate = moment();

    return parsed.isBetween(minDate, maxDate, null, '[]');
  }

  // Format date for display
  static format(dateString, formatString = 'DD-MM-YYYY') {
    if (!dateString) return '';

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) {
      // Try MySQL format
      const mysqlParsed = moment(dateString, 'YYYY-MM-DD', true);
      if (mysqlParsed.isValid()) {
        return mysqlParsed.format(formatString);
      }
      return dateString;
    }

    return parsed.format(formatString);
  }

  // Parse Indonesian date text (e.g., "01 Januari 2000")
  static parseIndonesian(dateString) {
    if (!dateString) return null;

    const monthMap = {
      'januari': '01',
      'februari': '02',
      'maret': '03',
      'april': '04',
      'mei': '05',
      'juni': '06',
      'juli': '07',
      'agustus': '08',
      'september': '09',
      'oktober': '10',
      'november': '11',
      'desember': '12'
    };

    const cleaned = dateString.toLowerCase().trim();

    // Match pattern: "DD MonthName YYYY"
    const match = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);

    if (match) {
      const day = match[1].padStart(2, '0');
      const monthName = match[2];
      const year = match[3];

      const month = monthMap[monthName];

      if (month) {
        return `${day}-${month}-${year}`;
      }
    }

    return null;
  }

  // Get session expiry time
  static getSessionExpiry(hours = 24) {
    return moment().add(hours, 'hours').format('YYYY-MM-DD HH:mm:ss');
  }

  // Check if session is expired
  static isSessionExpired(expiryTime) {
    if (!expiryTime) return true;

    const expiry = moment(expiryTime, 'YYYY-MM-DD HH:mm:ss', true);
    if (!expiry.isValid()) return true;

    return moment().isAfter(expiry);
  }
}

module.exports = DateParser;
