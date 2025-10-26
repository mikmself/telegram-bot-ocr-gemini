# Reference Data Compliance Status

## ✅ Yang Sudah Disesuaikan

### 1. ReferenceService.js - UPDATED ✅
**Status:** Sudah disesuaikan 100% dengan reference data

**Changes:**
- ✅ Religions: Islam, Kristen, Katholik, Hindu, Budha, Konghucu, Kepercayaan Terhadap Tuhan YME
- ✅ Educations: TIDAK/BELUM SEKOLAH, SD/SEDERAJAT, SMP/SEDERAJAT, SLTA/SEDERAJAT, DIPLOMA I-IV, STRATA I-III
- ✅ Occupations: KARYAWAN, SWASTA, PNS, WIRASWASTA, PELAJAR, MAHASISWA, GURU, DOSEN, PETANI, BURUH, NELAYAN
- ✅ Marital Statuses: BELUM KAWIN, KAWIN, CERAI HIDUP, CERAI MATI
- ✅ Blood Types: A, B, AB, O, A+, A-, B+, B-, AB+, AB-, O+, O-
- ✅ Citizenships: WNI, WNA
- ✅ Family Relationships: KEPALA KELUARGA, SUAMI, ISTRI, ANAK, MENANTU, CUCU, ORANG TUA, MERTUA, FAMILI, LAINNYA
- ✅ Age Categories: Bayi (0-1), Balita (2-5), Anak-anak (6-12), Remaja (13-17), Dewasa Muda (18-30), Dewasa (31-50), Lansia (51-65), Manula (66-999)

**Methods Added:**
- `getReligionId(name)` - Convert string to ID
- `getEducationId(name)` - Convert string to ID
- `getOccupationId(name)` - Convert string to ID
- `getMaritalStatusId(name)` - Convert string to ID
- `getBloodTypeId(name)` - Convert string to ID
- `getCitizenshipId(name)` - Convert string to ID
- `getFamilyRelationshipId(name)` - Convert string to ID
- `getAgeCategoryId(age)` - Get category by age

**Fallback Data:**
- Jika database tidak tersedia, menggunakan fallback data hardcoded
- Fallback data sudah sesuai 100% dengan reference

### 2. textCleaner.js - FIXED ✅
**Status:** Normalisasi family relationship sudah diperbaiki

**Changes:**
- ✅ 'ORANGTUA' → 'ORANG TUA' (sebelumnya 'ORANGTUA')
- ✅ 'FAMILI' → 'FAMILI' (sebelumnya 'FAMILI LAIN')
- ✅ Mapping konsisten dengan reference data

## ⚠️ Yang Perlu Konfirmasi

### Database Schema
**Current vs Reference:**

| Field | Current Code | Reference SQL | Status |
|-------|--------------|---------------|--------|
| nomor_kk | string | family_card_number | ⚠️ Different name |
| nama_lengkap | string | name | ⚠️ Different name |
| jenis_kelamin | L/P | gender | ⚠️ Different name |
| tempat_lahir | string | birth_place | ⚠️ Different name |
| tanggal_lahir | DATE | birth_date | ⚠️ Different name |
| agama | STRING | religion_id | ❌ Type mismatch |
| pendidikan | STRING | education_id | ❌ Type mismatch |
| jenis_pekerjaan | STRING | occupation_id | ❌ Type mismatch |
| status_perkawinan | STRING | marital_status_id | ❌ Type mismatch |
| status_hubungan_dalam_keluarga | STRING | family_relationship_id | ❌ Type mismatch |
| kewarganegaraan | STRING | citizenship_id | ❌ Type mismatch |
| - | - | blood_type_id | ❌ Missing field |
| - | - | age_category_id | ❌ Missing field |
| nama_ayah | string | father_name | ⚠️ Different name |
| nama_ibu | string | mother_name | ⚠️ Different name |

## 📊 Compatibility Analysis

### Scenario 1: Database Pakai Field Name Indonesia + String Values
**Example:**
```sql
CREATE TABLE residents (
  nomor_kk VARCHAR(16),
  agama VARCHAR(100),  -- "Islam", "Kristen", etc.
  pendidikan VARCHAR(100),  -- "SLTA/SEDERAJAT", etc.
  ...
)
```
**Status:** ✅ Code saat ini COMPATIBLE
- ResidentModel.js menggunakan nama field Indonesia
- AutoCreateService.js menyimpan string langsung
- Tidak perlu perubahan

