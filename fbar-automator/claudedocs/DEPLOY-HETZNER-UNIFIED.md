# Deploy FBAR (B2B + D2C) to Hetzner VPS — Unified

**Target:** Hetzner CAX11 (ARM, 2 vCPU, 4GB RAM, 40GB disk, ~$4.49/mo)
**Location:** US-East (Ashburn, VA)
**Stack:** Caddy (auto-TLS + rate limiting) → B2B app + D2C app + B2B worker + Postgres + Redis + MinIO
**Prerequisites:** Domain name(s) on Namecheap. D2C uses `fbardirect.com`. B2B uses sslip.io (or a separate domain when ready).

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

### D2C Domain: fbardirect.com (Namecheap)

In Namecheap → Domain List → `fbardirect.com` → Manage → Advanced DNS:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` | `<server-ip>` | Automatic |
| A Record | `www` | `<server-ip>` | Automatic |

Delete any existing parking page records first.

### B2B Domain

B2B uses sslip.io by default (no DNS setup needed). When you register a B2B domain:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` or subdomain | `<server-ip>` | Automatic |

Wait for DNS propagation (usually <5 min):
```bash
dig fbardirect.com
dig www.fbardirect.com
```

> **Note:** If using Cloudflare for any domain, set proxy status to "DNS only" (grey cloud) so Caddy can provision TLS certificates directly.

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
#   B2B_DOMAIN=b2b.178-156-250-116.sslip.io   (or real domain when ready)
#   D2C_DOMAIN=fbardirect.com
#   B2B_NEXTAUTH_URL=https://b2b.178-156-250-116.sslip.io
#   D2C_NEXTAUTH_URL=https://fbardirect.com
#   ANTHROPIC_API_KEY=sk-ant-your-real-key       (B2B)
#   D2C_ANTHROPIC_API_KEY=sk-ant-your-real-key   (D2C)
#   D2C_STRIPE_SECRET_KEY=sk_live_...
#   D2C_STRIPE_WEBHOOK_SECRET=whsec_...
#   D2C_RESEND_API_KEY=re_...
#   D2C_RESEND_FROM_EMAIL=noreply@fbardirect.com
```

### Resend Email Setup (D2C)

D2C sends transactional emails (password reset, filing confirmation) via [Resend](https://resend.com).

1. Create account at [resend.com](https://resend.com)
2. Dashboard → Domains → Add Domain → `fbardirect.com`
3. Add the DNS records Resend provides to Namecheap (Advanced DNS):
   - Typically 2-3 TXT/CNAME records for DKIM, SPF, and DMARC
   - Wait for "Verified" status in Resend dashboard
4. Dashboard → API Keys → Create Key (scope to `fbardirect.com`)
5. Set `D2C_RESEND_API_KEY` and `D2C_RESEND_FROM_EMAIL` in `.env`

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
# D2C app responds
curl -s https://fbardirect.com/api/health

# www redirects to bare domain
curl -sI https://www.fbardirect.com/ | grep -i location
# Expected: location: https://fbardirect.com/

# B2B app responds
curl -s https://b2b.178-156-250-116.sslip.io/api/health

# Both should have valid TLS certs
curl -vI https://fbardirect.com 2>&1 | grep "SSL certificate"
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
| `fbardirect.com` (Namecheap) | ~$10-13/yr |
| TLS certificates | Free (Let's Encrypt via Caddy) |
| Resend email | Free tier (100 emails/day) or $20/mo |
| **Total** | **~$5-25/mo** |

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

---

## Tech Stack Reference

**Last updated**: 2026-02-19

### D2C App (`d2c/`)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js 22 Alpine | Docker base image |
| Framework | Next.js (App Router) | 14.2.21 |
| Language | TypeScript | 5.7.0 |
| React | React + React DOM | 18.3.1 |
| ORM | Prisma | 6.2.0 |
| Database | PostgreSQL 16 | `fbar_direct` |
| Auth | NextAuth v5 (beta.25) | JWT strategy, Credentials provider |
| Password hashing | bcryptjs | 2.4.3 |
| Field encryption | AES-256-GCM (app-level) | TIN + account numbers |
| CSRF | Custom `X-Requested-With` header | Middleware-enforced |
| Rate limiting | In-memory (middleware) + Caddy (edge) | Dual-layer |
| Payments | Stripe Checkout | 17.0.0 |
| Email | Resend | 4.0.0 |
| LLM extraction | Anthropic Claude SDK | 0.75.0 |
| FinCEN XML | fast-xml-parser | 4.5.1 |
| SFTP (BSA E-Filing) | ssh2 | 1.16.0 |
| PDF generation | jsPDF | 2.5.2 |
| Spreadsheet parsing | xlsx | 0.18.5 |
| CSS | Tailwind CSS | 3.4.17 |
| Class utilities | clsx + tailwind-merge + CVA | 2.1.1 / 2.6.0 / 0.7.1 |
| Icons | Lucide React | 0.564.0 |
| Blog/marketing | MDX (@mdx-js + @next/mdx) | 3.1.1 / 16.1.6 |
| Validation | Zod | 3.24.1 |
| E2E tests | Playwright | 1.58.2 |
| A11y tests | axe-core/playwright | 4.11.1 |
| Unit tests | Vitest | 2.1.0 |

**Pricing tiers**: Basic $59 (manual entry) / Premium $79 (AI extraction). Config: `d2c/src/lib/pricing.ts`

### B2B App (`src/`)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js 20 Alpine | Docker base image |
| Framework | Next.js (App Router) | 14.2.21 |
| Language | TypeScript | 5.7.0 |
| React | React + React DOM | 18.3.1 |
| ORM | Prisma | 6.2.0 |
| Database | PostgreSQL 16 | `fbar_automator` |
| UI components | Radix UI (dialog, dropdown, select, tabs, toast) | Various |
| PDF rendering | @react-pdf/renderer + react-pdf | 4.1.6 / 9.2.1 |
| CSV parsing | PapaParse | 5.4.1 |
| Job queue | BullMQ | 5.34.0 |
| Redis client | ioredis | 5.4.2 |
| LLM extraction | Anthropic Claude SDK | 0.39.0 |
| Email | Resend | 6.9.2 |
| File upload UI | react-dropzone | 14.3.5 |

**Shared deps**: Prisma 6.2.0, Zod 3.24.1, fast-xml-parser 4.5.1, xlsx 0.18.5, @aws-sdk/client-s3 3.700.0, bcryptjs 2.4.3, NextAuth 5.0.0-beta.25, Tailwind 3.4.17.

### Known Gaps (as of 2026-02-19)

#### Blocking (cannot accept real filings without these)

| # | Gap | Details |
|---|---|---|
| 1 | **FinCEN XML generation** | `d2c/src/lib/fincen-xml.ts` returns `<!-- STUB -->`. Port from `src/lib/export/fincen-xml.ts` (B2B). Hardest item — must adapt to D2C Prisma schema. |
| 2 | **Treasury exchange rates** | `d2c/src/lib/treasury.ts` — all 4 functions return empty/null. Port from `src/lib/treasury.ts` (B2B). Required for USD conversion on FBAR. |
| 3 | **Stripe live keys + webhook** | Need `sk_live_...` and `whsec_...` in prod `.env`. Must register `https://fbardirect.com/api/stripe/webhook` in Stripe dashboard. |
| 4 | **Next.js CVE-2025-55184** | 14.2.21 → needs ≥14.2.35. DoS vulnerability — malformed request crashes Node process. |
| 5 | **SDTM SFTP credentials** | Need FinCEN BSA E-Filing account: `SDTM_HOST`, `SDTM_USERNAME`, `SDTM_PRIVATE_KEY_PATH`. Set `SDTM_SANDBOX_MODE=false` for live. |

