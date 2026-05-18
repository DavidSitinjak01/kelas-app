#!/bin/bash
# Dev server with auto-restart watchdog
LOGFILE="/home/z/my-project/dev.log"
PIDFILE="/home/z/my-project/.dev-server.pid"

echo "[$(date)] Starting dev server watchdog..." >> "$LOGFILE"

while true; do
  echo "[$(date)] Starting Next.js dev server..." >> "$LOGFILE"
  
  cd /home/z/my-project
  node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 -H 0.0.0.0 >> "$LOGFILE" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PIDFILE"
  
  echo "[$(date)] Server PID: $SERVER_PID" >> "$LOGFILE"
  
  # Wait for server to exit
  wait $SERVER_PID 2>/dev/null
  EXIT_CODE=$?
  
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..." >> "$LOGFILE"
  sleep 3
done
