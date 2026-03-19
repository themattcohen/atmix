# 1Password Programmatic Access Research

**Context**: Can 1Password replace the plaintext Excel/config credential store in bank-puller?
**Date**: 2026-03-19
**Verdict**: Yes — viable and recommended. All three requirements (passwords, TOTP codes, 2FA secrets) are supported.

---

## Executive Summary

1Password has a mature programmatic access story with four distinct interfaces: the CLI (`op`), the Python SDK, the Connect REST API, and a set of community MCP servers. All of them support reading passwords and generating live TOTP codes at runtime. There is no official 1Password MCP server yet — only community implementations. The simplest path for bank-puller is the **Python SDK + Service Account**, which requires no extra infrastructure and has a clean async interface.

---

## 1. What We Need vs What's Available

| Requirement | Supported? | Method |
|---|---|---|
| Look up stored passwords by bank/URL | Yes | SDK / CLI / Connect |
| Retrieve current TOTP code (time-based) | Yes | `?attribute=otp` query param |
| Access raw TOTP secret (the seed) | Indirectly — stored as `otpauth://` URI | Connect API field retrieval |
| Non-interactive (no human in the loop) | Yes | Service Account token |
| Python integration | Yes | `onepassword-sdk` (async) |

**Important nuance on TOTP**: 1Password stores the TOTP secret as an `otpauth://` URI in an OTP-type field. When you read it via the SDK/CLI with the `?attribute=otp` query parameter, it computes and returns the **current 6-digit code** (i.e., it acts like an authenticator app). You get a live code, not just the raw secret. You can also read the raw `otpauth://` URI if you need the seed itself.

---

## 2. Access Methods

### 2a. Python SDK (Recommended for bank-puller)

**Package**: `onepassword-sdk` (pip)
**Auth**: Service Account token via `OP_SERVICE_ACCOUNT_TOKEN` env var
**Style**: Async (requires `asyncio`)

```bash
pip install onepassword-sdk
```

```python
import asyncio
import os
from onepassword.client import Client

async def get_credentials(vault: str, item: str):
    client = await Client.authenticate(
        auth=os.environ["OP_SERVICE_ACCOUNT_TOKEN"],
        integration_name="bank-puller",
        integration_version="v1.0.0",
    )

    # Get the stored password
    password = await client.secrets.resolve(f"op://{vault}/{item}/password")

    # Get the current TOTP code (computed live, like an authenticator app)
    totp_code = await client.secrets.resolve(f"op://{vault}/{item}/one-time password?attribute=otp")

    # Get the username
    username = await client.secrets.resolve(f"op://{vault}/{item}/username")

    return username, password, totp_code

# Usage
username, password, totp = asyncio.run(get_credentials("BankCredentials", "Chase"))
```

**Supported field types**: passwords, usernames, OTP (TOTP), API keys, SSH keys, notes, URLs, credit card data, file attachments. Passkeys are not yet supported.

**Requirements**: Python 3.9+, libssl 3, glibc 2.32+. The glibc requirement means this works on modern Linux and Windows but may fail on older distros. On Windows (where bank-puller runs), this should work fine.

**GitHub**: https://github.com/1Password/onepassword-sdk-python

---

### 2b. 1Password CLI (`op`)

The `op` CLI can be used from Python via `subprocess` or shell scripts.

**Auth**: Set `OP_SERVICE_ACCOUNT_TOKEN` environment variable — no biometric/interactive prompt required.

**Reading a password**:
```bash
op read "op://BankCredentials/Chase/password"
```

**Getting a live TOTP code**:
```bash
op read "op://BankCredentials/Chase/one-time password?attribute=otp"
```

**Getting the raw otpauth URI** (the TOTP seed):
```bash
op item get "Chase" --vault "BankCredentials" --fields "one-time password"
```

**Secret reference URI format**:
```
op://vault-name/item-name/field-name
op://vault-name/item-name/section-name/field-name
op://vault-name/item-name/field-name?attribute=otp    # returns current 6-digit code
```

**From Python**:
```python
import subprocess

def get_totp(vault: str, item: str) -> str:
    result = subprocess.run(
        ["op", "read", f"op://{vault}/{item}/one-time password?attribute=otp"],
        capture_output=True, text=True, check=True,
        env={**os.environ, "OP_SERVICE_ACCOUNT_TOKEN": token}
    )
    return result.stdout.strip()
```

**Installation**: Available for Windows, macOS, Linux. Download from https://developer.1password.com/docs/cli/get-started/.

---

### 2c. 1Password Connect (REST API)

Connect is a self-hosted Docker container that caches your vault and exposes a local REST API. More infrastructure than needed for bank-puller, but worth knowing.

