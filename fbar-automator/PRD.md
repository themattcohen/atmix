# FBAR Automator: Product Requirements Document

**Version**: 1.0
**Date**: February 13, 2026
**Status**: Draft for Founder Review

---

## Table of Contents

1. [Product Vision and Positioning](#1-product-vision-and-positioning)
2. [User Personas and Jobs to Be Done](#2-user-personas-and-jobs-to-be-done)
3. [Core Feature Set (MVP)](#3-core-feature-set-mvp)
4. [Data Model](#4-data-model)
5. [Technical Architecture](#5-technical-architecture)
6. [LLM Prompt Engineering](#6-llm-prompt-engineering)
7. [Treasury Exchange Rate Integration](#7-treasury-exchange-rate-integration)
8. [Workflow and UX](#8-workflow-and-ux)
9. [Pricing Model](#9-pricing-model)
10. [Go-to-Market](#10-go-to-market)
11. [Regulatory and Compliance Considerations](#11-regulatory-and-compliance-considerations)
12. [Risks and Open Questions](#12-risks-and-open-questions)
13. [Success Metrics](#13-success-metrics)
14. [Roadmap](#14-roadmap)

---

## 1. Product Vision and Positioning

### Vision

FBAR Automator is a SaaS tool that converts foreign bank statements in any language, format, or layout into structured, FBAR-ready data using vision-capable LLMs. It eliminates the manual bottleneck between "client hands over bank statements" and "preparer has the data needed to file FinCEN Form 114."

### Where It Fits in the Tax Preparation Workflow

The FBAR filing workflow has three stages:

1. **Data acquisition**: Client provides foreign bank statements (PDFs, scans, photos)
2. **Data extraction and conversion**: Preparer reads statements, identifies max balances, looks up exchange rates, converts to USD
3. **Filing**: Preparer enters data into tax software or BSA E-Filing system and submits to FinCEN

FBAR Automator owns stage 2 entirely and bridges stages 1 and 3. It accepts the raw documents from stage 1 and outputs structured data ready for stage 3.

### What This Product Is NOT

- **Not a filing tool.** It does not submit FBARs to FinCEN. It prepares the data that goes into filing tools.
- **Not a tax preparation suite.** It does not prepare tax returns, Form 8938, or any other IRS forms.
- **Not a general document OCR platform.** It is purpose-built for the FBAR data extraction workflow and does not attempt to be a generic bank statement parser.
- **Not legal or tax advice.** It is a data extraction and conversion tool. Professional judgment remains with the preparer.

### Competitive Positioning

| Category | Examples | What They Do | What They Don't Do |
|----------|----------|-------------|-------------------|
| FBAR filing tools | MyExpatTaxes, Expatfile, Inkle | Streamline form completion and e-filing | Extract data from bank statements |
| Generic bank statement OCR | Veryfi, Parseur, Ocrolus, Nanonets | Extract transactions and balances from statements | Identify FBAR-specific fields (max value, account type), convert currencies using Treasury rates, output FinCEN-ready data |
| Professional tax software | Drake, Lacerte, UltraTax, GoSystem | Prepare and e-file FBARs | Import FBAR account data from external sources (all require manual entry) |
| AI document extraction | LandingAI, Reducto, Sensible | Extract structured data from documents | Target tax compliance use cases |

**No product connects foreign bank statements to structured FBAR data.** Every tool in the ecosystem assumes someone has already done the manual extraction. FBAR Automator fills that gap.

---

## 2. User Personas and Jobs to Be Done

### Persona 1: Sarah, Tax Preparer / Senior Associate

**Profile**: 5 years at a 15-person international tax practice. Handles 80-120 FBAR clients per year. Each client has 2-6 foreign accounts across 1-3 countries.

**Current Workflow**:
1. Receives bank statements from client (email, portal, or physical mail)
2. Opens each PDF/scan, identifies the language and bank format
3. Searches each statement for the highest balance (often monthly statements, requiring comparison across 12 documents per account)
4. Notes the currency and amount
5. Looks up Treasury year-end exchange rate on fiscal.treasury.gov
6. Calculates USD equivalent by hand or spreadsheet
7. Manually types account number, bank name, bank address, account type, and max value into Drake/Lacerte
8. Repeats for every account, every client
9. Reviews entries against source documents before filing

**Where Pain Is Worst**: Steps 2-6. Reading foreign-language statements, identifying the right balance figure (not the closing balance, the maximum), and performing currency conversion. For a client with 5 accounts across 3 countries, this takes 45-90 minutes. Multiply by 100 clients = 75-150 hours of tedious, error-prone work in a compressed filing window.

**What "Done" Looks Like**: All client FBAR data is extracted, converted, reviewed, and ready to enter into filing software. Zero rework from data entry errors.

**Trust/Distrust Factors**:
- Trusts: Side-by-side view of source document and extracted data. Confidence indicators on each field. Ability to correct any field. Audit trail showing what was extracted vs. what was changed.
- Distrusts: Black-box output with no visibility into source. No ability to override. Claims of "100% accuracy." Missing fields with no explanation.

### Persona 2: David, Practice Owner / Partner

**Profile**: Founder of a 20-person international tax firm. Manages 300+ FBAR clients. Focused on practice growth, liability management, and staff efficiency.

**Current Workflow**:
1. Assigns FBAR preparation to staff preparers
2. Reviews a sample of completed FBARs for quality
3. Signs off on filings
4. Manages client communications about missing or unclear documents
5. Bears ultimate professional liability for accuracy

**Where Pain Is Worst**: Staff utilization. FBAR prep is low-skill, high-volume work that consumes senior associate time during the busiest months. He cannot hire seasonal staff for this because it requires judgment (reading foreign statements, identifying correct fields). Every hour spent on FBAR data entry is an hour not spent on higher-value advisory work.

**What "Done" Looks Like**: Staff processes FBARs in one-third the time. Error rate drops. He can take on 50 more FBAR clients without adding headcount.

**Trust/Distrust Factors**:
- Trusts: Demonstrable accuracy on a pilot batch of 10-20 real client cases. Clear audit trail for liability protection. SOC 2 compliance or credible security posture. Human-in-the-loop review (not fully automated filing).
- Distrusts: No track record. Vendor that cannot articulate their data handling practices. Tool that removes the preparer from the review process entirely.

### Persona 3: Maria, Expat Client (Taxpayer)

**Profile**: U.S. citizen living in Germany for 8 years. Has a German checking account, a savings account, a brokerage account, and a UK pension from a prior posting. Her husband has two additional accounts in his name.

**Current Workflow**:
1. Downloads or requests bank statements from each institution (some only available in German, one in English)
2. Emails PDFs to her tax preparer
3. Answers follow-up questions ("What type of account is this?", "Is this a joint account?", "Can you get the December statement?")
4. Waits for preparer to process and file
5. Pays $150-300 for FBAR preparation on top of tax return fees

**Where Pain Is Worst**: Gathering statements. Some banks only provide quarterly statements. Some require logging into online portals and downloading PDFs. Follow-up questions from the preparer ("I can't read this, what does 'Kontostand' mean?") add friction and delay.

**What "Done" Looks Like**: Uploads her statements once, answers minimal follow-up questions, FBAR is filed correctly and on time.

**Trust/Distrust Factors**:
- Trusts: Her preparer trusts the tool (she defers to the professional). Fast turnaround. Fewer back-and-forth emails.
- Distrusts: Being asked to use yet another portal. Concerns about uploading sensitive financial documents to an unknown service.

---

## 3. Core Feature Set (MVP)

### 3.1 Document Upload and Processing

**Accepted Formats**: PDF, JPEG, PNG, HEIC, TIFF. Scanned documents and photos of paper statements.

**Batch Upload**: Upload multiple files per client, multiple clients per session. Drag-and-drop or file picker. Support ZIP archives containing multiple statements.

**Language and Format Support**: Any language, any country, any bank. The system uses vision-capable LLMs (not traditional OCR), so it handles:
- Non-Latin scripts (Chinese, Japanese, Korean, Arabic, Hebrew, Cyrillic, Thai, Devanagari)
- Unusual layouts (vertical text, multi-column, decorative formatting)
- Poor scan quality (faded, skewed, low-resolution)
- Watermarked or redacted documents (flags fields it cannot read)

**Extraction Targets** (per statement):
- Bank/institution name
- Bank mailing address (street, city, state/province, country, postal code)
- Account number
- Account type (bank/deposit, securities, other) with description
- Currency
- All balance figures present on the statement (opening, closing, daily/monthly if shown)
- Maximum balance identified from the statement
- Statement date range (period covered)

**Multi-Page Handling**: Statements spanning multiple pages are treated as a single document. The system identifies page continuations and does not double-count accounts.

**Multi-Account Documents**: Some statements contain multiple accounts (e.g., a single PDF from a bank showing checking + savings). The system extracts each account separately.

### 3.2 Maximum Value Determination

This is the core intelligence of the product. For each account, the system must determine the maximum account value during the calendar year.

**Approach**:
- If the client uploads 12 monthly statements: the system compares all balance figures across all 12 statements and identifies the highest value. This is the maximum.
- If the client uploads a single year-end or quarterly statement: the system extracts the highest balance shown and flags that it may not represent the true annual maximum. The preparer can mark it as complete or request additional statements.
- Transaction-only statements (no explicit balance): the system calculates a running balance from transactions if feasible, or flags the statement as requiring manual review.

**Assumption**: Most bank statements show at least a closing balance. For statements that only show transactions, the system will flag for manual review rather than attempt to reconstruct balances from transaction history. [RESEARCH NEEDED: How common are transaction-only statements without any balance figure in practice?]

### 3.3 Currency Conversion

**Treasury Rate Database**: The system maintains a database of U.S. Treasury year-end exchange rates.

**Source**: U.S. Treasury Bureau of the Fiscal Service, accessed via the public API:
```
https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange
```

**Format**: JSON (primary), with CSV and XML also available. No authentication required.

**Coverage**: 170+ currencies. Rates are published quarterly, with year-end (December 31) rates typically published mid-January of the following year.

**Conversion Formula**: Treasury rates are expressed as units of foreign currency per one USD.
```
USD Value = Foreign Currency Amount / Treasury Rate
```

**Currencies Not on Treasury List**: When a currency is not listed in Treasury rates, the system:
1. Flags the account for manual review
2. Suggests alternative rate sources (country's central bank, OANDA, XE.com)
3. Allows the preparer to enter a manual rate and document the source
4. Stores the source documentation for audit defense

**Historical Rates**: The Treasury API provides data from 2001 to present. For prior years (amendments, late filings), rates are available through the API's date filter. For pre-2001 filings, rates are available as static documents on GovInfo.gov.

### 3.4 Human-in-the-Loop Review

This is a feature, not a limitation.

**Review Interface**: Side-by-side view showing the original document (zoomable, scrollable PDF/image viewer) alongside the extracted data fields in an editable form.

**Confidence Indicators**: Each extracted field shows a confidence level:
- **High** (green): Field clearly identified and extracted
- **Medium** (yellow): Field extracted but ambiguity detected (e.g., multiple possible account numbers, unclear currency)
- **Low / Flagged** (red): Field could not be confidently extracted, requires manual entry

**Correction Workflow**: Preparer clicks any field to edit. Changes are logged (original extracted value, corrected value, who corrected, timestamp). This audit trail protects the preparer and generates training signal for improving extraction.

**Batch Approval**: For high-confidence extractions, the preparer can approve multiple accounts at once after spot-checking a sample.

### 3.5 Export and Integration

**Research Finding**: No major tax software platform (Drake, Lacerte, GoSystem, UltraTax, ProConnect, CCH Axcess) supports CSV or API import for FBAR account data. All require manual entry. This means export strategy must account for this reality.

**MVP Export Options**:

| Format | Use Case | Details |
|--------|----------|---------|
| **FinCEN XML** | Direct batch filing via BSA E-Filing | XML conforming to EFL_FBARXBatchSchema.xsd (Schema 2.0). Preparer uploads to bsaefiling.fincen.gov. This bypasses tax software entirely for FBAR filing. |
| **CSV/Excel** | Reference and data transfer | Formatted spreadsheet with all extracted fields. Preparer uses as reference while manually entering into their tax software. |
| **Structured Summary** | Copy-paste workflow | Screen-optimized view with all fields for a single account, designed for efficient manual transcription into tax software. Tab-through field order matches common tax software input screens. |
| **PDF Report** | Client files and audit trail | Printable report showing all accounts, extracted values, exchange rates used, and any corrections made. Serves as workpaper documentation. |

**Primary Export Strategy**: FinCEN XML batch filing is the highest-value path. It eliminates the tax software bottleneck entirely. The preparer reviews data in FBAR Automator, approves it, exports XML, and uploads to BSA E-Filing. This is faster than entering data into Drake/Lacerte and then filing from there.

**BSA E-Filing Integration Details**:
- XML batch files can contain multiple FBARs per submission
- Schema documentation: bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf
- Batch filers must register as an "Institution" on BSA E-Filing and obtain a Transmitter Control Code (TCC)
- Testing environment available: use TCC "TBSATEST" for validation before production
- No direct API submission exists; XML files must be manually uploaded through the BSA E-Filing portal
- Open-source Go library for XML generation available: github.com/moov-io/fincen

**Future Integration** (post-MVP): Investigate CCH Axcess Tax Transfer API for potential FBAR data import. Contact Drake, Intuit, and Thomson Reuters about undocumented import capabilities.

### 3.6 Client and Account Management

**Client Record**:
- Client name (individual or entity)
- TIN (SSN, ITIN, or EIN) -- encrypted at rest
- Filing type (individual, joint, entity)
- Spouse information (for joint filers)
- Contact information
- Preparer assignment

**Account Records**: Multiple foreign accounts per client, persisted year over year.

**Filing Year Tracking**: Each client has a filing status per year (Not Started, In Progress, Reviewed, Exported, Filed).

**Historical Data**: Returning clients carry forward account information from prior years. Preparer can pre-populate account details and only update the maximum value and current-year statement.

**Joint Filer Support**: Link spouse accounts. Joint accounts reported by both spouses can be flagged to ensure consistent reporting.

---

## 4. Data Model

### Entity Relationship Diagram (Logical)

```
Practice (1) --- (*) User
Practice (1) --- (*) Client
Client (1) --- (*) ForeignAccount
Client (1) --- (*) FilingYear
FilingYear (1) --- (*) Statement (uploaded document)
Statement (1) --- (*) ExtractedData
ForeignAccount (1) --- (*) ReviewedAccountYear
ReviewedAccountYear (1) --- (1) FilingYear
ExchangeRate (currency, year) --- (*) ReviewedAccountYear
```

### Core Entities

**Practice**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Firm name |
| address | JSONB | Firm address fields |
| ein | VARCHAR(9) | Encrypted, firm EIN |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**User**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| practice_id | UUID | FK to Practice |
| email | VARCHAR(255) | Login credential |
| name | VARCHAR(255) | |
| role | ENUM | admin, preparer, reviewer |
| created_at | TIMESTAMP | |

**Client**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| practice_id | UUID | FK to Practice |
| type | ENUM | individual, entity |
| last_name | VARCHAR(255) | Encrypted |
| first_name | VARCHAR(255) | Encrypted |
| tin | VARCHAR(11) | Encrypted (SSN/ITIN/EIN) |
| tin_type | ENUM | ssn, itin, ein, foreign_tin |
| date_of_birth | DATE | Encrypted, individuals only |
| us_address | JSONB | Encrypted |
| mailing_address | JSONB | Encrypted, if different |
| spouse_client_id | UUID | FK to Client, nullable (for joint filers) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**ForeignAccount**

Mapped to FinCEN Form 114 Part II/III fields:

| Field | Type | FinCEN Field | Notes |
|-------|------|-------------|-------|
| id | UUID | | Primary key |
| client_id | UUID | | FK to Client |
| account_number | VARCHAR(100) | Item 18/28 | Encrypted |
| account_type | ENUM | Item 16/26 | bank, securities, other |
| account_type_description | VARCHAR(255) | Item 16/26 | Required if type=other |
| institution_name | VARCHAR(255) | Item 17/27 | |
| institution_address_street | VARCHAR(255) | Item 19/29 | |
| institution_address_city | VARCHAR(100) | Item 20/30 | |
| institution_address_state | VARCHAR(100) | Item 21/31 | State/province |
| institution_address_country | VARCHAR(2) | Item 22/32 | ISO 3166-1 alpha-2 |
| institution_address_postal | VARCHAR(20) | Item 23/33 | |
| is_jointly_owned | BOOLEAN | | Part III indicator |
| joint_owner_count | INTEGER | Item 24 | Excluding filer |
| ownership_type | ENUM | | financial_interest, signature_authority, both |
| is_active | BOOLEAN | | Track closed accounts |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

**FilingYear**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| client_id | UUID | FK to Client |
| calendar_year | INTEGER | e.g., 2025 |
| status | ENUM | not_started, in_progress, reviewed, exported, filed |
| filing_type | ENUM | original, amended |
| has_25_plus_accounts | BOOLEAN | FinCEN Item 14 |
| assigned_preparer_id | UUID | FK to User |
| reviewed_by_id | UUID | FK to User, nullable |
| reviewed_at | TIMESTAMP | |
| exported_at | TIMESTAMP | |
| filed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Statement** (uploaded document)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| filing_year_id | UUID | FK to FilingYear |
| foreign_account_id | UUID | FK to ForeignAccount, nullable (assigned during review) |
| file_path | VARCHAR(500) | S3 key, encrypted at rest |
| file_name | VARCHAR(255) | Original filename |
| file_type | VARCHAR(10) | pdf, jpeg, png, heic, tiff |
| file_size_bytes | INTEGER | |
| page_count | INTEGER | |
| processing_status | ENUM | pending, processing, completed, failed |
| processing_started_at | TIMESTAMP | |
| processing_completed_at | TIMESTAMP | |
| llm_model_used | VARCHAR(50) | e.g., claude-sonnet-4-5-20250929 |
| llm_tokens_used | INTEGER | For cost tracking |
| created_at | TIMESTAMP | |

**ExtractedData**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| statement_id | UUID | FK to Statement |
| raw_llm_response | JSONB | Full LLM output for audit |
| bank_name | VARCHAR(255) | |
| bank_address | JSONB | |
| account_number | VARCHAR(100) | Encrypted |
| account_type_detected | VARCHAR(50) | |
| currency_code | VARCHAR(3) | ISO 4217 |
| balances | JSONB | Array of {date, balance, label} |
| max_balance_local | DECIMAL(18,2) | Highest balance found |
| max_balance_date | DATE | Date of max balance |
| statement_period_start | DATE | |
| statement_period_end | DATE | |
| confidence_scores | JSONB | Per-field confidence |
| extraction_warnings | JSONB | Array of warning messages |
| created_at | TIMESTAMP | |

**ReviewedAccountYear**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| foreign_account_id | UUID | FK to ForeignAccount |
| filing_year_id | UUID | FK to FilingYear |
| max_value_local | DECIMAL(18,2) | Confirmed max in local currency |
| currency_code | VARCHAR(3) | ISO 4217 |
| exchange_rate | DECIMAL(12,6) | Treasury rate used |
| exchange_rate_source | VARCHAR(50) | treasury, manual |
| manual_rate_justification | TEXT | Required if source=manual |
| max_value_usd | DECIMAL(18,2) | Converted value |
| is_value_unknown | BOOLEAN | FinCEN Item 15a |
| reviewed_by_id | UUID | FK to User |
| reviewed_at | TIMESTAMP | |
| corrections | JSONB | Log of any field corrections |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**ExchangeRate**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| currency_code | VARCHAR(3) | ISO 4217 |
| country_name | VARCHAR(100) | |
| rate | DECIMAL(12,6) | Foreign currency units per 1 USD |
| record_date | DATE | December 31 of applicable year |
| source | VARCHAR(20) | treasury_api |
| fetched_at | TIMESTAMP | When rate was retrieved |

---

## 5. Technical Architecture

### Stack Recommendation

**Framework**: Next.js 14+ (App Router) with TypeScript

**Justification**: Next.js provides the fastest path to a production-ready web application with:
- Server-side rendering for the document review interface (SEO irrelevant, but SSR gives faster initial load)
- API routes for backend logic without a separate server
- React Server Components for efficient rendering of document lists and dashboards
- File-based routing that maps cleanly to the application's page structure
- Mature ecosystem (auth libraries, file upload, PDF rendering)
- Strong TypeScript support reduces bugs in financial calculations
- Deployable to Vercel with zero-config, or self-hosted on any Node.js platform

**Alternatives Considered**:
- **Django**: Stronger ORM and admin interface, but slower frontend iteration. Good choice if the team prefers Python. Would pair with a separate React frontend.
- **FastAPI + React SPA**: Clean API separation, but doubles the deployment surface. Better for API-first products; this product is UI-heavy.
- **Rails**: Fast prototyping, but smaller talent pool for AI/LLM integration work.

**Database**: PostgreSQL 16+

- JSONB columns for flexible schema fields (addresses, extraction results, confidence scores)
- Row-level security for multi-tenant data isolation
- pgcrypto for field-level encryption of PII
- Full-text search for client lookup
- Proven at scale for financial data workloads

**File Storage**: AWS S3 with server-side encryption (SSE-S3 or SSE-KMS)

- All uploaded documents encrypted at rest using AES-256
- Presigned URLs for secure, time-limited download access
- Lifecycle policies for document retention (auto-delete after retention period)
- Versioning enabled for audit trail

**LLM Integration**: Anthropic Claude API (primary), OpenAI GPT-4o (fallback)

**Claude as primary because**:
- Superior vision capabilities for document understanding
- Zero Data Retention (ZDR) available on API plans, meaning document content is processed in real-time and not stored by Anthropic
- Competitive pricing for vision tasks
- Strong structured output (JSON mode) reliability

**GPT-4o as fallback because**:
- Independent provider reduces single-vendor risk
- Different model architecture may succeed on documents where Claude struggles
- OpenAI also offers zero data retention for API customers (requires explicit request, +25% pricing)

**Both providers should be configured with zero data retention agreements before processing any client documents.**

**Hosting**: Vercel (application) + AWS (S3, RDS)

- Vercel for the Next.js application: instant deployments, edge functions, built-in CDN
- AWS RDS for PostgreSQL: managed database with automated backups, encryption at rest
- AWS S3 for document storage
- Consider AWS-only deployment (ECS/Fargate + RDS + S3) if Vercel's shared infrastructure raises compliance concerns during SOC 2 preparation

**Authentication**: NextAuth.js (Auth.js) with email/password + MFA

- MFA is required by FTC Safeguards Rule for systems accessing customer financial information
- Practice-level tenancy: each practice is an organization, users belong to one practice
- Role-based access: admin (manage users, settings), preparer (full workflow), reviewer (read-only approval)
- Session management with short-lived JWTs and refresh tokens
- SSO (SAML/OIDC) as a future enterprise feature

### Security Architecture

**Data Classification**:

| Classification | Examples | Protection |
|---------------|----------|------------|
| Critical PII | SSN/TIN, account numbers | Encrypted at rest (field-level), encrypted in transit, access-logged, masked in UI |
| Sensitive PII | Names, addresses, balances | Encrypted at rest (database-level), encrypted in transit |
| Internal | Extraction results, confidence scores | Encrypted at rest (database-level) |
| Public | Exchange rates, form field definitions | Standard protection |

**Encryption**:
- **In transit**: TLS 1.3 for all connections (application, database, S3, LLM API calls)
- **At rest**: AES-256 for S3 objects, RDS encryption, field-level encryption for Critical PII using pgcrypto or application-level encryption with AWS KMS

**LLM Data Handling**:
- All LLM API calls use zero data retention agreements
- Document content sent to LLM APIs is not stored, logged, or used for training
- API calls made over TLS 1.3
- No document content passes through client-side code; all LLM calls are server-side

**SOC 2 Design Considerations** (design for it now, certify later):
- Audit logging for all data access and modifications
- Automated access reviews (quarterly)
- Change management process for code deployments
- Incident response plan documented and tested
- Vendor risk assessments for Anthropic, OpenAI, AWS, Vercel
- Annual penetration testing

**Document Retention Policy**:
- Active client data: retained while subscription is active
- Post-cancellation: retained for 3 years (matches IRS record retention standard), then securely deleted
- User-requested deletion: honored within 30 days
- Deletion logs retained for 6 years (matches FBAR statute of limitations)
- Uploaded documents: auto-delete configurable per practice (default: 3 years post-filing)

---

## 6. LLM Prompt Engineering

### Extraction Prompt Specification

The extraction prompt is the core technical component. It must reliably extract structured data from documents that vary wildly in language, format, layout, and quality.

**Prompt Strategy**: Use a system prompt that defines the extraction task and expected output schema, then pass the document image(s) as user content. Use structured output (JSON mode) to enforce the response format.

**System Prompt** (abbreviated for PRD; full prompt will be refined during development):

```
You are a financial document data extraction system. You will be given images of
foreign bank statements. Your job is to extract specific data fields from each
statement and return them as structured JSON.

IMPORTANT RULES:
- Extract exactly what is shown on the document. Do not infer or calculate values
  not explicitly present.
- If a field is not visible or not present on the document, return null for that
  field and add an explanation to the warnings array.
- If you are uncertain about a field value, include it but set the confidence
  to "low" and explain in warnings.
- Handle any language. Translate field labels internally but return values as-is
  (e.g., return the account number exactly as printed, including any formatting).
- For balance figures, extract the numeric value and currency. Do not convert
  currencies.
- Identify ALL balance figures on the statement (opening, closing, available,
  daily snapshots, etc.) and include all of them in the balances array.
- Determine which balance figure represents the MAXIMUM value shown on this
  statement.
```

**Expected Output JSON Schema**:

```json
{
  "accounts": [
    {
      "bank_name": "string",
      "bank_address": {
        "street": "string | null",
        "city": "string | null",
        "state_province": "string | null",
        "country": "string",
        "postal_code": "string | null"
      },
      "account_number": "string",
      "account_type": "bank | securities | other",
      "account_type_description": "string | null",
      "currency": "string (ISO 4217 code)",
      "statement_period": {
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD"
      },
      "balances": [
        {
          "date": "YYYY-MM-DD | null",
          "amount": "number",
          "label": "string (e.g., 'closing balance', 'opening balance', 'available balance')",
          "is_maximum": "boolean"
        }
      ],
      "max_balance": {
        "amount": "number",
        "date": "YYYY-MM-DD | null",
        "label": "string"
      },
      "confidence": {
        "bank_name": "high | medium | low",
        "account_number": "high | medium | low",
        "currency": "high | medium | low",
        "max_balance": "high | medium | low",
        "overall": "high | medium | low"
      },
      "warnings": ["string"]
    }
  ],
  "document_language": "string (ISO 639-1)",
  "document_metadata": {
    "page_count": "number",
    "is_multi_account": "boolean",
    "is_transaction_only": "boolean"
  }
}
```

### Multi-Page Statement Handling

- Upload all pages of a single statement as a single multi-page PDF or as sequential images
- The prompt instructs the LLM to treat all pages as one document
- For very long statements (>20 pages), process in page batches with context carryover:
  - First batch: extract account metadata + balances from first N pages
  - Subsequent batches: "Continue extracting balances for account [number] from these pages"
  - Final pass: compare all extracted balances to determine maximum

### Multi-Account Document Handling

- The output schema supports an array of accounts
- The prompt explicitly instructs: "If this document contains information for multiple accounts, extract each account as a separate entry in the accounts array"
- Each account gets independent confidence scores

### Transaction-Only Statements

- The LLM detects when no explicit balance is shown (sets `is_transaction_only: true`)
- Warning added: "No explicit balance found. This statement shows only transactions."
- The system flags this account for manual review
- The preparer can: (a) enter a balance manually, (b) upload an additional statement that shows balances, or (c) mark the balance as unknown (FinCEN Item 15a)

### Error Handling / Low-Confidence Fields

When the LLM cannot confidently extract a field:
- Field value is set to the best guess (or null if no guess is possible)
- Confidence is set to "low"
- A specific warning message explains why (e.g., "Account number partially obscured by scan artifact", "Currency not explicitly stated, inferred from country")

### Validation Rules Applied to LLM Output

Post-extraction, the system validates:

| Rule | Check | Action on Failure |
|------|-------|------------------|
| Currency code valid | ISO 4217 lookup | Flag for review |
| Account number present | Non-null, non-empty | Flag for review |
| Max balance positive | > 0 | Flag for review |
| Balance reasonableness | < $100B USD equivalent | Flag for review (likely OCR error if exceeded) |
| Country code valid | ISO 3166-1 lookup | Flag for review |
| Date format valid | Parseable date | Flag for review |
| Duplicate detection | Same account number + bank in same filing year | Alert preparer |

---

## 7. Treasury Exchange Rate Integration

### Data Source

**Primary**: U.S. Treasury Fiscal Data API
- **Endpoint**: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange`
- **Authentication**: None required (public API)
- **Rate limit**: Not documented; implement polite rate limiting (max 1 request/second)
- **Formats**: JSON (default), CSV, XML

**Example query for year-end 2025 rates**:
```
GET https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?fields=country_currency_desc,exchange_rate,record_date&filter=record_date:eq:2025-12-31&page[size]=500
```

### Implementation

**Rate Sync Schedule**:
1. On application startup, check if rates for the current and prior 2 filing years are loaded
2. Every January 15-31, poll the API daily for newly published year-end rates
3. When new rates are detected, import them into the ExchangeRate table
4. Admin notification when new rates are available

**Rate Storage**:
- Store all rates in the ExchangeRate table (currency_code, rate, record_date)
- Index on (currency_code, record_date) for fast lookup
- Rates are immutable once stored (Treasury may amend if rates deviate by 10%+; handle amendments as new records with a flag)

**Conversion in the Application**:
```typescript
function convertToUSD(localAmount: number, currencyCode: string, filingYear: number): ConversionResult {
  const rate = await getExchangeRate(currencyCode, filingYear);
  if (!rate) {
    return { usdAmount: null, source: 'none', requiresManualRate: true };
  }
  return {
    usdAmount: Math.round((localAmount / rate.rate) * 100) / 100,  // Round to cents
    source: 'treasury',
    requiresManualRate: false,
    rateUsed: rate.rate,
    rateDate: rate.record_date
  };
}
```

**Currencies Not on Treasury List**:
- The system checks if the detected currency code exists in the ExchangeRate table for the filing year
- If not found: flag for manual entry, provide link to suggested alternative sources
- Preparer enters rate manually, must provide source description (stored in `manual_rate_justification`)
- Acceptable alternative sources: country's central bank rate, OANDA, XE.com, Bloomberg (per FinCEN guidance)

**Historical Rates**: API data available from 2001 to present. For the MVP, support filing years 2022-2025.

---

## 8. Workflow and UX

### End-to-End Workflow

```
1. Preparer logs in (MFA required)
2. Dashboard shows clients, filing years, status summary
3. Preparer selects or creates a client
4. Preparer selects filing year (defaults to most recent)
5. Preparer uploads bank statement(s)
   - Drag-and-drop zone or file picker
   - Progress bar per file with estimated processing time
   - Can continue working while documents process
6. System processes each document via LLM
   - Status: Queued > Processing > Complete / Failed
   - Average processing time: 10-30 seconds per document
7. Preparer opens review screen for completed extractions
   - Left panel: document viewer (PDF/image with zoom, pan, page navigation)
   - Right panel: extracted fields in editable form
   - Confidence badges on each field
   - Warnings highlighted in context
8. Preparer reviews, corrects if needed, approves each account
   - Corrections are logged with before/after values
   - "Approve" button per account, "Approve All" for batch
9. System auto-converts approved max balances to USD
   - Shows rate used, rate source, and converted amount
   - Preparer can override rate if Treasury rate unavailable
10. Preparer exports approved data
    - FinCEN XML for BSA E-Filing (primary)
    - CSV/Excel for reference
    - PDF workpaper report
11. Preparer uploads XML to BSA E-Filing portal (external)
12. Preparer marks filing year status as "Filed" in FBAR Automator
```

### Screen Descriptions

**Dashboard**

The default landing page after login. Organized as a filterable, sortable table.

- Columns: Client Name | Filing Year | Status | Accounts | Last Updated | Assigned To
- Status badges: Not Started (gray), In Progress (blue), Reviewed (yellow), Exported (green), Filed (dark green)
- Filters: by status, filing year, assigned preparer
- Quick actions: New Client, Upload Statements (opens client picker first)
- Summary bar at top: total clients, pending review count, ready to export count

**Client Detail**

Shows a single client's FBAR information across filing years.

- Client info header: name, TIN (masked), filing type
- Tab per filing year (most recent first)
- Within each year tab:
  - List of foreign accounts with status (extracted, reviewed, approved)
  - Upload area for additional statements
  - "Export" button (enabled when all accounts approved)
  - Filing status selector

**Upload Interface**

Accessible from Dashboard or Client Detail.

- Large drag-and-drop zone with file picker fallback
- Client selector (if accessed from Dashboard)
- Filing year selector
- Upload progress with per-file status indicators
- "Process All" button (or auto-process on upload)
- Queue display showing processing status for each document

**Review / Approval Screen**

The core working screen. Split-pane layout.

- **Left pane (60% width)**: Document viewer
  - Renders PDF pages or images at full resolution
  - Zoom, pan, rotate controls
  - Page navigation for multi-page documents
  - Highlight/annotation capability (future)

- **Right pane (40% width)**: Extracted data form
  - Bank name, address fields (pre-filled, editable)
  - Account number (masked by default, click to reveal)
  - Account type dropdown
  - Currency (detected, editable)
  - All extracted balances listed with dates
  - Maximum balance highlighted
  - USD conversion shown (auto-calculated)
  - Confidence badges per field
  - Warnings section with explanations
  - "Approve" / "Reject" / "Flag for Follow-up" buttons
  - Correction log (expandable)

**Export Screen**

Accessed per filing year for a client.

- Summary table of all approved accounts with USD values
- Aggregate total across all accounts (for $10K threshold reference)
- Export format selector: FinCEN XML | CSV | PDF Report
- "Download" button for each format
- XML validation status (pre-checks against FinCEN schema before download)
- Filing checklist: all accounts reviewed, all rates applied, all fields complete

**Settings**

Practice-level configuration.

- **Practice Info**: Firm name, EIN, address (used in FinCEN XML for preparer info)
- **User Management**: Add/remove users, assign roles, MFA enforcement
- **Exchange Rates**: View current rate table, manually add rates for unlisted currencies
- **Data Retention**: Configure auto-delete timeline for uploaded documents
- **Export Defaults**: Default export format, XML preparer information

---

## 9. Pricing Model

### Market Context

| Data Point | Value | Source |
|-----------|-------|-------|
| What practices charge clients per FBAR | $49-$150 (simple), $150-$500+ (complex) | H&R Block, Greenback, Genesis Tax |
| Internal labor cost per FBAR (estimated) | $100-$400 (1-2 hours at $100-200/hr blended) | Derived from billing rates and time estimates |
| Tax software annual license | $1,500-$2,500/year (Drake, Lacerte, ProSeries) | Published pricing |
| Number of FBARs per target practice | 200-500/year | Persona definition |
| Practice tech budget | ~$20,000/year on average | Accounting Today survey |

### Recommended Pricing: Hybrid Subscription + Usage

**Tier Structure**:

| Tier | Monthly | Annual | Included FBARs/mo | Overage per FBAR |
|------|---------|--------|-------------------|-----------------|
| Starter | $199 | $1,990 | 25 | $12 |
| Professional | $399 | $3,990 | 75 | $10 |
| Enterprise | $699 | $6,990 | Unlimited | N/A |

An "FBAR" is one client filing (one FinCEN Form 114 regardless of number of accounts). Per-account charges add complexity and feel punitive to clients with many accounts.

**ROI Justification for a 20-Person Practice (300 FBARs/year)**:

- **Professional tier**: $3,990/year + (225 overage x $10) = $6,240/year
- **Current labor cost** (estimated): 300 FBARs x 1.5 hours x $150/hr = $67,500
- **Time saved** (estimated 70% reduction): $47,250 in recovered labor
- **ROI**: 7.6x
- Even at a conservative 40% time reduction: $27,000 saved, 4.3x ROI

**Enterprise tier at 300 FBARs**: $6,990/year. Simpler. ROI remains strong.

**Pricing Principles**:
- Annual prepay gets 2 months free (standard SaaS convention)
- No per-seat charges for MVP (reduce friction to adoption; revisit if practices have 10+ preparers)
- Free trial: 10 FBARs, no credit card required, full feature access
- Pilot pricing for first 5 practices: 50% discount for first year in exchange for feedback commitment

### Pricing to Avoid

- Per-page pricing (penalizes clients who upload monthly statements; 12 pages vs. 1 for the same account)
- Per-account pricing (feels like a penalty for thorough compliance; a client with 8 accounts is already a pain)
- Free tier (not viable for this market; practices expect to pay for professional tools)

---

## 10. Go-to-Market

### Phase 0: Manual/Concierge Validation (Now through April 2026)

**Goal**: Validate the core value proposition with real client data before building the full product.

**Approach**:
1. Partner with 1-3 practices from the existing distribution channel
2. Offer a "white-glove" service: practice sends bank statements, founding team processes them using Claude API directly (manual prompt engineering, manual review)
3. Return structured data in a spreadsheet within 24-48 hours
4. Charge nothing or a nominal fee ($25/FBAR) to reduce friction
5. Measure: accuracy, time savings reported by preparer, types of documents that cause problems, feedback on output format

**Key Learning Objectives**:
- What percentage of real-world bank statements can the LLM handle without human intervention?
- What are the most common failure modes?
- What output format do preparers actually want?
- What does the review/correction workflow look like in practice?
- How do preparers currently get data into their filing software?

### Phase 1: MVP Launch (Target: July-August 2026)

**Why July-August**: The October 15 FBAR extension deadline creates a second filing window. Many practices file the majority of FBARs on extension. Launching in July gives 2-3 months before the deadline, enough time for practices to adopt and use the tool for their extension filings.

**The April 15, 2026 deadline is too soon for a full product launch.** Use it for concierge validation instead.

**Launch strategy**:
1. Soft launch with 3-5 practices from concierge validation
2. Onboard each practice with a 30-minute walkthrough
3. Provide dedicated support (founder-led) during first filing season
4. Collect accuracy metrics, NPS, and feature requests

### Sales Motion

**Buyer**: Practice owner/partner (David persona). Cares about ROI, liability, and staff efficiency.

**User**: Tax preparer/senior associate (Sarah persona). Cares about ease of use, accuracy, and time savings.

**Sales process**:
1. **Discovery call** with practice owner (15 min): understand FBAR volume, current workflow, pain points
2. **Demo** with owner + lead preparer (30 min): show the tool processing a real bank statement (use a sample, not client data)
3. **Pilot** (2-4 weeks): practice processes 10-20 real FBARs through the tool. Free.
4. **Close**: present pilot results (time saved, accuracy), propose annual subscription
5. **Onboard**: 30-minute training for all preparers

**Channel strategy**: The founding team has existing relationships with international tax practices. Use these for initial sales. No outbound marketing needed for the first 10-20 customers. After that, consider:
- Partnerships with tax practice management consultants
- Presence at AICPA/NATP conferences (exhibit booth or sponsored session)
- Content marketing targeting "FBAR preparation" search terms
- Referral program (practice refers another practice, both get a discount)

### Partnership Opportunities

- **Drake Software**: Largest market share among small-mid tax practices. A partnership where FBAR Automator exports data formatted for Drake's FRGN screen would be high-value.
- **BSA E-Filing / FinCEN**: No formal partnership, but becoming a recognized tool in the FBAR ecosystem (listed on FinCEN resources, etc.) would drive organic adoption.
- **Expat tax communities**: American Citizens Abroad (ACA), Association of Americans Resident Overseas (AARO), Federation of American Women's Clubs Overseas (FAWCO).

---

## 11. Regulatory and Compliance Considerations

### AI/Automation for FBAR Preparation

**No prohibition exists.** As of February 2026, neither FinCEN nor the IRS has issued guidance restricting or regulating the use of AI or automation for FBAR data extraction or preparation. General preparer standards under Circular 230 apply regardless of whether the work is done manually or with software.

### Preparer Responsibilities

Tax preparers using FBAR Automator retain full professional responsibility under:
- **Circular 230**: Competence and diligence requirements. Preparer must exercise independent professional judgment. Reliance on software output is permissible only if "reasonable and in good faith." Preparer cannot blindly accept automated results.
- **31 USC 5314/5321**: FBAR penalties are assessed on the filer (taxpayer), not the preparer directly. However, preparers face Circular 230 discipline, state licensing board action, and civil malpractice liability if negligent preparation causes client harm.

### Penalty Context

The penalty structure creates strong demand for accuracy tools:

| Violation Type | Penalty (2025 adjusted) | Notes |
|---------------|------------------------|-------|
| Non-willful | Up to $16,536 per form per year | Per Bittner v. US (2023), assessed per-form not per-account |
| Willful | Greater of $165,353 or 50% of account balance | Per-form per year |
| Criminal willful | Up to $250,000 fine + 5 years imprisonment | |

**United States v. Reyes (2d Cir., Jan 2026)**: "Willfulness" now includes recklessness (objective standard). A preparer who "clearly ought to have known" of FBAR requirements and failed to act faces willful penalties. This raises the stakes for both preparers and their tools.

### Professional Liability Allocation

- **The preparer** bears primary responsibility for accuracy of filed FBARs
- **FBAR Automator (as vendor)** limits liability to subscription fees paid, disclaims consequential damages (industry standard per TaxSlayer, Intuit, H&R Block ToS patterns)
- **The human-in-the-loop review step** is the critical liability boundary: the tool extracts and suggests, the preparer verifies and approves. This is the standard professional workflow.

### GLBA Compliance

FBAR Automator is subject to the Gramm-Leach-Bliley Act because it processes financial data for tax preparation services (a regulated "financial activity" under 15 USC 6809).

**Required**:
- Written Information Security Plan (WISP) per IRS Publication 4557
- Designated Qualified Individual overseeing security program
- Encryption of customer information at rest and in transit
- Multi-factor authentication for all user access
- Incident response plan
- Annual risk assessment
- Service provider oversight (written agreements with Anthropic, OpenAI, AWS)
- Breach notification to FTC within 30 days if 500+ consumers affected

### State Privacy Laws

CCPA/CPRA applies if the company meets revenue or data volume thresholds. Design for CCPA compliance from day one:
- Consumer data access, correction, deletion, and portability rights
- Privacy policy disclosing data collection, use, and sharing (including AI providers)
- Vendor contracts with data processing provisions

### LLM Provider Data Policies

| Provider | Zero Data Retention | How to Enable | Cost Impact |
|----------|-------------------|---------------|-------------|
| Anthropic (Claude) | Available for API customers | Contractual addendum | None documented |
| OpenAI (GPT-4o) | Available for API customers | Explicit request through sales | +25% pricing premium |

**Recommendation**: Execute ZDR agreements with both providers before processing any client documents. This is non-negotiable for GLBA compliance and client trust.

### Required Disclaimers (see Section 5 for full ToS guidance)

The application must prominently display:
1. Not legal or tax advice
2. Preparer retains full professional responsibility
3. All extracted data must be independently verified before filing
4. AI systems can make errors
5. Limitation of liability to subscription fees
6. Data handling and privacy disclosure

---

## 12. Risks and Open Questions

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM extraction accuracy insufficient for production use (<90% field-level accuracy) | Medium | High | Concierge validation phase will measure real accuracy. Invest in prompt engineering. Human-in-the-loop review catches errors. |
| LLM cannot handle very poor scan quality (faded, skewed, handwritten) | Medium | Medium | Flag low-quality documents for manual processing. Provide guidance to clients on upload quality. |
| LLM hallucinations (invents account numbers or balances not on document) | Low | High | Validation rules catch impossible values. Side-by-side review interface makes hallucinations visible. Log raw LLM output for audit. |
| Multi-page statement context window limits | Low | Medium | Process in batches with context carryover. Current models support 100K+ tokens. |
| API cost per document higher than sustainable | Low | Medium | Current pricing (~$0.01-0.05 per page with vision) is well within margin. Monitor and optimize prompt length. |
| FinCEN XML schema changes | Low | Low | Schema has been stable. Monitor FinCEN announcements. |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Major tax software vendor builds this feature | Medium | High | First-mover advantage. Build deep relationships with practices. Offer better UX than what a vendor would bolt onto existing software. Tax software vendors move slowly. |
| Market too small to sustain a venture-scale business | Low | High | 1.6M FBARs/year growing at 7% CAGR. Even capturing 5% = 80K FBARs. At $20/FBAR average = $1.6M ARR. Sufficient for a profitable, founder-owned business if not venture-backed. |
| Practices unwilling to send client documents to a cloud tool | Medium | Medium | SOC 2 certification, ZDR with LLM providers, GLBA compliance, and practice-owner trust-building during pilot phase. Some practices may require on-premise; defer this to Phase 3. |
| LLM providers change pricing or terms significantly | Low | Medium | Support multiple providers (Claude + GPT-4o). LLM costs are trending down, not up. |
| Regulatory change restricts AI use in tax preparation | Very Low | High | No current indicators. Monitor FinCEN and IRS guidance. Human-in-the-loop design already mitigates this risk. |

### Market Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Practices consolidate, reducing total addressable buyers | Medium | Low | Consolidation increases FBAR volume per buyer, increasing per-practice value. |
| FBAR filing requirements change or are eliminated | Very Low | High | FBAR has existed since 1970; expansion is more likely than elimination. FATCA Form 8938 has similar requirements, providing a natural extension. |
| Direct-to-consumer expat tools cannibalize preparer market | Low | Low | Self-filers are a different market segment. Practices handle clients with complex multi-country situations that self-filers avoid. |

### Open Questions Requiring Research or Customer Interviews

1. **[RESEARCH NEEDED]** What percentage of real-world bank statements show explicit balances vs. transaction-only data? This determines how often the system can extract max values automatically vs. flagging for manual review.

2. **[RESEARCH NEEDED]** Do any tax software platforms have undocumented import capabilities for FBAR data? Direct outreach to Drake, Thomson Reuters, and Wolters Kluwer engineering teams is needed.

3. **[CUSTOMER INTERVIEW]** How do practices currently organize and receive bank statements from clients? (Email, portal, physical mail?) This informs the upload UX.

4. **[CUSTOMER INTERVIEW]** What is the actual time spent per FBAR in practice? The estimates in this PRD (1-2 hours) need validation with stopwatch-level data from real preparers.

5. **[CUSTOMER INTERVIEW]** Would practices use FinCEN XML direct filing (bypassing their tax software for FBAR) or do they strongly prefer everything going through Drake/Lacerte?

6. **[RESEARCH NEEDED]** What is the exact CCH Axcess Tax Transfer API capability for FBAR data? The API documentation suggests XML-based import for "all return types" but FBAR coverage is unconfirmed.

7. **[CUSTOMER INTERVIEW]** How do practices handle multi-year FBAR amendments? (e.g., client realizes they missed filing for 3 prior years.) This affects the historical rate and multi-year workflow design.

8. **[RESEARCH NEEDED]** How common are FBAR filings for accounts in currencies not on the Treasury list? This determines how much to invest in the manual rate entry workflow.

---

## 13. Success Metrics

### MVP Launch (First 5 Practices)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Field-level extraction accuracy (before human review) | >85% | Automated comparison of LLM output vs. approved values |
| Account-level accuracy (all fields correct, no corrections needed) | >60% | Percentage of accounts approved without any corrections |
| Processing time per document | <30 seconds | Server-side measurement |
| Preparer time per FBAR (with tool) | <20 minutes | Self-reported by preparers during pilot |
| Preparer time per FBAR (without tool, baseline) | Measure during pilot | Self-reported by preparers |
| Time reduction | >50% | Calculated from above two metrics |
| Critical errors caught by review (wrong account number, wrong currency, wildly wrong balance) | <5% of extractions | Tracked via correction logs |
| Preparer NPS | >40 | Survey after first 10 FBARs processed |

### First 90 Days Post-Launch

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying practices | 5-10 | CRM |
| Total FBARs processed | 200+ | Application analytics |
| Retention (practices still active after 30 days) | 100% | Application analytics |
| Average corrections per FBAR | <3 fields | Correction log analysis |
| Support tickets per practice per week | <2 | Help desk |
| Field-level accuracy (trending) | >90% | Automated tracking |

### First Filing Season (October 15, 2026 Extension Deadline)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying practices | 15-30 | CRM |
| Total FBARs processed | 1,000-3,000 | Application analytics |
| Revenue (ARR run rate) | $50K-$100K | Billing system |
| Churn (practices that cancel) | <10% | CRM |
| Preparer time reduction (measured) | >60% | User surveys + in-app timing |
| FinCEN XML export adoption | >50% of exports | Application analytics |
| Zero critical filing errors from extraction bugs | 0 | Customer support + post-filing audit |

### Year One (February 2027)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Paying practices | 30-75 | CRM |
| Total FBARs processed | 5,000-15,000 | Application analytics |
| ARR | $150K-$500K | Billing system |
| Gross margin | >70% | Financial model (LLM costs are primary COGS) |
| Field-level accuracy | >95% | Automated tracking |
| Account-level accuracy (no corrections) | >80% | Correction logs |
| Customer referrals | >20% of new practices from referral | CRM attribution |
| SOC 2 Type 1 certification | Obtained | Audit report |

---

## 14. Roadmap

### Phase 1: MVP (March-August 2026)

**March-April**: Concierge validation with 1-3 practices
- Process real client bank statements manually using Claude API
- Measure accuracy, document failure modes, collect feedback
- Build and validate FinCEN XML export capability

**May-June**: Build MVP application
- Core upload, extraction, review, export workflow
- Treasury exchange rate integration via API
- Client and account management
- FinCEN XML batch export
- CSV/PDF export
- Authentication with MFA
- Field-level encryption for PII

**July**: Soft launch to pilot practices
- Onboard 3-5 practices from concierge phase
- Founder-led support
- Iterate based on real-world usage

**August-October**: First filing season (extension deadline)
- Expand to 10-20 practices
- Refine extraction prompts based on accuracy data
- Optimize review workflow based on preparer feedback

### Phase 2: Post-First-Season (November 2026 - March 2027)

Based on learnings from the first filing season:

- **Accuracy improvements**: Fine-tune prompts for the most common bank formats encountered. Build a library of country/bank-specific extraction patterns.
- **Workflow optimization**: Batch approval, keyboard shortcuts for power users, template-based account pre-population for returning clients
- **Reporting**: Practice-level analytics (FBARs processed, time saved, accuracy trends)
- **SOC 2 Type 1**: Complete audit and obtain certification
- **Client portal** (optional): Allow end clients (taxpayers) to upload statements directly, reducing email back-and-forth for preparers
- **Form 8938 support**: FATCA Form 8938 requires similar data (foreign financial assets). Extend extraction to cover both forms from the same uploaded statements.

### Phase 3: Scale (April 2027+)

- **Tax software integrations**: Build direct integrations with Drake, CCH Axcess (via Tax Transfer API), and others as import capabilities become available
- **On-premise / private cloud deployment**: For large firms with strict data residency requirements
- **Direct-to-FinCEN filing**: If FinCEN ever opens an API for direct submission, integrate immediately. Meanwhile, optimize the XML upload workflow.
- **Expanded international reporting**: Form 3520 (foreign trusts), Form 5471 (foreign corporations), Form 8865 (foreign partnerships). Each requires similar document extraction from foreign financial documents.
- **Direct-to-consumer offering**: Simplified version for self-filing expats. Different product, different pricing, different UX. Lower priority than the B2B practice tool.
- **Multi-language client communications**: Auto-generate client request letters in the client's language ("Please provide your December bank statement for account ending in XXXX")

---

## Appendix A: FinCEN Form 114 Field Reference

Complete field mapping per FinCEN Line Item Filing Instructions:

**Part I (Filer Information)**: Type of filer, TIN (SSN/ITIN/EIN), foreign TIN, name, date of birth, US address, mailing address, 25+ accounts indicator with count.

**Part II (Individually Owned Accounts)**: Maximum account value (USD, whole dollars), value unknown indicator, account type (bank/securities/other + description), financial institution name, account number, institution mailing address (street, city, state/province, country, postal code).

**Part III (Jointly Owned Accounts)**: Same as Part II plus number of joint owners and optional joint owner information (name, TIN, address).

**Part IV (Signature Authority Accounts)**: Account owner information (name, address, identifying number) plus account details.

**Part V (Consolidated Reporting)**: Entity information for consolidated filers with 25+ accounts.

**Signature Section**: Calendar year, signature, date, filing reason (original/amended).

**Third-Party Preparer**: Name, address, TIN, firm name, firm EIN.

**XML Schema**: EFL_FBARXBatchSchema.xsd available at fincen.gov/sites/default/files/schema/base/

---

## Appendix B: Treasury Exchange Rate API Reference

**Base URL**: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange`

**Key Parameters**:
- `fields`: Comma-separated field list (country_currency_desc, exchange_rate, record_date)
- `filter`: e.g., `record_date:eq:2025-12-31`
- `page[size]`: Results per page (max 10000)
- `format`: json (default), csv, xml

**Response Fields**:
- `country_currency_desc`: e.g., "Japan-Yen"
- `exchange_rate`: Units of foreign currency per 1 USD
- `record_date`: Date the rate applies to

**Rate Coverage**: 170+ currencies from 2001 to present.

**Year-End Rate Publication**: Typically mid-January following the calendar year. The December 31, 2025 rates were published January 15, 2026.

---

## Appendix C: BSA E-Filing XML Batch Filing Reference

**Schema**: EFL_FBARXBatchSchema.xsd (Schema 2.0)
**Root Element**: `EFilingBatchXML` with `FormTypeCode="FBARX"`
**Documentation**: bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf

**Registration**: Register as "Institution" at bsaefiling.fincen.gov/enroll
**Testing**: Use TCC "TBSATEST" in the User Test System
**Production**: Request production TCC after successful testing

**Open-Source Reference**: github.com/moov-io/fincen (Go library for FinCEN BSA form generation)

**Key Constraints**:
- No REST API for submission; XML must be manually uploaded through the portal
- Batch files can contain multiple FBAR Activity elements (unbounded)
- Strict formatting: no leading/trailing spaces, no carriage returns in field values
- Elements must appear in schema-specified order
- All elements require the "fc2" prefix

---

## Appendix D: Research Sources

### FinCEN / Government Sources
- FinCEN Report Foreign Bank and Financial Accounts: fincen.gov/report-foreign-bank-and-financial-accounts
- FinCEN FBAR Line Item Filing Instructions: fincen.gov/system/files/shared/FBAR%20Line%20Item%20Filing%20Instructions.pdf
- FinCEN FBAR XML User Guide: bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf
- BSA E-Filing System: bsaefiling.fincen.gov
- Treasury Reporting Rates of Exchange: fiscaldata.treasury.gov/datasets/treasury-reporting-rates-exchange/
- Treasury Fiscal Data API: fiscaldata.treasury.gov/api-documentation/
- IRS FBAR Reference Guide (Publication 5569): irs.gov/pub/irs-pdf/p5569.pdf
- FTC Safeguards Rule (16 CFR Part 314): ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314

### Market Data
- FinCEN FY 2023 Year in Review: fincen.gov/news/news-releases/fincen-year-review-fiscal-year-2023
- AARO FBAR Filing Data by Year: aaro.org/fbar-filing-data-by-year
- AARO Americans Abroad Population: aaro.org/living-abroad/how-many-americans-live-abroad
- IBISWorld Tax Preparation Services: ibisworld.com/united-states/number-of-businesses/tax-preparation-services/1399/

### Pricing and Industry
- Drake Software Pricing: drakesoftware.com/pricing/
- Lacerte Pricing: accountants.intuit.com/tax-software/lacerte/pricing/
- Greenback Tax Services FBAR Pricing: greenbacktaxservices.com/services/filing-fbar-with-us-expat-taxes/
- H&R Block FBAR Filing: hrblock.com/expat-tax-preparation/expat-tax-preparation-and-services/fbar-filing/
- Accounting Today ROI of Automation: accountingtoday.com/opinion/the-roi-of-automation-quantify-your-time-to-measure-value

### Legal and Compliance
- United States v. Reyes (2d Cir. 2026): law.justia.com/cases/federal/appellate-courts/ca2/24-2333/24-2333-2026-01-07.html
- Bittner v. United States (2023): Supreme Court ruling on per-form vs. per-account FBAR penalties
- Anthropic Zero Data Retention: privacy.claude.com/en/articles/8956058
- OpenAI Enterprise Privacy: openai.com/enterprise-privacy/
- CCPA/CPRA Regulations: cppa.ca.gov/regulations/

### Competitor Research
- MyExpatTaxes FBAR: myexpattaxes.com/fbar/
- Expatfile FBAR: expatfile.tax/fbar/
- Inkle FBAR: inkle.ai/filing/fbar
- Veryfi Bank Statements OCR: veryfi.com/bank-statements-ocr-api/
- Ocrolus Bank Statements: ocrolus.com/supported-documents/bank-statements/
- Parseur Bank Statements: parseur.com/extract-data/bank-statements
- Moov FinCEN Library: github.com/moov-io/fincen
