# Blog Pipeline Runbook — fbardirect.com

**For Claude Code sessions and the developer.** Single-source-of-truth for the D2C blog content pipeline, from topic selection through scoring, revision, and publishing.

---

## 1. Overview

The fbardirect.com blog publishes SEO-optimized FBAR (Foreign Bank Account Report) content targeting US persons with foreign financial accounts. Every article must score **>=9.0/10 in Semrush Writing Assistant (SWA)** before it is considered production-ready.

**Goals:**
- Publish high-quality, legally accurate FBAR content
- Achieve >=9.0 SWA score on every article (SEO, readability, tone, originality)
- Maintain a 50+ topic content queue with regular publishing cadence
- Track competitor content and fill coverage gaps

### Architecture

```
content-queue.json          scripts/
(50+ topics)                 validate-article.mjs
     |                       promote-article.mjs
     v                       score-via-swa.mjs
src/content/drafts/          scripts/competitor/
  <slug>.mdx                   monitor.mjs
  <slug>.validation.json       config.mjs
  <slug>.swa-score.json        snapshots/
     |
     v  (after validation passes)
src/content/blog/
  <slug>.mdx
     |
     v  (git push -> CI -> GHCR -> manual deploy)
fbardirect.com/blog/<slug>
     |
     v  (SWA scoring via Chrome DevTools MCP)
SWA Score >= 9.0 ?
  YES -> production-ready
  NO  -> revision loop (max 3 attempts)
```

### Pipeline Stages

```
Topic Selection -> Draft Writing -> Validation -> Promotion -> Deploy
      -> SWA Scoring -> Revision Loop (if <9.0) -> Final Publish
```

---

## 2. Topic Selection & Content Queue

### content-queue.json

Location: `d2c/src/content/content-queue.json`

This is the master topic list. Currently contains 50+ planned articles across 7 content pillars.

**Fields per topic:**

| Field | Type | Description |
|-------|------|-------------|
| `slug` | string | URL slug (e.g. `fbar-uk-bank-accounts`) |
| `keyword` | string | Target keyword for SWA scoring |
| `intent` | string | `informational` or `transactional` |
| `brief` | string | Content brief for the writer |
| `status` | string | `pending` or `published` |
| `pillar` | string | Content pillar category |
| `publishedDate` | string | ISO date for date-gating |
| `swaScore` | number | SWA overall score (added after scoring) |
| `swaScoredAt` | string | ISO timestamp of scoring |
| `source` | string | Optional. Origin of topic (e.g. `competitor:fbar.us`) |

**Content pillars:**

| Pillar | Description |
|--------|-------------|
| `fbar-requirements` | Who must file, thresholds, US person definition |
| `penalties-compliance` | Penalties, voluntary disclosure, reasonable cause |
| `account-types` | Crypto, trusts, pensions, life insurance, joint accounts |
| `country-specific` | UK, Canada, Australia, India, Israel, Germany, etc. |
| `exchange-rates-valuation` | Treasury rates, max value calculation, multi-currency |
| `deadlines-extensions` | Filing deadlines, automatic extension, late filing |
| `fbar-vs-others` | FBAR vs FATCA, Form 3520, Form 8865 |

**Status transitions:**

```
pending -> published (after SWA score >= 9.0 and article deployed)
```

### Adding New Topics

Sources for new topics:
- Competitor monitor reports (`claudedocs/competitor-reports/`)
- Semrush keyword research (Keyword Overview, Keyword Gap)
- User questions from the chat widget
- Content gap analysis

To add a topic, append to the `topics` array in `content-queue.json`:

```json
{
  "slug": "new-topic-slug",
  "keyword": "target keyword phrase",
  "intent": "informational",
  "brief": "Detailed content brief including statutes to cite, key points to cover...",
  "status": "pending",
  "pillar": "fbar-requirements",
  "publishedDate": "2026-XX-XX",
  "source": "competitor:fbar.us"
}
```

---

## 3. Article Writing Guidelines

Full rules are in `d2c/src/content/anti-slop-rules.json`. Key requirements:

**Structure:**
- Minimum 2,000 words (SWA may require more based on competitor analysis)
- Exactly 1 H1 heading
- Top disclaimer and bottom disclaimer required (exact text in anti-slop-rules.json)
- Minimum 2 CTA links to `/pricing`, `/signup`, `/how-it-works`, or `/threshold`
- Minimum 2 crosslinks to other blog articles (soft warning)
- Hero image in frontmatter + file in `public/`

