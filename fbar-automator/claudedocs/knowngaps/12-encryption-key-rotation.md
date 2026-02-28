# Gap #12: No Encryption Key Rotation

> **STATUS: COMPLETE (2026-02-21)**
> Versioned ciphertext format (`v1:iv:authTag:ciphertext`) implemented. Multi-key support via `ENCRYPTION_KEYS` JSON map. `safeDecrypt` fix in sign flow (hard error on decryption failure instead of silent empty string). Migration script `d2c/scripts/rotate-encryption-key.ts` created. Committed as part of Phase 5 security hardening sprint.

**Severity:** Medium
**Effort:** L (4-8 hours)
**Depends on:** None

## Problem

The AES-256-GCM ciphertext format stored in the database is `iv:authTag:ciphertext` with no key version prefix. There is no mechanism to rotate `ENCRYPTION_KEY` without making every stored TIN and account number permanently unreadable. `safeDecrypt` catches the resulting decryption failure and silently returns an empty string, so data loss is invisible at runtime — users simply see blank TIN/account number fields with no error surfaced.

The three encrypted fields at risk are:
- `User.tin` — used in sign flow to derive `tinLast4` for the FBAR XML header
- `ForeignAccount.accountNumber` — used in review, XML export, and the `accountNumberLast4` display
- `Signature.signatureData` — stored encrypted at sign time

A key rotation event (e.g., the `ENCRYPTION_KEY` env var is changed, or the secret is rotated as part of a security incident response) currently has no recovery path short of deleting and re-collecting data from every user.

## Current State

**File:** `d2c/src/lib/encryption.ts`

- Line 7-15: `getKey()` reads `ENCRYPTION_KEY` from env at call time. Single active key, no version awareness.
- Line 17-24: `encrypt()` produces `iv:authTag:ciphertext` — a 3-part colon-delimited hex string. No version prefix.
- Line 26-36: `decrypt()` splits on `:` and assumes exactly 3 parts. Will throw if passed a versioned format (4 parts).
- Line 38-46: `safeDecrypt()` catches all exceptions and returns `""`. The `console.warn` at line 43 is the only signal of a decryption failure — nothing is surfaced to the user or to monitoring.

**Callers of `encrypt()`:**
- `d2c/src/app/api/accounts/route.ts:90` — `accountNumber` on account creation (POST)
- `d2c/src/app/api/accounts/[accountId]/route.ts:72` — `accountNumber` on account update (PATCH)
- `d2c/src/app/api/user/route.ts:74` — `user.tin` on user profile save (PATCH)
- `d2c/src/app/api/filing/sign/route.ts:91` — `signatureData` on sign submission (POST)

**Callers of `safeDecrypt()`:**
- `d2c/src/lib/account-mapper.ts:9` — `accountNumberLast4` derivation for review/XML
- `d2c/src/app/api/filing/sign/route.ts:76` — `tinLast4` for FBAR XML header
- `d2c/src/app/api/user/route.ts:23` — returning decrypted TIN to the profile page

## Implementation Plan

The approach is to prefix ciphertext with a key version tag (`v1:iv:authTag:ciphertext`), support multiple active keys in env for decryption, and provide a migration script that re-encrypts all rows from the old key to the new key without downtime.

### Step 1: Extend `encryption.ts` to support versioned ciphertext

Add a `ENCRYPTION_KEYS` env var that holds a JSON map of `{ "v1": "<hex>", "v2": "<hex>" }`. The current `ENCRYPTION_KEY` becomes key `v1` for backward compatibility. A separate `ENCRYPTION_KEY_VERSION` env var (e.g., `"v2"`) designates which version is used for new encryptions.

