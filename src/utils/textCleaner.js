const logger = require('./logger');

class TextCleaner {
  static cleanOcrText(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
      .trim();
  }

  static normalizeName(name) {
    if (!name || typeof name !== 'string') return '';

    let cleaned = this.cleanOcrText(name);

    cleaned = cleaned.toUpperCase();

    cleaned = cleaned
      .replace(/[0O]/g, 'O')
      .replace(/[1I]/g, 'I')
      .replace(/[5S]/g, 'S')
      .trim();

    return cleaned;
  }

  
  static normalizeGender(gender) {
    if (!gender || typeof gender !== 'string') return null;

    const cleaned = gender.toUpperCase().trim();

    
    if (cleaned.includes('LAKI')) return 'L';
    if (cleaned.includes('PRIA')) return 'L';
    if (cleaned.includes('MALE')) return 'L';

    if (cleaned.includes('PEREMPUAN')) return 'P';
    if (cleaned.includes('WANITA')) return 'P';
    if (cleaned.includes('FEMALE')) return 'P';

    
    if (cleaned === 'L' || cleaned === 'M') return 'L';
    if (cleaned === 'P' || cleaned === 'F') return 'P';

    
    if (cleaned === '1') return 'L';
    if (cleaned === '2') return 'P';

    logger.warn(`Unable to normalize gender: ${gender}`);
    return null;
  }

  
  static normalizeReligion(religion) {
    if (!religion || typeof religion !== 'string') return '';

    const cleaned = religion.toUpperCase().trim();

    const religionMap = {
      'ISLAM': 'Islam',
      'KRISTEN': 'Kristen',
      'KATOLIK': 'Katholik',
      'KATHOLIK': 'Katholik',
      'HINDU': 'Hindu',
      'BUDHA': 'Budha',
      'BUDDHA': 'Budha',
      'KONGHUCU': 'Konghucu',
      'KONG HU CU': 'Konghucu',
      'KEPERCAYAAN': 'Kepercayaan Terhadap Tuhan YME'
    };

    for (const [key, value] of Object.entries(religionMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(religion);
  }

  
  static normalizeEducation(education) {
    if (!education || typeof education !== 'string') return '';

    const cleaned = education.toUpperCase().trim();

    const educationMap = {
      'TIDAK': 'TIDAK/BELUM SEKOLAH',
      'BELUM': 'TIDAK/BELUM SEKOLAH',
      'SD': 'SD',
      'SEKOLAH DASAR': 'SD',
      'SLTP': 'SLTP',
      'SMP': 'SLTP',
      'SLTA': 'SLTA',
      'SMA': 'SLTA',
      'SMK': 'SLTA',
      'D1': 'DIPLOMA I/II',
      'D2': 'DIPLOMA I/II',
      'D3': 'AKADEMI/DIPLOMA III/S.MUDA',
      'D4': 'DIPLOMA IV/STRATA I',
      'S1': 'DIPLOMA IV/STRATA I',
      'S2': 'STRATA II',
      'S3': 'STRATA III'
    };

    for (const [key, value] of Object.entries(educationMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(education);
  }

  
  static normalizeMaritalStatus(status) {
    if (!status || typeof status !== 'string') return '';

    const cleaned = status.toUpperCase().trim();

    const statusMap = {
      'BELUM KAWIN': 'BELUM KAWIN',
      'BELUM': 'BELUM KAWIN',
      'KAWIN': 'KAWIN',
      'MENIKAH': 'KAWIN',
      'CERAI HIDUP': 'CERAI HIDUP',
      'CERAI MATI': 'CERAI MATI',
      'JANDA': 'CERAI MATI',
      'DUDA': 'CERAI MATI'
    };

    for (const [key, value] of Object.entries(statusMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(status);
  }

  
  static normalizeFamilyRelationship(relationship) {
    if (!relationship || typeof relationship !== 'string') return '';

    const cleaned = relationship.toUpperCase().trim();

    const relationshipMap = {
      'KEPALA KELUARGA': 'KEPALA KELUARGA',
      'KEPALA': 'KEPALA KELUARGA',
      'KK': 'KEPALA KELUARGA',
      'SUAMI': 'SUAMI',
      'ISTRI': 'ISTRI',
      'ISTERI': 'ISTRI',
      'ANAK': 'ANAK',
      'MENANTU': 'MENANTU',
      'CUCU': 'CUCU',
      'ORANGTUA': 'ORANG TUA',
      'ORANG TUA': 'ORANG TUA',
      'MERTUA': 'MERTUA',
      'FAMILI LAIN': 'FAMILI',
      'FAMILI': 'FAMILI',
      'LAINNYA': 'LAINNYA',
      'LAIN': 'LAINNYA'
    };

    for (const [key, value] of Object.entries(relationshipMap)) {
      if (cleaned.includes(key)) {
        return value;
      }
    }

    return this.cleanOcrText(relationship);
  }

  
  static normalizeOccupation(occupation) {
    if (!occupation || typeof occupation !== 'string') return '';

    const cleaned = this.cleanOcrText(occupation);

    
    return cleaned.toUpperCase();
  }

  
  static normalizeCitizenship(citizenship) {
    if (!citizenship || typeof citizenship !== 'string') return 'WNI';

    const cleaned = citizenship.toUpperCase().trim();

    if (cleaned.includes('WNI') || cleaned.includes('INDONESIA')) return 'WNI';
    if (cleaned.includes('WNA') || cleaned.includes('ASING')) return 'WNA';

    return 'WNI'; 
  }

  
  static normalizeAddress(address) {
    if (!address || typeof address !== 'string') return '';

    let cleaned = this.cleanOcrText(address);

    
    cleaned = cleaned
      .replace(/\bJL\b\.?/gi, 'Jalan')
      .replace(/\bRT\b\.?/gi, 'RT')
      .replace(/\bRW\b\.?/gi, 'RW')
      .replace(/\bNo\b\.?/gi, 'No.')
      .replace(/\bKel\b\.?/gi, 'Kel.')
      .replace(/\bKec\b\.?/gi, 'Kec.');

    return cleaned;
  }

  
  static extractRTRW(text) {
    if (!text || typeof text !== 'string') return null;

    
    const pattern = /RT\s*[:\-\.]?\s*(\d+)\s*[\/\\]\s*RW\s*[:\-\.]?\s*(\d+)/i;
    const match = text.match(pattern);

    if (match) {
      const rt = match[1].padStart(3, '0');
      const rw = match[2].padStart(3, '0');
      return `${rt}/${rw}`;
    }

    
    const simplePattern = /(\d{1,3})\s*[\/\\]\s*(\d{1,3})/;
    const simpleMatch = text.match(simplePattern);

    if (simpleMatch) {
      const rt = simpleMatch[1].padStart(3, '0');
      const rw = simpleMatch[2].padStart(3, '0');
      return `${rt}/${rw}`;
    }

    return null;
  }

  
  static removeSpecialChars(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/[^\w\s\-.,]/gi, '')
      .trim();
  }

  
  static normalizeNIK(nik) {
    if (!nik) return null;

    
    const cleaned = String(nik).replace(/\D/g, '');

    
    if (cleaned.length === 16) {
      return cleaned;
    }

    logger.warn(`Invalid NIK length: ${nik} (length: ${cleaned.length})`);
    return null;
  }

  
  static normalizeKK(kk) {
    if (!kk) return null;

    
    const cleaned = String(kk).replace(/\D/g, '');

    
    if (cleaned.length === 16) {
      return cleaned;
    }

    logger.warn(`Invalid KK length: ${kk} (length: ${cleaned.length})`);
    return null;
  }

  
  static normalizePostalCode(code) {
    if (!code) return null;

    
    const cleaned = String(code).replace(/\D/g, '');

    
    if (cleaned.length === 5) {
      return cleaned;
    }

    
    if (cleaned.length > 0 && cleaned.length < 5) {
      return cleaned.padStart(5, '0');
    }

    return null;
  }
}

module.exports = TextCleaner;