**Citations:**
- >=2 authoritative citations per 500 words (irs.gov, fincen.gov, law.cornell.edu, treasury.gov, etc.)
- >=3 dollar amounts per 500 words for penalty/threshold content
- Penalty claims must cite statute (USC, CFR, IRC)
- Deadline claims must cite source (CFR, IRS Notice, Rev. Proc.)

**Banned phrases (AI slop):**
- "navigate the complex landscape", "it's important to note", "comprehensive guide"
- "let's dive in", "cutting-edge", "game-changer", "seamless", "robust"
- Full list: 35 phrases in anti-slop-rules.json

**Semrush SWA optimization (anti-slop-rules.json `semrushOptimization` section):**
- Target keyword in H1
- Add ALL SWA-recommended keywords (each missing keyword lowers SEO sub-score)
- Max 25 words per sentence (single biggest readability penalty)
- No passive voice ("penalties are assessed" -> "the IRS assesses penalties")
- Max 4 sentences per paragraph
- Replace complex words with simpler alternatives (list in rules file)
- Tone: "somewhat formal" -- professional but accessible, 95% consistency target
- Remove filler words: "basically", "actually", "just", "simply", "in order to"
- Avoid "it is" constructions
- Run Copyleaks originality check in SWA

**Frontmatter template:**

```yaml
---
title: "Article Title with Target Keyword"
description: "150-160 char meta description with keyword"
publishedDate: "2026-XX-XX"
author: "FBAR Direct Team"
heroImage: "/images/blog/slug-name.webp"
---
```

---

## 4. Pre-Deploy Validation

Run the validator against a draft before promoting:

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/validate-article.mjs <slug>
```

**Input:** `src/content/drafts/<slug>.mdx`
**Output:** `src/content/drafts/<slug>.validation.json`

**What it checks (hard fails):**

| Check | Requirement |
|-------|-------------|
| `disclaimer_top` | Top disclaimer text present in body |
| `disclaimer_bottom` | Bottom disclaimer text present in body |
| `frontmatter` | title, description, publishedDate, author, heroImage all present |
| `word_count` | >= 2,000 words |
| `h1_count` | Exactly 1 H1 heading |
| `cta_count` | >= 2 CTA links to fbardirect.com pages |
| `banned_phrases` | Zero banned phrases found |
| `citation_density` | >= 2 authoritative citations per 500 words |
| `dollar_density` | >= 3 dollar amounts per 500 words |
| `penalty_citations` | Every penalty claim cites a statute |
| `deadline_citations` | Every deadline claim cites a source |
| `hero_image` | Hero image file exists in `public/` |
| `published_date` | Valid future ISO date |

**Soft warnings (do not block promotion):**
- Average sentence length > 25 words
- Fewer than 2 crosslinks to other blog articles
- Word count > 3,500

The article must **PASS** (zero hard fails) before promotion.

---

## 5. Promotion & Deployment

### Promote to blog directory

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/promote-article.mjs <slug>
```

What this does:
1. Checks that `src/content/drafts/<slug>.validation.json` exists and shows PASS
2. Copies `src/content/drafts/<slug>.mdx` to `src/content/blog/<slug>.mdx`
3. Updates `content-queue.json`: sets topic status to `published`
4. Keeps the draft file as an archive

Use `--force` to overwrite if the article already exists in `content/blog/`.

### Deploy

```bash
# 1. Commit and push
git add src/content/blog/<slug>.mdx src/content/content-queue.json
git commit -m "feat(fbar-d2c): publish <slug>"
git push
```

CI/CD pipeline (automated):
1. **D2C FBAR CI** runs: lint, typecheck, test, build, E2E
2. On CI success, **D2C FBAR Build & Push** builds Docker image and pushes to `ghcr.io/themattcohen/fbar-d2c:latest`

Manual deploy on Hetzner (not automated):
```bash
ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'
```

### Date-gating

Articles with `publishedDate` in the future are deployed but **hidden from the blog index page**. They are accessible via direct URL (`https://fbardirect.com/blog/<slug>`), which is what SWA needs for scoring.

This means you can deploy an article, score it via SWA, revise it, and re-deploy -- all before it appears in the blog listing.

---

## 6. SWA Scoring (Chrome DevTools Automation)

This is the primary quality gate. SWA scores articles on 4 sub-categories (SEO, Readability, Tone of Voice, Originality) and produces an overall score out of 10.

### Prerequisites

- Chrome browser open with Semrush logged in (active subscription required)
- Chrome DevTools MCP connected to Claude Code
- Article deployed to `https://fbardirect.com/blog/<slug>` (even if date-gated)

