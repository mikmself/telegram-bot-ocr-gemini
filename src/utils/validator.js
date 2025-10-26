const logger = require('./logger');

class Validator {
  static isValidNIK(nik) {
    if (!nik) return false;
    const nikStr = String(nik).trim();
    return /^\d{16}$/.test(nikStr);
  }

  static isValidKK(kk) {
    if (!kk) return false;
    const kkStr = String(kk).trim();
    return /^\d{16}$/.test(kkStr);
  }

  static isValidPhone(phone) {
    if (!phone) return false;
    const phoneStr = String(phone).trim();
    return /^(\+62|62|0)[0-9]{8,12}$/.test(phoneStr);
  }

  static isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  static isValidDate(dateString) {
    if (!dateString) return false;

    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) return false;

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;

    return true;
  }

  static isValidGender(gender) {
    if (!gender) return false;
    const normalized = gender.toUpperCase().trim();
    return ['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(normalized);
  }

  static isValidRegionCode(code) {
    if (!code) return false;
    let codeStr = String(code).trim();
    
    codeStr = codeStr.replace(/\./g, '');
    
    return /^(\d{2}|\d{4}|\d{6}|\d{10}|\d{13})$/.test(codeStr);
  }

  static isValidRTRW(rtRw) {
    if (!rtRw) return false;
    return /^\d{3}\/\d{3}$/.test(rtRw.trim());
  }

  static isValidPostalCode(code) {
    if (!code) return false;
    const codeStr = String(code).trim();
    return /^\d{5}$/.test(codeStr);
  }

  static isValidName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && /^[a-zA-Z\s.,'-]+$/.test(trimmed);
  }

  static isValidUsername(username) {
    if (!username) return false;
    return /^[a-zA-Z0-9_]{3,30}$/.test(username);
  }

  static isValidPassword(password) {
    if (!password) return false;
    return password.length >= 6;
  }

  static validateFamilyData(data) {
    const errors = [];

    if (!this.isValidKK(data.nomor_kk)) {
      errors.push('Invalid KK number (must be 16 digits)');
    }

    if (!data.nama_kepala_keluarga || data.nama_kepala_keluarga.trim().length < 2) {
      errors.push('Invalid or missing family head name');
    }

    if (!data.alamat || data.alamat.trim().length < 5) {
      errors.push('Invalid or missing address');
    }

    if (!data.table || !Array.isArray(data.table) || data.table.length === 0) {
      errors.push('No family members found');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateResidentData(resident) {
    const errors = [];

    if (!this.isValidNIK(resident.nik)) {
      errors.push('Invalid NIK (must be 16 digits)');
    }

    if (!this.isValidName(resident.nama_lengkap)) {
      errors.push('Invalid name');
    }

    if (!this.isValidGender(resident.jenis_kelamin)) {
      errors.push('Invalid gender');
    }

    if (!this.isValidDate(resident.tanggal_lahir)) {
      errors.push('Invalid birth date (must be DD-MM-YYYY)');
    }

    if (!resident.tempat_lahir || resident.tempat_lahir.trim().length < 2) {
      errors.push('Invalid birth place');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitize(input) {
    if (typeof input !== 'string') return input;

    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '')
      .substring(0, 1000);
  }

  static validateLogin(username, password) {
    const errors = [];

    if (!this.isValidUsername(username)) {
      errors.push('Invalid username (3-30 alphanumeric characters)');
    }

    if (!this.isValidPassword(password)) {
      errors.push('Invalid password (minimum 6 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        username: this.sanitize(username),
        password: password
      }
    };
  }
}

module.exports = Validator;
