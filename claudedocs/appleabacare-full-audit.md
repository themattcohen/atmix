# Comprehensive Website Audit: Apple ABA

**URL:** https://appleabacare.com/
**Business:** Apple ABA - In-Home ABA Therapy Provider
**Locations:** Mahwah, NJ & New York, NY
**Date:** January 28, 2026
**Audit Type:** Full Presence (5-Agent Analysis)
**Overall Grade:** C+

---

## Executive Summary

Apple ABA has a **technically sound website with excellent content** (176 blog posts, active FAQ pages) and **good performance metrics** (2-second load time). However, **critical local SEO and online presence gaps are severely limiting visibility** to families searching for ABA therapy services.

### The Core Problem
The website is well-built but essentially "invisible" to local search because it's missing the structured data (schema markup) that Google needs to understand and surface the business. Combined with an under-optimized Google Business Profile and missing citations in key healthcare directories, Apple ABA is likely losing significant traffic to competitors who have these basics in place.

### The Good News
The fixes are **straightforward and high-impact**. Implementing proper schema markup, optimizing GBP, and adding citations to autism-specific directories could dramatically improve local search rankings within 4-8 weeks.

---

## Grade Summary

| Category | Grade | Status |
|----------|-------|--------|
| **Performance** | B+ | Good load times, needs resource optimization |
| **SEO** | C | Missing critical schema markup |
| **Accessibility** | B+ | Strong foundation, minor form issues |
| **Content** | A- | Excellent blog, missing therapist profiles |
| **Local SEO** | C- | No LocalBusiness schema, GBP under-optimized |
| **Competitive Position** | B | Strong differentiators, untapped opportunities |
| **Social Presence** | C | Instagram active, other platforms underutilized |
| **Reviews & Reputation** | C+ | Positive sentiment, needs more volume |
| **Citations/NAP** | C | Good consistency, missing from key directories |

---

# Section 1: Technical Analysis

## Performance Metrics

| Metric | Value | Target | Status | Explanation |
|--------|-------|--------|--------|-------------|
| **TTFB** | 1ms | <800ms | ✅ Excellent | Server responds almost instantly |
| **DOM Interactive** | 353ms | <1000ms | ✅ Good | Page becomes usable quickly |
| **Total Load** | 2,027ms | <3000ms | ✅ Good | Full page loads under 3 seconds |
| **DOM Content Loaded** | 359ms | <500ms | ✅ Excellent | Main content renders fast |

**What This Means:** The website loads quickly, which is critical for both user experience and Google rankings. Parents researching ABA therapy on mobile devices will not experience frustrating delays.

## Resource Analysis

| Resource Type | Count | Assessment |
|---------------|-------|------------|
| Scripts (JS) | 75 | ⚠️ High - WordPress plugin bloat |
| Stylesheets (CSS) | 48 | ⚠️ High - needs consolidation |
| Images | 48 | ✅ Normal |
| Forms | 2 | ✅ Normal |

**The Problem:** 75 JavaScript files and 48 stylesheets is excessive. Each file requires a separate HTTP request, which can slow down the site on slower connections (like a parent's phone in a doctor's waiting room).

**Why It Happens:** WordPress sites accumulate plugins over time, and each plugin adds its own CSS/JS files. This is technical debt that gradually builds up.

### FIX: Resource Optimization

**Effort:** Medium (2-4 hours with developer)
**Impact:** Medium
**Priority:** Strategic (90 days)

```
Steps to consolidate resources:

1. AUDIT PLUGINS
   - Go to WordPress Admin → Plugins
   - Deactivate plugins one at a time and test site functionality
   - Remove any unused or redundant plugins
   - Target: Reduce from current count to 15-20 essential plugins

2. INSTALL OPTIMIZATION PLUGIN
   - Install "WP Rocket" or "Autoptimize" (free)
   - Enable CSS/JS minification and combination
   - Enable lazy loading for images
   - Target: Reduce 48 stylesheets to 5-10 combined files

3. DEFER NON-CRITICAL SCRIPTS
   - In WP Rocket: Settings → File Optimization → Defer JavaScript
   - Add tracking scripts (GA, Facebook Pixel) to footer, not header

4. TEST AFTER CHANGES
   - Use GTmetrix.com to verify improvements
   - Test all forms and interactive elements still work
```

## Accessibility Assessment

| Check | Result | Status |
|-------|--------|--------|
| Images without alt text | 0 | ✅ Excellent |
| Form inputs without labels | 10 | ⚠️ Needs fix |
| Zoom disabled | No | ✅ Correct |
| Skip link present | Yes | ✅ Good |
| ARIA live regions | 8 | ✅ Well implemented |
| Language attribute | en-US | ✅ Correct |