### Quick Start

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c

# See which articles need scoring
node scripts/score-via-swa.mjs --list

# Get the step-by-step playbook for scoring an article
node scripts/score-via-swa.mjs --playbook --slug <slug> --keyword "<keyword>"
```

The `--list` command shows all published articles with their scoring status:

| Status | Meaning |
|--------|---------|
| NEEDS SCORING | No SWA score recorded yet |
| PASS | Score >= 9.0/10 |
| NEEDS REVISION (attempt N/3) | Score < 9.0, revision attempts remaining |
| MANUAL REVIEW (attempt 3/3) | 3 attempts exhausted without reaching 9.0 |

### Step-by-Step Chrome DevTools Flow

Execute these steps using Chrome DevTools MCP tools:

**Step 1.** Navigate to SWA checker:
```
navigate_page({ url: 'https://www.semrush.com/swa/checker' })
```

**Step 2.** Take snapshot to find the keyword input field:
```
take_snapshot()
```
Look for the keyword/keyphrase input field UID.

**Step 3.** Enter the target keyword (from content-queue.json):
```
fill({ uid: '<keyword_input_uid>', value: '<keyword>' })
```

**Step 4.** Find the "Import text from web" or "Import from URL" button:
```
take_snapshot()
```

**Step 5.** Click the import button:
```
click({ uid: '<import_button_uid>' })
```

**Step 6.** Enter the article URL in the URL input:
```
fill({ uid: '<url_input_uid>', value: 'https://fbardirect.com/blog/<slug>' })
```

**Step 7.** Click the submit/import button:
```
click({ uid: '<submit_uid>' })
```

**Step 8.** Wait for SWA to process:
```
wait_for({ text: '/10' })
```

**Step 9.** Take snapshot and extract scores:
```
take_snapshot()
```
Parse the Overall, Readability, SEO, Tone of Voice, and Originality scores.

**Step 10.** Save the score:
```bash
node scripts/score-via-swa.mjs --save \
  --slug <slug> --keyword "<keyword>" \
  --overall <X> --readability <X> --seo <X> --tone <X> --originality <X> \
  --recommendations "recommendation 1" --recommendations "recommendation 2"
```

### What --save Does

1. Writes score to `src/content/drafts/<slug>.swa-score.json`
2. If a previous score exists, archives it as `<slug>.swa-score.attempt-N.json`
3. Updates `content-queue.json` with `swaScore` and `swaScoredAt` fields
4. Increments the attempt counter
5. Prints PASS, NEEDS REVISION, or MANUAL REVIEW NEEDED

### Score Interpretation

| Overall Score | Result | Action |
|---------------|--------|--------|
| >= 9.0 | PASS | Article is production-ready. No further changes needed. |
| 8.0 - 8.9 | NEEDS REVISION | Extract SWA recommendations. Revise article. Re-score. |
| < 8.0 | SIGNIFICANT REVISION | May need structural changes, not just tweaks. |
| < 9.0 after 3 attempts | MANUAL REVIEW | Stays published but flagged. Developer reviews manually. |

---

## 7. Revision Loop

When SWA score is below 9.0:

### Step 1: Review Recommendations

Check the saved score file:
```
src/content/drafts/<slug>.swa-score.json
```

The `recommendations` array contains the specific SWA feedback.

### Step 2: Apply Fixes

Common SWA issues and their fixes:

| SWA Issue | Fix |
|-----------|-----|
| **Low SEO sub-score** | Add ALL SWA-recommended keywords. Each missing keyword drags the score down. Weave them into existing sentences or add new content sections. 1-2 uses per keyword max. |
| **Low Readability** | Split sentences over 25 words at conjunctions (and, but, or, which). Break paragraphs over 4 sentences. Replace complex words (see anti-slop-rules.json `avoidComplexWords`). Convert passive voice to active. |
| **Below target word count** | SWA calculates a word count target from top-10 competitor average. Meet or exceed it. |
| **Low Tone consistency** | Maintain "somewhat formal" throughout. Remove filler words (basically, actually, just, simply). Avoid "it is" constructions. Remove emotional appeals from instructional content. |
| **Low Originality** | Run the Copyleaks check in SWA. Paraphrase regulatory boilerplate that matches other FBAR articles. Add unique examples, case studies, specific dollar amounts. |
| **Missing keyword in H1** | Ensure the target keyword appears in the H1 heading. |
| **Missing alt text** | Add descriptive alt text to all images. |

### Step 3: Re-validate, Re-promote, Re-deploy, Re-score

```bash
# 1. Edit the draft in src/content/drafts/<slug>.mdx
# 2. Re-validate
node scripts/validate-article.mjs <slug>