#### High (significant risk or broken functionality)

| # | Gap | Details |
|---|---|---|
| 6 | **FinCEN submission triggered from browser** | Confirmation page `useEffect` calls `POST /api/sdtm/submit`. If user closes browser after payment, filing stays at PAID forever. Should be a Stripe webhook callback or background job. |
| 7 | **Open redirect via `callbackUrl`** | `d2c/src/app/(auth)/login/page.tsx:32` — `router.push(callbackUrl)` with no validation. Attacker can craft `?callbackUrl=https://evil.com`. One-line fix: validate starts with `/` and not `//`. |
| 8 | **S3 presigned URLs broken in prod** | `S3_PUBLIC_ENDPOINT` missing from `.env.unified.example` and `docker-compose.prod.yml`. Presigned URLs use internal `http://minio:9000` which is unreachable from browser. Document downloads will fail. |
| 9 | **SDTM host key verification skipped** | `SDTM_HOST_KEY` referenced in `sdtm.ts:32` but missing from both env templates and compose. Without it, SFTP runs without host verification (MITM risk). |

#### Medium (should fix before public launch)

| # | Gap | Details |
|---|---|---|
| 10 | **MFA / 2FA** | No second factor. FTC Safeguards Rule (16 CFR Part 314) requires MFA for financial data handlers. |
| 11 | **JWT revocation non-functional** | `auth.ts:63` — `maxAge: 30 days`. `tokenVersion` is set but never re-checked (Edge runtime can't access Prisma). After password reset, old sessions stay valid 30 days. Reduce `maxAge` to 1–7 days or add blocklist. |
| 12 | **No encryption key rotation** | `encryption.ts` — ciphertext format `iv:authTag:ciphertext` has no key version prefix. Rotating `ENCRYPTION_KEY` makes all stored TINs/account numbers undecryptable. `safeDecrypt` silently returns empty string. |
| 13 | **CSRF exempts all `/api/auth/*`** | `middleware.ts:122` — blanket exemption includes `forgot-password`. Cross-site POST to forgot-password triggers password reset email (rate-limited to 5/min, so limited severity). |
| 14 | **BSA-ID confirmation email requires user to revisit** | `sendConfirmationEmail` only fires when user polls `GET /api/sdtm/status`. No background ack checker. If FinCEN takes days, user must revisit to trigger the email. |
| 15 | **Drawn signatures not in Form 114a PDF** | `form114a.ts:91` — drawn signatures show `[Digital signature on file]` text instead of embedding the canvas image. Typed signatures work correctly. |
| 16 | **Test route in production codebase** | `api/test/reset-lockout/route.ts` — guarded by `NODE_ENV === "production"` check, but should be removed from prod source entirely. |

#### Low (post-launch / nice-to-have)

| # | Gap | Details |
|---|---|---|
| 17 | **GTM/GA4 disabled in prod** | `NEXT_PUBLIC_GTM_ID`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` missing from `.env.unified.example` and compose. GTM is a build-time var (needs `build.args`, not just `environment`). Analytics silently disabled. |
| 18 | **`xlsx` package abandoned** | v0.18.5 is last OSS release (2023). No security patches on npm. Processes user-uploaded bank statements. Consider replacing with `exceljs`. |
| 19 | **In-memory rate limiter resets on restart** | `middleware.ts:9` — `Map`-based store. All counters reset on deploy/restart. Caddy rate limiting at edge partially mitigates. Fine for single-instance MVP. |
| 20 | **Blog placeholder** | `(marketing)/blog/page.tsx` shows "Articles coming soon". MDX infrastructure exists but zero articles published. |
| 21 | **`X-XSS-Protection` header deprecated** | `Caddyfile.prod:88` — this header is removed from browser standards and can introduce XSS in old IE. Should be deleted. |
| 22 | **No welcome/signup email** | Users create accounts with no email confirmation. Not a security issue (password reset verifies email) but a UX gap. |

#### Resolved

| # | Gap | Status |
|---|---|---|
| ~~R1~~ | ~~Resend env var naming~~ | Fixed — compose maps `D2C_RESEND_API_KEY` → `RESEND_API_KEY` |
| ~~R2~~ | ~~`fbardirect.com` sender domain~~ | Done — verified in Resend (DKIM + SPF) |
| ~~R3~~ | ~~Resend API key~~ | Done — deployed to prod `.env`, D2C restarted |
