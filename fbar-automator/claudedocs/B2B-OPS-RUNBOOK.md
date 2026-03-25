# FBAR Unified — Operations Runbook

**For Claude Code sessions.** This is the reference for all production operations on the Hetzner server. Read this before touching prod.

---

## Server Access

| Key | Value |
|-----|-------|
| **IP** | `178.156.250.116` |
| **SSH** | `ssh root@178.156.250.116` |
| **B2B URL** | `https://b2b.178-156-250-116.sslip.io` |
| **D2C URL** | `https://fbardirect.com` |
| **Domain registrar** | Namecheap (`fbardirect.com`) |
| **App directory** | `/opt/fbar/fbar-automator` |
| **Git remote** | `https://github.com/themattcohen/atmix.git` (cloned at `/opt/fbar`) |
| **Compose file** | `docker-compose.prod.yml` (unified — B2B + D2C) |
| **Server RAM** | 1.9 GB + 2 GB swap (`/swapfile`, fstab) — still build images ONE AT A TIME |

The local Mac SSH key is authorized on the server. No password needed.

**Claude Code SSH access** (added 2026-02-19):
- Key file: `~/.ssh/hetzner_claude` (ed25519)
- Public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC9igMdJQTZFdnMEwYxiO0rCqL+zsJwzkFPiKD/gzDG6 claude-code@atmix`
- Usage: `ssh -i ~/.ssh/hetzner_claude -o BatchMode=yes root@178.156.250.116`
- Always use `-o BatchMode=yes` to prevent Git for Windows password popups

---

## ⚠️ BEFORE ANY DEPLOY: Add Temporary Swap

**MANDATORY first step.** The server's 2 GB swap is not enough for Docker builds (Next.js webpack needs ~2 GB heap). Without extra swap the OOM killer will SIGKILL the build, make SSH unresponsive for 10-15+ minutes, and waste your time.

```bash
# Add 2 GB temporary swap (idempotent — safe to run if already exists)
ssh root@178.156.250.116 "if ! swapon --show | grep -q /tmp/extraswap; then fallocate -l 2G /tmp/extraswap && chmod 600 /tmp/extraswap && mkswap /tmp/extraswap && swapon /tmp/extraswap && echo 'Extra swap added'; else echo 'Extra swap already active'; fi"
```

After deploy succeeds, clean it up:
```bash
ssh root@178.156.250.116 "swapoff /tmp/extraswap 2>/dev/null; rm -f /tmp/extraswap; echo 'Temp swap removed'"
```

Verify swap is active before building: `swapon --show` should show both `/swapfile` (2G) and `/tmp/extraswap` (2G) = **4 GB total**.

---

## Common Operations

### Deploy D2C

D2C is built locally on Hetzner via `scripts/deploy-d2c.sh`. No GHCR dependency.

```bash
# 1. From local — commit and push
git add <files> && git commit -m "message" && git push

# 2. On server — add temp swap, pull, build, deploy, clean up
ssh root@178.156.250.116 "if ! swapon --show | grep -q /tmp/extraswap; then fallocate -l 2G /tmp/extraswap && chmod 600 /tmp/extraswap && mkswap /tmp/extraswap && swapon /tmp/extraswap; fi && cd /opt/fbar/fbar-automator && git pull origin main && ./scripts/deploy-d2c.sh && swapoff /tmp/extraswap && rm -f /tmp/extraswap"