# 3. Re-promote (overwrites the blog copy)
node scripts/promote-article.mjs <slug> --force

# 4. Commit and push
git add src/content/blog/<slug>.mdx
git commit -m "fix(fbar-d2c): revise <slug> for SWA scoring"
git push

# 5. Wait for CI/CD, then deploy
ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'

# 6. Re-score via Chrome DevTools (repeat Section 6 steps)
```

### Attempt Limits

- Maximum **3 scoring attempts** per article
- Each `--save` increments the attempt counter and archives the previous score
- If still < 9.0 after 3 attempts: article stays published but is flagged `MANUAL REVIEW`
- The developer should then review the article manually in Semrush SWA and determine whether the target keyword or article angle needs to change

---

## 8. Competitor Monitoring

### Weekly Routine

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/competitor/monitor.mjs
```

**Report saved to:** `claudedocs/competitor-reports/YYYY-MM-DD.md`

No browser required. The monitor fetches sitemaps and RSS feeds directly.

### Tracked Competitors

| Domain | Type |
|--------|------|
| fbar.us | Direct FBAR service |
| greenbacktaxservices.com | Expat tax + FBAR |
| taxesforexpats.com | Expat tax + FBAR |
| myexpattaxes.com | DIY expat tax |
| htj.tax | International tax |
| expatustax.com | Expat tax |
| 1040abroad.com | Expat tax |

Configuration: `d2c/scripts/competitor/config.mjs`

### What the Monitor Checks

1. **Sitemap changes**: Fetches each competitor's `sitemap.xml`, diffs against the previous snapshot stored in `scripts/competitor/snapshots/`
2. **RSS feed entries**: Fetches RSS feeds (where available) for new blog posts
3. **Coverage cross-reference**: Checks new competitor URLs against our `content-queue.json` to identify overlap and gaps

### Report Sections

- **Summary table**: New pages and blog posts per competitor
- **Detailed changes**: New URLs and RSS entries with links
- **Coverage check**: Whether we have matching content (published, pending, or not covered)
- **Recommended actions**: Review existing articles, write new ones, or monitor pending topics

### Acting on Reports

| Finding | Action |
|---------|--------|
| Competitor published on a topic we cover | Re-score our article. Check if we need updates or additional content. |
| Competitor published on a topic in our queue (pending) | Prioritize writing that article. |
| Competitor published on a topic we don't cover | Add to `content-queue.json` with `"source": "competitor:<domain>"`. |
| No changes detected | Continue with the current content plan. |

### Semrush Competitive Analysis (via Chrome DevTools)

For deeper competitive analysis, use Chrome DevTools MCP to interact with Semrush tools:

| Tool | URL | Use Case |
|------|-----|----------|
| Keyword Overview | `semrush.com/analytics/keywordoverview/` | Search volume, keyword difficulty, SERP features for a keyword |
| Keyword Gap | `semrush.com/analytics/keywordgap/` | Keywords competitors rank for that we don't |
| Organic Research | `semrush.com/analytics/organic/overview/` | Competitor's top pages by traffic |
| Position Tracking | `semrush.com/position-tracking/` | Track our rankings vs competitors over time |
| Backlink Analytics | `semrush.com/analytics/backlinks/` | Who links to competitors but not us |

---

## 9. Content Queue Management

### Checking Queue Status

```bash
# Quick status of all published articles and their SWA scores
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/score-via-swa.mjs --list
```

### Current Queue Stats

As of the initial pipeline setup, the queue contains:
- **8 published** articles (status: `published`)
- **42 pending** articles across all 7 pillars
- Publishing dates range from March 2026 through July 2026

### Adding Topics from Competitor Intelligence

```json
{
  "slug": "fbar-new-topic-from-competitor",
  "keyword": "target keyword",
  "intent": "informational",
  "brief": "Content brief with statutes to cite and key points...",
  "status": "pending",
  "pillar": "account-types",
  "publishedDate": "2026-XX-XX",
  "source": "competitor:greenbacktaxservices.com"
}
```

### File Locations

| File | Location |
|------|----------|
| Content queue | `d2c/src/content/content-queue.json` |
| Anti-slop rules | `d2c/src/content/anti-slop-rules.json` |
| Drafts | `d2c/src/content/drafts/<slug>.mdx` |
| Validation reports | `d2c/src/content/drafts/<slug>.validation.json` |
| SWA scores | `d2c/src/content/drafts/<slug>.swa-score.json` |
| Score archives | `d2c/src/content/drafts/<slug>.swa-score.attempt-N.json` |
| Published articles | `d2c/src/content/blog/<slug>.mdx` |
| Competitor snapshots | `d2c/scripts/competitor/snapshots/<domain>.json` |
| Competitor reports | `d2c/claudedocs/competitor-reports/YYYY-MM-DD.md` |

