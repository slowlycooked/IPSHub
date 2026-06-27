#!/usr/bin/env bash
# Production helper for running IPSHub directly on a macOS host.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDFILE="$ROOT/.ipshub.pid"
LOG_DIR="$ROOT/logs"
LOGFILE="$LOG_DIR/ipshub.log"
PUBLIC_DIR="$ROOT/public"
ENV_FILE="$ROOT/.env"

APP_NAME="IPSHub"

usage() {
  cat <<'EOF'
Usage: scripts/prod.sh <command>

Commands:
  install   Install production dependencies with pnpm
  rebuild   Rebuild native production dependencies
  build     Build server and web assets, then stage web assets for the server
  start     Start the production service in the background
  stop      Stop the background service
  restart   Stop, then start the background service
  status    Show service status
  logs      Tail the production log
  update    git pull --ff-only, install, build, and restart
  deploy    Alias for update

Environment:
  Configure runtime values in .env. For direct macOS hosting, DB_PATH should
  usually be ./data/ipshub.db rather than the Docker default /app/data/ipshub.db.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found in PATH"
}

check_native_build_tools() {
  if [[ "$(uname -s)" == "Darwin" ]] && ! xcode-select -p >/dev/null 2>&1; then
    die "Xcode Command Line Tools are required to build better-sqlite3; run: xcode-select --install"
  fi
}

rebuild_native_deps() {
  require_command pnpm
  check_native_build_tools
  cd "$ROOT"
  pnpm --filter @ipshub/server rebuild better-sqlite3
}

verify_native_deps() {
  cd "$ROOT"
  if node -e "require('better-sqlite3')" >/dev/null 2>&1; then
    return 0
  fi

  echo "better-sqlite3 native binding is missing; rebuilding it for this host..."
  rebuild_native_deps

  node -e "require('better-sqlite3')" >/dev/null 2>&1 || {
    echo "Failed to load better-sqlite3 after rebuild." >&2
    echo "Check Node.js version with: node --version" >&2
    echo "Node.js 22 LTS is recommended for this project on macOS production hosts." >&2
    return 1
  }
}

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    die "missing $ENV_FILE; copy .env.example to .env and fill in production values"
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  export NODE_ENV="${NODE_ENV:-production}"
  export LOG_LEVEL="${LOG_LEVEL:-info}"
  export SERVER_PORT="${SERVER_PORT:-8080}"
  export DB_PATH="${DB_PATH:-./data/ipshub.db}"
}

check_env() {
  load_env

  [ -n "${APP_SECRET:-}" ] || die "APP_SECRET is required in .env"
  [ "${APP_SECRET}" != "please-change-this-secret-in-production" ] || die "APP_SECRET still uses the sample value"
  [ -n "${ADMIN_PASSWORD:-}" ] || die "ADMIN_PASSWORD is required in .env"
  [ "${ADMIN_PASSWORD}" != "please-change-this-password" ] || die "ADMIN_PASSWORD still uses the sample value"
  [ -n "${APP_BASE_URL:-}" ] || die "APP_BASE_URL is required in .env"

  case "${DB_PATH}" in
    /app/*)
      echo "Warning: DB_PATH=${DB_PATH} looks like the Docker path. For macOS direct hosting, use DB_PATH=./data/ipshub.db."
      ;;
  esac
}

is_running() {
  [ -f "$PIDFILE" ] || return 1
  local pid
  pid="$(cat "$PIDFILE")"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

install_deps() {
  require_command node
  require_command pnpm
  cd "$ROOT"
  pnpm install --frozen-lockfile
  rebuild_native_deps
  pnpm prune --prod
}

build_app() {
  require_command pnpm
  cd "$ROOT"
  pnpm install --frozen-lockfile
  rebuild_native_deps
  pnpm build

  rm -rf "$PUBLIC_DIR"
  mkdir -p "$PUBLIC_DIR"
  cp -R "$ROOT/apps/web/dist/." "$PUBLIC_DIR/"
}

start_service() {
  check_env

  if is_running; then
    echo "$APP_NAME is already running with PID $(cat "$PIDFILE")"
    exit 0
  fi

  [ -f "$ROOT/apps/server/dist/index.js" ] || die "server build is missing; run scripts/prod.sh build first"
  [ -f "$PUBLIC_DIR/index.html" ] || die "web assets are missing; run scripts/prod.sh build first"
  verify_native_deps

  mkdir -p "$LOG_DIR"
  cd "$ROOT"

  nohup node "$ROOT/apps/server/dist/index.js" >>"$LOGFILE" 2>&1 &
  echo "$!" > "$PIDFILE"

  sleep 1
  if ! is_running; then
    rm -f "$PIDFILE"
    die "$APP_NAME failed to start; inspect $LOGFILE"
  fi

  echo "$APP_NAME started with PID $(cat "$PIDFILE")"
  echo "Log: $LOGFILE"
  echo "Health: http://127.0.0.1:${SERVER_PORT}/health"
}

stop_service() {
  if ! is_running; then
    rm -f "$PIDFILE"
    echo "$APP_NAME is not running"
    return 0
  fi

  local pid
  pid="$(cat "$PIDFILE")"
  echo "Stopping $APP_NAME PID $pid..."
  kill "$pid"

  for _ in {1..30}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PIDFILE"
      echo "$APP_NAME stopped"
      exit 0
    fi
    sleep 1
  done

  echo "Process did not exit after 30s; sending SIGKILL"
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PIDFILE"
}

status_service() {
  load_env
  if is_running; then
    echo "$APP_NAME is running with PID $(cat "$PIDFILE")"
    echo "Health: http://127.0.0.1:${SERVER_PORT}/health"
  else
    rm -f "$PIDFILE"
    echo "$APP_NAME is not running"
  fi
}

tail_logs() {
  mkdir -p "$LOG_DIR"
  touch "$LOGFILE"
  tail -f "$LOGFILE"
}

update_from_git() {
  require_command git
  cd "$ROOT"

  if [ "${IPSHUB_ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git status --porcelain)" ]; then
    die "working tree has uncommitted changes; commit/stash them or rerun with IPSHUB_ALLOW_DIRTY=1"
  fi

  git pull --ff-only
}

command="${1:-}"

case "$command" in
  install)
    install_deps
    ;;
  rebuild)
    rebuild_native_deps
    ;;
  build)
    check_env
    build_app
    ;;
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service
    ;;
  status)
    status_service
    ;;
  logs)
    tail_logs
    ;;
  update | deploy)
    check_env
    update_from_git
    build_app
    stop_service
    start_service
    ;;
  "" | help | -h | --help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
