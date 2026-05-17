#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> dev.log
  node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 3s..." >> dev.log
  sleep 3
done
