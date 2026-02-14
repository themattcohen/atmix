# FBAR Automator - Session Continuity Guide

**Purpose**: Everything needed to resume work on the FBAR Automator project after a session break.
**Last Updated**: 2026-02-13 22:15 MST
**Project Root**: `/Users/matt/atmix/fbar-automator/`

---

## Quick Start

### Resume Development
```bash
cd /Users/matt/atmix/fbar-automator
docker compose up -d          # Start all 4 containers
npm run dev                   # Start Next.js dev server (optional)
```

### Check System Health
```bash
docker compose ps             # All 4 containers should be "running"
curl http://localhost:3000/api/health  # Should return 200 OK
```

### Access the App
- **URL**: http://localhost:3000
- **Admin Login**: admin@demo.com / admin123
- **Test Client**: ID `655eeb60-ab8c-4144-898a-a03c82a9cc6b`, Filing Year `2025`

### Stop Everything
```bash
docker compose down           # Stop all containers (preserves data)
docker compose down -v        # Stop and DELETE all data (nuclear option)
```

---

## Project Structure

### Key Directories
```
fbar-automator/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/          # Login page
│   │   ├── (dashboard)/     # Main app (clients, upload, review)
│   │   └── api/             # API routes (REST endpoints)
│   ├── components/          # React components
│   │   ├── layout/          # Sidebar, Header
│   │   ├── review/          # DocumentViewer, ReviewForm
│   │   └── upload/          # UploadSection, FileDropzone
│   ├── lib/                 # Business logic (NOT React)
│   │   ├── approval.ts      # Filing workflow state machine
│   │   ├── extraction.ts    # Claude API integration
│   │   ├── queue.ts         # BullMQ job processing
│   │   ├── s3.ts            # MinIO/S3 file storage
│   │   └── db.ts            # Prisma client singleton
│   ├── types/               # TypeScript type definitions
│   └── workers/             # Background job processors
├── prisma/
│   ├── schema.prisma        # Database schema (PostgreSQL)
│   ├── migrations/          # DB migrations
│   └── seed.ts              # Demo data seeder
├── public/                  # Static assets (pdf.worker.min.mjs)
├── claudedocs/              # Project documentation (this file)
├── docker-compose.yml       # Local dev infrastructure
├── Dockerfile               # Next.js app containerization
└── package.json             # Dependencies + scripts
```

### Important Files
- `PRD.md` — Product Requirements Document (64KB, very detailed)
- `README.md` — Setup instructions and architecture overview
- `.env` — Environment variables (NOT in git, copy from `.env.example`)
- `next.config.mjs` — Next.js + webpack config (PDF.js setup)

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.7
- **UI**: React 18.3 + Tailwind CSS 3.4 + Radix UI
- **PDF Viewer**: react-pdf 9.2 (pdfjs-dist)
- **Forms**: React Hook Form + Zod validation

### Backend
- **API**: Next.js API routes (serverless functions)
- **Database**: PostgreSQL 16 (via Prisma 6.2)
- **ORM**: Prisma Client (NOT v7 — use v6 for compatibility)
- **File Storage**: MinIO (S3-compatible) via AWS SDK v3
- **Queue**: BullMQ 5.34 (Redis-backed job queue)
- **Authentication**: NextAuth.js v5 (beta.25)

### AI/LLM
- **Primary**: Anthropic Claude API (Sonnet 4.5)
- **Model**: `claude-sonnet-4-5-20250929`
- **Input**: Base64-encoded PDFs/images via vision API
- **Output**: Structured JSON extraction (bank account data)

### Infrastructure (Local Dev)
- **Containers**: Docker Compose (4 services)
  1. `app` — Next.js app (port 3000)
  2. `postgres` — PostgreSQL 16 (port 5432)
  3. `minio` — S3-compatible storage (ports 9000, 9001)
  4. `redis` — BullMQ backend (port 6379)

---

## Environment Setup

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://fbar:fbar_local_dev@postgres:5432/fbar_automator

# S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=fbar-statements

# Redis
REDIS_URL=redis://redis:6379

# Auth
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# AI
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Copy from template**: `cp .env.example .env` and fill in real values.

---

## Known Gotchas

### 1. Prisma Version
**Issue**: Prisma v7 is out, but this project uses v6 for stability.
**Fix**: Always use `prisma@6` when installing CLI: `npm install -g prisma@6`

**Why v6?**
- Prisma v7 has breaking changes in JSON field handling
- All existing migrations are v6-compatible
- `as unknown as Prisma.InputJsonValue` casts work in v6

### 2. Node Version
**Issue**: Project requires Node 20.18.1 (not 22.x).
**Fix**: Use `nvm use 20.18.1` or add to PATH.

**Why Node 20?**
- Next.js 14 is optimized for Node 20 LTS
- Some dependencies (react-pdf, bcryptjs) have native addons for Node 20

