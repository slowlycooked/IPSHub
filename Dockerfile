# ── Stage 1: install all workspace dependencies ─────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json    ./apps/web/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build server (TypeScript → JS) and web (Vite → dist) ───────────
FROM deps AS builder

COPY apps/server ./apps/server
COPY apps/web    ./apps/web

RUN pnpm --filter @ipshub/server build
RUN pnpm --filter @ipshub/web    build

# ── Stage 3: backend runtime (Node.js / Fastify) ────────────────────────────
FROM node:20-alpine AS backend

WORKDIR /app

RUN apk add --no-cache dumb-init wget && npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json

# Install production dependencies only (includes native better-sqlite3)
RUN pnpm install --frozen-lockfile --prod --filter @ipshub/server...

COPY --from=builder /app/apps/server/dist ./apps/server/dist

RUN mkdir -p /app/data /app/config

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "apps/server/dist/index.js"]

# ── Stage 4: frontend (nginx serving React SPA + reverse proxy to backend) ──
FROM nginx:1.27-alpine AS frontend

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
