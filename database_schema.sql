-- ==============================================
-- DATABASE SCHEMA - SmartGov Bot OCR KK
-- Database: smartgov (MySQL)
-- ==============================================

-- ===============================================
-- ISI DATA TABEL REFERENSI (berdasarkan kode)
-- ==============================================

-- 1. RELIGIONS (Agama)
-- Berdasarkan mapping di OcrService.js dan textCleaner.js
INSERT INTO religions (name) VALUES
('Islam'),                    -- Default jika tidak ada
('Kristen'),
('Katholik'),
('Hindu'),
('Budha'),                    -- Normalisasi dari 'BUDDHA'
('Konghucu'),
('Kepercayaan Terhadap Tuhan YME')
ON DUPLICATE KEY UPDATE name = name;

-- 2. EDUCATIONS (Pendidikan)
-- Berdasarkan mapping di textCleaner.js dan paddleocr-service
INSERT INTO educations (name) VALUES
('TIDAK/BELUM SEKOLAH'),      -- Normalisasi dari berbagai variasi
('SD/SEDERAJAT'),
('SMP/SEDERAJAT'),
('SLTA/SEDERAJAT'),           -- Termasuk SMA/SEDERAJAT, SMK/SEDERAJAT
('DIPLOMA I'),
('DIPLOMA II'),
('DIPLOMA III'),
('DIPLOMA IV'),
('STRATA I'),                 -- S1
('STRATA II'),                -- S2
('STRATA III')                -- S3
ON DUPLICATE KEY UPDATE name = name;

-- 3. OCCUPATIONS (Pekerjaan)
-- Berdasarkan deteksi di paddleocr-service
INSERT INTO occupations (name) VALUES
('KARYAWAN'),
('SWASTA'),
('PNS'),
('WIRASWASTA'),
('PELAJAR'),
('MAHASISWA'),
('GURU'),
('DOSEN'),
('PETANI'),
('BURUH'),
('NELAYAN')
ON DUPLICATE KEY UPDATE name = name;

-- 4. MARITAL_STATUSES (Status Perkawinan)
-- Berdasarkan field status_perkawinan di OCR
INSERT INTO marital_statuses (name) VALUES
('BELUM KAWIN'),
('KAWIN'),
('CERAI HIDUP'),
('CERAI MATI')
ON DUPLICATE KEY UPDATE name = name;

-- 5. BLOOD_TYPES (Golongan Darah)
-- Berdasarkan field golongan_darah di OCR
INSERT INTO blood_types (name) VALUES
('A'),
('B'),
('AB'),
('O'),
('A+'),
('A-'),
('B+'),
('B-'),
('AB+'),
('AB-'),
('O+'),
('O-')
ON DUPLICATE KEY UPDATE name = name;

-- 6. CITIZENSHIPS (Kewarganegaraan)
-- Berdasarkan field kewarganegaraan di OCR
INSERT INTO citizenships (name) VALUES
('WNI'),                      -- Warga Negara Indonesia
('WNA')                       -- Warga Negara Asing
ON DUPLICATE KEY UPDATE name = name;

-- 7. FAMILY_RELATIONSHIPS (Hubungan Keluarga)
-- Berdasarkan fallback mapping di ReferenceService.js
INSERT INTO family_relationships (name) VALUES
('KEPALA KELUARGA'),          -- ID: 1
('SUAMI'),                    -- ID: 2
('ISTRI'),                    -- ID: 3
('ANAK'),                     -- ID: 4
('MENANTU'),                  -- ID: 5
('CUCU'),                     -- ID: 6
('ORANG TUA'),                -- ID: 7
('MERTUA'),                   -- ID: 8
('FAMILI'),                   -- ID: 9
('LAINNYA')                   -- ID: 10
ON DUPLICATE KEY UPDATE name = name;

-- 8. AGE_CATEGORIES (Kategori Umur)
-- Berdasarkan logika getAgeCategoryId di ReferenceService.js
INSERT INTO age_categories (name, min_age, max_age) VALUES
('Bayi', 0, 1),
('Balita', 2, 5),
('Anak-anak', 6, 12),
('Remaja', 13, 17),
('Dewasa Muda', 18, 30),
('Dewasa', 31, 50),
('Lansia', 51, 65),
('Manula', 66, 999)
ON DUPLICATE KEY UPDATE name = name;

-- ==============================================
-- USER SESSIONS TABLE (for Telegram Bot)
-- ==============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  chat_id BIGINT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_chat_id (chat_id),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Check if all required tables exist
SELECT
  TABLE_NAME,
  TABLE_ROWS
FROM
  information_schema.TABLES
WHERE
  TABLE_SCHEMA = 'smartgov'
  AND TABLE_NAME IN ('users', 'family_data', 'residents', 'religions', 'educations', 'occupations', 'marital_statuses', 'blood_types', 'citizenships', 'family_relationships', 'age_categories', 'user_sessions')
ORDER BY TABLE_NAME;

-- Verify reference data counts
SELECT 'religions' as table_name, COUNT(*) as count FROM religions
UNION ALL
SELECT 'educations', COUNT(*) FROM educations
UNION ALL
SELECT 'occupations', COUNT(*) FROM occupations
UNION ALL
SELECT 'marital_statuses', COUNT(*) FROM marital_statuses
UNION ALL
SELECT 'blood_types', COUNT(*) FROM blood_types
UNION ALL
SELECT 'citizenships', COUNT(*) FROM citizenships
UNION ALL
SELECT 'family_relationships', COUNT(*) FROM family_relationships
UNION ALL
SELECT 'age_categories', COUNT(*) FROM age_categories;

-- ==============================================
-- NOTES
-- ==============================================
-- 1. Tables users, family_data, and residents should already exist in your SmartGov database
-- 2. This script only creates user_sessions table and populates reference tables
-- 3. All INSERT statements use ON DUPLICATE KEY UPDATE to avoid errors if data already exists
-- 4. Reference data IDs start from 1 and increment sequentially
-- 5. The bot will automatically use ReferenceService to convert strings to IDs when inserting data
