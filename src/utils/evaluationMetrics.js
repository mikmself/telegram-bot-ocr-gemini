/**
 * ============================================================================
 * EVALUATION METRICS MODULE
 * ============================================================================
 *
 * Module untuk menghitung metrik evaluasi performa OCR pada berbagai level:
 * - Character-level: Character Recognition Rate (CRR) menggunakan Edit Distance
 * - Field-level: Precision, Recall, F1-Score untuk setiap field
 * - Document-level: End-to-end Success Rate dan Weighted Accuracy
 *
 * Metrik-metrik ini digunakan untuk mengukur akurasi sistem OCR secara ilmiah
 * sesuai dengan metodologi yang dijelaskan dalam BAB III skripsi.
 *
 * Dependencies: None (pure JavaScript implementation)
 *
 * @module evaluationMetrics
 * @author OCR-KK Development Team
 * @created 2025-01-05
 *
 * ============================================================================
 */

/**
 * Menghitung Levenshtein Distance (Edit Distance) antara dua string
 *
 * Edit Distance adalah jumlah minimum operasi insert, delete, atau substitution
 * yang diperlukan untuk mengubah string pertama menjadi string kedua.
 * Algoritma menggunakan dynamic programming dengan kompleksitas O(m*n).
 *
 * Rumus rekursif:
 * - Jika i = 0: D(i,j) = j
 * - Jika j = 0: D(i,j) = i
 * - Jika str1[i] = str2[j]: D(i,j) = D(i-1,j-1)
 * - Jika str1[i] ≠ str2[j]: D(i,j) = 1 + min(D(i-1,j), D(i,j-1), D(i-1,j-1))
 *
 * @param {string} str1 - String pertama (biasanya OCR result)
 * @param {string} str2 - String kedua (biasanya ground truth)
 * @returns {number} Edit distance antara kedua string (0 = identical)
 *
 * @example
 * calculateEditDistance("JAKARTA", "JAKAARTA");
 * // Returns: 1 (satu substitution: T → A)
 *
 * @example
 * calculateEditDistance("1234567890123456", "1234567890123456");
 * // Returns: 0 (perfect match)
 *
 * @example
 * calculateEditDistance("LAKI-LAKI", "LAKI LAKI");
 * // Returns: 1 (satu substitution: - → space)
 */
function calculateEditDistance(str1, str2) {
  // Handle null/undefined inputs
  if (str1 == null) str1 = '';
  if (str2 == null) str2 = '';

  // Convert to strings if not already
  str1 = String(str1);
  str2 = String(str2);

  const m = str1.length;
  const n = str2.length;

  // Create 2D array untuk dynamic programming
  // dp[i][j] = edit distance antara str1[0..i-1] dan str2[0..j-1]
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Base cases: transformasi dari/ke empty string
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i; // Delete semua karakter dari str1
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j; // Insert semua karakter dari str2
  }

  // Fill dp table menggunakan recurrence relation
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // Karakter sama, tidak perlu operasi
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Karakter beda, pilih operasi dengan cost minimal
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // Delete dari str1
          dp[i][j - 1],     // Insert dari str2
          dp[i - 1][j - 1]  // Substitute
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Menghitung Character Recognition Rate (CRR)
 *
 * CRR mengukur akurasi OCR pada level karakter dengan rumus:
 * CRR = ((Total_Characters - Edit_Distance) / Total_Characters) × 100%
 *
 * Di mana:
 * - Total_Characters: Jumlah karakter pada ground truth
 * - Edit_Distance: Levenshtein distance antara OCR result dan ground truth
 *
 * CRR bernilai 0-100%, dimana:
 * - 100% = perfect recognition (OCR result identik dengan ground truth)
 * - 0% = sangat buruk (edit distance >= total characters)
 *
 * @param {string} ocrResult - Hasil OCR yang akan dievaluasi
 * @param {string} groundTruth - Ground truth (data yang benar)
 * @returns {number} CRR percentage (0-100)
 *
 * @example
 * calculateCRR("JAKARTA BARAT", "JAKARTA BARAT");
 * // Returns: 100.00 (perfect match)
 *
 * @example
 * calculateCRR("3201234567890123", "3201234567890124");
 * // Returns: 93.75 (15 correct dari 16 characters)
 *
 * @example
 * calculateCRR("JOHN D0E", "JOHN DOE");
 * // Returns: 87.50 (7 correct dari 8 characters, digit 0 vs letter O)
 */
