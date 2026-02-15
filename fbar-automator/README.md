# FBAR Automator - Automated Foreign Bank Account Report Processing

FBAR Automator is a comprehensive SaaS platform designed for tax and accounting practices to automate the processing of foreign bank statements into FBAR-ready data for FinCEN Form 114 filing. The platform leverages AI-powered document extraction to transform multi-format bank statements into compliant XML exports for BSA E-Filing.

## 🎯 Platform Purpose

FBAR Automator helps tax and accounting professionals:
- **Automate bank statement extraction** using Claude AI for multi-format document processing
- **Eliminate manual data entry** for foreign account reporting requirements
- **Generate FinCEN-compliant XML** ready for BSA E-Filing System submission
- **Streamline client workflow** with multi-tenant practice and client management
- **Ensure compliance** with SOC 2 audit logging and role-based access controls
- **Export professional workpapers** in CSV and PDF formats for client records

---

## 📱 Key Features

### **AI-Powered Extraction**
- **Multi-Format Support**: PDF, JPEG, PNG, and TIFF bank statement uploads
- **Claude AI Integration**: Automated extraction of account holder, institution, account numbers, and maximum values
- **Async Job Processing**: BullMQ-powered background extraction with Redis queue management
- **Intelligent Parsing**: Handles complex foreign bank statement layouts and multi-language documents

### **Multi-Tenant Architecture**
- **Practice Management**: Isolated practices with separate users and clients
- **Client Management**: INDIVIDUAL and ENTITY client types with encrypted TIN/EIN storage
- **Account Tracking**: Unlimited foreign accounts per client with full metadata
- **Filing Management**: Track filing years and account ownership percentages

### **Workflow Automation**
- **Status Tracking**: NOT_STARTED → IN_PROGRESS → REVIEWED → EXPORTED → FILED
- **Role-Based Access**: ADMIN, PREPARER, and REVIEWER roles with granular permissions
- **Approval System**: Multi-level review and approval workflow for quality assurance
- **Audit Logging**: SOC 2 compliant comprehensive activity logging

### **Export Capabilities**
- **FinCEN XML**: BSA E-Filing System compliant XML with Form 114 structure
- **CSV Workpapers**: Client-ready reports with masked TINs and account summaries
- **PDF Reports**: Professional PDF workpapers via @react-pdf/renderer
- **Automated Currency Conversion**: Treasury API integration for real-time FX rates

### **Security & Compliance**
- **Encryption at Rest**: AES-256-GCM encryption for TIN/EIN data with unique salts
- **JWT-Based Auth**: NextAuth v5 with secure session management
- **Rate Limiting**: Protection against brute force and API abuse
- **S3 Document Storage**: Secure, scalable document storage with presigned URLs
- **HTTPS Enforcement**: Strict transport security and secure headers

---

## 🛠️ Technical Stack

### **Backend Technology**
- **Framework**: Next.js 14 with App Router and Server Components
- **Language**: TypeScript 5.7
- **Database**: PostgreSQL 16 with Prisma ORM v6
- **Queue**: Redis 7 + BullMQ for async job processing
- **Storage**: S3-compatible (MinIO for development, AWS S3 for production)
- **AI**: Anthropic Claude API for document extraction
- **Authentication**: NextAuth v5 with JWT sessions
- **API**: Next.js App Router API routes with RESTful design

### **Frontend Technology**
- **Framework**: React 18 with Server Components
- **UI Components**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom utility classes
- **Icons**: Lucide React icon library
- **Forms**: React Hook Form with Zod validation
- **PDF Viewing**: react-pdf for client-side PDF preview
- **File Upload**: react-dropzone for drag-and-drop uploads

### **Key Libraries**
- **PDF Generation**: @react-pdf/renderer for professional workpapers
- **XML Processing**: fast-xml-parser for FinCEN XML generation
- **Currency**: Decimal.js for precise financial calculations
- **Encryption**: Node.js crypto module with AES-256-GCM
- **Testing**: Vitest for unit/integration tests, Playwright for E2E

---

## 📁 Project Structure

