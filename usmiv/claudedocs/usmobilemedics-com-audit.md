# Comprehensive Website Audit: US Mobile Medics

**URL:** https://usmobilemedics.com/
**Business:** US Mobile Medics -- Mobile IV Therapy, Weight Loss, Phlebotomy
**Legal Entity:** USMM LLC (Colorado, incorporated Jan 13, 2022, Good Standing)
**Owner:** David Kulikov (CEO)
**Location:** 6455 S Yosemite St, Greenwood Village, CO 80111
**Phone:** (720) 508-1998
**Sister Company:** U.S. Mobile IV (usmobileiv.com) -- same owner, shared Acuity account
**Date:** April 6, 2026
**Audit Type:** Full Presence (14 specialized agents + 6 adversarial verification agents)
**Overall Grade:** D+

---

## Executive Summary

US Mobile Medics operates a WordPress/Elementor site offering mobile IV therapy, semaglutide/tirzepatide weight loss, and mobile phlebotomy services across Colorado. The business has been operating since January 2022 and shares ownership, booking infrastructure, and Google review presence with its sister brand, U.S. Mobile IV.

### The Core Problem

This site has **compounding credibility and compliance failures** that are especially dangerous for a YMYL (Your Money or Your Life) medical services business. The booking system explicitly declares `isHipaa: false` while collecting sensitive medical history (CHF, CKD, diabetes, pregnancy status). There is no medical director, no provider credentials, no medical disclaimers, and no HIPAA mention anywhere on the site. The 93 AI-generated blog posts stopped publishing six months ago. Five separate URLs compete against each other for "semaglutide" rankings. The brand identity is fractured across two domains, two business names, and inconsistent social/directory listings -- making it nearly impossible for Google to build a coherent entity understanding.

### The Good News

The business has genuine competitive strengths to build on. The shared Google profile carries **546 reviews at a perfect 5.0 rating** -- exceptional social proof once properly attributed. **Mobile phlebotomy is a genuine differentiator** that competitors largely ignore, and the site already ranks ~4th for "mobile phlebotomy Denver." The technical fixes (video compression, font preloading, schema correction) are straightforward. And the compliance gaps, while serious, are solvable with proper medical oversight documentation and an Acuity HIPAA upgrade. Addressing the top 10 issues in this report would meaningfully improve rankings, conversions, and legal exposure within 60 days.

---

## Grade Summary

| Category | Grade | Key Factor |
|----------|-------|------------|
| **Performance** | C- | CLS 0.30 (3x threshold), 40 render-blocking CSS, 56 JS files, 75.6 MB .mov video |
| **SEO** | D+ | 5 pages cannibalizing "semaglutide," schema missing address/phone, broken heading hierarchy |
| **Accessibility** | C+ | Lighthouse 87/100, brand teal #07b6b6 fails WCAG contrast at 2.51:1 across 69 elements |
| **Content** | D | 93 AI-generated posts stale since Oct 2025, E-E-A-T grade D for a medical (YMYL) site |
| **Local SEO** | D+ | Schema hours wrong (declares 9-5, site says 8am-10pm), missing from most directories |
| **Reviews & Reputation** | B+ (shared) | 546 Google reviews at 5.0 under sister brand GBP; only ~4 Yelp under "Medics" name |
| **Social Presence** | D+ | Instagram 506 followers (dormant since Sept 2024), Facebook renamed to sister brand |
| **Design & Conversion** | D+ | HIPAA non-compliant booking, 11-24 field forms, $0.00 pricing display, typos |
| **Competitive Position** | C | Behind Rocky Mountain IV Medics (1,715 reviews) and HydraMed (5,000+), but phlebotomy is unique |

---

# Section 1: Performance

## Core Web Vitals

| Metric | Value | Threshold | Status | Explanation |
|--------|-------|-----------|--------|-------------|
| **LCP** | 378-462ms | <2500ms | PASS | Largest content paints quickly on desktop |
| **CLS** | 0.30 | <0.10 | FAIL (3x over) | Layout shifts from 9 network-loaded fonts + unsized logo |
| **Mobile CLS** | 0.00 | <0.10 | PASS | Hero section hidden on mobile masks the problem |

**What This Means:** The page loads fast in terms of raw speed, but content visibly jumps and shifts as fonts load -- a frustrating experience that Google actively penalizes in rankings. The CLS score of 0.30 is three times the acceptable threshold.

### CLS Root Cause

The layout shift is caused by two factors working together:

1. **9 network-loaded fonts** (Work Sans, Abhaya Libre x4, Open Sans, Roboto x2, Font Awesome x2, Eicons) that load after initial render, causing text to reflow
2. **Unsized logo image** that shifts content when it loads

## Resource Analysis

| Resource Type | Count | Assessment |
|---------------|-------|------------|
| CSS files | 45 (40 render-blocking) | FAIL -- extreme plugin bloat |
| JavaScript files | 56 | FAIL -- excessive |
| Fonts | 10 | High -- 5+ families is excessive |
| Video | 1 (75.6 MB .mov) | FAIL -- uncompressed QuickTime format |
| Total requests | 146 | High |

### Third-Party Script Payload

| Script | Size | Purpose |
|--------|------|---------|
| Google Tag Manager | 787 kB | Analytics |
| Facebook Pixel | 497.6 kB | Ad tracking |
| Klaviyo | 165.6 kB | Email marketing |
| **Total third-party** | **~1.55 MB** | -- |

## Lighthouse Scores

| Category | Score |
|----------|-------|
| Best Practices | 58 |
| Accessibility | 87 |
| SEO | 92 |

## Technical Stack

| Component | Value | Notes |
|-----------|-------|-------|
| Platform | WordPress + Elementor | Standard but bloated |
| HTTPS | Enabled | Secure |
| HTTP/2 | Enabled | Good |
| Compression | Brotli | Optimal |
| CSP Header | MISSING | Security gap |
| HSTS Header | MISSING | Security gap |
| Permissions-Policy | MISSING | Security gap |
| x-content-type-options | Present | Good |
| x-xss-protection | Present | Deprecated but harmless |
| Slow 3G behavior | HTML in ~4.4s, video never finishes | 75.6 MB video is unusable on slow connections |

### FIX 1.1: Eliminate CLS (Layout Shift)

**Effort:** Low-Medium (1-2 hours)
**Impact:** High -- directly improves Core Web Vitals ranking signal
**Priority:** Critical (do this week)

