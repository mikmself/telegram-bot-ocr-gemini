# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartGov Gemini Bot is a Telegram bot that performs OCR (Optical Character Recognition) on Indonesian Family Cards (Kartu Keluarga/KK) using Google Gemini AI. The bot is designed for village officials (aparatur desa) to process population data and automatically save it to a SmartGov MySQL database.

**Key Technologies:**
- **Runtime**: Node.js 18+
- **Bot Framework**: node-telegram-bot-api (polling mode)
- **OCR Engine**: Google Gemini AI (gemini-2.5-flash model)
- **Database**: MySQL 8.0+ with connection pooling
- **Image Processing**: Sharp library
- **Logging**: Winston
- **Deployment**: Docker & Docker Compose

## Development Commands

### Running the Application
```bash
# Production mode (direct execution)
npm start

# Development mode (auto-restart with nodemon)
npm run dev

# Docker commands
docker-compose up -d              # Start services in detached mode
docker-compose down               # Stop and remove containers
docker-compose logs -f smartgov-bot  # View logs in real-time
docker-compose restart smartgov-bot  # Restart bot service
docker-compose up --build         # Rebuild and start services
```

### Environment Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env with your credentials (see .env.example for details)
```

**Required environment variables:**
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `GEMINI_API_KEY` - From Google AI Studio
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` - MySQL config
- `REGION_API_URL`, `REGION_API_KEY` - Region validation API

### Testing
Note: No test suite is currently configured (`npm test` will fail).

## Architecture Overview

### Application Entry Point
[src/index.js](src/index.js) - Main entry point that orchestrates:
1. Environment validation
2. Database connection with health checks
3. Bot service initialization
4. Graceful shutdown handling (SIGINT, SIGTERM)
5. Global error handlers (uncaughtException, unhandledRejection)

### Core Bot Service
[src/bot/index.js](src/bot/index.js) - Singleton pattern `TelegramBotService`:
- Initializes Telegram bot with polling
- Registers command handlers: `/start`, `/login`, `/logout`, `/stop`, `/kode-wilayah`, `/cek-session`, `/help`
- Sets up message handlers (photo, document, text)
- Handles unknown commands with helpful error messages
- Error handling for polling/webhook failures

### Photo Processing Pipeline
[src/bot/handlers/photo.js](src/bot/handlers/photo.js) - Main photo upload handler:

**Processing Flow:**
1. **Authentication Check** - Validates login and village code
2. **Photo Download** - Downloads highest resolution photo from Telegram
3. **OCR Processing** - Sends to Google Gemini AI (5-15 seconds)
4. **Data Validation** - Validates extracted data structure
5. **Database Operations** - Saves family and resident data
6. **User Feedback** - Real-time status updates via message edits

**Important Notes:**
- Rate limiting is **DISABLED** (code preserved in comments if needed)
- Temporary files are auto-cleaned after processing
- Duplicate NIKs are skipped with notifications
- All processing steps provide user feedback

### Key Services

#### GeminiOcrService
[src/services/GeminiOcrService.js](src/services/GeminiOcrService.js) - AI-powered OCR:
- Uses Google Gemini 2.5 Flash model by default
- Custom prompt engineering for Indonesian Family Cards
- Image optimization (resizes if >2400px width, JPEG quality 90%)
- Retry mechanism (2 retries with 2-second delay)
- Timeout protection (30 seconds default)
- Confidence scoring based on data completeness
- Post-processing with text cleaning and validation

**Key Methods:**
- `processImage(imagePath)` - Main OCR processing method
- `createPrompt()` - Generates optimized prompt for Kartu Keluarga
- `validateParsedData(data)` - Validates 16-digit NIK and KK numbers
- `calculateConfidence(data)` - Returns confidence score 0-100%

#### AuthService
[src/services/AuthService.js](src/services/AuthService.js) - Session management:
- **In-memory storage** using JavaScript Map (sessions lost on restart)
- 24-hour session expiry from last activity
- Auto-cleanup every hour to prevent memory leaks
- Village code management per session
- One session per chat ID

**Session Structure:**
```javascript
{
  userId: number,
  username: string,
  nama_lengkap: string,
  level: number,
  villageCode: string | null,
  villageData: object | null,
  loginAt: Date,
  lastActivity: Date
}
```

#### AutoCreateService
[src/services/AutoCreateService.js](src/services/AutoCreateService.js) - Database operations:
- Automatic family data creation/update
- Resident data insertion with duplicate detection
- Transaction support for atomicity
- Comprehensive error handling and rollback

#### RegionService
[src/services/RegionService.js](src/services/RegionService.js) - Region API integration:
- Validates Indonesian region codes
- Caches region data to minimize API calls
- Hierarchical region code structure (province → regency → district → village)

### Database Architecture

**Connection Management:**
[src/config/database.js](src/config/database.js) - MySQL2 with connection pooling:
- Connection pool for performance optimization
- Transaction support with ACID compliance
- Prepared statements for SQL injection prevention
- Automatic reconnection on connection loss