```
fbar-automator/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   │   ├── api/          # RESTful API endpoints
│   │   ├── dashboard/    # Main dashboard UI
│   │   ├── practices/    # Practice management
│   │   ├── clients/      # Client management
│   │   ├── accounts/     # Account management
│   │   └── login/        # Authentication pages
│   ├── lib/              # Shared utilities
│   │   ├── auth.ts       # NextAuth configuration
│   │   ├── db.ts         # Prisma client singleton
│   │   ├── encryption.ts # AES-256-GCM TIN encryption
│   │   ├── s3.ts         # S3 client configuration
│   │   ├── queue.ts      # BullMQ queue setup
│   │   ├── currency.ts   # Treasury API FX rates
│   │   ├── validation.ts # Zod schemas
│   │   └── export/       # Export generators
│   │       ├── csv.ts    # CSV workpaper generation
│   │       ├── xml.ts    # FinCEN XML generation
│   │       └── pdf.ts    # PDF workpaper generation
│   ├── workers/          # Background job processors
│   │   └── extract.ts    # BullMQ extraction worker
│   ├── components/       # React UI components
│   │   └── ui/           # Radix UI components
│   └── types/            # TypeScript type definitions
├── prisma/               # Database schema & migrations
│   ├── schema.prisma     # Prisma data model
│   ├── migrations/       # SQL migration files
│   └── seed.ts           # Demo data seeding
├── tests/                # Test suites
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docker-compose.yml    # Development environment
├── docker-compose.prod.yml # Production deployment
├── Dockerfile            # Multi-stage Docker build
└── nginx.conf            # Nginx reverse proxy config
```

---

## 🚀 Quick Start (Docker)

The fastest way to get started is using Docker Compose to run all services:

```bash
# 1. Clone and navigate to the project
cd fbar-automator

# 2. Copy environment template and configure
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)

# 3. Start all services (app, PostgreSQL, Redis, MinIO)
docker compose up -d

# 4. Run database migrations
docker compose exec app npx prisma migrate deploy

# 5. Seed demo data (optional)
docker compose exec app npx prisma db seed

# 6. Access the application
open http://localhost:3000

# 7. Login with demo credentials (if seeded)
# Email: admin@demo.com
# Password: admin123
```

### Verify Services

```bash
# Check all containers are running
docker compose ps

# View application logs
docker compose logs -f app

# View worker logs
docker compose logs -f app

# Access MinIO console (S3 storage)
open http://localhost:9001
```

---

## 💻 Development Setup (Local)

For local development without Docker:

### Prerequisites
- Node.js 20+ (LTS recommended)
- PostgreSQL 16+
- Redis 7+
- MinIO or AWS S3 access
- Anthropic API key

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure services (PostgreSQL, Redis, MinIO)
docker compose up -d postgres redis minio

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed demo data (optional)
npm run db:seed

# 6. Start development server
npm run dev

# 7. In a separate terminal, start the extraction worker
npm run worker
```

The application will be available at `http://localhost:3000`.

### Development Commands

```bash
# Database operations
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations (dev)
npm run db:push        # Push schema changes (prototype)
npm run db:seed        # Seed demo data
npm run db:studio      # Open Prisma Studio (GUI)

# Development
npm run dev            # Start Next.js dev server
npm run worker         # Start extraction worker

# Testing
npm test               # Run unit/integration tests (Vitest)
npm run test:e2e       # Run E2E tests (Playwright)

# Build & Production
npm run build          # Build for production
npm run start          # Start production server
npm run lint           # Run ESLint
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### **Database (PostgreSQL)**
```bash
POSTGRES_USER=fbar                      # PostgreSQL username
POSTGRES_PASSWORD=fbar_local_dev        # PostgreSQL password (change in production!)
POSTGRES_DB=fbar_automator              # Database name
DATABASE_URL=postgresql://fbar:fbar_local_dev@postgres:5432/fbar_automator
```

### **Storage (S3/MinIO)**
```bash
S3_ENDPOINT=http://minio:9000           # MinIO endpoint (or AWS S3 endpoint)
S3_ACCESS_KEY=minioadmin                # S3 access key (change in production!)
S3_SECRET_KEY=minioadmin                # S3 secret key (change in production!)
S3_BUCKET=fbar-statements               # S3 bucket name
S3_REGION=us-east-1                     # S3 region
```

### **Queue (Redis)**
```bash
REDIS_URL=redis://redis:6379            # Redis connection URL
```

### **Authentication (NextAuth)**
```bash
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=change-me-in-production-use-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000      # Application base URL
```

### **AI Extraction (Anthropic)**
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Required: Claude API key from console.anthropic.com
```

