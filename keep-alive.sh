#!/bin/bash
cd /home/z/my-project
while true; do
  DATABASE_URL="postgresql://postgres.gybmzmxeknsbypthdvwr:K3las%40pp2025%21DbPass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  DIRECT_URL="postgresql://postgres.gybmzmxeknsbypthdvwr:K3las%40pp2025%21DbPass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 -H 0.0.0.0 --webpack
  echo "Server crashed, restarting in 5s..."
  sleep 5
done
