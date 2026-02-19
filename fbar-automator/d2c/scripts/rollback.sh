#!/usr/bin/env bash
set -euo pipefail

# Rollback D2C to previous Docker image
# Usage: bash scripts/rollback.sh [--dry-run]

COMPOSE_FILE="docker-compose.prod.yml"
SERVICE="d2c-app"
LAST_DEPLOY=".last-deploy"
HEALTH_URL="http://localhost:3001/api/health"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "DRY RUN — no changes will be made"
fi

if [[ ! -f "$LAST_DEPLOY" ]]; then
  echo "No .last-deploy file found. Cannot rollback."
  exit 1
fi

# Parse .last-deploy
IMAGE_TAG=$(grep '^IMAGE_TAG=' "$LAST_DEPLOY" | cut -d= -f2-)
TIMESTAMP=$(grep '^TIMESTAMP=' "$LAST_DEPLOY" | cut -d= -f2-)
COMMIT_HASH=$(grep '^COMMIT_HASH=' "$LAST_DEPLOY" | cut -d= -f2-)

if [[ -z "$IMAGE_TAG" ]]; then
  echo "IMAGE_TAG is empty in .last-deploy"
  exit 1
fi

echo "Rolling back to:"
echo "   Tag:    $IMAGE_TAG"
echo "   Time:   $TIMESTAMP"
echo "   Commit: $COMMIT_HASH"

if $DRY_RUN; then
  echo "Dry run complete. Would rollback to tag: $IMAGE_TAG"
  exit 0
fi

echo "Stopping current $SERVICE..."
docker compose -f "$COMPOSE_FILE" stop "$SERVICE"

echo "Pulling previous image: ghcr.io/themattcohen/fbar-d2c:$IMAGE_TAG..."
docker compose -f "$COMPOSE_FILE" pull "$SERVICE"

echo "Starting $SERVICE with previous image..."
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"

echo "Waiting for health check..."
sleep 5

if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
  echo "Rollback successful! $SERVICE is healthy."
else
  echo "Health check failed after rollback! Check logs:"
  echo "   docker compose -f $COMPOSE_FILE logs $SERVICE"
  exit 1
fi
