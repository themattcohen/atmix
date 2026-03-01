# Competitor Structured Data & AEO Audit — 2026-03-01

## Executive Summary

Audited 5 competitor/reference sites for structured data, AEO patterns, and E-E-A-T signals against fbardirect.com. Key finding: **fbardirect.com already leads the FBAR niche in schema diversity and FAQ coverage**, but has gaps in review/rating schema, author credibility markup, and some content patterns that competitors exploit.

---

## Comparison Matrix

| Feature | fbardirect.com | H&R Block | TurboTax | 1040 Abroad | Greenback Tax | FinCEN BSA |
|---------|---------------|-----------|----------|-------------|---------------|------------|
| **Organization** | Yes | Yes | No* | Yes | No | No |
| **WebApplication** | Yes | No | No | No | No | No |
| **Article** | Yes (compare pages) | Yes | No* | Yes | No | No |
| **FAQPage** | Yes (33 items) | Yes (6 items) | No | No | No | No |
| **BreadcrumbList** | Yes (all pages) | Yes | No* | Yes | No | No |
| **Product/Offer** | Yes (pricing) | No | No | No | No | No |
| **HowTo** | Yes (7 steps) | No | No | No | No | No |
| **AggregateRating** | **No** | **Yes (4.5/5, 206K reviews)** | No* | No | No | No |
| **Review (individual)** | **No** | **Yes (8 reviews in JSON-LD)** | No* | No | No | No |
| **Person (author)** | **No** | Yes (brand author) | **Yes (attorney + CPA reviewer)** | **Yes (EA + CPA authors)** | No | No |
| **WebPage** | No | Yes | No* | Yes | No | No |
| **WebSite** | No | Yes (w/ SearchAction) | No* | Yes | No | No |
| **ImageObject** | No | Yes | No* | Yes | No | No |
| **Country-specific pages** | Yes (10 countries) | Yes (Japan, Germany, France+) | No | No | No | No |
| **Total schema types** | **7** | **9** | **0*** | **7** | **0** | **0** |

*TurboTax renders client-side; schema was not extractable via fetch but WebFetch analysis found no JSON-LD. Their FBAR content relies on E-E-A-T signals (attorney author, CPA reviewer) rather than structured data.

---

## Detailed Site Analyses

### 1. BSA E-Filing (bsaefiling.fincen.gov)

**Structured Data**: None. Zero JSON-LD, no microdata, no RDFa.

**Content Structure**:
- H1: "BSA E-Filing System — Welcome to the BSA E-Filing System"
- No H2/H3 hierarchy visible
- No FAQ sections

**E-E-A-T Signals**: None explicit (government authority implied by .gov TLD)

**AEO Strategy**: None. Pure functional application portal, not content-optimized.

**Takeaway**: Not a content competitor. fbardirect.com's references to FinCEN.gov as an authority source are the right approach.

---

### 2. 1040 Abroad (1040abroad.com)

**Structured Data** (per FBAR article page):
- `Article` with headline, author, dates, word count, article section
- `WebPage` with name, description, dates
- `BreadcrumbList` (Home > Article Title)
- `WebSite` with organization details
- `Organization` with social profiles (Facebook, Twitter, LinkedIn)
- `Person` (author) with name, description, credentials
- `ImageObject` for featured image

**Content Structure**:
- H1: "FBAR: Requirements and How to File" / "FBAR Penalties for U.S. Expats: Real Risks and Solutions (2026)"
- Strong keyword-targeted H1s with year dating
- Blog-centric content hub with 10+ FBAR articles

**E-E-A-T Signals** (STRONG):
- **Olivier Wagner**: Enrolled Agent AND CPA (New Hampshire), runs 1040 Abroad practice
- **Kasia Strzelczyk, EA**: 8+ years expat tax experience, certified IRS enrolled agent
- Author credentials embedded in Person schema
- Professional specialization explicitly stated
- Multiple named authors across FBAR articles

**AEO Strategy**:
- Year-dated content titles ("2026 Guide") for freshness signals
- Topic clustering: 10+ FBAR articles covering sub-topics (penalties, documents, deadlines, FBAR vs FATCA, delinquent filing, maximum account value)
- Each article has unique meta description targeting specific long-tail queries
- No FAQPage schema despite having FAQ-worthy content (missed opportunity)