**How it works**:
1. Deploy two Docker containers: `1password/connect-api` and `1password/connect-sync` (default port 8080)
2. Each client app authenticates with an access token via HTTP headers
3. The container syncs from 1Password cloud and caches locally

**Key property**: After initial sync, reads are unlimited (no rate limits on local reads). The rate limit only applies to the initial cloud sync.

**Python SDK (Connect-specific)**:
```bash
pip install onepasswordconnectsdk
```

```python
from onepasswordconnectsdk.client import new_client_from_environment

client = new_client_from_environment()  # reads OP_CONNECT_HOST and OP_CONNECT_TOKEN
item = client.get_item(item_id, vault_id)
# OTP field is present in item.fields with type="OTP" and value="otpauth://..."
```

**OTP via Connect**: The Connect API returns the raw `otpauth://totp/...` URI in the field value. You would need to generate the current code yourself using a library like `pyotp`:

```python
import pyotp, re

otp_field = next(f for f in item.fields if f.type == "OTP")
secret = re.search(r'secret=([A-Z2-7]+)', otp_field.value).group(1)
code = pyotp.TOTP(secret).now()
```

**Verdict for bank-puller**: Overkill. Connect is designed for many services hitting secrets at high volume. The Python SDK is simpler and has no extra infrastructure.

---

### 2d. Service Accounts

Service accounts are the authentication mechanism for non-human/automated access. They work with both the CLI and the Python SDK.

**How to create**:
1. Sign in to 1password.com
2. Navigate to the service accounts section
3. Create account, grant read access to specific vaults
4. Copy the token (shown only once) — store it in your `.env` file or environment

**Key properties**:
- Non-interactive: no MFA prompt, no biometric
- Permissions are immutable after creation (to change, create a new service account)
- Max 100 service accounts per org
- Cannot use SSO or MFA (by design)

**Usage**:
```bash
export OP_SERVICE_ACCOUNT_TOKEN="ops_..."
op read "op://BankCredentials/Chase/password"
```

---

### 2e. MCP Servers

There is **no official 1Password MCP server** as of March 2026. All existing implementations are community projects with low adoption (0-5 stars):

| Repo | Language | TOTP Support | Notes |
|---|---|---|---|
| jrejaud/op-mcp | JS | No mention | Lightweight, wraps op CLI, zero idle CPU |
| jon-the-dev/1password-mcp-server | Python | Unknown | Low activity |
| lwsinclair/onepassword-mcp-server | Python | Unknown | Describes "secure credential retrieval for AI agents" |
| bensleveritt/1password-mcp-server | JS | Unknown | No details |
| goodwokdev/op-mcp | Rust | Unknown | Wraps op CLI |

**Recommendation**: Skip MCP servers for bank-puller. Call the Python SDK directly from your orchestrator code — it's simpler and more reliable than routing through an MCP server.

---

## 3. Rate Limits

Rate limits apply to service account token calls to the 1Password cloud API. These are per-token, per-hour.

| Plan | Reads/hour | Writes/hour | Daily (all accounts combined) |
|---|---|---|---|
| Individual / Families | 1,000 | 100 | 1,000 |
| Teams | 1,000 | 100 | 5,000 |
| Business | 10,000 | 1,000 | 50,000 |

**For bank-puller**: Bank-puller runs once per client session, reading ~2-3 secrets per bank (username, password, TOTP). At even 50 banks, that's ~150 reads per run — well within any tier's limits.

Monitor usage with: `op service-account ratelimit`

---

## 4. Pricing

| Plan | Cost | Service Accounts | CLI/SDK |
|---|---|---|---|
| Individual | $2.99/mo (annual) | Yes (with limits) | Yes |
| Families | $4.49/mo (annual) | Yes | Yes |
| Teams Starter | $19.95/mo for up to 10 users | Yes | Yes |
| Business | $7.99/user/mo (annual) | Yes (higher limits) | Yes |

**Key finding**: Service accounts and the CLI/SDK are available on **all plans including Individual**. You do not need a Business plan for this use case. The main difference is rate limits (1,000 vs 10,000 reads/hour).

Connect (self-hosted) requires "Secrets Automation" access — this is part of the Business tier or available as an add-on. Since we're recommending the SDK (not Connect), this is irrelevant.

---

## 5. Security Implications

