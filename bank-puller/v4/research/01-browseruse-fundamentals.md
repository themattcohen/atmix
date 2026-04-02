# BrowserUse Fundamentals — Research Summary
**Date**: 2026-04-02

## What It Is
Python SDK wrapping Chrome with an LLM-driven agent loop: observe page (DOM + screenshot) -> send to LLM -> execute returned actions -> repeat. Open source (`pip install browser-use`) + paid cloud offering.

## Architecture (v0.7+, Sept 2025)
- Dropped Playwright entirely, uses raw Chrome DevTools Protocol (CDP) via `cdp-use`
- This means Patchright/Camoufox can't be swapped in directly — must connect via CDP bridge
- Firefox no longer supported (Chromium only)
- Claude fully supported: `ChatAnthropic(model="claude-sonnet-4-6")`

## Key API Surface

### Agent
```python
agent = Agent(
    task="natural language instruction",
    llm=ChatAnthropic(model="claude-sonnet-4-6"),
    browser=browser,
    controller=controller,        # custom action registry
    use_vision="auto",
    max_actions_per_step=4,       # batch N actions per LLM call
    max_failures=3,
    sensitive_data={},            # credentials masked in LLM context
    override_system_message=None, # replace default prompt (for structured mode)
    extend_system_message=None,
)
result = await agent.run(max_steps=100)
agent.add_new_task("Now do step 2")  # chain tasks on same browser
```

### Browser
```python
browser = Browser(
    cdp_url="http://localhost:9222",      # connect to existing Chrome via CDP
    user_data_dir="/path/to/profile",     # persistent profile (cookies, trusted device)
    keep_alive=True,                       # browser stays open between runs
    headless=False,
    proxy=ProxySettings(server="http://proxy:8080"),
    allowed_domains=["*.chase.com"],
)
```

### Custom Actions (@controller.action)
```python
controller = Controller()

@controller.action("Get the SMS 2FA code from Dialpad")
async def get_2fa_code() -> ActionResult:
    code = await poll_dialpad()
    return ActionResult(extracted_content=code)

@controller.action("Get current cookies")
async def get_cookies(browser: BrowserContext) -> ActionResult:
    cookies = await browser.get_cookies()
    return ActionResult(extracted_content=str(cookies))

agent = Agent(task="...", llm=llm, controller=controller)
```

## Persistent Profiles (Critical for Banks)

### Option A: user_data_dir (recommended)
```python
browser = Browser(
    user_data_dir="/custom/path/chase-profile",  # NOT Chrome's default
    keep_alive=True,
)
```
Stores everything: cookies, localStorage, IndexedDB, device fingerprints. "Trusted device" status survives across monthly runs. Chrome v136+ requires custom path (not default profile dir).

### Option B: storage_state (lighter)
```python
await browser.export_storage_state("./chase_auth.json")
browser = Browser(storage_state="./chase_auth.json")  # restore
```

### Option C: Cloud profiles (server-side)
Full profile persistence on BrowserUse cloud servers. Includes stealth.

## Anti-Detection

**Open source: NO stealth.** Removed in v0.7, explicitly "not planned" to return (Issue #3074).

**Workaround — Patchright via CDP:**
```bash
# 1. Launch Patchright on a CDP port
patchright chromium --remote-debugging-port=9222 --user-data-dir=/tmp/stealth-profile
```
```python
# 2. Connect BrowserUse to it
browser = Browser(cdp_url="http://localhost:9222")
agent = Agent(task="...", llm=llm, browser=browser)
```
Patchright handles stealth; BrowserUse drives the agent loop.

**Cloud offering**: Full stealth included (fingerprint randomization, Cloudflare bypass, CAPTCHA solver). But fingerprint randomization per session may break trusted-device cookies.

## Multi-Session
Yes. Separate `Browser` instances on different CDP ports:
```python
bank_browser = Browser(cdp_url="http://localhost:9222")
dialpad_browser = Browser(cdp_url="http://localhost:9223")
```

## Built-in TOTP
```python
agent = Agent(
    sensitive_data={"bu_2fa_code": "JBSWY3DPEHPK3PXP"},  # TOTP secret
)
# The `bu_2fa_code` suffix triggers automatic TOTP code generation
```

## Limitations
| Issue | Severity |
|---|---|
| No stealth (open source) | High — banks detect it |
| 60% failure rate on financial portals (benchmark) | High — for unstructured mode |
| Chrome v136+ CDP regression | Medium — use custom user_data_dir |
| No CAPTCHA solver (open source) | High — need external service |
| sensitive_data masking bugs (Issues #1907, #1062) | Medium |
| Chromium-only (no Firefox) | Medium — no Camoufox |
| No built-in rate limiting/retry | Medium |

## Cloud vs Open Source
| | Open Source | Cloud |
|---|---|---|
| Browser | Local Chrome | Remote Chrome on their servers |
| Stealth | None | Full fingerprint randomization |
| CAPTCHA | DIY | Auto-solver |
| Profiles | Local user_data_dir | Server-side cloud profiles |
| Cost | LLM API only | $0.05-1.00/session + LLM |
| Session max | Unlimited | Free: 15 min; Paid: 4 hours |
