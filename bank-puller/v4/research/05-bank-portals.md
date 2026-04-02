# Bank Portal Automation — Research Summary
**Date**: 2026-04-02

## Industry Trend (2025-2026)

Banks are getting **substantially more aggressive**. Dominant stack: **Akamai Bot Manager** (absorbed PerimeterX) + **behavioral biometrics** (BioCatch, ThreatMetrix). BioCatch's new DeviceIQ product (March 2025) explicitly targets "agentic browsers" and AI-assisted access.

## Per-Bank Assessment

### Chase Business
| Aspect | Detail |
|---|---|
| Anti-bot | Akamai Bot Manager |
| Login | Cross-origin iframe — must explicitly switch into it |
| 2FA | SMS or push only (no TOTP, email reportedly removed 2024) |
| Trusted device | Works — eliminates repeat 2FA |
| Statement path | Account > Statements & Documents > direct PDF download |
| Key quirk | The iframe is real and cross-origin |

### American Express
| Aspect | Detail |
|---|---|
| Anti-bot | Akamai + behavioral fingerprinting |
| Login | Single-page form |
| 2FA | SMS on unrecognized devices only (no TOTP) |
| Statement path | Hamburger menu > card picker scroll > "Go to PDF Statements" > AJAX download |
| Key quirk | Card switch BEFORE PDF nav; two-step AJAX download modal |
| Open source | `amex-statement-downloader` on GitHub (confirms automatable but fragile) |

### Citibank
| Aspect | Detail |
|---|---|
| Anti-bot | Akamai |
| Login | **Two-step**: username page first, then password on separate page |
| 2FA | SMS (consumer); **TOTP available on CitiDirect business** |
| Statement path | "View All Statements" expansion > direct click |
| Key quirk | DNT header required; older statements require 48-72h request |

### Mercury
| Aspect | Detail |
|---|---|
| Anti-bot | Light |
| Login | Standard form |
| 2FA | **TOTP mandatory every login** (supports standard TOTP apps) |
| Statement path | N/A — **use REST API** (docs.mercury.com) |
| Key insight | Only bank in scope with a real first-party API. Skip browser automation entirely. |

### Wells Fargo
| Aspect | Detail |
|---|---|
| Anti-bot | Aggressive (vendor unconfirmed) |
| Login | Hard — community uses session injection (binary1230 bookmarklet) |
| Statement path | XHR JSON calls behind the scenes |
| Key quirk | Brave with shields fails at login (canvas/WebGL fingerprinting) |

### East West Bank
| Aspect | Detail |
|---|---|
| Anti-bot | Present but lighter |
| Login | 3-field: Company ID + username + password |
| 2FA | Unknown |
| Key quirk | Business accounts may use ADFS SSO; separate legacy eStatement portal |

### Bank of America
| Aspect | Detail |
|---|---|
| Anti-bot | Akamai + **BioCatch behavioral biometrics** |
| Login | Standard form |
| 2FA | SMS, push, FIDO2/YubiKey |
| Key quirk | **BioCatch monitors mouse/scroll/typing throughout entire session** — not just login. Silent session termination if patterns look robotic. |
| Assessment | Hardest bank to automate. Human-like delays and mouse movement required throughout. |

### UBS
| Aspect | Detail |
|---|---|
| Anti-bot | Unknown |
| Login | Standard form |
| 2FA | **Proprietary UBS Access App** (NOT standard TOTP) |
| Key quirk | Password expires every 180 days. Low public automation info. |
| Assessment | Investigate enterprise API access as alternative. |

## Stealth Tool Rankings

| Tool | Mechanism | Bank-Grade Rating | Notes |
|---|---|---|---|
| **Nodriver** | CDP-direct Chrome, no WebDriver | Best | Successor to undetected-chromedriver |
| **Camoufox** | Firefox engine-level fingerprint rewrite | Best | But Firefox = no BrowserUse (Chromium-only since v0.7) |
| **SeleniumBase UC/CDP** | Patched Chrome + CDP | Good | Widely tested |
| **Patchright** | Patched Playwright | Moderate | Fixes obvious signals, fails deep fingerprinting |
| Standard Playwright | Nothing | Fails | Immediately detected |

## Key Implications for Architecture

1. **Nodriver** is the best Chromium stealth option that works with BrowserUse via CDP
2. **Camoufox** is best overall but Firefox-only = incompatible with BrowserUse
3. **Residential proxies** required for Chase, AmEx, BofA (datacenter IPs blocked)
4. **BofA** requires human-like mouse/scroll patterns throughout (BioCatch)
5. **Mercury** should use REST API, not browser
6. **UBS** may need proprietary app workaround or API access
7. Browser layer should be **swappable per bank** (Nodriver for most, API for Mercury)
