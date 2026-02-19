# Gap #17: GTM/GA4 Disabled in Production

**Severity:** Low
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

`NEXT_PUBLIC_GTM_ID` is a build-time environment variable (Next.js `NEXT_PUBLIC_*` prefix). It must be baked into the JavaScript bundle at `docker build` time via Docker `build.args`, not injected at container runtime via `environment`. The current `docker-compose.prod.yml` passes no `build.args` to the D2C service. As a result, `process.env.NEXT_PUBLIC_GTM_ID` evaluates to `undefined` at build time, the `GoogleTagManager` component returns `null` (line 4: `if (!gtmId) return null`), and the GTM script tag is never rendered regardless of what is set in `.env` at runtime.

In addition, `NEXT_PUBLIC_GTM_ID`, `GA4_MEASUREMENT_ID`, and `GA4_API_SECRET` are entirely absent from `.env.unified.example`, so operators deploying fresh have no indication these variables are required or where to obtain them.

The consequence: analytics are silently disabled in production. Conversion events (`begin_checkout`, `purchase`), UTM attribution, and every dataLayer push are dead. The server-side GA4 Measurement Protocol calls in the Stripe webhook (`checkout.session.completed`) also fail because `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` are runtime variables that are missing from the `.env` example and compose service definition.

## Current State

**`d2c/src/app/layout.tsx` — lines 68**
```tsx
<GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ''} />
```
`NEXT_PUBLIC_GTM_ID` is evaluated at Next.js build time. If not present in `build.args`, it is always `''` in the bundle.

**`d2c/src/components/analytics/GoogleTagManager.tsx` — lines 3-4**
```tsx
export function GoogleTagManager({ gtmId }: { gtmId: string }) {
  if (!gtmId) return null;
```
Empty string is falsy. Component silently returns nothing.

**`docker-compose.prod.yml` — lines 192-218 (d2c-app service)**
The `d2c-app` service has no `build.args` stanza. The build section is:
```yaml
build:
  context: ./d2c
  dockerfile: Dockerfile
  target: runner
```
No `args` key is present. `NEXT_PUBLIC_GTM_ID` never reaches the `npm run build` step inside the Dockerfile.

**`d2c/Dockerfile` — lines 15-25 (builder stage)**
```dockerfile
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build-time-dummy"
ENV NEXTAUTH_URL="http://localhost:3001"

RUN npm run build
```
No `ARG` declaration for `NEXT_PUBLIC_GTM_ID`. Even if `build.args` were set in compose, the Dockerfile must declare `ARG` before `ENV` or before `RUN npm run build` to consume it.

**`.env.unified.example` — missing variables**
The file documents 15 production checklist items (lines 152-167). GTM/GA4 variables appear nowhere in the file. A fresh deployer has no indication these are needed.

**Server-side GA4** (Stripe webhook, location TBD based on implementation):
The Measurement Protocol POST requires `GA4_MEASUREMENT_ID` (format: `G-XXXXXXXXXX`) and `GA4_API_SECRET` (from GA4 Admin > Data Streams > Measurement Protocol API secrets). These are runtime variables (not `NEXT_PUBLIC_*`) but are also absent from compose and the example env file.

## Implementation Plan

### Step 1: Add ARG declarations to `d2c/Dockerfile` (builder stage)

In the `builder` stage, declare `ARG` before the build step so Docker can pass the value through:

```dockerfile
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build-time-dummy"
ENV NEXTAUTH_URL="http://localhost:3001"

# Build-time public env vars (NEXT_PUBLIC_* must be present during `next build`)
ARG NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}

RUN npm run build
```

The `ARG` instruction makes the variable available as a Docker build argument. The subsequent `ENV` assignment makes it available to `npm run build` as a process environment variable, which Next.js reads during static page generation and client bundle compilation.

### Step 2: Add `build.args` to the `d2c-app` service in `docker-compose.prod.yml`

```yaml
d2c-app:
  build:
    context: ./d2c
    dockerfile: Dockerfile
    target: runner
    args:
      - NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}
  # ... rest of service definition unchanged
```

Docker Compose passes build args from the host environment (or the `.env` file) into the Docker build process. The value must be present in `.env` before running `docker compose ... --build`.

Note: `build.args` are only consumed at build time — they do not persist as runtime environment variables in the container. This is intentional for `NEXT_PUBLIC_*` vars: they are inlined into the JS bundle.

### Step 3: Add runtime GA4 variables to the `d2c-app` `environment` block in `docker-compose.prod.yml`

`GA4_MEASUREMENT_ID` and `GA4_API_SECRET` are server-side runtime variables used by the Stripe webhook Measurement Protocol call. Add them alongside the existing environment entries:

```yaml
environment:
  # ... existing entries ...
  - GA4_MEASUREMENT_ID=${GA4_MEASUREMENT_ID}
  - GA4_API_SECRET=${GA4_API_SECRET}
```

### Step 4: Add all three variables to `.env.unified.example`

Add a new D2C Analytics section after the D2C Specific Variables block (after line 131):