function calculateCRR(ocrResult, groundTruth) {
  // Handle null/undefined inputs
  if (ocrResult == null) ocrResult = '';
  if (groundTruth == null) groundTruth = '';

  // Convert to strings
  ocrResult = String(ocrResult);
  groundTruth = String(groundTruth);

  const totalChars = groundTruth.length;

  // Edge case: empty ground truth
  if (totalChars === 0) {
    // Jika ground truth kosong dan OCR result juga kosong = perfect
    // Jika ground truth kosong tapi OCR result ada = error (return 0)
    return ocrResult.length === 0 ? 100.0 : 0.0;
  }

  const editDistance = calculateEditDistance(ocrResult, groundTruth);

  // Hitung CRR dengan rumus
  const correctChars = Math.max(0, totalChars - editDistance);
  const crr = (correctChars / totalChars) * 100;

  // Round ke 2 decimal places untuk readability
  return Math.round(crr * 100) / 100;
}

/**
 * Menghitung Field-level Accuracy dengan Precision, Recall, dan F1-Score
 *
 * Field Accuracy mengukur berapa banyak field yang diekstrak dengan benar.
 * Sebuah field dianggap correct jika exact match dengan ground truth setelah
 * normalisasi (trim whitespace, case-insensitive untuk text fields).
 *
 * Metrik yang dihitung:
 * - Accuracy: (Correct Fields / Total Fields) × 100%
 * - Precision: TP / (TP + FP) - dari field yang diekstrak, berapa yang benar
 * - Recall: TP / (TP + FN) - dari field yang seharusnya ada, berapa yang ditemukan
 * - F1-Score: 2 × (Precision × Recall) / (Precision + Recall) - harmonic mean
 *
 * Di mana:
 * - TP (True Positive): Field extracted correctly
 * - FP (False Positive): Field extracted incorrectly atau hallucination
 * - FN (False Negative): Field not extracted (missing)
 * - TN (True Negative): Not applicable untuk field extraction
 *
 * @param {Object} ocrData - Data hasil OCR (key-value pairs)
 * @param {Object} groundTruth - Data ground truth (key-value pairs)
 * @param {Object} [options={}] - Opsi untuk konfigurasi evaluasi
 * @param {boolean} [options.caseInsensitive=true] - Ignore case untuk string comparison
 * @param {boolean} [options.trimWhitespace=true] - Trim whitespace sebelum comparison
 * @param {string[]} [options.numericFields=[]] - List field yang harus dibandingkan sebagai number
 * @returns {Object} Object dengan properties: accuracy, precision, recall, f1Score, details
 *
 * @example
 * const ocr = { nik: "3201234567890123", nama: "JOHN DOE", gender: "LAKI-LAKI" };
 * const truth = { nik: "3201234567890123", nama: "John Doe", gender: "LAKI-LAKI" };
 * const result = calculateFieldAccuracy(ocr, truth);
 * // Returns: { accuracy: 100, precision: 100, recall: 100, f1Score: 100, details: {...} }
 *
 * @example
 * const ocr = { nik: "3201234567890123", nama: "JOHN D0E" }; // Missing gender
 * const truth = { nik: "3201234567890123", nama: "JOHN DOE", gender: "LAKI-LAKI" };
 * const result = calculateFieldAccuracy(ocr, truth);
 * // Returns: { accuracy: 33.33, precision: 50, recall: 33.33, f1Score: 40, ... }
 */
