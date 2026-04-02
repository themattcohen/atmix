# Bank Statement Automator v4 — Architecture Plan

## Context

A bookkeeping firm manages ~15 bank accounts. Every month someone manually logs into each bank, handles 2FA, navigates to statements, and downloads PDFs. This takes 2-4 hours.

**Goal**: A standalone Python agent that does this automatically. Python controls the workflow (which bank, which phase, retry logic). BrowserUse + Claude handles page interpretation (finding elements, clicking buttons). The LLM is the eyes, not the brain.

**Research complete** — see `bank-puller/v4/research/` (5 documents covering BrowserUse, agent patterns, Claude API, 2FA, and bank portals).

---

## Why BrowserUse (Not Raw API)

BrowserUse already implements the hardest parts:
- **Agent loop**: observe DOM + screenshot → send to LLM → execute action → repeat
- **DOM extraction**: Numbers every interactive element on the page
- **Action execution**: Click, type, scroll with error handling
- **History management**: Tracks what happened across steps
- **`@controller.action`**: Clean extension point for custom skills (2FA, PDF saving)
- **`sensitive_data`**: Credentials masked in LLM context
- **`override_system_message` + `max_steps`**: Enforces structured mode

Building this from scratch with the raw Anthropic API would take 2-4x longer and replicate what BrowserUse already does well. We get structure AND convenience.

**Stealth**: BrowserUse open-source has no stealth, but connects to any CDP endpoint. We launch Nodriver (best Chromium stealth) or Patchright separately, connect BrowserUse to it via `Browser(cdp_url="http://localhost:9222")`.

---

## Architecture

```
run.py (entry point)
  │
  ├── orchestrator.py
  │   ├── PHASE 0: Dialpad pre-flight login (manual 2FA — only human step)
  │   │   ├── Launches dedicated Dialpad browser session (own CDP port + profile)
  │   │   ├── Logs in with DIALPAD_EMAIL / DIALPAD_PASSWORD from .env
  │   │   ├── Pauses for human to enter Dialpad's 2FA code via CLI
  │   │   ├── Navigates to messages inbox
  │   │   └── Keeps session alive for entire run
  │   │
  │   ├── Reads clients.xlsx → builds job queue
  │   ├── For each bank account:
  │   │   ├── Launches stealth browser (Nodriver) on CDP port
  │   │   ├── Creates BrowserUse Browser(cdp_url=...)
  │   │   ├── Loads bank workflow (chase.py, amex.py, etc.)
  │   │   ├── Runs phases in order: login → 2fa → nav → download → validate
  │   │   ├── Each phase = new BrowserUse Agent with narrow task + restricted skills
  │   │   └── Checkpoints after each phase
  │   └── Generates summary report
  │
  ├── skills/ (@controller.action — LLM-callable during agent loop)
  │   ├── tfa.py          → get_sms_code, generate_totp, wait_for_push, answer_security_q, request_human
  │   ├── statements.py   → save_downloaded_pdf, validate_pdf
  │   └── navigation.py   → dismiss_modal, report_observation
  │
  ├── banks/ (per-bank workflow definitions)
  │   ├── base.py         → BaseBankWorkflow (phase interface)
  │   ├── dialpad.py      → Dialpad login workflow (pre-flight, manual 2FA)
  │   ├── chase.py        → Chase-specific phase implementations
  │   ├── amex.py         → AmEx-specific
  │   ├── citi.py         → Citi-specific
  │   ├── mercury.py      → Mercury (REST API, no browser)
  │   └── ... (wells_fargo, east_west, bofa, ubs)
  │
  └── browser/
      └── launcher.py     → Launch Nodriver/Patchright on CDP port, manage profiles
```

---

## BrowserUse Skills (All @controller.action Definitions)

### 2FA Skills (`skills/tfa.py`)

