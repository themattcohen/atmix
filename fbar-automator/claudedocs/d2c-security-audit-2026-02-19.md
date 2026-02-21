# FBAR Direct (D2C) -- Comprehensive Security Audit Report

**Date:** 2026-02-19
**Scope:** `fbar-automator/d2c/` -- Next.js 14 application handling FBAR filings with SSNs, foreign bank account numbers, FinCEN XML generation
**Analyst:** Security Engineer (Claude Code)
**Classification:** Confidential -- handles SSNs, ITINs, foreign bank account numbers, FBAR filings
**Mode:** Research only -- no files were modified

---

## Executive Summary

The D2C application demonstrates a solid security foundation for an MVP: field-level AES-256-GCM encryption for PII, bcrypt password hashing at cost 12, anti-enumeration on auth flows, Zod schema validation throughout, IDOR protections on every resource endpoint via userId binding, and Stripe webhook signature verification. Six issues are already formally documented in the known gaps registry (07, 10, 11, 12, 13, 16).

This audit identified **14 additional findings** not in the existing gaps registry, ranging from CRITICAL to LOW severity.

**Strengths observed:**
- Every API route that accesses user-owned resources (accounts, filings, payments, statements) performs a `userId: session.user.id` filter in the Prisma query, preventing IDOR attacks consistently.
- Password hashing uses bcrypt with cost factor 12 (above the OWASP minimum of 10).
- Anti-enumeration on signup (returns identical response regardless of whether email exists) and forgot-password (always returns success).
- Account lockout after 5 failed attempts with 15-minute lockout window.
- Stripe webhook uses `constructEvent()` for cryptographic signature verification.
- File uploads validate both MIME type and magic bytes to prevent content-type spoofing.
- The `accountNumber` is encrypted at rest in the database and only the last 4 digits are returned in API responses.
- Password reset tokens are SHA-256 hashed before storage and marked `used` after consumption.
- Dot-segment path bypass prevention in middleware (line 76).
- CSRF header requirement for state-changing API requests.

---

## CRITICAL Findings

---

### C-01 (NEW): FinCEN XML Generation Is a Stub -- Real PII Would Be Sent to FinCEN SFTP as Placeholder Content

**File:** `d2c/src/lib/fincen-xml.ts`, lines 17-26
**Also affects:** `d2c/src/app/api/sdtm/submit/route.ts`, lines 71-77

**Description:**

The `generateFincenXml()` function is explicitly a stub that returns a comment string:

```typescript
// fincen-xml.ts, lines 17-26
export async function generateFincenXml(filingYearId: string): Promise<string> {
  console.warn(`[STUB] generateFincenXml called...`)
  return `<!-- STUB: FinCEN XML generation not yet integrated from B2B codebase -->`
}
```

The SDTM submit route at `d2c/src/app/api/sdtm/submit/route.ts` line 71 calls this stub unconditionally and then submits the result over SFTP to FinCEN. The sandbox guard (`SDTM_SANDBOX_MODE=true`) currently prevents real submission in the `.env.example`, but:

1. If sandbox mode is disabled (e.g., when going live), stub XML will be submitted to FinCEN for real users who have paid and signed their FBAR.
2. A user can traverse the full workflow -- create filing, add accounts, sign, pay -- and trigger submission that sends `<!-- STUB: FinCEN XML generation not yet integrated -->` to FinCEN.
3. There is no validation gate in the submit route that checks whether the XML is valid before submission. The `validateFincenXml()` function in the same file explicitly returns `{ isValid: false }` and is never called from the submit route.

**Impact:** A user's paid, signed FBAR filing would be rejected by FinCEN because the submission contains a comment instead of an actual filing. Since this is a legal compliance application, false FBAR submissions or failed submissions expose users to regulatory penalties and expose the business to liability.

**Remediation:**

1. Add an explicit validation gate in `d2c/src/app/api/sdtm/submit/route.ts` before calling `submitBatch`:
```typescript
const xml = await generateFincenXml(filingYearId);
const validation = validateFincenXml(xml);
if (!validation.isValid) {
  // Revert SUBMITTING -> PAID status
  await prisma.filingYear.updateMany({
    where: { id: filingYearId, userId: session.user.id, status: "SUBMITTING" },
    data: { status: "PAID" },
  });
  return NextResponse.json(
    { error: "XML generation failed -- submission blocked", details: validation.errors },
    { status: 500 }
  );
}
```
2. Do not enable `SDTM_SANDBOX_MODE=false` in production until the real XML generator is integrated.
3. Add an environment startup check that blocks the server from starting if `SDTM_SANDBOX_MODE` is `false` and `generateFincenXml` is still a stub.

---

### C-02 / Gap #07 (DOCUMENTED, UNPATCHED): Open Redirect via callbackUrl

**File:** `d2c/src/app/(auth)/login/page.tsx`, lines 11 and 32