function calculateFieldAccuracy(ocrData, groundTruth, options = {}) {
  // Default options
  const config = {
    caseInsensitive: options.caseInsensitive !== false, // default true
    trimWhitespace: options.trimWhitespace !== false,   // default true
    numericFields: options.numericFields || []
  };

  // Handle null/undefined inputs
  if (!ocrData || typeof ocrData !== 'object') ocrData = {};
  if (!groundTruth || typeof groundTruth !== 'object') groundTruth = {};

  // Get all unique field names dari both objects
  const allFields = new Set([
    ...Object.keys(ocrData),
    ...Object.keys(groundTruth)
  ]);

  let truePositive = 0;   // Field correct
  let falsePositive = 0;  // Field extracted but incorrect
  let falseNegative = 0;  // Field missing
  const fieldResults = {};

  for (const field of allFields) {
    const ocrValue = ocrData[field];
    const truthValue = groundTruth[field];

    // Normalisasi values untuk comparison
    const normalizedOcr = normalizeValue(ocrValue, config, config.numericFields.includes(field));
    const normalizedTruth = normalizeValue(truthValue, config, config.numericFields.includes(field));

    let isCorrect = false;

    if (truthValue === undefined || truthValue === null || truthValue === '') {
      // Ground truth tidak ada field ini
      if (ocrValue !== undefined && ocrValue !== null && ocrValue !== '') {
        // OCR meng-extract field yang tidak ada di ground truth (hallucination)
        falsePositive++;
        fieldResults[field] = { status: 'false_positive', ocr: ocrValue, truth: truthValue };
      } else {
        // Both empty/null - tidak dihitung (true negative)
        fieldResults[field] = { status: 'true_negative', ocr: ocrValue, truth: truthValue };
      }
    } else {
      // Ground truth memiliki field ini
      if (ocrValue === undefined || ocrValue === null || ocrValue === '') {
        // OCR tidak meng-extract field yang seharusnya ada
        falseNegative++;
        fieldResults[field] = { status: 'false_negative', ocr: ocrValue, truth: truthValue };
      } else {
        // Both field ada, check correctness
        if (normalizedOcr === normalizedTruth) {
          truePositive++;
          isCorrect = true;
          fieldResults[field] = { status: 'true_positive', ocr: ocrValue, truth: truthValue };
        } else {
          falsePositive++;
          fieldResults[field] = { status: 'false_positive', ocr: ocrValue, truth: truthValue };
        }
      }
    }
  }

  // Calculate metrics
  const totalFields = truePositive + falsePositive + falseNegative;
  const accuracy = totalFields > 0 ? (truePositive / totalFields) * 100 : 0;

  const precision = (truePositive + falsePositive) > 0
    ? (truePositive / (truePositive + falsePositive)) * 100
    : 0;

  const recall = (truePositive + falseNegative) > 0
    ? (truePositive / (truePositive + falseNegative)) * 100
    : 0;

  const f1Score = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  // Round to 2 decimal places
  return {
    accuracy: Math.round(accuracy * 100) / 100,
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    f1Score: Math.round(f1Score * 100) / 100,
    details: {
      truePositive,
      falsePositive,
      falseNegative,
      totalFields,
      fieldResults
    }
  };
}

/**
 * Helper function untuk normalisasi value sebelum comparison
 *
 * @private
 * @param {*} value - Value yang akan dinormalisasi
 * @param {Object} config - Configuration object
 * @param {boolean} isNumeric - Apakah field ini numeric
 * @returns {*} Normalized value
 */
