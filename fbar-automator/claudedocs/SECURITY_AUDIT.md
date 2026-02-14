# FBAR Automator Security Audit Report

**Date**: 2026-02-13
**Scope**: Full codebase security review -- authentication, authorization, API routes, data handling, infrastructure
**Auditor**: Automated security analysis (Claude Code)
**Classification**: CONFIDENTIAL

---

## Executive Summary

The FBAR Automator codebase demonstrates a mature security posture for an application handling sensitive financial PII. The codebase consistently applies authentication checks on all API routes, implements multi-tenant isolation via `practiceId` scoping on database queries, uses Zod for input validation, masks TINs in API responses, encrypts sensitive data at rest with AES-256-GCM, and maintains comprehensive audit logging. The Dockerfile runs as a non-root user, and the Prisma ORM provides parameterized queries that prevent SQL injection.

However, several issues must be addressed before production deployment. The most critical findings involve a hardcoded static salt in the encryption module, the absence of Next.js middleware for route protection (relying solely on per-handler auth checks), missing rate limiting across all endpoints, unencrypted TIN storage in the database, and insecure temporary password generation using `Math.random()`.

**Finding Summary**:
- **CRITICAL**: 4 findings
- **HIGH**: 7 findings
- **MEDIUM**: 8 findings
- **LOW**: 5 findings

---

## Critical Findings

### C-1. Hardcoded Static Salt in Encryption Key Derivation

**File**: `/Users/matt/fbar-automator/src/lib/encryption.ts`, line 11
**Severity**: CRITICAL
**Category**: Data Protection

```typescript
const SALT = "fbar-automator-salt"
```

The `scryptSync` key derivation function uses a hardcoded, non-random salt. The purpose of a salt is to prevent precomputed dictionary attacks and to produce unique derived keys even if the same passphrase is used. A static, predictable salt defeats this purpose entirely. An attacker who obtains the ciphertext and knows the application source code (or guesses this trivial salt) only needs to brute-force the `ENCRYPTION_KEY` environment variable itself -- and all encrypted records share the same derived key.

**Remediation**: Generate a random salt per encryption operation and store it alongside the ciphertext (e.g., prepend it to the `iv:authTag:ciphertext` format). Alternatively, if a single derived key is acceptable for the threat model, use a cryptographically random salt stored as a separate environment variable and require it to be at least 16 bytes.

```typescript
// Per-record random salt approach:
const SALT_LENGTH = 16
export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = scryptSync(process.env.ENCRYPTION_KEY!, salt, KEY_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()
  return [salt.toString("hex"), iv.toString("hex"), authTag.toString("hex"), encrypted].join(":")
}
```

---

### C-2. TINs Stored Unencrypted in Database

**File**: `/Users/matt/fbar-automator/prisma/schema.prisma`, line 141
**Severity**: CRITICAL
**Category**: Data Protection / Compliance

```prisma
tin             String?     @map("tin")
```

The `Client.tin` field stores taxpayer identification numbers (SSNs, ITINs, EINs) as plaintext `String` in PostgreSQL. While the application masks TINs in API responses, the database itself contains the raw values. A database breach, backup leak, or unauthorized database access would expose every client's TIN without any barrier.

The application has an `encrypt()`/`decrypt()` module at `/Users/matt/fbar-automator/src/lib/encryption.ts` but it is not used for TIN storage.

**Remediation**: Encrypt TINs before writing to the database using the `encrypt()` function, and decrypt on read. Create Prisma middleware or a utility layer:

```typescript
// In the client creation route, before prisma.client.create:
data.tin = data.tin ? encrypt(data.tin) : null

// In the client read route, after fetching:
client.tin = client.tin ? decrypt(client.tin) : null
```

Also encrypt the `Practice.ein` field using the same approach.

---

### C-3. No Rate Limiting on Any Endpoint

**File**: All API routes under `/Users/matt/fbar-automator/src/app/api/`
**Severity**: CRITICAL
**Category**: Authentication Security / Infrastructure

No rate limiting is implemented on any API endpoint, including:
- `/api/auth/register` -- allows unlimited registration attempts (account creation spam)
- Login endpoint (via NextAuth credentials provider) -- allows unlimited login attempts (brute force)
- `/api/statements/upload` -- allows unlimited file uploads (resource exhaustion)
- `/api/statements/[statementId]/reprocess` -- unlimited re-queuing (LLM cost amplification)
- All data mutation endpoints -- no throttling for abuse prevention