**Description:**

The `callbackUrl` is taken directly from the query parameter at line 11:
```typescript
const callbackUrl = searchParams.get("callbackUrl") || "/threshold";
```

And passed to `router.push(callbackUrl)` at line 32 with no validation. An attacker can craft `https://fbardirect.com/login?callbackUrl=https://evil.com` and the user is redirected to `evil.com` after successful authentication.

**Status:** Already documented in Gap #07 with a complete implementation plan. Confirmed UNPATCHED in current code.

**Remediation:** Apply the fix documented in Gap #07 -- validate that `callbackUrl` starts with `/` and does not start with `//`.

---

## HIGH Findings

---

### H-01 (NEW): Forgot-Password Email Input Not Validated with Zod Schema

**File:** `d2c/src/app/api/auth/forgot-password/route.ts`, lines 8-16

**Description:**

The forgot-password handler performs only a basic type check on the email input, not schema validation:

```typescript
// forgot-password/route.ts, lines 8-16
const body = await req.json();
const { email } = body;

if (!email || typeof email !== "string") {
  return NextResponse.json(
    { error: "Email is required" },
    { status: 400 }
  );
}
```

Every other auth endpoint in the codebase uses a Zod schema (`signupSchema`, `loginSchema`, `resetPasswordSchema`). This endpoint does not. Specific risks:

1. **No length limit:** An attacker can submit an email of arbitrary length (e.g., 10 MB string). This reaches `prisma.user.findUnique({ where: { email: ... } })` with a very long string, potentially triggering a database-level error or excessive processing time.
2. **No format validation:** Non-email strings pass through to the Prisma query. While Prisma parameterizes queries and prevents SQL injection, the missing validation is a defense-in-depth gap.
3. **Inconsistency:** All other auth endpoints use Zod; this one does not. The inconsistency increases the chance of a future developer assuming validation is present when it is not.

Compare to `d2c/src/app/api/auth/signup/route.ts` which uses `signupSchema.safeParse(body)` for the same email field with `.email()` and `.max(254)` constraints.

**Remediation:**

Add Zod validation:
```typescript
import { z } from "zod";
const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

// In the handler:
const parsed = forgotPasswordSchema.safeParse(body);
if (!parsed.success) {
  // Return the same anti-enumeration message to avoid revealing format requirements
  return NextResponse.json({
    message: "If an account exists with that email, we've sent password reset instructions.",
  });
}
const email = parsed.data.email.toLowerCase().trim();
```

---

### H-02 (NEW): SFTP Private Key Read from Filesystem at Request Time -- Potential Path Traversal

**File:** `d2c/src/lib/sdtm.ts`, lines 27-30

**Description:**

The SFTP private key path is read directly from the `SDTM_PRIVATE_KEY_PATH` environment variable and loaded with `fs.readFileSync` at the time of each SFTP connection:

```typescript
// sdtm.ts, lines 27-30
const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
if (keyPath) {
  config.privateKey = fs.readFileSync(keyPath);
}
```

There is no validation that `keyPath` is within an expected directory. The read happens once per SDTM submission call, not at startup. A misconfigured environment variable could read any file on the filesystem and pass its contents to the SSH library.

While `SDTM_PRIVATE_KEY_PATH` is an environment variable (not user-supplied input), the risk is:
- A misconfiguration or environment injection reads an arbitrary file
- The read happens at request time rather than at startup, so failures are not detected early
- In a containerized environment, if an attacker gains write access to environment variables (e.g., via a container escape or secrets manager compromise), they can direct this to any file

**Remediation:**

1. Read the private key at application startup (not per-request) and validate the path:
```typescript
const SFTP_PRIVATE_KEY = (() => {
  if (process.env.SDTM_SANDBOX_MODE === "true") return null;
  const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
  if (!keyPath) return null;
  if (!path.isAbsolute(keyPath)) {
    throw new Error("SDTM_PRIVATE_KEY_PATH must be an absolute path");
  }
  return fs.readFileSync(keyPath);
})();
```

2. Alternatively, store the private key content directly in an environment variable (`SDTM_PRIVATE_KEY`) as a base64-encoded string, eliminating the filesystem read entirely.

---

### H-03 (NEW): SFTP Host Key Verification Not Enforced -- MITM Risk on FinCEN Submission

**File:** `d2c/src/lib/sdtm.ts`, lines 32-43

**Description:**

The SFTP client does not verify the server's host key if `SDTM_HOST_KEY` is not set:

```typescript
// sdtm.ts, lines 41-43
} else {
  console.warn("[SDTM] SFTP_HOST_KEY not set -- skipping host key verification (unsafe for production)");
}
```

The `.env.example` does not define `SDTM_HOST_KEY` at all. When `SDTM_SANDBOX_MODE` is disabled and no `SDTM_HOST_KEY` is configured, FBAR XML submissions containing decrypted user PII (SSNs, account numbers) are transmitted to an unverified SFTP endpoint.

