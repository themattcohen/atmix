# Google Ads Campaign: FBAR Filing Search

**Campaign ID**: 23604927744
**Account**: 217-281-2717 (1mattcohen@gmail.com)
**Status**: PAUSED (ready to unpause)
**Budget**: $33/day (~$1,000/month)
**Date**: February 28, 2026

---

## Current Campaign State

### Ad Groups (4 active)

| Ad Group | Keywords | Match Types | Status |
|----------|----------|-------------|--------|
| **Intent** | 27 keywords | Exact + Phrase | Enabled |
| **Deadline** | 14 keywords | Exact + Phrase | Enabled |
| **Expat** | 10 keywords | Exact + Phrase | Enabled |
| **Late/Penalty** | 4 keywords | Exact + Phrase | Paused (ad group paused) |

**Total**: 55 keywords, all at **$3.50 max CPC**

### Ads (4 responsive search ads)

| Ad Group | Headlines (sample) | Ad Strength |
|----------|-------------------|-------------|
| Intent | "File Your FBAR Online -- $59" / "FBAR Filing -- $59 or $79" / "FinCEN-Registered FBAR Filer" | Poor |
| Deadline | "FBAR Due April 15. File Now." / "FBAR Deadline -- $59 or $79" | Average |
| Expat | "American Abroad? File FBAR" / "Expat FBAR Filing -- $59" | Poor |
| Late/Penalty | "Late FBAR? File Now. $59." / "Missed FBAR Deadline? We Help" | Average |

### Landing Pages

| Variant Slug | URL | Target Ad Group |
|-------------|-----|-----------------|
| `file-fbar-online` | fbardirect.com/start/file-fbar-online | Intent |
| `fbar-software` | fbardirect.com/start/fbar-software | Intent (AI) |
| `fbar-expat` | fbardirect.com/start/fbar-expat | Expat |
| `fincen-114` | fbardirect.com/start/fincen-114 | Intent |
| `fbar-filing` | fbardirect.com/start/fbar-filing | Intent (new) |
| `default` | fbardirect.com/start/default | Fallback |

All landing pages include:
- "Why Use FBAR Direct?" comparison table (BSA E-Filing vs FBAR Direct)
- 3-step process section
- Dual CTA buttons
- 100% money-back guarantee

### Conversion Tracking

- **Google Tag**: `GT-P3JRZMRX` (gtag.js, NOT GTM container)
- **GA4 Stream**: `G-W2KXELPKZE`
- **Conversion action**: Configured for signup/payment events
- **Enhanced Conversions**: Enabled
- **Cookie consent**: Implemented

### Seasonal Features (Live)

- **Deadline banner**: Countdown to April 15, 2026, shown on all marketing pages
- Turns red when <= 14 days remaining
- Dismissible (localStorage persistence)
- Component: `d2c/src/components/landing/DeadlineBanner.tsx`

---

## ROI Analysis (Semrush Data, Feb 2026)

### Market Opportunity

| Keyword | Monthly Volume (US) | CPC | Competition |
|---------|-------------------|-----|-------------|
| fbar (head term) | 14,800 | $1.82 | 0.31 |
| fbar filing | 8,100 | ~$2 | low |
| fbar filing requirements | 1,900 | ~$2 | low |
| fbar form | 1,900 | ~$2 | low |
| fbar filing online | 1,600 | ~$2 | low |
| file fbar online | 1,300 | $2.22 | 0.26 |
| **Total FBAR cluster** | **~99,700** | | |

**Key finding**: Competitive density 0.26-0.31 (out of 1.0) -- virtually no ad competition. Only 1-6 ads showing for FBAR keywords. This is a blue ocean.

### Unit Economics

| Tier | Price | Stripe Fee | Gross Profit | Margin |
|------|-------|-----------|-------------|--------|
| Basic | $59 | $1.60 | $57.40 | 97.3% |
| Premium | $79 | $2.04 | $75.46 | 95.5% |
| **Blended (55/45)** | **$68** | $1.80 | **$65.52** | 96.4% |

### CPA Scenarios

| Scenario | CPC | CTR | CVR | CPA | Profit/Customer | ROAS |
|----------|-----|-----|-----|-----|----------------|------|
| Conservative | $3.50 | 3% | 2% | $175 | -$110 | 0.39:1 |
| Moderate | $2.50 | 5% | 3% | $83 | -$18 | 0.82:1 |
| **Realistic** | $2.50 | 5% | 4% | $63 | +$3 | 1.08:1 |
| Optimistic | $2.00 | 7% | 5% | $40 | +$26 | 1.70:1 |

**Break-even CVR**: ~4% at $2.50 CPC. Tax/compliance services typically see 3-7% CVR on high-intent keywords.

### Lifetime Value

| Metric | Value |
|--------|-------|
| Year 1 ARPU | $68 |
| Year 2 retention (est 65%) | $44 |
| Year 3 retention (est 42%) | $29 |
| **3-Year LTV** | **$141** |

At realistic CPA ($63): LTV:CAC = 2.2:1 (acceptable)

---

## What Was Done (Feb 28, 2026)

### Code Changes (deployed to fbardirect.com)

1. **Added `fbar-filing` landing variant** -- targets highest-volume keyword (8,100/mo)
   - File: `d2c/src/lib/landing-pages.ts`

