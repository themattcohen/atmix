# Website Audit: Apple ABA
**URL:** https://appleabacare.com/
**Date:** January 28, 2026
**Overall Grade:** C+

## Executive Summary

Apple ABA has a technically solid website with excellent content (176 blog posts) and good performance metrics, but **critical local SEO gaps are severely limiting search visibility**. The site is missing essential LocalBusiness and MedicalBusiness schema markup that search engines need to surface the business for local "ABA therapy near me" searches. The fixes are straightforward and high-impact—implementing proper schema could significantly improve local search rankings within weeks.

---

## Grades by Category

| Category | Grade | Key Issue |
|----------|-------|-----------|
| Performance | B+ | High resource count (75 scripts, 48 stylesheets) but good load times |
| SEO | C | Missing LocalBusiness, MedicalBusiness, FAQPage schemas |
| Accessibility | B+ | 10 form inputs without labels; otherwise excellent |
| Content | A- | Outstanding blog (176 posts); missing therapist profiles |
| Local SEO | C- | No LocalBusiness schema; GBP not linked; NAP presentation inconsistent |
| Competitive Position | B | Strong differentiators but untapped opportunities |

---

## Technical Analysis Results

### Performance Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| TTFB | 1ms | <800ms | ✅ Excellent |
| DOM Interactive | 353ms | <1000ms | ✅ Good |
| Total Load | 2027ms | <3000ms | ✅ Good |
| DOM Content Loaded | 359ms | <500ms | ✅ Excellent |

### Resource Breakdown
| Type | Count | Assessment |
|------|-------|------------|
| Scripts | 75 | ⚠️ High - WordPress plugin bloat |
| Stylesheets | 48 | ⚠️ High - needs consolidation |
| Images | 48 | ✅ Normal |
| Forms | 2 | ✅ Normal |

### Accessibility Assessment
| Check | Result | Status |
|-------|--------|--------|
| Images without alt text | 0 | ✅ Excellent |
| Inputs without labels | 10 | ⚠️ Needs attention |
| Zoom disabled | No | ✅ Correct |
| Skip link present | Yes | ✅ Good |
| ARIA live regions | 8 | ✅ Well implemented |
| Language attribute | en-US | ✅ Set correctly |

### Technical Stack
- **Platform:** WordPress (with Elementor page builder)
- **SEO Plugin:** Yoast SEO
- **HTTPS:** ✅ Enabled
- **Service Worker:** ✅ Registered (PWA capable)
- **Tracking:** Google Analytics, Facebook Pixel, Google Tag Manager

### Technical Issues
1. **Font loading failures** - Kaleko105 fonts from GeeksProduction CDN failing; needs fallback fonts
2. **Facebook Pixel duplicate ID** warning in console
3. **High resource count** - 75 scripts could be consolidated/deferred

---

## SEO Analysis Results

### On-Page SEO
| Element | Value | Assessment |
|---------|-------|------------|
| Title | "In-Home ABA Therapists in New Jersey \| Apple ABA" (57 chars) | ✅ Optimal |
| Meta Description | "Expert in-home ABA therapists in New Jersey..." (122 chars) | ⚠️ Too short (target: 150-160) |
| H1 | "ABA Therapy in New Jersey" | ✅ Good - keyword + location |
| Canonical | https://appleabacare.com/ | ✅ Correct |
| Robots | index, follow | ✅ Correct |

### Schema Markup Status
| Schema Type | Present | Impact |
|-------------|---------|--------|
| Organization | ✅ Yes | Missing phone/address details |
| WebSite | ✅ Yes | Search action enabled |
| LocalBusiness | ❌ **NO** | 🔴 **CRITICAL GAP** |
| MedicalBusiness | ❌ **NO** | 🔴 **CRITICAL GAP** |
| FAQPage | ❌ **NO** | 🟡 **Major missed opportunity** |
| BreadcrumbList | ✅ Yes | Basic implementation |

### Sitemap & Indexing
- **Robots.txt:** ✅ Properly configured
- **Sitemap:** ✅ Comprehensive (7 sitemaps)
  - 176 blog posts
  - 20 core pages
  - County/area landing pages
  - Category and tag archives

### Content Assessment
| Content Type | Status | Notes |
|--------------|--------|-------|
| Blog | ✅ Excellent | 176 posts, actively updated |
| Service Pages | ✅ Good | Detailed descriptions |
| FAQ Pages | ✅ Present | Not schema-marked |
| Location Pages | ✅ Present | Counties served |
| Therapist Profiles | ❌ Missing | Trust signal gap |

---

## Local SEO Analysis

### NAP (Name, Address, Phone)
- **Name:** Apple ABA ✅ Consistent
- **Addresses:**
  - 447 Broadway 2nd FL #615, New York, NY 10013
  - 479 State Route 17 N #2026, Mahwah, NJ 07430
- **Phone:** 201-270-0222 ✅ Visible