# With cache busted (after node_modules or Dockerfile changes):
ssh root@178.156.250.116 "if ! swapon --show | grep -q /tmp/extraswap; then fallocate -l 2G /tmp/extraswap && chmod 600 /tmp/extraswap && mkswap /tmp/extraswap && swapon /tmp/extraswap; fi && cd /opt/fbar/fbar-automator && git pull origin main && ./scripts/deploy-d2c.sh --no-cache && swapoff /tmp/extraswap && rm -f /tmp/extraswap"
```

**What the script does:**
1. Stops `d2c-app`, `d2c-cron`, `b2b-worker` to free ~750MB RAM
2. Prunes dangling images
3. Snapshots current `fbar-d2c:local` as `fbar-d2c:prev-<timestamp>` for rollback
4. Builds `fbar-d2c:local` from `d2c/Dockerfile` (build args sourced from `.env` via compose)
5. Restarts `b2b-worker`
6. Runs `d2c-migrate` (Prisma migrations)
7. Starts `d2c-app` and `d2c-cron`
8. Health-checks for up to 120s; exits non-zero on failure

**D2C is offline during build (~5-8 min).** B2B app stays up. Caddy returns 502 for D2C requests during this window.

**Rollback D2C:**
```bash
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && ./scripts/rollback-d2c.sh"
```

### Deploy B2B

```bash
# Pull and rebuild B2B app
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build b2b-app"

# Rebuild B2B + worker (if worker code changed)
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build b2b-app b2b-worker"
```

**WARNING**: Server has 1.9 GB RAM + 2 GB swap. Never build B2B and D2C simultaneously. Use `--build <service>` to target specific services.

### Run Database Migrations

```bash
# B2B migrations
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec b2b-app npx prisma migrate deploy"

# D2C migrations
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec d2c-app npx prisma migrate deploy"
```

### Check Service Health

```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml ps --format 'table {{.Name}}\t{{.Status}}'"
```

All 9 services should show `Up` and `(healthy)` where applicable:
- `b2b-app` — B2B Next.js application (port 3000)
- `b2b-worker` — B2B background job processor (LLM extraction)
- `b2b-cron` — BusyBox cron: daily sync-rates at 06:00 UTC
- `d2c-app` — D2C Next.js application (port 3001)
- `d2c-cron` — BusyBox cron: D2C scheduled tasks
- `caddy` — Reverse proxy + auto-TLS (routes by hostname)
- `postgres` — Shared database (fbar_automator + fbar_direct)
- `redis` — Cache + job queue (B2B only, `noeviction` policy)
- `minio` — S3-compatible object storage

### View Logs

```bash
# B2B app logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 100 b2b-app"

# D2C app logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 100 d2c-app"

# B2B worker logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 100 b2b-worker"

# Caddy/TLS logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 caddy"

# Follow logs live (add -f)
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs -f d2c-app"
```

### Restart a Service

**⚠️ `docker compose restart` does NOT re-read `.env` changes.** It only stops and starts the existing container with its original environment. If you changed `.env`, you must use `up -d --force-recreate <service>` instead (see "Environment Variables" section below).

```bash
# Restart B2B (no env changes)
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml restart b2b-app"

# Restart D2C (no env changes)
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml restart d2c-app"

# If .env was changed — MUST use force-recreate:
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate d2c-app"
```

### Backup Databases

```bash
# B2B database
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_automator" > b2b_backup_$(date +%Y%m%d).sql

# D2C database
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_direct" > d2c_backup_$(date +%Y%m%d).sql
```

---

## TLS / Domain Configuration

TLS is handled by Caddy + Let's Encrypt, configured via `.env` variables:

| Variable | Current Value |
|----------|---------------|
| `B2B_DOMAIN` | `b2b.178-156-250-116.sslip.io` |
| `D2C_DOMAIN` | `fbardirect.com` |
| `B2B_NEXTAUTH_URL` | `https://b2b.178-156-250-116.sslip.io` |
| `D2C_NEXTAUTH_URL` | `https://fbardirect.com` |

**D2C** uses the real domain `fbardirect.com` (registered on Namecheap, deployed 2026-02-19).
**B2B** still uses sslip.io (free wildcard DNS: `*.A-B-C-D.sslip.io` resolves to `A.B.C.D`).

The `Caddyfile.prod` includes a `www.{$D2C_DOMAIN}` block that 301-redirects `www.fbardirect.com` → `fbardirect.com`.

### DNS Setup (Namecheap)

