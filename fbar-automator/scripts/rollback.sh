#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$DEPLOY_DIR"

# ─── Read previous deploy info ────────────────────────────────────────────────
if [ ! -f .last-deploy ]; then
  echo "ERROR: No .last-deploy file found. Cannot determine previous deployment."
  exit 1
fi

IMAGE_TAG=$(grep '^IMAGE_TAG=' .last-deploy | cut -d= -f2)
TIMESTAMP=$(grep '^TIMESTAMP=' .last-deploy | cut -d= -f2)

if [ -z "$IMAGE_TAG" ]; then
  echo "ERROR: IMAGE_TAG not found in .last-deploy"
  exit 1
fi

# Allow override via argument
ROLLBACK_TAG="${1:-$IMAGE_TAG}"

echo "=== D2C Rollback ==="
echo "Rolling back to: $ROLLBACK_TAG"
echo "Last deploy was: $IMAGE_TAG at $TIMESTAMP"

# ─── Rollback ─────────────────────────────────────────────────────────────────
export D2C_IMAGE_TAG="$ROLLBACK_TAG"
docker compose -f "$COMPOSE_FILE" up -d d2c-app

# ─── Health check ─────────────────────────────────────────────────────────────
echo "Waiting for health check (timeout: ${HEALTH_TIMEOUT}s)..."
ELAPSED=0
while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Rollback successful — health check passed after ${ELAPSED}s"
    exit 0
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "ERROR: Health check failed after rollback. Manual intervention required."
exit 1