function normalizeValue(value, config, isNumeric) {
  // Handle null/undefined
  if (value === null || value === undefined) return '';

  // Convert to string
  let normalized = String(value);

  // Trim whitespace jika enabled
  if (config.trimWhitespace) {
    normalized = normalized.trim();
  }

  // Case insensitive jika enabled dan bukan numeric field
  if (config.caseInsensitive && !isNumeric) {
    normalized = normalized.toLowerCase();
  }

  // Untuk numeric fields, parse sebagai number untuk comparison
  if (isNumeric) {
    const num = parseFloat(normalized.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? normalized : num;
  }

  return normalized;
}

/**
 * Menghitung Weighted Field Accuracy berdasarkan field criticality
 *
 * Weighted Field Accuracy memberikan bobot berbeda untuk setiap field
 * berdasarkan tingkat kepentingannya (criticality). Formula:
 *
 * WFA = Σ(Correct_Fields_i × Weight_i) / Σ(Total_Fields_i × Weight_i) × 100%
 *
 * Kategori field berdasarkan criticality:
 * - Critical fields (bobot 2.0): NIK, Nomor KK, Nama Lengkap, Tanggal Lahir
 * - Important fields (bobot 1.5): Tempat Lahir, Jenis Kelamin, Agama, Alamat
 * - Standard fields (bobot 1.0): Pendidikan, Pekerjaan, Status Perkawinan, dll
 *
 * @param {Object} ocrData - Data hasil OCR (nested object untuk KK dengan anggota keluarga)
 * @param {Object} groundTruth - Data ground truth (nested object)
 * @param {Object} [fieldWeights=null] - Custom field weights (jika null, gunakan default)
 * @returns {Object} Object dengan properties: weightedAccuracy, byCategory, fieldScores
 *
 * @example
 * const ocr = {
 *   nomorKK: "3201234567890123",
 *   anggotaKeluarga: [
 *     { nik: "3201234567890124", namaLengkap: "JOHN DOE", jenisKelamin: "LAKI-LAKI" }
 *   ]
 * };
 * const truth = {
 *   nomorKK: "3201234567890123",
 *   anggotaKeluarga: [
 *     { nik: "3201234567890124", namaLengkap: "JOHN DOE", jenisKelamin: "LAKI-LAKI" }
 *   ]
 * };
 * const result = calculateWeightedAccuracy(ocr, truth);
 * // Returns: { weightedAccuracy: 100, byCategory: {...}, fieldScores: [...] }
 */
function calculateWeightedAccuracy(ocrData, groundTruth, fieldWeights = null) {
  // Default field weights berdasarkan criticality (sesuai BAB III skripsi)
  const defaultWeights = {
    // Critical fields (weight = 2.0)
    nik: 2.0,
    nomorKK: 2.0,
    nomor_kk: 2.0,
    family_card_number: 2.0,
    namaLengkap: 2.0,
    nama_lengkap: 2.0,
    full_name: 2.0,
    tanggalLahir: 2.0,
    tanggal_lahir: 2.0,
    birth_date: 2.0,

    // Important fields (weight = 1.5)
    tempatLahir: 1.5,
    tempat_lahir: 1.5,
    birth_place: 1.5,
    jenisKelamin: 1.5,
    jenis_kelamin: 1.5,
    gender: 1.5,
    agama: 1.5,
    religion: 1.5,
    alamat: 1.5,
    address: 1.5,
    namaKepalaKeluarga: 1.5,
    nama_kepala_keluarga: 1.5,

    // Standard fields (weight = 1.0)
    pendidikan: 1.0,
    education: 1.0,
    pekerjaan: 1.0,
    occupation: 1.0,
    statusPerkawinan: 1.0,
    status_perkawinan: 1.0,
    marital_status: 1.0,
    kewarganegaraan: 1.0,
    citizenship: 1.0,
    hubunganKeluarga: 1.0,
    hubungan_keluarga: 1.0,
    family_relationship: 1.0,
    namaAyah: 1.0,
    nama_ayah: 1.0,
    father_name: 1.0,
    namaIbu: 1.0,
    nama_ibu: 1.0,
    mother_name: 1.0,
    rt: 1.0,
    rw: 1.0,
    kelurahan: 1.0,
    kecamatan: 1.0,
    kabupaten: 1.0,
    provinsi: 1.0,
    kodePos: 1.0,
    kode_pos: 1.0
  };

  const weights = fieldWeights || defaultWeights;

  // Flatten nested objects untuk field-by-field comparison
  const flatOcr = flattenObject(ocrData);
  const flatTruth = flattenObject(groundTruth);

  let totalWeightedScore = 0;
  let totalMaxScore = 0;
  const fieldScores = [];
  const categoryScores = {
    critical: { correct: 0, total: 0, weight: 2.0 },
    important: { correct: 0, total: 0, weight: 1.5 },
    standard: { correct: 0, total: 0, weight: 1.0 }
  };

  // Get all unique field names
  const allFields = new Set([
    ...Object.keys(flatOcr),
    ...Object.keys(flatTruth)
  ]);

  for (const field of allFields) {
    const ocrValue = flatOcr[field];
    const truthValue = flatTruth[field];

    // Skip if ground truth tidak ada value untuk field ini
    if (truthValue === undefined || truthValue === null || truthValue === '') {
      continue;
    }

    // Get weight untuk field ini (default 1.0 jika tidak ada di mapping)
    const weight = weights[field] || 1.0;

    // Normalize values untuk comparison
    const normalizedOcr = String(ocrValue || '').trim().toLowerCase();
    const normalizedTruth = String(truthValue || '').trim().toLowerCase();

    const isCorrect = normalizedOcr === normalizedTruth;
    const score = isCorrect ? weight : 0;

    totalWeightedScore += score;
    totalMaxScore += weight;

    // Categorize field berdasarkan weight
    let category = 'standard';
    if (weight >= 2.0) category = 'critical';
    else if (weight >= 1.5) category = 'important';

    categoryScores[category].total += weight;
    if (isCorrect) {
      categoryScores[category].correct += weight;
    }

    fieldScores.push({
      field,
      weight,
      category,
      isCorrect,
      ocrValue,
      truthValue,
      score
    });
  }

  // Calculate weighted accuracy
  const weightedAccuracy = totalMaxScore > 0
    ? (totalWeightedScore / totalMaxScore) * 100
    : 0;

  // Calculate accuracy by category
  const byCategory = {};
  for (const [category, data] of Object.entries(categoryScores)) {
    byCategory[category] = {
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      weight: data.weight,
      correctScore: data.correct,
      maxScore: data.total
    };
  }

  return {
    weightedAccuracy: Math.round(weightedAccuracy * 100) / 100,
    byCategory,
    fieldScores,
    summary: {
      totalWeightedScore,
      totalMaxScore,
      totalFields: allFields.size
    }
  };
}

/**
 * Helper function untuk flatten nested object menjadi single-level object
 *
 * @private
 * @param {Object} obj - Object yang akan di-flatten
 * @param {string} [prefix=''] - Prefix untuk nested keys
 * @returns {Object} Flattened object
 *
 * @example
 * flattenObject({ a: 1, b: { c: 2, d: 3 } })
 * // Returns: { a: 1, 'b.c': 2, 'b.d': 3 }
 */
function flattenObject(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') return {};

  let result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      // Untuk array (misal: anggotaKeluarga), flatten setiap element
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
        } else {
          result[`${newKey}[${index}]`] = item;
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      // Untuk nested object, rekursif flatten
      Object.assign(result, flattenObject(value, newKey));
    } else {
      // Primitive value
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Menghitung End-to-end Success Rate
 *
 * Success Rate mengukur persentase dokumen yang berhasil di-extract dengan benar
 * pada level dokumen (bukan field individual). Ada dua kriteria success:
 *
 * 1. Fully Correct: ALL fields (100%) extracted correctly
 * 2. Acceptable: ALL critical fields correct DAN minimal 90% important+standard fields correct
 *
 * Metrik yang dihitung:
 * - Full Success Rate: (Fully Correct Documents / Total Documents) × 100%
 * - Acceptable Success Rate: (Acceptable Documents / Total Documents) × 100%
 * - Average Field Accuracy: Mean accuracy across all documents
 *
 * @param {Array<Object>} results - Array of evaluation results untuk setiap dokumen
 *   Setiap object harus memiliki structure: { ocrData, groundTruth, [metadata] }
 * @param {Object} [options={}] - Opsi untuk konfigurasi evaluasi
 * @param {number} [options.acceptableThreshold=90] - Threshold untuk acceptable success (%)
 * @param {string[]} [options.criticalFields=[]] - List critical field names
 * @returns {Object} Object dengan properties: fullSuccessRate, acceptableSuccessRate, details
 *
 * @example
 * const results = [
 *   {
 *     ocrData: { nik: "3201234567890123", nama: "JOHN DOE" },
 *     groundTruth: { nik: "3201234567890123", nama: "JOHN DOE" }
 *   },
 *   {
 *     ocrData: { nik: "3201234567890124", nama: "JANE D0E" },
 *     groundTruth: { nik: "3201234567890124", nama: "JANE DOE" }
 *   }
 * ];
 * const rate = calculateSuccessRate(results, {
 *   criticalFields: ['nik', 'nama']
 * });
 * // Returns: { fullSuccessRate: 50, acceptableSuccessRate: 50, ... }
 */
function calculateSuccessRate(results, options = {}) {
  // Default options
  const config = {
    acceptableThreshold: options.acceptableThreshold || 90,
    criticalFields: options.criticalFields || ['nik', 'nomorKK', 'nomor_kk', 'namaLengkap', 'tanggalLahir']
  };

  // Handle invalid inputs
  if (!Array.isArray(results) || results.length === 0) {
    return {
      fullSuccessRate: 0,
      acceptableSuccessRate: 0,
      averageAccuracy: 0,
      details: {
        totalDocuments: 0,
        fullyCorrect: 0,
        acceptable: 0,
        failed: 0,
        documentResults: []
      }
    };
  }

  let fullyCorrectCount = 0;
  let acceptableCount = 0;
  let totalAccuracy = 0;
  const documentResults = [];

  for (let i = 0; i < results.length; i++) {
    const { ocrData, groundTruth, metadata = {} } = results[i];

    // Calculate overall field accuracy untuk dokumen ini
    const fieldAccuracy = calculateFieldAccuracy(ocrData, groundTruth);

    // Calculate critical field accuracy
    const criticalOcr = {};
    const criticalTruth = {};

    for (const field of config.criticalFields) {
      if (ocrData && ocrData[field] !== undefined) criticalOcr[field] = ocrData[field];
      if (groundTruth && groundTruth[field] !== undefined) criticalTruth[field] = groundTruth[field];
    }

    const criticalAccuracy = calculateFieldAccuracy(criticalOcr, criticalTruth);

    // Determine success status
    const isFullyCorrect = fieldAccuracy.accuracy === 100;
    const isCriticalPerfect = criticalAccuracy.accuracy === 100;
    const isAcceptable = isCriticalPerfect && fieldAccuracy.accuracy >= config.acceptableThreshold;

    if (isFullyCorrect) fullyCorrectCount++;
    if (isAcceptable) acceptableCount++;
    totalAccuracy += fieldAccuracy.accuracy;

    documentResults.push({
      index: i,
      metadata,
      isFullyCorrect,
      isAcceptable,
      overallAccuracy: fieldAccuracy.accuracy,
      criticalAccuracy: criticalAccuracy.accuracy,
      fieldAccuracy,
      criticalFieldAccuracy: criticalAccuracy
    });
  }

  const totalDocuments = results.length;
  const fullSuccessRate = (fullyCorrectCount / totalDocuments) * 100;
  const acceptableSuccessRate = (acceptableCount / totalDocuments) * 100;
  const averageAccuracy = totalAccuracy / totalDocuments;

  return {
    fullSuccessRate: Math.round(fullSuccessRate * 100) / 100,
    acceptableSuccessRate: Math.round(acceptableSuccessRate * 100) / 100,
    averageAccuracy: Math.round(averageAccuracy * 100) / 100,
    details: {
      totalDocuments,
      fullyCorrect: fullyCorrectCount,
      acceptable: acceptableCount,
      failed: totalDocuments - acceptableCount,
      documentResults
    }
  };
}

/**
 * ============================================================================
 * MODULE EXPORTS
 * ============================================================================
 */
module.exports = {
  calculateEditDistance,
  calculateCRR,
  calculateFieldAccuracy,
  calculateWeightedAccuracy,
  calculateSuccessRate
};
