#!/usr/bin/env bash
# Start both server and web in dev mode
set -e

PIDFILE="$(dirname "$0")/.dev.pids"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$PIDFILE" ]; then
  echo "Dev servers appear to already be running (found $PIDFILE)."
  echo "Run scripts/dev-stop.sh first if you want to restart."
  exit 1
fi

echo "Starting IPSHub dev servers..."

cd "$ROOT"

pnpm --filter @ipshub/server dev &
SERVER_PID=$!

pnpm --filter @ipshub/web dev &
WEB_PID=$!

echo "$SERVER_PID $WEB_PID" > "$PIDFILE"

echo "  server PID: $SERVER_PID"
echo "  web    PID: $WEB_PID"
echo ""
echo "Run scripts/dev-stop.sh to stop both servers."

wait
