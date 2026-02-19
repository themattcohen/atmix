# Gap #9: SDTM Host Key Verification Skipped in Production

**Severity:** High
**Effort:** M (1-4 hours)
**Depends on:** None

## Problem

`sdtm.ts` contains host key pinning logic but it is silently skipped whenever `SDTM_HOST_KEY` is absent from the environment. Both env templates (`d2c/.env.example` and `.env.unified.example`) and the Docker Compose production file (`docker-compose.prod.yml`) omit `SDTM_HOST_KEY` entirely. The result is that the SFTP connection to FinCEN's BSA E-Filing SDTM server runs without host key verification in any deployment that follows the documented configuration path.

Without host key verification, an attacker who can intercept traffic between the container and the SFTP server (e.g. via ARP spoofing on the host, a rogue DNS response, or a compromised network path) can impersonate the FinCEN SFTP endpoint. The SSH client will silently accept the attacker's key, allowing:

- Exfiltration of submitted FBAR XML payloads (containing taxpayer TINs, foreign account numbers, and balances)
- Injection of tampered or forged XML into the FinCEN submission pipeline
- Silent loss of submitted filings (attacker accepts the upload and discards it)

The risk is currently mitigated by `SDTM_SANDBOX_MODE=true` in all templates, which skips the real SFTP connection. However, the gap becomes a live vulnerability the moment an operator sets `SDTM_SANDBOX_MODE=false` to enable production filing — which is precisely the change documented as the next step in going live.

## Current State

**File:** `d2c/src/lib/sdtm.ts`

Lines 20-46 — `getSFTPConnectConfig()`:
```ts
function getSFTPConnectConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {
    host: process.env.SDTM_HOST,
    port: parseInt(process.env.SDTM_PORT || "22"),
    username: process.env.SDTM_USERNAME,
  };

  const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
  if (keyPath) {
    config.privateKey = fs.readFileSync(keyPath);
  }

  const hostKey = process.env.SDTM_HOST_KEY;   // line 32
  if (hostKey) {
    config.hostVerifier = (key: Buffer) => {
      const matches = key.toString("base64") === hostKey;
      if (!matches) {
        console.error("[SDTM] SFTP host key mismatch — possible MITM attack");
      }
      return matches;
    };
  } else {
    // Warning logged but connection proceeds without verification
    console.warn("[SDTM] SFTP_HOST_KEY not set — skipping host key verification (unsafe for production)");
  }

  return config;
}
```

The `else` branch at line 41-43 logs a warning but does NOT abort or throw. The `ssh2` library's default behavior when `hostVerifier` is absent is to accept any host key.

**File:** `d2c/.env.example` — `SDTM_HOST_KEY` is entirely absent (lines 32-38):
```
SDTM_HOST=""
SDTM_PORT="22"
SDTM_USERNAME=""
SDTM_PRIVATE_KEY_PATH=""
SDTM_REMOTE_DIR="/upload"
SDTM_SANDBOX_MODE="true"
```

**File:** `.env.unified.example` — `SDTM_HOST_KEY` is entirely absent (lines 138-144):
```
SDTM_HOST=
SDTM_PORT=22
SDTM_USERNAME=
SDTM_PRIVATE_KEY_PATH=
SDTM_REMOTE_DIR=/upload
SDTM_SANDBOX_MODE=true
```

**File:** `docker-compose.prod.yml` — `d2c-app` environment block (lines 212-217) forwards six SDTM vars but not `SDTM_HOST_KEY`:
```yaml
- SDTM_HOST=${SDTM_HOST}
- SDTM_PORT=${SDTM_PORT}
- SDTM_USERNAME=${SDTM_USERNAME}
- SDTM_PRIVATE_KEY_PATH=${SDTM_PRIVATE_KEY_PATH}
- SDTM_REMOTE_DIR=${SDTM_REMOTE_DIR}
- SDTM_SANDBOX_MODE=${SDTM_SANDBOX_MODE}
```

## Implementation Plan

### Step 1: Harden `getSFTPConnectConfig()` in `sdtm.ts`

Change the `else` branch so that when `SDTM_HOST_KEY` is absent and sandbox mode is off, the function throws rather than proceeding. Sandbox mode is already checked by `isSandbox()` before `getSFTPConnectConfig()` is called in `submitBatch` and `checkAcknowledgement`, so the throw will only fire in production paths.