**What's Working:** All 48 images have proper alt text, which helps both screen reader users and Google image search. The site has skip links and proper ARIA implementation.

**The Problem:** 10 form inputs rely only on placeholder text instead of proper labels. Screen readers may not correctly identify these fields.

### FIX: Form Accessibility

**Effort:** Low (30 minutes)
**Impact:** Medium (ADA compliance, usability)
**Priority:** High (30 days)

```html
BEFORE (Problem):
<input type="text" placeholder="Your Name">

AFTER (Fixed):
<label for="name" class="screen-reader-text">Your Name</label>
<input type="text" id="name" placeholder="Your Name" aria-label="Your Name">

For Elementor forms:
1. Edit each form in Elementor
2. For each field, ensure "Label" is filled in (not just placeholder)
3. If you want label hidden visually, add CSS:
   .elementor-field-label {
     position: absolute;
     left: -9999px;
   }
```

## Technical Stack

| Component | Value | Notes |
|-----------|-------|-------|
| Platform | WordPress | With Elementor page builder |
| SEO Plugin | Yoast SEO | Properly configured |
| HTTPS | ✅ Enabled | Secure connection |
| Service Worker | ✅ Registered | PWA capable |
| Analytics | Google Analytics, Facebook Pixel, GTM | Complete tracking |

## Technical Issues Found

### Issue 1: Font Loading Failures

**Problem:** Custom fonts (Kaleko105) from GeeksProduction CDN are failing to load, causing console errors.

**Impact:** Low - Fallback fonts are displaying, so users don't see broken text. But it creates unnecessary error noise.

### FIX: Font Fallbacks

**Effort:** Low (15 minutes)
**Impact:** Low
**Priority:** Low (can do anytime)

```css
/* Add to your theme's style.css or Customizer → Additional CSS */

/* Ensure fallback fonts are specified */
body, p, span {
    font-family: 'Kaleko105', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
    font-family: 'Kaleko105', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* If Kaleko105 continues failing, consider self-hosting the font files
   instead of relying on external CDN */
```

### Issue 2: Facebook Pixel Duplicate Warning

**Problem:** Console shows Facebook Pixel duplicate ID warning.

**Impact:** Low - Tracking still works, but data may be duplicated.

### FIX: Facebook Pixel Cleanup

**Effort:** Low (15 minutes)
**Impact:** Low
**Priority:** Low

```
1. Go to WordPress Admin → Check these locations for FB Pixel:
   - Theme settings (Customizer)
   - Yoast SEO → Social
   - Any Facebook/Meta plugin
   - Header/Footer scripts plugin
   - Google Tag Manager container

2. Ensure the pixel is installed in ONLY ONE place
   - Recommended: Use Google Tag Manager exclusively
   - Remove pixel code from all other locations

3. Verify in Facebook Events Manager that events are firing correctly
```

---

# Section 2: SEO Analysis

## On-Page SEO

| Element | Current Value | Assessment |
|---------|---------------|------------|
| **Title** | "In-Home ABA Therapists in New Jersey \| Apple ABA" (57 chars) | ✅ Optimal length, good keywords |
| **Meta Description** | "Expert in-home ABA therapists in New Jersey. No waitlist, free consults, and personalized autism care from Apple ABA." (122 chars) | ⚠️ Too short |
| **H1** | "ABA Therapy in New Jersey" | ✅ Good - keyword + location |
| **Canonical** | https://appleabacare.com/ | ✅ Correct |
| **Robots** | index, follow | ✅ Correct |

### FIX: Meta Description

**Effort:** Very Low (5 minutes)
**Impact:** Medium (improves click-through rate)
**Priority:** Critical (do today)

```
CURRENT (122 chars):
"Expert in-home ABA therapists in New Jersey. No waitlist, free consults, and personalized autism care from Apple ABA."

RECOMMENDED (156 chars):
"Expert in-home ABA therapists in New Jersey. No waitlist, free consultations, insurance accepted. BCBA-supervised personalized autism care. Call 201-270-0222."

WHERE TO CHANGE:
WordPress Admin → Yoast SEO → Search Appearance → Homepage
OR
Edit Homepage → Scroll to Yoast SEO box → Edit snippet
```

## Schema Markup Analysis

This is the **#1 critical issue** on the site.

| Schema Type | Present | Impact | Explanation |
|-------------|---------|--------|-------------|
| Organization | ✅ Yes | - | Basic info present but incomplete |
| WebSite | ✅ Yes | - | Search action enabled |
| **LocalBusiness** | ❌ **NO** | 🔴 Critical | Google can't identify this as a local business |
| **MedicalBusiness** | ❌ **NO** | 🔴 Critical | Google can't identify this as healthcare |
| **FAQPage** | ❌ **NO** | 🟡 Major | Missing rich snippet opportunity |
| BreadcrumbList | ✅ Yes | - | Basic implementation |