```
Steps to fix CLS of 0.30:

1. PRELOAD CRITICAL FONTS
   Add to <head> (via theme header or plugin like "Header Footer Code Manager"):
   <link rel="preload" href="/wp-content/themes/[theme]/fonts/work-sans.woff2"
         as="font" type="font/woff2" crossorigin>
   
   Do this for Work Sans and Abhaya Libre (the body/heading fonts).
   Non-critical fonts (Font Awesome, Eicons) can load normally.

2. ADD font-display: swap TO ALL @font-face RULES
   In your theme CSS or Elementor custom CSS:
   @font-face {
     font-family: 'Work Sans';
     font-display: swap;
     /* existing src rules */
   }

3. SET EXPLICIT DIMENSIONS ON LOGO IMAGE
   In Elementor, edit the logo widget:
   - Set width AND height attributes (e.g., width="200" height="60")
   - Or use CSS: .site-logo img { width: 200px; height: 60px; aspect-ratio: 200/60; }

4. REDUCE FONT COUNT
   Current: Work Sans, Abhaya Libre (x4 weights), Open Sans, Roboto (x2)
   Recommendation: Pick ONE sans-serif (Work Sans) and ONE serif (Abhaya Libre)
   Remove Open Sans and Roboto -- they serve no distinct purpose

5. VERIFY
   Run Lighthouse after changes. Target CLS < 0.10.
```

### FIX 1.2: Replace 75.6 MB Video

**Effort:** Low (30-60 minutes)
**Impact:** High -- page weight, mobile experience, bandwidth costs
**Priority:** Critical (do this week)

```
The Problem:
- Website-promotional-video.mov is 75.6 MB in QuickTime format
- .mov is not a web-optimized format
- On slow 3G, this video will NEVER finish loading
- It likely costs significant bandwidth on hosting

Steps to fix:

1. CONVERT TO MP4/WEBM
   Use Handbrake (free) or FFmpeg:
   ffmpeg -i Website-promotional-video.mov -c:v libx264 -crf 23 -preset medium \
          -c:a aac -b:a 128k -movflags +faststart output.mp4
   
   Target: Under 5 MB for a background/hero video (90%+ reduction)

2. ADD WEBM VERSION FOR BETTER COMPRESSION
   ffmpeg -i Website-promotional-video.mov -c:v libvpx-vp9 -crf 30 -b:v 0 output.webm

3. IMPLEMENT WITH PROPER HTML
   <video autoplay muted loop playsinline preload="none" poster="hero-poster.jpg">
     <source src="output.webm" type="video/webm">
     <source src="output.mp4" type="video/mp4">
   </video>
   
   Key: preload="none" + poster image prevents loading until user scrolls to it

4. CONSIDER REMOVING VIDEO ENTIRELY
   If the video is decorative, a static image with CSS animation
   may be more effective and load instantly.
```

### FIX 1.3: Reduce Render-Blocking Resources

**Effort:** Medium (2-4 hours)
**Impact:** Medium
**Priority:** High (30 days)

```
40 render-blocking CSS files is extreme. Steps:

1. AUDIT PLUGINS
   WordPress Admin -> Plugins
   - Deactivate plugins one at a time, test site
   - Remove unused/redundant plugins
   - Target: Reduce to 15-20 essential plugins

2. INSTALL OPTIMIZATION PLUGIN
   Install WP Rocket ($59/yr) or Autoptimize (free):
   - Enable CSS minification and combination
   - Enable JS defer/delay
   - Enable lazy loading for images and video
   - Target: 40 CSS -> 5-8 combined files

3. DEFER THIRD-PARTY SCRIPTS
   Move GTM, FB Pixel, and Klaviyo to load AFTER main content:
   - WP Rocket: File Optimization -> Delay JavaScript execution
   - Add these to delay list: gtm.js, fbevents.js, klaviyo.js

4. ADD SECURITY HEADERS
   In .htaccess or via security plugin (e.g., Headers Security Advanced):
   Content-Security-Policy: default-src 'self' ...
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

# Section 2: SEO Analysis

## On-Page SEO

| Element | Current Value | Assessment |
|---------|---------------|------------|
| **Title** | "Mobile IV Therapy Colorado -- Premier On-the-Go Wellness!" (56 chars) | Acceptable length, but "Premier On-the-Go Wellness" is vague |
| **Meta Description** | 150 chars, includes services and geo | Adequate |
| **H1** | "Colorado's Premier Mobile IV Company" | Single H1 -- good |
| **og:image** | MISSING | FAIL -- no image preview when shared on social |
| **twitter:image** | MISSING | FAIL -- same problem for X/Twitter |
| **Canonical** | Self-referencing | Correct |

### Heading Hierarchy (Broken)

```
Current structure (WRONG):
H5 -> appears BEFORE H1
H1 -> "Colorado's Premier Mobile IV Company"
H6 -> jumps from H1 to H6 (skips H2-H5)
H5 -> footer navigation
H2 -> "Hours of Operation" (in footer)

Correct structure should be:
H1 -> Main heading
  H2 -> Section headings
    H3 -> Subsection headings
```

**Why This Matters:** Search engines use heading hierarchy to understand page structure and topic relationships. Skipping from H1 to H6 signals broken document structure. Footer content in H2/H5 tags inflates its perceived importance.

## Schema Markup (Critical Failures)

| Schema Element | Status | Impact |
|----------------|--------|--------|
| Type: LocalBusiness | Present but WRONG type | Should be MedicalBusiness |
| name, url, logo | Present | -- |
| **address** | MISSING | Google cannot geo-locate the business |
| **telephone** | MISSING | Google cannot show click-to-call |
| **geo coordinates** | MISSING | Google Maps integration broken |
| **priceRange** | MISSING | -- |
| **areaServed** | MISSING | Google cannot determine service area |
| openingHours | WRONG | Declares 9:00-17:00 M-Su; site says 8am-10pm |
| Logo URL | HTTP (not HTTPS) | Mixed content / trust signal issue |
| Homepage schema | Article (WRONG) | Should be WebPage |

### FIX 2.1: Fix Schema Markup

**Effort:** Medium (1-2 hours)
**Impact:** Critical -- this is the #1 SEO fix
**Priority:** Critical (do this week)

```json
Replace existing schema with this corrected version.
Install via Yoast SEO -> Schema tab, or add to header via code plugin:

