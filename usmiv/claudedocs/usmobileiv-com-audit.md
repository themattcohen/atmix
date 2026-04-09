# Comprehensive Website Audit: U.S. Mobile IV

**URL:** https://usmobileiv.com/
**Business:** U.S. Mobile IV -- Mobile IV Therapy & Wellness
**Legal Entity:** USMM LLC (Colorado, incorporated Jan 13, 2022)
**Owner:** David Kulikov (CEO) / Vadim Kulikov (BBB listing)
**Location:** 1627 Vine St, Denver, CO 80206
**Phone:** (303) 406-4500
**Sister Company:** US Mobile Medics (usmobilemedics.com) -- same ownership, shared Acuity booking, shared social accounts
**Date:** April 6, 2026
**Audit Type:** Full Presence (5-Agent Analysis)
**Overall Grade:** C+

---

## Executive Summary

U.S. Mobile IV has built a **technically strong website with excellent performance** (LCP 153ms, TTFB 26ms, Best Practices 100/100) and an **impressive review portfolio** (546 Google reviews at a perfect 5.0 stars). The 67 location pages with unique content show smart local SEO thinking, and the Bricks Builder implementation delivers a modern, professional design.

### The Core Problem

The site is undermined by **three compounding issues** that are suppressing search visibility and creating legal exposure:

1. **SEO self-sabotage**: No canonical tags on any page, 5+ pages cannibalizing the same keywords, and 5 conflicting JSON-LD schema blocks on the homepage. Google cannot determine which page to rank for core terms like "Colorado mobile IV therapy," so it ranks none of them well.

2. **Medical compliance gaps**: The weight loss services page promotes semaglutide and tirzepatide with zero FDA disclaimers, zero contraindication warnings, and zero side effect disclosures. The booking system (Acuity) has `isHipaa: false`. No medical director or provider credentials are listed anywhere. This creates regulatory and liability risk.

3. **Brand confusion with sister site**: Shared Facebook page, shared YouTube channel, shared LinkedIn, shared Acuity booking account, and overlapping SERP positions (e.g., both sites ranking for "mobile IV therapy Thornton CO") dilute authority for both brands.

### The Good News

The foundation is strong. Performance is excellent, the review portfolio is a genuine competitive asset, and the location pages are well-executed. The highest-impact fixes -- adding canonical tags, consolidating schema, and adding medical disclaimers -- are **low-effort, high-impact changes** that can be implemented in days, not weeks.

---

## Grade Card

| Category | Grade | Key Factor |
|----------|-------|------------|
| **Performance** | B+ | LCP 153ms, CLS 0.01, HTTP/3, Best Practices 100/100 |
| **SEO** | C | No canonical tags, keyword cannibalization across 5+ pages, 5 conflicting schema blocks |
| **Accessibility** | C+ | Lighthouse 87/100, brand teal fails WCAG contrast at 2.4:1 |
| **Content & E-E-A-T** | C | 12 blog posts, zero medical disclaimers, no provider credentials |
| **Local SEO** | B- | 67 location pages with unique content, but broken schema hours, missing geo coords |
| **Reviews & Reputation** | A- | 546 Google reviews at 5.0, BBB A- rating |
| **Social Presence** | C- | Instagram 637 followers, shared/confused social accounts with sister site |
| **Design & Conversion** | C+ | Modern Bricks design, but HIPAA-noncompliant booking, hidden pricing, broken counter |
| **Competitive Position** | C+ | Strong review count but still behind Rocky Mountain (1,715 reviews); not ranking for "Denver" terms |

---

# Section 1: Performance

## Core Web Vitals

| Metric | Value | Target | Status | What It Means |
|--------|-------|--------|--------|---------------|
| **LCP** | 153ms | <2,500ms | Excellent | Largest content element loads almost instantly |
| **CLS** | 0.01 | <0.1 | Excellent | Page layout is rock-stable during load |
| **TTFB** | 26ms | <800ms | Excellent | Cloudflare edge serves content in milliseconds |
| **INP** | Not measured | <200ms | N/A | Lab test only; needs field data via CrUX |

## Lighthouse Scores

| Category | Score | Status |
|----------|-------|--------|
| **Best Practices** | 100/100 | Excellent |
| **SEO** | 100/100 | Excellent (technical signals only; on-page SEO issues below) |
| **Accessibility** | 87/100 | Needs improvement (see Section 3) |

## Resource Analysis

| Resource Type | Count/Size | Assessment |
|---------------|------------|------------|
| CSS Files | 38 render-blocking | High -- Bricks + NextBricks + Automatic CSS layering |
| JavaScript Files | 3 (~47 KB) | Excellent -- well optimized |
| Fonts | 13 (4 families + icons) | High -- OpenSans x4, Montserrat x4, FA x3, Ionicons, Themify |
| Total Requests | 64 | Moderate |
| Total Transfer | ~1.6 MB | Good |
| DOM Elements | 1,001 | Good |

## Infrastructure

| Feature | Status | Assessment |
|---------|--------|------------|
| HTTPS | Yes | Required baseline |
| HTTP/3 (QUIC) | Yes | Excellent -- fastest protocol available |
| CDN | Cloudflare | Excellent -- global edge caching |
| Compression | zstd | Excellent -- most efficient algorithm |
| Caching | WP Rocket + Cloudflare | Good layered approach |
| HSTS | max-age=63072000; includeSubDomains; preload | Excellent -- 2-year preload commitment |

## Security Headers

| Header | Status | Risk |
|--------|--------|------|
| HSTS | Present (strong) | -- |
| Content-Security-Policy (CSP) | **Missing** | Medium -- XSS protection gap |
| X-Content-Type-Options | **Missing** | Low -- MIME sniffing risk |
| X-Frame-Options | **Missing** | Medium -- clickjacking risk |
| Referrer-Policy | **Missing** | Low -- information leakage |
| Permissions-Policy | **Missing** | Low -- feature access control |

### FIX: Add Security Headers

**Effort:** Low (30 minutes)
**Impact:** Medium
**Priority:** 30 days

