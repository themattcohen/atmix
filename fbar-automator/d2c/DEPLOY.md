# FBAR Direct (D2C) -- Deployment Guide

Production deployment guide for the FBAR Direct application. The stack is Next.js 14, PostgreSQL 16, MinIO (S3-compatible storage), and nginx, all orchestrated with Docker Compose.

## Architecture

```
                    ┌─────────┐
  Internet ────────>│  nginx  │ :80/:443
                    │ (proxy) │
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │   app   │ :3001 (Next.js)
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         ┌────┴────┐          ┌────┴────┐
         │postgres │          │  minio  │
         │  :5432  │          │  :9000  │
         └─────────┘          └─────────┘
```

Nginx sits on the public network and proxies to the app. Postgres and MinIO live on an internal-only `backend` network -- they are never exposed to the internet. The app bridges both networks.

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A server with at least 2 GB RAM and 2 vCPUs
- DNS A record pointing your domain to the server IP
- SSL certificate and private key (for HTTPS)

Resource limits defined in `docker-compose.prod.yml`:

| Service  | CPU   | Memory |
|----------|-------|--------|
| nginx    | 0.25  | 128 MB |
| app      | 1.0   | 512 MB |
| postgres | 1.0   | 1 GB   |
| minio    | 0.5   | 512 MB |

Total: ~2.25 vCPUs, ~2.15 GB RAM.

## 2. Environment Setup

Copy the example env file and fill in production values:

```sh
cp .env.example .env
```

### Required Variables

| Variable | Description | Example / How to generate |
|----------|-------------|---------------------------|
| `DATABASE_URL` | PostgreSQL connection string. In Docker Compose, the host is `postgres` (service name). | `postgresql://postgres:STRONG_PW@postgres:5432/fbar_direct?schema=public` |
| `NEXTAUTH_SECRET` | Session encryption key. | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public-facing app URL with scheme. | `https://app.fbardirect.com` |
| `ENCRYPTION_KEY` | AES-256 key for encrypting SSN and account numbers. Must be exactly 64 hex characters. | `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe API secret key. | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. | `whsec_...` |
| `S3_ENDPOINT` | MinIO/S3 endpoint (internal). In Docker Compose, use the service name. | `http://minio:9000` |
| `S3_REGION` | AWS/S3 region. | `us-east-1` |
| `S3_ACCESS_KEY` | MinIO/S3 access key. | Must match `MINIO_ROOT_USER`. |
| `S3_SECRET_KEY` | MinIO/S3 secret key. | Must match `MINIO_ROOT_PASSWORD`. |
| `S3_BUCKET` | Bucket name for PDF storage. | `fbar-direct` |
| `S3_PUBLIC_ENDPOINT` | Public-facing S3 URL for browser-accessible presigned URLs. | `https://s3.yourdomain.com` |
| `ANTHROPIC_API_KEY` | Claude API key for AI document extraction. | `sk-ant-...` |
| `RESEND_API_KEY` | Resend email service API key. | `re_...` |
| `RESEND_FROM_EMAIL` | Verified sender email address. | `noreply@fbardirect.com` |
| `POSTGRES_USER` | Postgres container username. | `postgres` |
| `POSTGRES_PASSWORD` | Postgres container password. Use a strong random value. | `openssl rand -base64 24` |
| `POSTGRES_DB` | Postgres database name. | `fbar_direct` |
| `MINIO_ROOT_USER` | MinIO admin username. | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO admin password. Use a strong random value. | `openssl rand -base64 24` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_PUBLIC_ENDPOINT` | If unset, falls back to `S3_ENDPOINT`. Set this in production. | (none) |
| `SDTM_HOST` | FinCEN SFTP host for BSA filing. | (empty) |
| `SDTM_PORT` | FinCEN SFTP port. | `22` |
| `SDTM_USERNAME` | FinCEN SFTP username. | (empty) |
| `SDTM_PRIVATE_KEY_PATH` | Path to SFTP private key. | (empty) |
| `SDTM_REMOTE_DIR` | Remote upload directory on SFTP. | `/upload` |
| `SDTM_SANDBOX_MODE` | Use FinCEN sandbox instead of production. | `true` |

## 3. First Deployment

```sh
# 1. Clone the repository
git clone <repo-url> && cd fbar-automator/d2c