### Local SEO Issues
| Issue | Status | Impact |
|-------|--------|--------|
| LocalBusiness schema | ❌ Missing | 🔴 Critical |
| Google Business Profile link | ❌ Not visible | 🔴 High |
| NAP in schema | ❌ Missing | 🔴 High |
| Service area schema | ❌ Missing | 🟡 Medium |
| Dual location clarity | ⚠️ Confusing | 🟡 Medium |

---

## Competitive Analysis Results

### Top Competitors
| Company | Key Differentiator | Notable Feature |
|---------|-------------------|-----------------|
| ABA Centers of NJ | No waitlist, diagnostics included | Free consultations |
| Proud Moments ABA | BHCOE Accredited | Multi-state presence |
| Helping Hands Family | Multi-location (Edison, Mount Laurel) | Evidence-based messaging |
| Cross River Therapy | 20+ years experience | Strong local SEO |
| Children First ABA NYC | 100% BCBA-delivered | Premium positioning |
| Yellow Bus ABA | Teen/adolescent specialty | State-of-art centers |

### Target Keywords
| Keyword | Priority | Apple ABA Status |
|---------|----------|------------------|
| "ABA therapy [city] NJ" | High | Needs location pages |
| "in-home ABA therapy New Jersey" | High | Good positioning |
| "ABA therapy near me" | High | Needs local SEO fix |
| "no waitlist ABA therapy NJ" | Medium | Strong differentiator |
| "BCBA therapy near me" | Medium | Add credentials pages |

### Competitive Gaps (Opportunities)
1. **BHCOE Accreditation** - Only Proud Moments has this in market
2. **Teen/adolescent services** - Underserved segment
3. **Multilingual services** - Limited in NJ market
4. **Outcome tracking transparency** - Emerging trend
5. **Parent training content leadership** - Differentiation opportunity

---

## Prioritized Recommendations

### Critical (Do Immediately)
| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Add LocalBusiness schema with NAP, geo coordinates, insurance list | Very High | Low (1-2 hrs) |
| 2 | Add FAQPage schema to existing FAQ content | High | Very Low (30 min) |
| 3 | Expand meta description to 155 characters | Medium | Very Low (5 min) |
| 4 | Fix font loading - add system font fallbacks in CSS | Medium | Low (30 min) |

### High Priority (Next 30 Days)
| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 5 | Create/optimize Google Business Profile for both locations | Very High | Medium |
| 6 | Add MedicalBusiness schema with credentials, specializations | High | Low-Medium |
| 7 | Create therapist/BCBA profile pages with credentials | High | Medium |
| 8 | Fix 10 form inputs - add proper labels/aria-labels | Medium | Low |
| 9 | Link GBP from footer and contact page | Medium | Very Low |

### Strategic (Next 90 Days)
| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 10 | Consolidate CSS/JS (48 stylesheets → 10-15) | Medium | High |
| 11 | Pursue BHCOE Accreditation | Very High | Very High |
| 12 | Add video testimonials with VideoObject schema | High | High |
| 13 | Develop teen/adolescent program content | High | High |
| 14 | Add insurance-specific landing pages | Medium | Medium |

---

## Quick Wins (Can Do Today)

1. **Expand meta description** - Add 30+ characters with value propositions like "BCBA-supervised, insurance accepted"

2. **Add LocalBusiness JSON-LD** - Insert this in header:
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "Apple ABA",
  "telephone": "201-270-0222",
  "email": "info@appleabacare.com",
  "url": "https://appleabacare.com",
  "address": [{
    "@type": "PostalAddress",
    "streetAddress": "479 State Route 17 N #2026",
    "addressLocality": "Mahwah",
    "addressRegion": "NJ",
    "postalCode": "07430"
  }],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "41.0887",
    "longitude": "-74.1438"
  },
  "openingHours": "Mo-Fr 08:00-18:00",
  "priceRange": "$$",
  "medicalSpecialty": "Applied Behavior Analysis"
}
```

3. **Add FAQPage schema** to existing FAQ sections (Yoast SEO can do this automatically)

4. **Link to Google Business Profile** from footer contact section

---

## Summary

**What's Working Well:**
- Excellent blog content strategy (176 posts)
- Fast load times and good performance
- Strong accessibility foundation
- Clear value proposition (concierge, no waitlist)
- Mobile responsive design

**What Needs Immediate Attention:**
- Missing LocalBusiness/MedicalBusiness schema (critical for local search)
- Missing FAQPage schema (easy win, content exists)
- No visible GBP integration
- Meta description too short

**Biggest Opportunity:**
Implementing proper local SEO schema could dramatically improve visibility for "ABA therapy near me" and location-specific searches. This is a high-impact, low-effort fix that competitors may also be missing.

---

*Report generated by /sc:website-audit*
*Standard depth analysis (3 agents)*
*For expanded analysis including social media, reviews, and citations, run with `--full-presence` flag*
