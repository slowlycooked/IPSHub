# ── Stage 1: web-only deps (no native compilation needed) ────────────────────
FROM node:22-alpine AS web-deps

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json    ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json

# Install only web deps — better-sqlite3 is never pulled in, no native build tools required
RUN pnpm install --frozen-lockfile --filter @ipshub/web...


# ── Stage 2: server deps (needs native build tools for better-sqlite3) ────────
FROM node:22-alpine AS server-deps

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite-dev

ENV npm_config_python=/usr/bin/python3
ENV PYTHON=/usr/bin/python3

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json    ./apps/web/package.json

# Install only server deps — triggers better-sqlite3 native compilation
RUN pnpm install --frozen-lockfile --filter @ipshub/server...


# ── Stage 3: build web ────────────────────────────────────────────────────────
FROM web-deps AS web-builder

# Pass build-time public URL for Vite (e.g. http://192.168.1.100:8088)
ARG VITE_APP_BASE_URL

COPY apps/web ./apps/web
RUN pnpm --filter @ipshub/web build


# ── Stage 4: build server ─────────────────────────────────────────────────────
FROM server-deps AS server-builder

COPY apps/server ./apps/server
RUN pnpm --filter @ipshub/server build


# ── Stage 5: download sing-box Linux binary ───────────────────────────────────
# Isolated stage so the binary layer is cached independently of the Node runtime.
# Override version at build time: --build-arg SING_BOX_VERSION=x.y.z
# Latest releases: https://github.com/SagerNet/sing-box/releases
FROM alpine:3.20 AS singbox

ARG SING_BOX_VERSION=1.11.0

RUN apk add --no-cache wget tar && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  SB_ARCH="amd64" ;; \
      aarch64) SB_ARCH="arm64" ;; \
      armv7l)  SB_ARCH="armv7" ;; \
      *)       SB_ARCH="amd64" ;; \
    esac && \
    URL="https://github.com/SagerNet/sing-box/releases/download/v${SING_BOX_VERSION}/sing-box-${SING_BOX_VERSION}-linux-${SB_ARCH}.tar.gz" && \
    wget -qO /tmp/sing-box.tar.gz "$URL" && \
    tar -xzf /tmp/sing-box.tar.gz -C /tmp && \
    mv /tmp/sing-box-*/sing-box /usr/local/bin/sing-box && \
    chmod +x /usr/local/bin/sing-box && \
    sing-box version && \
    rm -rf /tmp/sing-box*


# ── Stage 6: backend runtime ──────────────────────────────────────────────────
FROM node:22-alpine AS backend

WORKDIR /app

RUN apk add --no-cache dumb-init wget python3 make g++ sqlite-dev curl

ENV NODE_ENV=production
ENV npm_config_python=/usr/bin/python3
ENV PYTHON=/usr/bin/python3

# Copy sing-box Linux binary from the dedicated download stage
COPY --from=singbox /usr/local/bin/sing-box /usr/local/bin/sing-box

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json    ./apps/web/package.json

# Install only production deps for server
RUN pnpm install --frozen-lockfile --prod --filter @ipshub/server...

COPY --from=server-builder /app/apps/server/dist ./apps/server/dist

RUN mkdir -p /app/data /app/config

# Verify sing-box binary is present (non-fatal)
RUN sing-box version 2>/dev/null && echo "sing-box OK" || echo "sing-box not available"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "apps/server/dist/index.js"]


# ── Stage 7: frontend ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS frontend

COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1