```typescript
// New env vars:
// ENCRYPTION_KEYS={"v1":"<64-hex-old-key>","v2":"<64-hex-new-key>"}
// ENCRYPTION_KEY_VERSION=v2   (the active version for new encrypts)

function getKeyMap(): Map<string, Buffer> {
  const raw = process.env.ENCRYPTION_KEYS;
  if (!raw) {
    // Backward-compat: fall back to single ENCRYPTION_KEY as v1
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error("ENCRYPTION_KEYS or ENCRYPTION_KEY is required");
    const buf = Buffer.from(key, "hex");
    if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes");
    return new Map([["v1", buf]]);
  }
  const parsed: Record<string, string> = JSON.parse(raw);
  const map = new Map<string, Buffer>();
  for (const [version, hex] of Object.entries(parsed)) {
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) throw new Error(`Key ${version} must be 32 bytes`);
    map.set(version, buf);
  }
  return map;
}

function getActiveVersion(): string {
  return process.env.ENCRYPTION_KEY_VERSION ?? "v1";
}

function getActiveKey(): Buffer {
  const version = getActiveVersion();
  const key = getKeyMap().get(version);
  if (!key) throw new Error(`No key found for version ${version}`);
  return key;
}
```

Update `encrypt()` to prepend the version:

```typescript
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const version = getActiveVersion();
  const key = getActiveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // New format: v2:iv:authTag:ciphertext
  return `${version}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}
```

Update `decrypt()` to detect and handle both old (3-part) and new (4-part) formats:

```typescript
export function decrypt(encrypted: string): string {
  if (!encrypted) return "";
  const parts = encrypted.split(":");
  let version: string;
  let ivHex: string;
  let authTagHex: string;
  let cipherHex: string;

  if (parts.length === 3) {
    // Legacy format (no version prefix) — assume v1
    [ivHex, authTagHex, cipherHex] = parts;
    version = "v1";
  } else if (parts.length === 4) {
    [version, ivHex, authTagHex, cipherHex] = parts;
  } else {
    throw new Error("Invalid encrypted format");
  }

  const keyMap = getKeyMap();
  const key = keyMap.get(version);
  if (!key) throw new Error(`No decryption key for version: ${version}`);

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}
```

`safeDecrypt()` requires no changes — it already catches and warns on failure.

### Step 2: Write a key rotation migration script

Create `d2c/scripts/rotate-encryption-key.ts`. This script reads every encrypted field, decrypts with the old key (via the multi-key `decrypt()`), and re-encrypts under the new active version. It must be idempotent — rows already on the new version are skipped.

```typescript
// d2c/scripts/rotate-encryption-key.ts
// Run with: npx tsx scripts/rotate-encryption-key.ts
// Requires ENCRYPTION_KEYS and ENCRYPTION_KEY_VERSION set in env.

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

const TARGET_VERSION = process.env.ENCRYPTION_KEY_VERSION ?? "v2";

async function rotateField(
  label: string,
  value: string | null,
): Promise<string | null> {
  if (!value) return value;
  const currentVersion = value.split(":")[0];
  if (currentVersion === TARGET_VERSION) return value; // already rotated
  const plaintext = decrypt(value); // uses multi-key map
  return encrypt(plaintext); // encrypts under TARGET_VERSION
}