{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "US Mobile Medics",
  "url": "https://usmobilemedics.com",
  "logo": "https://usmobilemedics.com/wp-content/uploads/[logo-path].png",
  "image": "https://usmobilemedics.com/wp-content/uploads/[hero-image].jpg",
  "telephone": "+17205081998",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "6455 S Yosemite St",
    "addressLocality": "Greenwood Village",
    "addressRegion": "CO",
    "postalCode": "80111",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.6003,
    "longitude": -104.8938
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
      ],
      "opens": "08:00",
      "closes": "22:00"
    }
  ],
  "areaServed": {
    "@type": "State",
    "name": "Colorado"
  },
  "priceRange": "$$",
  "sameAs": [
    "https://www.instagram.com/usmobilemedics/",
    "https://www.facebook.com/U.S.mobilemedics/",
    "https://www.linkedin.com/company/us-mobile-medics/",
    "https://www.yelp.com/biz/u-s-mobile-medics-greenwood-village"
  ]
}

ALSO:
- Change homepage schema from "Article" to "WebPage"
- Update logo URL from http:// to https://
```

### FIX 2.2: Add og:image and twitter:image

**Effort:** Very Low (10 minutes)
**Impact:** Medium -- controls how the site appears when shared
**Priority:** High (do this week)

```
In Yoast SEO -> Social -> Facebook tab:
- Upload a branded image (1200x630px recommended)
- This becomes the og:image for all pages without a specific image

In Yoast SEO -> Social -> Twitter tab:
- Enable Twitter card meta
- Set default card image

Or add manually to <head>:
<meta property="og:image"
      content="https://usmobilemedics.com/wp-content/uploads/og-image.jpg">
<meta name="twitter:image"
      content="https://usmobilemedics.com/wp-content/uploads/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
```

### FIX 2.3: Fix Heading Hierarchy

**Effort:** Low (30-60 minutes in Elementor)
**Impact:** Medium
**Priority:** High (30 days)

```
In Elementor page editor:

1. Find the H5 element that appears before the H1 -- change to <p> or <span>
2. Find all H6 elements used for body content -- change to H2 or H3
3. Footer: Change "Hours of Operation" from H2 to <p> with bold styling
4. Footer: Change navigation items from H5 to <nav> with <ul>/<li>

Rule: H1 -> H2 -> H3 -> H4 (never skip levels, never use headings for styling)
```

## Keyword Cannibalization (Critical)

Five separate URLs compete against each other for "semaglutide" rankings. All return 200 status codes with self-referencing canonicals, meaning Google must choose which one to rank -- and may rank none well.

| URL | Type | Status |
|-----|------|--------|
| /semaglutide-for-weight-loss/ | Service page | 200, self-canonical |
| /semaglutide/ | Service page | 200, self-canonical |
| /semaglutide-weight-loss/ | Service page | 200, self-canonical |
| /semaglutide-weight-loss-services/ | Blog post | 200, self-canonical |
| /semaglutide-weight-loss-program/ | Blog post | 200, self-canonical |

Additionally, two separate blog indexes exist: `/blog/` and `/news-blogs/` (both self-canonicalized).

### FIX 2.4: Consolidate Semaglutide Pages

**Effort:** Medium (1-2 hours)
**Impact:** High -- directly improves semaglutide ranking potential
**Priority:** Critical (do this week)

```
1. PICK ONE CANONICAL SEMAGLUTIDE PAGE
   Recommended: /semaglutide-for-weight-loss/ (most descriptive URL)

2. REDIRECT THE OTHERS (301 permanent redirects)
   In WordPress, install "Redirection" plugin or add to .htaccess:
   
   /semaglutide/                      -> 301 -> /semaglutide-for-weight-loss/
   /semaglutide-weight-loss/          -> 301 -> /semaglutide-for-weight-loss/
   /semaglutide-weight-loss-services/ -> 301 -> /semaglutide-for-weight-loss/
   /semaglutide-weight-loss-program/  -> 301 -> /semaglutide-for-weight-loss/

3. CONSOLIDATE CONTENT
   Merge the best content from all 5 pages into the canonical page.
   Ensure it covers: what semaglutide is, how it works, pricing, FAQ, CTA.

4. FIX BLOG INDEXES
   Pick /blog/ as canonical, redirect /news-blogs/ -> /blog/

5. UPDATE INTERNAL LINKS
   Search the site for links pointing to redirected URLs.
   Update them to point directly to the canonical URL.

6. UPDATE SITEMAP
   Remove redirected URLs from sitemap.
   Ensure canonical URL is present.
```

### FIX 2.5: Fix Service Page Meta

**Effort:** Very Low (15 minutes)
**Impact:** Medium
**Priority:** High (30 days)

```
These service pages have critically thin metadata:

/iv-injections/:
  Current title: 32 chars (too short)
  Fix: "Mobile IV Therapy in Colorado | Hydration, Vitamins & NAD+ |
       US Mobile Medics" (~78 chars)

/weight-loss-services/:
  Current title: 40 chars
  Current meta desc: "Expert Guidance Anywhere You Are" (32 chars -- critically thin)
  Fix title: "Medical Weight Loss in Colorado | Semaglutide & Tirzepatide |
             US Mobile Medics" (~78 chars)
  Fix meta desc: "Medically supervised semaglutide and tirzepatide weight loss
  in Colorado. Mobile consultations, ongoing support, and FDA-approved
  GLP-1 medications. Call (720) 508-1998." (~168 chars)

/semaglutide-for-weight-loss/:
  Current title: 50 chars
  Current meta desc: 132 chars (adequate but could be stronger)
