#!/usr/bin/env bash
# scripts/rollback-d2c.sh
# Rolls back D2C to the most recent snapshot taken by deploy-d2c.sh.
#
# Usage:
#   ./scripts/rollback-d2c.sh
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$DEPLOY_DIR"

# Find most recent snapshot
PREV_TAG=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'fbar-d2c:prev-' | sort | tail -1)

if [ -z "$PREV_TAG" ]; then
  echo "ERROR: No previous snapshot found. Available images:"
  docker images fbar-d2c --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}'
  exit 1
fi

echo "=== D2C Rollback ==="
echo "Rolling back to: $PREV_TAG"

# Retag as current
docker tag "$PREV_TAG" fbar-d2c:local
echo "--- Retagged $PREV_TAG → fbar-d2c:local"

# Restart D2C
echo "--- Restarting d2c-app and d2c-cron..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate d2c-app d2c-cron

# Health check
echo "--- Waiting for health..."
ELAPSED=0
while [ "$ELAPSED" -lt 60 ]; do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Health check passed. Rollback complete."
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") rollback $PREV_TAG" >> .deploy-history
    exit 0
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

echo "ERROR: Health check failed after rollback."
docker compose -f "$COMPOSE_FILE" logs --tail 30 d2c-app
exit 1