2. **Added "Why Use FBAR Direct?" comparison table** -- on all `/start/[variant]` pages
   - Compares BSA E-Filing (free) vs FBAR Direct ($59) across 5 dimensions
   - File: `d2c/src/app/(marketing)/start/[variant]/page.tsx`

3. **Upgraded deadline banner** -- live countdown to April 15, 2026
   - Shows "X days remaining", turns red at <= 14 days
   - File: `d2c/src/components/landing/DeadlineBanner.tsx`

### Google Ads Changes (via Chrome DevTools)

1. **Expanded keyword portfolio**: Added 11 new phrase-match keywords
   - Intent: "fbar filing", "fbar filing online", "fbar form 114", "file fbar", "fbar e-filing"
   - Expat: "expat fbar", "fbar for americans abroad", "us citizen foreign bank account"
   - Deadline: "fbar deadline", "fbar deadline 2026", "fbar due date"

2. **Enabled phrase match variants**: All existing paused phrase-match keywords activated (each keyword now has both exact + phrase match)

3. **Set CPC to $3.50**: All 55 keywords at $3.50 max CPC (was $0.01 for new, $3.50 for existing)

4. **Reactivated Deadline ad group**: Was paused, now enabled with 3 new deadline keywords

5. **Reviewed ad copy**: All 4 ads already have strong commercial intent ("we file FOR you", pricing, speed, trust signals)

---

## How to Unpause

1. Go to [Google Ads](https://ads.google.com) > Campaigns > "FBAR Filing Search"
2. Click the status toggle or "Change status" > Enable
3. Ads will start showing within hours (new keywords may take 1-2 days for review)

### Budget Recommendation

Start with current $33/day (~$1,000/month). This gives ~400 clicks/month at $2.50 avg CPC.

If you want faster data:
- $50/day (~$1,500/month) = ~600 clicks/month (recommended minimum for statistical significance)
- To change: Campaign > Settings > Budget

---

## Post-Launch Monitoring Playbook

### Week 1-2: Daily Monitoring

Check these daily in Google Ads:
- **Impression share** -- target >70% on your keywords
- **Actual CPC** -- expect $2-3.50 (if much lower, competition is even weaker)
- **CTR** -- target >5% (below 3% = ad copy needs work)
- **Search Terms report** -- what queries actually triggered your ads

In Google Analytics (GA4):
- Landing page bounce rate
- Signup funnel: landing page > threshold > signup > payment

### Week 3-4: First Optimization

1. **Add negative keywords** from Search Terms report (block irrelevant queries like "fbar penalty calculator", "fbar form download")
2. **Pause non-converting keywords** -- if a keyword has 50+ clicks and 0 conversions, pause it
3. **If CTR < 3%**: Test new headline variations
4. **If CVR < 3%**: Review landing page > signup drop-off, consider A/B testing

### Month 2: ROI Evaluation

| CPA | Action |
|-----|--------|
| < $80 | Scale budget to $2,500/month |
| $80-120 | Optimize ads + landing pages |
| > $120 | Pause campaign, investigate funnel, consider SEO-first |

### After 500 Clicks: Match Type Tightening

Review Search Terms report. For keywords where phrase match is triggering irrelevant queries:
- Switch those specific keywords back to exact match
- Keep phrase match for keywords performing well

---

## Future Improvements (Not Yet Done)

### P4: Remarketing Campaign (HIGH VALUE)
- No remarketing is set up yet
- Expected 5-10% CVR from remarketing (vs 3-5% from cold search)
- Requires: Google Ads remarketing audience, display/search remarketing campaign
- This is the cheapest path to conversions after initial setup

### Ad Strength Improvement
- Intent and Expat ads rated "Poor" -- need more unique headline variations
- Google favors ads with 10+ unique headlines and 3+ descriptions
- Higher ad strength = lower CPC and better positions

### Sitelinks
- Google recommends adding sitelinks (shown in Ads UI recommendation)
- Sitelinks improve CTR by 10-20%
- Suggested sitelinks: "Pricing", "How It Works", "FAQ", "Contact"

### Late/Penalty Ad Group
- Currently paused -- enable if you want to target delinquent filers
- Has 4 keywords + 1 ad ready to go
- High-intent audience (facing penalties) but sensitive messaging

### Budget Scaling
- Current: $33/day ($1,000/month)
- If profitable at $1,000: scale to $1,500-2,500/month
- FBAR keyword cluster has 99,700/month searches -- plenty of room to scale

---

## Key Files

| File | Purpose |
|------|---------|
| `d2c/src/lib/landing-pages.ts` | Landing page variant definitions (7 variants) |
| `d2c/src/app/(marketing)/start/[variant]/page.tsx` | Landing page template with comparison table |
| `d2c/src/components/landing/DeadlineBanner.tsx` | Countdown banner (April 15 deadline) |
| `d2c/src/app/(marketing)/layout.tsx` | Marketing layout (banner + header + footer) |
| `claudedocs/d2c-google-ads-campaign-2026-02-28.md` | This document |

---

## Seasonal Notes

- **FBAR deadline is April 15** -- search volume peaks March-April
- **Automatic extension to October 15** -- second smaller peak Sept-Oct
- **Deadline banner**: Update `FBAR_DEADLINE` in `DeadlineBanner.tsx` if extending to Oct deadline
- **After Oct 15**: Reduce budget or pause until Jan-Feb when next filing season begins
- **Keyword "fbar deadline 2026"**: Update year annually or it becomes irrelevant