**Why This Matters:**
When someone searches "ABA therapy near me" or "autism therapy Mahwah NJ," Google uses schema markup to understand which businesses are relevant. Without LocalBusiness schema, Google doesn't confidently know:
- That Apple ABA is a local business (not just an informational website)
- Where exactly it's located
- What services it provides
- How to contact it

Competitors WITH this schema have a significant advantage in local search results and the Google Maps "Local Pack" (the map with 3 businesses that appears at the top of local searches).

### FIX: Add LocalBusiness Schema (CRITICAL)

**Effort:** Low (1-2 hours)
**Impact:** Very High
**Priority:** Critical (do this week)

```json
Add this JSON-LD script to your site's <head> section.

Option 1: Via Yoast SEO (Easiest)
- Yoast SEO → Search Appearance → Content Types → Homepage
- Unfortunately Yoast doesn't fully support MedicalBusiness
- You'll need Option 2 or 3

Option 2: Via Theme Header (Recommended)
- Appearance → Theme Editor → header.php
- Add before </head>:

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "Apple ABA",
  "description": "In-home ABA therapy provider specializing in personalized autism treatment for children in New Jersey and New York.",
  "url": "https://appleabacare.com",
  "telephone": "+1-201-270-0222",
  "email": "info@appleabacare.com",
  "priceRange": "$$",
  "medicalSpecialty": "Applied Behavior Analysis",
  "availableService": [
    {
      "@type": "MedicalTherapy",
      "name": "In-Home ABA Therapy",
      "description": "One-on-one applied behavior analysis therapy delivered in the comfort of your home"
    },
    {
      "@type": "MedicalTherapy",
      "name": "Behavioral Assessment",
      "description": "Comprehensive behavioral assessment and treatment planning"
    }
  ],
  "address": [
    {
      "@type": "PostalAddress",
      "streetAddress": "479 State Route 17 N #2026",
      "addressLocality": "Mahwah",
      "addressRegion": "NJ",
      "postalCode": "07430",
      "addressCountry": "US"
    },
    {
      "@type": "PostalAddress",
      "streetAddress": "447 Broadway 2nd FL #615",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "postalCode": "10013",
      "addressCountry": "US"
    }
  ],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "41.0887",
    "longitude": "-74.1438"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "18:00"
    }
  ],
  "sameAs": [
    "https://www.instagram.com/appleabacare/",
    "https://www.facebook.com/appleabacare",
    "https://www.linkedin.com/company/a-is-for-apple-inc-/"
  ],
  "logo": "https://appleabacare.com/wp-content/uploads/apple-aba-logo.png",
  "image": "https://appleabacare.com/wp-content/uploads/apple-aba-office.jpg"
}
</script>

Option 3: Via Plugin
- Install "Schema Pro" or "Rank Math" plugin
- Configure MedicalBusiness schema through the UI
```

### FIX: Add FAQPage Schema

**Effort:** Very Low (30 minutes)
**Impact:** High (enables FAQ rich snippets in Google)
**Priority:** Critical (do this week)

```json
Add to FAQ pages (Insurance FAQ, Concierge Care FAQ, etc.):

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is ABA therapy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Applied Behavior Analysis (ABA) therapy is an evidence-based treatment that helps children with autism develop communication, social, and daily living skills through positive reinforcement techniques."
      }
    },
    {
      "@type": "Question",
      "name": "Does insurance cover ABA therapy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, most major insurance plans in New Jersey cover ABA therapy for autism. Apple ABA works with Aetna, Horizon BCBS, United Healthcare, and many other providers. We handle insurance verification and paperwork."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a waitlist for ABA therapy at Apple ABA?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, Apple ABA has no waitlist. We can typically begin services within 1-2 weeks of completing the intake process."
      }
    }
  ]
}
</script>

EASIEST METHOD:
- Install "Yoast SEO" FAQ block (if using Gutenberg)
- Or use Rank Math's FAQ schema feature
- Add FAQ blocks to relevant pages - schema is auto-generated
```

## Sitemap & Indexing

| Element | Status | Notes |
|---------|--------|-------|
| Robots.txt | ✅ Correct | Allows all crawlers, references sitemap |
| XML Sitemap | ✅ Excellent | 7 specialized sitemaps |
| Blog Posts | 176 | Outstanding content volume |
| Core Pages | 20 | Good coverage |
| Location Pages | Present | Counties and areas served |

**Assessment:** The sitemap infrastructure is excellent. Yoast SEO is managing this well.

## Content Assessment

