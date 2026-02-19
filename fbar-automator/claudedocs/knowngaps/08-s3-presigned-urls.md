# Gap #8: S3 Presigned URLs broken in production

**Severity:** High
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

Presigned S3 URLs generated in production embed `http://minio:9000` — the Docker-internal hostname —
as the URL base. When a browser tries to follow that URL it gets a DNS resolution failure because
`minio` is not a publicly reachable hostname. Any feature that serves a presigned download link to the
user (e.g. downloading a generated FBAR PDF or uploaded statement) will silently fail.

The S3 library (`d2c/src/lib/s3.ts`) already has the correct two-client architecture: an internal
`getS3Client()` for server-to-server uploads/downloads and a `getS3PublicClient()` for generating
presigned URLs. `getS3PublicClient()` reads `S3_PUBLIC_ENDPOINT` and falls back to `S3_ENDPOINT` when
that variable is absent (line 31). In production `S3_ENDPOINT=http://minio:9000` and
`S3_PUBLIC_ENDPOINT` is never set, so the fallback fires and presigned URLs embed the internal
hostname.

## Current State

**File:** `/Users/matt/atmix/fbar-automator/d2c/src/lib/s3.ts`

```typescript
// Lines 28-41
function getS3PublicClient(): S3Client {
  if (!s3PublicClient) {
    s3PublicClient = new S3Client({
      endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,  // line 31
      ...
    });
  }
  return s3PublicClient;
}

// Lines 73-85
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  return getSignedUrl(
    getS3PublicClient(),   // uses S3_PUBLIC_ENDPOINT (missing) → falls back to S3_ENDPOINT
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  );
}
```

**File:** `/Users/matt/atmix/fbar-automator/.env.unified.example`

The S3 section (lines 44-54) defines `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`,
`B2B_S3_BUCKET`, and `D2C_S3_BUCKET`. `S3_PUBLIC_ENDPOINT` is absent entirely.

**File:** `/Users/matt/atmix/fbar-automator/docker-compose.prod.yml`

The `d2c-app` service environment block (lines 200-217) passes through S3 variables from `.env`
but does not include `S3_PUBLIC_ENDPOINT`. It also does not expose the MinIO port to the host, so
the MinIO container is only reachable inside the `backend` Docker network — confirming that presigned
URLs pointing to `http://minio:9000` will always be unreachable from a browser.

**How MinIO is deployed:** The `minio` service (lines 383-409) is on the `backend` network only
(internal bridge, no external access). There is no Caddy proxy rule for MinIO, so there is currently
no public URL for MinIO at all.

## Implementation Plan

### Step 1: Expose MinIO through Caddy (infrastructure)

MinIO needs a publicly reachable URL for presigned URLs to work. There are two approaches:

**Option A (recommended for simplicity): Proxy MinIO through Caddy**

Add a MinIO route to `Caddyfile.prod` so that `https://s3.{D2C_DOMAIN}` (or `https://{D2C_DOMAIN}/s3/`)
proxies to `http://minio:9000`. Then `S3_PUBLIC_ENDPOINT` becomes `https://s3.fbardirect.com`.

Example Caddyfile stanza to add (uses a subdomain):

```
s3.{$D2C_DOMAIN} {
    reverse_proxy minio:9000
}
```

Add `minio` to the `frontend` network in `docker-compose.prod.yml` so Caddy can reach it:

```yaml
# In the minio service, change:
networks:
  - backend

# To:
networks:
  - backend
  - frontend
```

**Option B: Expose MinIO port directly on the host**

Simpler but exposes the port publicly. Add to the `minio` service in `docker-compose.prod.yml`:

```yaml
ports:
  - "9000:9000"
```

Then set `S3_PUBLIC_ENDPOINT=http://178.156.250.116:9000`. This works but uses HTTP (not HTTPS) and
exposes MinIO directly — not recommended for production.

**Recommended path: Option A (subdomain proxy through Caddy).**

### Step 2: Add `S3_PUBLIC_ENDPOINT` to `.env.unified.example`

In the S3 section (after line 47 — `S3_ENDPOINT=http://minio:9000`), add:

```
# Public-facing MinIO URL used to generate presigned download links (must be reachable from browsers).
# When using Caddy as proxy: https://s3.{D2C_DOMAIN}
# When exposing MinIO port directly: http://<server-ip>:9000
S3_PUBLIC_ENDPOINT=https://s3.fbardirect.com
```

Also add `S3_PUBLIC_ENDPOINT` to the Production Checklist at the bottom (currently items 1-15,
insert as item 6a or renumber):

```
# 6a. S3_PUBLIC_ENDPOINT → public MinIO URL (https://s3.{D2C_DOMAIN} if using Caddy subdomain)
```

### Step 3: Pass `S3_PUBLIC_ENDPOINT` to the `d2c-app` container

In `docker-compose.prod.yml`, add one line to the `d2c-app` environment block (after line 205,
the `S3_BUCKET` line):

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_URL=${D2C_DATABASE_URL}
  - NEXTAUTH_SECRET=${D2C_NEXTAUTH_SECRET}
  - NEXTAUTH_URL=${D2C_NEXTAUTH_URL}
  - S3_ENDPOINT=${S3_ENDPOINT}          # add this — currently missing for d2c-app too
  - S3_ACCESS_KEY=${S3_ACCESS_KEY}      # add this — currently missing for d2c-app too
  - S3_SECRET_KEY=${S3_SECRET_KEY}      # add this — currently missing for d2c-app too
  - S3_REGION=${S3_REGION}              # add this — currently missing for d2c-app too
  - S3_PUBLIC_ENDPOINT=${S3_PUBLIC_ENDPOINT}   # THE CRITICAL MISSING VAR
  - S3_BUCKET=${D2C_S3_BUCKET}
  ...
