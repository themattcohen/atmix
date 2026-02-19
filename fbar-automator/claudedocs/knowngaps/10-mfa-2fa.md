# Gap #10: MFA / 2FA

**Severity:** Medium
**Effort:** XL (1-3 days)
**Depends on:** None

## Problem

The D2C app has no second authentication factor. A username and password alone protect access to sensitive financial data including SSNs (encrypted TINs), foreign account numbers, and FBAR filing records. FTC Safeguards Rule (16 CFR Part 314) requires MFA for any non-bank financial institution that handles consumer financial data, which this application does.

Beyond regulatory compliance, the absence of MFA creates real user risk: credential stuffing attacks or a breached password at any other site grants immediate full access to a filer's complete financial profile.

## Current State

**`d2c/src/lib/auth.ts`** — The entire auth stack is a single Credentials provider with bcrypt password check (lines 14-60). Login returns `{ id, email, name, tokenVersion }` and mints a 30-day JWT. There is no MFA challenge step and no hook point for one. The JWT callback (lines 68-76) never re-validates MFA status.

**`d2c/prisma/schema.prisma`** — The `User` model (lines 11-41) has no `mfaEnabled`, `mfaSecret`, or `mfaVerifiedAt` fields. There is no `MfaRecoveryCode` model.

**`d2c/src/middleware.ts`** — Middleware handles route protection but has no MFA enforcement logic; a logged-in user with no second factor passes through to all protected routes without any MFA check.

The B2B roadmap (`claudedocs/B2B-ROADMAP.md`, lines 68-106) contains a detailed MFA design for the B2B app using `otpauth` and a `mfaPending` JWT flag. The D2C implementation should follow the same pattern, adapted for the D2C schema and routes.

## Implementation Plan

### Step 1: Add npm dependencies

```
npm install otpauth qrcode
npm install --save-dev @types/qrcode
```

- `otpauth` — zero-dependency TOTP library (RFC 6238 compliant)
- `qrcode` — generates QR code data URLs for authenticator app setup

### Step 2: Prisma schema changes

Add the following to the `User` model in `d2c/prisma/schema.prisma`:

```prisma
// User model — add these fields after `lockoutUntil`
mfaEnabled    Boolean   @default(false)
mfaSecret     String?   // Base32-encoded TOTP secret, stored encrypted
mfaVerifiedAt DateTime? // When MFA was last successfully verified this session
recoveryCodes MfaRecoveryCode[]
```

Add the new model after `PasswordResetToken`:

```prisma
model MfaRecoveryCode {
  id        String   @id @default(cuid())
  userId    String
  codeHash  String   // SHA-256 of the plaintext code
  used      Boolean  @default(false)
  usedAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Run migration:
```
npx prisma migrate dev --name add_mfa
```

### Step 3: MFA utility library — `d2c/src/lib/mfa.ts` (new file)

```typescript
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

const ISSUER = "FBARDirect";
const DIGITS = 6;
const PERIOD = 30;
const WINDOW = 1; // accept 1 step before/after for clock skew

/** Generate a new TOTP secret and return base32 string */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** Generate the otpauth:// URI for QR code */
export function generateTotpUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: email, secret, digits: DIGITS, period: PERIOD });
  return totp.toString();
}

/** Generate QR code as data URL */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

/** Verify a TOTP token. Returns true if valid. */
export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({ secret, digits: DIGITS, period: PERIOD });
  const delta = totp.validate({ token, window: WINDOW });
  return delta !== null;
}

/** Generate 8 recovery codes in XXXX-XXXX format */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const a = crypto.randomBytes(2).toString("hex").toUpperCase();
    const b = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${a}-${b}`;
  });
}

/** Hash a recovery code for storage */
export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase().replace("-", "")).digest("hex");
}
```

### Step 4: MFA setup API routes (new files)

**`d2c/src/app/api/auth/mfa/setup/route.ts`** — Initiate MFA enrollment:
```
GET /api/auth/mfa/setup
- Requires authenticated session (no MFA check yet)
- Generates new TOTP secret via generateTotpSecret()
- Stores secret in user.mfaSecret (NOT yet enabled)
- Returns { qrCodeDataUrl, secret } for display
```

**`d2c/src/app/api/auth/mfa/verify-setup/route.ts`** — Complete enrollment:
```
POST /api/auth/mfa/verify-setup  body: { token: string }
- Requires authenticated session
- Reads user.mfaSecret from DB
- Calls verifyTotp(secret, token)
- On success:
    - Sets user.mfaEnabled = true
    - Generates 8 recovery codes, hashes and saves as MfaRecoveryCode rows
    - Returns plaintext codes once (never again)
- On failure: return 400 { error: "Invalid token" }
```

