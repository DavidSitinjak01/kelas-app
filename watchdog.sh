#!/bin/bash
# Watchdog for Next.js dev server - restarts immediately when process dies
LOG="/home/z/my-project/dev.log"
LOCK="/home/z/my-project/.watchdog.lock"

# Prevent multiple watchdogs
if [ -f "$LOCK" ]; then
  OLD_PID=$(cat "$LOCK")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    exit 0
  fi
fi
echo $$ > "$LOCK"

echo "[$(date)] Watchdog started" >> "$LOG"

while true; do
  cd /home/z/my-project
  
  # Start server with webpack (less CPU than Turbopack)
  node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 -H 0.0.0.0 --webpack >> "$LOG" 2>&1 &
  SERVER_PID=$!
  
  echo "[$(date)] Server started (PID: $SERVER_PID)" >> "$LOG"
  
  # Wait for server to exit
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    sleep 1
  done
  
  echo "[$(date)] Server died, restarting in 1s..." >> "$LOG"
  sleep 1
done
