# Semrush Competitive Intelligence Research Report

**Date**: 2026-03-01
**Target Domain**: fbardirect.com
**Objective**: Automate competitor content analysis and keyword gap identification via Semrush API

---

## Executive Summary

Semrush provides a comprehensive API for programmatic competitor analysis covering organic keywords, keyword gaps, backlinks, and position tracking. However, **API access requires the Business plan ($499.95/month)** -- the Pro and Guru plans do not include raw API access. There is an alternative path: Semrush's official MCP (Model Context Protocol) server, which uses OAuth 2.1 authentication and may work with any paid subscription. For a cost-effective automated pipeline, I recommend a hybrid approach: the Semrush MCP for AI-assisted analysis plus direct sitemap/RSS monitoring for content detection.

---

## Table of Contents

1. [Critical Prerequisite: Plan Level](#1-critical-prerequisite-plan-level)
2. [Semrush Organic Research API](#2-semrush-organic-research-api)
3. [Semrush Keyword Gap API](#3-semrush-keyword-gap-api)
4. [Semrush Backlink Gap API](#4-semrush-backlink-gap-api)
5. [Semrush Position Tracking API](#5-semrush-position-tracking-api)
6. [Content Gap Analysis](#6-content-gap-analysis)
7. [API Specifics Reference](#7-api-specifics-reference)
8. [Automated Pipeline Design](#8-automated-pipeline-design)
9. [Beyond Semrush: Content Reverse-Engineering](#9-beyond-semrush-content-reverse-engineering)
10. [Competitor Target List](#10-competitor-target-list)
11. [Recommendations](#11-recommendations)

---

## 1. Critical Prerequisite: Plan Level

### Raw API Access
- **Required**: Business plan ($499.95/month) or Enterprise (custom)
- **NOT available**: Pro ($139.95/mo) or Guru ($249.95/mo)
- API units are purchased separately (not included in plan)
- Price: **$1 per 20,000 API units** ($0.00005 per unit)
- API key found at: Subscription Info > API Units

### Official Semrush MCP Server (Alternative Path)
- **URL**: `https://mcp.semrush.com/v1/mcp`
- Uses OAuth 2.1 authentication (logs in via your Semrush account)
- Semrush states MCP access is "included with an API subscription"
- **May require Business plan** -- but worth testing with your current subscription
- Works with Claude Desktop, Claude Code, Cursor, VS Code, ChatGPT, Gemini

### Community MCP Server (Wraps Raw API)
- GitHub: `mrkooblu/semrush-mcp`
- Requires `SEMRUSH_API_KEY` environment variable (Business plan required)
- 19 tools available (see Section 7 for full list)

**ACTION ITEM**: Check your current Semrush plan level. If you have Pro or Guru, test the official MCP server first -- it may provide enough capability without upgrading to Business.

---

## 2. Semrush Organic Research API

### Can We Pull Competitor Keywords? YES

**Endpoint**: `GET https://api.semrush.com/`
**Report Type**: `domain_organic`

```
GET https://api.semrush.com/?type=domain_organic&key={API_KEY}&domain=greenbacktaxservices.com&database=us&display_limit=1000&export_columns=Ph,Po,Nq,Cp,Co,Tr,Tc,Kd,Ur
```

**Export Columns Available**:
| Code | Meaning |
|------|---------|
| Ph | Keyword phrase |
| Po | Position in SERP |
| Pp | Previous position |
| Pd | Position difference |
| Nq | Search volume (monthly) |
| Cp | CPC (cost per click) |
| Co | Competition density (0-1) |
| Tr | Traffic estimate (%) |
| Tc | Traffic cost estimate |
| Kd | Keyword difficulty (0-100) |
| Nr | Number of results |
| Td | Trend data |
| Ur | URL ranking for the keyword |
| In | Keyword intent |
| Fp | SERP feature presence count |
| Fk | SERP feature total occurrences |

**Cost**: 10 API units per line (live), 50 per line (historical)
**Limit**: Up to 100,000 rows per request

### Which Pages Drive Most Traffic? YES

Use `export_columns=Ur,Ph,Tr,Tc,Po` and sort by traffic (Tr).
The `Ur` column returns the specific URL ranking, so you can aggregate traffic by page.

### Content Topics They Cover That We Don't? YES (via Keyword Gap)

See Section 3 -- the `domain_domains` endpoint compares up to 5 domains.

### New Pages/Content Recently Published? PARTIALLY

The API does not have a "new pages" filter. However:
- Compare current `domain_organic` results against a cached previous snapshot
- New URLs appearing in the `Ur` column = newly ranking content
- Combine with sitemap monitoring (Section 9) for definitive new-content detection

### Top-Performing Blog Posts? YES

Pull `domain_organic` with high `display_limit`, export `Ur,Tr,Tc` columns, aggregate traffic by URL.
Filter with: `display_filter=+|Tr|Gt|0.1` (only keywords driving meaningful traffic)

---

## 3. Semrush Keyword Gap API

### Available via API? YES

**Endpoint**: `GET https://api.semrush.com/`
**Report Type**: `domain_domains`

This is Semrush's "Domain vs. Domain" comparison tool exposed via API.

```
GET https://api.semrush.com/?type=domain_domains&key={API_KEY}&domains=*|or|greenbacktaxservices.com|+|or|taxesforexpats.com|-|or|fbardirect.com&database=us&display_limit=500&export_columns=Ph,Nq,Kd,Co,Cp&display_filter=+|Nq|Gt|100|+|Kd|Lt|70
```

### Domain Parameter Syntax

The `domains` parameter uses a special notation:
- `*|or|domain.com` = All keywords for this domain (seed)
- `+|or|domain.com` = Intersection -- add keywords this domain also ranks for
- `-|or|domain.com` = Exclusion -- remove keywords this domain ranks for

**To find keywords competitors rank for but fbardirect.com does NOT**:
```
domains=*|or|greenbacktaxservices.com|+|or|taxesforexpats.com|-|or|fbardirect.com
```

This returns keywords that BOTH greenbacktaxservices.com AND taxesforexpats.com rank for, but fbardirect.com does NOT.

### Filtering

Use `display_filter` to focus on actionable keywords:
- `+|Nq|Gt|100` = Search volume > 100
- `+|Kd|Lt|60` = Keyword difficulty < 60
- `+|Co|Lt|0.6` = Low-to-moderate competition

**Filter Syntax**: `<sign>|<field>|<operation>|<value>`
- Signs: `+` (include matching), `-` (exclude matching)
- Operations (numeric): `Eq`, `Gt`, `Lt`
- Operations (text): `Bw` (begins with), `Ew` (ends with), `Co` (contains), `Eq`
- Max 25 filter parameters per request

**Cost**: 10 API units per line (live)

---

## 4. Semrush Backlink Gap API

### Direct "Gap" Endpoint? NO -- But Achievable Programmatically

Semrush does NOT expose a direct "Backlink Gap" API endpoint. The Backlink Gap tool is UI-only. However, you can build gap analysis by pulling referring domains for each competitor and computing the difference.

### Backlink Endpoints Available

**Base URL**: `GET https://api.semrush.com/analytics/v1/`

**Report Types**:

| Type | Description |
|------|-------------|
| `backlinks_overview` | Summary: total backlinks, referring domains, IP count, authority scores |
| `backlinks` | Individual backlink records with source URL, anchor text, dates |
| `backlinks_refdomains` | List of referring domains with metrics |
| `backlinks_refips` | Referring IP addresses |
| `backlinks_anchors` | Anchor text distribution |
| `backlinks_pages` | Pages with most backlinks |
| `backlinks_competitors` | Domains with similar backlink profiles |

**Example -- Get Referring Domains for a Competitor**:
```
GET https://api.semrush.com/analytics/v1/?key={API_KEY}&type=backlinks_refdomains&target=greenbacktaxservices.com&target_type=root_domain&display_limit=500&export_columns=domain_ascore,domain,backlinks_num,first_seen,last_seen
```

**Programmatic Gap Analysis Algorithm**:
```javascript
// 1. Pull referring domains for each competitor
const competitorRefDomains = {};
for (const comp of competitors) {
  competitorRefDomains[comp] = await getRefDomains(comp);
}

// 2. Pull referring domains for fbardirect.com
const ourRefDomains = new Set(await getRefDomains('fbardirect.com'));

// 3. Find domains that link to competitors but NOT to us
const gapDomains = [];
for (const [comp, domains] of Object.entries(competitorRefDomains)) {
  for (const domain of domains) {
    if (!ourRefDomains.has(domain.domain)) {
      gapDomains.push({ ...domain, linksTo: comp });
    }
  }
}

// 4. Sort by authority score, deduplicate
```

**Cost**: Backlink reports have separate pricing (varies by report type, typically 10-50 units/line)

---

## 5. Semrush Position Tracking API

### Can We Track Rankings vs Competitors? YES

**Base URL**: `GET https://api.semrush.com/reports/v1/projects/{campaignID}/tracking/`

Position Tracking requires a **Project** (created via Projects API), containing a **Campaign** with tracked keywords and competitors.

### Setup Flow

**Step 1: Create a Project**
```
POST https://api.semrush.com/management/v1/projects
```

**Step 2: Create a Position Tracking Campaign**
```
POST https://api.semrush.com/reports/v1/projects/{projectID}/tracking/campaigns
```
- Add target domain: fbardirect.com
- Add competitors (up to 20 per campaign)
- Add keywords to track
- Set location, device type, search engine

**Step 3: Get Tracking Data**
```
GET https://api.semrush.com/reports/v1/projects/{campaignID}/tracking/?action=report&type=tracking_position_organic&key={API_KEY}
```

**Optional URL parameter**: `url={domain1}:{domain2}` to compare specific competitors

### Key Capabilities
- Daily position updates for all tracked keywords
- Compare positions across up to 20 competitor domains
- Track position changes over time
- Supports Google, Bing, and even ChatGPT search engines
- Device-specific tracking (desktop, mobile, tablet)
- Location-specific tracking (country, state, city)

### Keywords to Track for FBAR/Expat Tax Niche

Priority keywords to monitor (based on likely high-value terms):
```
fbar filing, fbar form, fbar deadline, fbar penalty,
fbar online filing, file fbar online, fbar e-filing,
foreign bank account report, report foreign bank accounts,
expat tax filing, us expat taxes, expat tax services,
fbar requirements, who needs to file fbar,
fbar vs fatca, fbar threshold, fbar filing fee,
fbar software, automated fbar filing
```

---

## 6. Content Gap Analysis

### Programmatic Content Scraping? Semrush API + External Tools

Semrush API does not directly provide blog post titles, word counts, or publish dates. You need a hybrid approach:

**From Semrush API**:
- Which competitor URLs rank and for what keywords (`domain_organic` with `Ur` column)
- Traffic estimates per URL
- Keyword difficulty for topics they target

**From Direct Scraping** (Node.js):
- Blog post titles, headings (H1/H2/H3), word counts
- Schema markup (JSON-LD extraction)
- Publish dates (from meta tags, schema, or sitemap lastmod)
- Internal linking structure

**Content Topic Identification**:
1. Pull all organic keywords per competitor via `domain_organic`
2. Group keywords by ranking URL
3. Extract primary topic per URL (use Claude to classify)
4. Compare topic coverage across competitors vs. fbardirect.com
5. Identify gaps = topics competitors cover but we don't

---

## 7. API Specifics Reference

### All Analytics Endpoints

| Report Type | Endpoint | Parameters | Cost (units/line) |
|-------------|----------|------------|-------------------|
| `domain_organic` | api.semrush.com | domain, database, display_limit, display_filter, export_columns | 10 (live) / 50 (historical) |
| `domain_adwords` | api.semrush.com | domain, database, display_limit, export_columns | 10 / 50 |
| `domain_rank` | api.semrush.com | domain, database | 10 / 50 |
| `domain_rank_history` | api.semrush.com | domain, database | 10 / 50 |
| `domain_organic_organic` | api.semrush.com | domain, database | 10 / 50 |
| `domain_adwords_adwords` | api.semrush.com | domain, database | 10 / 50 |
| `domain_domains` | api.semrush.com | domains (special syntax), database | 10 / 50 |
| `phrase_this` | api.semrush.com | phrase, database | 10 / 50 |
| `phrase_related` | api.semrush.com | phrase, database | 10 / 50 |
| `phrase_organic` | api.semrush.com | phrase, database | 10 / 50 |
| `phrase_questions` | api.semrush.com | phrase, database | 10 / 50 |

### Backlink Endpoints

| Report Type | Endpoint | Parameters | Cost |
|-------------|----------|------------|------|
| `backlinks_overview` | api.semrush.com/analytics/v1/ | target, target_type, export_columns | Varies |
| `backlinks` | api.semrush.com/analytics/v1/ | target, target_type, display_limit | Varies |
| `backlinks_refdomains` | api.semrush.com/analytics/v1/ | target, target_type, display_limit | Varies |
| `backlinks_refips` | api.semrush.com/analytics/v1/ | target, target_type | Varies |
| `backlinks_anchors` | api.semrush.com/analytics/v1/ | target, target_type | Varies |
| `backlinks_pages` | api.semrush.com/analytics/v1/ | target, target_type | Varies |
| `backlinks_competitors` | api.semrush.com/analytics/v1/ | target, target_type | Varies |

### Common Parameters

| Parameter | Description |
|-----------|-------------|
| `key` | API key (from Subscription Info > API Units) |
| `domain` | Target domain to analyze |
| `database` | Regional database (us, uk, ca, au, etc.) |
| `display_limit` | Max rows returned (default 10,000, max 100,000) |
| `display_offset` | Skip N rows (for pagination) |
| `display_filter` | Filter syntax: `+\|field\|op\|value` |
| `export_columns` | Comma-separated column codes |
| `display_date` | Historical date (YYYYMM15 format) |
| `display_sort` | Sort column and direction |

### Rate Limits
- Max **10 requests per second**
- Max **10 simultaneous connections**
- Response format: **CSV** (not JSON)

### Community Semrush MCP Server Tools (19 tools)

| Tool | Description |
|------|-------------|
| `semrush_domain_overview` | Domain overview analytics |
| `semrush_domain_organic_keywords` | Organic keywords for domain |
| `semrush_domain_paid_keywords` | Paid keywords for domain |
| `semrush_competitors` | Organic search competitors |
| `semrush_backlinks` | Backlinks for domain/URL |
| `semrush_backlinks_domains` | Referring domains |
| `semrush_keyword_overview` | Keyword overview data |
| `semrush_related_keywords` | Related keywords |
| `semrush_keyword_overview_single_db` | Detailed keyword data (single DB) |
| `semrush_batch_keyword_overview` | Analyze up to 100 keywords at once |
| `semrush_keyword_organic_results` | Domains ranking organically |
| `semrush_keyword_paid_results` | Domains in paid results |
| `semrush_keyword_ads_history` | 12-month ad bidding history |
| `semrush_broad_match_keywords` | Broad match / alternate queries |
| `semrush_phrase_questions` | Question-based keywords |
| `semrush_keyword_difficulty` | Difficulty index for keywords |
| `semrush_traffic_summary` | Traffic summary (Trends API) |
| `semrush_traffic_sources` | Traffic sources breakdown |
| `semrush_api_units_balance` | Check remaining API units |

---

## 8. Automated Pipeline Design

### Weekly Competitive Intelligence Pipeline (Node.js)

```
fbar-automator/
  scripts/
    competitive-intel/
      index.ts                  # Main orchestrator (weekly cron)
      semrush-client.ts         # Semrush API wrapper
      sitemap-monitor.ts        # Competitor sitemap checker
      rss-monitor.ts            # Competitor RSS feed checker
      content-analyzer.ts       # Page scraping (headings, word count, schema)
      keyword-gap.ts            # Keyword gap computation
      backlink-gap.ts           # Backlink gap computation
      report-generator.ts       # Weekly report compiler
      data/
        snapshots/              # Historical data snapshots (JSON)
        reports/                # Generated weekly reports
```

### Pipeline Steps (Weekly Run)

```
1. SITEMAP MONITOR (no API units)
   For each competitor:
   a. Fetch /sitemap.xml (or /sitemap_index.xml)
   b. Parse all URLs with <lastmod> dates
   c. Compare against previous snapshot
   d. Flag new URLs published since last check

2. ORGANIC KEYWORD PULL (Semrush API)
   For each competitor:
   a. GET domain_organic with Ph,Po,Nq,Kd,Tr,Ur columns
   b. Store snapshot with timestamp
   c. Compare against previous snapshot:
      - New keywords appearing = new content ranking
      - Position changes = content gaining/losing traction

3. KEYWORD GAP ANALYSIS (Semrush API)
   a. GET domain_domains comparing all competitors vs fbardirect.com
   b. Filter: Nq > 50, Kd < 70
   c. Group gap keywords by topic/intent
   d. Prioritize by: search volume * (1 - difficulty/100)

4. BACKLINK MONITORING (Semrush API)
   For each competitor:
   a. GET backlinks_overview for authority score trend
   b. GET backlinks_refdomains (top 100)
   c. Compare against our refdomains to find gap
   d. Flag high-authority domains linking to competitors not us

5. CONTENT ANALYSIS (Direct Scraping - no API units)
   For new URLs found in step 1:
   a. Fetch page with puppeteer/playwright
   b. Extract: title, H1-H3 headings, word count, schema markup
   c. Extract: internal links, external links
   d. Classify topic using Claude

6. POSITION TRACKING CHECK (Semrush API)
   a. Query position tracking campaign data
   b. Identify keywords where competitors gained positions
   c. Flag keywords where a competitor entered top 10

7. REPORT GENERATION
   a. Compile all findings into structured report
   b. Prioritize content opportunities:
      - High volume + low difficulty keywords we don't rank for
      - Topics competitors just published on (first-mover watch)
      - Backlink opportunities from authoritative domains
   c. Output: JSON data + readable report
   d. Optionally email summary via Resend
```

### Estimated Weekly API Unit Cost

| Step | Competitors | Rows/Competitor | Units/Row | Total Units | Cost |
|------|-------------|-----------------|-----------|-------------|------|
| Organic Keywords | 7 | 1,000 | 10 | 70,000 | $3.50 |
| Keyword Gap | 1 query | 500 | 10 | 5,000 | $0.25 |
| Backlinks Overview | 7 | 1 | 10 | 70 | ~$0 |
| Backlinks RefDomains | 7 | 100 | 10 | 7,000 | $0.35 |
| Position Tracking | 1 | 200 | 10 | 2,000 | $0.10 |
| **TOTAL PER WEEK** | | | | **~84,070** | **~$4.20** |
| **TOTAL PER MONTH** | | | | **~336,000** | **~$17** |

This is very affordable. Even with more aggressive limits, you would stay under $50/month in API units.

### Cron Schedule

```javascript
// Run every Monday at 6 AM EST
// 0 6 * * 1
const cron = require('node-cron');
cron.schedule('0 6 * * 1', async () => {
  await runCompetitiveIntelPipeline();
});
```

### Example: Semrush API Client (Node.js)

```typescript
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

interface SemrushConfig {
  apiKey: string;
  database?: string;
}

class SemrushClient {
  private apiKey: string;
  private database: string;
  private baseUrl = 'https://api.semrush.com/';
  private backlinkUrl = 'https://api.semrush.com/analytics/v1/';

  constructor(config: SemrushConfig) {
    this.apiKey = config.apiKey;
    this.database = config.database || 'us';
  }

  // Get organic keywords for a domain
  async getOrganicKeywords(domain: string, limit = 1000): Promise<any[]> {
    const params = new URLSearchParams({
      type: 'domain_organic',
      key: this.apiKey,
      domain,
      database: this.database,
      display_limit: String(limit),
      export_columns: 'Ph,Po,Nq,Cp,Co,Tr,Tc,Kd,Ur,In',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    const csv = await response.text();
    return this.parseCSV(csv);
  }

  // Keyword gap: keywords competitors have but we don't
  async getKeywordGap(
    competitors: string[],
    ourDomain: string,
    options: { minVolume?: number; maxDifficulty?: number; limit?: number } = {}
  ): Promise<any[]> {
    const { minVolume = 50, maxDifficulty = 70, limit = 500 } = options;

    // Build domains parameter
    // First competitor is the seed (*), rest are intersections (+), our domain excluded (-)
    let domainsParam = `*|or|${competitors[0]}`;
    for (let i = 1; i < competitors.length; i++) {
      domainsParam += `|+|or|${competitors[i]}`;
    }
    domainsParam += `|-|or|${ourDomain}`;

    const filters = [
      `+|Nq|Gt|${minVolume}`,
      `+|Kd|Lt|${maxDifficulty}`,
    ].join('|');

    const params = new URLSearchParams({
      type: 'domain_domains',
      key: this.apiKey,
      domains: domainsParam,
      database: this.database,
      display_limit: String(limit),
      export_columns: 'Ph,Nq,Kd,Co,Cp',
      display_filter: filters,
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    const csv = await response.text();
    return this.parseCSV(csv);
  }

  // Get referring domains for backlink gap analysis
  async getReferringDomains(target: string, limit = 500): Promise<any[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      type: 'backlinks_refdomains',
      target,
      target_type: 'root_domain',
      display_limit: String(limit),
      export_columns: 'domain_ascore,domain,backlinks_num,first_seen,last_seen',
    });

    const response = await fetch(`${this.backlinkUrl}?${params}`);
    const csv = await response.text();
    return this.parseCSV(csv);
  }

  // Get backlinks overview (authority score, total backlinks, etc.)
  async getBacklinksOverview(target: string): Promise<any> {
    const params = new URLSearchParams({
      key: this.apiKey,
      type: 'backlinks_overview',
      target,
      target_type: 'root_domain',
      export_columns: 'total,domains_num,urls_num,ips_num,score,trust_score',
    });

    const response = await fetch(`${this.backlinkUrl}?${params}`);
    const csv = await response.text();
    const rows = this.parseCSV(csv);
    return rows[0] || null;
  }

  // Get organic competitors
  async getOrganicCompetitors(domain: string, limit = 20): Promise<any[]> {
    const params = new URLSearchParams({
      type: 'domain_organic_organic',
      key: this.apiKey,
      domain,
      database: this.database,
      display_limit: String(limit),
      export_columns: 'Dn,Np,Or,Ot,Oc,Ad',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    const csv = await response.text();
    return this.parseCSV(csv);
  }

  // Check API units balance
  async getBalance(): Promise<number> {
    const params = new URLSearchParams({
      type: 'api_units',
      key: this.apiKey,
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    const text = await response.text();
    return parseInt(text.trim(), 10);
  }

  private parseCSV(csv: string): any[] {
    if (!csv || csv.startsWith('ERROR')) {
      throw new Error(`Semrush API error: ${csv}`);
    }
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(';');
    return lines.slice(1).map(line => {
      const values = line.split(';');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i]; });
      return row;
    });
  }
}
```

### Example: Sitemap Monitor (Node.js)

```typescript
import Sitemapper from 'sitemapper';
import fs from 'fs/promises';
import path from 'path';

interface SitemapSnapshot {
  domain: string;
  timestamp: string;
  urls: string[];
}

async function checkCompetitorSitemap(domain: string, snapshotDir: string) {
  const sitemap = new Sitemapper({
    url: `https://${domain}/sitemap.xml`,
    timeout: 15000,
  });

  const { sites: currentUrls } = await sitemap.fetch();

  // Load previous snapshot
  const snapshotFile = path.join(snapshotDir, `${domain}.json`);
  let previousUrls: string[] = [];

  try {
    const data = await fs.readFile(snapshotFile, 'utf-8');
    const snapshot: SitemapSnapshot = JSON.parse(data);
    previousUrls = snapshot.urls;
  } catch {
    // First run -- no previous snapshot
  }

  // Find new URLs
  const previousSet = new Set(previousUrls);
  const newUrls = currentUrls.filter(url => !previousSet.has(url));

  // Save current snapshot
  const snapshot: SitemapSnapshot = {
    domain,
    timestamp: new Date().toISOString(),
    urls: currentUrls,
  };
  await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

  return { domain, totalUrls: currentUrls.length, newUrls };
}
```

---

## 9. Beyond Semrush: Content Reverse-Engineering

### 9.1 Sitemap Monitoring

**Tool**: `sitemapper` npm package
**Approach**: Weekly fetch of each competitor's sitemap.xml, diff against stored snapshot
**Detects**: New blog posts, new landing pages, removed content
**Cost**: Free (direct HTTP requests)

Competitor sitemap URLs to monitor:
```
https://greenbacktaxservices.com/sitemap.xml
https://www.taxesforexpats.com/sitemap.xml
https://www.myexpattaxes.com/sitemap.xml
https://htj.tax/sitemap.xml
https://fbar.us/sitemap.xml
https://www.expattaxes.com/sitemap.xml
```

### 9.2 RSS Feed Monitoring

**Tool**: `rss-parser` npm package
**Approach**: Check RSS feeds for new entries

Known RSS feeds in the expat tax niche:
- Greenback: `https://www.greenbacktaxservices.com/blog/feed/` (likely WordPress)
- HTJ.tax: Likely has a blog RSS feed
- Most WordPress sites: append `/feed/` to blog URL

```typescript
import Parser from 'rss-parser';

const parser = new Parser();
const feeds = [
  'https://www.greenbacktaxservices.com/blog/feed/',
  'https://htj.tax/feed/',
  // Add others as discovered
];

for (const feedUrl of feeds) {
  try {
    const feed = await parser.parseURL(feedUrl);
    const recentPosts = feed.items.filter(item => {
      const pubDate = new Date(item.pubDate || '');
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return pubDate > weekAgo;
    });
    console.log(`${feedUrl}: ${recentPosts.length} new posts this week`);
  } catch (e) {
    console.log(`${feedUrl}: No RSS feed found`);
  }
}
```

### 9.3 Content Structure Analysis

**Tool**: Puppeteer or Playwright (headless browser)
**Extracts**:
- Page title and meta description
- H1, H2, H3 heading structure
- Word count (body text only)
- Schema markup (JSON-LD from `<script type="application/ld+json">`)
- Internal links (for link graph analysis)
- Images with alt text
- Publish date (from meta tags, schema, or visible text)

```typescript
import { chromium } from 'playwright';

async function analyzeCompetitorPage(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const analysis = await page.evaluate(() => {
    // Title
    const title = document.querySelector('title')?.textContent || '';

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // Headings
    const headings = {
      h1: [...document.querySelectorAll('h1')].map(h => h.textContent?.trim()),
      h2: [...document.querySelectorAll('h2')].map(h => h.textContent?.trim()),
      h3: [...document.querySelectorAll('h3')].map(h => h.textContent?.trim()),
    };

    // Word count (body text, excluding scripts/styles)
    const bodyText = document.body?.innerText || '';
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

    // Schema markup
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
      .filter(Boolean);

    // Internal links
    const currentDomain = window.location.hostname;
    const internalLinks = [...document.querySelectorAll('a[href]')]
      .map(a => a.getAttribute('href'))
      .filter(href => href && (href.startsWith('/') || href.includes(currentDomain)));

    return { title, metaDesc, headings, wordCount, schemas, internalLinkCount: internalLinks.length };
  });

  await browser.close();
  return { url, ...analysis };
}
```

### 9.4 Domain Authority Tracking

**Semrush**: `backlinks_overview` provides `score` (Authority Score, 0-100) and `trust_score`
**Schedule**: Monthly pull for each competitor to track authority trends
**Alternative**: Moz API or Ahrefs API if you have accounts

### 9.5 Internal Linking Strategy Analysis

Crawl competitor sites with a spider to build a link graph:
1. Start from sitemap URLs
2. For each page, extract all internal links
3. Build adjacency matrix
4. Identify hub pages (most linked-to)
5. Identify orphan pages
6. Analyze anchor text patterns

---

## 10. Competitor Target List

### Primary Competitors (Direct FBAR/Expat Tax Services)

| Domain | Type | Content Strategy | Priority |
|--------|------|-----------------|----------|
| greenbacktaxservices.com | Full-service expat tax firm | Heavy content marketing, blog, knowledge center | HIGH |
| taxesforexpats.com | Expat tax preparation | Blog, educational content | HIGH |
| myexpattaxes.com | DIY expat tax software | Blog, comparison content | HIGH |
| htj.tax | Tax advisory (Harrison Tax Jones) | Blog, podcasts, YouTube | MEDIUM |
| fbar.us | FBAR-focused filing service | Minimal content | MEDIUM |
| expattaxes.com | Expat tax services | Blog content | MEDIUM |

### Secondary Competitors (Overlap in FBAR/expat keywords)

| Domain | Type | Notes |
|--------|------|-------|
| hrblock.com/expat-tax-services | H&R Block expat division | Massive domain authority |
| turbotax.intuit.com | TurboTax (mentions FBAR) | Huge DA, general tax |
| irs.gov | IRS official guidance | Informational, not commercial |
| expatfile.tax | Expat tax filing | Newer competitor |
| brighttax.com | Expat tax services | Active blog |
| 1040abroad.com | Expat tax prep | Content marketing |

### Discovery Method
Use `domain_organic_organic` report on fbardirect.com to discover additional competitors Semrush identifies based on keyword overlap.

---

## 11. Recommendations

### Immediate Actions (This Week)

1. **Verify Semrush Plan Level**: Check if you have Business plan. If not:
   - Test the official MCP server (`https://mcp.semrush.com/v1/mcp`) with your current plan
   - If MCP works, use it for ad-hoc analysis immediately
   - If API access needed, evaluate cost-benefit of upgrading ($499.95/mo vs. manual analysis time)

2. **Set Up Sitemap Monitoring** (free, no API needed):
   - Fetch sitemaps for all 6+ competitors
   - Store initial snapshots
   - Schedule weekly checks

3. **Test RSS Feeds** (free):
   - Check each competitor's blog for RSS feed availability
   - Set up `rss-parser` monitoring for active feeds

### Short-Term (Next 2 Weeks)

4. **Build Semrush Client**: Implement the `SemrushClient` TypeScript class
5. **Initial Keyword Pull**: Get organic keywords for all competitors
6. **First Keyword Gap Analysis**: Run `domain_domains` to find immediate content opportunities
7. **Set Up Position Tracking Campaign**: Create project, add keywords, add competitors

### Medium-Term (Next Month)

8. **Automate Weekly Pipeline**: Full cron-based competitive intelligence system
9. **Content Analysis Scraper**: Build Playwright-based page analyzer
10. **Report Generator**: Weekly email digest of competitive intelligence

### Architecture Decision: Where to Run

**Option A: Within fbar-automator monorepo**
- Add `scripts/competitive-intel/` directory
- Run as a scheduled task on the Hetzner VPS
- Share database/config with existing D2C app

**Option B: Standalone cron job**
- Simple Node.js script
- Run via `node-cron` or OS cron
- Output JSON reports to a shared directory

**Recommendation**: Option A -- keep it in the monorepo. The competitive intel data can eventually feed into blog topic suggestions, SEO metadata optimization, and content planning directly.

### Budget Summary

| Item | Monthly Cost |
|------|-------------|
| Semrush Business Plan (if upgrade needed) | $499.95 |
| API Units (~336K/month) | ~$17 |
| Sitemap/RSS monitoring | Free |
| Content scraping (Hetzner VPS already running) | Free |
| **Total (if already on Business)** | **~$17/month** |
| **Total (if upgrade needed)** | **~$517/month** |

---

## Sources

- [Semrush API Developer Portal](https://developer.semrush.com/api/)
- [Semrush Domain Reports API](https://developer.semrush.com/api/v3/analytics/domain-reports/)
- [Semrush Keyword Reports API](https://developer.semrush.com/api/v3/analytics/keyword-reports/)
- [Semrush Backlinks API](https://developer.semrush.com/api/v3/analytics/backlinks/)
- [Semrush Position Tracking API](https://developer.semrush.com/api/v3/projects/position-tracking/)
- [Semrush Analytics API Tutorial](https://developer.semrush.com/api/basics/api-tutorials/analytics-api/)
- [Semrush API Introduction](https://developer.semrush.com/api/basics/introduction/)
- [Semrush API Units & Balance](https://developer.semrush.com/api/basics/api-units-balance/)
- [Semrush How to Get API](https://developer.semrush.com/api/basics/how-to-get-api/)
- [Semrush Keyword Gap Tool](https://www.semrush.com/features/domain-vs-domain/)
- [Semrush Backlink Gap Tool](https://www.semrush.com/features/backlink-gap/)
- [Semrush MCP Getting Started](https://www.semrush.com/kb/1619-getting-started-with-mcp)
- [Semrush MCP News Announcement](https://www.semrush.com/news/423229-new-mcp-server-bridges-data-and-ai-with-effortless-api-integration/)
- [Community Semrush MCP Server (GitHub)](https://github.com/mrkooblu/semrush-mcp)
- [Semrush Pricing](https://www.semrush.com/pricing/)
- [Semrush API Information (DataVirtuality)](https://docs.datavirtuality.com/connectors/semrush-api-information)
- [Sitemapper npm Package](https://github.com/seantomburke/sitemapper)
- [RSS Parser npm Package](https://www.npmjs.com/package/rss-parser)
- [RSS Feed Emitter (GitHub)](https://github.com/filipedeschamps/rss-feed-emitter)
- [Expat Tax RSS Feeds Directory](https://rss.feedspot.com/expat_tax_rss_feeds/)
