# Security / DNS Impact Analysis

**Author:** security-engineer subagent (Sonnet)
**Date:** 2026-05-21
**Scope:** Adding `valuation.somedayconsultants.com` CNAME to point at Cloudflare Pages, alongside existing `atmix.org/valuation/` deploy.

## Summary

**No blocker. The CNAME addition is safe to do today.**

Live DNS state confirmed:
- DMARC exists at `_dmarc.somedayconsultants.com` with `v=DMARC1; p=none;` (no `rua`, monitoring-only).
- Resend DKIM key confirmed at `resend._domainkey.mail.somedayconsultants.com`. SPF confirmed at `send.mail.somedayconsultants.com`.
- No SPF record at the apex. No Google Workspace DKIM key published.
- `valuation.somedayconsultants.com` does not yet exist (NXDOMAIN confirmed).

**Top 2 hardening items (order matters):**

1. **Tighten CORS on the worker before launch.** The `Access-Control-Allow-Origin: *` policy on `somedayhq.com/api/valuation/submit` lets any page on the internet trigger Resend emails from `matt@mail.somedayconsultants.com` with arbitrary recipient addresses and attached PDFs. Restrict to `valuation.somedayconsultants.com`, `atmix.org`, and the `*.pages.dev` preview origin, with `Vary: Origin`.

2. **Add apex SPF before tightening DMARC.** `somedayconsultants.com` has no SPF record. Add `v=spf1 include:_spf.google.com ~all`. Then add a `rua=` tag to DMARC and ramp from `p=none` to `p=quarantine` after 7 days of aggregate report data.

**Verdict:** Safe to add the CNAME today. No DNS record conflicts, no certificate interference, no cookie leakage, and no subdomain takeover risk given Cloudflare Pages' custom-domain binding model, provided the decommission order (DNS before project deletion) is followed.

---

## Full findings

### 1. Resend DKIM/SPF/MX impact from CNAME addition

**Safe.** DNS records are per-owner-name. The new CNAME at `valuation.somedayconsultants.com` is a distinct RRset. It cannot shadow or invalidate `resend._domainkey.mail.somedayconsultants.com`, `send.mail.somedayconsultants.com`, or any MX record. Confirmed all three exist and are intact via live query.

### 2. SPF impact on Resend deliverability

**Safe.** SPF is evaluated against the SMTP envelope-from domain only. Adding a CNAME at a sibling subdomain has no effect on SPF policy lookups at `send.mail.somedayconsultants.com`. Note: apex SPF is missing (see concern 3), but that is a pre-existing gap unrelated to this CNAME.

### 3. DMARC alignment

**Safe but worth tightening.** DMARC record confirmed: `v=DMARC1; p=none;`. Resend DKIM alignment passes (relaxed, organizational domain matches). Problem: `p=none` with no `rua=` tag means zero visibility and zero enforcement. Before raising the policy:

- (a) add apex SPF `v=spf1 include:_spf.google.com ~all`
- (b) generate and publish a Google Workspace DKIM key (currently NXDOMAIN at `google._domainkey.somedayconsultants.com`)
- (c) add `rua=mailto:matt@somedayconsultants.com` and observe for 7 days
- (d) ramp to `p=quarantine; pct=10` then `p=reject`

### 4. SSL/TLS provisioning

**Safe.** Squarespace cert covers apex and `www` only. Cloudflare Pages will issue an independent Let's Encrypt cert for `valuation.somedayconsultants.com` via its own ACME process. The two certs coexist without conflict. No CAA record restricts issuance, so Let's Encrypt is permitted. Optional hardening: publish CAA records limiting issuance to `letsencrypt.org` and `pki.goog`.

### 5. CORS posture

**Safe but worth tightening.** Confirmed `Access-Control-Allow-Origin: *` in `valuation-submit.js` lines 40 and 77. Open CORS enables any page to POST to this endpoint and trigger Resend emails from the Someday brand address to arbitrary recipients.

Fix: replace `*` with request-origin reflection against an allowlist of `valuation.somedayconsultants.com`, `atmix.org`, and the Cloudflare preview domain, plus add `Vary: Origin`. CORS is browser-only enforcement; a rate-limiting layer (KV counter keyed on CF-Connecting-IP) is needed for server-side protection against scripted abuse.

### 6. Cookie and subdomain trust boundary

**Safe.** Squarespace cookies may use `Domain=.somedayconsultants.com` but the valuation SPA makes no requests to `somedayconsultants.com`, so those cookies are never attached to valuation-origin requests. The SPA sets no cookies. Cloudflare Pages static serving discards all incoming cookie headers. No leakage path exists.

### 7. Subdomain takeover risk

**Safe with a procedural control.** Cloudflare Pages binds custom domains to a specific project ID, not just to the `*.pages.dev` hostname. Deleting the project breaks the custom-domain binding. Residual risk: if the CNAME is left in place after project deletion, Cloudflare's current behavior (no routing for orphaned custom domains) could change. Required procedure: always delete the CNAME before deleting the Pages project.

### 8. Mixed-origin code execution and CSP

**Safe, hardening available.** No CSP header is set by default. Cloudflare Pages supports a `_headers` file in the project root. Recommended policy:

```
default-src 'self';
script-src 'self';
style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' https://somedayhq.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

The `blob:` allowance in `img-src` covers `@react-pdf/renderer` preview rendering. No `'unsafe-inline'` needed since Vite produces hashed bundles. Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### 9. What gets logged

**Safe.** Cloudflare Pages logs URL paths and visitor IPs only. The SPA is client-side; the POST body (containing firm name, owner name, email, PDF bytes) goes directly to `somedayhq.com` and never transits the Pages edge. No sensitive data in Pages logs.

### 10. DNS TTL

**Set explicitly to 300 seconds.** Zone SOA minimum is 300 seconds (confirmed). Squarespace DNS defaults to 300 for new records in this zone. Explicitly setting it avoids any platform UI surprises and ensures 5-10 minute global rollback window. Do not go lower than 300 seconds.