**Impact:** A machine-in-the-middle attacker who can intercept the SFTP connection (via DNS poisoning, BGP hijacking, or compromised network) can capture the full FinCEN XML document containing decrypted SSNs and all foreign account details for every user whose filing is submitted.

**Remediation:**

1. Make `SDTM_HOST_KEY` a required environment variable when `SDTM_SANDBOX_MODE=false`:
```typescript
if (!isSandbox() && !process.env.SDTM_HOST_KEY) {
  throw new Error("SDTM_HOST_KEY is required when SDTM_SANDBOX_MODE is not true");
}
```
2. Add `SDTM_HOST_KEY=""` to `.env.example` with a comment: `# Obtain via: ssh-keyscan sdtm.fincen.gov | base64`

---

### H-04 (NEW): S3 Bucket Has No Server-Side Encryption -- PII Files at Rest Not Protected by Storage Layer

**File:** `d2c/src/lib/s3.ts`, lines 49-58

**Description:**

The `uploadFile` function issues a `PutObjectCommand` without specifying `ServerSideEncryption`:

```typescript
// s3.ts, lines 49-58
await getS3Client().send(
  new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    // No ServerSideEncryption specified
  })
);
```

Files uploaded to the bucket include:
- **Bank statement documents** uploaded by users (contain account numbers, names, addresses, balances)
- **Form 114a PDFs** generated after signing (contain the user's full name, TIN last 4, calendar year, account count, signature)

While the application-level encryption protects TINs and account numbers in the database, the S3/MinIO storage layer receives uploaded bank statement files in plaintext. If the storage layer is compromised (MinIO container escape, misrouted internal network request, MinIO credential leak via `.env` exposure), all uploaded files are readable.

**Remediation:**

For AWS S3:
```typescript
new PutObjectCommand({
  ...
  ServerSideEncryption: "AES256",
})
```

For MinIO: enable bucket-level server-side encryption using MinIO's KES integration or the `mc encrypt set` CLI command. At minimum, document that the production MinIO instance must be configured with storage-level encryption.

---

### H-05 (NEW): Statement fileName Stored Directly From User Input Without Sanitization

**File:** `d2c/src/app/api/statements/upload/route.ts`, lines 75-85

**Description:**

The original filename from the uploaded file is stored directly to the database without sanitization:

```typescript
// statements/upload/route.ts, line 80
fileName: file.name,    // raw user-supplied filename, no sanitization
```

`file.name` is entirely user-controlled via the `Content-Disposition` header in the multipart form. An attacker can upload a file with a filename such as:
- `<script>alert(1)</script>.pdf` -- if `fileName` is ever rendered in an admin dashboard, internal tool, or email without escaping, this causes XSS
- `../../../../etc/passwd.pdf` -- while S3 path traversal is not possible here (the S3 key uses `randomUUID()` at line 71), if `fileName` is ever used to construct a file path in a future feature, it becomes dangerous
- A filename of 100,000 characters -- the `Statement.fileName` column has no max-length in the Prisma schema

The S3 key is correctly generated with `randomUUID()`, so the immediate S3 path is safe. The concern is the stored filename being used unsafely in a rendering context later.

**Remediation:**

1. Sanitize the filename before storing it:
```typescript
const safeFileName = file.name
  .replace(/[^a-zA-Z0-9._\- ]/g, "_")  // strip non-safe characters
  .slice(0, 255);                        // enforce max length
```
2. Add a `@db.VarChar(255)` constraint to `Statement.fileName` in `prisma/schema.prisma`.

---

### H-06 (NEW): Stripe payment_intent.payment_failed Webhook Has Incorrect Status Reversion Logic

**File:** `d2c/src/app/api/stripe/webhook/route.ts`, lines 122-155

**Description:**

The `payment_intent.payment_failed` event handler attempts to revert a filing from `PAID` back to `SIGNED`:

```typescript
// webhook/route.ts, lines 146-155
if (paymentIntent.metadata?.userId && paymentIntent.metadata?.filingYearId) {
  await prisma.filingYear.updateMany({
    where: {
      id: paymentIntent.metadata.filingYearId,
      userId: paymentIntent.metadata.userId,
      status: "PAID", // Only revert if still in PAID state
    },
    data: { status: "SIGNED" },
  });
}
```

The logic is contradictory:
1. `checkout.session.completed` is the event that sets status to `PAID` (line 74).
2. `payment_intent.payment_failed` fires when the payment card is declined -- meaning `checkout.session.completed` would NOT have fired, so the filing should never have reached `PAID` status.
3. This reversion logic therefore operates on a state that should be impossible in the normal Stripe Checkout flow.

The risk: if a `checkout.session.completed` event arrives first (setting status to `PAID`) and then a spurious `payment_intent.payment_failed` event arrives for the same filing metadata (e.g., due to Stripe event replay, retry, or a different payment intent with the same metadata), the filing could be incorrectly reverted from `PAID` to `SIGNED`. This would allow the user to re-initiate checkout for a filing they have already paid for.

Additionally, the webhook handler at lines 127-141 uses `paymentIntent.id` to match payment records, but then falls back to metadata matching. If two different payment intents share the same `userId` + `filingYearId` metadata, the wrong payment record could be marked as `FAILED`.

**Remediation:**

1. Remove the filing status reversion from the `payment_intent.payment_failed` handler entirely. The `checkout.session.expired` handler (lines 104-119) already handles the case where a checkout session expires without payment.
2. If status reversion is needed, scope it to a specific `stripePaymentIntentId` rather than metadata-based matching:
```typescript
// Only revert if the specific payment intent that caused PAID status is the one that failed
const filing = await prisma.filingYear.findFirst({
  where: {
    id: paymentIntent.metadata.filingYearId,
    userId: paymentIntent.metadata.userId,
    stripePaymentId: paymentIntent.id,  // match the specific PI
    status: "PAID",
  },
});
if (filing) {
  await prisma.filingYear.updateMany({ ... data: { status: "SIGNED" } });
}
```

---

## MEDIUM Findings

---

### M-01 (NEW): In-Memory Rate Limiter Is Per-Process and Not Shared Across Instances

**File:** `d2c/src/middleware.ts`, lines 6-35

**Description:**

The rate limiter uses an in-process `Map`:

```typescript
// middleware.ts, lines 6-9
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
```

The code comment at line 7 acknowledges this: "In-memory per-process -- fine for single-instance MVP (no Redis needed)."

This is a documented accepted trade-off for MVP, but has practical implications:

1. **Multi-process Node.js (cluster mode):** If the application is ever run with `cluster` or PM2 in cluster mode, each worker process has its own `rateLimitStore`. An attacker can send 5 requests to worker 0, 5 more to worker 1, etc., defeating the rate limit entirely.
2. **Container restarts:** Every restart (deploy, crash recovery) resets all counters. An attacker who observes deployment timing gets a clean slate.
3. **Edge runtime concern:** The cleanup `setInterval` (line 29) runs in the middleware process. If Next.js runs middleware in Edge runtime (which has restricted timer APIs), the cleanup may not fire reliably, causing a memory leak.

The auth route rate limit of 5 req/min protecting against brute-force login attacks is the most critical rate limit. Its defeat would enable credential stuffing at full speed.

**Remediation:**

Move rate limiting to Redis before scaling to multiple instances or enabling autoscaling. The same Redis connection used for BullMQ (referenced in Gap #11 for JWT revocation) should be reused. For the current single-instance Docker deployment, verify that middleware runs in Node.js runtime (not Edge) where `setInterval` works reliably.

---

### M-02 (NEW): safeDecrypt Silent Failure in Sign Flow Produces Incorrect TIN in FBAR Form 114a

**File:** `d2c/src/lib/encryption.ts`, lines 38-46
**Critical path:** `d2c/src/app/api/filing/sign/route.ts`, line 76

**Description:**

The `safeDecrypt` function catches all exceptions and returns an empty string:

```typescript
// encryption.ts, lines 38-46
export function safeDecrypt(encrypted: string | null | undefined): string {
  if (!encrypted) return "";
  try {
    return decrypt(encrypted);
  } catch {
    console.warn("Decryption failed -- may indicate key rotation or data corruption");
    return "";
  }
}
```

In the signing flow, this produces a TIN with fallback `"0000"`:

```typescript
// filing/sign/route.ts, line 76
const tinLast4 = user.tin ? safeDecrypt(user.tin).slice(-4) : "0000";
```

If `safeDecrypt(user.tin)` returns `""` (empty string) due to a decryption failure:
- `"".slice(-4)` returns `""` (empty string)
- The ternary evaluates to truthy (`user.tin` exists), so it does not fall through to `"0000"`
- The Form 114a PDF is generated with an empty `tinLast4`

An accidental key rotation or data corruption silently generates a Form 114a PDF with a blank or incorrect TIN. If this filing is submitted to FinCEN, it may be accepted with an incorrect TIN identifier or rejected with no clear explanation to the user.

The same `safeDecrypt` is used in:
- `account-mapper.ts:9` -- returns `"****"` if decryption fails (less critical, display only)
- `api/user/route.ts:23` -- returns `null` for `tinLast4` (visible to user as missing data)

**Remediation:**

In the signing flow, treat a TIN decryption failure as a hard error:

```typescript
// filing/sign/route.ts -- replace line 76 with:
let tinLast4 = "0000";
if (user.tin) {
  try {
    const decryptedTin = decrypt(user.tin); // use decrypt(), not safeDecrypt()
    tinLast4 = decryptedTin.slice(-4);
    if (!tinLast4 || tinLast4.length < 4) {
      return NextResponse.json(
        { error: "Unable to retrieve your TIN. Please update your personal information." },
        { status: 422 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to process your TIN. Please contact support." },
      { status: 500 }
    );
  }
}
```

Add structured logging to `safeDecrypt` for observability in all paths:
```typescript
catch (e) {
  console.warn("[ENCRYPTION] Decryption failed", {
    error: e instanceof Error ? e.message : "unknown",
    encryptedLength: encrypted.length,
  });
  return "";
}
```

---

### M-03 (NEW): Health Endpoint Unauthenticated and Unrate-Limited -- Information Disclosure

**File:** `d2c/src/app/api/health/route.ts`

**Description:**

The health endpoint is:
1. Completely unauthenticated (explicitly excluded from auth checks at middleware lines 137-141)
2. Excluded from rate limiting (explicitly excluded at middleware lines 104-106)
3. Reveals the database operational status (`"ok"` vs `"error"`) and server timestamp

While the current implementation correctly swallows the database error and returns only `{ status: "error", timestamp }`, an attacker can poll this endpoint indefinitely without rate limits to detect:
- Maintenance windows (flip from ok to error and back)
- Deployment times (timestamp gaps or brief error states during restarts)
- Database outages (sustained error states)

This information is valuable for timing attacks -- an attacker can wait for a deployment window when rate limit counters reset (per M-01) and then launch a brute-force attack.

**Remediation:**

1. Add rate limiting to the health endpoint (even a loose limit, e.g., 30 req/min per IP). Modify middleware line 104:
```typescript
// Remove the health endpoint exemption from rate limiting:
normalizedPath !== "/api/health" &&  // <-- remove this condition
```
2. Alternatively, restrict the health endpoint to internal networks via the reverse proxy (Nginx/Caddy) allow-list.
3. Consider returning only `{ status: "ok" }` (no timestamp) to reduce information leakage.

---

### M-04 (NEW): UTM Parameters Lack Database-Level Length Constraint

**File:** `d2c/prisma/schema.prisma`, lines 30-34
**File:** `d2c/src/lib/validation.ts`, lines 101-105

**Description:**

The signup schema validates UTM parameters with a 200-character max at the Zod level:

```typescript
// validation.ts, lines 101-105
utmSource: z.string().max(200).optional(),
```

But the Prisma schema defines these as `String?` without `@db.VarChar(200)`:

```prisma
// schema.prisma, lines 30-34
utmSource    String?
utmMedium    String?
utmCampaign  String?
utmContent   String?
utmTerm      String?
```

Prisma's `String?` maps to PostgreSQL `TEXT` (unlimited length). The 200-character limit from Zod is the only enforcement. If Zod validation is ever bypassed (e.g., a new API route that writes UTM data without validation), the database will accept arbitrarily long strings.

Additionally, UTM data originates from client-side cookie parsing (`signup/page.tsx`, lines 9-17) using `JSON.parse(decodeURIComponent(...))`. A malicious cookie injection could store crafted data.

**Remediation:**

Add `@db.VarChar(200)` to each UTM column in `prisma/schema.prisma`:
```prisma
utmSource    String?  @db.VarChar(200)
utmMedium    String?  @db.VarChar(200)
utmCampaign  String?  @db.VarChar(200)
utmContent   String?  @db.VarChar(200)
utmTerm      String?  @db.VarChar(200)
```

This requires a Prisma migration but is non-breaking for existing data (all values are within 200 characters if Zod validation was applied during signup).

---

### M-05 (NEW): Forgot-Password Missing Email Format Pre-Validation Allows Timing Side-Channel

**File:** `d2c/src/app/api/auth/forgot-password/route.ts`, line 20

**Description:**

The forgot-password route does not validate email format before querying the database:

```typescript
// forgot-password/route.ts, line 20
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase().trim() },
});
```

When an invalid email format is supplied (e.g., `notanemail`, `a@`, `x@y`), the database query runs and returns `null`. The total response time differs from a valid-format email that also returns `null`, because:
- PostgreSQL's `UNIQUE` index on `email` is optimized for strings that match the email pattern stored in the table
- Very short strings (1-2 characters) or strings without `@` may cause different index scan behavior

While this micro-timing difference is unlikely to be exploitable over a network with jitter, it is a defense-in-depth gap. This is closely related to H-01 (missing Zod schema) and would be resolved by the same fix.

**Remediation:** Apply Zod email validation as described in H-01 before executing the database query.

---

### M-06 (NEW): Account calendarYear Not Cross-Checked Against Active Filing Year

**File:** `d2c/src/app/api/accounts/route.ts`, lines 62-99
**File:** `d2c/src/lib/validation.ts`, line 69

**Description:**

The POST `/api/accounts` handler creates a foreign account with a `calendarYear` entirely from user input:

```typescript
// accounts/route.ts, lines 72-99
const { ..., calendarYear, ... } = parsed.data;
// calendarYear comes from foreignAccountSchema which accepts 2010-2030
const account = await prisma.foreignAccount.create({
  data: {
    userId: session.user.id,
    ...
    calendarYear,  // no cross-check against an active filing year
  },
});
```

The `calendarYearSchema` in `validation.ts` validates the range (2010-2030) but nothing more. There is no check that:
1. The user has a `FilingYear` record for that `calendarYear`
2. The `FilingYear` is in an editable status (`IN_PROGRESS`, `REVIEWED`)

A user can create accounts for any calendar year between 2010 and 2030 without having a filing for that year. This:
1. Pollutes the database with orphaned account records that belong to no filing
2. Could cause the account count in filing workflows to be incorrect (e.g., the 25+ account threshold in `import/route.ts` line 85)
3. Could be used to probe whether the system has any accounts for a future year

**Remediation:**

Before creating the account, verify the user has an active filing:
```typescript
const filingYear = await prisma.filingYear.findFirst({
  where: {
    userId: session.user.id,
    calendarYear,
    status: { in: ["IN_PROGRESS", "REVIEWED"] },
  },
});
if (!filingYear) {
  return NextResponse.json(
    { error: "No active filing found for this calendar year" },
    { status: 400 }
  );
}
```

---

## LOW Findings

---

### L-01 (NEW): CSP Uses unsafe-inline for script-src in Production

**File:** `d2c/next.config.js`, lines 19-21 and 38

**Description:**

The CSP header for production uses `'unsafe-inline'` in `script-src`:

```javascript
// next.config.js, lines 19-21
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";  // production still has unsafe-inline
```

`'unsafe-inline'` allows inline `<script>` tags and `javascript:` URIs. If an attacker achieves any reflected or stored HTML injection, inline scripts will execute without CSP blocking them. The only remaining CSP protection is `'self'` which prevents loading external scripts and `frame-ancestors 'none'` which prevents clickjacking.

This is a known limitation of Next.js applications that use inline styles and scripts. Implementing nonce-based CSP with Next.js requires server-side middleware to inject a cryptographic nonce per request.

**Remediation:**

Implement nonce-based CSP using Next.js middleware to inject a per-request cryptographic nonce. Replace `'unsafe-inline'` with `'nonce-{nonce}'` in the CSP header. This is a non-trivial change and should be tracked as a planned improvement.

Reference: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

---

### L-02 (NEW): HSTS Header Not Set

**File:** `d2c/next.config.js`, lines 25-45

**Description:**

The application sets multiple security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `X-DNS-Prefetch-Control`) but does not set `Strict-Transport-Security` (HSTS).

Without HSTS, a user who visits the site via plain HTTP (e.g., typing `fbardirect.com` without `https://`) is vulnerable to SSL stripping attacks during the redirect from HTTP to HTTPS. For a financial application, this is a meaningful gap.

**Remediation:**

Add to the `next.config.js` headers array:
```javascript
{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
```

Note: HSTS is most effectively enforced at the reverse proxy level (Nginx/Caddy). Verify the Hetzner VPS reverse proxy configuration includes HSTS as well.

---

### L-03 (NEW): Token Accumulation in Forgot-Password Flow

**File:** `d2c/src/app/api/auth/forgot-password/route.ts`, lines 23-52

**Description:**

The forgot-password handler cleans up only expired and used tokens, then creates a new one:

```typescript
// forgot-password/route.ts, lines 24-33
await prisma.passwordResetToken.deleteMany({
  where: {
    userId: user.id,
    OR: [
      { expiresAt: { lt: new Date() } },
      { used: true },
    ],
  },
});

// Lines 35-52: creates a new token
const rawToken = crypto.randomBytes(32).toString("hex");
// ...
await prisma.passwordResetToken.create({ data: { ... } });
```

Valid, unexpired, unused tokens are NOT cleaned up. If a user requests 5 password resets in quick succession (from different IPs to bypass the per-IP rate limit), the database accumulates 5 valid unexpired tokens. All 5 tokens remain usable.

While this is not practically exploitable (tokens are 32-byte random and SHA-256 hashed before storage), it creates unnecessary database accumulation and means multiple valid reset tokens exist simultaneously for the same user.

**Remediation:**

Delete ALL existing tokens for the user before creating a new one (not just expired/used):
```typescript
await prisma.passwordResetToken.deleteMany({
  where: { userId: user.id },  // delete ALL tokens for this user
});
```

This ensures only one valid reset token exists per user at any time.

---

### L-04 / Gap #16 (DOCUMENTED, UNPATCHED): Test Route in Production Codebase

**File:** `d2c/src/app/api/test/reset-lockout/route.ts`

**Description:**

A test-only API route exists in the production source tree with only a runtime `NODE_ENV` guard:

```typescript
// test/reset-lockout/route.ts, lines 4-6
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // ...resets lockout for any email without authentication
}
```

**Status:** Already documented in Gap #16 with a complete implementation plan. Confirmed UNPATCHED.

**Remediation:** Delete the file and move the lockout reset to a direct Prisma call in test helpers, as described in Gap #16.

---

## Known Gaps -- Status Confirmation

| Gap | Title | Status in Code | Severity |
|-----|-------|----------------|----------|
| #07 | Open Redirect via callbackUrl | UNPATCHED -- `login/page.tsx` line 11 has no validation | HIGH |
| #10 | MFA / 2FA | UNPATCHED -- no MFA fields in schema, no MFA logic | MEDIUM |
| #11 | JWT Revocation Non-Functional | UNPATCHED -- maxAge still 30 days (line 63 of auth.ts), tokenVersion never re-validated | MEDIUM |
| #12 | No Encryption Key Rotation | UNPATCHED -- single-key format in encryption.ts, no version prefix on ciphertext | MEDIUM |
| #13 | CSRF Exempts All /api/auth/* | UNPATCHED -- middleware.ts line 122 still uses blanket `/api/auth/` prefix | MEDIUM |
| #16 | Test Route in Production Codebase | UNPATCHED -- `api/test/reset-lockout/route.ts` still exists in source tree | MEDIUM |

**Gap #13 readiness note:** The three custom auth pages that would be affected by narrowing the CSRF exemption all already send `X-Requested-With: XMLHttpRequest`:
- `signup/page.tsx` line 49: confirmed present
- `forgot-password/page.tsx` line 20: confirmed present
- `reset-password/page.tsx` line 41: confirmed present

The CSRF narrowing can be applied without breaking any existing frontend flows.

---

## Summary Table

| ID | Severity | Type | Status | File(s) |
|----|----------|------|--------|---------|
| C-01 | CRITICAL | Stub XML submitted to FinCEN via SFTP | NEW | `src/lib/fincen-xml.ts`, `src/app/api/sdtm/submit/route.ts` |
| C-02 / Gap #07 | HIGH | Open redirect post-login | DOCUMENTED, UNPATCHED | `src/app/(auth)/login/page.tsx` |
| H-01 | HIGH | Missing Zod validation on forgot-password email | NEW | `src/app/api/auth/forgot-password/route.ts` |
| H-02 | HIGH | SFTP private key path not validated | NEW | `src/lib/sdtm.ts` |
| H-03 | HIGH | SFTP host key verification not enforced | NEW | `src/lib/sdtm.ts` |
| H-04 | HIGH | S3 no server-side encryption for PII files | NEW | `src/lib/s3.ts` |
| H-05 | HIGH | Unsanitized user filename stored in database | NEW | `src/app/api/statements/upload/route.ts` |
| H-06 | HIGH | Stripe payment_failed webhook incorrect reversion | NEW | `src/app/api/stripe/webhook/route.ts` |
| M-01 | MEDIUM | In-memory rate limiter per-process only | NEW | `src/middleware.ts` |
| M-02 | MEDIUM | safeDecrypt silent failure produces bad TIN in Form 114a | NEW | `src/lib/encryption.ts`, `src/app/api/filing/sign/route.ts` |
| M-03 | MEDIUM | Health endpoint unrate-limited, reveals DB status | NEW | `src/app/api/health/route.ts` |
| M-04 | MEDIUM | UTM params lack DB-level length constraint | NEW | `prisma/schema.prisma` |
| M-05 | MEDIUM | Forgot-password missing email format pre-validation | NEW | `src/app/api/auth/forgot-password/route.ts` |
| M-06 | MEDIUM | Account calendarYear not cross-checked against active filing | NEW | `src/app/api/accounts/route.ts` |
| L-01 | LOW | CSP uses unsafe-inline in production | NEW | `next.config.js` |
| L-02 | LOW | HSTS header not set | NEW | `next.config.js` |
| L-03 | LOW | Token accumulation in forgot-password | NEW | `src/app/api/auth/forgot-password/route.ts` |
| L-04 / Gap #16 | MEDIUM | Test route in production codebase | DOCUMENTED, UNPATCHED | `src/app/api/test/reset-lockout/route.ts` |
| Gap #10 | MEDIUM | No MFA / 2FA | DOCUMENTED, UNPATCHED | `src/lib/auth.ts`, `prisma/schema.prisma` |
| Gap #11 | MEDIUM | JWT revocation non-functional (30-day maxAge) | DOCUMENTED, UNPATCHED | `src/lib/auth.ts` |
| Gap #12 | MEDIUM | No encryption key rotation | DOCUMENTED, UNPATCHED | `src/lib/encryption.ts` |
| Gap #13 | MEDIUM | CSRF exempts all /api/auth/* | DOCUMENTED, UNPATCHED | `src/middleware.ts` |

---

## Prioritized Remediation Order

### Tier 1: Immediate (before production go-live)

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 1 | C-01 | Add XML validation gate in SDTM submit route; block submission when XML is invalid/stub | S (30 min) |
| 2 | H-03 | Make SDTM_HOST_KEY required when sandbox mode is off; add startup assertion | S (15 min) |
| 3 | H-02 | Validate SFTP private key path at startup or migrate to env var for key content | S (30 min) |
| 4 | Gap #07 | Apply callbackUrl validation in login page (documented fix) | S (15 min) |
| 5 | Gap #13 | Narrow CSRF exemption to NextAuth-only paths (all frontends already send header) | S (15 min) |
| 6 | Gap #16 | Delete test/reset-lockout route, move reset to test helpers | S (30 min) |

### Tier 2: Short-term (within first sprint post-MVP)

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 7 | H-01 | Add Zod schema validation to forgot-password route | S (15 min) |
| 8 | M-02 | Make TIN decryption a hard error in the signing flow | S (30 min) |
| 9 | H-05 | Sanitize file.name before storing in Statement table | S (15 min) |
| 10 | H-06 | Remove or scope the payment_intent.payment_failed status reversion | S (30 min) |
| 11 | Gap #11 | Reduce JWT maxAge from 30 days to 7 days (one-line change) | S (5 min) |
| 12 | L-02 | Add HSTS header to next.config.js | S (5 min) |

### Tier 3: Medium-term

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 13 | Gap #12 | Add encryption key versioning to encryption.ts | L (4-8 hrs) |
| 14 | Gap #10 | Implement TOTP-based MFA | XL (1-3 days) |
| 15 | M-06 | Add active-filing-year cross-check on account creation | S (30 min) |
| 16 | H-04 | Configure S3/MinIO server-side encryption | M (1-2 hrs) |
| 17 | M-01 | Move rate limiter to Redis when scaling to multiple instances | M (2-4 hrs) |

### Tier 4: Backlog

| Priority | ID | Action | Effort |
|----------|----|--------|--------|
| 18 | L-01 | Implement nonce-based CSP (Next.js middleware) | L (4-8 hrs) |
| 19 | L-03 | Delete all existing tokens on forgot-password, not just expired/used | S (10 min) |
| 20 | M-03 | Add rate limiting to health endpoint or restrict to internal networks | S (15 min) |
| 21 | M-04 | Add @db.VarChar(200) to UTM columns in schema.prisma | S (15 min + migration) |
| 22 | M-05 | Resolved by H-01 (Zod schema on forgot-password) | -- |

---

## Appendix: Positive Security Controls Observed

For completeness, the following security controls are correctly implemented and do not require changes:

1. **IDOR Prevention:** Every API route uses `userId: session.user.id` in Prisma queries. The `accounts/[accountId]` routes use `findFirst({ where: { id, userId } })` for ownership verification on GET, PUT, and DELETE. The filing routes use `updateMany` with both `id` and `userId` for defense-in-depth.

2. **Password Hashing:** bcrypt with cost factor 12 (auth.ts line 22, signup/route.ts line 22). Password length capped at 128 bytes before bcrypt to prevent algorithmic complexity DoS (auth.ts line 19).

3. **Anti-Enumeration:** Signup returns identical 201 response whether user was created or already exists (signup/route.ts lines 38-51). Forgot-password always returns success (forgot-password/route.ts line 69).

4. **Account Lockout:** 5 failed attempts trigger 15-minute lockout (auth.ts lines 33-43). Lockout checked before bcrypt comparison (auth.ts line 28).

5. **Reset Token Security:** Tokens are 32-byte random (`crypto.randomBytes(32)`), SHA-256 hashed before database storage, single-use, and expire after 1 hour (forgot-password/route.ts lines 36-52). Password reset increments `tokenVersion` (reset-password/route.ts line 65).

6. **Stripe Webhook Verification:** Uses `getStripe().webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` for cryptographic signature verification (webhook/route.ts lines 17-21). Rejects missing signatures with 400 (line 10-12).

7. **File Upload Validation:** Both MIME type and magic byte validation (upload-validation.ts). The S3 key uses `randomUUID()` to prevent path traversal in storage (statements/upload/route.ts line 71).

8. **Encryption:** AES-256-GCM with random IV per encryption, authenticated encryption with auth tag verification (encryption.ts). Key validated at 32 bytes on use (encryption.ts lines 11-13).

9. **Input Validation:** Comprehensive Zod schemas for all major data flows (validation.ts). Password strength requirements enforced (uppercase + number + 8 chars).

10. **Security Headers:** X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy restricts camera/mic/geo, Content-Security-Policy present, X-DNS-Prefetch-Control: off (next.config.js).

---

*End of report.*
