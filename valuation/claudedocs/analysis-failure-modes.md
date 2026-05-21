# Failure-Mode Analysis: Dual-URL Deployment

**Author:** root-cause-analyst subagent (Sonnet)
**Date:** 2026-05-21
**Scope:** `valuation.somedayconsultants.com` (Cloudflare Pages) + `atmix.org/valuation/` (GitHub Pages).

## Top 3 failure modes worth worrying about

1. **The `base: '/valuation/'` bug.** Guaranteed failure: at the subdomain root, every chunk request 404s. Tool won't load past step 1. Worst possible mid-call outcome.
2. **Version drift between deploys.** GH Actions auto-deploys; CF Pages doesn't unless explicitly wired. Two prospects on the same day could see different math.
3. **DNS fragility with no monitoring.** Sara controls Squarespace CNAME; Matt controls CF Pages. No alert if the CNAME disappears.

## Top 5 mitigations to add before launch

1. **Fix `base` path before CF Pages deploy** (hard launch gate).
2. **Add uptime monitor on `valuation.somedayconsultants.com`** before first call.
3. **`noindex` + redirect `atmix.org/valuation` → canonical** at launch.
4. **Replace "Run it again at the same URL" with explicit canonical URL** in `ValuationReport.tsx` line 607.
5. **Single canonical URL doc** in `someday-marketing/claudedocs/brand-constants.md` before either URL is shared externally.

## Full failure scenarios

### 1. Two URLs in the wild

Matt puts `valuation.somedayconsultants.com` in his email signature. Sara links `atmix.org/valuation` in a slide deck copied from an old screen recording. Prospects receive both, search "atmix," find a personal portfolio. Trust erodes.

**Likelihood:** High. No canonical URL doc exists.
**Mitigation:** Declare `valuation.somedayconsultants.com` canonical in writing. Add a `somedayconsultants.com/v` shortener if the underlying host should be opaque.

### 2. Out-of-sync deploys

GHA deploys to `atmix.org/valuation` within 5 min on push. CF Pages needs separate trigger. Two prospects, same afternoon, different versions, different math for identical inputs.

The `base: '/valuation/'` issue makes this worse: it's a guaranteed silent break at the CF Pages root.

**Likelihood of base 404:** Certain unless reconfigured.
**Mitigation:** `base: '/'` per build or `base: './'` single build. Wire CF Pages to auto-deploy. Add `<span id="build-sha">` for easy divergence check.

### 3. SEO indexing

Both URLs crawlable. `atmix.org/valuation` outranks the brand subdomain on domain authority. CPA owner searches "Someday valuation," lands on `atmix.org/valuation`, sees "Internal sales tool · Preview only" footer.

**Mitigation:**
- On atmix.org/valuation: add `<meta name="robots" content="noindex">` + JS redirect to canonical.
- Change the footer before brand URL is shared.

### 4. The "test environment" failure

No staging exists. Both URLs are production. Matt tests new questions, autofill populates a real prospect's email from a previous session, `EmailReportForm` fires, Resend sends the PDF to the real prospect with no prior introduction.

**Mitigation:** Add a `VITE_DEMO_MODE=true` env flag for the dev/test build. Add a confirmation modal before submit. Document: no safe sandbox exists.

### 5. Brand confusion on the call and afterwards

Matt screen-shares brand URL on call. Three weeks later, prospect returns, searches, finds either URL. PDF says "Run it again at the same URL" but contains no URL.

**Mitigation:** Replace line 607 with explicit canonical URL. Update footer.

### 6. Email link consistency

CF Worker doesn't reference either URL yet. When wired, must not reference `atmix.org` (would contradict brand signature). Resend `from` is `matt@mail.somedayconsultants.com`; replies need `reply_to: matt@somedayconsultants.com` set explicitly.

**Mitigation:** Single `CANONICAL_VALUATION_URL` env var in Worker. Verify `reply_to` is set.

### 7. Phishing surface

Dual URLs train prospects to accept "this might live at different places." Attacker registers `valuation-somedayconsultants.com` (hyphen) or `somedayconsultants.co`, clones tool to harvest CPA financials.

**Mitigation:** Defensively register lookalike domains. Set Google Alert for "Someday Consulting valuation."

### 8. Sunset confusion

In 3 months, brand URL becomes canonical. atmix.org URL forgotten but still live (GHA never stops). Old emails and decks reference it. Prospect uses it 4 months later, gets outdated math.

**Mitigation:** Decide sunset plan now: redirect, copy, or 404. SPAs can't do server-side redirects on GH Pages; use `meta refresh` or JS. Leave a stub, don't delete.

### 9. Multi-stakeholder ownership

Matt owns the repo. Sara manages Squarespace DNS. She deletes the CNAME to "clean up," or adds a conflicting Squarespace page named "valuation," or migrates off Squarespace. Matt has no visibility.

**Mitigation:** UptimeRobot free tier (1-min polling, SMS alert). Note in Squarespace DNS record description: "DO NOT DELETE — powers Matt's sales tool." Long-term: move DNS to Cloudflare so all infra in one panel.

### 10. PDF attachment URL leak

PDF says "Run it again at the same URL" but embeds no URL. Prospect interprets "same URL" as whatever's in the Resend email body. If body says `atmix.org/valuation` (dev copy-paste), prospect bookmarks wrong URL.

**Mitigation:** Line 607 fix + single env var in Worker.

### 11. GitHub Pages CNAME conflict

New Someday hire sees `dist/valuation` in `deploy.yml`, assumes there's a `valuation.atmix.org`. Sends that URL to a prospect. 404.

**Mitigation:** One-line comment in `deploy.yml` clarifying the deploy targets and the canonical brand URL.

### 12. The bookmark failure

Prospect bookmarks `atmix.org/valuation` after a call. Returns weeks later. Tool is N commits behind canonical. Gets different numbers. Forwards outdated PDF to their accountant.

**Mitigation:** At brand URL launch: JS redirect + `noindex` on atmix.org/valuation. Catches existing bookmarks automatically.

### 13. Abandoned Pages project / ownership rotation

Matt leaves Someday. Nobody knows CF Pages project exists. CNAME remains. Site serves last build indefinitely.

**Mitigation:** Host CF Pages in a Someday-owned Cloudflare account, not Matt's personal. Document the dependency in a brand infra doc.

### 14. SSL certificate renewal failure

CF Pages auto-renews; renewal depends on CNAME resolving. If Sara temporarily removes CNAME, renewal silently fails, cert expires, browsers show "Not Secure" warning during a prospect call.

**Mitigation:** Move DNS to Cloudflare (self-contained renewal). If DNS stays at Squarespace: SSL expiry monitor with 30-day alert.