```

Note: Inspecting the current `d2c-app` environment block (lines 200-217), `S3_ENDPOINT`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_REGION` are also not explicitly passed (only `S3_BUCKET`
is set). They are likely reaching the container via `env_file: .env` (line 199), which passes the
entire `.env` file. That means `S3_PUBLIC_ENDPOINT` will also be available via `env_file` once it
is set in `.env` — so Step 3 may only require adding the variable to `.env` itself (Step 4 below).
However, for clarity and consistency with how other services are configured, explicitly listing it
in the `environment` block is the safer pattern.

### Step 4: Set `S3_PUBLIC_ENDPOINT` in the live `.env` on the server

```bash
ssh root@178.156.250.116
cd /opt/fbar

# Add or update S3_PUBLIC_ENDPOINT in .env
# If using Caddy subdomain (Option A):
echo 'S3_PUBLIC_ENDPOINT=https://s3.fbardirect.com' >> .env

# Verify it's there
grep S3_PUBLIC_ENDPOINT .env
```

### Step 5: Apply changes and restart

If using Caddy subdomain (Option A), restart in this order to avoid downtime:

```bash
# Recreate with updated config (Caddy must be force-recreated for config changes)
docker compose -f docker-compose.prod.yml up -d --force-recreate caddy minio d2c-app
```

If only adding the env var (no Caddy/network change), a lighter restart suffices:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps d2c-app
```

## Files to Modify

| File | Change |
|---|---|
| `.env.unified.example` | Add `S3_PUBLIC_ENDPOINT` variable with comment in S3 section and in checklist |
| `docker-compose.prod.yml` | Add `S3_PUBLIC_ENDPOINT=${S3_PUBLIC_ENDPOINT}` to `d2c-app` environment block; optionally add `minio` to `frontend` network (Option A) |
| `Caddyfile.prod` | Add `s3.{$D2C_DOMAIN}` subdomain block proxying to `minio:9000` (Option A only) |
| `/opt/fbar/.env` (live server) | Add `S3_PUBLIC_ENDPOINT=https://s3.fbardirect.com` (runtime config, not in git) |

No application code changes — `d2c/src/lib/s3.ts` is already correct and will use
`S3_PUBLIC_ENDPOINT` once the variable exists.

## Environment / Config Changes

| Variable | Where | Value (production) |
|---|---|---|
| `S3_PUBLIC_ENDPOINT` | `.env.unified.example`, `.env` (live), `docker-compose.prod.yml` env block | `https://s3.fbardirect.com` (Option A) or `http://178.156.250.116:9000` (Option B) |

DNS: If using Option A, a DNS record for `s3.fbardirect.com` must be pointed at `178.156.250.116`
(same A record as `fbardirect.com`). Caddy will automatically provision a TLS cert for the subdomain.

## Testing

**Manual verification:**

1. Upload a test document through the D2C filing flow (complete through the accounts step which
   triggers a statement upload).
2. Navigate to the step that triggers a presigned download link.
3. Confirm the returned URL begins with `https://s3.fbardirect.com/` (or the configured public
   endpoint) and NOT with `http://minio:9000`.
4. Confirm the link is reachable from a browser (no connection error, file downloads successfully).

**Quick API test from the server:**

```bash
# Generate a presigned URL via the API (requires auth cookie)
# The URL in the response should use the public hostname:
curl -s https://fbardirect.com/api/filing/... | grep -o '"url":"[^"]*"'
# Expected: "url":"https://s3.fbardirect.com/fbar-direct/..."
# Bad:      "url":"http://minio:9000/fbar-direct/..."
```

**Playwright E2E:** No existing E2E test currently validates presigned URL reachability. A new test
should be added that follows a presigned download link and asserts HTTP 200, but that is out of scope
for this gap fix.

## Risks / Notes

- **`env_file` vs explicit environment:** The `d2c-app` service uses both `env_file: .env` and an
  explicit `environment:` block. Variables in `environment:` take precedence over `env_file`. Since
  `S3_PUBLIC_ENDPOINT` is not currently overridden in the `environment:` block, simply adding it to
  `.env` on the server will work immediately. The explicit `environment:` block addition is still
  recommended for documentation clarity.
- **MinIO CORS:** When browsers fetch presigned URLs, MinIO must have a CORS policy that allows GET
  requests from the D2C origin (`https://fbardirect.com`). MinIO's default CORS policy allows all
  origins for presigned URLs, but if this was ever restricted, downloads will fail with a CORS error
  even if the URL is correct. Verify with browser dev tools if downloads fail after the fix.
- **Presigned URL signing key:** Presigned URLs are signed with `S3_ACCESS_KEY`/`S3_SECRET_KEY`.
  If `S3_PUBLIC_ENDPOINT` differs from the endpoint used when the URL was signed (they can differ
  in hostname only — the signature covers the path and query parameters), MinIO will still validate
  it correctly because MinIO checks the signature against the canonical request, not the hostname.
- **Existing broken URLs:** Any presigned URLs generated before this fix and stored in the database
  will embed the internal `minio:9000` hostname. These will need to be regenerated. Since presigned
  URLs default to a 300-second TTL (`expiresIn = 300` in `getPresignedUrl()`), stale links will
  naturally expire and be regenerated on the next request.
- **Option B security note:** Exposing port 9000 directly allows unauthenticated access to the MinIO
  API (list buckets, etc.) if MinIO policies are misconfigured. Prefer Option A (Caddy proxy) for
  production.