**Actionable Gap for fbardirect.com**:
- 1040 Abroad has **named credentialed authors** (EA + CPA) — fbardirect.com says "Built by a Licensed CPA" but doesn't name them in schema
- Their topic cluster approach (10+ separate FBAR articles) captures more long-tail keywords than fbardirect.com's single-page approach
- They year-date their titles ("2026 Guide") for freshness — fbardirect.com could do this on country pages

---

### 3. Greenback Tax Services (greenbacktaxservices.com)

**Structured Data**: None detected. No JSON-LD, no microdata, no RDFa on any FBAR page.

**Content Structure**:
- H1: "FBAR Filing Guide: Requirements & Deadlines for Expats"
- FAQ accordion component present (CSS-styled) but NO FAQPage schema
- Extensive FBAR content hub: knowledge center articles, service pages, blog posts

**Content Breadth** (9+ FBAR pages):
- /knowledge-center/fbar/ (main guide)
- /knowledge-center/fbar-vs-8938/ (comparison)
- /knowledge-center/fbar-penalties/
- /knowledge-center/fbar-form-fincen-114/
- /knowledge-center/fbar-forms-past-due/
- /services/filing-fbar-with-us-expat-taxes/ (service page, $125 flat rate)
- /blog/fbar-joint-account-non-us-citizen/
- /blog/things-to-know-fbar-businesses/
- Country-specific integration (not standalone FBAR country pages)

**E-E-A-T Signals**: Minimal visible. No author bios or credentials on FBAR pages.

**AEO Strategy**:
- Content breadth (9+ FBAR pages) but zero schema markup
- FAQ accordion exists visually but without FAQPage JSON-LD = missed rich result opportunity
- HubSpot-powered content management
- Professional services infrastructure (Gravity Forms, analytics)

**Pricing**: $125 for FBAR filing (up to 5 accounts) — higher than fbardirect.com's $59-79

**Actionable Gap for fbardirect.com**:
- Greenback has MORE separate FBAR topic pages but ZERO structured data
- fbardirect.com already wins on schema but could add **more topic-specific content pages** (delinquent filing, joint accounts, business FBAR) to capture Greenback's topic breadth
- Their FAQ accordion without schema is a common mistake — validates fbardirect.com's approach of pairing FAQ UI with FAQPage JSON-LD

---

### 4. TurboTax (turbotax.intuit.com)

**Structured Data**: None detected via WebFetch. Client-side React rendering may defer schema injection, but no JSON-LD was found in the initial HTML response.

**Content Structure**:
- H1: "FBAR Compliance: Reporting Your Foreign Bank Accounts"
- Extensive H2/H3 hierarchy (7 H2s, 7+ H3s)
- Table of Contents with expandable sections
- No FAQ section (uses inline Q&A-style H3s instead)

**H2 Structure** (excellent for featured snippets):
- What is a Report of Foreign Bank and Financial Accounts (FBAR)?
- Who must file an FBAR?
- Who's exempt from the FBAR filing requirements?
- How to file an FBAR for your foreign bank accounts (FinCEN Form 114)
- FBAR recordkeeping requirements
- Penalties for not filing an FBAR
- IRS Form 8938 and Schedule B

**E-E-A-T Signals** (VERY STRONG):
- **Author**: Rocky Mengle, Attorney
- **Reviewer**: "a TurboTax CPA"
- Updated for Tax Year 2025 (dated November 2025)
- "100% Accurate Calculations Guarantee"
- Intuit brand authority (Fortune 500 company)

**AEO Strategy**:
- Question-format H3 headings ("What is a U.S. person?", "What types of foreign financial accounts must be reported?") — these directly target PAA (People Also Ask) boxes
- Single comprehensive article rather than topic cluster
- No FAQPage schema despite Q&A content structure
- Relies on brand authority (Intuit/TurboTax domain) rather than technical SEO
- Key Takeaways section for AI summary extraction

**Actionable Gap for fbardirect.com**:
- TurboTax targets PAA boxes with question-format H3 subheadings — fbardirect.com should adopt this pattern
- "Key Takeaways" summary section is designed for AI/LLM extraction — fbardirect.com should add similar summary sections
- Author + Reviewer dual-attribution pattern is stronger than single author
- No FBAR filing service (just informational) — fbardirect.com's service+content combo is a competitive advantage

---

### 5. H&R Block (hrblock.com)

**Structured Data** (RICHEST among competitors):