`fbardirect.com` DNS is managed in Namecheap → Domain List → Manage → Advanced DNS:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` | `178.156.250.116` | Automatic |
| A Record | `www` | `178.156.250.116` | Automatic |

Caddy auto-provisions Let's Encrypt certs for the domain and www subdomain.

### Switch B2B to a Real Domain (when ready)

1. Register a domain and point A record to `178.156.250.116`
2. Update the `.env` values on the server:
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && \
     sed -i 's|^B2B_DOMAIN=.*|B2B_DOMAIN=preparer.yourdomain.com|' .env && \
     sed -i 's|^B2B_NEXTAUTH_URL=.*|B2B_NEXTAUTH_URL=https://preparer.yourdomain.com|' .env"
   ```
3. Recreate Caddy and the B2B app:
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate caddy b2b-app"
   ```

---

## Environment Variables

The `.env` file is at `/opt/fbar/fbar-automator/.env` on the server. To view (redacted):

```bash
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && grep -v PASSWORD .env | grep -v SECRET | grep -v KEY"
```

To edit:
```bash
ssh root@178.156.250.116 "nano /opt/fbar/fbar-automator/.env"
```

After editing `.env`, restart affected services:
```bash
# If B2B env changed:
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate b2b-app b2b-worker"

# If D2C env changed:
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate d2c-app"
```

### D2C Integrations

| Integration | Env Var | Status |
|---|---|---|
| **Domain** | `D2C_DOMAIN` | `fbardirect.com` — live with TLS |
| **Stripe** | `D2C_STRIPE_SECRET_KEY`, `D2C_STRIPE_WEBHOOK_SECRET` | **LIVE** — `sk_live_` key + webhook secret configured |
| **Email (Resend)** | `D2C_RESEND_API_KEY`, `D2C_RESEND_FROM_EMAIL` | **LIVE** (2026-02-28) — API key configured, domain verified (SPF/DKIM/DMARC) |
| **FinCEN SFTP** | `SDTM_HOST`, `SDTM_USERNAME`, `SDTM_PRIVATE_KEY_PATH` | Empty — SDTM not yet set up (requires separate FinCEN ticket) |
| **Google Tag** | `NEXT_PUBLIC_GTM_ID` | **LIVE** — `GT-P3JRZMRX` via gtag.js, GA4 `G-W2KXELPKZE` |
| **Sentry** | DSN baked into Docker image | **LIVE** — v10.39.0, CSP allows `*.ingest.us.sentry.io` |
| **Email Verification** | (no new env vars) | **LIVE** (2026-02-28) — signup sends verification email, middleware gate blocks unverified users |

### Resend Email Setup — DONE

D2C sends transactional emails (email verification, password reset, filing confirmation) via [Resend](https://resend.com).

**Current status (2026-02-28):** Fully configured. API key set on Hetzner, domain verified with all DNS records:
- SPF: `send.fbardirect.com` → `v=spf1 include:amazonses.com ~all`
- DKIM: `resend._domainkey.fbardirect.com` → RSA public key
- DMARC: `_dmarc.fbardirect.com` → `v=DMARC1; p=none;`
- MX: `send.fbardirect.com` → `feedback-smtp.us-east-1.amazonses.com`

**If you need to reconfigure:**
1. Resend dashboard → API Keys → Create Key (domain-scoped to `fbardirect.com`)
2. **Set env vars on server:**
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && \
     sed -i 's|^D2C_RESEND_API_KEY=.*|D2C_RESEND_API_KEY=re_your_key_here|' .env && \
     sed -i 's|^D2C_RESEND_FROM_EMAIL=.*|D2C_RESEND_FROM_EMAIL=noreply@fbardirect.com|' .env"
   ```
3. **Restart D2C:**
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate d2c-app"
   ```

---

## Architecture

```
Internet → Caddy (:443)
            ├── b2b.*.sslip.io  → B2B App (:3000) → Postgres (fbar_automator) / Redis / MinIO
            │                                      → Worker (background jobs via Redis queue)
            ├── fbardirect.com  → D2C App (:3001) → Postgres (fbar_direct) / MinIO
            └── www.fbardirect.com → 301 redirect → fbardirect.com