### Advantages over current approach (plaintext Excel + config)
- Credentials never stored in plaintext files that could be accidentally committed or leaked
- Vault is end-to-end encrypted; 1Password cannot read your secrets
- Service account token can be revoked instantly without touching the underlying credentials
- Audit log: 1Password records which service account accessed which item and when
- Granular vault permissions: service account only sees the `BankCredentials` vault, nothing else
- Secrets can be rotated in one place without changing code

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| `OP_SERVICE_ACCOUNT_TOKEN` in `.env` is still a secret | Treat it like a master key. Keep it out of git (it's already in .env, which should be gitignored). Rotate it if compromised. |
| Service goes offline / 1Password API down | Build a fallback path. Cache credentials locally in memory for the session (not on disk). |
| TOTP code generated slightly before/after use | TOTP codes are valid for 30 seconds with a 30-second window tolerance. This is fine for Playwright automation. |
| Raw TOTP secret extraction | The SDK `?attribute=otp` query returns a live code, not the raw secret. The Connect API does return the `otpauth://` URI. Use the SDK approach for better security (no raw secret exposure). |

### TOTP: code vs secret
- **Python SDK / CLI with `?attribute=otp`**: Returns the current 6-digit code only. The raw TOTP secret never leaves 1Password. This is the better approach.
- **Connect API**: Returns the `otpauth://totp/...` URI which contains the raw base32 secret. More powerful but also more exposure.

---

## 6. Recommended Integration for bank-puller

### Setup (one-time)

1. Create a 1Password account (Individual plan is sufficient)
2. Create a vault called `BankCredentials`
3. For each bank, create a Login item with:
   - `username` field
   - `password` field
   - `one-time password` field (choose "One-Time Password" field type, paste the `otpauth://` URI or scan a QR code)
4. Create a service account with read-only access to `BankCredentials` vault
5. Copy the service account token to `.env`:
   ```
   OP_SERVICE_ACCOUNT_TOKEN=ops_eyJzaWduSW5BZGRyZXNzIjoibXl0...
   ```
6. `pip install onepassword-sdk`

### Code integration

Create `bank-puller/utils/credentials.py`:

```python
import asyncio
import os
from onepassword.client import Client

_client = None

async def _get_client() -> Client:
    global _client
    if _client is None:
        _client = await Client.authenticate(
            auth=os.environ["OP_SERVICE_ACCOUNT_TOKEN"],
            integration_name="bank-puller",
            integration_version="v1.0.0",
        )
    return _client

async def get_bank_credentials(bank_item_name: str, vault: str = "BankCredentials") -> dict:
    """
    Returns dict with keys: username, password, totp_code
    bank_item_name: the item name in 1Password, e.g. "Chase" or "Bank of America"
    """
    client = await _get_client()
    base = f"op://{vault}/{bank_item_name}"

    username = await client.secrets.resolve(f"{base}/username")
    password = await client.secrets.resolve(f"{base}/password")

    try:
        totp = await client.secrets.resolve(f"{base}/one-time password?attribute=otp")
    except Exception:
        totp = None  # bank doesn't use 2FA

    return {"username": username, "password": password, "totp": totp}

def get_credentials_sync(bank_item_name: str, vault: str = "BankCredentials") -> dict:
    """Sync wrapper for non-async callers."""
    return asyncio.run(get_bank_credentials(bank_item_name, vault))
```

### Migration from current config.py

Replace hardcoded credential lookups with calls to `get_credentials_sync()`. The `clients.xlsx` file can retain bank names and item names (no actual credentials), making it safe to keep in the repo.

---

## 7. Alternative: CLI subprocess approach

If async Python is inconvenient, the CLI approach via subprocess is simpler:

```python
import subprocess
import os

def op_read(reference: str) -> str:
    result = subprocess.run(
        ["op", "read", reference],
        capture_output=True, text=True, check=True,
        env={**os.environ}  # OP_SERVICE_ACCOUNT_TOKEN must be set
    )
    return result.stdout.strip()

def get_bank_credentials(bank_item: str, vault: str = "BankCredentials") -> dict:
    base = f"op://{vault}/{bank_item}"
    return {
        "username": op_read(f"{base}/username"),
        "password": op_read(f"{base}/password"),
        "totp": op_read(f"{base}/one-time password?attribute=otp"),
    }
```

Downside: each `op read` call spawns a subprocess and makes an API call. At 3 credentials per bank, this is fine for bank-puller's throughput.

---

## 8. Decision

**Recommendation: Use 1Password Python SDK with a Service Account.**

| Factor | Assessment |
|---|---|
| Viability | High — all required operations are natively supported |
| Setup complexity | Low — 30 minutes to set up vault, service account, and pip install |
| Infrastructure | None — no Connect server needed |
| Ongoing cost | $2.99-$7.99/mo depending on plan; Individual plan suffices |
| Security improvement | Significant — eliminates plaintext credentials in Excel and config.py |
| TOTP support | Full — live codes generated at runtime, raw secret never exposed |
| Rate limits | Non-issue — 1,000+ reads/hour vs ~150 reads per typical run |
| Windows compatibility | Confirmed — SDK works on Windows (no glibc issues on Win) |

The only reason to reconsider would be if bank-puller needs to run in a completely offline environment, in which case the Connect self-hosted approach (cached locally) would be the fallback.
