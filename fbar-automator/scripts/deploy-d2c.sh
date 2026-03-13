#!/usr/bin/env bash
# scripts/deploy-d2c.sh
# Builds and deploys D2C app from local source on the Hetzner VPS.
# Run from /opt/fbar/fbar-automator after `git pull`.
#
# Usage:
#   ./scripts/deploy-d2c.sh [--no-cache]
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NO_CACHE="${1:-}"

cd "$DEPLOY_DIR"

[ -f .env ] || { echo "ERROR: .env not found in $DEPLOY_DIR"; exit 1; }

echo "=== D2C Deploy (local build) ==="
echo "Dir:     $DEPLOY_DIR"
echo "Compose: $COMPOSE_FILE"
echo "Cache:   $([ "$NO_CACHE" = "--no-cache" ] && echo disabled || echo enabled)"

# ─── Step 1: Stop D2C + B2B worker to free RAM for build (~750MB) ─────────────
echo "--- Stopping d2c-app, d2c-cron, b2b-worker to free RAM..."
docker compose -f "$COMPOSE_FILE" stop d2c-app d2c-cron b2b-worker 2>/dev/null || true

# ─── Step 2: Prune dangling images (safe — keeps running container layers) ────
echo "--- Pruning dangling images..."
docker image prune -f

# ─── Step 3: Snapshot current image for rollback ──────────────────────────────
if docker image inspect fbar-d2c:local > /dev/null 2>&1; then
  SNAP_TAG="fbar-d2c:prev-$(date -u +%Y%m%d-%H%M%S)"
  docker tag fbar-d2c:local "$SNAP_TAG"
  echo "--- Snapshotted previous image as $SNAP_TAG"
fi

# ─── Step 4: Build D2C image ─────────────────────────────────────────────────
echo "--- Building fbar-d2c:local..."
BUILD_ARGS=""
[ "$NO_CACHE" = "--no-cache" ] && BUILD_ARGS="--no-cache"
docker compose -f "$COMPOSE_FILE" build $BUILD_ARGS d2c-app
echo "--- Build complete."

# ─── Step 5: Restart b2b-worker (was stopped for RAM) ────────────────────────
echo "--- Restarting b2b-worker..."
docker compose -f "$COMPOSE_FILE" up -d b2b-worker

# ─── Step 6: Run D2C migrations ──────────────────────────────────────────────
echo "--- Running D2C migrations..."
docker compose -f "$COMPOSE_FILE" up d2c-migrate

# ─── Step 7: Start D2C app ───────────────────────────────────────────────────
echo "--- Starting d2c-app and d2c-cron..."
docker compose -f "$COMPOSE_FILE" up -d d2c-app d2c-cron

# ─── Step 8: Health check ────────────────────────────────────────────────────
echo "--- Waiting for health (timeout: ${HEALTH_TIMEOUT}s)..."
ELAPSED=0
while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Health check passed after ${ELAPSED}s."
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") local-build $(git rev-parse --short HEAD 2>/dev/null || echo unknown)" \
      >> .deploy-history
    echo "=== Deploy complete ==="
    exit 0
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

echo "ERROR: Health check failed after ${HEALTH_TIMEOUT}s."
echo "--- d2c-app logs:"
docker compose -f "$COMPOSE_FILE" logs --tail 30 d2c-app
exit 1