### 3. Docker Build Environment Variables
**Issue**: Docker build fails if `.env` is missing (Next.js tries to load env vars at build time).
**Fix**: Dockerfile includes dummy env vars for build stage:
```dockerfile
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ARG NEXTAUTH_SECRET=dummy
ARG NEXTAUTH_URL=http://localhost:3000
```

**Runtime env vars** are provided by `docker-compose.yml` via `env_file: .env`.

### 4. react-pdf Webpack Configuration
**Issue**: PDF.js worker fails to load without special webpack config.
**Fix**: `next.config.mjs` includes:
```javascript
webpack: (config) => {
  config.module.rules.push({
    test: /\.mjs$/,
    type: 'javascript/auto',
  })
  return config
},
transpilePackages: ['react-pdf'],
```

**Also**: `postinstall` script copies `pdf.worker.min.mjs` to `/public/`.

### 5. Queue Connection Timing
**Issue**: `queue.ts` fails if it tries to connect to Redis at module load time (build fails with ECONNREFUSED).
**Fix**: Lazy connection pattern — Redis client is only created when first job is enqueued:
```typescript
let _extractionQueue: Queue | null = null
function getExtractionQueue(): Queue {
  if (!_extractionQueue) {
    _extractionQueue = new Queue("extraction", {
      connection: getConnection() as any,
    })
  }
  return _extractionQueue
}
```

### 6. Suspense Boundary for useSearchParams
**Issue**: Next.js 14 requires `<Suspense>` around any component using `useSearchParams()`.
**Fix**: Wrap login form in Suspense:
```tsx
<Suspense fallback={<div>Loading...</div>}>
  <LoginForm />
</Suspense>
```

---

## Database Management

### Run Migrations
```bash
npm run db:migrate          # Create and apply migration
npm run db:push             # Push schema without migration (dev only)
```

### Seed Demo Data
```bash
npm run db:seed             # Creates admin user + test client
```

**Demo Data Created**:
- Admin user: admin@demo.com / admin123
- Test practice: "Demo Practice"
- Test client: 655eeb60-ab8c-4144-898a-a03c82a9cc6b
- Filing year: 2025

### View Database
```bash
npm run db:studio           # Opens Prisma Studio at localhost:5555
```

### Reset Database (Nuclear Option)
```bash
docker compose down -v      # Delete all volumes
docker compose up -d        # Recreate containers
npm run db:push             # Push schema
npm run db:seed             # Reseed data
```

---

## Development Workflow

### Local Development (Outside Docker)
```bash
# Start infrastructure only
docker compose up -d postgres minio redis

# Run Next.js dev server locally
npm run dev                 # Starts on localhost:3000

# Run worker process (optional, for background jobs)
npm run worker              # Processes extraction queue
```

**Advantages**:
- Faster hot reload (no Docker layer)
- Easier debugging (console.log visible immediately)
- Direct access to Node process

**Disadvantages**:
- Must manage multiple terminal tabs
- Environment differs from production

### Full Docker Development
```bash
docker compose up -d        # Start all containers
docker compose logs -f app  # Follow app logs
```

**Advantages**:
- Matches production environment exactly
- Single command to start everything

**Disadvantages**:
- Slower hot reload (Docker volume sync)
- Harder to debug (logs in container)

---

## Testing

### Run Unit Tests
```bash
npm test                    # Vitest (watch mode)
npm run test:run            # Vitest (CI mode)
```

### Run E2E Tests
```bash
npm run test:e2e            # Playwright (headless)
npx playwright test --ui    # Playwright (interactive)
```

### Current Test Coverage
- **Unit tests**: ~143 tests passing (as of 2026-02-13)
- **E2E tests**: Basic smoke tests exist
- **Coverage**: ~60% (needs improvement)

---

## What Works / What Doesn't

### ✅ Working Features
1. **Authentication**: Login with NextAuth.js (email/password)
2. **Client Management**: CRUD operations for clients
3. **Document Upload**: Upload PDFs/images to MinIO via `/api/filing-years/[id]/upload`
4. **PDF Extraction**: Claude API extracts bank account data from statements
5. **Document Viewer**: react-pdf renders PDFs in review UI
6. **Database Operations**: Prisma ORM with PostgreSQL
7. **Queue Processing**: BullMQ processes extraction jobs
8. **Docker Build**: Builds successfully with all 4 containers running
9. **Health Endpoint**: `/api/health` returns 200 OK

### 🔧 Partially Working
1. **Account Review**: Can view extracted data, but approval API has payload issues
2. **Filing Workflow**: Status transitions exist in DB but missing API routes

### ❌ Not Working (As of 2026-02-13)
1. **Submit for Review**: Missing `/api/filing-years/[id]/submit` route
2. **Approve for Export**: Missing `/api/filing-years/[id]/approve` route
3. **Mark as Filed**: Missing `/api/filing-years/[id]/filed` route
4. **Account Approval**: Payload mismatch (wrong URL, missing fields)