**Remediation**: Implement rate limiting using a Redis-backed rate limiter. Options include:
1. **Next.js middleware** with `@upstash/ratelimit` (recommended for edge deployment)
2. **Per-route rate limiting** using a shared Redis client (already in the stack)

Recommended limits:
- Login: 5 attempts per IP per 15 minutes
- Registration: 3 attempts per IP per hour
- File upload: 20 files per user per hour
- Reprocess: 5 per statement per hour
- General API: 100 requests per user per minute

---

### C-4. Insecure Temporary Password Generation Using Math.random()

**File**: `/Users/matt/fbar-automator/src/app/api/settings/team/route.ts`, lines 32-39
**Severity**: CRITICAL
**Category**: Authentication Security

```typescript
function generateTemporaryPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}
```

`Math.random()` is not cryptographically secure. Its output is predictable given enough samples, and in V8 it uses xorshift128+ which can be reverse-engineered from a small number of outputs. An attacker who can observe or influence the timing of team member creation could potentially predict generated passwords.

**Remediation**: Use `crypto.randomBytes()` or `crypto.randomInt()` for cryptographically secure random password generation:

```typescript
import { randomInt } from "crypto"

function generateTemporaryPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomInt(chars.length))
  }
  return password
}
```

---

## High Priority Findings

### H-1. No Next.js Middleware for Route Protection

**File**: Middleware file is absent (checked `/Users/matt/fbar-automator/src/middleware.ts` -- does not exist)
**Severity**: HIGH
**Category**: Authorization

The application relies entirely on per-handler `auth()` checks within each API route and page component. There is no Next.js middleware to enforce authentication at the edge before requests reach route handlers. This defense-in-depth gap means:

1. If a developer forgets to add `auth()` to a new route, it will be completely unprotected
2. Unauthenticated requests still reach the Node.js runtime, consuming resources
3. No centralized place to enforce security headers, CORS, or CSP

**Remediation**: Create `/Users/matt/fbar-automator/src/middleware.ts`:

```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register"

  if (!req.auth && isApiRoute && !isAuthRoute) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  if (!req.auth && !isPublicRoute && !isApiRoute) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

---

### H-2. Weak Password Policy

**File**: `/Users/matt/fbar-automator/src/app/api/auth/register/route.ts`, lines 24-27
**Severity**: HIGH
**Category**: Authentication Security

```typescript
password: z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer"),
```

The password policy only enforces a minimum length of 8 characters with no complexity requirements. For a financial application handling sensitive PII, this is insufficient. NIST SP 800-63B recommends checking passwords against known breached password lists and requiring at least 12 characters for applications with high-value data.

**Remediation**: Enhance the password schema:

```typescript
password: z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
```

Additionally, consider integrating a breached password check using the HaveIBeenPwned Passwords API (k-anonymity model).

---

### H-3. Temporary Password Returned in API Response and Not Force-Changed

**File**: `/Users/matt/fbar-automator/src/app/api/settings/team/route.ts`, lines 169-177
**Severity**: HIGH
**Category**: Authentication Security

```typescript
return NextResponse.json(
  {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    temporaryPassword,
  },
  { status: 201 }
)
```

The plaintext temporary password is returned in the HTTP response body. This creates multiple risks:
1. The password may be logged by proxies, load balancers, or application logging
2. There is no mechanism to force a password change on first login
3. The User schema has no `mustChangePassword` flag

**Remediation**:
1. Add a `mustChangePassword` boolean field to the User model
2. Implement a forced password change flow on first login
3. Consider email-based invitation links with time-limited tokens instead of returning passwords in API responses
4. If the temporary password must be returned, ensure it is only shown once and document that the admin must communicate it securely

---

### H-4. Account Number Logged in Audit Trail on Account Deletion

**File**: `/Users/matt/fbar-automator/src/app/api/clients/[clientId]/accounts/[accountId]/route.ts`, lines 270-286
**Severity**: HIGH
**Category**: Data Protection

```typescript
await prisma.auditLog.create({
  data: {
    // ...
    metadata: {
      clientId,
      institutionName: existing.institutionName,
      accountNumber: existing.accountNumber,  // Full account number in audit log
    },
  },
})
```

Full account numbers are written to the audit log metadata. While audit logs are important for compliance, storing raw account numbers in them creates an additional exposure point. The audit log table has no encryption and is accessible to anyone with database access.

**Remediation**: Mask the account number before storing it in audit log metadata:

```typescript
accountNumber: existing.accountNumber
  ? `***${existing.accountNumber.slice(-4)}`
  : null,
