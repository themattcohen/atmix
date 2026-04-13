#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../worker"
META_FILE="$SCRIPT_DIR/../src/data/meta.ts"

echo "=== Wizard of IV -- Cloudflare Worker Deployment ==="
echo ""

# Step 1: Check prerequisites
command -v npx >/dev/null 2>&1 || { echo "ERROR: npx not found. Install Node.js first."; exit 1; }
echo "Step 1: Prerequisites OK"

# Step 2: Install dependencies
cd "$WORKER_DIR"
echo ""
echo "Step 2: Installing Worker dependencies..."
npm install

# Step 3: Login to Cloudflare
echo ""
echo "Step 3: Logging into Cloudflare..."
echo "A browser window will open. Log in and return here."
npx wrangler login

# Step 4: Create KV namespace
echo ""
echo "Step 4: Creating KV namespace..."
# Check if placeholder still exists
if grep -q "REPLACE_WITH_KV_NAMESPACE_ID" wrangler.toml; then
  KV_OUTPUT=$(npx wrangler kv:namespace create WIZARD_CONFIG 2>&1)
  KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "$KV_OUTPUT" | grep -o '"[a-f0-9]\{32\}"' | tr -d '"')
  if [ -z "$KV_ID" ]; then
    echo "Could not parse KV ID. Output was:"
    echo "$KV_OUTPUT"
    echo "Please manually copy the ID into wrangler.toml and re-run."
    exit 1
  fi
  sed -i.bak "s/REPLACE_WITH_KV_NAMESPACE_ID/$KV_ID/g" wrangler.toml
  rm -f wrangler.toml.bak
  echo "KV namespace created: $KV_ID"
else
  echo "KV namespace already configured, skipping."
fi

# Step 5: Create preview namespace
if grep -q "REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID" wrangler.toml; then
  PREVIEW_OUTPUT=$(npx wrangler kv:namespace create WIZARD_CONFIG --preview 2>&1)
  PREVIEW_ID=$(echo "$PREVIEW_OUTPUT" | grep -oP 'preview_id = "\K[^"]+' || echo "$PREVIEW_OUTPUT" | grep -o '"[a-f0-9]\{32\}"' | tr -d '"')
  if [ -n "$PREVIEW_ID" ]; then
    sed -i.bak "s/REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID/$PREVIEW_ID/g" wrangler.toml
    rm -f wrangler.toml.bak
    echo "Preview namespace created: $PREVIEW_ID"
  fi
else
  echo "Preview namespace already configured, skipping."
fi

# Step 6: Set API key
echo ""
echo "Step 6: Setting admin API key..."
echo "Choose a strong password (min 16 characters)."
echo "You'll enter this in the admin dashboard when publishing changes."
echo ""
read -sp "API Key: " API_KEY
echo ""
if [ ${#API_KEY} -lt 16 ]; then
  echo "ERROR: API key must be at least 16 characters."
  exit 1
fi
echo "$API_KEY" | npx wrangler secret put API_KEY
echo "API key set."

# Step 7: Deploy
echo ""
echo "Step 7: Deploying Worker..."
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^ ]+\.workers\.dev' | head -1)
if [ -z "$WORKER_URL" ]; then
  echo ""
  echo "WARNING: Could not parse Worker URL from deploy output."
  echo "Please find it in the output above and update meta.ts manually."
  exit 0
fi

# Step 8: Update meta.ts
echo ""
echo "Step 8: Updating configWorkerUrl in meta.ts..."
sed -i.bak "s|configWorkerUrl: ''|configWorkerUrl: '$WORKER_URL'|g" "$META_FILE"
rm -f "$META_FILE.bak"
echo "Set configWorkerUrl to: $WORKER_URL"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Worker URL: $WORKER_URL"
echo ""
echo "Next steps:"
echo "  1. cd usmiv/wizard-v2 && npm run build"
echo "  2. git add . && git commit -m 'deploy: set configWorkerUrl' && git push"
echo "  3. Open the admin dashboard and click 'Publish Live' to seed initial config"
echo ""