```

## Sitemap Issues

| Issue | Detail |
|-------|--------|
| Total URLs | 207 across 5 sitemaps |
| Blog posts | 93 URLs (last modified Oct 19, 2025) |
| Pages | 88 URLs (last modified Dec 4, 2025) |
| Service areas | 3 URLs (stale since Oct 2024 -- 18 months old) |
| Location pages | 60+ pages in wrong sitemap (in page-sitemap instead of dedicated location sitemap) |
| Image sitemap | MISSING |

### FIX 2.6: Clean Up Sitemaps

**Effort:** Low (30 minutes)
**Impact:** Low-Medium
**Priority:** Strategic (60 days)

```
1. Remove redirected semaglutide pages from sitemap
2. Move 60+ location pages to a dedicated location-sitemap.xml
3. Update service-area-sitemap URLs or remove if stale
4. Add image sitemap via Yoast SEO -> Features -> XML Sitemaps
5. Submit updated sitemap to Google Search Console
```

---

# Section 3: Accessibility

## Accessibility Scorecard

| Check | Result | Status |
|-------|--------|--------|
| Lighthouse Accessibility Score | 87/100 | Adequate but not compliant |
| Images without alt text | 0 of 13 | PASS |
| Decorative images properly marked | 4 of 4 | PASS |
| Skip-to-content link | Present | PASS |
| Language attribute | en-US | PASS |
| Brand color contrast | 2.51:1 (needs 4.5:1) | FAIL |
| Links without accessible names | 2 | FAIL |
| ARIA list violation | role="list" with div children | FAIL |
| Label-content name mismatch | 3 "Read More" links | FAIL |
| Banner landmarks | 2 (should be 1) | FAIL |
| Footer phone link | Invalid href format | FAIL |
| Logo alt text | "logo" (non-descriptive) | FAIL |
| Button touch targets | 42-50px height | PASS |

## Color Contrast (Site-Wide Failure)

The brand teal color `#07b6b6` (rgb 7, 182, 182) is used extensively across the site and **fails WCAG AA contrast requirements** against white backgrounds.

| Metric | Value | Requirement | Status |
|--------|-------|-------------|--------|
| Contrast ratio | 2.51:1 | 4.5:1 (normal text) | FAIL |
| Elements with teal background | 25 | -- | -- |
| Elements with teal text | 44 | -- | -- |
| **Total affected elements** | **69** | -- | FAIL |

**What This Means:** Visitors with low vision, color blindness, or who are using screens in bright sunlight may not be able to read teal text or text on teal backgrounds. This affects buttons, links, headings, and accent text across the entire site.

### FIX 3.1: Update Brand Teal for Accessibility

**Effort:** Low (30-60 minutes)
**Impact:** High -- ADA compliance, readability for all users
**Priority:** Critical (do this week)

```
Current:  #07b6b6 (contrast 2.51:1 -- FAILS)
Fix:      #047c7c (contrast 5.02:1 -- PASSES AA)

The recommended color is a slightly darker teal that maintains brand 
identity while meeting accessibility standards.

Steps:
1. In Elementor -> Site Settings -> Global Colors:
   - Change the primary teal from #07b6b6 to #047c7c
   
2. Search theme CSS for #07b6b6 and replace with #047c7c:
   - Check Customizer -> Additional CSS
   - Check child theme style.css
   - Check any custom CSS in Elementor widgets

3. VERIFY: Use WebAIM Contrast Checker (webaim.org/resources/contrastchecker)
   Enter #047c7c as foreground, #FFFFFF as background
   Confirm ratio >= 4.5:1
```

### FIX 3.2: Fix Remaining Accessibility Issues

**Effort:** Low (30 minutes)
**Impact:** Medium
**Priority:** High (30 days)

```
1. FIX PHONE LINK IN FOOTER
   Current: href="http://tel+17205081998" (INVALID -- uses http:// prefix)
   Fix:     href="tel:+17205081998"

2. FIX LOGO ALT TEXT
   Current: alt="logo"
   Fix:     alt="US Mobile Medics logo"

3. ADD ACCESSIBLE NAMES TO ICON LINKS
   The IV Therapy and Mobile Lab icon links have no text.
   Add aria-label="IV Therapy Services" and aria-label="Mobile Lab Draws"

4. FIX ARIA LIST
   Current: <div role="list"><div>...</div></div>
   Fix:     <div role="list"><div role="listitem">...</div></div>
   Or use semantic HTML: <ul><li>...</li></ul>

5. FIX "READ MORE" LINKS
   Current: <a aria-label="Read more about Semaglutide">Read More</a>
   The visible text "Read More" doesn't match the aria-label.
   Fix: <a aria-label="Read More about Semaglutide">Read More</a>
   Or better: <a>Read More about Semaglutide</a> (visible descriptive text)

6. REMOVE DUPLICATE BANNER LANDMARK
   Find the second <header> or role="banner" element and change to <div>
```

---

# Section 4: Content & E-E-A-T

## Content Inventory

| Content Type | Count | Last Updated | Assessment |
|-------------|-------|-------------|------------|
| Blog posts | 93 | Oct 19, 2025 | 6 months stale |
| Service pages | 10 | Dec 4, 2025 | Thin metadata |
| Location pages | 60+ | Various | Programmatic |
| Service area pages | 3 | Oct 2024 | 18 months stale |

### Blog Analysis

- **Date range:** June 2024 -- October 2025
- **Posting pattern:** Burst production, not consistent. July 2024 peak (30 posts), Nov-Dec 2024 (20 posts), then silence.
- **Content quality:** AI-generated with programmatic hub-and-spoke pattern
- **Authors:** "Antilles," "David," "Brent" -- no credentials, no bios, no author pages
- **Best service page:** /mobile-lab-draws/ (has 6 FAQ questions -- should be the model for all service pages)
- **Semaglutide page note:** Mentions "FDA-Approved" and "medically supervised" but has NO formal disclaimers, no contraindications, and no side effects listed

## E-E-A-T Assessment: Grade D

This is a **YMYL (Your Money or Your Life)** site offering medical services including prescription medications (semaglutide, tirzepatide), IV therapy, and blood draws. Google holds YMYL sites to the highest E-E-A-T standards.

| E-E-A-T Signal | Status | Detail |
|----------------|--------|--------|
| Medical director identified | NO | No supervising physician named anywhere |
| Provider names/credentials | NO | /about-our-team/ has no individuals listed |
| Provider bios with licenses | NO | /medical-providers/ is a generic mission statement |
| Medical disclaimers | NO | No FDA disclaimers, contraindications, or side effects |
| HIPAA compliance statement | NO | Not mentioned anywhere, including privacy policy |
| "Licensed and insured" statement | NO | -- |
| Trust badges/certifications | NO | -- |
| Testimonials quality | WEAK | First-name-only, single-sentence quotes |

**Why This Matters:** Google's Search Quality Evaluator Guidelines specifically flag medical sites without clear practitioner credentials as "low quality." The semaglutide page mentions "FDA-Approved" and "medically supervised" but provides zero evidence of who supervises, their credentials, or any formal medical disclaimers. This is both an SEO risk and a potential regulatory/liability issue.