```

---

### H-5. No CORS Configuration

**File**: `/Users/matt/fbar-automator/next.config.ts`
**Severity**: HIGH
**Category**: Infrastructure Security

The Next.js configuration has no explicit CORS headers configured. While Next.js API routes default to same-origin in most cases, the absence of explicit CORS configuration means:
1. No `Access-Control-Allow-Origin` restriction is explicitly set
2. No `X-Content-Type-Options`, `X-Frame-Options`, or `Strict-Transport-Security` headers
3. No Content Security Policy (CSP) headers

**Remediation**: Add security headers to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  // ... existing config ...
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'" },
      ],
    },
  ],
}
```

---

### H-6. S3/MinIO Default Credentials in Code

**File**: `/Users/matt/fbar-automator/src/lib/s3.ts`, lines 8-11
**Severity**: HIGH
**Category**: Infrastructure Security

```typescript
credentials: {
  accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
  secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
},
```

The S3 client falls back to default MinIO credentials (`minioadmin`/`minioadmin`) when environment variables are not set. If the application is deployed without properly setting `S3_ACCESS_KEY` and `S3_SECRET_KEY`, it will silently use insecure default credentials. This is appropriate for local development but dangerous if it leaks into production.

**Remediation**: Remove fallback defaults and throw an error if environment variables are not set in production:

```typescript
const accessKeyId = process.env.S3_ACCESS_KEY
const secretAccessKey = process.env.S3_SECRET_KEY

if (!accessKeyId || !secretAccessKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY must be set in production")
  }
  console.warn("Using default MinIO credentials -- development only")
}

const s3Client = new S3Client({
  // ...
  credentials: {
    accessKeyId: accessKeyId || "minioadmin",
    secretAccessKey: secretAccessKey || "minioadmin",
  },
})
```

---

### H-7. No Server-Side Encryption Configured for S3 Objects

**File**: `/Users/matt/fbar-automator/src/lib/s3.ts`, lines 16-29
**Severity**: HIGH
**Category**: Data Protection

```typescript
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}
```

The `PutObjectCommand` does not specify server-side encryption (SSE). Bank statements uploaded to MinIO/S3 contain sensitive financial data and should be encrypted at rest. Without SSE, objects are stored in plaintext on the storage backend.

**Remediation**: Add server-side encryption to the upload command:

```typescript
await s3Client.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",  // or "aws:kms" with KMS key
  })
)
```

For MinIO, also ensure the server is configured with encryption (MINIO_KMS_SECRET_KEY or SSE-S3).

---

## Medium Priority Findings

### M-1. No CSRF Protection for Mutation Endpoints

**File**: All POST/PUT/DELETE API routes
**Severity**: MEDIUM
**Category**: Input Validation

NextAuth v5 with JWT strategy does not inherently provide CSRF protection for API routes. While the `Authorization` header with JWT tokens provides some protection (since CSRF attacks cannot set custom headers from cross-origin forms), cookie-based session authentication is still vulnerable to CSRF if the JWT is stored in cookies (which NextAuth does by default).

**Remediation**: Implement CSRF tokens using NextAuth's built-in CSRF protection or add a custom CSRF middleware. Alternatively, ensure that all mutation endpoints validate a custom header (e.g., `X-Requested-With`) that cannot be set by cross-origin form submissions.

---

### M-2. File Upload Validates MIME Type but Not File Content (Magic Bytes)

**File**: `/Users/matt/fbar-automator/src/lib/upload.ts`, lines 21-31
**Severity**: MEDIUM
**Category**: Input Validation

```typescript
export function validateFile(file: { name: string; type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `File type "${file.type}" is not supported. Accepted: PDF, JPEG, PNG, HEIC, TIFF.`
  }
  // ...
}
```

