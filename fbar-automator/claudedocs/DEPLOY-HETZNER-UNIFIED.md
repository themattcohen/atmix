# Deploy FBAR (B2B + D2C) to Hetzner VPS — Unified

**Target:** Hetzner CAX11 (ARM, 2 vCPU, 4GB RAM, 40GB disk, ~$4.49/mo)
**Location:** US-East (Ashburn, VA)
**Stack:** Caddy (auto-TLS + rate limiting) → B2B app + D2C app + B2B worker + Postgres + Redis + MinIO
**Prerequisites:** Two domain names (e.g., `preparer.yourdomain.com` + `file.yourdomain.com`)

---

## Architecture Overview

```
                    ┌─────────────┐
                    │    Caddy     │ :80/:443 (auto-TLS)
                    │ (rate limit) │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     preparer.domain.com         file.domain.com
              │                         │
      ┌───────┴───────┐         ┌──────┴──────┐
      │   B2B App     │         │  D2C App    │
      │   :3000       │         │  :3001      │
      └───────┬───────┘         └──────┬──────┘
              │                        │
    ┌─────────┼────────────────────────┼──────────┐
    │         │                        │          │
    │  ┌──────┴──────┐  ┌─────────────┴──────┐   │
    │  │ B2B Worker  │  │     PostgreSQL     │   │
    │  │ (BullMQ)    │  │ fbar_automator (B2B)│  │
    │  └──────┬──────┘  │ fbar_direct   (D2C)│  │
    │         │         └────────────────────┘   │
    │  ┌──────┴──────┐  ┌────────────────────┐   │
    │  │    Redis    │  │       MinIO        │   │
    │  │ (B2B only)  │  │ fbar-statements    │   │
    │  └─────────────┘  │ fbar-direct        │   │
    │                   └────────────────────┘   │
    │              backend (internal)             │
    └─────────────────────────────────────────────┘
```

---

## Phase 1: Create the Hetzner Server (~5 min)

