# GTM v1 Revised Strategy — FBARDirect.com

**Date:** 2026-02-18
**Status:** Strategy locked. Implementation Phases 0-5 code-complete. Content pipeline NOT yet implemented.
**Source sessions:** Planning (`cecdad6a`), Implementation (`cff78b9d`)
**Supersedes:** `gtm_v1.md` (original, contains fabricated data — do not cite)

---

## Table of Contents

1. [Fact-Check Report](#1-fact-check-report)
2. [Content Pipeline — Final Locked Design](#2-content-pipeline--final-locked-design)
3. [What Was Implemented vs What Remains](#3-what-was-implemented-vs-what-remains)
4. [Corrected Strategy Numbers](#4-corrected-strategy-numbers)
5. [Content Pipeline Implementation Guide](#5-content-pipeline-implementation-guide)

---

## 1. Fact-Check Report

The original `gtm_v1.md` was produced by a Claude web research agent with zero access to the actual D2C codebase. A thorough fact-check was performed during the planning session, cross-referencing every claim against current data (February 2026) and the real codebase. The verdict: **the document is a well-structured strategy built on a foundation of wrong prices, fabricated statistics, underestimated competition, and total ignorance of the codebase's actual state.**

### Verdict Key

- **CONFIRMED** — Verifiable and accurate
- **PARTIALLY TRUE** — Correct directionally but imprecise
- **MISLEADING** — Technically has basis but framed deceptively
- **UNVERIFIABLE** — No credible primary source found
- **FALSE** — Contradicted by evidence

### 1.1 Market Size Claims

#### "1.7 million annual FBAR filings" — PARTIALLY TRUE, LIKELY STALE

AARO compiles FinCEN data (FinCEN does not routinely publish it). The most recent confirmed figures are:

- 2019: 1,331,415 filings
- 2020: 1,404,395 filings

1.7 million would represent a 21% jump from the last confirmed number. No confirmed figure at or near 1.7M has a citable primary source as of early 2026. The number is plausible given the growth trend but is presented as a hard fact when it is, at best, an extrapolation.

The deeper issue: total filings include corporate and trust filers. The number of individual retail filers — the actual addressable customer for FBARDirect — is a subset of the 1.4-1.7M figure and is never broken out publicly.

**Correction:** Use "approximately 1.4 million annual FBAR filings as of the last confirmed FinCEN data (2020, via AARO)." Mark any higher number as "NEEDS VERIFICATION."

**Source:** [AARO FBAR Filing Data by Year](https://aaro.org/fbar-filing-data-by-year)

#### "$8-27M addressable market" — UNVERIFIABLE, METHODOLOGY SUSPECT

No independent market sizing source for "FBAR filing SaaS" exists. This is a back-of-envelope calculation (filings x price x capture rate). The 3x range ($8M to $27M) signals the author knows the assumptions are shaky. At $49/filing, capturing 5% of 1.7M filings = $4.2M, not $8M. The upper bound of $27M implies either 10% capture at $79 or some larger combination. Neither is grounded in comparable SaaS market data.

**Correction:** This is not a "market size" claim — it is a revenue scenario. Call it what it is. Do not cite in investor materials or board presentations.

#### "IRS using AI to target 125,000+ non-filers" — FALSE AS STATED

This number does not appear in any IRS press release, FinCEN notice, or credible tax publication. What the IRS has said is that AI identified "hundreds" of possible FBAR non-filers with account balances averaging over $1.4M — a statement focused on high-value enforcement, not mass volume. The 125,000 figure appears fabricated or grossly misattributed.

Additionally, the IRS AI enforcement effort targets high-wealth non-filers (avg $1.4M+ in accounts). That population would not convert to a $49 DIY product. This enforcement trend is actually a weak demand signal for FBARDirect's price point.

**Correction:** Remove entirely. Replace with: "The IRS has announced AI-driven enforcement targeting hundreds of high-value FBAR non-filers with average account balances over $1.4M."

**Source:** [IRS AI Enforcement — Journal of Accountancy](https://www.journalofaccountancy.com/news/2023/sep/irs-vows-new-enforcement-efforts-aided-by-ai.html), [IR Global](https://irglobal.com/article/how-does-the-irs-use-ai-to-identify-tax-cheats/)

### 1.2 Pricing Errors

#### "$49 Basic / $79 AI-Assisted" — FALSE

The actual codebase pricing (from `d2c/src/lib/pricing.ts:16,34`):

- **Basic Filing:** $59 (`amountCents: 5900`)
- **Premium Filing:** $79 (`amountCents: 7900`)

The original document uses "$49" throughout — in ad copy examples, metadata suggestions, profitability calculations, and comparison tables. Every instance is wrong.

**Correction:** Replace all "$49" references with "$59". Ad copy headline becomes "From $59" not "From $49." Profitability math changes: at $59 product price, $5 CPC, and 5% conversion rate, CPA = $100 (still unprofitable on first transaction, but the gap is $41 loss per acquisition instead of $51).

### 1.3 Competitor Claims

#### fbar.us "1.8/5 Trustpilot rating with universal scam accusations" — CONFIRMED, ACTUALLY WORSE

The Trustpilot evidence for fbar.us being a deceptive operation is strong. Multiple reviews describe it as a scam that impersonates an official government service, charges for what is free on FinCEN's BSA portal, collects sensitive SSN data, and in some cases never actually filed documents. This is a legitimate differentiator.

However, the "$315+" pricing claim for fbar.us was NOT confirmed. Reviews suggest $50-150 range. The $315 figure may confuse fbar.us with Greenback Tax Services' professional CPA service.

**Correction:** Keep the scam framing. Change pricing to "reportedly charges $50-150 for what FinCEN provides for free."

**Source:** [fbar.us Trustpilot](https://www.trustpilot.com/review/fbar.us)

#### MyExpatTaxes "4,660+ Trustpilot reviews and 5.0 rating" / "$69 FBAR add-on" — PARTIALLY TRUE, MULTIPLE ERRORS

- Actual rating: **4.8/5** on Trustpilot (not 5.0). Review count (~4,664) is roughly accurate.
- The "$69 add-on" claim is outdated or wrong. Current pricing:
  - **Standalone FBAR: $59** (MyExpatFBAR product)
  - FBAR is included in the $175 Base tax return plan, not as a standalone $69 add-on

This is the most damaging error in the original document because it drastically understates the competition. MyExpatTaxes has a dedicated standalone FBAR product at the SAME price as FBARDirect Basic ($59), backed by 4,660+ reviews and a 4.8 rating. The original document frames them as a tax-return company that treats FBAR as an afterthought — the opposite is true.

**Correction:** "MyExpatTaxes (4.8/5 Trustpilot, ~4,660 reviews) offers a standalone FBAR product (MyExpatFBAR) at $59 — making them the most direct competitor at an identical price point."

**Source:** [MyExpatTaxes Trustpilot](https://www.trustpilot.com/review/myexpattaxes.com)

#### "H&R Block matches at $49 DIY" — CONFIRMED

H&R Block's standalone FBAR filing starts at $49. When added to an assisted return, it is $99.

**Source:** [H&R Block FBAR Filing](https://www.hrblock.com/expat-tax-preparation/expat-tax-preparation-and-services/fbar-filing/)

#### Competitors the Original Document MISSED ENTIRELY

| Competitor | Price | Notes |
|-----------|-------|-------|
| **MyExpatFBAR** | $59 standalone | Most direct competitor. Same price as FBARDirect Basic. 4,660+ Trustpilot reviews |
| **Expatfile** | $59 FBAR (requires $119+ tax product) | Clean UX, growing platform |
| **Bright!Tax** | $110 flat fee | Professional filing service |
| **TurboTax gap** | N/A | TurboTax serves ~40M US filers and explicitly tells users to go to BSA portal for FBAR. "The FBAR tool TurboTax doesn't have" is a positioning angle the original doc completely missed |

The document claims "no dominant standalone FBAR filing SaaS." This is directionally correct (no one has "won" the market), but the competitive landscape is significantly denser than implied. H&R Block is at $49, MyExpatTaxes has a purpose-built standalone product at $59 with a dominant Trustpilot presence. FBARDirect enters a market with established players at comparable prices, not an underserved vacuum.

**Source:** [Expatfile FBAR](https://expatfile.tax/fbar/)

### 1.4 SEO/Marketing Statistics

| Claim | Verdict | Notes |
|-------|---------|-------|
| "Schema markup increases AI citation by ~36%" | MISLEADING | Traces to secondary SEO blog posts, not a peer-reviewed study. Directional claim is sound; specific number should not be cited |
| "73% AI Overview selection rate" | MISLEADING | Statistical misrepresentation — this is relative lift, not absolute rate |
| "96% of AI citations from expert credentials" | MISLEADING | Single opaque study, false precision. E-E-A-T connection is real but "96%" is unjustified |
| "69% of searches result in zero clicks" | PARTIALLY TRUE | Post-AI Overviews figure (Similarweb, ~May 2025). Pre-AI Overviews baseline was ~58.5% (SparkToro 2024). Needs context |
| "40-60% interactive tool conversion on warm traffic" | UNVERIFIABLE | No primary source. General finding that interactive > static is supported, specific range is not |
| "Gartner: 25% organic traffic shift to AI chatbots by 2026" | CONFIRMED but MISCHARACTERIZED | Gartner predicted 25% drop in search engine *volume*, not 25% of *organic traffic* shifting. Different claims |

**Sources:**
- [SparkToro 2024 Zero-Click Study](https://sparktoro.com/blog/2024-zero-click-search-study-for-every-1000-us-google-searches-only-374-clicks-go-to-the-open-web-in-the-eu-its-360/)
- [Similarweb AI Overviews Zero-Click Growth](https://www.seroundtable.com/similarweb-google-zero-click-search-growth-39706.html)
- [Gartner 25% Prediction](https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents)
- [Evertune Schema Research](https://www.evertune.ai/research/insights-on-ai/schema-vs-no-schema-does-structured-data-matter-for-ai-search)

### 1.5 Google Ads Claims

| Claim | Verdict | Notes |
|-------|---------|-------|
| Enhanced CPC deprecated March 2025 | CONFIRMED | March 25, 2025. Auto-migration began March 15 |
| Quality Score 39% / 39.5% / 22% breakdown | CONFIRMED with caveat | Industry research, not official Google numbers. Present as "industry research suggests" |
| Search campaigns 28% better than PMax for B2B lead gen | CONFIRMED | Based on 247-account study. Note: FBARDirect is D2C, not B2B — dynamics may differ |
| "$3-7 CPC for FBAR terms" | PLAUSIBLE but UNVERIFIABLE | Consistent with legal/financial category averages ($8.58 legal, $4.51 all-industry). Reasonable estimate, not benchmark |
| FBAR seasonality April 15 / October 15 | CONFIRMED | Standard tax compliance calendar |

**Sources:**
- [Google ECPC Deprecation](https://searchengineland.com/google-ads-deprecate-enhanced-cpc-search-display-446350)
- [Search vs PMax Research](https://groas.ai/post/performance-max-vs-search-campaigns-which-converts-better-in-2025)
- [QS Breakdown — PPC Hero](https://ppchero.com/ultimate-guide-to-adwords-quality-score/)

### 1.6 Claims That Are Confirmed and Safe to Use

- Enhanced CPC deprecated March 25, 2025
- H&R Block $49 standalone FBAR price
- MyExpatTaxes 4.8/5 Trustpilot with ~4,660 reviews (NOT 5.0)
- Gartner 25% search volume drop by 2026 (framed as volume, not traffic)
- 28% better conversion for Search vs PMax in B2B lead gen
- Quality Score ~39/39.5/22 breakdown (cite as industry research)
- ~58-69% zero-click search rate (with AI Overviews context)
- FBAR deadline seasonality April 15 / October 15
- fbar.us is a documented bad actor on Trustpilot
- BSA E-Filing portal lacks currency conversion (confirmed)

---

## 2. Content Pipeline — Final Locked Design

### The Key Decision: Relevance AI Was DROPPED

The original `gtm_v1.md` proposed a 7-phase pipeline: Semrush API -> Google Sheets -> n8n -> Relevance AI -> Claude API -> human review -> GitHub publish.

During the planning session, this pipeline was pressure-tested. The critical finding:

> **Relevance AI is redundant with Claude API's `tool_use`.** Relevance's value proposition is "AI agent that can search the web and read documents." Claude API already does this natively via tool use. You'd be paying for Relevance to call Claude to search the web... when Claude can search the web itself. The only thing Relevance adds is a persistent knowledge base (uploaded IRS pubs, FinCEN docs). But you can achieve the same thing by including those docs as context in the Claude API call directly, or storing them locally and reading them in the n8n workflow.

The overlap analysis from the session:

| Tool | Core Job | What Claude API Already Does |
|------|----------|------------------------------|
| **n8n** | Orchestration, scheduling, API glue | Claude Code handles multi-step workflows natively, but CANNOT schedule or run on cron |
| **Relevance AI** | Web-aware research agents with knowledge base | Claude API tool_use does web search + file reading natively |
| **Claude API** | Writing the actual content | This IS the writer |
| **Gemini/Nano Banana** | Image generation | Nothing — Claude cannot generate images |

**n8n is NOT redundant** — it adds scheduling and visual workflow editing. A Node.js script does the same thing n8n does, but n8n provides:
- Web UI to modify workflows without code
- Cron scheduling ("publish 3 articles every Monday at 9am")
- Webhook triggers
- Error retry logic
- Execution history and logging

### Final Pipeline Architecture

```
n8n (self-hosted on existing VPS, $0/mo)
  |
  +--> Claude API (Haiku) — research: web search, SERP analysis, competitor gaps
  |       |
  |       v
  +--> Claude API (Sonnet) — writing: outline, section drafting, anti-slop review
  |       |
  |       v
  +--> Nano Banana API (Gemini) — hero image generation (~$0.07-0.13/image)
  |       |
  |       v
  +--> GitHub API — commit MDX + images to repo
          |
          v
       Hetzner — git pull + docker compose rebuild on new commits
```

### Cost Per Article

| Component | Cost |
|-----------|------|
| Claude API (Sonnet for writing, Haiku for research) | ~$0.02-0.05 |
| Nano Banana API (Gemini image generation) | ~$0.07-0.13 |
| n8n (self-hosted Docker on existing VPS) | $0.00 |
| GitHub API | $0.00 |
| **Total per article** | **~$0.10-0.18** |

At 3-4 articles/week, monthly cost: approximately $1.50-3.00. Negligible.

### Nano Banana (Gemini Image Generation) Details

Researched during the session:
- **Free tier:** 2-3 images/day via AI Studio (sufficient for manual article production)
- **API:** ~$0.13/image at standard resolution, ~$0.07 with Batch API
- **Pro subscription ($20/mo):** ~100 images/day = $0.007/image if fully utilized

For a blog producing 3-4 articles/week (15-20 images/month), the free tier or API covers this easily.

**Sources:**
- [Nano Banana API Pricing](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Nano Banana Pro Pricing Guide](https://www.aifreeapi.com/en/posts/nano-banana-pro-api-pricing)

### Deployment Architecture

The user has n8n running on a **separate VPS** from the app (which runs on Hetzner in Docker). This is actually better — n8n does not compete for resources with the app. The pipeline:

1. **n8n (existing VPS)** picks topic from queue, calls Claude API, calls Nano Banana API, commits MDX + image to GitHub repo via API
2. **GitHub webhook** (or Hetzner-side cron polling) triggers `git pull && docker compose build && docker compose up -d` on Hetzner
3. Article is live

n8n just needs a GitHub personal access token to push commits. The app server just needs to rebuild on new commits. Clean separation.

### Content Storage: Filesystem MDX + Git Deploy

The decision was **filesystem MDX**, not database-stored content. Rationale:

- MDX files are git-tracked (full version history, diff-able, reviewable in PRs)
- No CMS needed — n8n writes the articles, nobody is manually editing MDX in a code editor
- TinaCMS exists on the portfolio site (`/Users/matt/atmix/tina/`) but was explicitly decided as premature for the FBAR blog
- Filesystem MDX scales fine to ~200+ articles with zero issues
- If a CMS is ever needed, TinaCMS can be added on top of the same MDX files (it is git-backed) — no migration required

| Article Count | Filesystem MDX | With CMS |
|--------------|----------------|----------|
| 1-50 | Perfect. Fast builds, git-tracked | Overkill |
| 50-200 | Fine. Build times ~30-60s | Helps with search/organization |
| 200+ | Build times slow (1-2 min). Need ISR | Visual editor, scheduling become valuable |

---

## 3. What Was Implemented vs What Remains

### Phase 0 — Critical Fixes (DONE)

| Task | Status | Files |
|------|--------|-------|
| Marketing layout refactor (SSR) | DONE | `MobileMenu.tsx`, `MarketingHeader.tsx`, rewritten `layout.tsx` — layout is now a Server Component |
| CSP update for analytics | DONE | `next.config.js` — GA4/GTM domains added to script-src, img-src, connect-src, frame-src |
| Middleware inverted to blocklist | DONE | `middleware.ts` — changed from `publicPaths` allowlist to `authRequiredPrefixes` blocklist |
| Delete duplicate component exports | SKIPPED | All 4 files had single exports — the plan was based on outdated info |

### Phase 1 — SEO Foundation (DONE)

| Task | Status | Files |
|------|--------|-------|
| Root layout metadata overhaul | DONE | `d2c/src/app/layout.tsx` — metadataBase, title template, OG/Twitter cards, icon refs, robots, display:'swap' on fonts |
| Per-page metadata (all 7 pages + threshold) | DONE | Homepage, pricing, about, how-it-works, privacy, terms, threshold |
| Favicon + manifest + OG image | DONE | `public/favicon.svg`, `src/app/manifest.ts`, `src/app/opengraph-image.tsx` (edge-rendered) |
| Sitemap | DONE | `src/app/sitemap.ts` — dynamic, includes blog/country/comparison pages |
| Robots.txt | DONE | `src/app/robots.ts` — disallows api/wizard routes |
| JSON-LD structured data | DONE | `src/components/JsonLd.tsx` + JSON-LD on homepage (Organization, WebApplication, FAQPage), how-it-works (HowTo), BreadcrumbList (all marketing pages via `BreadcrumbJsonLd.tsx`), Article+FAQPage (3 comparison pages), Product/Offer (pricing page) |
| FAQ data extraction | DONE | `src/lib/faq-data.ts` — 33 items in shared data file + 9 comparison-page Q&As = 42 total across site (7 AEO-targeted added 2026-03-01) |
| CPA credential on About page | DONE | Added to about page |

### Phase 2 — Analytics (DONE)

| Task | Status | Files |
|------|--------|-------|
| GTM + GA4 integration | DONE | `src/components/analytics/GoogleTagManager.tsx`, integrated in root layout |
| Conversion events (client-side) | DONE | `begin_checkout` dataLayer push on payment page, `purchase` event on confirmation page (with ref guard) |
| Conversion events (server-side) | DONE | GA4 Measurement Protocol hit on Stripe webhook (`checkout.session.completed`) |
| GTM type declarations | DONE | `src/types/gtm.d.ts` — Window.dataLayer type |
| Privacy policy update | DONE | Updated to disclose analytics usage |
| .env.example update | DONE | Added analytics environment variables |

### Phase 3 — Blog Infrastructure (DONE)

| Task | Status | Files |
|------|--------|-------|
| MDX packages installed | DONE | `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `remark-gfm`, `gray-matter` |
| Blog library | DONE | `src/lib/blog.ts` — MDX frontmatter parsing, slug generation |
| Blog routes | DONE | `src/app/(marketing)/blog/page.tsx` (index), `src/app/(marketing)/blog/[slug]/page.tsx` (detail) |
| Blog content directory | DONE | `src/content/blog/` (empty — no articles yet) |
| next.config.js MDX support | DONE | MDX loader configured |

### Phase 4 — Programmatic SEO (DONE)

| Task | Status | Files |
|------|--------|-------|
| Country pages (10 countries) | DONE | `src/lib/countries-seo.ts` (data), `src/app/(marketing)/fbar/[country]/page.tsx` |
| Comparison pages (3 category comparisons) | DONE | `src/lib/comparisons-seo.ts` (data), `src/app/(marketing)/compare/[slug]/page.tsx` |
| Sitemap entries for new pages | DONE | Country + comparison URLs added to `sitemap.ts` |

Countries implemented: Canada, UK, Germany, Mexico, Australia, Japan, France, Switzerland, Israel, India.

Comparisons implemented:
- FBAR Direct vs BSA E-Filing Portal
- FBAR Direct vs Hiring a CPA
- Best FBAR Filing Services 2026

### Phase 5 — Paid Acquisition Infrastructure (DONE)

| Task | Status | Files |
|------|--------|-------|
| Landing page system | DONE | `src/lib/landing-pages.ts` (4 variants), `src/app/(marketing)/start/layout.tsx` (minimal nav), `src/app/(marketing)/start/[variant]/page.tsx` |
| UTM attribution tracking | DONE | 5 UTM fields on User model, migration created, signup route captures UTMs |

Landing page variants: `file-fbar-online`, `fbar-software`, `fbar-expat`, `fincen-114`.

### Build Status

- `npm run build` passes with 60 pages generated
- **E2E tests verified (2026-02-19):**
  - 2 known test breakages fixed (auth.spec.ts threshold redirect, marketing.spec.ts hero CTA target)
  - 41 new GTM smoke tests written and passing (`d2c/tests/e2e/gtm-smoke.spec.ts`)
  - t06-signup.spec.ts fixed (React hydration detection + `page.fill()` for controlled components)
  - Dev rate limit raised 100→1000 in middleware.ts to prevent test suite rate exhaustion
  - All GTM routes verified in browser: blog, 10 country pages, 3 comparison pages, 4 landing pages, sitemap.xml, robots.txt, JSON-LD

### What Remains — NOT YET IMPLEMENTED

| Item | Priority | Notes |
|------|----------|-------|
| ~~E2E test verification~~ | ~~DONE~~ | Fixed 2 tests, wrote 41 GTM smoke tests, all passing (2026-02-19) |
| **n8n content pipeline** | HIGH | The entire automated article production system. See Section 5 |
| **Blog content** | HIGH | MDX infrastructure exists but zero articles. Need first 5 high-intent articles |
| **Semrush keyword research** | HIGH | No keyword data has been collected. Need to run Semrush API batch |
| **Google Search Console** | MEDIUM | Verification meta tag is in root layout but needs actual GSC account setup |
| ~~**Google Ads campaigns**~~ | ~~MEDIUM~~ | DONE — Configured but paused. See `d2c-google-ads-campaign-2026-02-28.md` |
| ~~**GTM/GA4 container setup**~~ | ~~MEDIUM~~ | DONE — GT-P3JRZMRX + GA4 G-W2KXELPKZE live since 2026-02-28 |
| **Trustpilot integration** | LOW | Start collecting reviews from day one after launch |
| **FBAR Eligibility Checker (free tool)** | LOW | Threshold page partially serves this purpose but not optimized as a lead magnet |
| **Exchange Rate Lookup Tool** | LOW | No competitor offers this as standalone. High utility but not launch-blocking |
| ~~**AEO schema optimization**~~ | ~~HIGH~~ | DONE — BreadcrumbList, Article+FAQPage, Product/Offer schemas + 7 AEO FAQs (2026-03-01) |

---

## 4. Corrected Strategy Numbers

### Pricing (USE THESE)

| Tier | Price | Source |
|------|-------|--------|
| Basic Filing | **$59** | `d2c/src/lib/pricing.ts:16` — `amountCents: 5900` |
| Premium Filing (AI-Assisted) | **$79** | `d2c/src/lib/pricing.ts:34` — `amountCents: 7900` |

### Market Data (USE THESE)

| Metric | Corrected Value | Source |
|--------|----------------|--------|
| Annual FBAR filings | ~1.4M confirmed (2020). NEEDS VERIFICATION for 2024-2025 data | AARO |
| IRS AI enforcement | "Hundreds" of high-value cases (avg $1.4M+ accounts) | IRS/Journal of Accountancy |
| Market size | UNVERIFIABLE — no independent source. Revenue scenario, not market size | N/A |
| MyExpatTaxes Trustpilot | 4.8/5, ~4,660 reviews | Trustpilot |
| MyExpatFBAR standalone price | $59 | MyExpatTaxes website |
| H&R Block FBAR price | $49 standalone, $99 with assisted return | H&R Block website |
| fbar.us pricing | $50-150 range (per complaints). NOT "$315+" | Trustpilot reviews |
| Zero-click search rate | ~58-60% pre-AI Overviews, rising toward 69% post-AI Overviews | SparkToro / Similarweb |
| Gartner search volume prediction | 25% drop in search engine *volume* by 2026 | Gartner (Feb 2024) |

### Competitive Landscape (USE THIS)

| Competitor | Price | Trustpilot | Key Differentiator |
|-----------|-------|------------|-------------------|
| **BSA E-Filing Portal** (FinCEN) | Free | N/A | Government portal. No currency conversion, dated UX, progress saving historically problematic |
| **H&R Block** | $49 standalone | N/A | Established brand, no AI features, generic UX |
| **MyExpatFBAR** (MyExpatTaxes) | $59 standalone | 4.8/5, ~4,660 reviews | Most direct competitor. Dominant Trustpilot presence. No AI statement extraction |
| **Expatfile** | $59 (requires $119+ tax product) | Growing | Clean UX, full expat tax platform |
| **FBARDirect** | $59 Basic / $79 Premium | None yet | AI bank statement reader (unique). Save/resume. Auto currency conversion |
| **Bright!Tax** | $110 flat fee | N/A | Professional CPA service |
| **Greenback** | $125+ | N/A | Professional CPA service |
| **fbar.us** | $50-150 | 1.8/5 (scam) | Documented bad actor. Impersonates government service |

### FBARDirect's Actual Differentiators

1. **AI bank statement reader** — No competitor offers automated extraction of maximum account values from bank statement PDFs. This directly solves the biggest pain point in FBAR filing
2. **Save and resume** — BSA E-Filing portal's most-complained-about limitation
3. **Auto currency conversion** — Portal requires manual USD conversion with no guidance on rates
4. **TurboTax gap** — TurboTax serves ~40M US filers and explicitly directs them to BSA portal for FBAR. "The FBAR tool TurboTax doesn't have" is an untapped positioning angle

### Ad Copy (CORRECTED)

Original document uses "$49" in all ad copy. Correct versions:

- Headline: "$59 FBAR Filing - Start Now" (not $49)
- Description: "From $59. Secure & FinCEN-compliant." (not "From $49")
- Price extension: $59 Basic / $79 Premium (not $49/$79)
- Sitelink: "Pricing - From $59" (not "From $49")

### Profitability Math (CORRECTED)

At **$59** product price, $5 CPC, and 5% conversion rate:
- CPA = $100
- Loss per acquisition = $41 (not $51 as the doc calculated with $49)
- Still unprofitable on first transaction
- Path to profitability: landing page CVR above 8-10%, lower CPCs via Quality Score, or annual recurring revenue (3-5 year LTV of $177-$395 at $59)
- Note: 5% CVR on cold paid traffic is optimistic. Industry benchmarks for financial SaaS are 2-4%, producing CPA of $125-250

---

## 5. Content Pipeline Implementation Guide

### Prerequisites

- n8n self-hosted on Docker (existing VPS) — running and accessible
- Claude API key with access to Sonnet and Haiku models
- Gemini API key (Nano Banana) for image generation
- GitHub personal access token with repo write access
- Hetzner server with rebuild mechanism (webhook or cron polling)

### Architecture Overview

```
                    n8n (your existing VPS)
                           |
         +-----------------+-----------------+
         |                 |                 |
    [Keyword Queue]   [Scheduler]     [Execution Log]
         |            (cron: Mon/       (n8n native)
         |             Wed/Fri)
         |                 |
         v                 v
    +----+----+      +-----+-----+
    | Phase 1  |      | Phase 2    |
    | Research |      | Outline    |
    | (Haiku)  |      | (Sonnet)   |
    +----+----+      +-----+-----+
         |                 |
         v                 v
    +----+----+      +-----+-----+
    | Phase 3  |      | Phase 4    |
    | Drafting |      | Anti-Slop  |
    | (Sonnet) |      | Review     |
    +----+----+      | (Sonnet)   |
         |           +-----+-----+
         |                 |
         v                 v
    +----+----+      +-----+-----+
    | Phase 5  |      | Phase 6    |
    | Image    |      | Fact-Check |
    | (Gemini) |      | (Haiku)    |
    +----+----+      +-----+-----+
         |                 |
         +--------+--------+
                  |
                  v
           +------+------+
           | Phase 7      |
           | GitHub Commit|
           | (MDX+image)  |
           +------+------+
                  |
                  v
           +------+------+
           | Hetzner      |
           | Rebuild      |
           +--------------+
```

### Step 1: n8n Workflow Nodes

Create a single n8n workflow with the following nodes connected sequentially:

#### Node 1: Cron Trigger
- **Type:** Schedule Trigger
- **Schedule:** Mon/Wed/Fri 9:00 AM ET
- **Output:** Triggers the pipeline

#### Node 2: Read Topic Queue
- **Type:** HTTP Request (to GitHub API) or Code node reading from a JSON file
- **Configuration:**
  - GET `https://api.github.com/repos/{owner}/{repo}/contents/d2c/src/content/content-queue.json`
  - Parse the JSON, pick the first item with `status: "pending"`
  - Pass keyword, target slug, topic brief, and search intent downstream

**content-queue.json format:**
```json
[
  {
    "slug": "how-to-calculate-maximum-fbar-account-value",
    "keyword": "how to calculate maximum account value FBAR",
    "intent": "informational",
    "brief": "Step-by-step guide for calculating maximum account value across 12 months of statements in foreign currencies. Include Treasury rate sourcing, multi-currency examples with dollar amounts.",
    "status": "pending",
    "pillar": "exchange-rates-valuation"
  },
  {
    "slug": "fbar-for-green-card-holders",
    "keyword": "FBAR green card holder",
    "intent": "informational",
    "brief": "Filing obligations for green card holders. Distinguish from citizens and visa holders. Include example scenarios with account thresholds.",
    "status": "pending",
    "pillar": "fbar-requirements"
  }
]
```

#### Node 3: Research (Claude API — Haiku)
- **Type:** HTTP Request
- **Method:** POST to `https://api.anthropic.com/v1/messages`
- **Headers:**
  - `x-api-key: {{$credentials.anthropicApiKey}}`
  - `anthropic-version: 2023-06-01`
  - `content-type: application/json`
- **Body:**
```json
{
  "model": "claude-3-5-haiku-latest",
  "max_tokens": 4000,
  "system": "You are a tax compliance research assistant. Your job is to compile accurate, source-cited research notes for a blog article about FBAR (FinCEN Form 114) filing.\n\nFor every claim, cite the specific regulatory source:\n- FinCEN BSA regulations: 31 CFR Part 1010\n- IRS publications: Pub 54 (Tax Guide for US Citizens Abroad), Pub 519 (Tax Guide for Aliens)\n- IRC sections: 31 USC 5314, 31 USC 5321\n- FinCEN FBAR filing instructions\n- Bittner v. United States (2023) for penalty calculations\n\nInclude specific dollar amounts, form numbers, and deadlines. Never use hedging language like 'it is important to note' or 'in the ever-changing landscape.'",
  "tools": [
    {
      "name": "web_search",
      "type": "computer_20250124",
      "description": "Search the web for current FBAR regulatory information"
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "Research the following topic for an FBAR blog article:\n\nKeyword: {{$json.keyword}}\nSearch Intent: {{$json.intent}}\nBrief: {{$json.brief}}\n\nProvide:\n1. Key regulatory citations with specific section numbers\n2. Current penalty amounts (2025/2026 inflation-adjusted)\n3. Relevant case law or IRS rulings\n4. Common misconceptions to address\n5. Specific examples with dollar amounts\n6. What competitors' articles on this topic miss\n7. Internal link opportunities to these pages: /pricing, /how-it-works, /threshold, /fbar/[country]"
    }
  ]
}
```

#### Node 4: Outline (Claude API — Sonnet)
- **Type:** HTTP Request
- **Method:** POST to `https://api.anthropic.com/v1/messages`
- **Body:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 3000,
  "system": "You are a senior CPA and Enrolled Agent with 20+ years of expatriate tax compliance experience. Write as a practitioner sharing expertise.\n\nCreate a detailed article outline. For each section, specify:\n- Section heading (H2 or H3)\n- Key points to cover (3-5 bullets)\n- Specific regulatory citation to include\n- Concrete example with dollar amounts\n- Word count target (300-500 per section)\n\nNever suggest sections titled 'Introduction' or 'Conclusion.' Start with the most important information. End with a clear CTA to FBARDirect.\n\nBanned phrases: 'in today's fast-paced world', 'navigating the complex landscape', 'it's important to note', 'in conclusion', 'without further ado', 'let's dive in', 'when it comes to', 'at the end of the day'.",
  "messages": [
    {
      "role": "user",
      "content": "Create an article outline for:\n\nKeyword: {{$json.keyword}}\nTarget slug: {{$json.slug}}\nResearch notes:\n{{$node['Research'].json.content[0].text}}\n\nThe article should be 1,500-2,500 words total. Include 5-7 sections. Every section must contain at least one specific dollar amount, form reference, or regulatory citation."
    }
  ]
}
```

#### Node 5: Section Drafting (Claude API — Sonnet, batched)
- **Type:** Split In Batches + HTTP Request loop
- **Logic:** Parse the outline into individual sections. For each section, call Claude Sonnet with the section outline + full research context.
- **Per-section prompt:**
```
Write section: "{{$json.sectionHeading}}"

Key points: {{$json.keyPoints}}
Required citation: {{$json.citation}}
Required example: {{$json.example}}
Word count: {{$json.wordCount}}

Full research context:
{{$node['Research'].json.content[0].text}}

Rules:
- Write 300-500 words for this section
- Include at least one specific dollar amount
- Include at least one IRS/FinCEN citation with section number
- Vary sentence structure (mix short declarative with longer explanatory)
- Use active voice
- No hedging ("may", "might", "could potentially") unless genuinely uncertain
- If referencing a FBARDirect feature, link to the relevant page
```

- After all sections complete, use a **Merge** node to concatenate them.

#### Node 6: Anti-Slop Review (Claude API — Sonnet)
- **Type:** HTTP Request
- **System prompt:**
```
You are an editorial quality reviewer for a CPA's professional blog about FBAR filing. Review this draft and perform these edits:

1. REMOVE all AI cliches:
   - "it's worth noting" -> delete or rephrase
   - "in today's landscape" -> delete
   - "navigating" (when used metaphorically) -> replace with specific verb
   - "comprehensive" (when used as filler) -> delete
   - "crucial" / "essential" / "vital" (when used as generic emphasis) -> replace with specific consequence
   - "streamline" / "leverage" / "utilize" -> use simpler verbs
   - "empower" / "unlock" / "transform" -> delete or use concrete description
   - Any sentence starting with "It is important to" -> rephrase to state the fact directly

2. REPLACE generic statements with specific facts:
   - "significant penalties" -> "penalties up to $16,536 per report (2026 inflation-adjusted)"
   - "file by the deadline" -> "file FinCEN Form 114 by April 15, 2026 (automatic extension to October 15, 2026)"
   - "foreign accounts" -> specify which types

3. ENSURE varied sentence structure:
   - No more than 2 consecutive sentences starting with the same word
   - Mix short (5-10 word) sentences with longer (20-30 word) explanations
   - At least one paragraph per section should start with a specific number or date

4. ADD professional judgment where hedging is excessive:
   - Replace "you may want to consider" with direct recommendation
   - Replace "it depends on your situation" with specific scenario breakdown

5. FLAG sections that need human expertise:
   - Mark with [HUMAN REVIEW: reason] where the CPA should add personal experience

6. VERIFY every paragraph contains at least one: specific dollar amount, form number, regulatory citation, or concrete date

Return the complete revised draft.
```

#### Node 7: Image Generation (Nano Banana / Gemini API)
- **Type:** HTTP Request
- **Method:** POST to Gemini API endpoint
- **Prompt template:**
```
Create a professional blog header image for an article about FBAR (Report of Foreign Bank and Financial Accounts) filing. The article topic is: "{{$json.keyword}}".

Style: Clean, professional, financial/compliance aesthetic. Use navy blue (#1a4480) and white as primary colors. Include subtle visual elements related to: international banking, tax compliance, US government forms, or currency exchange. No text in the image. No stock photo feel. Modern, minimal, trustworthy.

Resolution: 1200x630 pixels (social media / OG image dimensions).
```
- Save the generated image as a base64 string for the GitHub commit.

#### Node 8: Fact-Check (Claude API — Haiku)
- **Type:** HTTP Request
- **System prompt:**
```
You are a regulatory compliance fact-checker. Review this FBAR blog article and verify every factual claim:

1. Check all penalty amounts against current (2026) inflation-adjusted figures
2. Verify all IRS publication references exist and say what the article claims
3. Confirm all FinCEN regulation citations (31 CFR Part 1010.xxx) are correct
4. Verify all deadlines and dates
5. Check that the Bittner v. United States ruling is accurately described
6. Flag any claims that need a primary source citation

For each issue found, output:
- CLAIM: [the exact text]
- VERDICT: CORRECT / INCORRECT / NEEDS SOURCE
- CORRECTION: [if incorrect, the correct information]
- SOURCE: [the authoritative source]

If no issues found for a section, output: "Section [name]: All claims verified."
```

#### Node 9: Format MDX
- **Type:** Code node (JavaScript)
- **Logic:**
```javascript
const slug = $input.first().json.slug;
const keyword = $input.first().json.keyword;
const draft = $input.first().json.revisedDraft;
const factCheck = $input.first().json.factCheckReport;
const imageBase64 = $input.first().json.heroImage;
const now = new Date().toISOString().split('T')[0];

// Generate frontmatter
const mdxContent = `---
title: "${keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"
slug: "${slug}"
date: "${now}"
author: "[Founder Name], CPA"
description: "${draft.substring(0, 155).replace(/"/g, '\\"')}..."
keywords:
  - ${keyword}
  - FBAR
  - FinCEN Form 114
image: "/blog/${slug}/hero.png"
pillar: "${$input.first().json.pillar || 'general'}"
---

${draft}

---

*[Founder Name] is a licensed CPA specializing in international tax compliance and FBAR filing. File your FBAR in under 10 minutes at [FBARDirect.com](https://fbardirect.com).*
`;

return [{
  json: {
    slug,
    mdxContent,
    imageBase64,
    factCheckReport: factCheck,
    filePath: `d2c/src/content/blog/${slug}.mdx`,
    imagePath: `d2c/public/blog/${slug}/hero.png`,
  }
}];
```

#### Node 10: GitHub Commit
- **Type:** HTTP Request (GitHub API)
- **Method:** Create a commit with two files using the GitHub Trees API

Step 1: Get the current commit SHA of main branch:
```
GET /repos/{owner}/{repo}/git/ref/heads/main
```

Step 2: Create blobs for MDX content and image:
```
POST /repos/{owner}/{repo}/git/blobs
{ "content": "{{mdxContent}}", "encoding": "utf-8" }

POST /repos/{owner}/{repo}/git/blobs
{ "content": "{{imageBase64}}", "encoding": "base64" }
```

Step 3: Create a tree with both files:
```
POST /repos/{owner}/{repo}/git/trees
{
  "base_tree": "{{currentTreeSha}}",
  "tree": [
    { "path": "{{mdxFilePath}}", "mode": "100644", "type": "blob", "sha": "{{mdxBlobSha}}" },
    { "path": "{{imagePath}}", "mode": "100644", "type": "blob", "sha": "{{imageBlobSha}}" }
  ]
}
```

Step 4: Create commit:
```
POST /repos/{owner}/{repo}/git/commits
{
  "message": "content: add article '{{slug}}'",
  "tree": "{{newTreeSha}}",
  "parents": ["{{currentCommitSha}}"]
}
```

Step 5: Update ref:
```
PATCH /repos/{owner}/{repo}/git/ref/heads/main
{ "sha": "{{newCommitSha}}" }
```

#### Node 11: Update Queue Status
- **Type:** Code node + GitHub API
- Read `content-queue.json`, update the article's status from "pending" to "published" with `publishDate`, commit back to GitHub.

#### Node 12: Notify (Optional)
- **Type:** Gmail or Slack node
- Send the fact-check report and a link to the committed article for human review.
- If any fact-check items were flagged as INCORRECT or NEEDS SOURCE, mark the email as high priority.

### Step 2: Claude API Prompt Templates

All prompts are embedded in the nodes above. The key anti-slop rules to enforce across ALL prompts:

**Banned phrases (include in every system prompt):**
```
Never use these phrases:
- "in today's fast-paced world"
- "navigating the complex landscape"
- "it's important to note"
- "it's worth mentioning"
- "without further ado"
- "let's dive in"
- "when it comes to"
- "at the end of the day"
- "the bottom line is"
- "in conclusion"
- "comprehensive guide"
- "everything you need to know"
- "unlock the power of"
- "streamline your"
- "leverage"
- "utilize" (use "use")
- "empower"
- "seamless"
- "robust"
- "cutting-edge"
- "game-changer"
```

**Required in every article:**
- Minimum 3 specific dollar amounts per 500 words
- Minimum 2 regulatory citations per 500 words (IRS pub numbers, CFR sections, IRC sections)
- At least one concrete example scenario per section ("For example, if you have a Swiss bank account with CHF 50,000...")
- Every paragraph starts with different words (no repetitive sentence openers)
- CTA to FBARDirect at least twice: once mid-article, once at end

### Step 3: Image Generation Prompts

**Style guide for Nano Banana:**
```
Professional financial compliance blog header. Navy blue (#1a4480) dominant color.
Clean, modern, minimal aesthetic. No text overlays. No stock photo style.
Abstract or geometric representations of: [topic-specific element].
Aspect ratio: 1200x630. High contrast for social media thumbnails.
```

**Topic-specific elements:**
- Currency/exchange articles: currency symbols, exchange rate charts, globe
- Penalty articles: IRS building, warning symbols, legal scales
- Country-specific: subtle flag elements, landmarks, map outlines
- How-to guides: checklist, step indicators, form layouts
- Expat articles: passport, world map, travel elements

### Step 4: GitHub Commit Automation

The GitHub Trees API approach (documented in Node 10 above) allows atomic commits of both MDX and image files. This is more reliable than separate file-by-file commits.

**Required GitHub token permissions:**
- `repo` (full repository access) — needed for creating trees, blobs, commits, and updating refs
- Or more granularly: `contents:write` if using fine-grained tokens

**Token storage:** Store the GitHub PAT as an n8n credential (Settings > Credentials > Header Auth or Generic Credential). Never hardcode in workflow nodes.

### Step 5: Publishing Schedule

**Phase 1 (Months 1-3): 3 articles/week (Mon/Wed/Fri 9am ET)**

Start with the 5 highest-intent articles that convert:
1. "How to Calculate Maximum Account Value for FBAR" (biggest pain point, no competitor covers well)
2. "FBAR for Green Card Holders" (underserved audience, high conversion intent)
3. "FBAR for Cryptocurrency on Foreign Exchanges" (emerging topic, low competition)
4. "FBAR Filing Deadline 2026: April 15 and October 15 Extension" (seasonal, time-sensitive)
5. "What Happens If You Don't File an FBAR: Penalties Explained" (fear/urgency driver)

Then expand to pillar pages and cluster articles per the original GTM content architecture (5 pillars, 55 cluster articles).

**Phase 2 (Months 4-8): 2 articles/week**

Complete cluster articles. Update pillar pages with fresh data. Deploy remaining programmatic SEO pages.

**Phase 3 (Months 9+): 1 article/week**

Seasonal updates (new year deadlines, penalty amounts, exchange rates). New situational pages based on search trends. Quarterly freshness updates to existing content.

**Seasonal timing:**
- Publish FBAR deadline/requirements content in January (4-8 weeks before Feb-April peak)
- Update extension content in August (before Sep-October peak)
- Annual refresh of all country pages in December/January with new exchange rates

### First 5 Articles — Detailed Briefs

**Article 1: "How to Calculate Maximum Account Value for FBAR"**
- Target keyword: "how to calculate maximum account value FBAR"
- Search intent: Informational (how-to)
- Why this first: This is the #1 pain point in FBAR filing. No competitor explains this well. The AI bank statement reader directly solves this — natural product tie-in
- Key content: Step-by-step calculation, Treasury reporting rates vs IRS rates, multi-currency account examples, what counts as "maximum value" (not year-end balance), joint account rules
- CTA: "FBARDirect's AI reads your bank statements and calculates maximum values automatically"
- Internal links: /pricing, /how-it-works, /threshold

**Article 2: "FBAR for Green Card Holders"**
- Target keyword: "FBAR green card holder"
- Search intent: Informational (audience-specific)
- Why this: Every competitor targets "expats." Green card holders are a large, underserved FBAR-filing population
- Key content: When obligation begins, difference from citizen obligations, common scenarios (maintaining accounts in home country), spousal accounts, what happens if green card is abandoned
- CTA: "Check if you need to file at FBARDirect.com"
- Internal links: /threshold, /fbar/[relevant-country]

**Article 3: "FBAR for Cryptocurrency on Foreign Exchanges"**
- Target keyword: "FBAR cryptocurrency foreign exchange"
- Search intent: Informational (emerging topic)
- Why this: Pending FinCEN proposed rule on virtual currency FBAR reporting. Low competition, high interest
- Key content: Current rules (foreign exchange = reportable), pending proposed rule, which exchanges are "foreign," how to value crypto holdings, specific exchange examples (Binance, Kraken non-US)
- CTA: "File your FBAR including crypto accounts at FBARDirect.com"

**Article 4: "FBAR Filing Deadline 2026"**
- Target keyword: "FBAR deadline 2026"
- Search intent: Navigational/transactional (seasonal)
- Why this: High seasonal search volume, direct conversion path
- Key content: April 15 deadline, automatic October 15 extension (no form needed), late filing penalties ($16,536 non-willful per Bittner), delinquent submission procedures, what "automatic extension" actually means
- CTA: "File your FBAR now before the deadline at FBARDirect.com"

**Article 5: "FBAR Penalties: What Happens If You Don't File"**
- Target keyword: "FBAR penalty"
- Search intent: Informational (fear/urgency)
- Why this: High search volume, strong urgency driver, converts anxiety into action
- Key content: Non-willful penalty ($16,536 per report post-Bittner), willful penalty ($100,000 or 50% of account balance), Bittner v. United States ruling (per-report not per-account), delinquent FBAR procedures, reasonable cause defense, IRS AI enforcement
- CTA: "Avoid penalties — file your FBAR today at FBARDirect.com"

---

## Appendix A: Decisions Log

All decisions made during the interactive planning session:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Marketing layout SSR | Full refactor (Option A) | Layout was 330 lines of `'use client'`. Extracted MobileMenu + MarketingHeader as client components. Marketing pages now SSR |
| CSP update timing | Now (Option A) | One-line change prevents guaranteed debugging session when analytics is added |
| Duplicate component exports | Skipped | Investigation found all 4 files had single exports — outdated info in plan |
| Root layout metadata | Full overhaul (Option A) | metadataBase, title template, OG/Twitter, icons, robots, font display:swap |
| Per-page metadata | All 7 pages + threshold (Option A) | Even privacy/terms need canonical URLs to avoid duplicate content from UTM params |
| Structured data schemas | All 4 (Option A) | FAQPage + HowTo data already existed in components. Organization + WebApplication trivial |
| Middleware architecture | Invert to blocklist (Option C) | New routes (blog, country, comparison, landing) should be public by default without touching middleware each time |
| Analytics stack | GTM + GA4 + update privacy policy (Option D) | Long-term stack for Google Ads. Privacy policy was a 5-minute text change |
| Conversion tracking | Client + server Measurement Protocol (Option C) | Client-side for real-time, server-side via Stripe webhook for reliability |
| Blog infrastructure | Filesystem MDX (Option A) | Git-tracked, no CMS overhead, scales to 200+ articles |
| CMS | Not now. TinaCMS available if needed at 100+ articles | n8n writes articles, nobody edits MDX manually. CMS adds maintenance burden |
| Content pipeline | n8n + Claude API + Nano Banana. Relevance AI dropped | Relevance is redundant with Claude tool_use. n8n adds scheduling (the one thing Claude Code cannot do) |
| Image generation | Nano Banana (Gemini) | ~$0.07-0.13/image. Free tier covers manual production. API for automated pipeline |
| Country pages | Top 10, substantive (Option A) | 10 substantive pages > 50 thin ones. YMYL quality bar. Countries: CA, UK, DE, MX, AU, JP, FR, CH, IL, IN |
| Comparison pages | Category comparisons, not named competitors (Option A) | "vs BSA E-Filing," "vs CPA," "Best FBAR Services 2026." Named competitor pages are Phase 4+ |
| Landing pages | Per-ad-group variants via generateStaticParams (Option C) | 4 variants: file-fbar-online, fbar-software, fbar-expat, fincen-114. Minimal layout (no full nav) |
| UTM tracking | DB-level on User model (5 fields) | utm_source, utm_medium, utm_campaign, utm_term, utm_content captured at signup |
| FinCEN XML | Out of scope | B2B version works. Port to D2C after B2B launches |
| First 5 articles | High-intent topics | Max account value calculation, green card holders, crypto, deadline 2026, penalties |
| Content schedule | Mon/Wed/Fri 9am ET via n8n cron | 3 articles/week Phase 1, 2/week Phase 2, 1/week Phase 3 |

## Appendix B: Source Links

All sources cited during the fact-check and planning sessions:

- [AARO FBAR Filing Data by Year](https://aaro.org/fbar-filing-data-by-year)
- [IRS AI Enforcement — Journal of Accountancy](https://www.journalofaccountancy.com/news/2023/sep/irs-vows-new-enforcement-efforts-aided-by-ai.html)
- [IRS AI for FBAR Non-Filer Identification — IR Global](https://irglobal.com/article/how-does-the-irs-use-ai-to-identify-tax-cheats/)
- [MyExpatTaxes Trustpilot](https://www.trustpilot.com/review/myexpattaxes.com)
- [fbar.us Trustpilot](https://www.trustpilot.com/review/fbar.us)
- [H&R Block FBAR Filing](https://www.hrblock.com/expat-tax-preparation/expat-tax-preparation-and-services/fbar-filing/)
- [Expatfile FBAR](https://expatfile.tax/fbar/)
- [Nano Banana API Pricing](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Nano Banana Pro Pricing Guide](https://www.aifreeapi.com/en/posts/nano-banana-pro-api-pricing)
- [SparkToro 2024 Zero-Click Study](https://sparktoro.com/blog/2024-zero-click-search-study-for-every-1000-us-google-searches-only-374-clicks-go-to-the-open-web-in-the-eu-its-360/)
- [Similarweb AI Overviews Zero-Click Growth](https://www.seroundtable.com/similarweb-google-zero-click-search-growth-39706.html)
- [Gartner 25% Search Volume Prediction](https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents)
- [Google ECPC Deprecation](https://searchengineland.com/google-ads-deprecate-enhanced-cpc-search-display-446350)
- [Search vs PMax Conversion Research](https://groas.ai/post/performance-max-vs-search-campaigns-which-converts-better-in-2025)
- [Quality Score Breakdown — PPC Hero](https://ppchero.com/ultimate-guide-to-adwords-quality-score/)
- [Evertune Schema Research](https://www.evertune.ai/research/insights-on-ai/schema-vs-no-schema-does-structured-data-matter-for-ai-search)
- [AI SEO Statistics — Position Digital](https://www.position.digital/blog/ai-seo-statistics/)