The adversarial verification agent's assessment: *"D is defensible and arguably generous."*

### FIX 4.1: Establish Medical Credibility (E-E-A-T)

**Effort:** Medium (requires business owner input, 2-4 hours to implement)
**Impact:** Critical -- directly affects Google's trust assessment and legal exposure
**Priority:** Critical (do within 2 weeks)

```
1. IDENTIFY AND FEATURE MEDICAL DIRECTOR
   Create a dedicated section on /about-our-team/ or /medical-providers/:
   - Full name and credentials (MD, DO, NP, PA)
   - License number and state
   - Board certifications
   - Professional headshot
   - Brief bio with relevant experience

2. ADD PROVIDER PROFILES
   For each practitioner who administers treatments:
   - Name, credentials, license number
   - Specialties and experience
   - Professional photo

3. ADD MEDICAL DISCLAIMERS TO EVERY SERVICE PAGE
   Required on /semaglutide-for-weight-loss/ and all treatment pages:
   
   "These services are provided under medical supervision by [Name, MD/DO]. 
   Semaglutide is an FDA-approved medication for [approved indications]. 
   Results vary. Not suitable for patients with personal or family history 
   of medullary thyroid carcinoma or MEN 2 syndrome. Side effects may 
   include nausea, vomiting, diarrhea, constipation, and abdominal pain. 
   Consult with our medical team to determine if this treatment is 
   appropriate for you."

4. ADD HIPAA COMPLIANCE STATEMENT
   Create or update Privacy Policy to include:
   - Notice of Privacy Practices
   - How PHI is collected, used, and protected
   - Patient rights under HIPAA
   - Contact information for privacy officer

5. ADD TRUST SIGNALS
   - "Licensed and insured" statement in footer
   - State medical board registration
   - Any relevant certifications (BLS, ACLS, etc.)
   - LegitScript certification (competitor HydraMed has this)
```

### FIX 4.2: Revive and Improve Blog

**Effort:** Medium-High (ongoing)
**Impact:** Medium
**Priority:** Strategic (60 days to start, then ongoing)

```
1. IMMEDIATE: Remove or noindex the weakest AI-generated posts
   - Identify thin/duplicate content with Screaming Frog or manual review
   - Posts under 500 words with no unique value -> noindex or redirect to parent topic

2. REWRITE KEY POSTS WITH MEDICAL AUTHORITY
   - Add medical reviewer byline: "Medically reviewed by [Name, MD]"
   - Include citations to medical literature
   - Add structured FAQ schema to informational posts

3. ESTABLISH CONSISTENT PUBLISHING CADENCE
   - 2-4 quality posts per month (not 30 in one burst)
   - Focus on topics where you can demonstrate expertise:
     * Mobile phlebotomy guides (your differentiator)
     * IV therapy education with medical backing
     * Weight loss medication comparisons (with proper disclaimers)

4. FIX AUTHOR PAGES
   - Create proper WordPress author profiles with credentials
   - Remove or rename "Antilles" as author (signals AI-generated content)
```

---

# Section 5: Local SEO

## Google Business Profile

The business does **not have its own Google Business Profile**. All 546 Google reviews are under the sister brand "U.S. Mobile IV" GBP. The TrustIndex widget on usmobilemedics.com displays those sister-brand reviews (showing "Based on 371 reviews" -- a cached count; the actual live count is 546).

**This creates a fundamental local SEO problem:** When someone searches for "US Mobile Medics," Google has no verified business entity to surface. The reviews, while genuine and excellent, are attributed to a different brand.

## Schema vs. Reality

| Data Point | Schema Says | Site Says | Correct Value |
|------------|-------------|-----------|---------------|
| Hours | Mon-Sun 09:00-17:00 | 8am-10pm daily | 8am-10pm daily |
| Address | MISSING | 6455 S Yosemite St | 6455 S Yosemite St |
| Phone | MISSING | (720) 508-1998 | (720) 508-1998 |
| Business type | LocalBusiness | Medical services | MedicalBusiness |

## Directory Presence

| Directory | Listed | Issues |
|-----------|--------|--------|
| Google (own GBP) | NO | Reviews under sister brand only |
| Yelp | YES | ~4 reviews, 5.0 |
| Facebook | YES | Page renamed to "U.S. Mobile IV" |
| LinkedIn | YES | Shows "US Mobile IV" |
| Yahoo Local | YES | -- |
| Nextdoor | YES (x2) | Two conflicting listings |
| Localtunity | YES | -- |
| Care.com | YES | Wrong category and wrong city |
| Apple Maps | NO | Missing |
| Bing Places | NO | Missing |
| Yellow Pages | NO | Missing |
| Manta | NO | Missing |
| Foursquare | NO | Missing |
| MapQuest | NO | Missing |
| Healthgrades | NO | Missing -- critical for medical business |
| Vitals | NO | Missing |
| WebMD | NO | Missing |
| ZocDoc | NO | Missing |
| BBB | NO | Exists under sister brand only |

### FIX 5.1: Create Dedicated Google Business Profile

**Effort:** Low (1 hour)
**Impact:** Critical -- foundational to all local SEO
**Priority:** Critical (do this week)

```
1. Go to business.google.com
2. Create a new listing for "US Mobile Medics"
   - Category: Mobile Health Care Services (primary), IV Hydration Therapy
   - Address: 6455 S Yosemite St, Greenwood Village, CO 80111
   - Phone: (720) 508-1998
   - Hours: 8:00 AM - 10:00 PM daily
   - Service area: Colorado (or list specific cities)
   - Website: https://usmobilemedics.com

3. Complete the verification process (postcard or phone)

4. Add photos, services, and business description

5. IMPORTANT: Link the sister GBP (U.S. Mobile IV) and this new 
   profile if Google allows -- or at minimum, ensure both profiles
   are consistent and don't conflict

6. Start requesting reviews specifically for the "US Mobile Medics" 
   profile to build its own review base
```

### FIX 5.2: Fix Directory Listings

**Effort:** Medium (2-3 hours)
**Impact:** Medium
**Priority:** High (30 days)