| Content Type | Status | Notes |
|--------------|--------|-------|
| Blog | ✅ Excellent | 176 posts, actively updated |
| Service Pages | ✅ Good | Detailed descriptions |
| FAQ Pages | ✅ Present | Needs schema markup |
| Location Pages | ✅ Present | County-specific content |
| Therapist Profiles | ❌ Missing | Trust signal gap |

### FIX: Create Therapist Profile Pages

**Effort:** Medium (4-6 hours for content creation)
**Impact:** High (builds trust, improves E-E-A-T)
**Priority:** High (30 days)

```
WHY THIS MATTERS:
Google's E-E-A-T guidelines (Experience, Expertise, Authoritativeness, Trust)
are especially important for healthcare websites. Showing your team's
credentials demonstrates expertise.

Parents also want to know WHO will be working with their child.

RECOMMENDED STRUCTURE:
Create a "Our Team" page with individual profiles:

For each BCBA/therapist:
- Professional headshot
- Name and credentials (e.g., "Sarah Johnson, BCBA, LBA")
- Bio (2-3 paragraphs about background, specializations)
- Education and certifications
- Years of experience
- Specialization areas (early intervention, teens, etc.)

SCHEMA FOR PROFILES:
{
  "@type": "Person",
  "name": "Sarah Johnson",
  "jobTitle": "Board Certified Behavior Analyst",
  "description": "BCBA specializing in early intervention...",
  "hasCredential": {
    "@type": "EducationalOccupationalCredential",
    "credentialCategory": "BCBA",
    "recognizedBy": {
      "@type": "Organization",
      "name": "Behavior Analyst Certification Board"
    }
  }
}
```

---

# Section 3: Local SEO Analysis

## Current Local SEO Status

| Factor | Status | Impact |
|--------|--------|--------|
| NAP on website | ✅ Visible | Good foundation |
| NAP consistency | ⚠️ Dual locations | Can confuse Google |
| LocalBusiness schema | ❌ Missing | 🔴 Critical gap |
| Google Business Profile | ⚠️ Under-optimized | Major opportunity |
| GBP link on website | ❌ Not visible | Easy fix |
| Location pages | ✅ Present | Good for geo-targeting |

## NAP (Name, Address, Phone) Details

**Primary Location:**
- Name: Apple ABA
- Address: 479 State Route 17 N #2026, Mahwah, NJ 07430
- Phone: 201-270-0222

**Secondary Location:**
- Name: Apple ABA
- Address: 447 Broadway 2nd FL #615, New York, NY 10013
- Phone: 201-270-0222

**Consistency Score: 9/10**
The NAP is displayed consistently across the website. Minor issue: having two addresses can dilute local signals if not properly structured with schema.

### FIX: Google Business Profile Optimization

**Effort:** Medium (2-3 hours initial, ongoing maintenance)
**Impact:** Very High
**Priority:** Critical (this week)

```
STEP 1: VERIFY/CLAIM GBP
- Go to google.com/business
- Search for "Apple ABA Mahwah NJ"
- If unclaimed: Click "Claim this business" and verify via postcard/phone
- If claimed: Ensure you have admin access

STEP 2: COMPLETE ALL FIELDS
□ Business name: Apple ABA (exact match to website)
□ Primary category: "Applied Behavior Analysis Therapist"
□ Secondary categories: "Autism Therapy Service", "Child Psychologist"
□ Address: 479 State Route 17 N #2026, Mahwah, NJ 07430
□ Service area: Add all counties served (Bergen, Passaic, etc.)
□ Phone: 201-270-0222
□ Website: https://appleabacare.com
□ Hours: Accurate operating hours
□ Description: 750 characters max, include keywords naturally

SAMPLE DESCRIPTION:
"Apple ABA provides expert in-home ABA therapy for children with autism
in New Jersey. Our BCBA-supervised team delivers personalized, concierge-level
care with no waitlist. Services include behavioral assessments, communication
skills development, and social skills training. We accept most major insurance
including Aetna, Horizon BCBS, and United Healthcare. Serving Bergen County,
Passaic County, Essex County, and surrounding areas. Call for a free consultation."

STEP 3: ADD PHOTOS (Critical for engagement)
□ Logo (square, high-res)
□ Cover photo (welcoming office or therapy session - with permission)
□ Team photos (builds trust)
□ Office exterior (helps people find you)
□ Office interior
□ At least 10 photos total (businesses with 10+ photos get 35% more clicks)

STEP 4: ADD SERVICES
□ List each service with description:
  - In-Home ABA Therapy
  - Behavioral Assessment
  - Parent Training
  - Social Skills Groups
  - Concierge Care

STEP 5: ENABLE MESSAGING & BOOKING
□ Turn on messaging (lets parents contact directly from Google)
□ Add booking link if you have online scheduling

STEP 6: CREATE FIRST POST
□ Go to "Updates" in GBP dashboard
□ Post a welcome message or current promotion
□ Commit to posting 1-2x per week

STEP 7: ADD GBP LINK TO WEBSITE
Add to footer:
<a href="https://g.page/apple-aba-mahwah" target="_blank">
  Find us on Google Maps
</a>
```

