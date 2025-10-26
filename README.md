# SmartGov Gemini Bot
### AI-Powered OCR untuk Kartu Keluarga Indonesia

Bot Telegram yang menggunakan Google Gemini AI untuk mengekstraksi data Kartu Keluarga (KK) Indonesia. Dirancang untuk aparatur desa dalam memproses data kependudukan.

## Fitur Utama

- **OCR dengan Google Gemini AI** - Ekstraksi data dari foto KK
- **Session Management** - Login/logout yang aman
- **Region API Integration** - Validasi kode wilayah otomatis
- **Database MySQL** - Auto-save ke database SmartGov
- **Error Handling** - Penanganan error yang robust

## Tech Stack

- **Node.js** - Backend runtime
- **Telegram Bot API** - Platform bot
- **Google Gemini AI** - OCR engine
- **MySQL** - Database
- **Winston** - Logging

## Installation

```bash
# 1. Clone repository
git clone https://github.com/mikmself/telegram-bot-ocr-gemini.git
cd telegram-bot-ocr-gemini

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env dengan credentials Anda

# 4. Start bot
npm start
```

## Dependencies

### Production Dependencies

| Package | Version | Deskripsi |
|---------|---------|-----------|
| `@google/generative-ai` | ^0.21.0 | Google Gemini AI SDK untuk OCR |
| `node-telegram-bot-api` | ^0.64.0 | Telegram Bot API wrapper |
| `mysql2` | ^3.6.5 | MySQL database driver |
| `dotenv` | ^16.3.1 | Environment variables loader |
| `axios` | ^1.6.2 | HTTP client untuk Region API |
| `sharp` | ^0.33.1 | Image processing library |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `moment` | ^2.29.4 | Date manipulation |
| `moment-timezone` | ^0.5.43 | Timezone support |
| `winston` | ^3.11.0 | Logging library |

### Development Dependencies

| Package | Version | Deskripsi |
|---------|---------|-----------|
| `nodemon` | ^3.0.2 | Auto-restart development server |

---

## Cara Penggunaan

### Bot Commands

| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `/start` | Memulai interaksi dengan bot | `/start` |
| `/login` | Login ke sistem SmartGov | `/login admin123 password123` |
| `/logout` | Keluar dari sistem | `/logout` |
| `/stop` | Menghentikan bot dan keluar dari sistem | `/stop` |
| `/kode-wilayah` | Cek informasi kode wilayah | `/kode-wilayah 33.01.06.2016` |
| `/cek-session` | Cek status login saat ini | `/cek-session` |
| `/help` | Tampilkan bantuan lengkap | `/help` |

### Workflow

1. **Login** - Gunakan `/login username password`
2. **Set Kode Wilayah** - Gunakan `/kode-wilayah 33.01.06.2016`
3. **Upload Foto KK** - Kirim foto Kartu Keluarga
4. **AI Processing** - Bot akan mengekstrak data dengan Gemini AI
5. **Save to Database** - Data otomatis tersimpan ke MySQL

### Project Structure

```
src/
├── bot/
│   ├── commands/           # Command handlers
│   └── handlers/           # Message handlers
├── config/                 # Konfigurasi
├── database/               # Database models
├── services/               # Business logic
└── utils/                  # Utility functions
```

---

## Environment Variables

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Database MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smartgov
DB_USER=your_username
DB_PASSWORD=your_password

# Region API
REGION_API_BASE_URL=https://api.example.com
REGION_API_KEY=your_region_api_key
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot tidak merespon | Cek `TELEGRAM_BOT_TOKEN` |
| OCR gagal | Verifikasi `GEMINI_API_KEY` |
| Database error | Cek MySQL service & credentials |
| Foto tidak terbaca | Gunakan foto yang jelas & resolusi tinggi |

## License

MIT License - Copyright (c) 2024 SmartGov Team