### Scenario 2: Database Pakai Field Name English + ID References
**Example:**
```sql
CREATE TABLE residents (
  family_card_number VARCHAR(16),
  religion_id INT,  -- 1, 2, 3, etc.
  education_id INT,  -- 1, 2, 3, etc.
  ...
)
```
**Status:** ❌ Code saat ini NOT COMPATIBLE
- Perlu update ResidentModel.js (field names)
- Perlu update AutoCreateService.js (convert to IDs)
- Perlu create reference tables

## 🔧 Update Needed for Scenario 2

### File Yang Harus Diupdate:

#### 1. ResidentModel.js
```javascript
// OLD
const sql = `
  INSERT INTO residents (
    agama, pendidikan, jenis_pekerjaan, ...
  ) VALUES (?, ?, ?, ...)
`;

// NEW
const sql = `
  INSERT INTO residents (
    religion_id, education_id, occupation_id, ...
  ) VALUES (?, ?, ?, ...)
`;
```

#### 2. AutoCreateService.js
```javascript
// OLD
const residentData = {
  agama: member.agama,
  pendidikan: member.pendidikan,
  ...
};

// NEW
const religionId = await ReferenceService.getReligionId(member.agama);
const educationId = await ReferenceService.getEducationId(member.pendidikan);

const residentData = {
  religion_id: religionId,
  education_id: educationId,
  ...
};
```

#### 3. FamilyDataModel.js
```javascript
// Check if needs field name updates
// nomor_kk → family_card_number
// nama_kepala_keluarga → head_of_family_name
```

#### 4. Database Migration SQL
```sql
-- Create all reference tables
CREATE TABLE religions (...);
CREATE TABLE educations (...);
-- etc.

-- Insert reference data
INSERT INTO religions VALUES ...;
INSERT INTO educations VALUES ...;
-- etc.

-- Alter residents table
ALTER TABLE residents
  ADD COLUMN religion_id INT,
  ADD COLUMN education_id INT,
  -- etc.

-- Migrate existing data
UPDATE residents r
  SET religion_id = (SELECT id FROM religions WHERE name = r.agama);

-- Drop old columns
ALTER TABLE residents
  DROP COLUMN agama,
  DROP COLUMN pendidikan;
-- etc.
```

## 🎯 Rekomendasi

### Opsi A: Tetap Pakai String (Backward Compatible) - CURRENT
**Pros:**
- ✅ Tidak perlu ubah database
- ✅ Tidak perlu migration
- ✅ Code sudah working
- ✅ Quick deployment

**Cons:**
- ❌ Tidak sesuai reference data
- ❌ Storage tidak optimal
- ❌ Query lebih lambat
- ❌ Sulit maintain consistency

**Files Yang Perlu Update:** NONE

### Opsi B: Update ke ID-based (Best Practice) - RECOMMENDED
**Pros:**
- ✅ Sesuai reference data 100%
- ✅ Database normalized
- ✅ Storage optimal
- ✅ Query lebih cepat
- ✅ Mudah maintain

**Cons:**
- ❌ Perlu database migration
- ❌ Perlu update 4-5 files
- ❌ Need testing
- ❌ Deployment lebih complex

**Files Yang Perlu Update:**
1. ResidentModel.js - Update field names & SQL
2. FamilyDataModel.js - Update field names (if needed)
3. AutoCreateService.js - Convert strings to IDs
4. database_schema.sql - Add migration SQL
5. (Optional) GeminiOcrService.js - Consider returning IDs directly

## ✅ Summary Checklist

- [x] ReferenceService.js - **DONE**
- [x] textCleaner.js family relationship - **FIXED**
- [ ] Konfirmasi database schema approach (String vs ID)
- [ ] ResidentModel.js - **PENDING** (depends on choice)
- [ ] AutoCreateService.js - **PENDING** (depends on choice)
- [ ] FamilyDataModel.js - **PENDING** (depends on choice)
- [ ] Database migration SQL - **PENDING** (depends on choice)

## 💬 Next Steps

**Pertanyaan untuk Anda:**

1. **Database schema yang dipakai sekarang format apa?**
   - [ ] Indonesia names + String values (agama, pendidikan, dll)
   - [ ] English names + ID references (religion_id, education_id, dll)
   - [ ] Lainnya: _____________

2. **Mau update ke ID-based schema atau tetap string?**
   - [ ] Update ke ID-based (recommended, butuh migration)
   - [ ] Tetap string (quick, no migration needed)

3. **Reference tables sudah ada di database?**
   - [ ] Ya, sudah ada
   - [ ] Belum, perlu dibuat
   - [ ] Tidak tahu

**Setelah konfirmasi, saya bisa:**
- ✅ Update files yang diperlukan
- ✅ Create migration SQL jika perlu
- ✅ Update SETUP.md dengan instruksi deployment

Tunggu konfirmasi Anda! 🚀