# 2. Create and configure the environment file
cp .env.example .env
# Edit .env with production values (see Section 2)

# 3. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 4. Wait for health checks to pass (~45 seconds for app startup)
docker compose -f docker-compose.prod.yml ps

# 5. Verify the app is healthy
curl http://localhost/health
# Expected: JSON response with status

# 6. Create the MinIO bucket (first time only)
docker compose -f docker-compose.prod.yml exec minio \
  sh -c 'mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mb local/fbar-direct'
```

Database migrations run automatically on container start. The `entrypoint.sh` runs `npx prisma migrate deploy` before starting the Node.js server.

## 4. SSL / HTTPS Setup

### Step 1: Place certificates

```sh
mkdir -p ssl
cp /path/to/your/cert.pem ssl/cert.pem
cp /path/to/your/key.pem ssl/key.pem
```

### Step 2: Uncomment SSL volume mounts in `docker-compose.prod.yml`

In the `nginx` service, uncomment:

```yaml
volumes:
  - ./nginx.conf:/etc/nginx/nginx.conf:ro
  - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro   # <-- uncomment
  - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro      # <-- uncomment
```

### Step 3: Enable the HTTPS server block in `nginx.conf`

Uncomment the entire `server { listen 443 ssl http2; ... }` block starting at line 185.

Optionally, uncomment the HTTP-to-HTTPS redirect block at line 278 to force all traffic to HTTPS:

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

If you enable the redirect, remove (or comment out) the existing port-80 server block that proxies to the app.

### Step 4: Update environment and restart

```sh
# Update NEXTAUTH_URL to use https://
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://app.yourdomain.com|' .env

# Restart nginx to pick up changes
docker compose -f docker-compose.prod.yml up -d
```

The HTTPS block includes Mozilla Intermediate TLS configuration, HSTS headers, and OCSP stapling.

## 5. Database Management

### Migrations

Migrations run automatically every time the app container starts (`entrypoint.sh` calls `npx prisma migrate deploy`). To run manually:

```sh
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Backup

```sh
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%Y%m%d).sql
```

### Restore

```sh
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup.sql
```

### Prisma Studio (development only)

```sh
npx prisma studio
```

### Postgres tuning

The production compose file sets these Postgres parameters:

- `shared_buffers=256MB`
- `work_mem=8MB`
- `maintenance_work_mem=128MB`
- `max_connections=100`
- `effective_cache_size=512MB`
- `log_min_duration_statement=1000` (logs queries slower than 1 second)

## 6. Monitoring and Logs

### View logs

```sh
# All services
docker compose -f docker-compose.prod.yml logs -f

# Single service
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Log rotation

All services use the `json-file` logging driver with size limits:

| Service  | Max size | Max files |
|----------|----------|-----------|
| nginx    | 5 MB     | 3         |
| app      | 10 MB    | 3         |
| postgres | 10 MB    | 3         |
| minio    | 5 MB     | 3         |

### Health checks

```sh
# Via nginx (public endpoint)
curl http://localhost/health

# Direct to app (internal)
curl http://localhost:3001/api/health
```

All four services have Docker health checks configured. Use `docker compose ps` to see health status.

### Slow query logging

Postgres logs any query exceeding 1 second (`log_min_duration_statement=1000`). It also logs connections, disconnections, lock waits, and checkpoints.

### Error tracking (recommended)

For production error tracking, add Sentry:

1. Install `@sentry/nextjs` in the project.
2. Add a `SENTRY_DSN` environment variable.
3. Rebuild the app container.

## 7. Updating / Redeployment

```sh
# Pull the latest code
git pull

# Rebuild and restart (migrations run automatically)
docker compose -f docker-compose.prod.yml up -d --build
```

For zero-downtime restarts of just the app (no nginx interruption):

```sh
docker compose -f docker-compose.prod.yml up -d --no-deps --build app
```

## 8. Rollback

```sh
# Stop all services
docker compose -f docker-compose.prod.yml down

# Check out the previous working version
git checkout <previous-commit>