```ini
# =============================================================================
# D2C Analytics — Google Tag Manager + GA4
# =============================================================================
# GTM container ID — get from tagmanager.google.com > your container > ID
# Format: GTM-XXXXXXX
# IMPORTANT: This is a BUILD-TIME variable. Changes require docker compose build.
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX

# GA4 Measurement ID — get from GA4 Admin > Data Streams > your stream > Measurement ID
# Format: G-XXXXXXXXXX
GA4_MEASUREMENT_ID=G-XXXXXXXXXX

# GA4 Measurement Protocol API secret — get from GA4 Admin > Data Streams > Measurement Protocol API secrets
# Used for server-side conversion events (Stripe webhook -> GA4)
GA4_API_SECRET=
```

Also add items 16, 17, 18 to the Production Checklist at the bottom of the file:

```ini
# 16. NEXT_PUBLIC_GTM_ID  → GTM container ID (GTM-XXXXXXX). Requires rebuild.
# 17. GA4_MEASUREMENT_ID  → GA4 stream measurement ID (G-XXXXXXXXXX)
# 18. GA4_API_SECRET       → GA4 Measurement Protocol API secret
```

### Step 5: Update the production checklist in `claudedocs/DEPLOY-HETZNER-UNIFIED.md`

Add a note that `NEXT_PUBLIC_GTM_ID` requires a full image rebuild (`docker compose build d2c-app`) whenever the GTM container ID is changed, unlike runtime variables which only need `docker compose up -d --no-build` to take effect.

## Files to Modify

| File | Change |
|---|---|
| `d2c/Dockerfile` | Add `ARG NEXT_PUBLIC_GTM_ID` + `ENV NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}` in builder stage |
| `docker-compose.prod.yml` | Add `build.args` stanza to `d2c-app` service; add `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` to `environment` block |
| `.env.unified.example` | Add `NEXT_PUBLIC_GTM_ID`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` with comments explaining source/format |
| `claudedocs/DEPLOY-HETZNER-UNIFIED.md` | Add note that `NEXT_PUBLIC_GTM_ID` change requires image rebuild |

## Environment / Config Changes

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_GTM_ID` | Build-time | Yes, for analytics | Format `GTM-XXXXXXX`. Requires `docker compose build` on change. |
| `GA4_MEASUREMENT_ID` | Runtime | Yes, for server-side events | Format `G-XXXXXXXXXX`. From GA4 Admin > Data Streams. |
| `GA4_API_SECRET` | Runtime | Yes, for server-side events | From GA4 Admin > Data Streams > Measurement Protocol API secrets. |

**GTM Container Setup Prerequisites** (not code changes, but required before deploy):
1. Create a GTM container at tagmanager.google.com
2. Create a GA4 property in Google Analytics
3. Add GA4 Configuration tag in GTM pointed at your `GA4_MEASUREMENT_ID`
4. Configure conversion triggers in GTM for `begin_checkout` and `purchase` dataLayer events
5. Publish the GTM container to get the container ID (`GTM-XXXXXXX`)
6. From GTM_V1_REVISED.md: "GTM/GA4 container setup — Component renders GTM script tag but no actual GTM container ID configured"

## Testing

**Build-time verification:**
```bash
# On server: confirm NEXT_PUBLIC_GTM_ID is baked into bundle
docker compose -f docker-compose.prod.yml build d2c-app
docker run --rm fbar-automator-d2c-app \
  grep -r "GTM-" /app/.next/static/chunks/ | head -5
# Should print lines containing the GTM container ID
```

**Runtime verification:**
```bash
# Confirm GTM script tag appears in page source
curl -s https://fbardirect.com | grep -o 'GTM-[A-Z0-9]*'
# Should print: GTM-XXXXXXX (your container ID)
```

**GA4 server-side verification:**
After a test Stripe checkout completes, check GA4 Realtime > Events. The `purchase` event should appear within 60 seconds. If not, check the Stripe webhook logs and server logs for Measurement Protocol errors (look for non-200 responses to `https://www.google-analytics.com/mp/collect`).

**GTM Preview mode:**
Use the GTM Preview & Debug tool (tagmanager.google.com > Preview) against `https://fbardirect.com`. The GTM debugger panel should show container connected and dataLayer events firing.

## Risks / Notes

- **Rebuild required on ID change**: Unlike all other variables in the D2C service, changing `NEXT_PUBLIC_GTM_ID` requires a full `docker compose build d2c-app` followed by `docker compose up -d d2c-app`. A runtime-only restart (`docker compose restart d2c-app`) will not update the value. This is a Docker multi-stage build constraint, not a workaround.

- **Build cache**: If a previous build was cached with `NEXT_PUBLIC_GTM_ID=""` (empty), Docker may serve the cached layer. Pass `--no-cache` on the first build after adding the ARG, or use `--build-arg NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX` directly to bust the cache for that layer.

- **GTM container must be published**: An unpublished GTM container produces a valid script tag that loads but tracks nothing. Ensure the container is published (not just saved) before going live.

- **CSP is already correct**: `d2c/next.config.js` line 38 already includes `https://www.googletagmanager.com` in `script-src`, `img-src`, `connect-src`, and `frame-src`. No CSP changes are needed.

- **`GA4_API_SECRET` is sensitive**: It is a server-side secret that must not be prefixed with `NEXT_PUBLIC_`. It should be treated with the same care as `STRIPE_SECRET_KEY` — rotate it if ever exposed.

- **Existing dataLayer pushes are wired**: The `begin_checkout` and `purchase` dataLayer events are already implemented in the wizard. They will fire correctly once GTM is loaded with a valid container ID.
