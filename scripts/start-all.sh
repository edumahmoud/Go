#!/bin/bash
# Starts all required backend services for the attendance tracking app.
# This script is idempotent: it only starts services that are not already running.
# It also seeds a default MANAGER account (ADMIN001 / admin123) on first run.

set -e

LOG_DIR="/home/z/my-project/.logs"
mkdir -p "$LOG_DIR"

# Load environment variables from .env (if present)
if [ -f /home/z/my-project/.env ]; then
  set -a
  . /home/z/my-project/.env
  set +a
fi

# Fall back to local MongoDB if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="mongodb://127.0.0.1:27017/attendance_db?replicaSet=rs0"
fi
# Fall back to local broadcast URL if not set
if [ -z "$REALTIME_BROADCAST_URL" ]; then
  export REALTIME_BROADCAST_URL="http://127.0.0.1:3004"
fi

echo "[startup] DATABASE_URL is set (length: ${#DATABASE_URL})"
echo "[startup] REALTIME_BROADCAST_URL=$REALTIME_BROADCAST_URL"

# 1. MongoDB
if ! pgrep -f "mongod.*--port 27017" > /dev/null; then
  echo "[startup] Starting MongoDB..."
  /home/z/my-project/.mongodb/bin/mongod \
    --dbpath /home/z/my-project/.mongodb/data \
    --logpath /home/z/my-project/.mongodb/log/mongod.log \
    --fork --port 27017 --bind_ip 127.0.0.1 --replSet rs0
  sleep 2
  # Initiate replica set if not already initiated
  node /home/z/my-project/scripts/init-replset.js 2>&1 | tail -1 || true
  sleep 3
else
  echo "[startup] MongoDB already running."
fi

# 1b. Seed default admin account (idempotent — skips if ADMIN001 already exists)
echo "[startup] Ensuring default admin account exists..."
node /home/z/my-project/scripts/seed-admin.js 2>&1 | sed 's/^/[startup] /'

# 2. Realtime WebSocket service (only needed in dev — Vercel uses polling)
if [ "$NODE_ENV" != "production" ]; then
  if ! pgrep -f "bun.*index.ts.*realtime\|realtime.*index.ts\|3003" > /dev/null 2>&1 || ! ss -tnlp 2>/dev/null | grep -q ":3003"; then
    echo "[startup] Starting realtime service..."
    cd /home/z/my-project/mini-services/realtime-service
    setsid bun index.ts > "$LOG_DIR/realtime.log" 2>&1 < /dev/null &
    disown
    sleep 2
  else
    echo "[startup] Realtime service already running."
  fi
fi

# 3. Next.js dev server
if ! pgrep -f "next dev" > /dev/null; then
  echo "[startup] Starting Next.js dev server..."
  cd /home/z/my-project
  setsid bun run dev > "$LOG_DIR/nextjs.log" 2>&1 < /dev/null &
  disown
  sleep 5
else
  echo "[startup] Next.js dev server already running."
fi

echo "[startup] All services started."
echo ""
echo "Status:"
echo "  MongoDB: $(pgrep -f 'mongod.*27017' > /dev/null && echo 'running' || echo 'not running')"
if [ "$NODE_ENV" != "production" ]; then
  echo "  Realtime: $(ss -tnlp 2>/dev/null | grep -q ':3003' && echo 'running' || echo 'not running')"
fi
echo "  Next.js:  $(pgrep -f 'next dev' > /dev/null && echo 'running' || echo 'not running')"
echo ""
echo "Default admin login:"
echo "  Code:     ADMIN001"
echo "  Password: admin123"
echo "  URL:      http://localhost:3000"