```ts
const hostKey = process.env.SDTM_HOST_KEY;
if (hostKey) {
  config.hostVerifier = (key: Buffer) => {
    const received = key.toString("base64");
    const matches = received === hostKey;
    if (!matches) {
      console.error(
        "[SDTM] SFTP host key mismatch — possible MITM attack. " +
        `Expected: ${hostKey.slice(0, 12)}... Got: ${received.slice(0, 12)}...`
      );
    }
    return matches;
  };
} else {
  throw new Error(
    "[SDTM] SDTM_HOST_KEY is not set. Host key verification is required " +
    "for production SFTP connections. Set SDTM_SANDBOX_MODE=true to skip " +
    "SFTP in non-production environments."
  );
}
```

This makes misconfiguration a hard failure rather than a silent security bypass. The caller (`submitBatch`) already wraps the connection in a `Promise` with a `conn.on("error")` handler, so the throw will propagate as a rejected promise and be returned as `{ success: false, error: "..." }`.

### Step 2: Add `SDTM_HOST_KEY` to `d2c/.env.example`

Append to the SDTM block after `SDTM_SANDBOX_MODE`:
```
# Base64-encoded SSH host public key for the FinCEN SDTM SFTP server.
# Required when SDTM_SANDBOX_MODE=false. Obtain with:
#   ssh-keyscan -p 22 <SDTM_HOST> 2>/dev/null | awk '{print $3}'
# Leave blank only if SDTM_SANDBOX_MODE=true.
SDTM_HOST_KEY=""
```

### Step 3: Add `SDTM_HOST_KEY` to `.env.unified.example`

In the `D2C FinCEN SFTP` section (after `SDTM_SANDBOX_MODE=true`), append:
```
# Base64-encoded SSH host public key for the FinCEN SDTM SFTP server.
# Required when SDTM_SANDBOX_MODE=false (i.e., live FinCEN submissions).
# Obtain: ssh-keyscan -p 22 <SDTM_HOST> 2>/dev/null | awk '{print $3}'
SDTM_HOST_KEY=
```

Also add item 14 to the Production Checklist at the bottom of the file:
```
# 14. SDTM_HOST_KEY → base64 host key fingerprint from FinCEN SFTP server (required when SDTM_SANDBOX_MODE=false)
```
(Shift the existing item 14 `B2B_DOMAIN/D2C_DOMAIN` to item 15, and so on.)

### Step 4: Add `SDTM_HOST_KEY` to `docker-compose.prod.yml`

In the `d2c-app` environment block, add the new variable after `SDTM_SANDBOX_MODE`:
```yaml
- SDTM_HOST_KEY=${SDTM_HOST_KEY}
```

### Step 5: Obtain the FinCEN SDTM host key (operator runbook step)

This is an operational step, not a code change. Document the procedure in `claudedocs/B2B-OPS-RUNBOOK.md` or a new `claudedocs/SDTM-SETUP.md`:

```bash
# Fetch the SFTP server's host key in base64 format:
ssh-keyscan -p 22 <SDTM_HOST> 2>/dev/null | awk '{print $3}'
```

The output is the base64-encoded host public key to set as `SDTM_HOST_KEY`. Run this from a trusted network and verify the fingerprint against FinCEN's published documentation before pinning it.

Note: FinCEN rotates SFTP host keys periodically. When this happens, the SFTP connection will fail with a host key mismatch error (logged as `[SDTM] SFTP host key mismatch`). The operator must re-run `ssh-keyscan`, update `SDTM_HOST_KEY` in `.env`, and redeploy. This is intentional fail-secure behavior.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/sdtm.ts` | Replace the `else` branch in `getSFTPConnectConfig()` to throw instead of warn |
| `d2c/.env.example` | Add `SDTM_HOST_KEY=""` with explanatory comment to the SDTM block |
| `.env.unified.example` | Add `SDTM_HOST_KEY=` to the D2C FinCEN SFTP section + add to Production Checklist |
| `docker-compose.prod.yml` | Add `- SDTM_HOST_KEY=${SDTM_HOST_KEY}` to `d2c-app` environment block |

## Environment / Config Changes

New environment variable required for production SFTP use:

| Variable | Where | Value |
|---|---|---|
| `SDTM_HOST_KEY` | `.env` (prod), `d2c/.env` (local) | Base64 SSH host public key, obtained via `ssh-keyscan` |

No database migrations. No infrastructure changes. The variable is optional when `SDTM_SANDBOX_MODE=true` (the hardened `throw` only fires in production paths that actually attempt an SFTP connection).

## Testing

### Unit test: `getSFTPConnectConfig` throws when key is absent

```ts
// d2c/src/lib/__tests__/sdtm.test.ts
import { getSFTPConnectConfig } from "../sdtm"; // export the function for testing