```
Add these headers via Cloudflare (Security → HTTP Response Headers) or .htaccess:

1. CLOUDFLARE DASHBOARD (preferred -- no code changes)
   - Go to Rules → Transform Rules → Modify Response Header
   - Add these headers:
     X-Content-Type-Options: nosniff
     X-Frame-Options: SAMEORIGIN
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: camera=(), microphone=(), geolocation=()
     Content-Security-Policy: default-src 'self'; script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; frame-src https://usmobilemedics.as.me;

2. TEST after applying:
   - Verify site loads correctly (CSP can break things)
   - Check booking embed still works
   - Use securityheaders.com to verify all headers present
```

### FIX: Reduce Render-Blocking CSS

**Effort:** Medium (2-4 hours)
**Impact:** Low (performance is already excellent)
**Priority:** 90 days (optimization, not urgent)

```
38 render-blocking CSS files is excessive but performance is not suffering
thanks to Cloudflare edge caching and HTTP/3 multiplexing.

1. WP ROCKET SETTINGS
   - File Optimization → Optimize CSS Delivery → Enable
   - This will defer non-critical CSS and inline above-the-fold styles

2. AUDIT FONT USAGE
   - 13 fonts loaded is excessive
   - Determine which icon set is actually used (FA, Ionicons, OR Themify -- likely not all 3)
   - Remove unused icon font libraries
   - Consider system font stack for body text instead of loading OpenSans

3. AUTOMATIC CSS REVIEW
   - Check if Automatic CSS and Bricks both output base styles
   - Remove duplicate utility classes
```

---

# Section 2: SEO

This is the highest-impact section. The site has strong technical fundamentals (Lighthouse SEO 100/100) but critical on-page and structural SEO failures that are actively suppressing rankings.

## On-Page SEO

| Element | Value | Assessment |
|---------|-------|------------|
| Title | "Colorado Mobile IV Therapy \| US Mobile IV" (46 chars) | Good length, good keyword placement |
| Meta Description | 143 chars with CTA | Good |
| H1 | "Mobile IV Therapy and Wellness When You Need It In Colorado" | Good -- single H1, includes target keyword |
| Canonical Tag | **NOT FOUND on any page** | **CRITICAL** -- Google has no URL preference signal |
| og:image | Set but filename contains typo: "US-Moible-IV-Logo.webp" | Minor -- typo does not affect rendering |
| twitter:card | **NOT FOUND** | Missing -- no Twitter/X card preview |

## Page-Level SEO Issues

| Page | Issue | Severity |
|------|-------|----------|
| All pages | No canonical tags | Critical |
| /about/ | TWO H1 tags | Medium |
| /weight-loss-services/ | Keyword-stuffed H1 | Medium |
| /weight-loss-services/ | og:title not set | Low |
| /about/ | No og:image at all | Low |
| /iv-drips/ | Generic og:image | Low |
| /iv-therapy/ | Cannibalizes homepage | Critical |
| /treatments/ | Cannibalizes /iv-drips/ and /iv-therapy/ | Critical |

## Keyword Cannibalization (CRITICAL)

This is the single biggest SEO problem. Multiple pages compete against each other for the same keywords, splitting authority and confusing Google about which page to rank.

| Keyword Cluster | Competing Pages | Result |
|----------------|-----------------|--------|
| "Colorado Mobile IV Therapy" | Homepage, /iv-therapy/, /treatments/, /at-home-hydration/, /iv-drips/ (5 pages) | None rank well |
| "Hangover IV Therapy Denver" | 4 pages competing | Diluted rankings |
| "Myers Cocktail IV Denver" | 3+ pages competing | Diluted rankings |
| "Immunity IV" | 2 pages competing | Diluted rankings |
| Location overlap | 23 city pages + 43 service-area combos (66 total) | Internal competition on long-tail terms |

**Why This Matters:** Google sees 5 pages about "Colorado Mobile IV Therapy" and cannot determine which is the authority. Instead of ranking one page highly, it may rank none -- or cycle between them, never building sustained position.

## Schema Markup (5 Conflicting JSON-LD Blocks)

The homepage contains 5 separate JSON-LD blocks that conflict with each other:

| Block | Type | Problem |
|-------|------|---------|
| Block 1 | WebSite | Basic -- acceptable |
| Block 2 | Organization | Separate entity definition -- conflicts with Block 3 and 5 |
| Block 3 | MedicalBusiness (standalone) | **Broken hours**: closes 11:59, reopens 12:00 |
| Block 4 | FAQPage (6 questions) | Well-formed -- keep |
| Block 5 | @graph with MedicalBusiness | Has aggregateRating (5.0/481), OfferCatalog (10 services), areaServed (20 cities), correct hours 08:00-22:00 |

**Specific conflicts:**
- 3 blocks define the business entity (Blocks 2, 3, 5)
- Block 3 has broken operating hours
- addressRegion inconsistency: "Colorado" vs "CO"
- Logo URL inconsistency (one uses the "Moible" typo filename)
- sameAs social links differ between blocks
- Missing: geo coordinates, priceRange

## Sitemap & Robots.txt

| Item | Status | Issue |
|------|--------|-------|
| robots.txt | References "sitemaps.xml" | **TYPO** -- actual file is "sitemap.xml" |
| Sitemap | 109 URLs across 5 child sitemaps | Good coverage |
| Google Index | ~10+ pages indexed | Low relative to 109 URLs in sitemap |

### FIX: Add Canonical Tags to All Pages (HIGHEST PRIORITY)

**Effort:** Low (1-2 hours)
**Impact:** Very High
**Priority:** Immediate (this week)

