#!/bin/bash
cd /home/z/my-project
exec node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 -H 0.0.0.0 --webpack
