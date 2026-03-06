# Gap #01: FinCEN XML Generation

> **STATUS: ✅ DONE** — Completed 2026-02-21
> Ported from B2B `src/lib/export/fincen-xml.ts` to `d2c/src/lib/fincen-xml.ts` (662 lines).
> All D2C adaptations applied: self-filed mode (`PreparerFilingSignatureIndicator: "Y"`), no party 57/56,
> env-var transmitter config, D2C Prisma schema (isJointAccount, Json institutionAddress, SSN/ITIN only).
> Submit route validation gate fixed (`<BSAMessage` → `<fc2:EFilingBatchXML`).
> Tests: 25 fincen-xml tests + 13 sdtm-submit tests = all passing (498 total suite).

**Severity:** ~~Blocking~~ Resolved
**Effort:** L (4-8 hours)
**Depends on:** None (treasury rates are used upstream before XML generation — accounts already have `maxValueUsd` stored)

## Problem

`d2c/src/lib/fincen-xml.ts` contains two stub functions that return placeholder values. `generateFincenXml()` returns `<!-- STUB: FinCEN XML generation not yet integrated from B2B codebase -->` and `validateFincenXml()` always returns `{ isValid: false, errors: ['STUB...'] }`. The SDTM submit route at `d2c/src/app/api/sdtm/submit/route.ts` calls `generateFincenXml(filingYearId)` directly — so every submission attempt produces invalid XML and FinCEN rejects the batch. This is the core technical blocker for go-live.

The B2B app has a fully working, XSD-validated implementation at `src/lib/export/fincen-xml.ts` (662 lines, all 24 previously identified schema issues resolved per `claudedocs/xml-gap-analysis.md`). This implementation must be adapted to the D2C schema, which differs from the B2B schema in several key ways.

## Current State

**D2C stub** (`d2c/src/lib/fincen-xml.ts`, lines 1-49):
- `generateFincenXml(filingYearId: string): Promise<string>` — returns `<!-- STUB -->` comment, line 25
- `validateFincenXml(xml: string): { isValid: boolean; errors: string[] }` — returns `{ isValid: false, errors: [...] }`, lines 45-48
- No imports, no actual logic

**B2B reference** (`src/lib/export/fincen-xml.ts`, lines 1-662):
- Full working implementation, 7 steps: fetch data, build Activity, build Parties, build Accounts, assemble, build root, serialize
- Imports: `XMLBuilder` from `fast-xml-parser`, `prisma` from `@/lib/db`, `getReviewSummary` from `@/lib/approval`, `safeDecrypt` from `@/lib/encryption`
- Signature: `generateFincenXml(filingYearId, transmitter, preparer, prefetchedSummary?)`
- Key helpers: `formatDateFincen()`, `parseAddress()`, `getEFilingAccountTypeCode()`, `SeqNumCounter`

**Caller** (`d2c/src/app/api/sdtm/submit/route.ts`, line 71):
```ts
const xml = await generateFincenXml(filingYearId);
```
The D2C caller passes only `filingYearId` — no `transmitter` or `preparer` config objects. The signature must stay compatible with this call site, or the call site must be updated when transmitter/preparer config is introduced.

## Schema Differences: B2B vs D2C

| Aspect | B2B (`src/`) | D2C (`d2c/`) |
|---|---|---|
| Filer model | `client` (separate Client model joined via FilingYear) | `user` (User IS the filer — joined via FilingYear.userId) |
| Filing data | `filingYear.reviewedAccountYears[]` each with `foreignAccount` | No `reviewedAccountYears` — accounts fetched directly via `ForeignAccount` where `userId + calendarYear` |
| Account fields | `foreignAccount.ownershipType`, `foreignAccount.isJointlyOwned`, `foreignAccount.institutionAddressCity`, `.institutionAddressCountry`, `.institutionAddressStreet`, `.institutionAddressPostal` | `ForeignAccount.ownershipType`, `ForeignAccount.isJointAccount`, `ForeignAccount.institutionAddress` (Json field `{ street?, city?, country }`) |
| Max value | `ray.maxValueUsd`, `ray.isValueUnknown` on ReviewedAccountYear | `account.maxValueUsd` directly on ForeignAccount |
| TIN types | SSN, ITIN, EIN, FOREIGN_TIN | SSN, ITIN only (D2C TINType enum is narrower) |
| Address | `client.foreignAddress` + `client.usAddress` (separate JSON fields) | `user.usAddress` only (`{ street, street2?, city, state, zip }`) — no foreign address field |
| `has25PlusAccounts` | `filingYear.has25PlusAccounts` | `filingYear.has25PlusAccounts` (same) |
| `filingType` | `filingYear.filingType` (ORIGINAL/AMENDED) | `filingYear.filingType` (ORIGINAL/AMENDED, same) |
| Encryption | `safeDecrypt` from `@/lib/encryption` | `safeDecrypt` from `@/lib/encryption` (same function, different app) |
| XML library | `fast-xml-parser` (XMLBuilder) | `fast-xml-parser` already in `d2c/package.json` v4.5.1 |
| `calendarYear` filter | via FilingYear → reviewedAccountYears join | must query `ForeignAccount` WHERE `userId = filingYear.userId AND calendarYear = filingYear.calendarYear` |