```python
@controller.action("Get SMS verification code from Dialpad")
async def get_sms_code(bank_name: str) -> ActionResult:
    """Poll Dialpad webhook/DOM for the latest SMS code.
    Call this when you see a verification code input field."""

@controller.action("Generate TOTP verification code")
async def generate_totp(account_id: str) -> ActionResult:
    """Generate a 6-digit TOTP code from the stored secret.
    Call this when you see a TOTP/authenticator code input field."""

@controller.action("Wait for push notification approval")
async def wait_for_push(browser: BrowserContext) -> ActionResult:
    """Wait up to 2 minutes for push notification approval.
    Call this when the page says 'Waiting for approval' or similar."""

@controller.action("Answer the security question shown on the page")
async def answer_security_question(question_text: str) -> ActionResult:
    """Fuzzy-match the security question against stored Q&A pairs.
    Call this when you see a security question. Pass the exact question text."""

@controller.action("Request human operator to provide a code or take action")
async def request_human_input(prompt: str) -> ActionResult:
    """Pause automation and notify the operator via Slack + CLI.
    Call this when you encounter an unrecognized 2FA prompt or are stuck."""
```

### Statement Skills (`skills/statements.py`)

```python
@controller.action("Save the downloaded PDF statement with correct filename")
async def save_downloaded_pdf(browser: BrowserContext) -> ActionResult:
    """Move the most recently downloaded file to the output directory
    with naming: ClientName__BankName #xxxx yyyy-mm.pdf
    Call this after a PDF download completes."""

@controller.action("Verify the downloaded file is a valid PDF")
async def validate_pdf(browser: BrowserContext) -> ActionResult:
    """Check that the most recent download is an actual PDF, not an HTML error page.
    Call this after saving a statement."""

@controller.action("Check if this month's statement has already been downloaded")
async def check_already_downloaded() -> ActionResult:
    """Check the output directory for an existing file matching this account+month.
    Call this before attempting a download."""
```

### Navigation Skills (`skills/navigation.py`)

```python
@controller.action("Dismiss a popup, modal, cookie banner, or overlay")
async def dismiss_modal(browser: BrowserContext) -> ActionResult:
    """Try to close any blocking overlay (cookie consent, session warning, promo).
    Call this when a modal or popup is blocking your task."""

@controller.action("Report what you observe on the current page")
async def report_observation(observation: str) -> ActionResult:
    """Log an observation about the page state for debugging.
    Call this when something unexpected appears."""

@controller.action("Get account details for multi-account navigation")
async def get_account_info() -> ActionResult:
    """Return the account last4, card type, and any identifiers needed
    to select the correct account when a bank shows multiple accounts."""
```

### Credential Handling (NOT a skill — uses sensitive_data)

```python
# Credentials never exposed to LLM. BrowserUse substitutes at execution time.
agent = Agent(
    task="Fill the username field with x_username and password field with x_password, then click Sign In",
    sensitive_data={
        "x_username": actual_username,    # LLM sees 'x_username', browser types real value
        "x_password": actual_password,
        "bu_2fa_code": totp_secret,       # Auto-generates TOTP when needed
    },
)
```

---

## Skill Playbook — Detailed Definitions

Every BrowserUse interaction has two parts: (1) a **task string** given to the Agent that describes the goal and steps, and (2) **available custom actions** the agent can call mid-task. This section defines both.

> This section will be extracted to `v4/src/skills/PLAYBOOK.md` during implementation as a reference doc, and the task strings will live in each bank's workflow class.

---

### Phase Skills (Task Strings Given to BrowserUse Agent)

These are the natural language instructions the orchestrator passes as the `task` parameter when creating a new Agent for each phase. They're bank-specific but follow a common structure.

---

#### PHASE 1: LOGIN

**Goal**: Navigate to the bank's login page, fill in credentials, and submit the login form.

**Generic steps**:
1. You are on the bank's login page
2. Find the username/email input field
3. Type `x_username` into it (BrowserUse substitutes the real value)
4. Find the password input field
5. Type `x_password` into it
6. Find and click the Sign In / Log In / Submit button
7. Wait for the page to transition (URL change or new content)

**Bank variations**:

| Bank | Variation |
|---|---|
| **Chase** | Login form is inside a **cross-origin iframe**. You must switch into the iframe before interacting with the form fields. After switching, fill username, password, and click Sign In. |
| **Citi** | **Two-step login**. First page: enter `x_username` and click Continue/Next. Wait for second page to load. Second page: enter `x_password` and click Sign On. |
| **East West** | **Three-field login**. Enter Company ID (from notes column), then username, then password. |
| **AmEx** | Standard single-page form. Username field, password field, Log In button. |
| **Mercury** | N/A — uses REST API, no browser login. |
| **All others** | Standard single-page form. |

