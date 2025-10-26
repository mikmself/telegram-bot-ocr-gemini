const moment = require('moment-timezone');
const logger = require('./logger');

moment.tz.setDefault('Asia/Jakarta');

class DateParser {
  static parse(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const cleaned = dateString.trim();

    if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
      return cleaned;
    }

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

  static toMySQLDate(dateString) {
    if (!dateString) return null;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }

    return null;
  }

  static fromMySQLDate(dateString) {
    if (!dateString) return null;

    const parsed = moment(dateString, 'YYYY-MM-DD', true);
    if (parsed.isValid()) {
      return parsed.format('DD-MM-YYYY');
    }

    return null;
  }

  static now() {
    return moment().format('DD-MM-YYYY');
  }

  static nowMySQL() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  static calculateAge(birthDate) {
    if (!birthDate) return null;

    const parsed = moment(birthDate, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return null;

    const age = moment().diff(parsed, 'years');
    return age >= 0 ? age : null;
  }

  static isInPast(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    return parsed.isBefore(moment());
  }

  static isValidBirthDate(dateString) {
    if (!dateString) return false;

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) return false;

    const minDate = moment().subtract(150, 'years');
    const maxDate = moment();

    return parsed.isBetween(minDate, maxDate, null, '[]');
  }

  static format(dateString, formatString = 'DD-MM-YYYY') {
    if (!dateString) return '';

    const parsed = moment(dateString, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) {
      
      const mysqlParsed = moment(dateString, 'YYYY-MM-DD', true);
      if (mysqlParsed.isValid()) {
        return mysqlParsed.format(formatString);
      }
      return dateString;
    }

    return parsed.format(formatString);
  }

  
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

  
  static getSessionExpiry(hours = 24) {
    return moment().add(hours, 'hours').format('YYYY-MM-DD HH:mm:ss');
  }

  
  static isSessionExpired(expiryTime) {
    if (!expiryTime) return true;

    const expiry = moment(expiryTime, 'YYYY-MM-DD HH:mm:ss', true);
    if (!expiry.isValid()) return true;

    return moment().isAfter(expiry);
  }
}

module.exports = DateParser;