```
1. FIX EXISTING LISTINGS
   - Nextdoor: Remove duplicate, keep one with correct info
   - Care.com: Update category and city
   - Facebook: Decide if this page represents Medics or IV -- don't straddle
   - LinkedIn: Same decision

2. CREATE NEW LISTINGS (priority order for a medical business)
   - Apple Maps (Apple Business Connect -- free)
   - Bing Places (free)
   - Healthgrades (critical for medical business)
   - ZocDoc (if accepting patients through platform)
   - BBB (separate from sister brand)
   - Yellow Pages, Manta, Foursquare, MapQuest

3. ENSURE NAP CONSISTENCY
   Every listing must show:
   Name: US Mobile Medics
   Address: 6455 S Yosemite St, Greenwood Village, CO 80111
   Phone: (720) 508-1998
```

### FIX 5.3: Address Sister Brand Confusion

**Effort:** Medium (strategic decision required)
**Impact:** High -- brand clarity affects everything
**Priority:** Critical (strategic decision within 2 weeks)

```
The core brand problem:
- usmobilemedics.com = "US Mobile Medics"
- usmobileiv.com = "U.S. Mobile IV"
- Same owner, same Acuity account, shared GBP reviews
- Facebook renamed to "U.S. Mobile IV"
- LinkedIn shows "US Mobile IV"
- SERP cannibalization verified on multiple queries:
  * "mobile IV therapy Thornton CO" -- this site ~4, sister site ~5-6
  * "mobile IV therapy Greenwood Village" -- this site ~4, sister site at ~2, 5, 9

Every query where both sites appear splits click-through rate and signals 
to Google that neither is the authoritative result.

This MUST be resolved strategically. Options:

OPTION A: MERGE INTO ONE BRAND
- Pick one domain as primary (recommended: usmobilemedics.com for broader scope)
- 301 redirect the other domain entirely
- Consolidate all listings, reviews, social under one name
- Strongest approach for SEO and brand clarity

OPTION B: DIFFERENTIATE CLEARLY
- US Mobile Medics = phlebotomy + medical services
- U.S. Mobile IV = IV therapy + wellness
- Different target keywords, different service pages, no overlap
- Add clear cross-links between sites
- Requires careful canonical/redirect strategy to stop cannibalization

OPTION C: MAINTAIN BOTH (current approach -- NOT recommended)
- Continues splitting SEO authority across two domains
- Confuses Google's entity understanding
- Wastes link equity
- Makes review strategy inefficient
- Social accounts already drifting toward sister brand name
```

---

# Section 6: Reviews & Reputation

## Review Profile

| Platform | Reviews | Rating | Brand |
|----------|---------|--------|-------|
| Google | 546 | 5.0 | U.S. Mobile IV (sister brand GBP) |
| Yelp | ~4 | 5.0 | U.S. Mobile Medics |
| TrustIndex widget | Displays sister reviews | 5.0 | Shows on this site |

**The 546 reviews at 5.0 are genuinely impressive** -- this is a strong competitive asset. However, they are entirely attributed to the sister brand. This site has essentially zero first-party review presence on Google.

### FIX 6.1: Build First-Party Review Presence

**Effort:** Low (ongoing process)
**Impact:** High
**Priority:** High (start immediately after Fix 5.1)

```
1. Once own GBP is created (Fix 5.1), implement a review request flow:
   - Send post-service SMS/email with direct Google review link
   - Use Google's review link generator: 
     search.google.com/local/writereview?placeid=[YOUR_PLACE_ID]

2. Request reviews on Yelp (carefully -- Yelp filters aggressive solicitation)

3. Consider Healthgrades reviews once that listing is created

4. On the website, supplement TrustIndex widget with a note:
   "See reviews from our family of brands" or clearly label as 
   "U.S. Mobile IV reviews" to maintain transparency

5. TARGET: 50 reviews on own GBP within 6 months
```

---

# Section 7: Social Media Presence

## Social Inventory

| Platform | Handle | Followers | Last Active | Issues |
|----------|--------|-----------|-------------|--------|
| Instagram | @usmobilemedics | 506 | Sept 2024 | 7+ months dormant |
| Facebook | U.S.mobilemedics | ~270 likes | Unknown | Renamed to "U.S. Mobile IV" |
| LinkedIn | us-mobile-medics | 71 | Unknown | Shows "US Mobile IV" |
| X/Twitter | @medics_us | Unknown | Likely dormant | -- |
| YouTube | @USMobileMedics | Shared | Shared with sister site | -- |
| TikTok | None | -- | -- | Missing entirely |

**Key Issue:** Social media accounts are either dormant, renamed to the sister brand, or both. There is no active social presence specifically for "US Mobile Medics." Instagram -- the most important platform for a visual, wellness-oriented service -- has been inactive for over 7 months.

### FIX 7.1: Reactivate Social Presence

**Effort:** Medium (ongoing, 2-3 hours/week)
**Impact:** Medium
**Priority:** Strategic (60 days)

```
1. DECIDE BRAND STRATEGY FIRST (see Fix 5.3)
   Social strategy depends on whether brands merge or differentiate.

2. IF KEEPING BOTH BRANDS:
   - Reactivate @usmobilemedics Instagram with 2-3 posts/week
   - Create separate Facebook page (current one is renamed to sister brand)
   - Focus content on: before/after weight loss (with patient consent), 
     phlebotomy education, IV therapy benefits, team photos, 
     patient testimonials (video)

3. QUICK WIN: Add og:image to site (Fix 2.2) so any shared link
   looks professional instead of showing a blank preview
```

---

# Section 8: Design, UX & Conversion

## Booking System (Acuity Scheduling)

The booking system at usmobilemedics.as.me/requestservice has multiple issues that directly affect conversions and compliance.

### HIPAA Compliance Failure

The Acuity configuration explicitly declares `isHipaa: false` while the booking forms collect protected health information (PHI) including:

**IV Therapy form (16 custom fields):** Congestive heart failure, chronic kidney disease, blood clotting disorders, COVID status

**Semaglutide form (20 custom fields):** All of the above PLUS diabetes, thyroid carcinoma, pancreatitis, gastroparesis, retinopathy, pregnancy status

**Lab/Phlebotomy form (7 custom fields):** Medical history

This is a **compliance risk**. Collecting medical history through a non-HIPAA-compliant form means this data is not encrypted to HIPAA standards and Acuity assumes no BAA (Business Associate Agreement) responsibility for it.

### Form UX Issues

