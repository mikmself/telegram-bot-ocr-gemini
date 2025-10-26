# Update Migration Guide - Database Schema Changes

## ⚠️ PENTING: Perbedaan Database Schema

Berdasarkan reference data yang diberikan, database SmartGov menggunakan **relational IDs** untuk field reference, BUKAN menyimpan string langsung.

## 🔄 Perbandingan Schema

### ❌ Schema Lama (String-based)
```sql
CREATE TABLE residents (
  nik VARCHAR(16),
  nama_lengkap VARCHAR(255),
  agama VARCHAR(100),                          -- String
  pendidikan VARCHAR(100),                     -- String
  jenis_pekerjaan VARCHAR(100),                -- String
  status_perkawinan VARCHAR(50),               -- String
  status_hubungan_dalam_keluarga VARCHAR(50),  -- String
  kewarganegaraan VARCHAR(10)                  -- String
);
```

### ✅ Schema Baru (ID-based) - SESUAI REFERENCE
```sql
CREATE TABLE residents (
  nik VARCHAR(16),
  family_card_number VARCHAR(16),              -- Ganti dari nomor_kk
  name VARCHAR(255),                           -- Ganti dari nama_lengkap
  gender CHAR(1),                              -- L/P (dari jenis_kelamin)
  birth_place VARCHAR(100),                    -- Ganti dari tempat_lahir
  birth_date DATE,                             -- Ganti dari tanggal_lahir
  religion_id INT,                             -- ID reference ✅
  education_id INT,                            -- ID reference ✅
  occupation_id INT,                           -- ID reference ✅
  marital_status_id INT,                       -- ID reference ✅
  family_relationship_id INT,                  -- ID reference ✅
  citizenship_id INT,                          -- ID reference ✅
  blood_type_id INT NULL,                      -- ID reference ✅
  age_category_id INT NULL,                    -- ID reference (calculated) ✅
  father_name VARCHAR(255),                    -- Ganti dari nama_ayah
  mother_name VARCHAR(255),                    -- Ganti dari nama_ibu
  created_by INT,
  created_at DATETIME,
  updated_at DATETIME,

  -- Foreign keys
  FOREIGN KEY (religion_id) REFERENCES religions(id),
  FOREIGN KEY (education_id) REFERENCES educations(id),
  FOREIGN KEY (occupation_id) REFERENCES occupations(id),
  FOREIGN KEY (marital_status_id) REFERENCES marital_statuses(id),
  FOREIGN KEY (family_relationship_id) REFERENCES family_relationships(id),
  FOREIGN KEY (citizenship_id) REFERENCES citizenships(id),
  FOREIGN KEY (blood_type_id) REFERENCES blood_types(id),
  FOREIGN KEY (age_category_id) REFERENCES age_categories(id)
);
```

## 📋 Reference Tables Yang Diperlukan

### 1. religions
```sql
INSERT INTO religions (id, name) VALUES
(1, 'Islam'),
(2, 'Kristen'),
(3, 'Katholik'),
(4, 'Hindu'),
(5, 'Budha'),
(6, 'Konghucu'),
(7, 'Kepercayaan Terhadap Tuhan YME');
```

### 2. educations
```sql
INSERT INTO educations (id, name) VALUES
(1, 'TIDAK/BELUM SEKOLAH'),
(2, 'SD/SEDERAJAT'),
(3, 'SMP/SEDERAJAT'),
(4, 'SLTA/SEDERAJAT'),
(5, 'DIPLOMA I'),
(6, 'DIPLOMA II'),
(7, 'DIPLOMA III'),
(8, 'DIPLOMA IV'),
(9, 'STRATA I'),
(10, 'STRATA II'),
(11, 'STRATA III');
```

### 3. occupations
```sql
INSERT INTO occupations (id, name) VALUES
(1, 'KARYAWAN'),
(2, 'SWASTA'),
(3, 'PNS'),
(4, 'WIRASWASTA'),
(5, 'PELAJAR'),
(6, 'MAHASISWA'),
(7, 'GURU'),
(8, 'DOSEN'),
(9, 'PETANI'),
(10, 'BURUH'),
(11, 'NELAYAN');
```

### 4. marital_statuses
```sql
INSERT INTO marital_statuses (id, name) VALUES
(1, 'BELUM KAWIN'),
(2, 'KAWIN'),
(3, 'CERAI HIDUP'),
(4, 'CERAI MATI');
```

### 5. blood_types
```sql
INSERT INTO blood_types (id, name) VALUES
(1, 'A'), (2, 'B'), (3, 'AB'), (4, 'O'),
(5, 'A+'), (6, 'A-'), (7, 'B+'), (8, 'B-'),
(9, 'AB+'), (10, 'AB-'), (11, 'O+'), (12, 'O-');
```