**Database Models:**
- [FamilyDataModel.js](src/database/FamilyDataModel.js) - Kartu Keluarga records
  - Primary key: `family_card_number` (16 digits)
  - Tracks total members and active members
  - Region code hierarchy (province → village → RT/RW)

- [ResidentModel.js](src/database/ResidentModel.js) - Individual residents
  - Primary key: `nik` (16 digits)
  - Foreign key: `family_card_number`
  - One-to-Many relationship with FamilyData

- [UserModel.js](src/database/UserModel.js) - Bot users (village officials)
  - Authentication with bcrypt password hashing
  - User type/role management

**Relationship:** `family_data (1) <---> (N) residents`

### Utilities

- [logger.js](src/utils/logger.js) - Winston-based logging with file rotation
- [textCleaner.js](src/utils/textCleaner.js) - OCR text normalization (names, gender, dates)
- [dateParser.js](src/utils/dateParser.js) - Indonesian date format parsing
- [validator.js](src/utils/validator.js) - NIK and data validation

## Important Implementation Details

### OCR Processing
- **Model**: gemini-2.5-flash (fast and cost-effective)
- **Image Optimization**: Auto-resize to 2400px width, JPEG quality 90%
- **Prompt Engineering**: Custom prompt for Indonesian Family Card format
- **Validation**: 16-digit NIK and KK number validation, gender must be "LAKI-LAKI" or "PEREMPUAN"
- **Confidence Calculation**: Based on data completeness and field accuracy
- **Retry Logic**: 2 retries with 2-second delay for transient failures

### Session Management
- Sessions are **in-memory only** - all sessions lost on bot restart
- 24-hour session timeout from last activity (not login time)
- Auto-cleanup runs every hour
- Village code is required before processing photos

### Photo Upload Flow
1. User must `/login` first
2. User must set village code with `/kode-wilayah`
3. User uploads Family Card photo
4. Bot downloads photo to temp directory
5. Gemini AI processes image (5-15 seconds)
6. Data validated and saved to database
7. Temp file cleaned up
8. Detailed result sent to user

### Error Handling Strategy
- All services use try-catch with Winston logging
- Database operations support transactions with rollback
- Graceful shutdown handlers for SIGINT/SIGTERM
- Global handlers for uncaught exceptions and unhandled rejections
- User-friendly error messages in Indonesian

### File Structure
```
src/
├── index.js                 # Application entry point
├── bot/
│   ├── index.js             # Bot service (singleton)
│   ├── commands/            # Command handlers (/login, /start, etc.)
│   └── handlers/            # Message handlers (photo.js)
├── config/
│   ├── env.js               # Environment configuration
│   └── database.js          # MySQL connection pooling
├── database/                # Database models (CRUD operations)
│   ├── FamilyDataModel.js
│   ├── ResidentModel.js
│   └── UserModel.js
├── services/                # Business logic services
│   ├── GeminiOcrService.js  # AI OCR processing
│   ├── AuthService.js       # Session management
│   ├── AutoCreateService.js # Database operations
│   ├── RegionService.js     # Region API integration
│   └── ReferenceService.js  # Reference data
└── utils/                   # Helper utilities
    ├── logger.js
    ├── textCleaner.js
    ├── dateParser.js
    └── validator.js
```

## Bot Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Display bot information | `/start` |
| `/login` | Login with credentials | `/login admin123 password123` |
| `/logout` | Logout from system | `/logout` |
| `/stop` | Stop bot and logout | `/stop` |
| `/kode-wilayah` | Set village code | `/kode-wilayah 33.01.06.2016` |
| `/cek-session` | Check login status | `/cek-session` |
| `/help` | Display help message | `/help` |

## Deployment

### Docker Deployment (Recommended)
The application uses Docker Compose with:
- Multi-stage Dockerfile for optimized builds
- Host network mode for MySQL access
- Volume mounts for logs and temp files
- Health checks with process monitoring
- Log rotation (max 10MB per file, keep 3 files)

### Production Checklist
- Configure `.env` with production credentials
- Ensure MySQL database is accessible
- Configure region API endpoint and key
- Set up log rotation for `/app/logs`
- Monitor Gemini API quota and billing
- Set `NODE_ENV=production`
- Configure timezone (`TZ=Asia/Jakarta`)

## Code Style and Documentation

The codebase follows extensive inline documentation patterns:
- Every file has a detailed header block describing purpose, dependencies, and usage
- Functions include comprehensive JSDoc comments
- Complex logic has inline explanations
- Indonesian language used for user-facing messages
- English used for code comments and logs

When making changes:
- Maintain the existing documentation style
- Add inline comments for complex logic
- Update file headers if adding new dependencies
- Keep error messages in Indonesian for end users
- Use Winston logger for all logging (not console.log)
- Follow existing patterns for database transactions
- Clean up temporary files after use