### D2C Account Institution Address

The D2C `ForeignAccount.institutionAddress` is a single Json field with shape `{ street?, city?, country }` rather than four flat fields. When building the Account's nested Party (type 41):

```ts
// B2B uses flat fields:
fa.institutionAddressCity
fa.institutionAddressCountry
fa.institutionAddressStreet
fa.institutionAddressPostal

// D2C must parse institutionAddress JSON:
const instAddr = parseAddress(fa.institutionAddress) // reuse parseAddress helper
// instAddr.city, instAddr.country, instAddr.street
// Note: no postal code in D2C institution address schema — use ""
```

### D2C TINType Mapping

D2C TINType enum only has SSN and ITIN. Both map to code `"1"` (SSN/ITIN) in FinCEN's PartyIdentificationTypeCode:

```ts
const TIN_TYPE_CODE: Record<TINType, string> = {
  SSN: "1",
  ITIN: "1",
}
```

The B2B version also handles EIN (`"2"`) and FOREIGN_TIN (`"9"`) — these can be dropped in D2C since the enum doesn't include them.

### Transmitter and Preparer Configuration

The B2B version takes `TransmitterConfig` and `PreparerConfig` as parameters because B2B is multi-tenant (each practice has different credentials). The D2C app is a single-operator service — ATMIX LLC is always the transmitter and preparer. These values can be sourced from environment variables.

## Implementation Plan

### Step 1: Define transmitter/preparer config from environment

