# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build frontend
RUN cd apps/web && pnpm build

# Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/server ./apps/server

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build backend
RUN cd apps/server && pnpm build

# Runtime
FROM node:20-alpine

WORKDIR /app

# Install pnpm and dumb-init
RUN npm install -g pnpm && apk add --no-cache dumb-init

# Copy built backend
COPY --from=backend-builder /app/apps/server/dist ./dist
COPY --from=backend-builder /app/apps/server/package.json ./package.json

# Copy built frontend
COPY --from=frontend-builder /app/apps/web/dist ./public

# Install production dependencies only
RUN pnpm install --production --frozen-lockfile

# Create data directory
RUN mkdir -p /app/data /app/config

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "dist/index.js"]