### **Encryption**
```bash
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=change-me-use-openssl-rand-hex-32  # Required: AES-256 encryption key for TIN/EIN
```

### **Optional Services**
```bash
OPENAI_API_KEY=                         # Optional: Fallback AI provider
RESEND_API_KEY=                         # Optional: Email notifications
```

### **Production Notes**
- **NEVER** commit `.env` to version control
- Use strong random values for all secrets in production
- Rotate encryption keys and database passwords regularly
- Use environment variable management (AWS Secrets Manager, etc.)

---

## 🧪 Testing

The project includes comprehensive test coverage with unit, integration, and E2E tests.

### Run Tests

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npx vitest

# Run tests with coverage report
npx vitest run --coverage

# Run E2E tests (Playwright)
npm run test:e2e

# Run E2E tests with UI
npx playwright test --ui
```

### Test Structure

```
tests/
├── unit/                      # Unit tests (fast, isolated)
│   ├── validation.test.ts     # Zod schema validation
│   ├── currency.test.ts       # Currency conversion logic
│   ├── csv-export.test.ts     # CSV generation
│   ├── fincen-xml.test.ts     # FinCEN XML generation
│   └── approval.test.ts       # Approval workflow logic
├── integration/               # Integration tests (slower, cross-module)
│   ├── extraction-pipeline.test.ts   # Full extraction workflow
│   ├── export-pipeline.test.ts       # Export generation workflow
│   └── review-workflow.test.ts       # Review/approval workflow
└── e2e/                       # End-to-end tests (Playwright)
    └── (future tests)
```

### Current Test Coverage

- **Test Files**: 8 (5 passing, 3 with known failures)
- **Tests**: 129 total (103 passing, 26 known failures)
- **Coverage**: Core business logic and validation fully tested
- **Known Issues**: Some export pipeline tests fail due to encryption setup requirements

---

## 🏗️ Architecture

### System Overview

FBAR Automator uses a modern, scalable architecture designed for SaaS multi-tenancy:

1. **Next.js App Router**: Server Components for UI, API routes for backend logic
2. **PostgreSQL Database**: Relational data with Prisma ORM for type-safe queries
3. **Redis + BullMQ**: Async job queue for long-running AI extraction tasks
4. **S3 Storage**: Scalable document storage with presigned URLs for secure access
5. **Claude API**: AI-powered extraction of structured data from unstructured documents
6. **JWT Authentication**: Stateless session management with NextAuth v5

### Data Flow

```
User Upload → S3 Storage → BullMQ Job → Claude Extraction → PostgreSQL → Export (CSV/XML/PDF)
     ↓                           ↓                ↓                ↓
  Next.js UI ←─── Redis Queue ←─── Worker ←─── Validation ←─── Review Workflow