**`d2c/src/app/api/auth/mfa/verify/route.ts`** — MFA challenge during login:
```
POST /api/auth/mfa/verify  body: { token: string }
- Requires mfaPending JWT (check token.mfaPending === true)
- Reads user from DB, verifies TOTP or recovery code
- Recovery code path: hash input, find matching unused MfaRecoveryCode,
  mark used, set usedAt = now()
- On success:
    - Set httpOnly cookie "mfa-verified" = userId + HMAC, maxAge 5 minutes
    - Return 200 { ok: true }
- On failure: return 401 { error: "Invalid code" }
```

**`d2c/src/app/api/auth/mfa/disable/route.ts`** — Disable MFA:
```
POST /api/auth/mfa/disable  body: { password: string, token: string }
- Requires authenticated session with completed MFA
- Verifies password with bcrypt
- Verifies TOTP
- Sets mfaEnabled = false, mfaSecret = null
- Deletes all MfaRecoveryCode rows for user
```

**`d2c/src/app/api/auth/mfa/recovery-codes/route.ts`** — Regenerate recovery codes:
```
POST /api/auth/mfa/recovery-codes  body: { token: string }
- Requires authenticated session with completed MFA
- Verifies current TOTP
- Deletes all existing MfaRecoveryCode rows for user
- Generates 8 new codes, hashes and saves
- Returns plaintext codes
```

### Step 5: Modify `d2c/src/lib/auth.ts`

**In the `authorize` callback** (currently lines 14-59):

After successful password verification and before returning the user object, add:

```typescript
// If MFA is enabled, return mfaPending flag instead of full session
if (user.mfaEnabled) {
  return {
    id: user.id,
    email: user.email,
    name: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
    tokenVersion: user.tokenVersion,
    mfaPending: true,  // signals JWT callback to set pending flag
  };
}
```

The existing return (lines 54-59) becomes the non-MFA path.

**In the `jwt` callback** (lines 68-76):

```typescript
async jwt({ token, user, req }) {
  if (user) {
    token.id = user.id;
    token.tokenVersion = (user as any).tokenVersion;
    token.mfaPending = (user as any).mfaPending ?? false;
  }

  // Check mfa-verified cookie to clear mfaPending
  // This cookie is set by POST /api/auth/mfa/verify
  if (token.mfaPending) {
    const mfaVerifiedCookie = req?.cookies?.get("mfa-verified")?.value;
    if (mfaVerifiedCookie && isMfaVerifiedCookieValid(mfaVerifiedCookie, token.id as string)) {
      token.mfaPending = false;
    }
  }

  return token;
},
```

`isMfaVerifiedCookieValid` is a pure function (no Prisma) that verifies the HMAC on the cookie value — safe for Edge runtime.

**In the `session` callback** (lines 78-88): pass `mfaPending` through to the session so client components can read it.

### Step 6: Middleware enforcement — `d2c/src/middleware.ts`

After the existing auth check, add:

```typescript
// If JWT has mfaPending, only allow MFA-related routes
if (token?.mfaPending) {
  const isMfaRoute = request.nextUrl.pathname.startsWith("/mfa-verify") ||
                     request.nextUrl.pathname.startsWith("/api/auth/mfa/") ||
                     request.nextUrl.pathname.startsWith("/api/auth/signout");
  if (!isMfaRoute) {
    // Block API calls with 403; redirect page requests to MFA verification
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "MFA verification required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/mfa-verify", request.url));
  }
}
```

