# Decision Synthesis: Brand-Domain Hosting for the Valuation Webapp

**Date:** 2026-05-21
**Inputs:** 4 parallel Sonnet analyses
  - `analysis-devops.md` (deploy + CF Pages plan + dual-source-of-truth)
  - `analysis-security.md` (DNS, SSL, SPF/DKIM/DMARC, CORS, CSP)
  - `analysis-frontend.md` (Vite base, lazy chunks, PDF, multi-origin)
  - `analysis-failure-modes.md` (adversarial brainstorm)

## Verdict

**GO.** Add `valuation.somedayconsultants.com` via Cloudflare Pages, with one structural fix and one operational shift. Hard launch gate: fix the Vite base path. Strong recommendation: do NOT run both URLs as parallel production. Make atmix.org/valuation a `noindex` + JS redirect to the canonical brand URL.

All four agents converged. Frontend says "one config line." DevOps says "low ops debt, Option B (single build, wrangler upload)." Security says "no DNS blocker, two real hardening items." Root-cause says "guaranteed base-path break, plus dual-URL confusion is a real ops cost." No agent flagged a structural blocker beyond the base path.

## Cross-cutting hard truths

Three findings appeared in 2+ agents and constrain the plan:

1. **`vite.config.ts` has `base: '/valuation/'`** which 404s every chunk request when served from a subdomain root. Frontend + DevOps + Root-Cause all flagged it. **Fix: `base: './'`** (frontend recommends; devops confirms; root-cause calls it a hard launch gate).

2. **CORS on the worker is wildcard.** Security flagged it as a real abuse vector (anyone can trigger Resend emails from `matt@mail.somedayconsultants.com` with arbitrary attachments). Root-cause indirectly reinforced this in the email-link-consistency section. **Fix: allowlist `valuation.somedayconsultants.com`, `atmix.org`, and `*.pages.dev` origins before launch.**

3. **Two live production URLs is more ops cost than expected.** Root-cause flagged 6+ scenarios (bookmarks, SEO, version drift, brand confusion, test/prod mixing, multi-stakeholder ownership). DevOps + Frontend both assumed dual-URL was the goal; root-cause re-argues this. **Right answer: canonical is `valuation.somedayconsultants.com`; `atmix.org/valuation` becomes a redirect stub on launch day.**

## Execution plan (in order)

### Pre-launch fixes (hard gates)

1. **Change `base` in `valuation/vite.config.ts`** from `'/valuation/'` to `'./'`. Single artifact, works from any URL root. Verify: no `BrowserRouter` (confirmed by frontend agent — zero matches), no absolute-path `fetch('/...')` calls (frontend agent confirmed). Re-run parity tests (`npm run test:run`) and `npm run build` to confirm no regression.

2. **Tighten CORS** in `someday-marketing/landing-worker/src/handlers/valuation-submit.js`. Replace `Access-Control-Allow-Origin: *` with origin reflection from an allowlist: `['https://valuation.somedayconsultants.com', 'https://atmix.org', /^https:\/\/[^.]+\.someday-valuation\.pages\.dev$/]`. Add `Vary: Origin`. Worker deploy via wrangler.

3. **Replace PDF copy** in `valuation/src/components/pdf/ValuationReport.tsx` line 607: change "Run it again any time at the same URL" to "Run it again at valuation.somedayconsultants.com" (or remove the sentence entirely). Same edit may exist in `AppendixPages.tsx` A7 — grep first.

### Launch sequence

4. **Create Cloudflare Pages project** `someday-valuation` via wrangler (direct-upload, no Git integration). Devops agent's exact commands in `analysis-devops.md` §4.

5. **Add custom domain** `valuation.somedayconsultants.com` to the Pages project via Cloudflare REST API.

6. **Add CNAME at Squarespace DNS** (manual click-flow in dashboard, ~5 min). Squarespace creds in Doppler `prd_root` as `SQUARESPACE_DASHBOARD_EMAIL/PASSWORD`. CNAME `valuation` → `someday-valuation.pages.dev`. TTL 300s.

7. **Wait for SSL provisioning** (5-15 min typical). Cloudflare Pages auto-issues Let's Encrypt cert via its own ACME flow. No conflict with Squarespace's apex cert.

8. **First deploy** via `npx wrangler pages deploy valuation/dist/ --project-name someday-valuation` (after `npm run build`).

