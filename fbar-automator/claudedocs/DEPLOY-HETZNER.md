# Deploy FBAR Automator to Hetzner VPS

**Target:** Hetzner CAX11 (ARM, 4GB RAM, ~$4/mo) | **Location:** US-East (Ashburn, VA)
**Stack:** Caddy (auto-TLS) + Next.js app + Worker + PostgreSQL + Redis + MinIO
**Prerequisite:** A domain name (e.g., `fbar.yourdomain.com`)

---

## Phase 1: Create the Hetzner Server (~5 min)

1. **Sign up** at [console.hetzner.cloud](https://console.hetzner.cloud)
2. **Create a project** (e.g., "FBAR Automator")
3. **Add your SSH key**: Settings > SSH Keys > Add SSH Key
   - On your Mac: `cat ~/.ssh/id_ed25519.pub | pbcopy` (or `id_rsa.pub`)
   - If you don't have one: `ssh-keygen -t ed25519`
4. **Create server:**
   - Location: **Ashburn, VA** (us-east)
   - Image: **Ubuntu 24.04**
   - Type: **CAX11** (ARM, 2 vCPU, 4GB RAM, 40GB disk) — ~$4.49/mo
   - SSH Key: select the one you added
   - Name: `fbar-prod`
   - Click Create

5. **Copy the IP address** from the server list (e.g., `5.161.xxx.xxx`)

---

## Phase 2: Point Your Domain (~2 min)

In your DNS provider (Cloudflare, Namecheap, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `fbar` (or `@`) | `5.161.xxx.xxx` | 300 |

Wait for DNS propagation (usually <5 min). Test: `dig fbar.yourdomain.com`

---

## Phase 3: Bootstrap the Server (~10 min)

```bash
# SSH into your server
ssh root@5.161.xxx.xxx

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Set up firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy needs this for ACME challenge)
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Clone the repo
git clone https://github.com/themattcohen/atmix.git /opt/fbar
cd /opt/fbar/fbar-automator

# Create the .env file (see Phase 4)
```

---

## Phase 4: Configure Environment (~5 min)

On the server, create `/opt/fbar/fbar-automator/.env`:

```bash
cat > .env << 'ENVFILE'
# --- Domain ---
DOMAIN=fbar.yourdomain.com

# --- Database ---
POSTGRES_USER=fbar
POSTGRES_PASSWORD=GENERATE_ME_1
POSTGRES_DB=fbar_automator
DATABASE_URL=postgresql://fbar:GENERATE_ME_1@postgres:5432/fbar_automator

# --- Redis ---
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=GENERATE_ME_2

# --- Auth ---
NEXTAUTH_SECRET=GENERATE_ME_3
NEXTAUTH_URL=https://fbar.yourdomain.com

# --- S3 / MinIO ---
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=GENERATE_ME_4
S3_SECRET_KEY=GENERATE_ME_5
S3_BUCKET=fbar-statements
S3_REGION=us-east-1

# --- Anthropic ---
ANTHROPIC_API_KEY=sk-ant-your-real-key

# --- Cron ---
CRON_SECRET=GENERATE_ME_6

# --- Encryption ---
ENCRYPTION_KEY=GENERATE_ME_7

# --- Worker ---
WORKER_CONCURRENCY=10
WORKER_RATE_LIMIT_MAX=60

# --- Email (optional, skip for now) ---
RESEND_API_KEY=
ENVFILE
```

Generate all the secrets:

```bash
# Replace each GENERATE_ME_N with a real secret
sed -i "s/GENERATE_ME_1/$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)/" .env
sed -i "s/GENERATE_ME_2/$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)/" .env
sed -i "s/GENERATE_ME_3/$(openssl rand -base64 32)/" .env
sed -i "s/GENERATE_ME_4/$(openssl rand -hex 16)/" .env
sed -i "s/GENERATE_ME_5/$(openssl rand -hex 32)/" .env
sed -i "s/GENERATE_ME_6/$(openssl rand -base64 32)/" .env
sed -i "s/GENERATE_ME_7/$(openssl rand -hex 32)/" .env
```

Then edit the file to set your real domain and Anthropic key:

```bash
nano .env
# Set DOMAIN, NEXTAUTH_URL, and ANTHROPIC_API_KEY
```

---

## Phase 5: Deploy (~5 min)

```bash
cd /opt/fbar/fbar-automator

# Build and start everything
docker compose -f docker-compose.prod.yml up -d --build

# Wait for postgres to be ready (~15s), then run migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Create the MinIO bucket
docker compose -f docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 $S3_ACCESS_KEY $S3_SECRET_KEY && \
  mc mb local/fbar-statements --ignore-existing

# Check all services are healthy
docker compose -f docker-compose.prod.yml ps
```

Visit `https://fbar.yourdomain.com` — you should see the app with a valid TLS cert.

---

## Phase 6: Create First Admin User

```bash
# Open a shell in the app container
docker compose -f docker-compose.prod.yml exec app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
(async () => {
  const prisma = new PrismaClient();
  const practice = await prisma.practice.create({
    data: { name: 'My Practice' }
  });
  await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: 'you@yourdomain.com',
      name: 'Admin',
      passwordHash: await bcrypt.hash('YourSecurePassword123!', 12),
      role: 'ADMIN',
    }
  });
  console.log('Admin user created!');
  await prisma.\$disconnect();
})();
"
```

---

## Maintenance Commands

```bash
cd /opt/fbar/fbar-automator

# View logs
docker compose -f docker-compose.prod.yml logs -f app        # Next.js app
docker compose -f docker-compose.prod.yml logs -f worker     # Extraction worker
docker compose -f docker-compose.prod.yml logs -f caddy      # TLS/proxy

# Update to latest code
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build

# Restart a single service
docker compose -f docker-compose.prod.yml restart worker

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and destroy data (CAREFUL)
docker compose -f docker-compose.prod.yml down -v

# Backup database
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U fbar fbar_automator > backup_$(date +%Y%m%d).sql
```

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Hetzner CAX11 | ~$4.49/mo |
| Domain name | ~$10-15/yr |
| TLS certificate | Free (Let's Encrypt via Caddy) |
| **Total** | **~$5-6/mo** |

---

## Codebase Changes Required

Before deploying, the following files need to be created/updated in the repo:

1. **`Caddyfile`** — new file, Caddy reverse proxy config (~15 lines)
2. **`docker-compose.prod.yml`** — replace nginx with Caddy, add MinIO service
3. **`Dockerfile`** — add Prisma migrate stage (for `prisma migrate deploy`)

These changes are detailed in the companion commit.
