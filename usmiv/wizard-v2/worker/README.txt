Wizard Config Worker -- Setup
==============================

Prerequisites: Node 18+, wrangler CLI (installed via npm install below).


1. Install dependencies
-----------------------
  cd usmiv/wizard-v2/worker
  npm install


2. Login to Cloudflare
----------------------
  npx wrangler login


3. Create the KV namespace
--------------------------
  npx wrangler kv:namespace create WIZARD_CONFIG

  This prints something like:
    id = "abc123..."

  Also create a preview namespace for local dev:
    npx wrangler kv:namespace create WIZARD_CONFIG --preview

  Paste both IDs into wrangler.toml:
    [[kv_namespaces]]
    binding = "WIZARD_CONFIG"
    id = "YOUR_PROD_ID"
    preview_id = "YOUR_PREVIEW_ID"


4. Set the API key secret
-------------------------
  npx wrangler secret put API_KEY

  Enter a strong random string when prompted. Store this key somewhere safe --
  the admin dashboard will need it to authenticate PUT /config requests.

  For local dev, create a .dev.vars file (NOT committed):
    API_KEY=your-local-dev-key


5. Deploy
---------
  npm run deploy

  The Worker URL will be printed, e.g.:
    https://wizard-config.<your-account>.workers.dev

  Update VITE_WORKER_URL in the wizard app's .env to point to this URL.


6. Seed initial config
----------------------
  Option A (recommended): Use the admin dashboard.
    - Start the wizard app: cd .. && npm run dev
    - Open the admin tab (dev mode)
    - Enter your API key when prompted
    - Click "Publish Config" -- this pushes the current compiled config to KV

  Option B: Use the seed script.
    - Export the compiled config to a JSON file first
    - Then run: node seed-config.cjs path/to/config.json


7. Verify
---------
  curl https://wizard-config.<your-account>.workers.dev/config | head -c 200


Endpoints
---------
  GET  /config          -- returns current wizard config (public, cached 60s)
  PUT  /config          -- updates config (requires X-API-Key header)
  GET  /config/history  -- returns timestamps of last 10 backups

Local dev
---------
  npm run dev           -- starts Worker locally at http://localhost:8787