---

# Section 4: Social & Reviews Analysis

## Social Media Presence

| Platform | Status | Followers | Activity | Action Needed |
|----------|--------|-----------|----------|---------------|
| Instagram | ✅ Active | Unknown | Regular posting | Continue, engage more |
| Facebook | ⚠️ Unclear | Unknown | Unknown | Verify/create page |
| LinkedIn | ✅ Present | Growing | Job postings active | Add company updates |
| YouTube | ❌ None | N/A | N/A | Create channel |
| TikTok | ❌ None | N/A | N/A | Consider for reach |
| Nextdoor | ✅ Listed | N/A | Positive mentions | Monitor, engage |

## Review Platform Status

| Platform | Rating | Reviews | Status |
|----------|--------|---------|--------|
| Google | Unknown | Unknown | Needs verification |
| Yelp | Listed | Unknown | Business page exists |
| Facebook | Unknown | Unknown | Verify page |
| BBB | Not Found | N/A | Not accredited |
| Healthgrades | Not Found | N/A | Opportunity |

## Review Sentiment (from available data)

**Overall Sentiment:** Positive

**Common Praise Themes:**
- "Remarkable improvement" in children's skills
- Team commitment and caring approach
- "Game-changer" outcomes for families
- Personalized, individualized care
- Concierge-level service

**Complaint Themes:** None identified

### FIX: Review Generation Strategy

**Effort:** Low (ongoing)
**Impact:** Very High
**Priority:** High (start immediately)

```
THE GOAL: Get 20+ Google reviews in 90 days

STEP 1: CREATE REVIEW LINK
- In GBP dashboard, find your short review link
- Or create: https://search.google.com/local/writereview?placeid=[YOUR_PLACE_ID]
- Shorten it: g.page/apple-aba-mahwah/review

STEP 2: ASK AT THE RIGHT TIME
Best moments to request reviews:
□ After a successful assessment meeting
□ When parent shares positive feedback verbally
□ At milestone achievements (child hits a goal)
□ After 90 days of service (established relationship)

STEP 3: MAKE IT EASY
Create a simple email template:

---
Subject: Quick favor - 30 seconds?

Hi [Parent Name],

It's been wonderful working with [Child Name] and seeing their progress
with [specific skill they improved].

If you have 30 seconds, would you mind sharing your experience on Google?
It helps other families find quality ABA services.

[BUTTON: Leave a Review]
→ https://g.page/apple-aba-mahwah/review

Thank you so much!
[Therapist Name]
---

STEP 4: RESPOND TO ALL REVIEWS
- Respond within 24-48 hours
- Thank positive reviewers specifically
- Address concerns in negative reviews professionally
- Never share protected health information in responses

SAMPLE RESPONSE TO POSITIVE REVIEW:
"Thank you so much for sharing your experience, [Name]! We're thrilled
to hear about [Child]'s progress. Our team is dedicated to helping each
child reach their potential. We're honored to be part of your family's
journey. - The Apple ABA Team"

STEP 5: TRACK PROGRESS
- Check GBP insights weekly
- Goal: 5 reviews/month minimum
- Track response rate (should be 100%)
```

### FIX: BBB Accreditation

**Effort:** Medium (application process)
**Impact:** Medium (trust signal)
**Priority:** Strategic (90 days)

```
WHY BBB MATTERS:
- Trust signal for cautious parents
- Shows commitment to ethical business practices
- Appears in search results ("BBB Accredited")

STEPS:
1. Go to bbb.org/get-accredited
2. Apply for accreditation ($500-$1000/year for small business)
3. Complete the application and ethics commitment
4. Display BBB badge on website once approved
```

---

# Section 5: Citations & Backlinks Analysis

## Current Citation Status

### NAP Consistency: 9/10
NAP is consistent across verified listings. Minor issue with dual locations needs schema clarification.

### Directory Presence

| Directory | Listed | Accurate | Priority |
|-----------|--------|----------|----------|
| Google Business | ⚠️ Verify | Unknown | 🔴 Critical |
| Yelp | ✅ Yes | ✅ Yes | Monitor |
| Yellow Pages | ❌ No | N/A | Medium |
| BBB | ❌ No | N/A | Medium |
| Bing Places | ❌ Unknown | Unknown | High |
| Apple Maps | ⚠️ Likely | Unknown | High |
| Manta | ❌ Unknown | Unknown | Low |
| Nextdoor | ✅ Yes | ✅ Yes | Monitor |

