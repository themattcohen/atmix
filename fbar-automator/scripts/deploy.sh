#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$DEPLOY_DIR"

# ─── Dependency check ─────────────────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required but not installed. Run: apt-get install -y jq"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is required"; exit 1; }

# ─── Capture previous tag ─────────────────────────────────────────────────────
PREVIOUS_TAG=""
if [ -f .last-deploy ]; then
  PREVIOUS_TAG=$(grep '^IMAGE_TAG=' .last-deploy | cut -d= -f2 || true)
fi

IMAGE_TAG="${1:-latest}"
COMMIT_HASH="${2:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"

echo "=== D2C Deploy ==="
echo "Image tag:    $IMAGE_TAG"
echo "Previous tag: ${PREVIOUS_TAG:-none}"
echo "Commit:       $COMMIT_HASH"

# ─── Pull new image ───────────────────────────────────────────────────────────
export D2C_IMAGE_TAG="$IMAGE_TAG"
echo "Pulling ghcr.io/themattcohen/fbar-d2c:${IMAGE_TAG}..."
docker compose -f "$COMPOSE_FILE" pull d2c-app d2c-migrate

# ─── Deploy ───────────────────────────────────────────────────────────────────
echo "Starting services..."
docker compose -f "$COMPOSE_FILE" up -d d2c-migrate d2c-app

# ─── Health check ─────────────────────────────────────────────────────────────
echo "Waiting for health check (timeout: ${HEALTH_TIMEOUT}s)..."
ELAPSED=0
while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Health check passed after ${ELAPSED}s"
    # ─── Write .last-deploy ONLY after health check passes ────────────────
    cat > .last-deploy <<EOF
IMAGE_TAG=${IMAGE_TAG}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_HASH=${COMMIT_HASH}
EOF
    echo "Deploy successful. Wrote .last-deploy"
    exit 0
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

# ─── Health check failed — rollback ──────────────────────────────────────────
echo "ERROR: Health check failed after ${HEALTH_TIMEOUT}s"

if [ -n "$PREVIOUS_TAG" ]; then
  echo "Rolling back to previous tag: $PREVIOUS_TAG"
  export D2C_IMAGE_TAG="$PREVIOUS_TAG"
  docker compose -f "$COMPOSE_FILE" up -d d2c-app
  echo "Rollback complete. .last-deploy NOT updated."
else
  echo "No previous tag to rollback to. Manual intervention required."
fi

exit 1