| Issue | Detail | Impact |
|-------|--------|--------|
| Field count | 11-24 fields depending on service | High abandonment risk |
| Pricing display | All services show $0.00 | Confuses visitors, looks broken or deceptive |
| Business name in config | Shows "U.S. Mobile IV" (hidden via showBusinessName: false) | Brand inconsistency |
| Disclaimer typo | "experienceing" (sic) | Undermines professionalism |

### FIX 8.1: Upgrade Acuity to HIPAA Compliance

**Effort:** Low (account upgrade + configuration)
**Impact:** Critical -- legal/regulatory exposure
**Priority:** Critical (do immediately)

```
1. UPGRADE ACUITY PLAN
   Acuity offers HIPAA-compliant plans ("Powerhouse" plan or higher).
   This upgrade:
   - Enables encrypted form submissions
   - Provides BAA (Business Associate Agreement)
   - Ensures PHI is handled per HIPAA requirements

2. VERIFY isHipaa FLAG
   After upgrade, confirm the page source shows isHipaa: true

3. ADD HIPAA NOTICE TO BOOKING PAGE
   Include a brief notice: "Your health information is protected 
   in accordance with HIPAA regulations."

4. UPDATE BUSINESS NAME IN ACUITY CONFIG
   Change from "U.S. Mobile IV" to "US Mobile Medics" 
   (or to the consolidated brand name if merging)
```

### FIX 8.2: Improve Form Conversion

**Effort:** Medium (2-3 hours)
**Impact:** High -- directly affects booking completion rate
**Priority:** High (30 days)

```
1. REDUCE FORM FIELDS
   - Move medical history questions to a post-booking intake form
   - Initial booking needs only: Name, Email, Phone, Service, Date/Time
   - Send medical questionnaire via secure (HIPAA-compliant) email 
     after booking confirmation
   - Target: 5-7 fields for initial booking (from current 11-24)

2. FIX PRICING DISPLAY
   - Either show actual prices or remove the price field entirely
   - "$0.00" looks like a broken website, not "free consultation"
   - If pricing varies, show "Starting at $X" or 
     "Pricing discussed at consultation"

3. FIX TYPO
   - Change "experienceing" to "experiencing" in the disclaimer text
```

### FIX 8.3: Fix Broken Phone Link

**Effort:** Very Low (5 minutes)
**Impact:** Medium -- broken click-to-call on mobile devices
**Priority:** Critical (do today)

```
Current (BROKEN):
<a href="http://tel+17205081998">

Fix:
<a href="tel:+17205081998">(720) 508-1998</a>

Location: Footer template in Elementor. Find the phone link and 
correct the href attribute.
```

---

# Section 9: Competitive Position

## Competitive Landscape

| Competitor | Google Reviews | Key Advantage | Threat Level |
|------------|---------------|---------------|-------------|
| Rocky Mountain IV Medics | ~1,715 | 30+ city pages, dominant local SEO | High |
| HydraMed | 5,000+ (claimed) | Telehealth, 14 states, LegitScript, HSA/FSA | High |
| Onus IV + Longevity | Strong | 8 CO locations, since 2014, press features | Medium |
| Twin Rivers IV & Wellness | 882+ | Physical lounges + mobile Airstream | Medium |
| Pure IV | Present | National brand, tiered packages | Medium |
| Biologix | Present | 24/7 availability | Low |
| Denver Medical Concierges | Present | Physician-led (DO + NPs) | Low |

## SERP Performance

| Search Query | Position | Assessment |
|-------------|----------|------------|
| "mobile phlebotomy Denver" | ~4 | Best ranking -- unique differentiator |
| "semaglutide weight loss Denver" | ~8 | Moderate -- cannibalization hurts |
| "semaglutide Denver" | ~9 | Moderate -- same cannibalization issue |
| "mobile IV therapy Aurora CO" | ~5 | Decent for long-tail local |
| "mobile IV therapy Thornton CO" | ~4 | Good, BUT sister site at ~5-6 (cannibalizing each other) |
| "mobile IV therapy Greenwood Village" | ~4 | Good, BUT sister site at ~2, 5, 9 (cannibalizing) |
| "mobile IV therapy Denver" | NOT IN TOP 10 | Critical gap -- highest-volume keyword |

## Competitive Advantages

1. **Mobile phlebotomy** -- genuine differentiator that most IV therapy competitors do not offer
2. **546 reviews at 5.0** (via sister brand) -- exceptional social proof if properly leveraged
3. **Broad service mix** -- IV + weight loss + phlebotomy covers more patient needs than single-service competitors
4. **Statewide coverage claim** -- Colorado-wide vs. competitors focused on metro Denver

## Competitive Disadvantages

1. **No own Google Business Profile** -- cannot compete in the local pack
2. **Brand confusion** -- two sites splitting SEO authority and SERP positions
3. **No medical credentials displayed** -- Denver Medical Concierges leads with "physician-led"
4. **No LegitScript certification** -- HydraMed has this trust signal
5. **Stale content** -- competitors with active blogs outrank on informational queries
6. **Missing from "mobile IV therapy Denver"** -- the highest-volume keyword returns neither this site nor the sister site in the top 10

### FIX 9.1: Lean Into Phlebotomy Differentiator

**Effort:** Medium (4-6 hours)
**Impact:** High -- own a niche competitors ignore
**Priority:** High (30 days)

```
1. EXPAND /mobile-lab-draws/ PAGE
   This is already the best service page (has FAQ section). 
   Make it the best page in Denver for mobile phlebotomy:
   - Add detailed service descriptions (types of lab work available)
   - Add FAQ schema markup (content already exists for it)
   - Add pricing transparency
   - Add "areas we serve" with city-specific content
   - Add testimonials specific to phlebotomy
   - Add credentials of phlebotomists

2. CREATE SUPPORTING CONTENT
   - "Mobile Phlebotomy vs. Going to the Lab" (comparison post)
   - "What to Expect During a Mobile Blood Draw" (patient guide)
   - "Mobile Lab Draws for Seniors and Homebound Patients" (audience-specific)
   - "Corporate Wellness: On-Site Blood Draws for Your Team" (B2B angle)

3. BUILD CITY-SPECIFIC PHLEBOTOMY PAGES
   - "Mobile Phlebotomy in Denver"
   - "Mobile Phlebotomy in Aurora"
   - "Mobile Phlebotomy in Colorado Springs"
   - "Mobile Phlebotomy in Boulder"
   Each with unique content about serving that specific area.
```

---

# Prioritized Action Plan

## Critical (Do This Week)