### 6. citizenships
```sql
INSERT INTO citizenships (id, name) VALUES
(1, 'WNI'),
(2, 'WNA');
```

### 7. family_relationships
```sql
INSERT INTO family_relationships (id, name) VALUES
(1, 'KEPALA KELUARGA'),
(2, 'SUAMI'),
(3, 'ISTRI'),
(4, 'ANAK'),
(5, 'MENANTU'),
(6, 'CUCU'),
(7, 'ORANG TUA'),
(8, 'MERTUA'),
(9, 'FAMILI'),
(10, 'LAINNYA');
```

### 8. age_categories
```sql
INSERT INTO age_categories (id, name, min_age, max_age) VALUES
(1, 'Bayi', 0, 1),
(2, 'Balita', 2, 5),
(3, 'Anak-anak', 6, 12),
(4, 'Remaja', 13, 17),
(5, 'Dewasa Muda', 18, 30),
(6, 'Dewasa', 31, 50),
(7, 'Lansia', 51, 65),
(8, 'Manula', 66, 999);
```

## 🔧 Solusi: 2 Pilihan

### Pilihan 1: Update Database Schema (RECOMMENDED) ✅

**Keuntungan:**
- Lebih terstruktur dan normalized
- Lebih cepat (JOIN lebih efisien dari string comparison)
- Hemat storage
- Konsisten dengan best practice

**Langkah:**
1. Backup database dulu!
2. Buat reference tables (religions, educations, dll)
3. Alter table residents - tambah kolom baru dengan _id
4. Migrate data lama ke ID baru
5. Drop kolom lama (agama, pendidikan, dll)
6. Update code untuk menggunakan ID

### Pilihan 2: Update Code untuk Tetap Pakai String (QUICK FIX)

**Keuntungan:**
- Tidak perlu ubah database
- Lebih cepat implement
- Backward compatible

**Kerugian:**
- Tidak optimal
- Sulit maintain
- Tidak konsisten dengan reference data

## 📝 Cara Implementasi Pilihan 1

Saya sudah membuat **ReferenceService.js** yang baru dengan method untuk convert string ke ID:

```javascript
// Example usage in AutoCreateService.js
const ReferenceService = require('./ReferenceService');

// Convert agama string to ID
const religionId = await ReferenceService.getReligionId('Islam'); // returns 1

// Convert pendidikan string to ID
const educationId = await ReferenceService.getEducationId('SLTA/SEDERAJAT'); // returns 4

// Convert hubungan keluarga string to ID
const relationshipId = await ReferenceService.getFamilyRelationshipId('KEPALA KELUARGA'); // returns 1
```

## 🚨 Yang Perlu Diupdate Jika Pakai Pilihan 1:

1. ✅ **ReferenceService.js** - SUDAH DIUPDATE (fetch dari database, return IDs)
2. ❌ **ResidentModel.js** - PERLU UPDATE (gunakan _id fields)
3. ❌ **AutoCreateService.js** - PERLU UPDATE (convert strings to IDs)
4. ❌ **FamilyDataModel.js** - CEK field names
5. ❌ **Database schema** - CREATE reference tables

## 💡 Rekomendasi

**Saya sarankan Pilihan 1** karena:
- Lebih sustainable jangka panjang
- Sesuai dengan reference data yang Anda berikan
- Lebih mudah untuk reporting dan analytics
- Database lebih optimal

**TAPI** ini membutuhkan:
- Database migration
- Update beberapa file code
- Testing ulang

**Mau saya lanjutkan update files untuk Pilihan 1?**
Atau Anda prefer Pilihan 2 (keep using strings)?

## 📊 Impact Analysis

| Component | String-based | ID-based | Migration Effort |
|-----------|--------------|----------|------------------|
| Database Schema | Simple | Complex | HIGH |
| Code Complexity | Medium | Medium | MEDIUM |
| Query Performance | Slower | Faster | - |
| Storage Size | Larger | Smaller | - |
| Maintainability | Lower | Higher | - |
| Reference Data Sync | Manual | Automatic | - |

## ✅ Status Saat Ini

- [x] ReferenceService.js - UPDATED (supports both approaches)
- [ ] ResidentModel.js - NEEDS UPDATE
- [ ] AutoCreateService.js - NEEDS UPDATE
- [ ] Database migration SQL - NEEDS CREATION

Konfirmasi dulu mau pakai approach yang mana sebelum saya lanjut update ya!
