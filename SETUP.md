# SmartGov Gemini Bot - Setup Guide

## 🚀 Quick Start with Docker (RECOMMENDED)

### Prerequisites
- Docker and Docker Compose installed
- MySQL database running (external container or host)
- Telegram Bot Token from @BotFather
- Google Gemini API Key

### One-Command Deployment

```bash
# Navigate to project directory
cd ocr-kk

# Build and start the bot
docker-compose up -d --build
```

That's it! The bot is now running in a Docker container.

### Verify Deployment

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f smartgov-bot

# Expected output:
# [INFO] Starting SmartGov Gemini Bot...
# [INFO] Database connection successful
# [INFO] Bot initialized successfully
# ✅ Bot is running successfully!
```

### Stop the Bot

```bash
# Stop container
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## 📋 Manual Setup (Without Docker)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

The `.env` file should contain:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_token_here

# Google Gemini AI
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash-latest

# MySQL Database (SmartGov)
DB_HOST=127.0.0.1
DB_PORT=3320
DB_DATABASE=smartgov
DB_USERNAME=root
DB_PASSWORD=your_password

# Region API
REGION_API_URL=https://region.smartsociety.id/api
REGION_API_KEY=your_api_key

# Session & Security
SESSION_EXPIRE_HOURS=24

# OCR Configuration
OCR_MAX_RETRIES=2
OCR_TIMEOUT=30000

# File Upload
MAX_FILE_SIZE=10485760
TEMP_DIR=./temp
```

### 3. Prepare Database

**Run the SQL script to create tables and populate reference data:**

```bash
mysql -u root -p smartgov < database_schema.sql
```

This will:
- Create `user_sessions` table
- Populate reference tables (religions, educations, occupations, etc.)

### 4. Start the Bot

**Production mode:**
```bash
npm start
```

**Development mode (with auto-reload):**
```bash
npm run dev
```

---

## 🐳 Docker Configuration

### Network Configuration

The bot uses **host network mode** to connect to MySQL on `127.0.0.1:3320`.

If your MySQL is in a different Docker network, update `docker-compose.yml`:

```yaml
services:
  smartgov-bot:
    # Remove: network_mode: "host"
    networks:
      - your_network

networks:
  your_network:
    external: true
```

Then update `.env`:
```env
DB_HOST=your_mysql_container_name
```

### Environment Variables in Docker

Docker automatically loads `.env` file. No changes needed!

### Viewing Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific container
docker-compose logs smartgov-bot
```

### Rebuilding After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Force rebuild
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Database Schema

### Required Tables

1. **users** - User authentication
2. **family_data** - Family card information
3. **residents** - Individual family members
4. **religions** - Reference data
5. **educations** - Reference data
6. **occupations** - Reference data
7. **marital_statuses** - Reference data
8. **blood_types** - Reference data
9. **citizenships** - Reference data
10. **family_relationships** - Reference data
11. **age_categories** - Reference data
12. **user_sessions** - Bot login sessions

### Field Name Format

**IMPORTANT:** Database uses **English field names**:

| OCR Output (Indonesian) | Database Field (English) |
|------------------------|-------------------------|
| nomor_kk | family_card_number |
| nama_lengkap | name |
| jenis_kelamin | gender |
| tempat_lahir | birth_place |
| tanggal_lahir | birth_date |
| agama | religion_id (INT) |
| pendidikan | education_id (INT) |
| jenis_pekerjaan | occupation_id (INT) |
| status_perkawinan | marital_status_id (INT) |
| kewarganegaraan | citizenship_id (INT) |
| nama_ayah | father_name |
| nama_ibu | mother_name |

### RT/RW Mapping

| OCR Output | Database Field |
|-----------|---------------|
| RT (001/002) → first part | citizen_association_code |
| RW (001/002) → second part | community_unit_code |

---

## ✅ Testing the Bot

### 1. Start Interaction

Send `/start` to your bot on Telegram.

### 2. Login

```
/login your_username your_password
```

Expected response:
```
✅ Login successful!

Username: your_username
Level: operator

Sekarang Anda dapat mengirim foto Kartu Keluarga (KK) untuk diproses.
```

### 3. Send KK Photo

Send a clear photo of Kartu Keluarga.

Expected process:
1. ✅ Photo received
2. 🤖 Processing with Gemini AI (5-15s)
3. ✅ Data extracted
4. ✅ Data saved to database

### 4. Verify Database

```sql
-- Check latest family
SELECT * FROM family_data ORDER BY created_at DESC LIMIT 1;

-- Check residents
SELECT * FROM residents WHERE family_card_number = 'your_kk_number';
```

---

## 🔧 Troubleshooting

### Docker Issues

**Bot container keeps restarting:**
```bash
# Check logs
docker-compose logs smartgov-bot

# Common issues:
# - Database connection failed (check DB_HOST, DB_PORT)
# - Missing TELEGRAM_BOT_TOKEN or GEMINI_API_KEY
# - Reference tables not populated
```

**Can't connect to MySQL:**
```bash
# Test connection from container
docker-compose exec smartgov-bot sh
nc -zv 127.0.0.1 3320

# If fails:
# - Check MySQL is running
# - Check port is correct
# - Try using host.docker.internal instead of 127.0.0.1 (Mac/Windows)
```

### Database Issues

**Reference tables empty:**
```bash
# Run database schema script
mysql -u root -p smartgov < database_schema.sql

# Verify
mysql -u root -p smartgov -e "SELECT COUNT(*) FROM religions;"
# Should show: 7
```

**Foreign key errors:**
```bash
# Ensure reference tables are populated BEFORE inserting residents
mysql -u root -p smartgov < database_schema.sql
```

### Bot Issues

**Bot not responding:**
- Check bot token is correct
- Check bot is running: `docker-compose ps`
- Check logs: `docker-compose logs -f`

**OCR errors:**
- Verify GEMINI_API_KEY is valid
- Check API quota (free tier: 15 requests/minute)
- Ensure image is clear and readable

---

## 📈 Monitoring

### Container Health

```bash
# Check health status
docker-compose ps

# Container should show "healthy" status
```

### Logs Location

- **Docker:** `docker-compose logs`
- **Manual:** `./logs/combined.log` and `./logs/error.log`

### Database Monitoring

```sql
-- Today's statistics
SELECT COUNT(*) as families_today
FROM family_data
WHERE DATE(created_at) = CURDATE();

SELECT COUNT(*) as residents_today
FROM residents
WHERE DATE(created_at) = CURDATE();
```

---

## 🔄 Updating the Bot

### With Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

### Without Docker

```bash
# Pull latest code
git pull

# Install new dependencies (if any)
npm install

# Restart bot
npm start
```

---

## 🎯 Production Checklist

- [ ] Docker and Docker Compose installed
- [ ] MySQL database running and accessible
- [ ] Database schema applied (`database_schema.sql`)
- [ ] Reference tables populated
- [ ] `.env` file configured with correct credentials
- [ ] Telegram Bot Token valid
- [ ] Gemini API Key valid
- [ ] Region API accessible
- [ ] Bot container running: `docker-compose ps`
- [ ] Logs showing success: `docker-compose logs`
- [ ] Test login working
- [ ] Test OCR working
- [ ] Database inserts working

---

## 📚 Additional Resources

- [README.md](README.md) - Complete documentation
- [database_schema.sql](database_schema.sql) - Database schema with reference data
- [Dockerfile](Dockerfile) - Docker image configuration
- [docker-compose.yml](docker-compose.yml) - Docker Compose configuration

---

**Created:** 2025
**Powered by:** Google Gemini AI
**Team:** SmartGov Development Team