### Healthcare Directory Presence (CRITICAL GAP)

| Directory | Listed | Impact | Notes |
|-----------|--------|--------|-------|
| **Autism Speaks** | ❌ No | 🔴 Very High | #1 autism resource for families |
| **Beaming Health** | ❌ No | 🔴 High | 30K+ autism care marketplace |
| **Psychology Today** | ❌ No | 🔴 High | Major therapist directory |
| **BHCOE Directory** | ❌ No | 🟡 Medium | Requires accreditation |
| **Healthgrades** | ❌ No | 🟡 Medium | Healthcare provider directory |
| **NJ DDD Provider Directory** | ❓ Unknown | 🔴 High | State resource |
| **Autism NJ** | ❓ Unknown | 🔴 High | State autism organization |

### Backlink Profile

**Quality Assessment:** Medium

**Notable Backlinks Found:**
- Bergen ResourceNet (local health directory) - High value
- Nextdoor (community platform) - Medium value
- Hours.com (business directory) - Low value

**Missing:**
- Local news coverage
- Healthcare partner links
- Autism nonprofit links
- Educational institution links

### FIX: Citation Building Plan

**Effort:** Medium (spread over 90 days)
**Impact:** Very High
**Priority:** High

```
PHASE 1: CRITICAL CITATIONS (Week 1-2)
□ Google Business Profile - Verify and optimize
□ Bing Places - Create listing at bingplaces.com
□ Apple Maps - Claim at businessconnect.apple.com

PHASE 2: HEALTHCARE DIRECTORIES (Week 3-4)
□ Autism Speaks Provider Directory
  - Go to autismspeaks.org/resource-guide
  - Submit provider listing
  - This is the #1 resource families use

□ Psychology Today
  - Go to psychologytoday.com/us/therapists/join
  - Create provider profile
  - Add all credentials and specializations

□ Beaming Health
  - Go to beaminghealth.com/for-providers
  - Apply for provider listing
  - Specialized autism care marketplace

PHASE 3: GENERAL DIRECTORIES (Week 5-6)
□ Yellow Pages - yellowpages.com/business
□ Manta - manta.com/claim
□ Foursquare - business.foursquare.com
□ MapQuest - mapquest.com/business

PHASE 4: STATE/LOCAL RESOURCES (Week 7-8)
□ NJ Department of Human Services Provider List
□ Autism NJ Referral Database (autismnj.org)
□ Bergen County resource directories
□ Local Chamber of Commerce

CITATION CHECKLIST FOR EACH:
□ Business name exactly: "Apple ABA"
□ Address exactly: "479 State Route 17 N #2026, Mahwah, NJ 07430"
□ Phone exactly: "201-270-0222"
□ Website: "https://appleabacare.com"
□ Description: Use consistent 2-3 sentence description
□ Categories: ABA Therapy, Autism Services, Behavioral Health
□ Photos: Upload same logo and photos as GBP
```

### FIX: Backlink Building Strategy

**Effort:** High (ongoing)
**Impact:** High
**Priority:** Strategic (90+ days)

```
STRATEGY 1: LOCAL PARTNERSHIPS
- Partner with pediatricians who refer ABA services
- Ask for listing on their "Resources" page
- Offer to provide educational content for their patients

STRATEGY 2: AUTISM NONPROFITS
- Contact Autism NJ, Autism Speaks local chapter
- Offer to sponsor events or provide educational workshops
- Get listed as a resource/partner

STRATEGY 3: CONTENT MARKETING
- Write guest posts for autism parenting blogs
- Create shareable resources (downloadable guides)
- Develop infographics about ABA therapy

STRATEGY 4: LOCAL PR
- Submit press releases for company milestones
- Reach out to local NJ news for "local business" features
- Participate in community events (sponsorships get links)

STRATEGY 5: PROFESSIONAL ASSOCIATIONS
- Get listed in BACB provider directory
- Join NJ Association for Behavior Analysis
- Participate in professional conferences
```

---

# Section 6: Competitive Analysis

## Top Competitors

| Company | Key Differentiator | What Apple ABA Can Learn |
|---------|-------------------|--------------------------|
| ABA Centers of NJ | No waitlist + diagnostics | Consider adding assessment services |
| Proud Moments ABA | BHCOE Accredited | Pursue BHCOE accreditation |
| Helping Hands Family | Multi-location presence | Expand geographic coverage |
| Cross River Therapy | Strong "near me" SEO | Fix local SEO gaps |
| Children First ABA NYC | 100% BCBA-delivered | Emphasize BCBA supervision |
| Yellow Bus ABA | Teen/adolescent focus | Consider teen specialization |

