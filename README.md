# SmartGov Gemini Bot

Telegram Bot untuk OCR Kartu Keluarga (KK) Indonesia menggunakan Google Gemini AI.

## Features

- **AI-Powered OCR**: Menggunakan Google Gemini 1.5 Flash untuk ekstraksi data KK dengan akurasi tinggi (~90-95%)
- **Auto Database Entry**: Otomatis memasukkan data ke database MySQL SmartGov
- **Session Management**: Login/logout untuk keamanan
- **Region Integration**: Integrasi dengan Region API untuk validasi wilayah
- **Error Handling**: Retry logic dan comprehensive error handling
- **Logging**: Winston logger untuk monitoring

## Tech Stack

- **Runtime**: Node.js 18+
- **Bot Framework**: node-telegram-bot-api
- **AI/OCR**: Google Gemini 1.5 Flash (Vision API)
- **Database**: MySQL 8.0
- **Image Processing**: sharp
- **Logging**: winston

## Installation

### Prerequisites

- Node.js 18 or higher
- MySQL 8.0
- Google Gemini API Key
- Telegram Bot Token

### Steps

1. Clone or create project directory:
```bash
mkdir smartgov-gemini-bot
cd smartgov-gemini-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env` and update with your credentials
   - Required: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, database credentials

4. Ensure MySQL database is running and accessible

5. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

### Bot Commands

- `/start` - Start interaction with the bot
- `/login <username> <password>` - Login to SmartGov system
- `/logout` - Logout from session
- `/kode-wilayah <kode>` - Check region code information
- `/cek-session` - Check current login status
- `/help` - Show help message

### OCR Process

1. User logs in via `/login`
2. User sends photo of Kartu Keluarga (KK)
3. Bot processes image with Gemini AI
4. Bot extracts all data (KK number, family members, etc.)
5. Bot validates data
6. Bot automatically creates records in database
7. Bot sends confirmation with extracted data

## Architecture

### Key Differences from PaddleOCR Version

| Feature | Old (PaddleOCR) | New (Gemini AI) |
|---------|----------------|-----------------|
| OCR Engine | PaddleOCR (Python) | Google Gemini 1.5 Flash |
| Deployment | Docker (multi-container) | Single Node.js process |
| Accuracy | ~60-70% | ~90-95% |
| Response Time | ~10-30s | ~5-15s |
| Complexity | High (Python + Node.js) | Low (Node.js only) |
| Infrastructure | Docker, Flask API | Simple npm start |

### Project Structure

```
smartgov-gemini-bot/
├── .env                              # Environment variables
├── .gitignore
├── package.json
├── README.md
├── src/
│   ├── index.js                      # Entry point
│   ├── config/
│   │   ├── env.js                    # Environment config
│   │   └── database.js               # MySQL connection pool
│   ├── bot/
│   │   ├── index.js                  # Bot initialization
│   │   ├── commands/                 # Bot command handlers
│   │   │   ├── start.js
│   │   │   ├── login.js
│   │   │   ├── kode_wilayah.js
│   │   │   └── cek_session.js
│   │   └── handlers/
│   │       └── photo.js              # Photo handler with OCR
│   ├── services/
│   │   ├── AuthService.js            # Session management
│   │   ├── GeminiOcrService.js       # Gemini AI OCR (CORE)
│   │   ├── AutoCreateService.js      # Auto create KK & residents
│   │   ├── RegionService.js          # Region API integration
│   │   └── ReferenceService.js       # Reference data
│   ├── database/
│   │   ├── UserModel.js              # User model
│   │   ├── FamilyDataModel.js        # Family data model
│   │   └── ResidentModel.js          # Resident model
│   └── utils/
│       ├── logger.js                 # Winston logger
│       ├── validator.js              # Input validation
│       ├── dateParser.js             # Date parsing
│       └── textCleaner.js            # Text normalization
├── logs/                             # Log files (auto-created)
└── temp/                             # Temp files (auto-created)
```

## Configuration

### Environment Variables

See `.env` file for all configuration options.

Key variables:
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
- `GEMINI_API_KEY`: Your Google Gemini API key
- `GEMINI_MODEL`: Model to use (default: gemini-1.5-flash-latest)
- `DB_*`: MySQL database connection settings
- `REGION_API_*`: Region API settings
- `OCR_*`: OCR processing settings

### Database Schema

The bot uses existing SmartGov database schema with tables:
- `users` - User accounts
- `family_data` - Family card data
- `residents` - Individual resident data
- `user_sessions` - Bot login sessions

## Gemini OCR Service

### How It Works

1. **Image Optimization**: Resizes large images to optimal size
2. **Gemini API Call**: Sends image with structured prompt
3. **JSON Extraction**: Parses structured data from Gemini response
4. **Validation**: Validates NIK (16 digits), KK number, etc.
5. **Post-Processing**: Normalizes names, dates, relationships
6. **Error Handling**: Retries on failure with exponential backoff

### Prompt Engineering

The service uses a carefully crafted prompt that instructs Gemini to:
- Extract exact 16-digit NIK and KK numbers
- Preserve Indonesian names and terms exactly
- Return structured JSON format
- Include all family members from the table
- Validate data according to Indonesian standards

### Data Extracted

For each KK, the bot extracts:
- **Header Data**: KK number, address, RT/RW, region codes
- **Family Members** (for each person):
  - NIK (16 digits)
  - Full name
  - Gender (LAKI-LAKI/PEREMPUAN)
  - Birth place and date
  - Religion
  - Education
  - Occupation
  - Marital status
  - Family relationship
  - Citizenship
  - Parent names (if available)

## Error Handling

- **Retry Logic**: Up to 2 retries on OCR failure
- **Validation**: Comprehensive validation of extracted data
- **Logging**: All errors logged with Winston
- **User Feedback**: Clear error messages sent to user

## Limitations

- **Gemini Free Tier**: 15 requests per minute limit
- **Image Size**: Max 10MB per image
- **Accuracy**: Depends on image quality (best with clear, high-res photos)
- **Language**: Optimized for Indonesian KK format only

## Troubleshooting

### Bot not responding
- Check `TELEGRAM_BOT_TOKEN` is correct
- Ensure bot is started (`npm start`)
- Check logs in `logs/` directory

### OCR errors
- Verify `GEMINI_API_KEY` is valid
- Check image quality (should be clear and readable)
- Check Gemini API quota (free tier limits)
- Review logs for detailed error messages

### Database errors
- Verify MySQL is running and accessible
- Check database credentials in `.env`
- Ensure database schema exists
- Check user permissions

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for auto-reload on file changes.

### Testing

1. Start the bot
2. Send `/start` to your bot on Telegram
3. Login with valid credentials
4. Send a clear photo of a Kartu Keluarga
5. Check bot response and database entries

## License

MIT

## Support

For issues or questions, contact the SmartGov Team.
