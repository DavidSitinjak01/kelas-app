#!/bin/bash
while true; do
  node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000
  echo "Server crashed, restarting in 3 seconds..." >> dev.log
  sleep 3
done