# Rebuild and start
docker compose -f docker-compose.prod.yml up -d --build
```

If a Prisma migration needs to be rolled back:

```sh
docker compose -f docker-compose.prod.yml exec app \
  npx prisma migrate resolve --rolled-back <migration-name>
```

Then restore the database from backup if the migration made destructive changes.

## 9. Secret Rotation

### NEXTAUTH_SECRET

Update the value in `.env` and restart the app. All existing user sessions will be invalidated -- users will need to log in again.

```sh
openssl rand -base64 32  # generate new secret
# Update .env
docker compose -f docker-compose.prod.yml up -d --no-deps app
```

### ENCRYPTION_KEY

**WARNING**: Changing `ENCRYPTION_KEY` will make all existing encrypted data (SSN, account numbers) permanently unreadable. Before rotating this key, you must:

1. Decrypt all existing data with the old key.
2. Re-encrypt with the new key.
3. A data migration script is required for this (not yet implemented).

Do not change this value without a migration plan.

### Database password

1. Update `POSTGRES_PASSWORD` in `.env`.
2. Update the password in the `DATABASE_URL` connection string to match.
3. Restart all services: `docker compose -f docker-compose.prod.yml up -d`.

### MinIO credentials

1. Update `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in `.env`.
2. Update `S3_ACCESS_KEY` and `S3_SECRET_KEY` to match.
3. Restart all services.

## 10. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `502 Bad Gateway` | App container not ready yet | Wait ~45 seconds for startup. Check `docker compose logs app`. |
| `ECONNREFUSED` on database | Postgres not healthy | Check `docker compose logs postgres`. Ensure `POSTGRES_PASSWORD` matches `DATABASE_URL`. |
| Migration failed on startup | Schema drift or failed migration | Check logs, then run `npx prisma migrate resolve` inside the container. |
| `429 Too Many Requests` | Nginx rate limiting triggered | Auth endpoints: 5 req/min (burst 3). API endpoints: 10 req/sec (burst 20). Wait and retry. |
| Presigned URL expired | S3 URLs expire after generation | Refresh the page to get a new presigned URL. |
| Session expired | JWT token expired or secret rotated | Log in again. |
| Build fails with OOM | Docker memory too low | Increase Docker memory limit to 4 GB or more. |
| MinIO bucket not found | Bucket not created after first deploy | Run the `mc mb` command from Section 3, step 6. |
| App filesystem errors | Container runs as read-only | The app uses `tmpfs` mounts for `/tmp` and `.next/cache`. Check if they are sized correctly. |

### Useful diagnostic commands

```sh
# Check service health
docker compose -f docker-compose.prod.yml ps

# Inspect a specific container
docker compose -f docker-compose.prod.yml exec app sh

# Check database connectivity from the app
docker compose -f docker-compose.prod.yml exec app \
  sh -c 'npx prisma db execute --stdin <<< "SELECT 1"'

# Check MinIO connectivity
docker compose -f docker-compose.prod.yml exec minio \
  curl -sf http://localhost:9000/minio/health/live

# View nginx rate limit hits
docker compose -f docker-compose.prod.yml logs nginx | grep 429
```

## Nginx Configuration Reference

Key behaviors configured in `nginx.conf`:

- **Rate limiting**: Auth endpoints at 5 req/min, API endpoints at 10 req/sec. Stripe webhooks are exempt.
- **Security headers**: X-Frame-Options DENY, CSP, HSTS (HTTPS only), X-Content-Type-Options nosniff.
- **Static file caching**: `_next/static/` cached for 1 year (immutable). Images cached for 1 day. Other static assets cached for 7 days.
- **Request size limit**: `client_max_body_size 1m`.
- **Gzip compression**: Enabled for text, JSON, CSS, JS, SVG, and XML.
- **Server tokens**: Disabled (`server_tokens off`).

## File Reference

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production service definitions (nginx, app, postgres, minio) |
| `docker-compose.yml` | Local development (postgres + minio only, exposed on non-standard ports) |
| `Dockerfile` | Multi-stage build: deps, builder, runner (node:22-alpine) |
| `entrypoint.sh` | Runs `prisma migrate deploy` then starts the Node.js server |
| `nginx.conf` | Reverse proxy config with rate limiting, caching, and security headers |
| `.env.example` | Template for all environment variables |
