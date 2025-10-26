# ============================================================================
# SmartGov Gemini Bot - Dockerfile
# ============================================================================
#
# Multi-stage Docker build untuk SmartGov Gemini Bot
# Menggunakan Node.js 18 Alpine untuk optimal size dan security
#
# BUILD STAGES:
# 1. Base - Setup Node.js environment dan system dependencies
# 2. Dependencies - Install npm packages
# 3. Production - Final image dengan application code
#
# FEATURES:
# - Multi-stage build untuk optimal image size
# - Alpine Linux untuk security dan minimal footprint
# - System dependencies untuk Sharp image processing
# - Health check untuk monitoring
# - Production-ready configuration
#
# USAGE:
# docker build -t smartgov-gemini-bot .
# docker run -d --name bot --env-file .env smartgov-gemini-bot
#
# ============================================================================

# ============================================================================
# STAGE 1: BASE IMAGE SETUP
# ============================================================================

# Use Node.js 18 Alpine sebagai base image
# Alpine Linux memberikan security dan minimal footprint
FROM node:18-alpine AS base

# Install system dependencies yang diperlukan untuk Sharp image processing
# Sharp memerlukan native dependencies untuk image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Set working directory di dalam container
WORKDIR /app

# ============================================================================
# STAGE 2: DEPENDENCIES INSTALLATION
# ============================================================================

# Create dependencies stage untuk install npm packages
FROM base AS dependencies

# Copy package files untuk dependency resolution
COPY package*.json ./

# Install production dependencies saja (exclude dev dependencies)
# Menggunakan --omit=dev untuk mengurangi image size
RUN npm install --omit=dev

# ============================================================================
# STAGE 3: PRODUCTION IMAGE
# ============================================================================

# Create final production image
FROM base AS production

# Set production environment
ENV NODE_ENV=production

# Copy installed dependencies dari dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Create necessary directories untuk logs dan temporary files
RUN mkdir -p logs temp

# ============================================================================
# CONTAINER CONFIGURATION
# ============================================================================

# Bot tidak memerlukan exposed ports
# Bot berkomunikasi dengan Telegram API via outbound connections saja
# Tidak ada incoming connections yang diperlukan

# Health check untuk monitoring container health
# Cek apakah Node.js process masih berjalan setiap 30 detik
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep -f "node.*index.js" || exit 1

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

# Start the bot application
CMD ["node", "src/index.js"]