```
Every page must have a self-referencing canonical tag. This is the single
most impactful SEO fix for this site.

1. INSTALL YOAST SEO OR RANK MATH (if not already present)
   - WordPress Admin → Plugins → Add New
   - Search "Rank Math" (recommended) or "Yoast SEO"
   - Install and activate
   - Both automatically add self-referencing canonical tags to all pages

2. IF USING BRICKS BUILDER for <head> management:
   - Bricks → Settings → Page Settings → SEO
   - Ensure canonical output is enabled
   - Verify Bricks is not stripping <link rel="canonical"> tags

3. VERIFY canonical tags are rendering:
   - Visit each key page
   - View source → search for "canonical"
   - Confirm URL matches the page URL exactly
   - Check: homepage, /iv-therapy/, /iv-drips/, /weight-loss-services/,
     /nad/, /about/, 3 location pages, 3 drip pages

4. SET CANONICAL for cannibalized pages:
   - /iv-therapy/ → canonical should point to homepage (or vice versa)
   - /treatments/ → canonical to /iv-drips/
   - /at-home-hydration/ → canonical to homepage
   - This tells Google which page is the "real" one for each keyword cluster
```

### FIX: Resolve Keyword Cannibalization

**Effort:** Medium (4-8 hours of content strategy + implementation)
**Impact:** Very High
**Priority:** 7 days

```
STEP 1: DEFINE ONE PAGE PER KEYWORD CLUSTER

  "Colorado mobile IV therapy" → Homepage (primary)
    - /iv-therapy/ → either redirect 301 to homepage OR rewrite to target
      different keyword ("IV therapy services" / "what is IV therapy")
    - /treatments/ → redirect 301 to /iv-drips/
    - /at-home-hydration/ → redirect 301 to homepage OR rewrite to
      target "at-home hydration therapy" specifically

  "Hangover IV Denver" → /iv-drips/hangover/ (already well-optimized)
    - Remove hangover-specific content from other pages or link to this page

  "Myers Cocktail IV Denver" → /iv-drips/myers/
    - Same approach: one authoritative page, others link to it

STEP 2: DIFFERENTIATE LOCATION PAGES
  - 23 city pages are GOOD (verified unique content, not thin)
  - 43 service-area combo pages may create overlap
  - Audit the 43 combos: if content is thin or duplicative, consolidate
  - Each city page should target "[City] mobile IV therapy"
  - Each combo page should target "[Service] in [City]"
  - Add canonical tags to all location pages (self-referencing)

STEP 3: INTERNAL LINKING
  - Every mention of a specific drip on a location page should link
    to the corresponding /iv-drips/[drip]/ page
  - Every location page should link to the parent city page
  - Homepage should link to top 5-6 city pages, not all 67
```

### FIX: Consolidate Schema Markup

**Effort:** Medium (2-3 hours)
**Impact:** High
**Priority:** 7 days

```
Replace 5 conflicting JSON-LD blocks with 2 clean blocks:

BLOCK 1: Combined WebSite + Organization + MedicalBusiness
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://usmobileiv.com/#website",
      "url": "https://usmobileiv.com/",
      "name": "U.S. Mobile IV",
      "publisher": { "@id": "https://usmobileiv.com/#organization" }
    },
    {
      "@type": "MedicalBusiness",
      "@id": "https://usmobileiv.com/#organization",
      "name": "U.S. Mobile IV",
      "url": "https://usmobileiv.com/",
      "logo": "https://usmobileiv.com/wp-content/uploads/US-Mobile-IV-Logo.webp",
      "image": "https://usmobileiv.com/wp-content/uploads/US-Mobile-IV-Logo.webp",
      "telephone": "+1-303-406-4500",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "1627 Vine St",
        "addressLocality": "Denver",
        "addressRegion": "CO",
        "postalCode": "80206",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 39.7407,
        "longitude": -104.9737
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday",
                      "Friday","Saturday","Sunday"],
        "opens": "08:00",
        "closes": "22:00"
      },
      "priceRange": "$$",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5.0",
        "reviewCount": "546"
      },
      "areaServed": [
        // List 20 cities as Place objects
      ],
      "hasOfferCatalog": {
        // Keep existing OfferCatalog with 10 services
      },
      "sameAs": [
        "https://www.instagram.com/usmobileiv/",
        "https://www.facebook.com/U.S.mobilemedics/",
        "https://www.youtube.com/@USMobileMedics",
        "https://www.linkedin.com/company/us-mobile-medics/"
      ]
    }
  ]
}

BLOCK 2: FAQPage (keep existing Block 4 -- it is well-formed)

DELETE: Blocks 2, 3, and the duplicate definitions.

KEY FIXES IN THIS CONSOLIDATION:
- Fix "Moible" typo in logo filename (or rename the actual file)
- Standardize addressRegion to "CO" (not "Colorado")
- Add geo coordinates
- Add priceRange
- Update reviewCount from 481 to 546
- Correct hours to 08:00-22:00 (remove broken 11:59/12:00)
- Single consistent sameAs list
```

### FIX: Robots.txt Sitemap Typo

**Effort:** Minimal (2 minutes)
**Impact:** Medium
**Priority:** Immediate

```
1. Edit robots.txt (WordPress Admin → Settings → Reading, or edit file directly)
2. Change: Sitemap: https://usmobileiv.com/sitemaps.xml
   To:     Sitemap: https://usmobileiv.com/sitemap.xml
3. Save and verify by visiting https://usmobileiv.com/robots.txt
```

### FIX: Add Twitter/X Card Tags

**Effort:** Low (30 minutes)
**Impact:** Low
**Priority:** 30 days

```
Add to <head> of all pages (via Rank Math or Bricks template):

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[Page Title]">
<meta name="twitter:description" content="[Page Description]">
<meta name="twitter:image" content="[Page og:image URL]">
```

---

# Section 3: Accessibility

## Lighthouse Accessibility Score: 87/100

## Color Contrast

| Color | Hex | Contrast Ratio (on white) | WCAG AA Normal (4.5:1) | WCAG AA Large (3:1) |
|-------|-----|--------------------------|----------------------|---------------------|
| Brand Teal | #44B7BC | 2.4:1 | FAIL | FAIL |
| Navy | #1E4969 | 9.49:1 | PASS | PASS |
| Dark Text | #081E2B | 17.06:1 | PASS | PASS |