Add these environment variables (they don't block development — use test values during TCC testing):

```
FINCEN_TRANSMITTER_NAME="ATMIX LLC"
FINCEN_TRANSMITTER_EIN="XX-XXXXXXX"
FINCEN_TRANSMITTER_TCC="PBSA8180"       # production TCC (issued 2026-02-27)
FINCEN_TRANSMITTER_PHONE="XXX-XXX-XXXX"
FINCEN_TRANSMITTER_STREET="..."
FINCEN_TRANSMITTER_CITY="..."
FINCEN_TRANSMITTER_STATE="..."
FINCEN_TRANSMITTER_ZIP="..."
FINCEN_CONTACT_NAME="Matt ..."         # contact person first + last
FINCEN_PREPARER_FIRST="Matt"
FINCEN_PREPARER_LAST="..."
FINCEN_PREPARER_PHONE="..."
FINCEN_PREPARER_PTIN="PXXXXXXXX"
FINCEN_PREPARER_STREET="..."
FINCEN_PREPARER_CITY="..."
FINCEN_PREPARER_STATE="..."
FINCEN_PREPARER_ZIP="..."
```

Add a helper function `getTransmitterConfig()` and `getPreparerConfig()` at the top of the new implementation that read these env vars and throw if any required value is missing.

### Step 2: Replace the stub with the adapted implementation

Copy the full logic from `src/lib/export/fincen-xml.ts` into `d2c/src/lib/fincen-xml.ts` with these specific adaptations:

**2a. Imports** — change from B2B paths to D2C paths:
```ts
import { XMLBuilder } from "fast-xml-parser"
import { prisma } from "@/lib/db"
import { safeDecrypt } from "@/lib/encryption"
import type { AccountType, TINType, FilingType } from "@prisma/client"
// Remove: import { getReviewSummary } from "@/lib/approval" (no approval model in D2C)
```

**2b. Remove B2B-specific types** — drop `TransmitterConfig` and `PreparerConfig` from the exported interface. Keep them as internal types if needed but populate from env vars.

**2c. Change the function signature** to match the existing call site:
```ts
export async function generateFincenXml(filingYearId: string): Promise<string>
```

Inside the function, load transmitter/preparer from env via `getTransmitterConfig()` / `getPreparerConfig()`.

**2d. Adapt Step 1 (data fetching)**:

Replace B2B query (which uses `reviewedAccountYears` join):
```ts
// B2B:
const filingYear = await prisma.filingYear.findUniqueOrThrow({
  where: { id: filingYearId },
  include: {
    client: true,
    reviewedAccountYears: { include: { foreignAccount: true } },
  },
})
const { client } = filingYear
```

D2C equivalent:
```ts
const filingYear = await prisma.filingYear.findUniqueOrThrow({
  where: { id: filingYearId },
  include: { user: true },
})
const { user } = filingYear

// Fetch accounts for this user's calendar year
const accounts = await prisma.foreignAccount.findMany({
  where: {
    userId: filingYear.userId,
    calendarYear: filingYear.calendarYear,
  },
})
```

Remove `prefetchedSummary` parameter entirely — D2C has no review/approval workflow.

**2e. Adapt Step 3 (filer Party, type 15)**:

Replace all `client.*` references with `user.*`:
```ts
// B2B uses: client.dateOfBirth, client.lastName, client.firstName,
//           client.foreignAddress, client.usAddress, client.tin, client.tinType
// D2C uses: user.dateOfBirth, user.lastName, user.firstName,
//           user.usAddress (no foreignAddress), user.tin, user.tinType

// D2C filer address — always US address
const filerAddr = parseAddress(user.usAddress)
const filerCountry = "US"  // D2C users always have US address

// Signature authority detection — use accounts[] instead of reviewedAccountYears
const hasSignatureAuthority = accounts.some(
  (a) => a.ownershipType === "SIGNATURE_AUTHORITY" || a.ownershipType === "BOTH"
)
```

**2f. Adapt Step 4 (Account elements)**:

Replace iteration over `filingYear.reviewedAccountYears`:
```ts
// B2B:
for (const ray of filingYear.reviewedAccountYears) {
  const fa = ray.foreignAccount
  const maxValueUsd = ray.isValueUnknown ? 0 : Math.round(Number(ray.maxValueUsd ?? 0))
  const decryptedAccountNumber = safeDecrypt(fa.accountNumber)
  // ...institution address uses: fa.institutionAddressCity, fa.institutionAddressCountry,
  //                               fa.institutionAddressStreet, fa.institutionAddressPostal
}

// D2C:
for (const account of accounts) {
  const maxValueUsd = Math.round(Number(account.maxValueUsd ?? 0))
  const decryptedAccountNumber = safeDecrypt(account.accountNumber)

  // Ownership/joint — D2C field is isJointAccount (not isJointlyOwned)
  const eFilingCode = getEFilingAccountTypeCode(
    account.ownershipType,
    account.isJointAccount  // note: D2C field name
  )

  // Institution address — parse JSON field
  const instAddr = parseAddress(account.institutionAddress)
  // instAddr.city, instAddr.country, instAddr.street available
  // No postal code field in D2C institution address — use ""
}
```

D2C does not have an `isValueUnknown` field on ForeignAccount. If `maxValueUsd` is null, treat as 0 (not unknown). Remove `UnknownMaximumValueIndicator` logic.

**2g. Keep identical (no changes needed)**:
- `formatDateFincen()` helper (lines 70-77 in B2B)
- `parseAddress()` helper (lines 83-97 in B2B)
- `getEFilingAccountTypeCode()` helper (lines 105-112 in B2B)
- `SeqNumCounter` class (lines 119-130 in B2B)
- Step 2 (Activity element construction), Step 5 (assemble children), Step 6 (root element), Step 7 (XMLBuilder serialization)
- Party types 35 (Transmitter), 37 (Transmitter Contact), 57 (Third Party Preparer), 56 (Preparer Firm if applicable)

### Step 3: Keep validateFincenXml identical

The `validateFincenXml` function from B2B (lines 526-661) requires zero adaptation — it operates purely on the XML string. Copy it verbatim.

### Step 4: Update `d2c/.env.example` (and Hetzner `.env`)

Add the 16 `FINCEN_*` variables listed in Step 1. During TCC testing, use `FINCEN_TRANSMITTER_TCC="TBSATEST"`.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/fincen-xml.ts` | Replace stub with adapted B2B implementation (primary change — all logic here) |
| `d2c/.env.example` (or `.env.local`) | Add 16 `FINCEN_*` environment variable entries |
| `d2c/docker-compose.prod.yml` (or `.env` on Hetzner) | Add same 16 `FINCEN_*` env vars to D2C service |

The call site at `d2c/src/app/api/sdtm/submit/route.ts` line 71 does NOT need to change — the function signature stays `generateFincenXml(filingYearId: string)`.

## Environment / Config Changes

Add to D2C service environment (Hetzner `/opt/fbar/.env.d2c` or `docker-compose.prod.yml`):

```
FINCEN_TRANSMITTER_NAME=ATMIX LLC
FINCEN_TRANSMITTER_EIN=<EIN>
FINCEN_TRANSMITTER_TCC=PBSA8180         # Production TCC (issued 2026-02-27)
FINCEN_TRANSMITTER_PHONE=<phone>
FINCEN_TRANSMITTER_STREET=<street>
FINCEN_TRANSMITTER_CITY=<city>
FINCEN_TRANSMITTER_STATE=<state>
FINCEN_TRANSMITTER_ZIP=<zip>
FINCEN_CONTACT_NAME=<First Last>
FINCEN_PREPARER_FIRST=<first>
FINCEN_PREPARER_LAST=<last>
FINCEN_PREPARER_PHONE=<phone>
FINCEN_PREPARER_PTIN=<PXXXXXXXX>
FINCEN_PREPARER_STREET=<street>
FINCEN_PREPARER_CITY=<city>
FINCEN_PREPARER_STATE=<state>
FINCEN_PREPARER_ZIP=<zip>
```

No schema migrations required — this is purely a library-level change.

## Testing

### Unit tests (new file: `d2c/src/lib/__tests__/fincen-xml.test.ts`)

1. **Happy path — single account**: Create a mock user + filingYear + one ForeignAccount in the test DB (or mock prisma). Call `generateFincenXml(filingYearId)`. Assert:
   - Contains `<fc2:EFilingBatchXML`
   - Contains `<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>`
   - Contains `ActivityPartyTypeCode>15<` (filer)
   - Contains `ActivityPartyTypeCode>35<` (transmitter)
   - Contains `ActivityPartyTypeCode>37<` (contact)
   - Contains `ActivityPartyTypeCode>57<` (preparer)
   - Contains `ActivityPartyTypeCode>41<` (financial institution)
   - `validateFincenXml(xml).isValid === true`

2. **Multi-account**: Create 3 accounts. Assert `AccountCount="3"` in root element, 3 `<fc2:Account` elements.

3. **Amended filing**: Set `filingType: "AMENDED"`. Assert `<fc2:CorrectsAmendsPriorReportIndicator>Y<`.

4. **Signature authority**: Create account with `ownershipType: "SIGNATURE_AUTHORITY"`. Assert `EFilingAccountTypeCode>143<` and filer party has `SignatureAuthoritiesIndicator>Y<`.

5. **Jointly owned**: Create account with `isJointAccount: true`. Assert `EFilingAccountTypeCode>142<`.

6. **SeqNum uniqueness**: Call `validateFincenXml()` on the output. No duplicate SeqNum errors.

### Integration test (manual)

Generate XML for a real D2C filing in local dev, save to file, submit to FinCEN's test system (`bsaefiling.fincen.gov`) using the test TCC `TBSATEST`. FinCEN's test system returns an acknowledgement within ~10 business days.

### Before declaring done

Run `validateFincenXml(xml)` after every `generateFincenXml()` call. The validator checks 10 structural requirements. If it returns `isValid: false`, the XML is not ready.

## Risks / Notes

1. **TCC received**: Production TCC **PBSA8180** issued 2026-02-27. Sandbox testing uses `TBSATEST`. Production `.env` should set `FINCEN_TRANSMITTER_TCC=PBSA8180`.

2. **No `isValueUnknown` in D2C**: The B2B schema has `ReviewedAccountYear.isValueUnknown` which triggers `UnknownMaximumValueIndicator`. D2C has no such field. If `maxValueUsd` is null (currency not yet converted), XML generation should fail loudly rather than silently output `0`. Consider adding a guard: `if (account.maxValueUsd === null) throw new Error(...)` — or ensure the treasury rate sync (Gap #02) always runs before submission.

3. **`has25PlusAccounts` logic**: The D2C `FilingYear.has25PlusAccounts` is a stored boolean. Verify it is set correctly during account collection (accounts page logic) — the XML generator trusts this value for `FilerFinancialInterest25ForeignAccountIndicator`.

4. **No preparer firm in D2C**: If ATMIX LLC is the preparer firm, set `selfEmployed: false` and `firmName: process.env.FINCEN_TRANSMITTER_NAME`. This adds a type 56 Party to every batch. Alternatively, set `selfEmployed: true` if filing under individual preparer identity only.

5. **Account address postal code**: The D2C `ForeignAccount.institutionAddress` JSON has no postal code field (schema shows `{ street?, city?, country }`). The type-41 Party `RawZIPCode` will always be `""`. This is acceptable per FinCEN schema (postal code is not required for foreign institutions).

6. **The B2B implementation already uses `RawPartyLegalName` for the transmitter name** (line 223) but the xml-gap-analysis example uses `RawPartyFullName`. The current B2B code uses `RawPartyLegalName` — copy exactly as-is since this has already passed B2B testing.