The validation only checks the `file.type` property (MIME type from the `Content-Type` header), which is client-controlled and trivially spoofable. A malicious actor could upload an executable or malicious file with a PDF MIME type.

**Remediation**: Validate file content by checking magic bytes (file signatures):

```typescript
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/jpeg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
}

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const expectedSignatures = MAGIC_BYTES[declaredType]
  if (!expectedSignatures) return false
  return expectedSignatures.some(sig =>
    buffer.subarray(0, sig.length).equals(sig)
  )
}
```

---

### M-3. Hard-Coded `filingYearId` UUID Query Parameter Not Validated

**File**: `/Users/matt/fbar-automator/src/app/api/accounts/[accountId]/review/route.ts`, line 296
**Severity**: MEDIUM
**Category**: Input Validation

The `filingYearId` query parameter in the GET handler is taken directly from the URL without UUID format validation:

```typescript
const filingYearId = request.nextUrl.searchParams.get("filingYearId")
if (!filingYearId) {
  return NextResponse.json(
    { error: "filingYearId query parameter is required." },
    { status: 400 }
  )
}
```

While Prisma will reject invalid UUIDs with a runtime error, the error message could potentially leak internal information. This pattern is repeated across routes where URL parameters are used without format validation.

**Remediation**: Add UUID format validation for all route parameters and query parameters:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (!filingYearId || !UUID_REGEX.test(filingYearId)) {
  return NextResponse.json(
    { error: "Valid filingYearId is required." },
    { status: 400 }
  )
}
```

---

### M-4. Account Numbers Exposed in Plain Text in API Responses

**File**: `/Users/matt/fbar-automator/src/app/api/clients/[clientId]/accounts/route.ts`, line 77; `/Users/matt/fbar-automator/src/app/api/clients/[clientId]/accounts/[accountId]/route.ts`, line 87
**Severity**: MEDIUM
**Category**: Data Protection

While TINs are consistently masked throughout the application, foreign bank account numbers are returned in full in all API responses:

```typescript
accountNumber: a.accountNumber,  // Full account number
```

Account numbers are sensitive financial data that should be masked in API responses when full visibility is not required.

**Remediation**: Implement account number masking similar to TIN masking for list/summary endpoints, and only return full account numbers when explicitly needed (e.g., for review or export workflows):

```typescript
function maskAccountNumber(num: string): string {
  if (num.length <= 4) return "****"
  return `***${num.slice(-4)}`
}
```

---

### M-5. Docker Compose Exposes Database and Redis Ports to Host

**File**: `/Users/matt/fbar-automator/docker-compose.yml`, lines 35 and 68
**Severity**: MEDIUM
**Category**: Infrastructure Security

```yaml
postgres:
  ports:
    - "5432:5432"   # Exposed to all interfaces

redis:
  ports:
    - "6379:6379"   # Exposed to all interfaces, no authentication
