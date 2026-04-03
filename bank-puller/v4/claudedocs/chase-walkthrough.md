# Chase Business — Step-by-Step Walkthrough (VERIFIED)

**Last updated**: 2026-04-03
**Credentials**: AustinYu25 (user-provided)
**Account**: FOTM LLC — United Business (...4631)
**Script**: `scripts/chase_login.py`

---

## Proven Steps (all verified via screenshot)

### Step 1: Navigate to chase.com ✓
- **URL**: `https://www.chase.com` (NOT /business — main page has login form inline)
- **Wait**: 8s for page load
- Login form is visible on the main page — no overlay click needed

### Step 2: Enter Credentials ✓
- **Username field**: `#userId-text-input-field`
- **Password field**: `#password-text-input-field`
- **Method**: Focus field via `Runtime.evaluate`, type via `Input.insertText`
- Verify: screenshot shows username filled, password masked

### Step 3: Click Sign In ✓
- **Element**: `<button>` found by text match: `e.textContent.trim().startsWith("Sign in")`
- **Method**: CDP mouse-click (get live coords via getBoundingClientRect)
- **Result**: Navigates to `secure.chase.com/web/auth/...simplerAuthOptions`
- Page shows: "We don't recognize this device" with 2FA dropdown

### Step 4: Open 2FA Dropdown ✓
- **Trigger**: `#header-simplerAuth-dropdownoptions-styledselect` (custom dropdown, type="button")
- **Method**: CDP mouse-click by ID
- **Result**: Dropdown opens showing TEXT ME / CALL ME options

### Step 5: Select TEXT ME xxx-xxx-1992 ✓
- **Listbox**: `#ul-list-container-simplerAuth-dropdownoptions-styledselect`
- **Options are `<li>` children**. Structure:
  - `<li>` TEXT ME (header)
  - `<li>` xxx-xxx-1992 ← click this one
  - `<li>` xxx-xxx-1993
  - `<li>` CALL ME (header)
  - `<li>` xxx-xxx-1992
  - `<li>` xxx-xxx-1993
  - `<li>` Call us - 1-877-242-7372
- **Method**: Find first `<li>` with text matching `xxx-xxx-{phone_suffix}` inside the listbox, CDP mouse-click
- **Important**: Dropdown closes between CDP reconnections. Must open + select in same websocket session.

### Step 6: Click Next (send SMS) ✓
- **Element**: `<button>` with text "Next"
- **Method**: CDP mouse-click by text match
- **Result**: Page changes to `...provideAuthenticationCode`, shows "We sent you a text message"
- SMS arrives in Dialpad within seconds

### Step 7: Read SMS from Dialpad ✓
- **Switch tab**: Find Dialpad tab by URL match (`dialpad.com`), call `Page.bringToFront`
- **Sender**: "JP Morgan Chase"
- **Message format**: "Chase: DON'T share. Use code XXXXXXXX to confirm you're signing in..."
- **Code**: 8 digits
- **Verify**: Check sender is "JP Morgan Chase" AND timestamp is "Just now"
- Screenshot Dialpad to confirm before proceeding

### Step 8: Enter 2FA Code + Password ✓
- **Code field**: `#otpcode_input-input-field` (type="number")
- **Password field**: `#password_input-input-field` (type="password")
- **NOT** `#otpCode-input-field` or `#password-input-field` (walkthrough spec was wrong)
- **Method**: Focus each field, `Input.insertText`
- Then click "Next" button by text match

### Step 9: Dashboard ✓
- **URL**: `secure.chase.com/web/auth/dashboard#/dashboard/overview`
- **Shows**: "Good afternoon", FOTM LLC, United Business (...4631), balance
- **Tabs visible**: Overview, **Statements & documents**, Profile & settings

### Step 10: Navigate to Statements (PENDING)
- Click "Statements & documents" tab
- Wait for statement table to appear

### Step 11: Download Latest Statement (PENDING)
- Find topmost row in statement table
- Click download icon
- For April: look for March ending date
- Wait for PDF download

---

## Script Commands

```bash
# Step 1-5: Login + select SMS (stops before sending)
python scripts/chase_login.py login AustinYu25 PASSWORD

# Step 6: Click Next (sends SMS)
python scripts/chase_login.py next

# Step 8: Enter code + password (after reading from Dialpad)
python scripts/chase_login.py 2fa CODE PASSWORD
```

---

## Field ID Reference (VERIFIED on page)

| Page | Field | ID |
|------|-------|-----|
| chase.com login | Username | `#userId-text-input-field` |
| chase.com login | Password | `#password-text-input-field` |
| 2FA selection | Dropdown trigger | `#header-simplerAuth-dropdownoptions-styledselect` |
| 2FA selection | Options listbox | `#ul-list-container-simplerAuth-dropdownoptions-styledselect` |
| 2FA code entry | One-time code | `#otpcode_input-input-field` |
| 2FA code entry | Password | `#password_input-input-field` |

---

## Corrections from Original Walkthrough

| Original Spec | Actual (Verified) |
|---------------|-------------------|
| URL: chase.com/business | chase.com (login form on main page) |
| Click "Sign in" link `a[data-msgid]` | `<button>` found by text match |
| Dropdown `#requestDeliveryDevice-select` | Custom dropdown `#header-simplerAuth-dropdownoptions-styledselect` |
| Code field `#otpCode-input-field` | `#otpcode_input-input-field` |
| Password field `#password-input-field` | `#password_input-input-field` |
| Card ending in 4051 | Card ending in 4631 (FOTM LLC — United Business) |
