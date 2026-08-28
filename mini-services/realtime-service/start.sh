#!/bin/bash
# Start the realtime mini-service in the background
cd /home/z/my-project/mini-services/realtime-service
exec bun index.ts > /tmp/realtime.log 2>&1
