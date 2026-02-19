#!/usr/bin/env bash
set -euo pipefail

# Deploy D2C app by pulling latest GHCR image
# Run on VPS: bash scripts/deploy.sh

COMPOSE_FILE="docker-compose.prod.yml"
SERVICE="d2c-app"

echo "Pulling latest D2C image..."
docker compose -f "$COMPOSE_FILE" pull "$SERVICE"

# Save current state for rollback
CURRENT_IMAGE=$(docker compose -f "$COMPOSE_FILE" images "$SERVICE" --format json 2>/dev/null | head -1 | jq -r '.Tag // "unknown"' 2>/dev/null || echo "unknown")
cat > .last-deploy <<EOF
IMAGE_TAG=${CURRENT_IMAGE}
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
EOF

echo "Starting D2C with new image..."
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"

echo "Waiting for health check..."
sleep 5

HEALTH_URL="http://localhost:3001/api/health"
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
  echo "D2C is healthy!"
else
  echo "Health check failed! Check logs with: docker compose -f $COMPOSE_FILE logs $SERVICE"
  exit 1
fi
