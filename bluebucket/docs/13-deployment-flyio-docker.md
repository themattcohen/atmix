# Fly.io + Docker + Upstash Deployment Guide

**Last Updated**: January 2026
**Target Environment**: Production
**Cost**: Free tier (both Fly.io and Upstash)

---

## Overview

This guide covers deploying the Blue Bucket voice agent server using:
- **Docker** - Containerization (local = production parity)
- **Fly.io** - Container hosting (free tier, no cold starts)
- **Upstash Redis** - Serverless Redis (free tier, phone mapping + tokens)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLY.IO (Free Tier)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Docker Container                          │  │
│  │  Node.js 20 + Express                                    │  │
│  │  POST /webhook/retell     ← Retell function calls        │  │
│  │  POST /webhook/jobber     ← Jobber REQUEST_CREATE        │  │
│  │  GET  /oauth/callback     ← Initial Jobber auth          │  │
│  │  GET  /health             ← Health check                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UPSTASH REDIS (Free Tier)                    │
│  phone:+1303... → { requestId, propertyId, name }              │
│  jobber:tokens  → { access_token, refresh_token, expires }     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Fly.io account**: https://fly.io/app/sign-up
2. **Upstash account**: https://console.upstash.com/
3. **Flyctl CLI**: https://fly.io/docs/hands-on/install-flyctl/
4. **Docker Desktop**: https://www.docker.com/products/docker-desktop/

---

## Part 1: Upstash Redis Setup

### 1.1 Create Redis Database

1. Go to https://console.upstash.com/
2. Click **Create Database**
3. Settings:
   - **Name**: `bluebucket-prod`
   - **Region**: `us-west-1` (closest to Denver)
   - **Type**: Regional (free tier)
   - **Eviction**: Disabled
4. Click **Create**

### 1.2 Get Connection Credentials

After creation, copy these values from the dashboard:

```env
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 1.3 Free Tier Limits

| Limit | Value | Sufficient For |
|-------|-------|----------------|
| Commands/day | 10,000 | ~2,000 calls/day |
| Storage | 256MB | ~50,000 phone mappings |
| Connections | Unlimited | N/A (REST API) |

---

## Part 2: Docker Configuration

### 2.1 Dockerfile

Create `server/Dockerfile`:

```dockerfile
# Production Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

# Health check for Fly.io
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
```

### 2.2 docker-compose.yml (Local Development)

Create `server/docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./src:/app/src:ro  # Hot reload
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 2.3 Local Development Commands

```bash
# Start local environment
docker-compose up --build

# View logs
docker-compose logs -f app

# Stop
docker-compose down

# Clean rebuild
docker-compose down -v && docker-compose up --build
```

---

## Part 3: Fly.io Configuration

### 3.1 fly.toml

Create `server/fly.toml`:

```toml
app = "bluebucket-server"
primary_region = "den"  # Denver

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  BUSINESS_TZ = "America/Denver"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # NO cold starts
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health"
```

### 3.2 Initial Deployment

```bash
cd server

# Login to Fly.io
fly auth login

# Create app (first time only)
fly launch --no-deploy

# Set secrets (NEVER in fly.toml)
fly secrets set JOBBER_CLIENT_ID="your_client_id"
fly secrets set JOBBER_CLIENT_SECRET="your_client_secret"
fly secrets set UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
fly secrets set UPSTASH_REDIS_REST_TOKEN="AXxxx..."
fly secrets set RETELL_WEBHOOK_SECRET="your_random_secret"
fly secrets set CEO_PHONE="+13035551234"

# Deploy
fly deploy

# Check status
fly status
fly logs
```

### 3.3 Subsequent Deployments

```bash
# Just deploy (reads fly.toml)
fly deploy

# Deploy with immediate log tail
fly deploy && fly logs
```

### 3.4 Useful Fly.io Commands

```bash
# View logs
fly logs

# SSH into container
fly ssh console

# Check app status
fly status

# View secrets (names only)
fly secrets list

# Update a secret
fly secrets set KEY="new_value"

# Scale (if needed later)
fly scale count 2

# Open app in browser
fly open
```

