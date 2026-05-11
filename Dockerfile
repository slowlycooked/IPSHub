# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web

# Install dependencies for the entire workspace
RUN pnpm install --frozen-lockfile

# Build frontend
RUN cd apps/web && pnpm build

# Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server ./apps/server

# Install dependencies for the entire workspace
RUN pnpm install --frozen-lockfile

# Build backend
RUN cd apps/server && pnpm build

# Runtime
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Copy built backend
COPY --from=backend-builder /app/apps/server/dist ./dist
COPY --from=backend-builder /app/apps/server/package.json ./package.json

# Install runtime dependencies only
COPY --from=backend-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=backend-builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY package.json ./package.json

# Install pnpm for production dependency installation
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# Copy built frontend
COPY --from=frontend-builder /app/apps/web/dist ./public

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s CMD wget -qO- http://localhost:8080/health || exit 1

# Run with dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "dist/index.js"]

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