### 🚧 Not Implemented
1. **FBAR XML Export**: Business logic exists, but UI/API not wired up
2. **CSV Export**: Planned but not implemented
3. **PDF Report Export**: Planned but not implemented
4. **Email Notifications**: Resend integration exists but not used
5. **MFA**: NextAuth.js supports it but not enabled
6. **SOC 2 Logging**: Audit logs exist but no dashboard
7. **Treasury Rate Sync**: ExchangeRate table exists but no sync job

---

## Filing Lifecycle State Machine

```
NOT_STARTED → IN_PROGRESS → REVIEWED → EXPORTED → FILED
     ↑            ↓             ↓          ↓
     └──────── REOPEN ←────────┴──────────┘
```

**Transitions** (from `src/lib/approval.ts`):
1. `submitForReview()` — IN_PROGRESS → REVIEWED (all accounts must be reviewed)
2. `approveForExport()` — REVIEWED → EXPORTED (ADMIN/REVIEWER only)
3. `markAsFiled()` — EXPORTED → FILED (final state)
4. `reopenFiling()` — REVIEWED/EXPORTED → IN_PROGRESS (for corrections)

**Business Rules**:
- Cannot skip states (must go through each in order)
- Cannot reopen FILED filings (must create amendment instead)
- Only ADMIN/REVIEWER can approve for export
- All active accounts must be reviewed before submitting

---

## Common Commands

### Docker
```bash
docker compose ps                    # Check container status
docker compose logs -f app           # Follow app logs
docker compose restart app           # Restart app container
docker compose exec postgres psql -U fbar -d fbar_automator  # Open psql
docker compose exec redis redis-cli  # Open Redis CLI
```

### Database
```bash
npm run db:studio          # GUI for database
npm run db:generate        # Regenerate Prisma client
npm run db:migrate         # Create new migration
npm run db:push            # Push schema without migration
npm run db:seed            # Seed demo data
```

### Development
```bash
npm run dev                # Start dev server (local)
npm run build              # Build production bundle
npm run start              # Run production build
npm run lint               # ESLint
npm run worker             # Start BullMQ worker
```

---

## Debugging Tips

### Check Queue Status
```bash
docker compose exec redis redis-cli
> KEYS *                   # List all Redis keys
> LLEN bull:extraction:waiting  # Check waiting jobs
> LLEN bull:extraction:active   # Check active jobs
> LLEN bull:extraction:failed   # Check failed jobs
```

### View Extraction Job Data
```bash
# In Redis CLI
> HGETALL bull:extraction:extract-<statementId>
```

### Check S3/MinIO Buckets
- **MinIO Console**: http://localhost:9001
- **Login**: minioadmin / minioadmin
- **Bucket**: `fbar-statements`

### View Database Records
```bash
npm run db:studio          # Opens Prisma Studio
# Or use psql:
docker compose exec postgres psql -U fbar -d fbar_automator
```

### Check App Logs
```bash
docker compose logs -f app
# Or if running locally:
npm run dev  # Logs to stdout
```

---

## Agent Teams Enabled

**Status**: ✅ Enabled in Claude Code settings
**Config File**: `~/.claude/settings.json`
```json
{
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
}
```

**What This Means**:
- Main session should act as **coordinator only**
- Dispatch parallel agent teams for multi-file tasks
- Never work solo on features spanning >2 files
- Plan → Delegate → Synthesize workflow

---

## Session Lifecycle

### Start of Session
1. `cd /Users/matt/atmix/fbar-automator`
2. `docker compose up -d` (start all containers)
3. Check health: `curl http://localhost:3000/api/health`
4. Review latest docs: `cat claudedocs/*.md`
5. Check git status: `git status && git branch`

### During Session
1. Create feature branch if needed: `git checkout -b feature/xyz`
2. Make changes, test locally
3. Commit incrementally: `git add <files> && git commit -m "..."`
4. Document decisions in `claudedocs/` if significant

### End of Session
1. Commit all work: `git add . && git commit -m "WIP: ..."`
2. Update this file if new gotchas discovered
3. Stop containers: `docker compose down` (preserves data)
4. Push to remote: `git push origin <branch>` (optional)

---

## Related Documentation

- **PRD**: `/Users/matt/atmix/fbar-automator/PRD.md` — Product requirements (64KB)
- **README**: `/Users/matt/atmix/fbar-automator/README.md` — Setup instructions
- **Findings**: `claudedocs/findings-2026-02-13.md` — Bug report from smoke testing
- **App Status**: `claudedocs/app-status.md` — Feature-by-feature status

---

**Guide Last Updated**: 2026-02-13 22:15 MST
**Next Review**: After Phase 2 fixes complete
**Maintainer**: Claude Code sessions
