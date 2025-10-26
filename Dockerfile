# Stage 1: Base
FROM node:18-alpine AS base

# Install required dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Set working directory
WORKDIR /app

# Stage 2: Dependencies
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Stage 3: Production
FROM base AS production

# Set environment
ENV NODE_ENV=production

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create necessary directories
RUN mkdir -p logs temp

# Expose no ports (bot doesn't need exposed ports)
# Bot communicates via Telegram API (outbound only)

# Health check (optional - checks if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep -f "node.*index.js" || exit 1

# Start the bot
CMD ["node", "src/index.js"]
