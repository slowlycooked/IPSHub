#!/usr/bin/env bash
# Stop both server and web dev servers started by dev-start.sh

PIDFILE="$(dirname "$0")/.dev.pids"

if [ ! -f "$PIDFILE" ]; then
  echo "No PID file found ($PIDFILE). Servers may not be running."
  exit 0
fi

read -r SERVER_PID WEB_PID < "$PIDFILE"

echo "Stopping IPSHub dev servers..."

for PID in $SERVER_PID $WEB_PID; do
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "  killed PID $PID"
  else
    echo "  PID $PID is not running (already stopped)"
  fi
done

rm -f "$PIDFILE"
echo "Done."
