# Plan: 1Password Full Integration for bank-puller

## Context

bank-puller stores bank credentials in plaintext in `clients.xlsx`. Credentials already live in 1Password. This plan refactors the existing `onepassword_store/` module to use the full SDK (`items.get()` instead of `secrets.resolve()`), adds 2FA config as custom fields, and wires it into `excel_reader.py` with hybrid fallback.

**Architecture**:
- **Excel** = job manifest (which accounts to run, `op_item` link, operational state, `tfa_sender` write-back, run log)
- **1Password** = credential vault (username, password, TOTP, security Q&A, 2FA config)
- **Hybrid mode**: `op_item` set → hydrate from 1Password. Not set → use Excel credentials as-is.

---

## 1. 1Password Item Structure

**Vault**: `BankCredentials` (configurable via `OP_VAULT` env var)

**Item naming**: `{ClientName} - {BankName}` (e.g., `Acme Corp - Chase Business`)

```
[Login]                              ← default section
  username: acme_user                  (Text)
  password: ********                   (Concealed)
  one-time password: otpauth://...     (TOTP, optional)

[2FA Config]                         ← custom section
  tfa_method: totp                     (Text: "totp"|"sms"|"email"|"push")
  tfa_target: asc                      (Text: "asc"|"client")
  tfa_preference_order: 1992,2212      (Text: comma-separated last-4s)

[Notes]
  pet: Rover                           (keyword: answer per line)
  city: Denver
```

Fields absent = sensible defaults (`tfa_method` → `""`, `totp_secret` → `None`, etc.)

---

## 2. Module Refactor — `bank-puller/onepassword_store/`

### `models.py` — expanded dataclass

```python
@dataclass(frozen=True)
class HydratedCredentials:
    username: str
    password: str
    totp_secret: str | None                    # raw base32, or None
    security_questions: list[tuple[str, str]]   # [(keyword, answer), ...]
    tfa_method: str                             # "totp", "sms", "email", "push", or ""
    tfa_target: str                             # "asc", "client", or ""
    tfa_preference_order: list[str]             # ["1992", "2212"]
```

### `store.py` — switch to `items.get()` API

**Key change**: Instead of `secrets.resolve()` per field, fetch the full item via `client.items.get(vault_id, item_id)` and iterate `item.fields`. This is:
- More robust (no field-path guessing)
- Single API call per item (vs 4+ resolve calls)
- Gives us access to sections and custom fields

**Implementation**:
1. `list_items(vault)` → find vault ID by name, list items, return titles+IDs
2. `_find_item_by_title(vault, title)` → list items, match by title, return `(vault_id, item_id)`
3. `hydrate(op_item, vault)`:
   - Call `_find_item_by_title()` to get IDs
   - Call `client.items.get(vault_id, item_id)` → full item object
   - Iterate `item.fields`:
     - `field.id == "username"` or `field.title == "username"` → username
     - `field.id == "password"` or `field.title == "password"` → password
     - `field.field_type == ItemFieldType.TOTP` → extract base32 from `field.value` (the raw `otpauth://` URI)
     - Fields in "2FA Config" section → `tfa_method`, `tfa_target`, `tfa_preference_order`
   - Parse `item.notes` (or the Notes-type field) for security Q&A
   - Cache keyed by `(vault, op_item)`
4. `_parse_notes_qa()` and `_parse_totp_secret()` — keep as-is from current implementation

### `cli.py` — minor update to show new fields in lookup output

### `__init__.py` — update exports and docstring

---

## 3. Core App Integration — `excel_reader.py`

**File**: `bank-puller/orchestrator/excel_reader.py`

### 3a. Add `op_item` column

Add `"op_item"` to `ACCOUNTS_COLUMNS` list (position: after `notes`, or any position — header map is used).

### 3b. Modify `read_accounts()`

After building the base `AccountJob` from Excel columns, check if `op_item` is non-empty:

```python
op_item = _cell_str(row, col_map, "op_item")
if op_item:
    try:
        creds = await store.hydrate(op_item)
        # Override credential fields from 1Password
        job.username = creds.username
        job.password = creds.password
        job.tfa_detail = creds.totp_secret or ""
        job.security_questions = creds.security_questions
        if creds.tfa_method:
            job.has_2fa = True
            job.tfa_method = creds.tfa_method
        if creds.tfa_target:
            job.tfa_target = creds.tfa_target
        if creds.tfa_preference_order:
            job.tfa_preference_order = creds.tfa_preference_order
    except CredentialError as exc:
        log.error("1Password hydration failed for %s: %s", op_item, exc)
        # Fall through with Excel values as fallback
```