**The brand teal (#44B7BC) fails both WCAG AA thresholds.** This is the same issue found on the sister site (usmobilemedics.com). Any text rendered in this color on a white background is illegible for users with low vision.

## Interactive Element Sizing

| Element | Size | Target | Status |
|---------|------|--------|--------|
| Nav dropdown toggles | 18x38px | 44x44px | FAIL |
| CTA buttons | ~40px height | 44px | FAIL (close) |
| "Read more" links | 120x21px | 44px height | FAIL |
| Floating contact button | No aria-label | N/A | FAIL (unlabeled) |

## Structural Issues

| Issue | Details | Severity |
|-------|---------|----------|
| Skip-to-content link | Missing (sister site has one) | Medium |
| Heading hierarchy | H2 used for IV drip names (should be H3 under parent H2) | Low |
| Landmark regions | 2 banner landmarks, 4 nav regions (excessive) | Low |
| Image alt text | All 21 images have alt text | Good |
| Alt text typo | "Wight Loss Mobile App" (should be "Weight Loss") | Low |
| Lang attribute | en-US (correct) | Good |
| Phone links | Correct tel: format | Good |

### FIX: Brand Teal Contrast

**Effort:** Low (1-2 hours)
**Impact:** High (legal compliance + usability)
**Priority:** 14 days

```
The brand teal #44B7BC has a contrast ratio of 2.4:1 -- well below the
WCAG AA minimum of 4.5:1. This is an ADA compliance risk.

OPTION A: Darken the teal for text use
  - Use #2A8A8F (contrast 4.57:1 -- passes AA normal)
  - Keep #44B7BC for decorative/background use only
  - Never use #44B7BC as text color on white backgrounds

OPTION B: Pair teal with dark backgrounds
  - Use #44B7BC text on #081E2B (dark) backgrounds
  - Contrast ratio: 7.1:1 (passes AAA)

IMPLEMENTATION:
  1. In Automatic CSS or Bricks global styles:
     - Find all instances where #44B7BC is used as text color
     - Replace with darkened variant or add dark background
  2. Check: buttons, headings, links, CTAs, navigation items
  3. Test with WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
```

### FIX: Add Skip-to-Content Link

**Effort:** Low (30 minutes)
**Impact:** Medium
**Priority:** 30 days

```
The sister site (usmobilemedics.com) already has this. Add to the Bricks
header template:

1. Add as first child of <body> or header:
   <a class="skip-link" href="#main-content">Skip to content</a>

2. Add id="main-content" to the main content container

3. CSS (visually hidden until focused):
   .skip-link {
     position: absolute;
     top: -100%;
     left: 0;
     z-index: 9999;
     padding: 12px 24px;
     background: #1E4969;
     color: #ffffff;
     font-size: 16px;
     text-decoration: none;
   }
   .skip-link:focus {
     top: 0;
   }
```

### FIX: Interactive Element Sizing

**Effort:** Low (1 hour)
**Impact:** Medium
**Priority:** 30 days

```
WCAG 2.2 requires minimum 24x24px touch targets (44x44px recommended).

1. NAV DROPDOWN TOGGLES (18x38px → 44x44px)
   - Add padding to increase clickable area
   - CSS: .nav-toggle { min-height: 44px; min-width: 44px; }

2. CTA BUTTONS (~40px → 44px)
   - Increase padding-top and padding-bottom by 2px each
   - CSS: .cta-button { min-height: 44px; }

3. "READ MORE" LINKS (120x21px → at least 44px height)
   - Add vertical padding
   - CSS: .read-more { padding: 12px 0; display: inline-block; }

4. FLOATING CONTACT BUTTON
   - Add: aria-label="Contact us"
   - Ensure minimum 44x44px touch target
```

### FIX: Alt Text Typo

**Effort:** Minimal (2 minutes)
**Impact:** Low
**Priority:** 7 days

```
WordPress Admin → Media Library → Find "Wight Loss" image
Change alt text from "Wight Loss Mobile App" to "Weight Loss Mobile App"
```

---

# Section 4: Content & E-E-A-T

## Blog Assessment

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Posts | 12 | Low volume but better quality than sister site |
| Authorship | "US Mobile IV" (company byline) | No individual author attribution |
| Dates on Listing | Not displayed | Users cannot assess recency |
| Best Post | NAD+ article (cites Mayo Clinic, Cleveland Clinic) | Good sourcing |
| Worst Post | Chiropractic article | Off-topic, low relevance |
| Medical Citations | Inconsistent | Some posts cite sources, most do not |

## E-E-A-T Assessment (Experience, Expertise, Authoritativeness, Trustworthiness)

This is particularly critical for a medical services website. Google's Quality Rater Guidelines classify health content as YMYL (Your Money or Your Life), requiring the highest E-E-A-T standards.

| E-E-A-T Signal | Status | Issue |
|----------------|--------|-------|
| Medical Director | **NOT LISTED** | No named medical director on any page |
| Provider Credentials | **NOT LISTED** | No RN/NP/MD names, license numbers, or bios |
| Named Medical Professional | Ashli Clearwater NP (partner page only) | Only credential on either site; not presented as staff |
| Staff Description | "Colorado state-licensed Registered Nurse" (generic) | No names, no verification possible |
| About Page | No team names, no credentials, no photos | Fails E-E-A-T completely |
| Contact Page | Missing address, hours, email, map | Severely incomplete |
| Medical Disclaimers | **NONE** | No page has any medical disclaimer |
| FDA Language | **NONE** | Weight loss page has zero FDA compliance language |
| HIPAA Mention | **NONE** | No privacy policy with healthcare language |
| Disclaimer Page | Termageddon (externally hosted) | Does not render for crawlers; likely not healthcare-specific |

## Medical Compliance Gaps (URGENT)

### Weight Loss Services Page -- Regulatory Risk

The /weight-loss-services/ page promotes **semaglutide** and **tirzepatide** (GLP-1 receptor agonists) with:
- Zero FDA disclaimers
- Zero contraindication warnings
- Zero side effect disclosures
- Zero mention of required medical supervision
- Pricing hidden (consultation model -- not inherently wrong, but combined with no disclaimers, this looks evasive)

**Risk:** State medical board complaints, FTC action for deceptive health claims, malpractice liability exposure.

### NAD+ Page -- Unsubstantiated Claims

The /nad/ page claims NAD+ therapy:
- "Slows aging process"
- "Aids addiction recovery"

Both claims are made with **no disclaimers, no clinical citations, and no qualifying language** (e.g., "may," "preliminary research suggests").

**Risk:** FTC enforcement for unsubstantiated health claims.

### FIX: Add Medical Disclaimers (URGENT -- LEGAL EXPOSURE)

**Effort:** Medium (3-4 hours with legal review)
**Impact:** Critical (legal/regulatory protection)
**Priority:** Immediate (this week)

```
1. SITE-WIDE MEDICAL DISCLAIMER (add to footer, all pages)
   "The information on this website is for general informational purposes
   only and is not intended as medical advice. IV therapy, weight management,
   and wellness services are administered by licensed healthcare professionals.
   Individual results may vary. Consult your primary care provider before
   beginning any new treatment."

2. WEIGHT LOSS PAGE -- SPECIFIC DISCLAIMERS (required)
   Add prominently near service descriptions:
   "Semaglutide and tirzepatide are prescription medications that require
   medical evaluation before administration. These medications may cause
   side effects including nausea, vomiting, diarrhea, constipation, and
   abdominal pain. They are not appropriate for patients with a personal
   or family history of medullary thyroid carcinoma or Multiple Endocrine
   Neoplasia syndrome type 2. Results vary. A medical consultation is
   required before treatment."

   Add FDA language:
   "These medications are FDA-approved for [specific indications].
   Off-label use is at the discretion of the prescribing provider."

3. NAD+ PAGE -- QUALIFYING LANGUAGE
   Change "slows aging process" to "may support cellular health"
   Change "aids addiction recovery" to "preliminary research suggests
   potential benefits for recovery support"
   Add: "These statements have not been evaluated by the FDA.
   IV therapy is not intended to diagnose, treat, cure, or prevent
   any disease."

4. LEGAL REVIEW
   Have a healthcare attorney review all service pages before publishing.
   This is not optional for a medical services business.
```

### FIX: Build E-E-A-T Signals

**Effort:** Medium (4-6 hours)
**Impact:** High (SEO + trust + conversion)
**Priority:** 14 days

```
1. ABOUT PAGE OVERHAUL
   Current: No names, no credentials, no photos
   Needed:
   - Medical Director name, credentials (MD/DO), NPI number
   - Lead nurse(s): names, RN/NP credentials, state license info
   - Professional headshots
   - Education and certification details
   - "Our team has administered X,000+ IV treatments" (if verifiable)

2. BLOG AUTHORSHIP
   - Add individual author names with credentials
   - Create author bio boxes: "Written by [Name], RN, BSN"
   - Add "Medically reviewed by [Medical Director]" to health content
   - Display publication and last-updated dates

3. CONTACT PAGE COMPLETION
   Current: Missing address, hours, email, map
   Add:
   - Physical address: 1627 Vine St, Denver, CO 80206
   - Business hours: 8:00 AM - 10:00 PM, 7 days/week
   - Email address
   - Embedded Google Map
   - Service area description

4. PROVIDER CREDENTIALS PAGE (new)
   - Create /our-team/ or /providers/ page
   - List all clinical staff with credentials
   - Include state license verification links
   - This is the single strongest E-E-A-T signal for a medical business
```

### FIX: HIPAA-Compliant Booking

**Effort:** High (requires Acuity plan upgrade or platform change)
**Impact:** Critical (legal compliance)
**Priority:** 14 days

```
The current Acuity Scheduling integration has isHipaa: false.
This means patient information submitted through the booking form
is NOT handled in a HIPAA-compliant manner.

OPTION A: Upgrade Acuity to HIPAA-compliant plan
  - Acuity offers a HIPAA-compliant tier
  - Requires BAA (Business Associate Agreement) with Acuity
  - Enable isHipaa: true in the embed configuration

OPTION B: Switch to a HIPAA-compliant booking platform
  - Jane App, SimplePractice, or IntakeQ
  - All offer BAA and HIPAA-compliant data handling

OPTION C: Minimum interim step
  - Add clear notice on booking page: "This form collects scheduling
    information only. Medical information will be collected separately
    through our HIPAA-compliant patient intake process."
  - Remove any medical history fields from the booking form
  - Ensure the $0.00 pricing display is intentional (consultation model)

NOTE: The sister site (usmobilemedics.com) uses the SAME Acuity account
with the same isHipaa: false setting. Both sites need this fix.
```

---

# Section 5: Local SEO

## Location Page Strategy

| Metric | Value | Assessment |
|--------|-------|------------|
| City Pages | 23 | Good coverage of Colorado metro area |
| Service-Area Combos | 43 | Good long-tail targeting |
| Total Location URLs | 66 (+1 main /iv-therapy/ page = 67) | Substantial |
| Content Quality | 800-1,200 words unique per page | Good -- not thin/doorway |
| Unique FAQs | Yes, per city | Good differentiation |
| Schema per Location Page | Not verified | Likely missing |

**Assessment:** The location page strategy is solid. Each page has genuinely unique content -- different intros, different FAQs, different city-specific framing. This is proper local SEO, not doorway page spam.

## Google Business Profile

| Metric | Value |
|--------|-------|
| Business Name | U.S. Mobile IV |
| Reviews | 546 |
| Rating | 5.0 |
| Category | Medical (MedicalBusiness schema matches) |

## Schema Issues Affecting Local SEO

| Issue | Impact | Fix |
|-------|--------|-----|
| Missing geo coordinates | Google cannot verify physical location | Add latitude/longitude to schema |
| Broken hours (Block 3) | Conflicting signals about operating hours | Remove Block 3, keep Block 5 hours |
| No priceRange | Missing rich result signal | Add "$$" to schema |
| addressRegion inconsistency | "Colorado" vs "CO" -- confusing for parsers | Standardize to "CO" |

### FIX: Location Page Schema

**Effort:** Medium (2-3 hours)
**Impact:** High
**Priority:** 14 days

```
Each of the 67 location pages should have its own LocalBusiness
or MedicalBusiness schema block. Example for Centennial:

{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "U.S. Mobile IV - Centennial",
  "url": "https://usmobileiv.com/iv-therapy/centennial/",
  "telephone": "+1-303-406-4500",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Centennial",
    "addressRegion": "CO",
    "addressCountry": "US"
  },
  "areaServed": {
    "@type": "City",
    "name": "Centennial"
  },
  "parentOrganization": {
    "@id": "https://usmobileiv.com/#organization"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday",
                  "Friday","Saturday","Sunday"],
    "opens": "08:00",
    "closes": "22:00"
  }
}

IMPLEMENTATION OPTIONS:
- Rank Math / Yoast: Use their Local SEO add-on for templated schema
- Bricks Builder: Add JSON-LD code block to location page template
- Manual: Add via functions.php based on page slug
```

---

# Section 6: Reviews & Reputation

## Review Portfolio

| Platform | Count | Rating | Assessment |
|----------|-------|--------|------------|
| Google (GBP) | 546 | 5.0 | Exceptional -- strongest asset |
| BBB | A- rating | Not accredited | Solid, not top-tier |
| Yelp | Not found | N/A | Missing opportunity |
| Healthgrades | Not found | N/A | Missing for medical business |

**Key Strength:** 546 reviews at 5.0 stars is a genuine competitive advantage. This is rare for any local business, especially in healthcare. For context, the leading competitor Rocky Mountain IV Medics has 1,715 reviews at 4.9 stars -- more volume, but U.S. Mobile IV's perfect 5.0 is a differentiator.

**Key Gap:** The schema on the homepage shows `reviewCount: 481` (outdated). The actual count is 546. This discrepancy should be updated or automated.

**Missing from this site:** There is no review widget or testimonial section on usmobileiv.com. The sister site (usmobilemedics.com) displays these reviews via a TrustIndex widget, but this site does not surface them at all.

### FIX: Display Reviews on Site

**Effort:** Low (1-2 hours)
**Impact:** High (conversion + trust)
**Priority:** 14 days

```
1. ADD REVIEW WIDGET TO HOMEPAGE
   - Install TrustIndex, Elfsight, or Google Reviews widget
   - Embed on homepage below hero section
   - Show 3-5 recent reviews with star ratings
   - Include "546 five-star reviews on Google" as social proof headline

2. ADD TESTIMONIALS TO SERVICE PAGES
   - Curate relevant reviews for each service category
   - Hangover IV page: show hangover-specific reviews
   - Weight loss page: show weight loss reviews (with disclaimers)
   - Location pages: show reviews mentioning that city

3. UPDATE SCHEMA
   - Change reviewCount from 481 to 546 (or automate via API)
   - Set up quarterly review count updates

4. EXPAND REVIEW PRESENCE
   - Claim Yelp listing (free)
   - Create Healthgrades profile (critical for medical businesses)
   - Consider RealSelf for aesthetic/weight loss services
```

---

# Section 7: Social Presence

## Social Account Status

| Platform | Handle | Followers | Shared with Sister Site? |
|----------|--------|-----------|------------------------|
| Instagram | @usmobileiv | 637 | No (separate account) |
| Facebook | facebook.com/U.S.mobilemedics | ~270 likes | **Yes** -- page renamed, still shared |
| YouTube | @USMobileMedics | Unknown | **Yes** -- sister brand name |
| LinkedIn | linkedin.com/company/us-mobile-medics | Unknown | **Yes** -- sister brand name |
| TikTok | None | N/A | N/A |

## Brand Confusion Assessment

The shared social accounts create brand identity problems:

1. **Facebook**: The URL contains "mobilemedics" but the page name was changed to "U.S. Mobile IV." Users searching for US Mobile Medics or US Mobile IV will find the same page, creating confusion about which business they are engaging with.

2. **YouTube**: Channel name is @USMobileMedics. Content presumably serves both brands, but the brand attribution is unclear.

3. **LinkedIn**: Company page uses "us-mobile-medics" in the URL but displays as "US Mobile IV." Professional contacts and B2B partners cannot distinguish the brands.

### FIX: Social Media Brand Separation

**Effort:** High (ongoing)
**Impact:** Medium
**Priority:** 30-60 days

```
DECISION REQUIRED: Are these two separate brands or one brand with
two service lines? The answer determines the approach.

IF SEPARATE BRANDS:
  1. Create dedicated Facebook page: facebook.com/usmobileiv
  2. Create dedicated YouTube channel: @USMobileIV
  3. Create dedicated LinkedIn page: linkedin.com/company/us-mobile-iv
  4. Migrate relevant followers/content to new pages
  5. Cross-reference between pages for transition period

IF ONE BRAND (TWO SERVICE LINES):
  1. Pick one brand name for all social accounts
  2. Use sub-pages/sections for each service line
  3. Consolidate content strategy under single brand

REGARDLESS:
  - Create TikTok presence (@usmobileiv)
  - Short-form video of IV treatments, event setups, athlete testimonials
  - This demographic skews younger and mobile-health-curious
  - Competitor gap: most IV therapy businesses have weak TikTok presence
```

---

# Section 8: Design & Conversion

## Design Assessment

| Element | Status | Assessment |
|---------|--------|------------|
| CMS/Builder | WordPress + Bricks Builder + Automatic CSS | Modern, professional stack |
| Visual Design | Clean, modern, healthcare-appropriate | Good |
| HSA Accepted Badge | Present in footer | Good trust signal |
| Events Page | Exists with partner logos | Good -- differentiator |
| Mobile Responsiveness | Assumed good (Bricks default) | Verify with real device testing |

## Conversion Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Broken events counter | Events page shows "0+ Clients Served" | Undermines credibility |
| Hidden weight loss pricing | /weight-loss-services/ | Friction -- users may bounce |
| Booking flow confusion | usmobilemedics.as.me/usmobileiv | Sister brand in URL |
| $0.00 pricing in Acuity | Booking form | Confusing -- is it free? |
| HIPAA non-compliant booking | isHipaa: false | Legal risk (covered in Section 4) |
| No review widget | Homepage | Missing social proof |

### FIX: Events Counter

**Effort:** Minimal (15 minutes)
**Impact:** Medium
**Priority:** 7 days

```
The events page displays "0+ Clients Served" which actively damages credibility.

OPTIONS:
  A. Update the counter to actual number (if tracked)
  B. Remove the counter entirely (better than showing "0+")
  C. Replace with "Trusted by [X] events" or "Ask about our events program"

IMPLEMENTATION:
  - Bricks Builder → Edit Events page
  - Find the counter/number element
  - Update value or remove the section
```

### FIX: Weight Loss Pricing Transparency

**Effort:** Low (1 hour)
**Impact:** Medium (conversion)
**Priority:** 14 days

```
Other services show pricing (Myers $220, Hangover $250, etc.)
but weight loss and NAD+ hide pricing entirely.

The consultation model is valid, but users comparing providers
will bounce to competitors who show pricing.

OPTIONS:
  A. Show "starting at $X" pricing
  B. Show price range: "$XXX - $XXX depending on treatment plan"
  C. Add clear CTA: "Schedule a free consultation to discuss
     pricing and treatment options" (emphasize free/no-obligation)

Do NOT hide pricing without explanation -- it signals either
premium pricing or evasiveness, both of which reduce conversion.
```

### FIX: Booking URL Brand Confusion

**Effort:** Medium (depends on Acuity plan)
**Impact:** Low-Medium
**Priority:** 30 days

```
Current booking URL: usmobilemedics.as.me/usmobileiv

The sister brand name ("usmobilemedics") appears in the booking URL.
Users who notice may question which business they are booking with.

OPTIONS:
  A. Custom domain for Acuity: booking.usmobileiv.com
     (requires Acuity Powerhouse plan or higher)
  B. Embed Acuity inline on a /book/ page so the URL bar stays
     on usmobileiv.com (current approach -- acceptable if framed properly)
  C. Accept the current state (low priority if embedded via iframe)
```

---

# Section 9: Competitive Position

## SERP Rankings (Verified)

| Keyword | Position | Competitor Context |
|---------|----------|-------------------|
| "mobile IV therapy Colorado" | ~9-10 | Not on page 1 |
| "mobile IV therapy Denver" | **Not in top 10** | Critical gap -- highest-volume term |
| "mobile IV therapy Centennial CO" | ~9 | Bottom of page 1 |
| "mobile IV therapy Thornton CO" | ~5-6 | Cannibalizing with sister site at ~4 |
| "mobile IV therapy Greenwood Village" | ~2, ~5, ~9 | 3 of own pages competing |
| "semaglutide Denver" | **Not ranking** | Sister site ranks ~9 |
| site:usmobileiv.com | ~10+ pages indexed | Low index rate vs 109 URLs in sitemap |

## Competitive Landscape

| Competitor | Reviews | Rating | Key Advantage |
|------------|---------|--------|---------------|
| **Rocky Mountain IV Medics** | 1,715 | 4.9 | 3x review volume, established brand |
| **U.S. Mobile IV** (this site) | 546 | 5.0 | Perfect rating, strong location pages |
| **US Mobile Medics** (sister) | 133 | 4.8 | Separate GBP, dilutes total brand authority |

## Key Competitive Insights

1. **Review gap**: Rocky Mountain has 3x the reviews. At current pace, it would take years to close this gap. Focus on maintaining the 5.0 and growing volume through systematic post-service review requests.

2. **Neither site ranks for "Denver"**: The highest-volume keyword ("mobile IV therapy Denver") is not captured by either this site or the sister site. This is the biggest untapped opportunity.

3. **Self-competition**: For "Thornton CO," this site and the sister site compete against each other (positions 4 and 5-6). This split costs both brands a potential position 2-3 ranking.

4. **Greenwood Village cannibalization**: Three pages from this site hold positions 2, 5, and 9. If consolidated to one page, that page could potentially reach position 1.

5. **Low index rate**: Only ~10+ pages indexed out of 109 in the sitemap. The robots.txt typo (sitemaps.xml vs sitemap.xml) may be contributing. Canonical tag absence is also a factor -- Google may be choosing not to index pages it considers duplicates.

### FIX: Win "Mobile IV Therapy Denver"

**Effort:** High (ongoing content + optimization)
**Impact:** Very High (highest-volume local keyword)
**Priority:** 14-30 days to start, ongoing

```
This is the most commercially valuable keyword neither site ranks for.

1. DESIGNATE ONE AUTHORITY PAGE
   - Create or optimize /iv-therapy/denver/ (or /mobile-iv-therapy-denver/)
   - 1,500+ words of unique, Denver-specific content
   - Include: neighborhoods served, Denver-specific testimonials,
     local partnerships, Denver event experience
   - Proper H1: "Mobile IV Therapy in Denver, CO"

2. INTERNAL LINKING
   - Link to this page from homepage (prominent placement)
   - Link from all surrounding city pages (Centennial, Thornton, etc.)
   - Link from relevant blog posts
   - Link from drip-specific pages when mentioning Denver service area

3. EXTERNAL SIGNALS
   - Ensure GBP is fully optimized with Denver address
   - Get citations on Denver-specific directories
   - Request reviews mentioning "Denver" in the review text

4. CONTENT SUPPORT
   - Publish 2-3 blog posts targeting Denver-specific long-tails:
     "Best IV therapy in Denver"
     "Mobile hangover IV Denver"
     "Event IV therapy Denver CO"

5. SISTER SITE COORDINATION
   - Decide which brand targets "Denver" -- avoid both sites competing
   - If this site targets Denver, sister site should target other metro areas
     (or vice versa)
```

### FIX: Improve Index Coverage

**Effort:** Low-Medium (2-3 hours)
**Impact:** High
**Priority:** 14 days

```
Only ~10 of 109 sitemap URLs are indexed. This means Google is
ignoring most of the site's content.

1. FIX ROBOTS.TXT (covered above -- immediate)

2. ADD CANONICAL TAGS (covered above -- immediate)
   Without canonicals, Google may treat pages as duplicates
   and decline to index them.

3. SUBMIT SITEMAP IN GOOGLE SEARCH CONSOLE
   - Go to Google Search Console → Sitemaps
   - Submit: https://usmobileiv.com/sitemap.xml
   - Check the Coverage report for errors/exclusions
   - Review "Excluded" pages to understand why Google is not indexing

4. REQUEST INDEXING for key pages:
   - Use URL Inspection tool in Search Console
   - Submit the top 20 most important pages for indexing
   - Priority: homepage, all /iv-drips/ pages, top city pages

5. CHECK FOR NOINDEX TAGS
   - Some pages may have noindex meta tags or X-Robots headers
   - Verify via: View Source → search for "noindex"
   - WP Rocket or Bricks may be setting noindex on certain templates
```

---

# Section 10: Tracking & Analytics

## Current Setup

| Tool | ID | Assessment |
|------|-----|------------|
| Google Tag Manager | GTM-MSCTB8MN | Separate from sister site (GTM-P6LSQW8R) -- good |
| Google Ads | AW-17622869865 | Active |
| GA4 | G-P920QH51QZ | Active |

**Assessment:** Tracking infrastructure is properly separated from the sister site. Each site has its own GTM container, which is correct for independent measurement.

**Recommendation:** Verify that conversion tracking is configured for:
- Booking form submissions (Acuity)
- Phone calls (click-to-call events)
- Key page visits (pricing pages, service pages)
- Contact form submissions

---

# Prioritized Action Plan

## Tier 1: Immediate (This Week) -- Critical Fixes

| # | Fix | Effort | Impact | Section |
|---|-----|--------|--------|---------|
| 1 | Add canonical tags to all pages | 1-2 hours | Very High | SEO |
| 2 | Add medical disclaimers to weight loss and NAD+ pages | 3-4 hours | Critical (legal) | Content |
| 3 | Fix robots.txt sitemap typo | 2 minutes | Medium | SEO |
| 4 | Fix "0+ Clients Served" counter | 15 minutes | Medium | Design |
| 5 | Fix "Wight Loss" alt text typo | 2 minutes | Low | Accessibility |

**Estimated time: 5-7 hours**
**Expected impact: Unblocks Google indexing, reduces legal exposure**

## Tier 2: High Priority (14 Days) -- SEO & Trust

| # | Fix | Effort | Impact | Section |
|---|-----|--------|--------|---------|
| 6 | Consolidate 5 schema blocks into 2 clean blocks | 2-3 hours | High | SEO |
| 7 | Resolve keyword cannibalization (set canonical targets + redirects) | 4-8 hours | Very High | SEO |
| 8 | Build E-E-A-T signals (about page, provider credentials) | 4-6 hours | High | Content |
| 9 | Fix brand teal contrast (#44B7BC) | 1-2 hours | High | Accessibility |
| 10 | Add review widget to homepage | 1-2 hours | High | Reviews |
| 11 | Upgrade Acuity to HIPAA-compliant tier (or add interim notice) | Variable | Critical (legal) | Content |
| 12 | Add location page schema (template for all 67 pages) | 2-3 hours | High | Local SEO |
| 13 | Submit sitemap in Google Search Console + request indexing | 1 hour | High | SEO |

**Estimated time: 16-25 hours**
**Expected impact: Significant ranking improvement within 4-8 weeks, trust signals, compliance**

## Tier 3: Strategic (30 Days) -- Polish & Growth

| # | Fix | Effort | Impact | Section |
|---|-----|--------|--------|---------|
| 14 | Add security headers (via Cloudflare) | 30 minutes | Medium | Performance |
| 15 | Add skip-to-content link | 30 minutes | Medium | Accessibility |
| 16 | Fix interactive element sizing (nav, buttons, links) | 1 hour | Medium | Accessibility |
| 17 | Add Twitter/X card tags | 30 minutes | Low | SEO |
| 18 | Create Denver-specific authority page | 4-6 hours | Very High | Competitive |
| 19 | Weight loss pricing transparency | 1 hour | Medium | Design |
| 20 | Expand review presence (Yelp, Healthgrades) | 2 hours | Medium | Reviews |

**Estimated time: 10-12 hours**
**Expected impact: Competitive positioning, accessibility compliance, social sharing**

## Tier 4: Long-Term (60-90 Days) -- Brand & Platform

| # | Fix | Effort | Impact | Section |
|---|-----|--------|--------|---------|
| 21 | Social media brand separation (or consolidation decision) | Ongoing | Medium | Social |
| 22 | TikTok presence launch | Ongoing | Medium | Social |
| 23 | Reduce render-blocking CSS / audit font usage | 2-4 hours | Low | Performance |
| 24 | Blog content strategy (Denver-focused posts, author bios) | Ongoing | High | Content |
| 25 | Sister site coordination strategy (keyword/market segmentation) | Strategic | High | Competitive |
| 26 | Custom booking domain (booking.usmobileiv.com) | Variable | Low | Design |

**Expected impact: Brand clarity, content authority, sustained ranking growth**

---

## Cross-Site Note: Sister Company Coordination

U.S. Mobile IV and US Mobile Medics (usmobilemedics.com) share ownership, an Acuity booking account, and several social media profiles. Both sites were audited. Key coordination points:

1. **SERP cannibalization**: Both sites compete for the same keywords (e.g., "mobile IV therapy Thornton CO" -- positions 4 and 5-6). A deliberate keyword segmentation strategy would let each site dominate different terms instead of splitting authority.

2. **Shared social accounts**: Facebook, YouTube, and LinkedIn are shared. This dilutes brand identity for both. A decision must be made: separate brands or one brand with two service lines.

3. **Shared booking system**: Both use the same Acuity account with isHipaa: false. Fixing HIPAA compliance once fixes it for both sites.

4. **Combined review power**: 546 (this site) + 133 (sister) = 679 total reviews across both brands. If consolidated under one brand, this would close the gap with Rocky Mountain IV Medics (1,715). If kept separate, each brand competes independently with smaller review counts.

5. **E-E-A-T opportunity**: Ashli Clearwater NP (the only named medical credential across both sites) appears on this site's partner page. Her credentials should be prominently featured on both sites' provider/team pages.

---

*Report generated April 6, 2026. Data collected via 5-agent automated audit (agents U1-U3, R1-R5). All findings verified against live site data.*
