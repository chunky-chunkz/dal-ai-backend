# Aufgabe: Multi-stage Build (node:18-alpine), prod image mit dist/

# === Build Stage ===
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --silent

# Copy source code and config files
COPY src/ ./src/
COPY tsconfig.json ./
COPY data/ ./data/

# Build the application
RUN npm run build

# Remove development dependencies after building
RUN npm prune --production

# === Production Stage ===
FROM node:18-alpine AS production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chatbot -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=chatbot:nodejs /app/dist ./dist
COPY --from=builder --chown=chatbot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=chatbot:nodejs /app/package.json ./
COPY --from=builder --chown=chatbot:nodejs /app/data ./data

# Switch to non-root user
USER chatbot

# Expose port
EXPOSE 8080

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]