```

| Service | Image | Resources | Network |
|---------|-------|-----------|---------|
| caddy | Custom (caddy + rate_limit) | 0.25 CPU, 128M | frontend |
| b2b-app | Custom (Node 20 alpine) | 0.50 CPU, 384M | frontend + backend |
| b2b-worker | Custom (Node 20 alpine) | 0.50 CPU, 384M | backend |
| d2c-app | Custom (Node 22 alpine) | 0.50 CPU, 384M | frontend + backend |
| postgres | `postgres:16-alpine` | 0.75 CPU, 768M | backend |
| redis | `redis:7-alpine` | 0.25 CPU, 128M | backend |
| minio | `minio/minio:latest` | 0.25 CPU, 192M | backend |

The `backend` network is internal-only (no external access). Only Caddy is exposed to the internet.

### Databases

| Database | App | Prisma Schema |
|---|---|---|
| `fbar_automator` | B2B | `fbar-automator/prisma/schema.prisma` |
| `fbar_direct` | D2C | `fbar-automator/d2c/prisma/schema.prisma` |

Both accessed via the `fbar` superuser. Per-app users (`fbar_b2b`, `fbar_d2c`) defined in `docker/init-db.sh` but not yet created (init script only runs on fresh postgres).

---

## Password Gate (D2C)

The D2C site is behind Caddy basic auth while in development. Credentials: `admin` / `admin123`.

### Disable the password gate

Remove the `PASSWORD GATE` block from `Caddyfile.prod` (between the `---` comment markers), then force-recreate Caddy:

```bash
# After editing Caddyfile.prod locally and pushing:
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && docker compose -f docker-compose.prod.yml up -d --force-recreate caddy"
```

**Note:** `caddy reload` alone won't work — the bind mount needs a container recreate to pick up file changes.

### Exempted paths

These paths bypass the password gate:
- `/api/stripe/webhook` — Stripe needs unauthenticated access for payment callbacks
- `/health` — Health check endpoint for monitoring

---

## Troubleshooting

### App won't start
```bash
# Check B2B
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 b2b-app"

# Check D2C
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 d2c-app"
```
Common causes: missing env var, database migration needed, port conflict.

### OOM during Docker build

**Root cause:** Next.js webpack compilation needs ~2 GB heap. The server has 1.9 GB RAM + 2 GB swap = not enough. The OOM killer will SIGKILL the build and make SSH unresponsive for 10-15+ minutes.

**Prevention (MANDATORY):** Add temporary swap before every build. See "Before Any Deploy" section above.

**D2C builds:** Use `./scripts/deploy-d2c.sh` which stops D2C + B2B worker (~750MB freed) before building. The Dockerfile has `--max-old-space-size=2048`.

**B2B builds:** Never run alongside a D2C build. Use `--build b2b-app` to target one service.

If OOM still occurs even with extra swap:
1. Check memory: `free -h && docker stats --no-stream`
2. Verify swap: `swapon --show` (should show `/swapfile 2G` + `/tmp/extraswap 2G` = 4G total)
3. Stop B2B app too: `docker compose -f docker-compose.prod.yml stop b2b-app b2b-cron`
4. Prune: `docker system prune -f && docker builder prune --all -f`
5. If postgres is above 768M: `docker compose -f docker-compose.prod.yml restart postgres`

If OOM kills sshd, wait 15-30 seconds and reconnect.

### TLS cert not provisioning
```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 caddy"
```
Ensure ports 80 and 443 are open (`ufw status`) and both domains resolve to the server IP.

### Database connection errors
```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml exec postgres pg_isready -U fbar"
```

### Disk space
```bash
ssh root@178.156.250.116 "df -h / && docker system df"
```
To clean up old images: `docker image prune -f`

---

## Danger Zone

```bash
# Stop everything (data preserved in volumes)
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml down"

# DESTROY everything including data (irreversible)
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml down -v"
```