**FBAR Guide Article Page** (`/resource-center/forms/fbar/...`):
- `Article` with headline, dates, word count (1562), article section, publisher
- `WebPage` with name, description, breadcrumb, ReadAction
- `BreadcrumbList` (Home > Article Title)
- `WebSite` with SearchAction (site search)
- `Organization` with logo, social profiles (Facebook, X, Instagram)
- `Person` (author — brand "H&R Block", not individual)
- `ImageObject` with dimensions and alt text

**FBAR Filing Service Page** (`/expat-tax-preparation/.../fbar-filing/`):
- `FAQPage` with **6 FAQ items** (Who has to file, file with taxes, how to file, deadline, frequency, penalties)
- `AggregateRating`: **4.53/5 from 206,789 reviews** (for "H&R Block - Free Online" product)
- `Review` schema: **8 individual reviews** with ratings, author names, dates
- FAQ accordion UI with matching FAQPage JSON-LD

**Content Structure**:
- Guide: H1 "The FBAR: When (and How) to Report Money in Foreign Bank Accounts"
  - 6 H2s covering what/who/when/how/penalties/related
  - Related articles section with internal links
- Service: H1 "Get the help you need with your FBAR filing"
  - Pricing tiers: $119 (file online), $239 (file with advisor)
  - Separate prices when bundled with taxes: $49/$99

**E-E-A-T Signals**:
- Brand authority (H&R Block — household name)
- Multiple named reviewers shown in testimonial section: Alison Watts, Kristi Heinz, Arkadiusz Malinowski, Ayesha Sultan, Jennifer Thompson
- Customer testimonials with star ratings
- Expat tax specialization subdomain
- Country-specific FBAR guides (Japan, Germany, France)

**AEO Strategy**:
- FAQPage schema on service page (not guide page — interesting choice)
- AggregateRating with 206K reviews = rich snippet star display potential
- Individual Review schema for social proof in SERPs
- Service page separates from informational content (different URL paths)
- Country-specific pages for geo-targeted FBAR queries

**Pricing Comparison**: $119-239 standalone, $49-99 bundled with tax return — significantly higher than fbardirect.com's $59-79

**Actionable Gap for fbardirect.com**:
- **AggregateRating schema is the #1 gap** — H&R Block's 206K reviews with 4.5 stars will dominate rich snippets. fbardirect.com needs to implement review collection + AggregateRating ASAP
- H&R Block has individual Review schema — fbardirect.com should add testimonials with Review markup
- Their FAQ schema is on the service page, not the guide — validates fbardirect.com's approach of having FAQPage on the homepage
- Country-specific pages are a shared strategy but H&R Block has more countries

---

## Schema Gap Analysis: fbardirect.com vs. Competitors

### What fbardirect.com HAS that competitors DON'T:
| Schema | fbardirect.com | Others |
|--------|---------------|--------|
| WebApplication | Yes | None |
| Product/Offer with pricing | Yes | None |
| HowTo (7 steps) | Yes | None |
| FAQPage (33 items) | Yes | H&R Block has 6 |
| Combined service+content schema | Yes | H&R Block splits across pages |

### What competitors HAVE that fbardirect.com DOESN'T:

| Gap | Who Has It | Priority | Impact |
|-----|-----------|----------|--------|
| **AggregateRating** | H&R Block (4.53/5, 206K) | **P0 — Critical** | Star ratings in SERPs = massive CTR boost |
| **Review (individual)** | H&R Block (8 reviews) | **P0 — Critical** | Social proof in rich snippets |
| **Person (named author)** | 1040 Abroad (EA, CPA), TurboTax (Attorney) | **P1 — High** | E-E-A-T for LLM citations |
| **WebPage** | H&R Block, 1040 Abroad | P2 — Medium | Richer page context for crawlers |
| **WebSite + SearchAction** | H&R Block | P3 — Low | Sitelinks search box potential |
| **ImageObject** | H&R Block, 1040 Abroad | P3 — Low | Image rich results |
| **Author + Reviewer dual attribution** | TurboTax (Author + CPA reviewer) | **P1 — High** | E-E-A-T trust signals |

---

## Content & AEO Pattern Gaps

