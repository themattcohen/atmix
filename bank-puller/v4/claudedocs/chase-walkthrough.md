# Chase Business — Step-by-Step Walkthrough

**Source**: `Bank Recordings And Instructions/Chase Walkthrough - Initial`
**Credentials**: AustinYu25 (from user, not .env)
**Account**: Business Card ending in 4051

---

## Steps

### Step 1: Navigate to chase.com
- URL: `https://www.chase.com` (NOT /business — main page has login form)
- Wait: Page load complete, login form visible
- Fields: `#userId-text-input-field`, `#password-text-input-field`
- **Status: DONE** ✓

### Step 2: Enter Credentials
- Focus `#userId-text-input-field`, type `AustinYu25` via Input.insertText
- Focus `#password-text-input-field`, type password via Input.insertText
- Screenshot to verify before submitting
- **Status: DONE** ✓ (credentials filled, verified via screenshot)

### Step 3: Click Sign In
- Find "Sign in" button by text match (it's a `<button>`, not `<a>`)
- Mouse-click via CDP
- Wait: Navigation to 2FA challenge page
- **Status: PENDING** — paused here, awaiting user go-ahead

### Step 4: Request 2FA Code
- 2FA page shows dropdown `#requestDeliveryDevice-select`
- Select "TEXT ME - xxx xxx 992"
- Click "Next"
- Wait: `#otpCode-input-field` appears

### Step 5: Read SMS from Dialpad
- Switch to Dialpad tab (already on port 9300, Compound Accounting > New)
- Look for most recent "JP Morgan Chase" message
- Extract 8-digit code
- Only accept codes from last 60 seconds

### Step 6: Submit 2FA + Re-enter Password
- Type 8-digit code into `#otpCode-input-field`
- Re-enter password into `#password-input-field`
- Click "Next"
- Wait: URL contains /dashboard

### Step 7: Navigate to Statements
- Click "Statements & Documents" link
- Wait: Statement table appears

### Step 8: Download Latest Statement
- Find topmost row in statement table
- Click download icon (down-arrow SVG) in "Open or save" column
- For April: look for March ending date
- Wait: PDF download starts

---

## Technical Notes

- Chase login form IDs on chase.com differ from overlay:
  - Main page: `#userId-text-input-field`, `#password-text-input-field`
  - Overlay (chase.com/business): `#userId-input-field`, `#password-input-field`
- Sign in button: `<button>` found by text "Sign in", NOT `a[data-msgid="sign-in-link"]`
- 2FA code is **8 digits** (not 6 like Dialpad)
- Chase may re-ask for password after 2FA code entry
- Auth patterns: X-JPMC-CSRF-Token, JPMC_SESSION_ID cookies