---

## 10. Troubleshooting

### SWA Scoring Issues

**SWA "Import from URL" not loading the article:**
- Verify the article is deployed and accessible: `curl -s -o /dev/null -w "%{http_code}" https://fbardirect.com/blog/<slug>`
- SWA cannot access localhost, private URLs, or auth-protected pages
- Date-gated articles ARE accessible by direct URL. Only the blog index hides them.

**SWA shows 0 or very low score immediately:**
- The article may be behind auth, returning a 404, or the page is rendering client-side content that the SWA crawler cannot see
- Our Next.js SSR should serve full content to crawlers. If in doubt, check with `curl https://fbardirect.com/blog/<slug>` and verify HTML contains the article text.

**SWA score differs from expectations:**
- SWA crawler may cache a previous version. Wait a few minutes after deploy and try again.
- The imported text may differ from what is visible in the browser if there are CSR-only components. Check the SWA editor to see what text was actually imported.

### Chrome DevTools MCP Issues

**MCP disconnected or not responding:**
- Restart the Chrome DevTools MCP server
- Ensure Chrome is running with remote debugging enabled
- Check that the Semrush session is still active (not logged out)

**Snapshot does not show expected elements:**
- The SWA page may still be loading. Use `wait_for()` before taking snapshots.
- Some elements may be in iframes. Take a verbose snapshot (`take_snapshot({ verbose: true })`) to see more detail.

### Validation Issues

**`validate-article.mjs` fails on `published_date`:**
- The validator requires a future date. Articles with a `publishedDate` that has already passed will fail.
- For articles past their publish date, the date must be updated to a future date in the draft, or you can bypass this by editing the draft's frontmatter.

**`promote-article.mjs` refuses to promote:**
- It requires a passing validation report. Run `validate-article.mjs` first.
- If the article already exists in `content/blog/`, use `--force`.

### Competitor Monitor Issues

**Sitemap fetch fails:**
- Some competitors may block automated requests or have changed their sitemap URL
- Check `scripts/competitor/config.mjs` for the correct sitemap URL
- If blocked, skip that competitor for this cycle

**RSS not available:**
- Only fbar.us, greenbacktaxservices.com, and taxesforexpats.com have RSS URLs configured
- Other competitors rely on sitemap monitoring only

### Deployment Issues

**CI fails after push:**
- Check GitHub Actions for the specific failure (lint, typecheck, test, build)
- MDX syntax errors are a common cause. Verify the article renders locally.

**Docker image not pulling on Hetzner:**
- Ensure CI passed and the Build & Push workflow completed successfully
- Check GHCR for the latest image: `docker pull ghcr.io/themattcohen/fbar-d2c:latest`
- Server has 1.9 GB RAM + 2 GB swap. Build one image at a time.

---

## 11. Quick Reference Card

```
VALIDATE:  node scripts/validate-article.mjs <slug>
PROMOTE:   node scripts/promote-article.mjs <slug> [--force]
SCORE:     node scripts/score-via-swa.mjs --playbook --slug <slug> --keyword "<kw>"
SAVE:      node scripts/score-via-swa.mjs --save --slug <slug> --keyword "<kw>" \
             --overall X --readability X --seo X --tone X --originality X \
             [--recommendations "rec 1" --recommendations "rec 2"]
LIST:      node scripts/score-via-swa.mjs --list
COMPETE:   node scripts/competitor/monitor.mjs
DEPLOY:    git push -> CI -> GHCR -> ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'
```

### Full Pipeline Sequence

```
1. Pick topic from content-queue.json (status: pending)
2. Write draft -> src/content/drafts/<slug>.mdx
3. VALIDATE: node scripts/validate-article.mjs <slug>
4. Fix any failures, re-validate until PASS
5. PROMOTE: node scripts/promote-article.mjs <slug>
6. git add + commit + push
7. Wait for CI + Build & Push to complete
8. DEPLOY: ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'
9. SCORE: Use Chrome DevTools MCP to score via SWA
10. SAVE: node scripts/score-via-swa.mjs --save ...
11. If score < 9.0: revise draft, repeat from step 3 (max 3 attempts)
12. If score >= 9.0: done. Article is production-ready.
```