describe("getSFTPConnectConfig", () => {
  it("throws when SDTM_HOST_KEY is unset", () => {
    delete process.env.SDTM_HOST_KEY;
    expect(() => getSFTPConnectConfig()).toThrow(
      "SDTM_HOST_KEY is not set"
    );
  });

  it("sets hostVerifier when SDTM_HOST_KEY is present", () => {
    process.env.SDTM_HOST_KEY = "AAAA1234";
    const config = getSFTPConnectConfig();
    expect(typeof config.hostVerifier).toBe("function");
  });
});
```

Note: `getSFTPConnectConfig` is currently not exported. To enable unit testing, export it or extract its behavior into a testable helper.

### Integration test: sandbox mode bypasses SFTP entirely

Verify that with `SDTM_SANDBOX_MODE=true` and no `SDTM_HOST_KEY`, `submitBatch` and `checkAcknowledgement` return successfully without connecting:

```ts
process.env.SDTM_SANDBOX_MODE = "true";
delete process.env.SDTM_HOST_KEY;
const result = await submitBatch("<xml/>", "test-batch-001");
expect(result.success).toBe(true);
```

### Manual smoke test (pre-production)

1. Set `SDTM_SANDBOX_MODE=false` and unset `SDTM_HOST_KEY`
2. Trigger a filing submission that calls `submitBatch`
3. Expected: request fails with `{ success: false, error: "[SDTM] SDTM_HOST_KEY is not set..." }`
4. Set `SDTM_HOST_KEY` to the correct base64 key from `ssh-keyscan`
5. Retry the submission
6. Expected: SFTP connection succeeds and file is uploaded

### Log verification

Monitor application logs during the first live submission for the absence of `[SDTM] SFTP host key mismatch`. A mismatch log indicates either a key rotation or an active MITM — both require immediate investigation.

## Risks / Notes

- **Current sandbox protection**: All templates have `SDTM_SANDBOX_MODE=true`. No live SFTP connections are made in the current deployment. The throw in Step 1 will not affect any running service until sandbox mode is disabled.
- **Key rotation**: FinCEN may rotate SFTP host keys without notice. When this happens, the connection will fail with a clear error message. This is the correct fail-secure behavior — a silent accept of an unknown key would be worse. Operators should have a documented runbook for key rotation response (fetch new key via `ssh-keyscan`, update `.env`, redeploy).
- **Algorithm-agnostic pinning**: The current implementation pins by comparing the raw base64 key. This works correctly for single-algorithm pinning (e.g. RSA or ED25519). If FinCEN advertises multiple host key algorithms, `ssh-keyscan` returns multiple lines — the operator must pin the one that matches the algorithm the `ssh2` library negotiates first. Document which algorithm to prefer.
- **`getSFTPConnectConfig` is not exported**: To unit-test Step 1, the function must be exported or refactored. This is a low-risk internal refactor but should be done explicitly.
- **`submitBatch` error propagation**: The throw inside `getSFTPConnectConfig` is called inside `new Promise((resolve) => { ... conn.connect(getSFTPConnectConfig()) })`. A synchronous throw inside a `Promise` constructor is caught by the runtime and causes the promise to reject. However, in the current code `conn.connect(...)` is called outside the `Promise` constructor — it is called after `conn.on("ready")` registration. Verify that the throw path actually rejects the promise in the `ssh2` version in use. If not, move `getSFTPConnectConfig()` call inside the Promise constructor or call it before creating the Promise.
- **`checkAcknowledgement` has the same call site**: Both `submitBatch` (line 94) and `checkAcknowledgement` (line 180) call `conn.connect(getSFTPConnectConfig())`. Both are protected by the sandbox check at the top of each function, so both benefit from the Step 1 fix.