```

PostgreSQL and Redis ports are mapped to the host on all interfaces (`0.0.0.0`). In production, this would expose the database and cache directly to the network. Redis has no authentication configured.

**Remediation**: For production, either:
1. Remove port mappings entirely (services communicate via the Docker network)
2. Bind to localhost only: `"127.0.0.1:5432:5432"`
3. Add Redis authentication: `command: redis-server --requirepass ${REDIS_PASSWORD}`

---

### M-6. No Request Body Size Limit on API Routes

**File**: `/Users/matt/fbar-automator/next.config.ts`, line 6
**Severity**: MEDIUM
**Category**: Infrastructure Security

```typescript
experimental: {
  serverActions: {
    bodySizeLimit: '50mb',
  },
},
```

The server actions body size is set to 50MB, but there is no equivalent limit for API routes. A malicious user could send extremely large JSON payloads to API endpoints like `/api/clients` or `/api/settings`, potentially causing memory exhaustion.

**Remediation**: Add request body size validation in API routes or via Next.js middleware. Consider a default limit of 1MB for JSON API routes and 50MB only for the upload endpoint.

---

### M-7. Practice EIN Returned Unmasked in Settings API

**File**: `/Users/matt/fbar-automator/src/app/api/settings/route.ts`, lines 55-59
**Severity**: MEDIUM
**Category**: Data Protection

```typescript
return NextResponse.json({
  id: practice.id,
  name: practice.name,
  address: practice.address,
  ein: practice.ein,  // Returned unmasked
})
```

The practice EIN (Employer Identification Number) is returned in full. While EINs are less sensitive than SSNs, they are still tax identifiers that should be masked in API responses.

**Remediation**: Mask the EIN in the response using the same pattern as TIN masking.

---

### M-8. No Session Invalidation on Password Change or Account Compromise

**File**: `/Users/matt/fbar-automator/src/lib/auth.ts`
**Severity**: MEDIUM
**Category**: Authentication Security

The JWT-based session strategy has no mechanism to invalidate active sessions when:
1. A user changes their password
2. An administrator disables an account
3. A security incident requires forced logout

JWTs are valid until expiry (8 hours per line 79 of auth.ts) regardless of any server-side state change.

**Remediation**: Implement a token blocklist in Redis or add a `tokenInvalidatedAt` field to the User model. In the JWT callback, check if the token was issued before the invalidation timestamp:

```typescript
async jwt({ token, user }) {
  // ... existing logic ...
  // Check if token was issued before password change
  const dbUser = await prisma.user.findUnique({ where: { id: token.userId } })
  if (dbUser?.passwordChangedAt && token.iat && token.iat < dbUser.passwordChangedAt.getTime() / 1000) {
    throw new Error("Session invalidated")
  }
  return token
}
```

---

## Low Priority Findings

### L-1. Error Logging May Contain Sensitive Data

**File**: Multiple API routes (e.g., `/Users/matt/fbar-automator/src/app/api/auth/register/route.ts`, line 85)
**Severity**: LOW
**Category**: Data Protection

```typescript
console.error("Registration error:", error)
```

Error objects logged via `console.error` may include stack traces containing request data, database queries with PII, or encryption keys in memory. In production, structured logging with PII scrubbing is recommended.

**Remediation**: Implement a structured logging library (e.g., `pino` or `winston`) with:
1. PII field redaction (email, TIN, account numbers)
2. Stack trace depth limits
3. Log level configuration by environment
4. Correlation IDs for request tracing

---

### L-2. Missing `Secure` and `SameSite` Cookie Attributes Documentation

**File**: `/Users/matt/fbar-automator/src/lib/auth.ts`
**Severity**: LOW
**Category**: Authentication Security

The NextAuth configuration does not explicitly set cookie attributes. NextAuth v5 provides reasonable defaults, but for a financial application it is best practice to explicitly configure:

```typescript
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    },
  },
},
```

**Remediation**: Explicitly configure cookie options in the NextAuth configuration to ensure `Secure`, `HttpOnly`, and `SameSite=Lax` are set.

---

### L-3. MFA Schema Exists but Is Not Implemented

**File**: `/Users/matt/fbar-automator/prisma/schema.prisma`, lines 119-120
**Severity**: LOW
**Category**: Authentication Security

```prisma
mfaSecret     String?   @map("mfa_secret")
mfaEnabled    Boolean   @default(false) @map("mfa_enabled")
```

The database schema includes MFA fields, and the team list endpoint returns `mfaEnabled` status, but there is no MFA implementation in the authentication flow. For a financial application subject to GLBA, MFA should be considered a requirement.

**Remediation**: Implement TOTP-based MFA using a library like `otpauth` or `speakeasy`. The schema already supports it -- add the verification step in the `authorize` callback.

---

### L-4. Presigned URL Expiry of 1 Hour May Be Excessive

**File**: `/Users/matt/fbar-automator/src/lib/s3.ts`, line 31
**Severity**: LOW
**Category**: Data Protection

```typescript
export async function getFileUrl(key: string, expiresIn = 3600): Promise<string> {
```

The default presigned URL expiry is 1 hour. For bank statements containing sensitive financial data, a shorter expiry (e.g., 5-15 minutes) would reduce the window of exposure if a URL is inadvertently shared or logged.

**Remediation**: Reduce the default expiry to 300 seconds (5 minutes) and allow callers to override when needed.

---

### L-5. No Content-Disposition Header Sanitization on Export Filenames

**File**: `/Users/matt/fbar-automator/src/app/api/export/[filingYearId]/csv/route.ts`, line 65; similar in XML and PDF routes
**Severity**: LOW
**Category**: Input Validation

```typescript
const lastName = filingYear.client.lastName.replace(/[^a-zA-Z0-9]/g, "_")
```

The filename sanitization is reasonable but could be improved. The `replace` regex removes non-alphanumeric characters, but the filename is interpolated into a `Content-Disposition` header without proper escaping per RFC 6266. Certain edge cases with Unicode characters or very long names could cause header injection.

**Remediation**: Use RFC 5987 encoding for the filename parameter, or truncate to a safe length:

```typescript
const safeName = lastName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 50)
```

---

## Category Detailed Analysis

### Authentication Security

**Strengths**:
- bcrypt with cost factor 12 for password hashing (line 60, register route)
- Timing-attack mitigation with dummy bcrypt compare on unknown users (line 57, auth.ts)
- Generic error message to prevent email enumeration during registration (line 52-56, register route)
- JWT-based sessions with 8-hour expiry (reasonable for financial app)
- Email normalization (lowercase + trim) on all auth operations

**Weaknesses**:
- No rate limiting on login/registration (C-3)
- Weak password policy (H-2)
- Insecure temporary password generation (C-4)
- No MFA implementation despite schema support (L-3)
- No session invalidation mechanism (M-8)
- No forced password change for temporary passwords (H-3)

---

### Authorization

**Strengths**:
- Every API route checks `auth()` for authentication
- Multi-tenant isolation via `practiceId` scoping on all database queries
- Ownership chain verification (account -> client -> practice) in nested routes
- ADMIN-only restrictions on settings updates and team management
- ADMIN-only restriction on exchange rate sync
- Filing status gating on XML export (must be EXPORTED or FILED)

**Weaknesses**:
- No Next.js middleware for defense-in-depth (H-1)
- No RBAC beyond ADMIN check -- PREPARER and REVIEWER have identical API access except for admin routes
- The DELETE `/api/clients/[clientId]` performs hard delete -- no soft-delete or role restriction (any authenticated user in the practice can delete)

---

### Input Validation

**Strengths**:
- Consistent Zod schema validation on all POST/PUT endpoints
- JSON parse error handling with try/catch on all routes
- Maximum length constraints on all string fields
- Enum validation for type fields (ClientType, AccountType, OwnershipType, etc.)
- File type whitelist validation on upload (PDF, JPEG, PNG, HEIC, TIFF)
- File size limit of 50MB on uploads

**Weaknesses**:
- No magic byte validation on uploaded files (M-2)
- No UUID format validation on URL parameters (M-3)
- No CSRF protection (M-1)
- No request body size limit on JSON API routes (M-6)

---

### Data Protection

**Strengths**:
- AES-256-GCM authenticated encryption with scrypt KDF (encryption.ts)
- TIN masking in all client API responses (last 4 digits only)
- TIN masking in CSV and PDF exports
- PDF workpaper marked "Confidential"
- FinCEN XML export gated behind filing status check (EXPORTED/FILED only)
- Comment in fincen-xml.ts explicitly warns about unmasked TINs
- Proper `Cache-Control: no-store` on export downloads

**Weaknesses**:
- TINs stored unencrypted in database (C-2)
- Hardcoded static salt in encryption KDF (C-1)
- No SSE on S3 objects (H-7)
- Account numbers in plain text in API responses (M-4)
- Account numbers in audit logs (H-4)
- Practice EIN unmasked in settings response (M-7)
- Error logs may contain PII (L-1)
- Presigned URL expiry too long (L-4)

---

### Infrastructure Security

**Strengths**:
- Multi-stage Docker build (minimizes attack surface)
- Non-root user in Docker container (nextjs:nodejs, UID 1001)
- Alpine-based images (minimal OS footprint)
- Health checks on all Docker Compose services
- `.env` properly in `.gitignore`
- Standalone Next.js output (minimal server deployment)
- `NEXT_TELEMETRY_DISABLED=1` in Docker

**Weaknesses**:
- No security headers configured (H-5)
- S3 default credentials in code (H-6)
- Database and Redis ports exposed to host (M-5)
- Redis has no authentication
- No TLS/HTTPS enforcement in Docker Compose
- MinIO console port (9001) exposed to host

---

### Compliance (GLBA/SOC 2)

**Strengths**:
- Comprehensive audit logging on all CRUD operations and exports
- IP address captured in audit log entries
- User ID and practice ID in all audit entries
- Entity type and entity ID for traceability
- Immutable audit log design (create-only, no update/delete routes)
- Role-based access control foundation (ADMIN, PREPARER, REVIEWER)

**Weaknesses**:
- No data retention policy implementation (audit logs grow indefinitely)
- No audit log for login success/failure events
- MFA not implemented (GLBA Safeguards Rule may require it)
- No encryption at rest for database (relies on infrastructure-level encryption)
- No access logging for read operations on PII (only mutations are logged)
- Full account numbers in audit log metadata (H-4)
- TINs not encrypted at rest (C-2)
- No email verification enforcement (User.emailVerified exists but is not checked)

---

## Recommendations (Prioritized)

### Immediate (Before Production)

1. **Encrypt TINs and EINs at rest** in the database using the existing encryption module (C-2)
2. **Fix the static salt** in encryption.ts to use per-record random salts (C-1)
3. **Implement rate limiting** using Redis, at minimum on authentication endpoints (C-3)
4. **Replace `Math.random()`** with `crypto.randomInt()` for temporary password generation (C-4)
5. **Add Next.js middleware** for centralized authentication and security headers (H-1, H-5)
6. **Remove S3 default credentials** fallback in production mode (H-6)
7. **Enable S3 server-side encryption** for uploaded bank statements (H-7)

### Before General Availability

8. **Strengthen password policy** to 12+ characters with complexity requirements (H-2)
9. **Implement forced password change** for temporary passwords (H-3)
10. **Mask account numbers** in API responses and audit logs (H-4, M-4)
11. **Restrict database/Redis ports** to Docker internal network in production compose (M-5)
12. **Add magic byte validation** for file uploads (M-2)
13. **Implement CSRF protection** or validate custom headers on mutations (M-1)

### Next Sprint

14. **Implement MFA** using the existing schema fields (L-3)
15. **Add structured logging** with PII scrubbing (L-1)
16. **Implement session invalidation** on password change (M-8)
17. **Add login event auditing** (success/failure) for SOC 2 compliance
18. **Implement data retention policies** for audit logs
19. **Add UUID validation** for all route parameters (M-3)
20. **Reduce presigned URL expiry** to 5 minutes (L-4)
21. **Mask Practice EIN** in settings API response (M-7)
22. **Add request body size limits** for JSON API routes (M-6)

---

## Positive Observations

The following security practices already in place demonstrate thoughtful security engineering:

1. **Timing-attack mitigation**: The auth.ts `authorize` function performs a dummy bcrypt compare when the user is not found (line 57), preventing user enumeration via response time analysis. This is above-average practice.

2. **Consistent TIN masking**: Every API route that returns client data masks TINs to show only the last 4 digits. This pattern is implemented in the route files themselves, not just at the frontend.

3. **Multi-tenant isolation by design**: All database queries include `practiceId` as a WHERE clause, and nested resource routes verify the full ownership chain (e.g., `account -> client -> practice`). This is the correct approach for multi-tenant SaaS.

4. **Comprehensive audit logging**: Every create, update, and delete operation writes an audit log entry with user ID, practice ID, entity type, entity ID, action description, metadata, and IP address. This is well-suited for SOC 2 compliance.

5. **Authenticated encryption (AES-256-GCM)**: The encryption module uses a strong AEAD cipher with random IVs, providing both confidentiality and integrity guarantees.

6. **Zod validation on all inputs**: Every API endpoint that accepts user input validates it through Zod schemas before processing. Error messages are sanitized and do not leak internal details.

7. **Generic error messages**: Server errors return "An internal error occurred" rather than stack traces or database error details. Registration uses a generic message to prevent email enumeration.

8. **Non-root Docker container**: The Dockerfile creates a dedicated `nextjs` user and runs the application as that user, following container security best practices.

9. **Export status gating**: The FinCEN XML export (containing unmasked TINs) is restricted to filings in EXPORTED or FILED status, preventing premature access to unreviewed sensitive data.

10. **No-cache on exports**: All export endpoints set `Cache-Control: no-store` to prevent sensitive financial documents from being cached by browsers or intermediaries.

---

*End of Security Audit Report*