9. **Verify** end-to-end: load `https://valuation.somedayconsultants.com/`, run demo, download PDF, send email through to a test address.

### Same-day sunset of atmix.org parallel production

10. **Add redirect + noindex** to `atmix.org/valuation`. Three options:
    - (a) Modify `valuation/index.html` to add `<meta name="robots" content="noindex">` always + a JS redirect block that fires only when `window.location.host === 'atmix.org'`. Single build still works on both.
    - (b) Two builds with different `index.html` injections.
    - Option (a) is cleanest — single artifact preserved.

11. **Update GHA workflow** (`.github/workflows/deploy.yml`) to ALSO upload to CF Pages via wrangler after the `npm run build` step. DevOps agent's exact YAML in `analysis-synthesis.md` §2. Add `CLOUDFLARE_API_TOKEN` GHA secret (pull from Doppler).

12. **Comment in `deploy.yml`** at the valuation step: "Canonical URL is https://valuation.somedayconsultants.com (Cloudflare Pages). atmix.org/valuation is a noindex redirect stub kept for legacy links. Do NOT create valuation.atmix.org."

### Day-one operational add

13. **Uptime monitor** on `https://valuation.somedayconsultants.com/` via UptimeRobot free tier (1-min polling, SMS to Matt). Catches the "Sara deletes the CNAME" failure mode.

14. **Canonical URL doc** at `someday-marketing/claudedocs/brand-constants.md` (new file, single paragraph):
    > **Valuation tool:** `valuation.somedayconsultants.com`. This is the only URL to share externally — in email signatures, decks, Calendly confirmations, Smartlead sequences, anywhere. The fallback host `atmix.org/valuation` is a noindex redirect; never link to it.

### Follow-ups (post-launch, do soon but not blocking)

15. **Add CSP and security headers** via `valuation/_headers` file (Cloudflare Pages serves it). Security agent's exact policy in `analysis-security.md` §8.

16. **Fix DNS hygiene** on somedayconsultants.com:
    - Add apex SPF: `v=spf1 include:_spf.google.com ~all`
    - Publish Google Workspace DKIM (currently NXDOMAIN at `google._domainkey.somedayconsultants.com`) — DKIM signing key generated in Google Workspace Admin, then TXT published in Squarespace DNS
    - Add `rua=mailto:matt@somedayconsultants.com` to DMARC, observe 7 days, then ramp `p=none` → `p=quarantine; pct=10` → `p=reject`

17. **Add CAA records** to lock down cert issuance to Let's Encrypt + Google Trust Services.

18. **Rate-limit the worker** with a KV counter keyed on `CF-Connecting-IP`. Stops scripted abuse after CORS tightening, in case anyone bypasses CORS (e.g., by running their own browser).

19. **Defensively register** `valuation-somedayconsultants.com` (hyphen variant) and `somedayconsultants.co` (ccTLD swap). Single $20-30/year cost.

### Long-term consideration (3-6 month horizon)

20. **Move somedayconsultants.com DNS from Squarespace to Cloudflare.** Root-cause + security both flagged this would consolidate ops surface and unblock self-contained cert renewal monitoring. Not urgent. Requires careful sequencing (export all records, re-create in CF, verify, flip nameservers).

## Rollback plan

| Failure | Action | Time to recover |
|---|---|---|
| Cloudflare Pages serves broken build | Roll back to previous CF Pages deployment (wrangler one-liner) | <1 min |
| Brand URL stops resolving (Squarespace CNAME issue) | Remove the CNAME at Squarespace; UptimeRobot alerts Matt | 5-15 min DNS TTL |
| SSL cert provisioning fails | Pages project remains; manual cert refresh via dashboard | minutes |
| Need full revert | Delete the CNAME, leave atmix.org/valuation as the only live URL | 5-15 min DNS TTL |

## What this does NOT change

- `atmix.org/valuation` remains live (as a redirect stub, but functionally still loads the SPA if the redirect script ever fails to fire — fail-open behavior preserved).
- The Cloudflare Worker stays at `somedayhq.com/api/valuation/submit` (no Worker URL change; only CORS tightening).
- Resend sender stays at `matt@mail.somedayconsultants.com`.
- Engine math, PDF generation, parity tests, all engine code — untouched.