async function main() {
  console.log(`Rotating to key version: ${TARGET_VERSION}`);

  // Rotate User.tin
  const users = await prisma.user.findMany({ where: { tin: { not: null } } });
  console.log(`Rotating ${users.length} user TINs...`);
  for (const user of users) {
    const rotated = await rotateField("tin", user.tin);
    if (rotated !== user.tin) {
      await prisma.user.update({ where: { id: user.id }, data: { tin: rotated } });
    }
  }

  // Rotate ForeignAccount.accountNumber
  const accounts = await prisma.foreignAccount.findMany({
    where: { accountNumber: { not: null } },
  });
  console.log(`Rotating ${accounts.length} account numbers...`);
  for (const account of accounts) {
    const rotated = await rotateField("accountNumber", account.accountNumber);
    if (rotated !== account.accountNumber) {
      await prisma.foreignAccount.update({
        where: { id: account.id },
        data: { accountNumber: rotated },
      });
    }
  }

  // Rotate Signature.signatureData
  const signatures = await prisma.signature.findMany({
    where: { signatureData: { not: null } },
  });
  console.log(`Rotating ${signatures.length} signatures...`);
  for (const sig of signatures) {
    const rotated = await rotateField("signatureData", sig.signatureData);
    if (rotated !== sig.signatureData) {
      await prisma.signature.update({
        where: { id: sig.id },
        data: { signatureData: rotated },
      });
    }
  }

  console.log("Rotation complete.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

### Step 3: Update `.env` and `.env.unified.example`

Add new env vars alongside the existing `ENCRYPTION_KEY`:

```env
# Key rotation support — JSON map of all known key versions
# When rotating: add the new version here, set ENCRYPTION_KEY_VERSION to it,
# run the rotation script, then remove old versions from this map.
ENCRYPTION_KEYS={"v1":"<your-64-hex-key>"}
ENCRYPTION_KEY_VERSION=v1

# Legacy — kept for backward compat; used as v1 if ENCRYPTION_KEYS is absent
ENCRYPTION_KEY=<your-64-hex-key>
```

### Step 4: Key rotation runbook (add to `claudedocs/B2B-OPS-RUNBOOK.md`)

Document the rotation procedure:

1. Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add new version to `ENCRYPTION_KEYS` in `.env.prod`: `{"v1":"<old>","v2":"<new>"}`
3. Set `ENCRYPTION_KEY_VERSION=v2`
4. Deploy (new encrypts go to v2; v1 ciphertext still decrypts correctly)
5. SSH to server; run rotation script: `npx tsx scripts/rotate-encryption-key.ts`
6. Verify: query the DB and confirm all ciphertext starts with `v2:`
7. Remove `v1` from `ENCRYPTION_KEYS`, redeploy

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/encryption.ts` | Replace single-key logic with versioned multi-key map; update `encrypt()` and `decrypt()` |
| `d2c/scripts/rotate-encryption-key.ts` | New: rotation migration script |
| `d2c/.env.example` | Add `ENCRYPTION_KEYS` and `ENCRYPTION_KEY_VERSION` vars |
| `fbar-automator/.env.unified.example` | Add same vars to unified example |
| `claudedocs/B2B-OPS-RUNBOOK.md` | Add key rotation runbook section |

## Environment / Config Changes

| Var | Description |
|---|---|
| `ENCRYPTION_KEYS` | JSON object mapping version strings to 64-hex keys. Example: `{"v1":"aabbcc..."}` |
| `ENCRYPTION_KEY_VERSION` | The active version used for new encryptions. Default: `"v1"` |
| `ENCRYPTION_KEY` | Retained for backward compat; treated as v1 when `ENCRYPTION_KEYS` is absent |

No Docker Compose changes required — these are standard env vars passed through the existing `env_file` mechanism.

## Testing

**Unit tests** — add to `d2c/src/lib/__tests__/encryption.test.ts` (or create it):
- `encrypt()` output starts with the active version prefix (`v1:` or `v2:`)
- `decrypt()` correctly handles legacy 3-part format (no version prefix)
- `decrypt()` correctly handles new 4-part format
- `decrypt()` decrypts v1 ciphertext when only `v2` is active but `v1` key is in map
- `decrypt()` throws when version is not in key map
- `safeDecrypt()` returns `""` and does not throw when version is missing from map
- Round-trip: `decrypt(encrypt(plaintext)) === plaintext` for both v1 and v2

**Rotation script test** (against local dev DB):
1. Create test records encrypted with v1
2. Set `ENCRYPTION_KEY_VERSION=v2` and add v2 key to `ENCRYPTION_KEYS`
3. Run `npx tsx scripts/rotate-encryption-key.ts`
4. Confirm all records now start with `v2:`
5. Remove v1 from map; confirm `safeDecrypt` still returns correct plaintext for v2 records

**Manual check:**
- Load `/api/user` with a v1-encrypted TIN; confirm it still decrypts and returns last 4 digits correctly

## Risks / Notes

- **Never remove old key from `ENCRYPTION_KEYS` before running the rotation script.** Removing it first makes existing rows undecryptable. The rotation script must complete successfully before the old key version is dropped.
- **Single-server constraint:** The rotation script updates rows one-by-one in a loop. For the current data volume (early MVP, hundreds of users) this is fine. At scale, batch in transactions of 100 rows.
- **`Signature.signatureData` schema:** Verify this column exists on the `Signature` model before running the rotation script. If the column name differs, update the script accordingly.
- **The `safeDecrypt` silent-return-empty behavior** is unchanged by this fix — it remains the caller's responsibility to handle blank values. Consider adding a structured log line (e.g., JSON with `userId`, `field`, `version`) so that failed decryptions are observable in production logs.
- **No Prisma migration required** — these are all application-level changes to existing string columns.