```

### Multi-Tenancy

- **Practice Isolation**: Each practice has separate users, clients, and accounts
- **Row-Level Security**: Database queries filtered by practice ID
- **S3 Key Prefixing**: Documents organized by practice and client
- **Encryption Isolation**: Unique encryption salts per TIN/EIN

### Security Architecture

- **Encryption at Rest**: AES-256-GCM for sensitive PII (TIN/EIN)
- **Transport Security**: HTTPS enforced, HSTS headers, CSP
- **Authentication**: JWT sessions, bcrypt password hashing
- **Authorization**: Role-based access control (ADMIN, PREPARER, REVIEWER)
- **Rate Limiting**: API and login endpoint protection
- **Audit Logging**: Comprehensive activity tracking for compliance

---

## 📊 Current Status

### ✅ Completed Features (Sprints 1-5)

- ✅ **Multi-tenant practice and client management**
- ✅ **Foreign account tracking with full metadata**
- ✅ **AI-powered bank statement extraction (Claude)**
- ✅ **Async job processing with BullMQ + Redis**
- ✅ **S3 document storage with presigned URLs**
- ✅ **CSV and FinCEN XML export generation**
- ✅ **PDF workpaper generation**
- ✅ **Review and approval workflow**
- ✅ **Role-based access control (RBAC)**
- ✅ **AES-256-GCM encryption for TIN/EIN**
- ✅ **SOC 2 compliant audit logging**
- ✅ **Rate limiting and security hardening**
- ✅ **Docker development and production environments**
- ✅ **Comprehensive test coverage (129+ tests)**

### ⚠️ Known Limitations

- **No Multi-Factor Authentication (MFA)**: Single-factor JWT authentication only
- **No Structured Logging**: Console logging, not centralized (Datadog/Splunk)
- **CSRF Protection**: Relies on NextAuth defaults, no custom CSRF tokens
- **No Monitoring**: No APM (Application Performance Monitoring) integration
- **Limited Email**: No automated email notifications for workflow events
- **Test Failures**: 26 export pipeline tests fail due to encryption setup issues

### 🚧 Future Enhancements

- **Payment Processing**: Stripe integration for per-filing or subscription billing
- **Email Notifications**: Automated alerts for extraction completion, review needed, filing deadlines
- **Advanced Reporting**: Dashboard analytics, filing trends, client activity
- **Mobile App**: React Native companion app for on-the-go access
- **API Documentation**: OpenAPI/Swagger for third-party integrations
- **White-Label**: Custom branding for large accounting firms

---

## 🚢 Production Deployment

### Docker Production Build

```bash
# Build and run production stack
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# The production stack includes:
# - Nginx reverse proxy with rate limiting
# - Next.js app (read-only filesystem)
# - BullMQ worker (separate container)
# - PostgreSQL with optimized config
# - Redis with persistence
```

### Production Environment Checklist

- [ ] Set strong `NEXTAUTH_SECRET` (32+ bytes random)
- [ ] Set strong `ENCRYPTION_KEY` (32 bytes hex)
- [ ] Use strong PostgreSQL password
- [ ] Configure Redis password in production compose
- [ ] Use AWS S3 (not MinIO) for production storage
- [ ] Configure SSL/TLS certificates for HTTPS
- [ ] Enable PostgreSQL SSL connections
- [ ] Set up automated database backups
- [ ] Configure monitoring and alerting
- [ ] Review and adjust rate limiting rules
- [ ] Set up log aggregation (CloudWatch, Datadog, etc.)
- [ ] Configure CDN (CloudFront) for static assets
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Seed initial admin user or create via UI

### Platform Deployment Options

**Docker Self-Hosted**
```bash
# Use docker-compose.prod.yml for full-stack deployment
docker compose -f docker-compose.prod.yml up -d
```

**Railway / Fly.io**
```bash
# Use Dockerfile directly (single container)
# Set environment variables in platform dashboard
# Connect to managed PostgreSQL and Redis
```

**AWS / GCP / Azure**
```bash
# Deploy as container (ECS, Cloud Run, Container Instances)
# Use managed services (RDS, ElastiCache, S3)
# Configure VPC networking and security groups
```

---

## 📞 Contact & Support

For technical questions, business inquiries, or support:

- **Email**: 1mattcohen@gmail.com
- **Platform**: Built with modern web technologies for scalability and performance
- **License**: Private - All Rights Reserved

---

## 🔄 Development Workflow

### Git Workflow
```bash
# Feature branches
git checkout -b feature/your-feature-name

# Commit with conventional commits
git commit -m "feat: add currency conversion caching"
git commit -m "fix: resolve TIN decryption issue"

# Push and create PR
git push origin feature/your-feature-name
```

### Code Style
- **TypeScript**: Strict mode enabled, no implicit any
- **Formatting**: ESLint + Prettier (via Next.js config)
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Files**: Lowercase with hyphens (e.g., `csv-export.ts`)

### Database Migrations
```bash
# Create migration (development)
npx prisma migrate dev --name add_filing_year_field

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

*Last Updated: February 2026 - FBAR Automator SaaS Platform*