| # | Fix | Section | Effort | Impact |
|---|-----|---------|--------|--------|
| 1 | Upgrade Acuity to HIPAA-compliant plan | 8.1 | Low | Legal/regulatory compliance |
| 2 | Fix schema markup (add address, phone, correct hours, change to MedicalBusiness) | 2.1 | Medium | SEO foundation |
| 3 | Consolidate 5 semaglutide pages into 1 with 301 redirects | 2.4 | Medium | Stop keyword cannibalization |
| 4 | Fix CLS (preload fonts, size logo) | 1.1 | Low-Med | Core Web Vitals ranking signal |
| 5 | Replace 75.6 MB .mov video with compressed MP4/WebM | 1.2 | Low | Page weight, mobile experience |
| 6 | Fix broken phone link in footer (http://tel -> tel:) | 8.3 | Very Low | Broken click-to-call |
| 7 | Update brand teal from #07b6b6 to #047c7c | 3.1 | Low | ADA compliance, 69 elements affected |

## High Priority (30 Days)

| # | Fix | Section | Effort | Impact |
|---|-----|---------|--------|--------|
| 8 | Create dedicated Google Business Profile for US Mobile Medics | 5.1 | Low | Local SEO foundation |
| 9 | Add medical director + provider credentials to site | 4.1 | Medium | E-E-A-T, legal exposure |
| 10 | Add medical disclaimers to all treatment pages | 4.1 | Medium | Legal, E-E-A-T |
| 11 | Reduce booking form fields (move medical Qs to post-booking intake) | 8.2 | Medium | Conversion rate |
| 12 | Fix service page meta descriptions (especially /weight-loss-services/ at 32 chars) | 2.5 | Very Low | Click-through rate |
| 13 | Add og:image and twitter:image | 2.2 | Very Low | Social sharing appearance |
| 14 | Fix heading hierarchy (H5 before H1, H1 to H6 skip) | 2.3 | Low | SEO document structure |
| 15 | Fix remaining accessibility issues (logo alt, ARIA list, banner landmark) | 3.2 | Low | ADA compliance |
| 16 | Fix directory listings (Nextdoor duplicate, Care.com wrong category) | 5.2 | Medium | Local SEO consistency |
| 17 | Expand phlebotomy page and create supporting content | 9.1 | Medium | Competitive differentiation |

## Strategic (60-90 Days)

| # | Fix | Section | Effort | Impact |
|---|-----|---------|--------|--------|
| 18 | Resolve sister brand strategy: merge vs. differentiate vs. status quo | 5.3 | High | Everything downstream |
| 19 | Reduce render-blocking CSS/JS (40 CSS, 56 JS files) | 1.3 | Medium | Performance, Lighthouse score |
| 20 | Revive blog with medically-reviewed, consistently published content | 4.2 | High | Long-term SEO authority |
| 21 | Create listings on Apple Maps, Bing Places, Healthgrades, ZocDoc | 5.2 | Medium | Local presence breadth |
| 22 | Clean up sitemaps (move location pages, remove redirected URLs) | 2.6 | Low | SEO hygiene |
| 23 | Reactivate social media presence (Instagram first) | 7.1 | Medium | Brand awareness |
| 24 | Build first-party Google review base (target: 50 in 6 months) | 6.1 | Low | Reputation independence |
| 25 | Pursue LegitScript certification | -- | Medium | Trust signal, competitive parity with HydraMed |

## Quick Wins (Under 30 Minutes Each)

| Fix | Time | Impact |
|-----|------|--------|
| Fix footer phone link href (http://tel -> tel:) | 5 min | Broken click-to-call functionality |
| Fix "experienceing" typo in Acuity disclaimer | 5 min | Professionalism |
| Add og:image meta tag via Yoast | 10 min | Social sharing previews |
| Fix logo alt text ("logo" -> "US Mobile Medics logo") | 5 min | Accessibility, SEO |
| Fix $0.00 pricing display in Acuity | 15 min | Conversion clarity |
| Update /weight-loss-services/ meta description (32 chars -> 160 chars) | 10 min | CTR on search results |

---

# Appendix A: Sister Company Relationship

US Mobile Medics (usmobilemedics.com) and U.S. Mobile IV (usmobileiv.com) share:

- **Owner:** David Kulikov (CEO of both)
- **Booking system:** Same Acuity Scheduling account (config shows "U.S. Mobile IV" as the business name)
- **Google reviews:** All 546 reviews are attributed to "U.S. Mobile IV" GBP
- **Social accounts:** Facebook and LinkedIn pages renamed/showing "U.S. Mobile IV"

This creates measurable SEO damage through SERP cannibalization. Verified examples:
- "mobile IV therapy Thornton CO": This site at ~4, sister site at ~5-6
- "mobile IV therapy Greenwood Village": This site at ~4, sister site at ~2, 5, 9

Every query where both sites appear splits click-through rate and signals to Google that neither is the definitive authoritative result for the query.

# Appendix B: Verification Methodology

This audit was conducted using 14 specialized analysis agents and verified by 6 independent adversarial agents. Each data point in this report was cross-checked against primary sources:

- **Performance data** verified via Lighthouse and direct resource measurement
- **SEO data** verified via DOM inspection, HTTP response headers, and raw JSON-LD extraction
- **Accessibility data** verified via Lighthouse score, getComputedStyle() color extraction, and manual contrast ratio calculation
- **Content data** verified via sitemap parsing (post-sitemap.xml confirmed 93 posts, not the initially claimed 131), page-by-page crawl, and publication date extraction
- **Local SEO data** verified via direct directory searches and Google Business Profile inspection
- **Competitive data** verified via live Google SERP queries for target keywords
- **Booking system data** verified via Acuity page source code inspection (isHipaa flag value, field counts, configuration JSON)

### Claims Corrected Through Adversarial Verification

| Initial Claim | Corrected Value | Method |
|---------------|----------------|--------|
| Blog post count: 131 | 93 (post-sitemap verified) | Sitemap XML parsing |
| Button heights: 34-37px | 42-50px | getComputedStyle() measurement |
| Footer phone link: "missing" | Present but invalid format (http://tel+17205081998) | DOM inspection |
| Review attribution: site's own reviews | 546 reviews belong to sister brand GBP, not this site | Google Business Profile search |

---

*Report prepared April 6, 2026. Data reflects site state as of audit date. Rankings and review counts are snapshots and will change over time.*
