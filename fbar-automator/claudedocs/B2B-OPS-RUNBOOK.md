# FBAR Unified — Operations Runbook

**For Claude Code sessions.** This is the reference for all production operations on the Hetzner server. Read this before touching prod.

---

## Server Access

| Key | Value |
|-----|-------|
| **IP** | `178.156.250.116` |
| **SSH** | `ssh root@178.156.250.116` |
| **B2B URL** | `https://b2b.178-156-250-116.sslip.io` |
| **D2C URL** | `https://d2c.178-156-250-116.sslip.io` |
| **App directory** | `/opt/fbar/fbar-automator` |
| **Git remote** | `https://github.com/themattcohen/atmix.git` (cloned at `/opt/fbar`) |
| **Compose file** | `docker-compose.prod.yml` (unified — B2B + D2C) |

The local Mac SSH key is authorized on the server. No password needed.

---

## Common Operations

### Deploy a Code Change

```bash
# 1. From local Mac — commit and push
git add <files> && git commit -m "message" && git push

# 2. On server — pull and rebuild
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build app"
```

If the change also affects the worker:
```bash
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build app worker"
```

### Run Database Migrations

```bash
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy"
```

### Check Service Health

```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml ps --format 'table {{.Name}}\t{{.Status}}'"
```

All 7 services should show `Up` and `(healthy)`:
- `b2b-app` — B2B Next.js application (port 3000)
- `b2b-worker` — B2B background job processor (LLM extraction)
- `d2c-app` — D2C Next.js application (port 3001)
- `caddy` — Reverse proxy + auto-TLS (routes by hostname)
- `postgres` — Shared database (fbar_automator + fbar_direct)
- `redis` — Cache + job queue (B2B only)
- `minio` — S3-compatible object storage

### View Logs

```bash
# App logs (most common)
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 100 app"

# Worker logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 100 worker"

# Caddy/TLS logs
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 caddy"

# Follow logs live (add -f)
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs -f app"
```

### Restart a Service

```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml restart app"
```

### Backup Database

```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_automator" > backup_$(date +%Y%m%d).sql
```

---

## TLS / Domain Configuration

TLS is handled by Caddy + Let's Encrypt, configured via two `.env` variables:

| Variable | Current Value |
|----------|---------------|
| `B2B_DOMAIN` | `b2b.178-156-250-116.sslip.io` |
| `D2C_DOMAIN` | `d2c.178-156-250-116.sslip.io` |
| `B2B_NEXTAUTH_URL` | `https://b2b.178-156-250-116.sslip.io` |
| `D2C_NEXTAUTH_URL` | `https://d2c.178-156-250-116.sslip.io` |

**sslip.io** provides free wildcard DNS: `*.A-B-C-D.sslip.io` resolves to `A.B.C.D`. Caddy auto-provisions Let's Encrypt certs for both subdomains.

### Switch to a Real Domain

1. Point DNS A record for `fbar.yourdomain.com` to `178.156.250.116`
2. Update the two `.env` values on the server:
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && \
     sed -i 's|^DOMAIN=.*|DOMAIN=fbar.yourdomain.com|' .env && \
     sed -i 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://fbar.yourdomain.com|' .env"
   ```
3. Recreate Caddy and app:
   ```bash
   ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate caddy app"
   ```

Caddy auto-provisions the new cert. No other changes needed.

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
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml up -d --force-recreate app worker"
```

---

## Architecture

```
Internet → Caddy (:443)
            ├── b2b.*.sslip.io → B2B App (:3000) → Postgres (fbar_automator) / Redis / MinIO
            │                                     → Worker (background jobs via Redis queue)
            └── d2c.*.sslip.io → D2C App (:3001) → Postgres (fbar_direct) / MinIO
```

| Service | Image | Resources | Network |
|---------|-------|-----------|---------|
| caddy | Custom (caddy + rate_limit) | 0.25 CPU, 128M | frontend |
| b2b-app | Custom (Node 20 alpine) | 0.50 CPU, 384M | frontend + backend |
| b2b-worker | Custom (Node 20 alpine) | 0.50 CPU, 384M | frontend + backend |
| d2c-app | Custom (Node 22 alpine) | 0.50 CPU, 384M | frontend + backend |
| postgres | `postgres:16-alpine` | 0.75 CPU, 768M | backend |
| redis | `redis:7-alpine` | 0.25 CPU, 128M | backend |
| minio | `minio/minio:latest` | 0.25 CPU, 192M | backend |

The `backend` network is internal-only (no external access). Only Caddy is exposed to the internet.

---

## Troubleshooting

### App won't start
```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 app"
```
Common causes: missing env var, database migration needed, port conflict.

### TLS cert not provisioning
```bash
ssh root@178.156.250.116 "docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml logs --tail 50 caddy"
```
Ensure ports 80 and 443 are open (`ufw status`) and `DOMAIN` resolves to the server IP.

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