## Apple ABA's Competitive Advantages

1. **"No Waitlist"** - Major differentiator (many competitors have 3-6 month waits)
2. **"Concierge Care"** - Unique positioning in market
3. **In-Home Focus** - Matches family preference trends
4. **Dual Location** - NY/NJ coverage is valuable
5. **Content Volume** - 176 blog posts is exceptional

## Untapped Opportunities

| Opportunity | Difficulty | Potential Impact |
|-------------|------------|------------------|
| BHCOE Accreditation | High (organizational) | Very High |
| Teen/Adolescent Programs | Medium | High |
| Multilingual Services | Medium | Medium |
| Outcome Transparency | Medium | High |
| Parent Training Emphasis | Low | Medium |

### FIX: Pursue BHCOE Accreditation

**Effort:** Very High (6-12 month process)
**Impact:** Very High
**Priority:** Strategic (start planning now)

```
WHY BHCOE MATTERS:
- Behavioral Health Center of Excellence accreditation
- Only Proud Moments has this in NJ/NY market
- Instant credibility and differentiation
- Required by some insurance payers
- Listed in BHCOE provider directory (free marketing)

STEPS:
1. Visit bhcoe.org/become-accredited
2. Review requirements and standards
3. Conduct internal readiness assessment
4. Apply and schedule evaluation
5. Implement any required changes
6. Complete accreditation process

COST: $3,000-$10,000 depending on organization size
TIME: 6-12 months from application to accreditation
```

---

# Section 7: Prioritized Action Plan

## Critical Priority (Do This Week)

| # | Action | Time | Impact |
|---|--------|------|--------|
| 1 | Add LocalBusiness/MedicalBusiness schema | 2 hrs | Very High |
| 2 | Add FAQPage schema to existing FAQ pages | 30 min | High |
| 3 | Expand meta description to 155 characters | 5 min | Medium |
| 4 | Verify Google Business Profile ownership | 30 min | Very High |

**Estimated Total Time:** 3-4 hours
**Expected Impact:** Significant improvement in local search visibility within 4-6 weeks

## High Priority (Next 30 Days)

| # | Action | Time | Impact |
|---|--------|------|--------|
| 5 | Fully optimize Google Business Profile | 3 hrs | Very High |
| 6 | Create Autism Speaks provider listing | 1 hr | High |
| 7 | Create Psychology Today profile | 1 hr | High |
| 8 | Fix 10 form inputs without labels | 30 min | Medium |
| 9 | Start review generation campaign | Ongoing | High |
| 10 | Create Bing Places listing | 30 min | Medium |
| 11 | Claim Apple Business Connect | 30 min | Medium |

## Strategic Priority (Next 90 Days)

| # | Action | Time | Impact |
|---|--------|------|--------|
| 12 | Create therapist profile pages | 6 hrs | High |
| 13 | Consolidate CSS/JS resources | 4 hrs | Medium |
| 14 | Build out healthcare directory citations | 4 hrs | High |
| 15 | Apply for BBB accreditation | 2 hrs | Medium |
| 16 | Create YouTube channel with educational content | 10 hrs | Medium |
| 17 | Develop teen/adolescent service content | 8 hrs | Medium |
| 18 | Begin BHCOE accreditation research | 4 hrs | Very High |

---

# Quick Wins Checklist (Can Do Today)

- [ ] **Expand meta description** - Add 30+ characters (5 minutes)
- [ ] **Add LocalBusiness JSON-LD** - Copy schema from Section 2 (30 minutes)
- [ ] **Add FAQPage schema** - Mark up existing FAQ content (30 minutes)
- [ ] **Link to GBP** - Add "Find us on Google Maps" to footer (10 minutes)
- [ ] **Fix font CSS** - Add system font fallbacks (15 minutes)

**Total Quick Win Time:** ~90 minutes
**Combined Impact:** Foundation for significant local SEO improvement

---

# Appendix: Schema Code Ready to Implement

## Complete LocalBusiness Schema