**Available custom actions**: None needed. BrowserUse's built-in click/type handles this. `sensitive_data` provides credential masking.

**Success verification (Python)**: URL changes away from login page, OR a dashboard/account element appears.

---

#### PHASE 2: POST-LOGIN (2FA Handling)

**Goal**: Handle whatever the bank shows after login — 2FA prompts, security questions, modals, "trust this device" confirmations — and reach the main dashboard.

**Generic steps**:
1. Look at the current page after login
2. IF you see a verification/OTP code input field:
   - Determine the 2FA type from the page context (SMS code, authenticator code)
   - For SMS: call `get_sms_code` to retrieve the code from Dialpad
   - For TOTP/authenticator: call `generate_totp` to generate a code
   - Type the code into the input field
   - Click Verify / Submit / Continue
3. IF you see "We sent a push notification" or "Approve on your device":
   - Call `wait_for_push` and wait for the page to transition automatically
4. IF you see a security question (e.g., "What is your mother's maiden name?"):
   - Read the exact question text
   - Call `answer_security_question` with the question text
   - Type the returned answer into the answer field
   - Click Submit / Continue
5. IF you see "Trust this device?" / "Remember this device?":
   - Click Yes / Trust / Remember (preserves trusted status for next month)
6. IF you see a promotional modal, survey, or interstitial:
   - Call `dismiss_modal` to close it
7. IF you see the main dashboard or account overview:
   - You're done with this phase

**Bank variations**:

| Bank | Variation |
|---|---|
| **Chase** | Always requires 2FA on first run (SMS or push). After trusting device, may skip on future runs. May also re-prompt for password after entering 2FA code. |
| **AmEx** | 2FA only on unrecognized devices. Usually SMS. |
| **Citi** | May show QR code page (dismiss it) or go straight to dashboard. Business accounts may use TOTP via Citi Authenticator app. |
| **Mercury** | TOTP mandatory every login — use `generate_totp` or `bu_2fa_code` in sensitive_data. |
| **BofA** | SMS or push. BioCatch behavioral monitoring active — avoid rapid/mechanical interactions. |
| **UBS** | Proprietary UBS Access App — requires `request_human_input` for manual approval. |

**Available custom actions**: `get_sms_code`, `generate_totp`, `wait_for_push`, `answer_security_question`, `request_human_input`, `dismiss_modal`

**Success verification (Python)**: Dashboard URL pattern matched, OR account balance/name element visible.

---

#### PHASE 3: NAVIGATE TO STATEMENTS

**Goal**: From the main dashboard, navigate to the page where bank statements (PDF downloads) are listed.

**Generic steps**:
1. Look at the current page (should be the dashboard)
2. Find a link, menu item, or tab labeled "Statements", "Documents", "Statements & Documents", or similar
3. Click it
4. If a submenu appears, look for "PDF Statements", "Account Statements", or "Tax Documents" and click the statements option
5. Wait for the statements list to load
6. If a modal or popup appears, call `dismiss_modal`

**Bank variations**:

| Bank | Variation |
|---|---|
| **Chase** | Look for "Statements & Documents" in the left nav or under an account dropdown. May use an accordion (#navToggleTabs). |
| **AmEx** | Requires hamburger menu navigation. Click the menu icon (three lines), then "Statements & Activity", then look for "Go to PDF Statements" link. This may require scrolling. |
| **Citi** | Look for "Statements" in the sidebar navigation. May need to click "View All Statements" to expand the full list. |
| **Wells Fargo** | Statements are loaded via XHR/JSON behind the scenes. Look for "Statements & Documents" in the main nav. |

**Available custom actions**: `dismiss_modal`, `report_observation`

**Success verification (Python)**: URL contains "statements" or "documents", OR statement list elements are visible.

---

#### PHASE 4: PREPARE (Account/Card Selection)

**Goal**: If the bank shows multiple accounts or cards, select the correct one before downloading statements. Not all banks need this phase.

**Generic steps**:
1. Call `get_account_info` to get the target account's last4 digits and any identifiers
2. Look for an account selector, card picker, or dropdown
3. If multiple accounts/cards are listed, find the one ending in the correct last4 digits
4. Click to select it
5. Wait for the page to update showing statements for the selected account

**Bank variations**:

| Bank | Variation |
|---|---|
| **AmEx** | Card picker dropdown that may require scrolling. IMPORTANT: Select the card BEFORE clicking "Go to PDF Statements" — if you navigate to PDF statements first and then switch cards, AmEx reloads and you lose your place. |
| **Chase** | If multiple accounts, select from a dropdown or list. Each account shows its last4. |
| **Citi** | Account selection may be part of the sidebar navigation. |
| **Others** | Single-account logins skip this phase entirely. |

**Available custom actions**: `get_account_info`, `dismiss_modal`

**Success verification (Python)**: Page shows statements specifically for the target account (confirmed by last4 in page content).

---

#### PHASE 5: DOWNLOAD STATEMENT

**Goal**: Find the target month's statement in the list and download it as a PDF.

**Generic steps**:
1. Call `check_already_downloaded` to skip if we already have this file
2. Look at the list of available statements
3. Find the statement for the target month (e.g., "March 2026" or "03/2026")
4. Click its download link, PDF icon, or "Download" button
5. If a confirmation dialog or modal appears, click "Download PDF" or "Confirm"
6. Wait for the download to complete (file appears in downloads directory)
7. Call `save_downloaded_pdf` to rename and move it to the output directory
8. Call `validate_pdf` to confirm it's a real PDF

**Bank variations**:

| Bank | Variation |
|---|---|
| **AmEx** | Two-step AJAX download: clicking the statement opens a modal that loads asynchronously. Wait for the modal to fully load, then click the actual "Download PDF" button inside it. |
| **Chase** | Statements may be in an accordion that needs expanding. Click the month to expand, then click the PDF download link. May show a confirmation dialog. |
| **Citi** | Direct click download. Older statements (>12 months) may require a 48-72h request — if you see "Request Statement" instead of "Download", call `report_observation` and skip. |
| **Wells Fargo** | Downloads triggered via XHR. The actual download link may not be a visible <a> tag — may need to click a download icon or button that triggers a JavaScript call. |

**Available custom actions**: `check_already_downloaded`, `save_downloaded_pdf`, `validate_pdf`, `report_observation`, `dismiss_modal`

**Success verification (Python)**: PDF file exists in output directory with correct naming and file size > 0.

---

#### PHASE 6: VALIDATE & SAVE

**Goal**: Confirm the downloaded file is a valid PDF statement and not an error page, and save it with the correct filename.

**Generic steps**:
1. Check that a file was actually downloaded (not just a failed network request)
2. Verify file starts with `%PDF` magic bytes (not HTML error page)
3. Verify file size is reasonable (>10KB, <50MB)
4. Rename to standard naming convention: `ClientName__BankName #xxxx yyyy-mm.pdf`
5. Move to output directory: `output/{yyyy-mm}/`
6. Log success

**This phase is handled entirely by Python** — no BrowserUse agent needed. The `save_downloaded_pdf` and `validate_pdf` custom actions can also be called by the agent in Phase 5.

---

### Custom Action Skills (Detailed Implementation)

These are the `@controller.action` functions. Each can be called by the BrowserUse agent during any phase where it's registered.

---

#### `get_sms_code`

**Goal**: Retrieve the most recent SMS verification code sent to the Dialpad phone number.

**Steps**:
1. Record current timestamp as `sent_after` (to ignore old messages)
2. Check if Dialpad webhook server is running and has a queued code
3. If webhook has a code newer than `sent_after`, extract the 6-digit number and return it
4. If no webhook, fall back to DOM polling:
   a. Switch to the Dialpad browser context/page
   b. Navigate to the messages/SMS inbox if not already there
   c. Look for the most recent message from a short code or bank number
   d. Extract the 6-digit code from the message text using regex
5. Return the code as `ActionResult(extracted_content="847291")`
6. If no code received within 90 seconds, return error

**When to call**: When you see a text input field asking for a verification code, OTP, or security code that was sent via SMS/text message.

---

#### `generate_totp`

**Goal**: Generate a fresh 6-digit TOTP code from the stored secret for this bank account.

**Steps**:
1. Look up the TOTP secret for the current account from the config store
2. Use `pyotp.TOTP(secret).now()` to generate the current code
3. Return the code as `ActionResult(extracted_content="492039")`

**When to call**: When you see an authenticator/TOTP code input field. Note: if the bank account has `bu_2fa_code` in `sensitive_data`, BrowserUse handles this automatically — you may not need to call this explicitly.

---

#### `wait_for_push`

**Goal**: Wait for the user to approve a push notification on their phone, then confirm the page transitioned.

**Steps**:
1. Log that we're waiting for push approval
2. Poll the current page every 2 seconds for up to 120 seconds
3. Check if the page URL changed OR the "waiting" element disappeared OR a dashboard element appeared
4. If the page transitioned, return success
5. If timeout, check if there's a "Use SMS instead" or "Try another method" link
6. If fallback available, return `ActionResult(extracted_content="PUSH_TIMEOUT_FALLBACK_AVAILABLE")`
7. If no fallback, return error

**When to call**: When the page says "We sent a notification to your device", "Waiting for approval", "Check your phone", or similar push notification messaging.

---

#### `answer_security_question`

**Goal**: Match a bank security question against stored Q&A pairs and return the answer.

**Steps**:
1. Receive the question text from the agent
2. Normalize the question (lowercase, strip punctuation)
3. Use `rapidfuzz.process.extractOne()` with `fuzz.token_sort_ratio` to find the best match among stored Q&A pairs for this bank account
4. If match score >= 75%, return the answer as `ActionResult(extracted_content="Fluffy")`
5. If no good match, return error prompting the agent to call `request_human_input`

**When to call**: When you see a security question on the page (e.g., "What is the name of your first pet?"). Read the full question text and pass it as the `question_text` parameter.

---

#### `request_human_input`

**Goal**: Pause the automation and wait for a human operator to provide input (a code, an answer, or manual action).

**Steps**:
1. Take a screenshot of the current page and save it
2. Send a Slack notification with the bank name, the prompt, and the screenshot
3. Print a CLI prompt: "MANUAL INPUT REQUIRED: {bank_name} — {prompt}"
4. Wait for input via `asyncio.get_event_loop().run_in_executor(None, input)`
5. Return the human's response as `ActionResult(extracted_content=response)`
6. Timeout after 5 minutes if no response — return error

**When to call**: When you encounter something you don't recognize — an unfamiliar 2FA method, a CAPTCHA, a page that doesn't match any expected state, or when another skill (like `answer_security_question`) fails.

---

#### `save_downloaded_pdf`

**Goal**: Rename the most recently downloaded file to the standard naming convention and move it to the output directory.

**Steps**:
1. Find the most recently modified file in the browser's download directory
2. Verify a file exists and was modified within the last 60 seconds
3. Read the target naming info from the current job config:
   - Client name, bank name, account last4, target month
4. Construct filename: `{ClientName}__{BankName} #{last4} {yyyy-mm}.pdf`
5. Create output directory if needed: `output/{yyyy-mm}/`
6. Move/rename the file to the output directory
7. Return the final path as `ActionResult(extracted_content=path)`

**When to call**: After you see a download complete (browser download bar shows complete, or a "Download successful" message appears). Also called automatically by the orchestrator after Phase 5.

---

#### `validate_pdf`

**Goal**: Confirm a downloaded file is actually a PDF and not an HTML error page or empty file.

**Steps**:
1. Read the first 4 bytes of the file
2. Check for `%PDF` magic bytes
3. Check file size is between 10KB and 50MB
4. Optionally: attempt to parse with PyPDF2 to confirm it's valid
5. Return `ActionResult(extracted_content="VALID: 245KB")` or error with details

**When to call**: After `save_downloaded_pdf` completes, to confirm the saved file is genuine.

---

#### `check_already_downloaded`

**Goal**: Check if we already have this month's statement for this account, to avoid duplicate downloads.

**Steps**:
1. Read the current job config (client, bank, last4, month)
2. Construct the expected filename pattern
3. Check if a matching file exists in `output/{yyyy-mm}/`
4. Return `ActionResult(extracted_content="EXISTS: path/to/file.pdf")` or `ActionResult(extracted_content="NOT_FOUND")`

**When to call**: At the beginning of the download phase, before attempting to download.

---

#### `dismiss_modal`

**Goal**: Close any popup, modal, overlay, cookie banner, or interstitial that's blocking the main page content.

**Steps**:
1. Look for common close patterns:
   - X button (top-right corner of a modal)
   - "Close", "Dismiss", "Got it", "Accept", "No thanks" buttons
   - "Accept All Cookies" or "Cookie Preferences" buttons
   - Clicking outside the modal (on the overlay backdrop)
2. Try clicking the most likely close button
3. Wait 1-2 seconds for the modal to animate away
4. Verify the blocking overlay is gone
5. Return success or error

**When to call**: When a popup, modal, or overlay appears that blocks your ability to interact with the main page content. Common triggers: cookie consent banners, promotional offers, session timeout warnings, survey popups.

---

#### `get_account_info`

**Goal**: Return account details needed for multi-account navigation (which card/account to select).

**Steps**:
1. Read from the current job config:
   - `account_last4`: last 4 digits of the account/card number
   - `client_name`: name associated with the account
   - `notes`: any free-text notes (e.g., Company ID for East West Bank)
2. Return as structured text: `ActionResult(extracted_content="Account ending in 8035, Client: Bossi Sportswear")`

**When to call**: When you see a list of multiple accounts or cards and need to select the correct one. Call this before selecting.

---

#### `report_observation`

**Goal**: Log an unexpected or noteworthy page state for debugging without stopping the workflow.

**Steps**:
1. Take the observation string from the agent
2. Take a screenshot
3. Write to the run log: timestamp, bank, phase, observation, screenshot path
4. Return `ActionResult(extracted_content="Logged")`

**When to call**: When you see something unexpected but non-blocking — a new UI element, a different layout than expected, a warning message, or anything that might be useful for debugging later.

---

## Per-Bank Workflows

### Base Interface

```python
class BaseBankWorkflow:
    """Every bank implements these phases. Orchestrator calls them in order."""

    def get_login_task(self, creds) -> str:
        """Return BrowserUse task string for login phase."""
    
    def get_post_login_task(self) -> str:
        """Return task string for handling whatever appears after login (2FA, modals)."""
    
    def get_nav_task(self) -> str:
        """Return task string for navigating to statements page."""
    
    def get_prepare_task(self, account_info) -> str:
        """Return task for selecting correct account/card if multi-account."""
    
    def get_download_task(self, month: str) -> str:
        """Return task for downloading a specific month's statement."""
    
    # Config
    login_url: str
    allowed_domains: list[str]
    max_steps_per_phase: dict[str, int]
    requires_iframe: bool = False
    requires_residential_proxy: bool = False
```

### Chase Business

```python
class ChaseWorkflow(BaseBankWorkflow):
    login_url = "https://secure.chase.com/web/auth/dashboard"
    allowed_domains = ["*.chase.com"]
    requires_iframe = True
    requires_residential_proxy = True
    max_steps_per_phase = {"login": 8, "post_login": 10, "nav": 6, "download": 8}

    def get_login_task(self, creds):
        return (
            "You are on the Chase login page. There is an iframe containing the login form. "
            "Switch into the iframe. Fill the username field with x_username and the password "
            "field with x_password. Click the Sign In button."
        )
    
    def get_post_login_task(self):
        return (
            "After login, Chase may show a 2FA verification prompt. "
            "If you see a code entry field, call get_sms_code to get the code, "
            "then enter it and click Verify. If you see the dashboard, you're done."
        )
    
    def get_nav_task(self):
        return "Find and click 'Statements & Documents' or 'Statements' in the navigation menu."
    
    def get_download_task(self, month):
        return f"Find the statement for {month} and click its download link or PDF icon."
```

### American Express

```python
class AmexWorkflow(BaseBankWorkflow):
    login_url = "https://www.americanexpress.com/en-us/account/login"
    allowed_domains = ["*.americanexpress.com"]
    requires_residential_proxy = True
    max_steps_per_phase = {"login": 6, "post_login": 6, "nav": 10, "prepare": 8, "download": 10}

    def get_nav_task(self):
        return (
            "Navigate to PDF statements. Look for a hamburger menu or 'Statements & Activity'. "
            "You may need to click through 'Go to PDF Statements' link."
        )
    
    def get_prepare_task(self, account_info):
        return (
            f"Select the card ending in {account_info['last4']}. "
            "If there's a card picker dropdown, scroll through it to find the right card. "
            "IMPORTANT: Select the card BEFORE navigating to PDF statements."
        )
    
    def get_download_task(self, month):
        return (
            f"Find the statement for {month}. Click the download link. "
            "AmEx may show a two-step AJAX modal — wait for it to load, then click Download PDF."
        )
```

### Citibank

```python
class CitiWorkflow(BaseBankWorkflow):
    login_url = "https://www.citi.com/"
    allowed_domains = ["*.citi.com", "*.citibank.com"]
    max_steps_per_phase = {"login": 8, "post_login": 8, "nav": 8, "download": 8}

    def get_login_task(self, creds):
        return (
            "Citi uses a two-step login. First page: enter x_username and click Continue. "
            "Second page: enter x_password and click Sign On."
        )
    
    def get_nav_task(self):
        return (
            "Find and click 'Statements' or 'View All Statements' in the sidebar or menu. "
            "You may need to expand a section to see all available statements."
        )
```

### Mercury (API-based — no browser)

```python
class MercuryWorkflow(BaseBankWorkflow):
    """Mercury has a REST API. No browser automation needed."""
    
    async def run(self, config, month):
        # Direct API calls — no BrowserUse agent
        client = MercuryAPIClient(api_key=config.api_key)
        statements = await client.get_statements(account_id=config.account_id)
        pdf_bytes = await client.download_statement(statement_id=target.id)
        save_pdf(pdf_bytes, config, month)
```

---

## Orchestrator Flow

```python
async def run_all(config_path: str, target_month: str):
    accounts = read_excel(config_path)
    results = []
    
    # Group by login (multiple accounts under one login)
    for login_group in group_by_login(accounts):
        # Launch stealth browser with persistent profile
        cdp_port = find_free_port()
        browser_process = launch_nodriver(
            port=cdp_port,
            profile_dir=f"./profiles/{login_group.bank}_{login_group.username}",
        )
        
        bu_browser = Browser(cdp_url=f"http://localhost:{cdp_port}", keep_alive=True)
        
        try:
            workflow = load_workflow(login_group.bank_name)  # ChaseWorkflow, etc.
            
            # Phase 1: Login (once per login group)
            skills = build_skills(phase="login", config=login_group)
            agent = Agent(
                task=workflow.get_login_task(login_group.creds),
                llm=ChatAnthropic(model="claude-haiku-4-5"),
                browser=bu_browser,
                controller=skills,
                max_steps=workflow.max_steps_per_phase["login"],
                sensitive_data={"x_username": ..., "x_password": ...},
                allowed_domains=workflow.allowed_domains,
            )
            await agent.run()
            checkpoint(login_group, "login_complete")
            
            # Phase 2: Post-login / 2FA
            skills = build_skills(phase="post_login", config=login_group)
            agent = Agent(
                task=workflow.get_post_login_task(),
                llm=ChatAnthropic(model="claude-haiku-4-5"),
                browser=bu_browser,
                controller=skills,
                max_steps=workflow.max_steps_per_phase["post_login"],
            )
            await agent.run()
            checkpoint(login_group, "post_login_complete")
            
            # Phase 3-5: For each account in this login group
            for account in login_group.accounts:
                # Navigate, prepare, download, validate
                # ... (similar pattern: new Agent per phase, narrow task, restricted skills)
                
                results.append(Result(account=account, success=True, path=pdf_path))
        
        except Exception as e:
            results.append(Result(account=login_group, success=False, error=str(e)))
        
        finally:
            await bu_browser.close()
            browser_process.terminate()
    
    generate_report(results)
```

---

## File Structure

```
bank-puller/v4/
├── research/                        # Research docs (already created)
│   ├── 01-browseruse-fundamentals.md
│   ├── 02-agent-patterns.md
│   ├── 03-claude-api-and-sdk.md
│   ├── 04-2fa-automation.md
│   └── 05-bank-portals.md
├── src/
│   ├── __init__.py
│   ├── run.py                       # CLI entry point
│   ├── config.py                    # Settings, env vars, model selection
│   ├── orchestrator.py              # Job queue, bank iteration, phase execution
│   ├── excel_reader.py              # Read clients.xlsx
│   ├── checkpoint.py                # JSON checkpoint save/resume
│   ├── report.py                    # Summary reporting (success/fail per bank)
│   ├── browser/
│   │   ├── __init__.py
│   │   └── launcher.py              # Launch Nodriver on CDP port, manage profiles
│   ├── skills/                      # BrowserUse @controller.action definitions
│   │   ├── __init__.py              # build_skills(phase, config) factory
│   │   ├── tfa.py                   # get_sms_code, generate_totp, wait_for_push,
│   │   │                            #   answer_security_question, request_human_input
│   │   ├── statements.py            # save_downloaded_pdf, validate_pdf,
│   │   │                            #   check_already_downloaded
│   │   └── navigation.py            # dismiss_modal, report_observation, get_account_info
│   ├── banks/                       # Per-bank workflow definitions
│   │   ├── __init__.py              # load_workflow(bank_name) registry
│   │   ├── base.py                  # BaseBankWorkflow (phase interface)
│   │   ├── chase.py
│   │   ├── amex.py
│   │   ├── citi.py
│   │   ├── mercury.py               # API-based, no browser
│   │   ├── wells_fargo.py
│   │   ├── east_west.py
│   │   ├── bofa.py
│   │   └── ubs.py
│   └── mercury_api/
│       ├── __init__.py
│       └── client.py                # Mercury REST API client
├── profiles/                        # Persistent browser profiles (gitignored)
├── output/                          # Downloaded PDFs: output/2026-03/Client__Bank#xxxx.pdf
├── checkpoints/                     # Run state JSON files (gitignored)
├── PLAN.md                          # Copy of this plan
└── requirements.txt                 # browser-use, anthropic, pyotp, openpyxl, rapidfuzz, nodriver
```

---

## Dependencies

```
browser-use>=0.7.0
langchain-anthropic
nodriver              # Stealth Chromium (or patchright as fallback)
pyotp                 # TOTP generation
openpyxl              # Excel reading
rapidfuzz             # Security question matching
keyring               # Secure credential storage (optional)
```

---

## Implementation Order

### Step 1: Core scaffold
- `run.py`, `config.py`, `excel_reader.py`, `orchestrator.py`, `checkpoint.py`
- `browser/launcher.py` — launch Nodriver on CDP port
- `skills/__init__.py` — `build_skills()` factory
- `banks/base.py` — `BaseBankWorkflow`

### Step 2: All skills
- `skills/tfa.py` — all 5 TFA skills
- `skills/statements.py` — PDF save/validate
- `skills/navigation.py` — modal dismiss, observation logging

### Step 3: First bank — Chase
- `banks/chase.py` — hardest bank (iframe, always-2FA)
- Test end-to-end: login → 2FA → dashboard → statements → download

### Step 4: Remaining banks
- `banks/amex.py`, `banks/citi.py` (browser-based, working in v1)
- `banks/mercury.py` + `mercury_api/client.py` (API-based)
- `banks/wells_fargo.py`, `banks/east_west.py`, `banks/bofa.py`, `banks/ubs.py`

### Step 5: Polish
- `report.py` — summary output
- Error handling refinement
- Residential proxy integration for Chase/AmEx/BofA

---

## Verification

1. **Unit**: `build_skills()` returns correct skills per phase
2. **Integration**: Launch Nodriver → connect BrowserUse → navigate to a public site → screenshot → verify
3. **Chase E2E**: `python run.py --bank chase --month 2026-03` → login → 2FA → download → PDF in output/
4. **Full batch**: `python run.py --month 2026-03` → all banks → report shows success/fail per account

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Agent framework | BrowserUse (structured mode) | Agent loop, DOM extraction, action execution already built |
| LLM | Claude Haiku 4.5 (Sonnet for errors) | $2/run for 15 accounts |
| Browser stealth | Nodriver via CDP | Best Chromium stealth rating for banks |
| Workflow control | Python orchestrator, new Agent per phase | LLM can't skip/reorder phases |
| Credential handling | BrowserUse sensitive_data | Never exposed to LLM context |
| 2FA | Custom @controller.action skills | SMS, TOTP, push, security Q, manual fallback |
| Persistence | user_data_dir per bank profile | Trusted device survives monthly |
| Mercury | REST API, no browser | Only bank with an API |
| Concurrency | Serial (for now) | SMS attribution; parallelize later via cloud CDP |
| Dialpad | Pre-flight login with manual 2FA, session kept alive | Only human-in-the-loop step |
| .env location | bank-puller/.env (parent dir) | Shared with v1/v2/v3, has all keys |
