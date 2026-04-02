# 2FA Automation Patterns — Research Summary
**Date**: 2026-04-02

## TOTP Generation (pyotp)

Simplest 2FA — generate codes from stored secrets, no network dependency.

```python
import pyotp
totp = pyotp.TOTP('JBSWY3DPEHPK3PXP')
code = totp.now()  # => '492039' — valid for 30 seconds
```

**BrowserUse built-in**: `sensitive_data={"bu_2fa_code": "SECRET"}` auto-generates TOTP.

**Banks with TOTP**: Mercury (mandatory every login), Citi business (CitiDirect). Chase and AmEx do NOT support TOTP.

**Gotchas**: System clock must be within 30s of UTC. Store secrets in OS keychain (`keyring` library) or encrypted env vars.

## SMS via Dialpad

### Option A: Webhook (recommended)
Dialpad API is **webhook-push only** — no GET endpoint for reading SMS.

```python
# FastAPI webhook receiver
@app.post("/dialpad/webhook")
async def receive_sms(request: Request):
    payload = jwt.decode(await request.body(), "webhook_secret", algorithms=["HS256"])
    if payload.get("direction") == "inbound":
        text = payload.get("text", "")
        code = extract_otp(text)
        if code:
            await sms_queue.put(code)
```

**Requires**: `message_content_export` scope on API key (admin console). Webhook URL must be public.

### Option B: Browser DOM polling (fallback)
Pre-login to Dialpad web UI, poll for new messages:
```python
async def poll_dialpad_for_sms(dialpad_page, timeout=120, poll_interval=3):
    while time.time() - start < timeout:
        messages = await dialpad_page.query_selector_all('[data-testid="message-item"]')
        for msg in reversed(messages):
            text = await msg.inner_text()
            code = extract_otp(text)
            if code:
                return code
        await asyncio.sleep(poll_interval)
```

### OTP extraction
```python
import re
def extract_otp(text: str) -> str | None:
    patterns = [r'\b(\d{6})\b', r'(?:code|OTP|pin)[:\s]+(\d{6})']
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None
```

## Dual Browser Sessions

Use separate browser contexts (one browser process, two isolated sessions):
```python
bank_ctx = await browser.new_context()
dialpad_ctx = await browser.new_context()
bank_page = await bank_ctx.new_page()
dialpad_page = await dialpad_ctx.new_page()
```

Or separate Browser instances on different CDP ports for full isolation.

**Critical**: Run banks serially when SMS-dependent. If two banks trigger SMS simultaneously, you can't attribute which code belongs to which bank.

## Push Notification 2FA

Wait for page state change (bank page transitions from "waiting" to dashboard):
```python
await page.wait_for_selector('[data-testid="dashboard"]', timeout=120000)
```
If timeout, check for SMS fallback button and switch to SMS flow.

## Security Question 2FA

Fuzzy match question text against stored Q&A pairs:
```python
from rapidfuzz import process, fuzz
match, score, _ = process.extractOne(question_text, SECURITY_ANSWERS.keys(), scorer=fuzz.token_sort_ratio)
if score >= 75:
    answer = SECURITY_ANSWERS[match]
```

## Manual Fallback

When automation can't handle 2FA:
```python
async def request_human_2fa(bank_name, prompt, timeout=300):
    send_slack_alert(bank_name, prompt)
    code = await asyncio.get_event_loop().run_in_executor(
        None, lambda: input(f"Enter 2FA code for {bank_name}: ").strip()
    )
    return code
```

## Timing Best Practices

| Issue | Mitigation |
|---|---|
| SMS delivery delay (5-30s, up to 60s) | Poll for 90-120s, not 30s |
| TOTP code expiration (30s) | Non-issue — generate fresh each time |
| Bank session timeout at 2FA (3-5 min) | Detect early, trigger fallback at 2.5 min |
| Two banks triggering SMS at once | Run SMS-dependent banks serially |
| Stale SMS from previous session | Track `sent_after_timestamp`, ignore older messages |

## 2FA Dispatcher Pattern
```python
async def handle_2fa(page, bank_config, tfa_bridge):
    if bank_config.get("totp_secret"):
        code = pyotp.TOTP(bank_config["totp_secret"]).now()
    elif await page.query_selector('.push-notification-waiting'):
        await wait_for_push(page)
        return
    elif await page.query_selector('input[name*="code"]'):
        code = await tfa_bridge.get_sms_code(timeout=90)
    elif await page.query_selector('.security-question'):
        return await handle_security_question(page, bank_config)
    else:
        code = await request_human_2fa(bank_config["name"])
    
    await fill_code(page, code)
```

## Priority: TOTP > Webhook SMS > DOM Poll SMS > Push Wait > Security Q Match > Human