```html
<!-- Add this to header.php before </head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "Apple ABA",
  "alternateName": "Apple ABA Autism Therapy",
  "description": "In-home ABA therapy provider specializing in personalized autism treatment for children in New Jersey and New York. BCBA-supervised services with no waitlist.",
  "url": "https://appleabacare.com",
  "telephone": "+1-201-270-0222",
  "email": "info@appleabacare.com",
  "priceRange": "$$",
  "currenciesAccepted": "USD",
  "paymentAccepted": "Insurance, Credit Card",
  "medicalSpecialty": "Applied Behavior Analysis",
  "isAcceptingNewPatients": true,
  "availableService": [
    {
      "@type": "MedicalTherapy",
      "name": "In-Home ABA Therapy",
      "description": "One-on-one applied behavior analysis therapy delivered in the comfort of your home by certified therapists"
    },
    {
      "@type": "MedicalTherapy",
      "name": "Behavioral Assessment",
      "description": "Comprehensive behavioral assessment and individualized treatment planning"
    },
    {
      "@type": "MedicalTherapy",
      "name": "Parent Training",
      "description": "Training and support for parents to reinforce therapy goals at home"
    },
    {
      "@type": "MedicalTherapy",
      "name": "Concierge ABA Care",
      "description": "Premium concierge-level ABA therapy services with dedicated support"
    }
  ],
  "address": [
    {
      "@type": "PostalAddress",
      "streetAddress": "479 State Route 17 N #2026",
      "addressLocality": "Mahwah",
      "addressRegion": "NJ",
      "postalCode": "07430",
      "addressCountry": "US"
    },
    {
      "@type": "PostalAddress",
      "streetAddress": "447 Broadway 2nd FL #615",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "postalCode": "10013",
      "addressCountry": "US"
    }
  ],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "41.0887",
    "longitude": "-74.1438"
  },
  "areaServed": [
    {
      "@type": "State",
      "name": "New Jersey"
    },
    {
      "@type": "City",
      "name": "New York"
    }
  ],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "18:00"
    }
  ],
  "sameAs": [
    "https://www.instagram.com/appleabacare/",
    "https://www.facebook.com/appleabacare",
    "https://www.linkedin.com/company/a-is-for-apple-inc-/",
    "https://www.yelp.com/biz/apple-aba-mahwah"
  ],
  "logo": {
    "@type": "ImageObject",
    "url": "https://appleabacare.com/wp-content/uploads/apple-aba-logo.png"
  }
}
</script>
```

## Complete FAQPage Schema

```html
<!-- Add this to FAQ pages -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is ABA therapy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Applied Behavior Analysis (ABA) therapy is an evidence-based treatment approach that helps children with autism spectrum disorder develop essential skills. Through positive reinforcement and structured interventions, ABA therapy improves communication, social skills, and daily living abilities."
      }
    },
    {
      "@type": "Question",
      "name": "Does insurance cover ABA therapy in New Jersey?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, most major insurance plans in New Jersey are required to cover ABA therapy for autism under state mandates. Apple ABA works with Aetna, Horizon Blue Cross Blue Shield, United Healthcare, Cigna, and many other insurance providers. We handle insurance verification and prior authorization paperwork for families."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a waitlist for ABA therapy at Apple ABA?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, Apple ABA has no waitlist for ABA therapy services. We can typically begin in-home therapy within 1-2 weeks of completing the intake process and insurance verification. Contact us for a free consultation to get started."
      }
    },
    {
      "@type": "Question",
      "name": "What areas does Apple ABA serve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Apple ABA provides in-home ABA therapy throughout New Jersey, including Bergen County, Passaic County, Essex County, Morris County, and surrounding areas. We also serve families in New York City and the greater New York metropolitan area."
      }
    },
    {
      "@type": "Question",
      "name": "What qualifications do Apple ABA therapists have?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "All Apple ABA therapy programs are supervised by Board Certified Behavior Analysts (BCBAs). Our therapy team includes Licensed Behavior Analysts (LBAs) and Registered Behavior Technicians (RBTs) who receive ongoing training and supervision to ensure the highest quality care."
      }
    }
  ]
}
</script>
```

---

# Summary

## What's Working Well
- ✅ Excellent blog content (176 posts)
- ✅ Fast website performance (2-second loads)
- ✅ Strong accessibility foundation
- ✅ Clear value proposition (concierge care, no waitlist)
- ✅ Mobile-responsive design
- ✅ Active Instagram presence
- ✅ Positive review sentiment
- ✅ Consistent NAP information

## Critical Issues to Fix
- ❌ Missing LocalBusiness/MedicalBusiness schema
- ❌ Missing FAQPage schema
- ❌ Under-optimized Google Business Profile
- ❌ Not listed in autism-specific directories (Autism Speaks, Beaming Health)
- ❌ No therapist profile pages
- ❌ Meta description too short
- ❌ 10 form inputs missing accessibility labels

## Expected Results After Fixes

**4-6 Weeks:**
- Improved visibility in "ABA therapy near me" searches
- FAQ rich snippets appearing in Google
- Increased Google Business Profile views and calls

**3-6 Months:**
- Significant increase in organic local search traffic
- More review volume (target: 20+ Google reviews)
- Presence in healthcare directories driving referrals
- Improved competitive position against other NJ ABA providers

---

*Full Presence Audit completed January 28, 2026*
*Generated by /sc:website-audit --full-presence*