### 1. Topic Cluster Depth
| Topic | fbardirect.com | 1040 Abroad | Greenback | H&R Block |
|-------|---------------|-------------|-----------|-----------|
| Main FBAR guide | Homepage | Blog post | Knowledge center | Resource center |
| FBAR penalties | FAQ items | Dedicated article | Dedicated article | Section in guide |
| FBAR vs FATCA | Comparison page | Dedicated article | Dedicated article | Dedicated article |
| Delinquent filing | FAQ items | Dedicated article | Dedicated article | Dedicated article |
| FBAR for businesses | No | No | Dedicated article | No |
| Joint accounts | No | No | Dedicated article | No |
| FBAR documents needed | No | Dedicated article | No | No |
| FBAR deadline/extension | No | Dedicated article | No | Dedicated article |
| Maximum account value | No | Dedicated article | No | No |
| Country-specific | 10 pages | No | No | 3+ pages |

**Recommendation**: Create 4-5 dedicated content pages for high-value sub-topics currently only in FAQ items (penalties, delinquent filing, deadlines, documents needed). Each page gets its own FAQPage schema + BreadcrumbList.

### 2. PAA (People Also Ask) Optimization
TurboTax's question-format H3 headings directly match PAA queries:
- "What is a U.S. person?"
- "What types of foreign financial accounts must be reported?"
- "How is the $10,000 threshold calculated?"
- "When is your FBAR due?"

**Recommendation**: Add question-format subheadings to existing content pages. These become PAA-eligible answer passages.

### 3. AI/LLM Citation Optimization
- TurboTax has "Key Takeaways" summary sections — designed for AI extraction
- 1040 Abroad has named, credentialed authors in Person schema — LLMs prefer citing named experts
- H&R Block has massive review count — signals trustworthiness to AI systems

**Recommendation**: Add "Key Takeaways" or "Summary" section to each content page. Add named author/CPA to Person schema. Begin collecting reviews.

### 4. Year-Dating Strategy
- 1040 Abroad: "FBAR Penalties for U.S. Expats: Real Risks and Solutions (2026)"
- TurboTax: "Updated for Tax Year 2025"

**Recommendation**: Add year to country-specific page titles and meta descriptions. Update annually for freshness signals.

---

## Priority Recommendations

### P0 — Critical (implement this week)
1. **Add AggregateRating schema** — Even with few reviews, having the schema ready is essential. Implement review collection (post-filing email flow) and add AggregateRating + Review JSON-LD to homepage and pricing page.
2. **Add named author Person schema** — Add the CPA's name and credentials to Article/WebPage schema on all content pages. Pattern: `"author": {"@type": "Person", "name": "...", "jobTitle": "CPA", "description": "Licensed CPA and FinCEN-registered BSA E-Filing preparer"}`

### P1 — High (implement this month)
3. **Add "Key Takeaways" sections** to homepage, how-it-works, pricing, and comparison pages for AI extraction optimization
4. **Year-date country page titles** — e.g., "FBAR Filing for U.S. Citizens in the UK (2026)"
5. **Add question-format H3 subheadings** to target PAA boxes (mirror TurboTax pattern)
6. **Add WebPage + WebSite schemas** to round out the schema graph

### P2 — Medium (implement next sprint)
7. **Create dedicated content pages** for:
   - /fbar-penalties (currently FAQ items)
   - /fbar-deadline-extension (no coverage)
   - /delinquent-fbar-filing (no coverage)
   - /fbar-documents-needed (no coverage)
   Each with own BreadcrumbList + FAQPage schema
8. **Add author + reviewer dual attribution** (Pattern: "Written by [CPA name], Reviewed by [EA/Attorney name]")

### P3 — Low (backlog)
9. Add SearchAction to WebSite schema (sitelinks search box)
10. Add ImageObject schema to pages with images
11. Expand country-specific pages beyond 10 countries (match H&R Block's coverage)

---

## Competitive Positioning Summary

**fbardirect.com's Schema Advantages:**
- Most diverse schema portfolio in the FBAR niche (7 types vs H&R Block's 9)
- Only site with WebApplication, Product/Offer, and HowTo schemas
- Largest FAQPage implementation (33 items vs H&R Block's 6)
- Only site combining service and content schema on same pages

**fbardirect.com's Schema Weaknesses:**
- No review/rating signals (H&R Block has 206K reviews)
- No named author credentials in schema (1040 Abroad and TurboTax both have credentialed professionals)
- No AI-summary-optimized content sections (TurboTax "Key Takeaways")
- Fewer dedicated content pages than 1040 Abroad and Greenback

**Overall Assessment**: fbardirect.com is well-positioned with the strongest technical schema implementation among FBAR-focused sites. The primary gaps are in social proof (reviews/ratings) and E-E-A-T personalization (named authors). Addressing P0 and P1 items would establish clear schema dominance in the niche.