**Note**: `read_accounts()` is currently sync. Since the 1Password SDK is async, we need to make it async. The callers (`job_scheduler.py`) already run in async context.

### 3c. Fields that stay in Excel (not overridden)

- `tfa_sender` — auto-learned, written back after first successful SMS
- `last_successful_login` — operational state
- `status` — operational state
- `login_url`, `bank_name`, `client_name`, `account_last4`, `statement_available_date` — job metadata
- `notes` — operational notes

---

## 4. Config + Dependencies

### `config.py`
Add:
```python
OP_SERVICE_ACCOUNT_TOKEN = os.getenv("OP_SERVICE_ACCOUNT_TOKEN", "")
OP_VAULT = os.getenv("OP_VAULT", "BankCredentials")
```

### `requirements.txt`
Add: `onepassword-sdk`

---

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| `OP_SERVICE_ACCOUNT_TOKEN` not set | `CredentialError` on first `hydrate()` call |
| Item not found by title | `CredentialError` naming the missing item |
| 1Password API unreachable | `CredentialError` wrapping SDK exception |
| Notes empty / unparseable | `security_questions` = `[]` |
| OTP field absent | `totp_secret` = `None` |
| 2FA Config section absent | `tfa_method/target/preference` = `""` / `[]` |
| `op_item` set but hydration fails | Log error, **fall back to Excel credentials** |
| `op_item` not set | Use Excel credentials (current behavior, no 1Password call) |

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `bank-puller/onepassword_store/models.py` | Add `tfa_method`, `tfa_target`, `tfa_preference_order` fields |
| `bank-puller/onepassword_store/store.py` | Rewrite to use `items.get()`, parse sections/custom fields |
| `bank-puller/onepassword_store/__init__.py` | Update docstring |
| `bank-puller/onepassword_store/cli.py` | Show new fields in lookup output |
| `bank-puller/orchestrator/excel_reader.py` | Add `op_item` column, async hydration in `read_accounts()` |
| `bank-puller/orchestrator/job_scheduler.py` | Await async `read_accounts()` (if not already) |
| `bank-puller/config.py` | Add `OP_SERVICE_ACCOUNT_TOKEN`, `OP_VAULT` |
| `bank-puller/requirements.txt` | Add `onepassword-sdk` |

---

## 7. Verification

1. **CLI lookup**: `python -m onepassword_store.cli lookup "Test - Demo Bank"` — verify all fields including 2FA config
2. **CLI list**: verify items appear
3. **CLI test-all**: verify hydration of every item in vault
4. **Hybrid test**: Run `read_accounts()` with a mix of rows — some with `op_item`, some without. Verify 1Password rows get hydrated credentials, others use Excel.
5. **Fallback test**: Set `op_item` to a nonexistent item name — verify error is logged and Excel credentials are used.
6. **Cache test**: `hydrate()` twice for same item, verify single API call (via log).
7. **Full run**: Execute a bank-puller run with `op_item` set for at least one account, verify login succeeds with 1Password credentials.

---

## 8. 1Password SDK Capabilities Reference

The Python SDK (`onepassword-sdk`) supports far more than we're using. Documented here for future reference.

### What the SDK can access
- **Full item CRUD**: Get, Create, Update, Delete, Archive, List items
- **Field types**: Text, Concealed, TOTP, Notes, Email, URL/Website, Phone, Address, Date, MonthYear, CreditCardNumber/Type, SSHKey, Reference, Menu
- **File attachments**: Read/write files attached to items
- **Document items**: Full document storage
- **Vault management**: List vaults, manage group permissions
- **Secret references**: Resolve `op://vault/item/field` URIs directly
- **Item sharing**: Generate share links
- **Password generation**: PIN, random, memorable
- **Tags**: Read/write tags on items
- **Sections**: Organize fields into custom sections

### Not supported
- Passkeys

### Authentication methods
- **Service account tokens** (`OP_SERVICE_ACCOUNT_TOKEN`) — for automated/headless workflows
- **Desktop app integration** — for local dev with biometric auth

### Requirements
- Python 3.9+, libssl 3, glibc 2.32+
- Fully async API (async/await)