---

## Part 4: Environment Variables

### 4.1 Complete .env.example

```env
# ===========================================
# Blue Bucket Server Environment Variables
# ===========================================

# Server
PORT=3000
NODE_ENV=development

# Business Configuration
BUSINESS_TZ=America/Denver
BUSINESS_HOURS_START=08:00
BUSINESS_HOURS_END=18:00
TEAM_CAPACITY=2
CEO_PHONE=+13035551234

# Jobber OAuth
JOBBER_CLIENT_ID=
JOBBER_CLIENT_SECRET=
JOBBER_REDIRECT_URI=http://localhost:3000/oauth/callback
JOBBER_API_URL=https://api.getjobber.com/api/graphql

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Retell Security
RETELL_WEBHOOK_SECRET=
```

### 4.2 Local vs Production

| Variable | Local (.env) | Production (fly secrets) |
|----------|--------------|--------------------------|
| NODE_ENV | development | production |
| JOBBER_REDIRECT_URI | http://localhost:3000/oauth/callback | https://bluebucket-server.fly.dev/oauth/callback |
| All secrets | In .env file | In fly secrets |

---

## Part 5: Webhook URLs

After deployment, configure these URLs:

### 5.1 Retell Dashboard

```
Webhook URL: https://bluebucket-server.fly.dev/webhook/retell
```

Also configure `X-Retell-Secret` header with your `RETELL_WEBHOOK_SECRET` value.

### 5.2 Jobber Developer Portal

```
Webhook URL: https://bluebucket-server.fly.dev/webhook/jobber
Events: REQUEST_CREATE
```

### 5.3 Jobber OAuth Redirect

```
Redirect URI: https://bluebucket-server.fly.dev/oauth/callback
```

---

## Part 6: Health Check & Monitoring

### 6.1 Health Endpoint

The server exposes `/health` which returns:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-16T10:30:00Z",
  "redis": "connected",
  "jobber_token": "valid"
}
```

### 6.2 Fly.io Monitoring

```bash
# Real-time logs
fly logs

# Metrics dashboard
fly dashboard
```

### 6.3 Basic Alerting (Future)

For MVP, logs only. Later add:
- Sentry for error tracking
- Upstash alerts for Redis issues
- Fly.io metrics alerts

---

## Part 7: Troubleshooting

### Container Won't Start

```bash
# Check build logs
fly logs --instance

# Check if secrets are set
fly secrets list

# Verify Dockerfile locally
docker build -t test . && docker run -p 3000:3000 test
```

### Redis Connection Failed

1. Verify `UPSTASH_REDIS_REST_URL` is correct (includes https://)
2. Check Upstash dashboard for connection issues
3. Test connection:
```bash
curl -X POST "https://your-db.upstash.io/get/test" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Webhooks Not Received

1. Verify Fly.io app is running: `fly status`
2. Check webhook URL is correct (https, not http)
3. Check logs for incoming requests: `fly logs`
4. Test endpoint manually:
```bash
curl -X POST https://bluebucket-server.fly.dev/health
```

### OAuth Token Expired

Tokens auto-refresh. If failing:
1. Check logs for refresh errors
2. Re-authorize via `/oauth/authorize` endpoint
3. Verify client credentials are correct

---

## Part 8: Cost Summary

| Service | Free Tier Includes | When You'd Pay |
|---------|-------------------|----------------|
| **Fly.io** | 3 shared VMs, 160GB transfer | >3 VMs or >160GB/mo |
| **Upstash Redis** | 10K commands/day, 256MB | >10K commands/day |
| **Total** | **$0/month** for MVP | Scale beyond free limits |

---

## Quick Reference

### Deploy New Version
```bash
git push origin main  # (if using CI/CD)
# OR
fly deploy
```

### View Logs
```bash
fly logs
```

### Update Secret
```bash
fly secrets set KEY="value"
```

### Restart App
```bash
fly apps restart bluebucket-server
```

### Check Status
```bash
fly status
```