1. **Sign up** at [console.hetzner.cloud](https://console.hetzner.cloud)
2. **Create a project** (e.g., "FBAR Production")
3. **Add your SSH key**: Settings > SSH Keys > Add SSH Key
   ```bash
   # On your Mac:
   cat ~/.ssh/id_ed25519.pub | pbcopy
   # If you don't have one: ssh-keygen -t ed25519
   ```
4. **Create server:**
   - Location: **Ashburn, VA** (us-east)
   - Image: **Ubuntu 24.04**
   - Type: **CAX11** (ARM, 2 vCPU, 4GB RAM, 40GB disk) — ~$4.49/mo
   - SSH Key: select the one you added
   - Name: `fbar-prod`
   - Click Create
5. **Copy the IP address** from the server list

---

## Phase 2: Point Your Domains (~2 min)

In your DNS provider (Cloudflare, Namecheap, etc.), create two A records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `preparer` | `<server-ip>` | 300 |
| A | `file` | `<server-ip>` | 300 |

Wait for DNS propagation (usually <5 min):
```bash
dig preparer.yourdomain.com
dig file.yourdomain.com
```

> **Note:** If using Cloudflare, set proxy status to "DNS only" (grey cloud) so Caddy can provision TLS certificates directly.

---

## Phase 3: Bootstrap the Server (~10 min)

```bash
# SSH into your server
ssh root@<server-ip>

# Install Docker + Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Set up firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy ACME challenge)
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Clone the repo
git clone https://github.com/themattcohen/atmix.git /opt/fbar
cd /opt/fbar/fbar-automator
```

---

## Phase 4: Configure Environment (~5 min)

```bash
cd /opt/fbar/fbar-automator

# Start from the template
cp .env.unified.example .env

# Generate all secrets
PG_SUPER_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
PG_B2B_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
PG_D2C_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
S3_KEY=$(openssl rand -hex 16)
S3_SEC=$(openssl rand -hex 32)
REDIS_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
B2B_SECRET=$(openssl rand -base64 32)
D2C_SECRET=$(openssl rand -base64 32)
B2B_ENC=$(openssl rand -hex 32)
D2C_ENC=$(openssl rand -hex 32)
B2B_CRON=$(openssl rand -base64 32)

# Apply secrets to .env (replace all CHANGE_ME placeholders)
sed -i "s|POSTGRES_PASSWORD=CHANGE_ME|POSTGRES_PASSWORD=$PG_SUPER_PASS|" .env
sed -i "s|POSTGRES_B2B_PASSWORD=CHANGE_ME_B2B|POSTGRES_B2B_PASSWORD=$PG_B2B_PASS|" .env
sed -i "s|POSTGRES_D2C_PASSWORD=CHANGE_ME_D2C|POSTGRES_D2C_PASSWORD=$PG_D2C_PASS|" .env
sed -i "s|S3_ACCESS_KEY=CHANGE_ME|S3_ACCESS_KEY=$S3_KEY|" .env
sed -i "s|S3_SECRET_KEY=CHANGE_ME|S3_SECRET_KEY=$S3_SEC|" .env
sed -i "s|REDIS_PASSWORD=CHANGE_ME|REDIS_PASSWORD=$REDIS_PASS|" .env
sed -i "s|REDIS_URL=redis://:CHANGE_ME@|REDIS_URL=redis://:$REDIS_PASS@|" .env
sed -i "s|CRON_SECRET=CHANGE_ME|CRON_SECRET=$B2B_CRON|" .env
sed -i "s|^ENCRYPTION_KEY=CHANGE_ME|ENCRYPTION_KEY=$B2B_ENC|" .env

# Database URLs (each app uses its own dedicated user)
sed -i "s|B2B_DATABASE_URL=postgresql://fbar_b2b:CHANGE_ME_B2B@|B2B_DATABASE_URL=postgresql://fbar_b2b:$PG_B2B_PASS@|" .env
sed -i "s|D2C_DATABASE_URL=postgresql://fbar_d2c:CHANGE_ME_D2C@|D2C_DATABASE_URL=postgresql://fbar_d2c:$PG_D2C_PASS@|" .env

# Auth secrets (must be different per app)
sed -i "s|B2B_NEXTAUTH_SECRET=CHANGE_ME|B2B_NEXTAUTH_SECRET=$B2B_SECRET|" .env
sed -i "s|D2C_NEXTAUTH_SECRET=CHANGE_ME|D2C_NEXTAUTH_SECRET=$D2C_SECRET|" .env

# D2C encryption key
sed -i "s|D2C_ENCRYPTION_KEY=CHANGE_ME|D2C_ENCRYPTION_KEY=$D2C_ENC|" .env
```

Then edit `.env` manually to set:
```bash
nano .env
# Set these:
#   B2B_DOMAIN=preparer.yourdomain.com
#   D2C_DOMAIN=file.yourdomain.com
#   B2B_NEXTAUTH_URL=https://preparer.yourdomain.com
#   D2C_NEXTAUTH_URL=https://file.yourdomain.com
#   ANTHROPIC_API_KEY=sk-ant-your-real-key       (B2B)
#   D2C_ANTHROPIC_API_KEY=sk-ant-your-real-key   (D2C)
#   D2C_STRIPE_SECRET_KEY=sk_live_...
#   D2C_STRIPE_WEBHOOK_SECRET=whsec_...
#   D2C_RESEND_API_KEY=re_...
```

> **Note on per-app database passwords:** The setup above generates three separate passwords —
> `POSTGRES_PASSWORD` (superuser `fbar`), `POSTGRES_B2B_PASSWORD` (app user `fbar_b2b`), and
> `POSTGRES_D2C_PASSWORD` (app user `fbar_d2c`). Each app connects only with its own credential.
> `fbar_b2b` cannot connect to `fbar_direct` and `fbar_d2c` cannot connect to `fbar_automator` —
> `CONNECT` on the opposite database is explicitly revoked. The superuser password is only needed
> for admin operations and backups.

---

## Phase 5: Deploy (~10 min)

```bash
cd /opt/fbar/fbar-automator

# Build and start everything
# (Migrations run automatically via init containers before apps start)
docker compose -f docker-compose.prod.yml up -d --build

# Watch the startup (migrations → apps → caddy)
docker compose -f docker-compose.prod.yml logs -f

# Verify all services are healthy
docker compose -f docker-compose.prod.yml ps
```

Expected output: all 7 long-running services `healthy` or `running`, both migrate containers `exited (0)`.

### Create MinIO Buckets

```bash
# Install MinIO client
docker compose -f docker-compose.prod.yml exec minio mc alias set local http://localhost:9000 "$S3_KEY" "$S3_SEC"

# Create both buckets
docker compose -f docker-compose.prod.yml exec minio mc mb local/fbar-statements --ignore-existing
docker compose -f docker-compose.prod.yml exec minio mc mb local/fbar-direct --ignore-existing
```

### Verify Multi-Database Setup

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U fbar -l
# Should show: fbar_automator (owner: fbar_b2b), fbar_direct (owner: fbar_d2c)

# Verify isolation (D2C user cannot access B2B database):
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fbar_d2c -d fbar_automator -c "SELECT 1;" 2>&1 | grep "FATAL"
# Expected: FATAL: permission denied
```

### Verify Routing

```bash
# B2B app responds
curl -s https://preparer.yourdomain.com/api/health

# D2C app responds
curl -s https://file.yourdomain.com/api/health

# Both should have valid TLS certs
curl -vI https://preparer.yourdomain.com 2>&1 | grep "SSL certificate"
curl -vI https://file.yourdomain.com 2>&1 | grep "SSL certificate"
```

---

## Phase 6: Create B2B Admin User

```bash
docker compose -f docker-compose.prod.yml exec b2b-app node -e "
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

D2C users self-register through the app — no admin setup needed.

---

## Phase 7: Set Up Backups

```bash
# Create backup directory
mkdir -p /opt/backups

# Add daily cron job (3am, 30-day retention)
cat > /etc/cron.d/fbar-backup << 'EOF'
0 3 * * * root docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml exec -T postgres pg_dumpall -U fbar > /opt/backups/pg_$(date +\%Y\%m\%d).sql && find /opt/backups -name "pg_*.sql" -mtime +30 -delete
EOF
chmod 644 /etc/cron.d/fbar-backup
```

---

## Maintenance Commands

```bash
cd /opt/fbar/fbar-automator

# --- Logs ---
docker compose -f docker-compose.prod.yml logs -f caddy       # TLS/proxy
docker compose -f docker-compose.prod.yml logs -f b2b-app     # B2B app
docker compose -f docker-compose.prod.yml logs -f d2c-app     # D2C app
docker compose -f docker-compose.prod.yml logs -f b2b-worker  # Extraction worker

# --- Update to latest code ---
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# (Migrations run automatically on startup)

# --- Restart individual services ---
docker compose -f docker-compose.prod.yml restart b2b-app
docker compose -f docker-compose.prod.yml restart d2c-app
docker compose -f docker-compose.prod.yml restart b2b-worker

# --- Stop everything ---
docker compose -f docker-compose.prod.yml down

# --- Stop and destroy ALL data (CAREFUL) ---
docker compose -f docker-compose.prod.yml down -v

# --- Manual database backup ---
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_automator > b2b_backup.sql
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_direct > d2c_backup.sql

# --- Postgres shell (use dedicated app users) ---
docker compose -f docker-compose.prod.yml exec postgres psql -U fbar_b2b fbar_automator  # B2B
docker compose -f docker-compose.prod.yml exec postgres psql -U fbar_d2c fbar_direct     # D2C
# For admin: psql -U fbar fbar_automator

# --- Disk usage ---
docker system df
du -sh /opt/fbar /opt/backups
```

---

## Migrating from B2B-Only Deploy

If you previously deployed B2B standalone using `DEPLOY-HETZNER.md`:

1. **Backup existing data:**
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U fbar fbar_automator > b2b_backup_pre_unified.sql
   ```

2. **Stop the old stack:**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

3. **Create the D2C database manually** (init-db.sh only runs on empty data dirs):
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres
   docker compose -f docker-compose.prod.yml exec postgres psql -U fbar -c "CREATE DATABASE fbar_direct;"
   docker compose -f docker-compose.prod.yml exec postgres psql -U fbar -c "GRANT ALL PRIVILEGES ON DATABASE fbar_direct TO fbar;"
   ```

3b. **Create dedicated database users:**
   ```bash
   # Create per-app users and transfer ownership
   docker compose -f docker-compose.prod.yml exec postgres psql -U fbar postgres <<'EOF'
   CREATE USER fbar_b2b WITH PASSWORD 'your-b2b-password';
   CREATE USER fbar_d2c WITH PASSWORD 'your-d2c-password';
   ALTER DATABASE fbar_automator OWNER TO fbar_b2b;
   ALTER DATABASE fbar_direct OWNER TO fbar_d2c;
   REVOKE CONNECT ON DATABASE fbar_automator FROM PUBLIC;
   REVOKE CONNECT ON DATABASE fbar_direct FROM PUBLIC;
   GRANT CONNECT ON DATABASE fbar_automator TO fbar_b2b;
   GRANT CONNECT ON DATABASE fbar_direct TO fbar_d2c;
   EOF

   # Transfer schema and table ownership
   docker compose -f docker-compose.prod.yml exec postgres \
     psql -U fbar fbar_automator -c "ALTER SCHEMA public OWNER TO fbar_b2b; REASSIGN OWNED BY fbar TO fbar_b2b;"
   docker compose -f docker-compose.prod.yml exec postgres \
     psql -U fbar fbar_direct -c "ALTER SCHEMA public OWNER TO fbar_d2c; REASSIGN OWNED BY fbar TO fbar_d2c;"
   ```

4. **Update .env** with the new unified variables (B2B_*, D2C_*, domains)

5. **Pull latest code and start unified stack:**
   ```bash
   git pull origin main
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## Splitting Apps Later

When you need to separate B2B and D2C onto different servers:

1. Provision a second Hetzner CAX11
2. On the new server, deploy D2C standalone using `d2c/docker-compose.prod.yml`
3. `pg_dump -U fbar fbar_direct` from the shared Postgres, import on new server
4. Update DNS: point `file.yourdomain.com` to the new server's IP
5. Remove D2C services from the unified compose on the original server

---

## Troubleshooting

### Caddy won't start / TLS errors
- Ensure ports 80 and 443 are open: `ufw status`
- Ensure DNS A records point to this server's IP: `dig +short preparer.yourdomain.com`
- Caddy needs port 80 for ACME HTTP-01 challenge — don't block it
- If using Cloudflare, set proxy to "DNS only" (grey cloud)

### Migration container fails
```bash
# Check migration logs
docker compose -f docker-compose.prod.yml logs b2b-migrate
docker compose -f docker-compose.prod.yml logs d2c-migrate

# Re-run migrations manually
docker compose -f docker-compose.prod.yml run --rm b2b-migrate
docker compose -f docker-compose.prod.yml run --rm d2c-migrate
```

### App returns 502
```bash
# Check if the app container is running
docker compose -f docker-compose.prod.yml ps
# Check app logs
docker compose -f docker-compose.prod.yml logs b2b-app  # or d2c-app
```

### Out of memory
```bash
# Check memory usage
docker stats --no-stream
free -h
# If needed, reduce worker concurrency in .env: WORKER_CONCURRENCY=5
```

### Rate limiting issues (429 errors)
- Auth endpoints: 5 req/min per IP (both B2B and D2C)
- API endpoints: 10 req/s per IP (both B2B and D2C)
- Stripe webhook is exempt from rate limiting
- Adjust in `Caddyfile.prod` if needed

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Hetzner CAX11 | ~$4.49/mo |
| Domain names (2) | ~$20-30/yr |
| TLS certificates | Free (Let's Encrypt via Caddy) |
| **Total** | **~$6-7/mo** |

---

## Resource Budget

| Service | CPU | Memory | Notes |
|---------|-----|--------|-------|
| caddy | 0.25 | 128M | Custom image w/ rate_limit |
| b2b-app | 0.50 | 384M | Next.js standalone |
| d2c-app | 0.50 | 384M | Next.js standalone |
| b2b-worker | 0.50 | 384M | BullMQ extraction |
| postgres | 0.75 | 768M | Shared, tuned for 4GB |
| redis | 0.25 | 128M | maxmemory=100mb |
| minio | 0.25 | 192M | Shared storage |
| **Total** | **3.0** | **2368M** | ~1.4GB headroom for OS/cache |
