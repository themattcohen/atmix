# BSA E-Filing Setup & FBAR Batch Testing

**Date**: 2026-02-20
**Status**: Production TCC RECEIVED: **PBSA8180** (02/27/2026)
**Phase**: D2C Phase 4 — FinCEN Pipeline

---

## Table of Contents

1. [Account Registration](#1-account-registration)
2. [XML Schema & Bugs Found](#2-xml-schema--bugs-found)
3. [Test Batch Generator](#3-test-batch-generator)
4. [Test Batch Validation](#4-test-batch-validation)
5. [Submission Process](#5-submission-process)
6. [B2B Code Fixes Required](#6-b2b-code-fixes-required)
7. [Key Reference Documents](#7-key-reference-documents)
8. [Credentials & IDs](#8-credentials--ids)

---

## 1. Account Registration

### Production Site: bsaefiling.fincen.gov

| Field | Value |
|-------|-------|
| URL | https://bsaefiling.fincen.gov |
| Organization | All Solutions Consulting |
| EIN | 883761328 |
| PIN | 48623952 |
| Account Email | matt@atmix.org |
| TCC | **PBSA8180** (issued 02/27/2026 — confirmed via phone call to BSA E-Filing Help Desk) |

### Sandbox Site: bsaefiling-sandbox.fincen.gov

Production and sandbox are **completely separate systems** with separate registrations. Production credentials do NOT work on sandbox.

| Field | Value |
|-------|-------|
| URL | https://bsaefiling-sandbox.fincen.gov |
| Organization | All Solutions Consulting |
| Enrollment Code | ASC877083 |
| PIN | 92922117 |
| Account Email | matt@atmix.org |
| TCC (test) | TBSATEST (hardcoded for all sandbox submissions) |

### Getting a Production TCC

1. Register on the sandbox and create an organization
2. Generate and submit a test batch XML (min 25 activities recommended)
3. Download the acknowledgment file and fix any errors
4. Resubmit until passing cleanly
5. FinCEN reviews within **10 business days**
6. Production TCC issued by email after passing

---

## 2. XML Schema & Bugs Found

### Schema Reference

| Document | Location |
|----------|----------|
| FBAR Batch Schema | `claudedocs/fincen-schemas/EFL_FBARXBatchSchema.xsd` (v1.2, 7/31/2018) |
| Base BSA Schema | `claudedocs/fincen-schemas/BSA_XML_2.0.xsd` |
| XML User Guide | [XMLUserGuide_FinCENFBAR.pdf](https://bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf) |
| Electronic Filing Reqs | [FinCENFBARElectronicFilingRequirements.pdf](https://bsaefiling.fincen.gov/docs/FinCENFBARElectronicFilingRequirements.pdf) |
| Testing Procedures | [XML_Batch_Testing_Procedures.pdf](https://bsaefiling.fincen.gov/docs/XML_Batch_Testing_Procedures.pdf) |

### 3 Critical Bugs Found in B2B Code (`src/lib/export/fincen-xml.ts`)

These bugs were discovered by cross-referencing the B2B XML generator against the official XSD schema. They exist in the B2B production code and would cause **batch rejection by FinCEN**.

#### Bug 1: `RawPartyLegalName` does not exist in schema

- **Location**: `src/lib/export/fincen-xml.ts` lines 223, 379, 437
- **Problem**: Code uses `RawPartyLegalName` for entity names (transmitter, preparer firm, financial institutions)
- **Schema reality**: The element is `RawPartyFullName` — `RawPartyLegalName` does not exist in either `EFL_FBARXBatchSchema.xsd` or `BSA_XML_2.0.xsd`
- **Impact**: Schema validation failure → batch rejection
- **Fix**: Replace all `RawPartyLegalName` with `RawPartyFullName`

#### Bug 2: `EFilingPriorDocumentNumber` set to empty string

- **Location**: `src/lib/export/fincen-xml.ts` line 192
- **Problem**: Code emits `<fc2:EFilingPriorDocumentNumber></fc2:EFilingPriorDocumentNumber>` for non-amendment filings
- **Schema reality**: Element type is `xsd:long` — empty string is NOT a valid long integer
- **Impact**: Schema validation failure → batch rejection
- **Fix**: Omit the element entirely for non-amendment filings (it has `minOccurs="0"`)

#### Bug 3: Transmitter Contact name element order

- **Location**: `src/lib/export/fincen-xml.ts` lines 266-267
- **Problem**: Code outputs `RawIndividualFirstName` before `RawEntityIndividualLastName`
- **Schema reality**: XSD `<xsd:sequence>` requires `RawEntityIndividualLastName` BEFORE `RawIndividualFirstName`
- **Impact**: Schema validation failure → batch rejection
- **Fix**: Swap the order so LastName comes first

### Additional Finding: PartyCount Attribute

The `PartyCount` attribute in the root `<EFilingBatchXML>` element counts **only type 41 (Financial Institution) parties** — account-level FI parties, not all parties in the batch. This matches the B2B code's existing behavior (line 485 counts `type41Count`).

Confirmed by research: the six root-level count attributes are:

| Attribute | Counts |
|-----------|--------|
| `ActivityCount` | Total `<Activity>` elements |
| `PartyCount` | Parties with `ActivityPartyTypeCode = "41"` (FI) |
| `AccountCount` | Total `<Account>` elements |
| `JointlyOwnedOwnerCount` | Parties with type `"42"` (joint owner) |
| `NoFIOwnerCount` | Parties with type `"43"` (no FI interest) |
| `ConsolidatedOwnerCount` | Parties with type `"44"` (consolidated) |

---

## 3. Test Batch Generator

### File

`scripts/generate-test-batch.mjs` — standalone Node.js script, no dependencies.

### Usage

```bash
cd fbar-automator
node scripts/generate-test-batch.mjs
# Outputs: test-fbar-batch-2025.xml (191.5 KB)
```

### What It Generates

- **26 Activities** (filers), **51 accounts** across 19 countries
- Calendar year **2025**, signature date = today's date
- TCC: **TBSATEST** (sandbox)
- Transmitter: All Solutions Consulting (EIN 883761328)
- Preparer: Matthew Cohen (PTIN P99999999)
- All SSNs in 900-999 range (IRS-designated test range, not banned by FinCEN)
- All accounts are `EFilingAccountTypeCode=141` (separately owned) for simplicity

### Test Data Scenarios

| Activities | Accounts Each | Scenario |
|------------|---------------|----------|
| 1-5 | 1 | Single bank account, various countries (CH, GB, DE, ES, JP) |
| 6-10 | 2 | Two accounts (bank + securities), various countries |
| 11-15 | 3 | Three accounts (bank + securities + other), various countries |
| 16-18 | 2 | Multiple bank accounts in same country |
| 19-21 | 1 | Higher value accounts ($90K-$120K) |
| 22-23 | 1 | Unknown maximum value (indicator=Y, amount=0) |
| 24-25 | 3 | Mixed account types (bank + securities + other) |
| 26 | 4 | Maximum variety, 25+ accounts indicator = Y |

### Countries Covered

CH, GB, DE, ES, JP, NL, FR, AU, CN, CA, SE, SG, BR, KR, HK, IE, CL, RU, NZ

### Built-in Validation

The script runs 13 validation checks before writing the file:
1. Root element present
2. FormTypeCode = FBARX
3. Activity count matches header
4. Required party types per activity (35, 37, 15)
5. FI party count matches account count
6. SeqNum global uniqueness
7. Date format YYYYMMDD
8. No `RawPartyLegalName` (banned element)
9. `RawPartyFullName` used for entities
10. No `EFilingPriorDocumentNumber`
11. Account amounts are non-negative integers
12. TCC = TBSATEST
13. Calendar year = 2025
14. Minimum 25 activities

---

## 4. Test Batch Validation

### Final Validation Results (2026-02-20)

| Check | Result |
|-------|--------|
| Activities: 26 (min 25 required) | PASS |
| Accounts: 51 | PASS |
| SeqNums: 802, all unique | PASS |
| TCC: TBSATEST | PASS |
| FormTypeCode: FBARX | PASS |
| SSNs: 900-xxx range, no banned patterns | PASS |
| PartyCount=51 (type 41 FI parties) | PASS |
| AccountCount=51 | PASS |
| JointlyOwnedOwnerCount=0, NoFIOwnerCount=0, ConsolidatedOwnerCount=0 | PASS |
| All EFilingAccountTypeCode=141 | PASS |
| No RawPartyLegalName | PASS |
| No EFilingPriorDocumentNumber | PASS |
| PreparerFilingSignatureIndicator=Y (26 occurrences) | PASS |
| SignatureAuthoritiesIndicator=N (all filers) | PASS |
| Element ordering per XSD sequence | PASS |
| PartyName ordering (LastName before FirstName) | PASS |
| Date format YYYYMMDD | PASS |
| No hyphens in ZIP codes | PASS |
| No spaces in ZIP codes | PASS |
| Namespace fc2:www.fincen.gov/base | PASS |

### FinCEN Business Rules

| Rule | Status |
|------|--------|
| TIN: no all-zeros, all-nines, or 123456789 | PASS |
| ActivityCount/PartyCount/AccountCount match actual | PASS |
| Owner counts consistent with account types (all 141 → all counts 0) | PASS |
| Dates are valid calendar dates | PASS |
| SeqNums globally unique (XSD `xsd:unique` constraint) | PASS |

---

## 5. Submission Process

### Method: Web Portal with PDF Wrapper

The BSA E-Filing web portal requires XML batch files to be embedded inside a **FBARXBatch PDF wrapper**. Direct XML upload is only available via SDTM (server-to-server VPN — not what we use).

### Step-by-Step

1. **Log in** to https://bsaefiling-sandbox.fincen.gov
2. Navigate to **File Now** page
3. **Download the FBARXBatch PDF** (test version) — there should be a download button
4. **Open the PDF in Adobe Acrobat Reader** — MUST use Acrobat Reader, not browser PDF viewer or any other reader. The PDF has embedded JavaScript forms that only work in Acrobat.
5. Inside the PDF, click **"Add File"** to attach `test-fbar-batch-2025.xml`
6. **Sign with PIN**: 92922117 (sandbox PIN)
7. Save the signed PDF
8. Return to the sandbox portal **File Now** page
9. **Upload** the signed PDF
10. **Enter PIN** again and submit
11. System validates the XML against schema + business rules
12. **Acknowledgment file** appears in Secure Messenger inbox within 2 business days
13. Review the ack file for errors/warnings
14. If errors: fix and resubmit. If clean: wait for FinCEN review.
15. **Production TCC** issued by email within **10 business days** of final passing test

### SDTM (Server-to-Server) — ACTIVE

SDTM accounts provisioned (Ticket #00488355 production, #00488354 sandbox) on 2026-03-02.

| Environment | Host | IP | Port |
|---|---|---|---|
| **Production** | `bsaefiling-direct-transfer.fincen.gov` | `164.95.10.142` | `2222` |
| **Sandbox** | `bsaefiling-direct-transfer-sandbox.fincen.gov` | `164.95.10.143` | `2222` |

- **Protocol**: SFTP only (no FTP/FTPS)
- **Auth**: username + password (client ID + secret)
- **Production UID**: `sdtmmar0126p`
- **Directories**: Upload XML to **submissions/** subfolder, acks appear in `acks/` (`.MESSAGES.XML` + `.ACKED`) per SDTMRequirements.pdf v2.0 §4a.ii
- **Response times**: Messages file within ~5 hours, ACK with BSA IDs within 2-3 business days
- **Sandbox UID**: `sdtmmar02264`
- **Host keys**: Obtained for both production and sandbox environments
- **Sandbox status**: ACTIVE on Hetzner (`SDTM_SANDBOX_MODE=false`, pointing at sandbox host for E2E testing)

---

## 6. B2B Code Fixes Required

Three bugs must be fixed in `src/lib/export/fincen-xml.ts` before production filing:

### Fix 1: RawPartyLegalName → RawPartyFullName

```typescript
// Lines 223, 379, 437 — change:
RawPartyLegalName
// to:
RawPartyFullName
```

### Fix 2: Omit EFilingPriorDocumentNumber for non-amendments

```typescript
// Line 192 — remove or conditionally emit:
// BEFORE (always emitted, empty string breaks xsd:long):
EFilingPriorDocumentNumber: ""
// AFTER (omit entirely when not amending):
// Only emit when filing.isAmendment === true, with a valid long integer
```

### Fix 3: Transmitter Contact name order

```typescript
// Lines 266-267 — swap order:
// BEFORE (wrong):
RawIndividualFirstName → RawEntityIndividualLastName
// AFTER (correct, matches XSD sequence):
RawEntityIndividualLastName → RawIndividualFirstName
```

### Test Coverage

The B2B XML generator has 107 tests (59 unit + 47 integration + 1 sample). These tests should be updated to catch the element name and ordering issues. Specifically:
- Add a test asserting `RawPartyFullName` is used (not `RawPartyLegalName`)
- Add a test asserting `EFilingPriorDocumentNumber` is absent for non-amendments
- Add a test asserting LastName appears before FirstName in PartyName elements

---

## 7. Key Reference Documents

### Official FinCEN Documents

| Document | URL |
|----------|-----|
| FBAR XML User Guide (v1.4) | https://bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf |
| FBAR Electronic Filing Requirements | https://bsaefiling.fincen.gov/docs/FinCENFBARElectronicFilingRequirements.pdf |
| XML Batch Testing Procedures | https://bsaefiling.fincen.gov/docs/XML_Batch_Testing_Procedures.pdf |
| Sandbox Testing Procedures | https://bsaefiling-sandbox.fincen.gov/resources/TestingProcedures.pdf |
| EFL_FBARXBatchSchema.xsd (v1.2) | https://www.fincen.gov/sites/default/files/schema/base/EFL_FBARXBatchSchema.xsd |
| BSA_XML_2.0.xsd (base schema) | https://www.fincen.gov/system/files/schema/base/BSA_XML_2.0.xsd |
| SDTM Requirements | https://bsaefiling.fincen.gov/docs/SDTMRequirements_2019.pdf |
| Methods of Transmission | https://bsaefiling.fincen.gov/MethodsOfTransmission.html |

### Local Schema Files

| File | Location |
|------|----------|
| FBAR Batch Schema | `claudedocs/fincen-schemas/EFL_FBARXBatchSchema.xsd` |
| Base BSA Schema | `claudedocs/fincen-schemas/BSA_XML_2.0.xsd` |

### FBAR XML Party Type Codes

| Code | Role | Level | Required |
|------|------|-------|----------|
| 35 | Transmitter | Activity | Yes (1 per activity) |
| 37 | Transmitter Contact | Activity | Yes (1 per activity) |
| 15 | Foreign Account Filer | Activity | Yes (1 per activity) |
| 57 | Third Party Preparer | Activity | Optional |
| 56 | Preparer Firm | Activity | Optional |
| 41 | Financial Institution | Account | Yes (1 per account) |
| 42 | Joint Owner | Account | For jointly owned accounts |
| 43 | No-FI-Interest Owner | Account | For sig authority only accounts |
| 44 | Consolidated Owner | Account | For consolidated accounts |

### EFilingAccountTypeCode Values

| Code | Meaning |
|------|---------|
| 141 | Part II — Separately owned |
| 142 | Part II — Jointly owned |
| 143 | Part III — No financial interest (signature authority) |
| 144 | Part IV — Consolidated report |

### Activity Element Order (XSD Sequence)

```
Activity
├── ApprovalOfficialSignatureDateText (required)
├── EFilingPriorDocumentNumber (optional, xsd:long — omit if not amending)
├── PreparerFilingSignatureIndicator (optional, "Y" or "")
├── ThirdPartyPreparerIndicator (optional, "Y" or "")
├── ActivityAssociation (required)
│   └── CorrectsAmendsPriorReportIndicator ("Y" or "")
├── Party [3..5] — activity-level parties in order:
│   ├── Type 35: Transmitter
│   ├── Type 37: Transmitter Contact
│   ├── Type 15: Filer
│   ├── Type 57: Preparer (optional)
│   └── Type 56: Preparer Firm (optional)
├── Account [1..*]
│   ├── AccountMaximumValueAmountText
│   ├── AccountNumberText
│   ├── AccountTypeCode (1=bank, 2=securities, 999=other)
│   ├── EFilingAccountTypeCode (141/142/143/144)
│   ├── UnknownMaximumValueIndicator (optional)
│   └── Party [1..4] — account-level parties
│       ├── Type 41: Financial Institution (required)
│       ├── Type 42: Joint Owner (if applicable)
│       ├── Type 43: No-FI Owner (if applicable)
│       └── Type 44: Consolidated Owner (if applicable)
└── ForeignAccountActivity (required)
    ├── ForeignAccountHeldQuantityText (optional)
    ├── LateFilingReasonCode (optional)
    ├── ReportCalendarYearText (required, YYYY)
    └── SignatureAuthoritiesQuantityText (optional)
```

### PartyName Element Order (XSD Sequence)

```
PartyName
├── PartyNameTypeCode ("L" = legal)
├── RawEntityIndividualLastName (individuals)
├── RawIndividualFirstName (individuals)
├── RawIndividualMiddleName (optional)
├── RawIndividualNameSuffixText (optional)
├── RawIndividualTitleText (optional)
└── RawPartyFullName (entities — NOT RawPartyLegalName!)
```

---

## 8. Credentials & IDs

### Production (bsaefiling.fincen.gov)

| Item | Value |
|------|-------|
| Organization | All Solutions Consulting |
| FO Enrollment Code | ASC258076 |
| EIN | 883761328 |
| PIN | 48623952 |
| BSA User ID | matt@atmix.org |
| Email | matt@atmix.org |
| TCC | **PBSA8180** (issued 02/27/2026) |

### Sandbox (bsaefiling-sandbox.fincen.gov)

| Item | Value |
|------|-------|
| Organization | All Solutions Consulting |
| Enrollment Code | ASC877083 |
| PIN | 92922117 |
| BSA User ID | matt@atmix.org |
| Email | matt@atmix.org |
| TCC (test) | TBSATEST |

### Support

| Channel | Contact |
|---------|---------|
| Help Desk Phone | 1-866-346-9478 (Mon-Fri 8am-6pm EST) |
| Help Desk Email | BSAEFilingHelp@fincen.gov |
| IRS FBAR Helpline | (313) 234-6146 Option 1 (Mon-Fri 8am-4:30pm) — for FBAR regulation & preparer questions |

---

## Sandbox Submission Confirmation

| Field | Value |
|-------|-------|
| **Tracking ID** | T-FBX26-00000047 |
| **Receive Date/Time** | 02/20/2026, 11:07:57 AM MST |
| **Submission Type** | FBARXBATCH |
| **Owner Name** | Matthew Cohen |
| **Owner Email** | matt@atmix.org |
| **Filing Name** | TEST FBAR BATCH |
| **Signed PDF** | `FBARXBATCH_mc.pdf` |

---

## Timeline

| Date | Event |
|------|-------|
| 2026-02-20 | Registered on production + sandbox sites |
| 2026-02-20 | Analyzed B2B XML code against XSD — found 3 critical bugs |
| 2026-02-20 | Built standalone test batch generator (`scripts/generate-test-batch.mjs`) |
| 2026-02-20 | Generated + validated `test-fbar-batch-2025.xml` (26 activities, 51 accounts) |
| 2026-02-20 | Fixed 3 bugs in B2B code (`src/lib/export/fincen-xml.ts`) — 62/62 tests pass |
| 2026-02-20 | Submitted test batch on sandbox — Tracking ID **T-FBX26-00000047** |
| 2026-02-20 | Acknowledgment received — 26/26 accepted, 0 errors (T-FBX26-00000051) |
| 2026-02-27 | **Production TCC received: PBSA8180** (confirmed via phone call) |
| 2026-03-02 | **SDTM production account created** (Ticket #00488355) — UID `sdtmmar0126p` |
| 2026-03-02 | **SDTM sandbox account created** (Ticket #00488354) — UID `sdtmmar02264` |
| 2026-03-02 | SDTM env vars configured on Hetzner (host, port, username, password, dirs) |
| 2026-03-04 | **Sandbox SDTM credentials received** (username: `sdtmmar02264`, password obtained) |
| 2026-03-04 | **Production SDTM credentials received** (username: `sdtmmar0126p`, password obtained) |
| 2026-03-04 | **Host keys obtained** for both sandbox and production SDTM servers |
| 2026-03-04 | **SDTM sandbox activated on Hetzner** for E2E testing |
| *Pending* | SDTM sandbox E2E testing (in progress) |
| *Pending* | Production cutover (Stripe live keys + SDTM production + TCC PBSA8180) |
| *Pending* | Contact IRS FBAR re: preparer requirements (FinCEN emailing contact info) |