**⚠️ Cross-Gap Resolution (Conflict #4):** The MFA middleware check must cover both page routes AND API routes. Without the API check, a user with `mfaPending` could still call `/api/user`, `/api/accounts`, etc. and access sensitive data before completing MFA verification.

### Step 7: MFA UI pages (new files)

**`d2c/src/app/(auth)/mfa-verify/page.tsx`** — Login MFA challenge page:
- Shows a numeric input for 6-digit TOTP
- "Use a recovery code" toggle for text input
- On submit: POST `/api/auth/mfa/verify`
- On success: `router.push("/dashboard")`
- Rate limit: 5 attempts before 15-minute lockout (enforce server-side in the route handler)

**`d2c/src/app/(app)/settings/mfa/page.tsx`** — MFA settings:
- If `mfaEnabled === false`: "Enable MFA" button that calls `/api/auth/mfa/setup`, displays QR code and manual entry key, then TOTP confirmation field
- If `mfaEnabled === true`: Shows enabled status, "Regenerate recovery codes" button, "Disable MFA" button (requires password + TOTP confirmation)
- After enabling: shows recovery codes once with copy-all button and "I've saved these codes" confirmation

## Files to Modify

| File | Change |
|---|---|
| `d2c/prisma/schema.prisma` | Add `mfaEnabled`, `mfaSecret` to User; add `MfaRecoveryCode` model |
| `d2c/src/lib/auth.ts` | Add `mfaPending` JWT flag, cookie check in jwt callback |
| `d2c/src/middleware.ts` | Add `mfaPending` redirect to `/mfa-verify` |
| `d2c/package.json` | Add `otpauth`, `qrcode`, `@types/qrcode` |

## Files to Create

| File | Purpose |
|---|---|
| `d2c/src/lib/mfa.ts` | TOTP generation/verification, recovery code helpers |
| `d2c/src/app/api/auth/mfa/setup/route.ts` | Initiate enrollment |
| `d2c/src/app/api/auth/mfa/verify-setup/route.ts` | Complete enrollment |
| `d2c/src/app/api/auth/mfa/verify/route.ts` | Login challenge |
| `d2c/src/app/api/auth/mfa/disable/route.ts` | Disable MFA |
| `d2c/src/app/api/auth/mfa/recovery-codes/route.ts` | Regenerate recovery codes |
| `d2c/src/app/(auth)/mfa-verify/page.tsx` | MFA challenge page during login |
| `d2c/src/app/(app)/settings/mfa/page.tsx` | MFA settings page |

## Environment / Config Changes

No new environment variables required. The HMAC key for the `mfa-verified` cookie should reuse the existing `AUTH_SECRET` / `NEXTAUTH_SECRET` environment variable.

If `mfaSecret` is stored encrypted (recommended), the existing AES-256-GCM encryption used for TIN and account numbers (`d2c/src/lib/crypto.ts` or equivalent) should be reused. No new env vars needed beyond the existing `ENCRYPTION_KEY`.

## Testing

**Unit tests** — `d2c/src/lib/mfa.ts`:
- `generateTotpSecret()` returns a valid base32 string of expected length
- `verifyTotp(secret, token)` returns true for a valid current token
- `verifyTotp(secret, "000000")` returns false
- `generateRecoveryCodes()` returns 8 strings matching `[A-F0-9]{4}-[A-F0-9]{4}`
- `hashRecoveryCode()` is deterministic and case/hyphen-insensitive

**Integration tests** — API routes:
- `GET /api/auth/mfa/setup` returns 401 without session
- `POST /api/auth/mfa/verify-setup` with invalid token returns 400
- `POST /api/auth/mfa/verify-setup` with valid token sets `mfaEnabled = true` and returns 8 codes
- `POST /api/auth/mfa/verify` with valid TOTP clears `mfaPending` (cookie set)
- Recovery code path: used code rejected on second use

**E2E tests** (Playwright):
- Full MFA enrollment flow: login -> settings -> enable MFA -> scan QR -> enter TOTP -> see recovery codes
- Login flow with MFA: enter credentials -> redirected to `/mfa-verify` -> enter TOTP -> reach dashboard
- Login flow with MFA + recovery code: enter credentials -> use recovery code -> reach dashboard, code marked used
- Middleware enforcement: manually navigate to `/dashboard` with `mfaPending` cookie -> redirected to `/mfa-verify`

**Manual check:**
- Use Google Authenticator or Authy to scan QR code and confirm codes work
- Test clock skew: verify a token generated 25 seconds ago still validates (window=1 allows one 30s period drift)

## ⚠️ Cross-Gap Coordination: CSRF Headers Required (Gap #13)

Gap #13 narrows the CSRF exemption in middleware.ts from a blanket `/api/auth/*` to only NextAuth-internal routes (`/api/auth/callback`, `/api/auth/signin`, `/api/auth/signout`). After that change, ALL browser-side `fetch()` calls to `/api/auth/mfa/*` routes MUST include the `X-Requested-With: XMLHttpRequest` header.

When implementing the MFA UI pages (Step 7), every fetch call in both `mfa-verify/page.tsx` and `settings/mfa/page.tsx` must include:

```typescript
headers: {
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",  // Required after Gap #13 CSRF narrowing
}
```

This applies to all calls to:
- `POST /api/auth/mfa/verify`
- `GET /api/auth/mfa/setup`
- `POST /api/auth/mfa/verify-setup`
- `POST /api/auth/mfa/disable`
- `POST /api/auth/mfa/recovery-codes`

## Risks / Notes

- **Edge runtime constraint**: The `jwt` callback runs on Edge. The MFA verification must use a signed cookie (HMAC, no DB call) rather than a DB lookup. The cookie value should be `userId + "." + HMAC(userId, AUTH_SECRET)` with a short `maxAge` (5 minutes). This is the same pattern noted in the B2B roadmap (`claudedocs/B2B-ROADMAP.md`, line 79).
- **mfaSecret encryption**: Storing the TOTP secret in plaintext gives any DB-read attacker the ability to generate valid OTPs. Use the same AES-256-GCM encryption already used for TINs.
- **Recovery code UX**: Codes must be shown exactly once after setup. The page should require a "I have saved these codes" checkbox before proceeding. There is no server-side way to re-display them.
- **Optional vs mandatory MFA**: FTC Safeguards Rule requires MFA be available; whether it is forced on all users or opt-in is a product decision. Recommended: opt-in initially, mandatory before FBAR submission (at the `/payment` step).
- **Authenticator app compatibility**: `otpauth` generates standard RFC 6238 TOTP codes compatible with Google Authenticator, Authy, 1Password, and Bitwarden.
- **Migration safety**: Adding nullable fields (`mfaEnabled Boolean @default(false)`, `mfaSecret String?`) is a non-destructive migration on the existing `User` table.
