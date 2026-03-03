# Blog Pipeline Runbook — fbardirect.com

**For Claude Code sessions and the developer.** Single-source-of-truth for the D2C blog content pipeline, from topic selection through scoring, revision, and publishing.

---

## 1. Overview

The fbardirect.com blog publishes SEO-optimized FBAR (Foreign Bank Account Report) content targeting US persons with foreign financial accounts.

**Scoring Stack (priority order):**

| # | Scorer | Target | Role |
|---|--------|--------|------|
| 1 | **DIY scorer (`seo-scorer/`)** | **≥9.0** | Primary SEO quality gate. NLP targets extracted via `extract` command BEFORE writing. |
| 2 | `validate-article.mjs` | PASS (zero hard fails) | Hard gate: anti-slop, structure, citations, disclaimers. |
| 3 | `writer-guide.md` | Follow all rules | YMYL guardrails: legal accuracy, tone, banned phrases. |
| 4 | Semrush SWA | ≥9.0 (optional) | Optional secondary check via Chrome DevTools. |
| 5 | SurferSEO Content Score | ≥90 (legacy, optional) | SurferSEO subscription cancelled as of March 2026. DIY pipeline provides equivalent NLP coverage at $0/mo. |

**Goals:**
- Publish high-quality, legally accurate FBAR content
- Achieve ≥9.0 DIY SEO score on every article (primary SEO gate)
- Extract NLP targets via DIY `extract` command BEFORE writing (research-first pipeline)
- Maintain a 50+ topic content queue with regular publishing cadence
- Track competitor content and fill coverage gaps

### Architecture

```
content-queue.json          scripts/
(55+ topics)                 validate-article.mjs
     |                       promote-article.mjs
     v                       score-via-swa.mjs (optional)
src/content/drafts/          generate-hero-image.mjs
  <slug>.mdx                 scripts/seo-scorer/
  <slug>.validation.json       index.mjs (primary DIY scorer)
  <slug>.diy-surfer-targets.json   extract, score, revise, batch
  <slug>.diy-score.json      scripts/competitor/
     |                         monitor.mjs
     v  (after validation)     config.mjs
src/content/blog/              snapshots/
  <slug>.mdx
     |
     v  (git push -> CI -> GHCR -> manual deploy)
fbardirect.com/blog/<slug>
     |
     v  (DIY score >= 9.0?)
  YES -> production-ready
  NO  -> revision loop (score -> fix -> re-score)
```

### Pipeline Stages (Research-First)

```
Phase A. Keyword research (gap analysis + competitor monitor + Semrush)
Phase B. Extract NLP targets via DIY extract command -> save .diy-surfer-targets.json (GATE: must exist before writing)
Phase C. Write draft WITH NLP targets pre-loaded
   C1. Write draft -> src/content/drafts/<slug>.mdx
   C2. Validate (hero image = soft warning)
   C3. DIY score loop -> revise until >=9.0
   C4. Generate hero image
   C5. Re-validate (confirm image present)
Phase D. Promote -> blog/
Phase E. Deploy (git push -> CI -> GHCR -> manual deploy)
Phase F. Score verification
   F1. DIY score >=9.0: article is production-ready
   F2. [Optional] SWA score via Chrome DevTools
   F3. [Optional, legacy] SurferSEO Content Editor verification
```

---

## 1.5. Keyword Research & Selection

Before writing any article, validate the target keyword through a structured research process.

### Sources

| # | Source | Location | What It Provides |
|---|--------|----------|------------------|
| 1 | **Keyword Gap Analysis** | `claudedocs/d2c-keyword-gap-analysis-2026-03-01.md` | D1-D14 blog topics with demand signals from Semrush gap analysis |
| 2 | **Competitor Monitor** | `scripts/competitor/monitor.mjs` | Weekly sitemap/RSS diffs revealing new competitor topics |
| 3 | **Semrush** (via Chrome DevTools) | Keyword Overview, Keyword Gap | Volume, difficulty, SERP features, competitor rankings |
| 4 | **Serper PAA data** | Auto-fetched during DIY scoring | Real Google "People Also Ask" questions for content validation |

### Process

1. **Run competitor monitor weekly**
   ```bash
   cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
   node scripts/competitor/monitor.mjs
   ```
   Review the report at `claudedocs/competitor-reports/YYYY-MM-DD.md` for new competitor content.

2. **Cross-reference gaps against content-queue.json**
   Compare competitor topics, keyword gap analysis (D1-D14), and Semrush data against existing queue topics to find uncovered keywords.

3. **Validate keyword with Semrush Keyword Overview**
   - Monthly search volume ≥100
   - Keyword difficulty (KD) ≤60
   - Check SERP features (featured snippets, PAA boxes = opportunity)
   - Review top-10 competitor content for word count benchmarks

4. **Add to content-queue.json**
   ```json
   {
     "slug": "fbar-new-topic",
     "keyword": "validated target keyword",
     "intent": "informational",
     "brief": "Content brief with statutes, key points, audience...",
     "status": "pending",
     "pillar": "fbar-requirements",
     "publishedDate": "2026-XX-XX",
     "source": "gap-analysis:D5"
   }
   ```
   Include `source` to track origin: `gap-analysis:D#`, `competitor:<domain>`, `semrush:keyword-gap`, `serper:paa`.

### Keyword Validation Checklist

| Check | Requirement |
|-------|-------------|
| Search volume | ≥100 monthly searches |
| Keyword difficulty | ≤60 KD (Semrush scale) |
| Content-queue conflict | No existing topic with same keyword |
| FBAR relevance | Directly related to FBAR filing, compliance, or foreign accounts |
| Pillar fit | Maps to one of the 7 content pillars |

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
| `published_date` | Valid future ISO date |

**Soft warnings (do not block promotion):**
- `hero_image`: Hero image missing from frontmatter or file not found in `public/` (add before final promotion)
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

## 7b. DIY Score Pipeline (Primary Scorer)

The DIY SEO/AEO scorer (`scripts/seo-scorer/`) is the **primary scoring tool** for the blog pipeline. It replaces SurferSEO ($89/mo) with a $0/mo pipeline built on TF-IDF, NLP entity extraction, SERP scraping, and local scoring.

> **SurferSEO subscription cancelled as of March 2026.** The DIY pipeline provides equivalent NLP coverage. Legacy `.surfer-targets.json` files from previous SurferSEO extractions are still loaded (and take precedence when both exist), but all new articles use `.diy-surfer-targets.json` generated by the DIY `extract` command.

### Scoring Dimensions

The scorer evaluates 8 dimensions with configurable weights:

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| NLP Coverage | 22% | Term frequency vs competitor-derived targets (highest weight) |
| AEO Signals | 15% | Answer Engine Optimization (AI citation readiness) |
| LLM Quality | 15% | Claude-evaluated content quality (optional, costs money) |
| Structure | 12% | Heading hierarchy, links, word count, CTA |
| Readability | 10% | Flesch, ARI, sentence length |
| Keyword Coverage | 10% | Primary keyword placement and density |
| Schema Markup | 8% | FAQ schema, meta description, frontmatter |
| Writing Quality | 8% | Passive voice, weasel words, transitions |

**Pass threshold:** OVERALL >= 9.0/10

When run with `--no-llm` (recommended for fast iteration), LLM Quality is excluded and the remaining 7 dimensions have their weights redistributed proportionally. When run with `--no-serp`, SERP-dependent sub-criteria (PAA questions, related keywords) are excluded and their scores are scaled up so articles are not penalized.

### API Keys

Set these in `d2c/.env`. The scorer works at different capability levels depending on which keys are configured:

| Key | Required? | What It Enables | Free Tier |
|-----|-----------|----------------|-----------|
| `SERPER_API_KEY` | Recommended | SERP data, PAA questions, related keywords | 2,500 queries/mo at serper.dev |
| `ANTHROPIC_API_KEY` | Optional | LLM Quality dimension | Pay-per-use |
| `DATAFORSEO_LOGIN` / `_PASSWORD` | Optional | Keyword expansion for niche topics | Free trial at dataforseo.com |
| `GOOGLE_NLP_API_KEY` | Optional | Entity salience enrichment | 5,000 units/mo |
| `GSC_CLIENT_EMAIL` + `GSC_PRIVATE_KEY` | Optional | Google Search Console feedback loop | Free |

Without any API keys, you can still score articles using `--no-llm --no-serp`. NLP extraction (`extract`) requires at least `SERPER_API_KEY` to fetch SERP results.

### CLI Commands

All commands run from the `d2c/` directory:

```bash
node scripts/seo-scorer/index.mjs score <slug> [options]     # Score one article
node scripts/seo-scorer/index.mjs batch [options]             # Score all unscored published articles
node scripts/seo-scorer/index.mjs list                        # List articles and scoring status
node scripts/seo-scorer/index.mjs extract <keyword> [options] # Extract NLP targets from SERP competitors
node scripts/seo-scorer/index.mjs validate-nlp <slug>         # Compare DIY targets vs Surfer targets
node scripts/seo-scorer/index.mjs revise <slug>               # Generate prioritized revision checklist
node scripts/seo-scorer/index.mjs gsc <slug> [options]        # GSC feedback for one article
node scripts/seo-scorer/index.mjs gsc-batch [options]         # GSC feedback for all published articles
```

**SERP data is fetched by default** via Serper.dev. What it adds:
- **AEO dimension (+1.5 pts)**: Matches article Q&A headings against real Google "People Also Ask" questions for the target keyword
- **Keyword Coverage dimension (+1 pt)**: Checks article against Google's "related searches" for the target keyword

The `--no-serp` flag exists for CI/offline use but **should NOT be used for final scoring** — it skips PAA matching and related keyword checks, producing artificially lower scores.

### Quick Start

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c

# 1. Extract NLP targets for a new article
node scripts/seo-scorer/index.mjs extract "fbar your keyword" --slug fbar-your-slug

# 2. Write the article (see writer-guide.md)

# 3. Score the article
node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save

# 4. Get a prioritized revision checklist
node scripts/seo-scorer/index.mjs revise <slug>

# 5. Edit the article based on the checklist
#    (focus on highest-weighted-gap dimensions first)

# 6. Re-validate
node scripts/validate-article.mjs <slug>

# 7. Re-score
node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save

# 8. Repeat until >=9.0
```

For a full score with all dimensions (uses Serper API quota):
```bash
node scripts/seo-scorer/index.mjs score <slug> --save
```

### Batch Operations

```bash
# Score all published articles that don't have a DIY score yet
node scripts/seo-scorer/index.mjs batch --no-llm --no-serp --save

# Score a single article with report saved
node scripts/seo-scorer/index.mjs score fbar-your-slug --no-llm --no-serp --save

# List all articles and their scoring status
node scripts/seo-scorer/index.mjs list

# Extract NLP targets for a new keyword
node scripts/seo-scorer/index.mjs extract "fbar your keyword" --slug fbar-your-slug
# Output: src/content/drafts/fbar-your-slug.diy-surfer-targets.json

# Validate DIY targets against legacy Surfer targets
node scripts/seo-scorer/index.mjs validate-nlp fbar-your-slug

# GSC feedback (after articles have been live for 2-4 weeks)
node scripts/seo-scorer/index.mjs gsc fbar-your-slug --days 28 --save
node scripts/seo-scorer/index.mjs gsc-batch --days 28 --save
```

### What `--save` Does

1. Writes score to `src/content/blog/<slug>.diy-score.json` (or `drafts/`)
2. Archives any previous score as `<slug>.diy-score.attempt-N.json`
3. Updates `content-queue.json` with `diyScore` and `diyScoredAt` fields

### What `revise` Does

1. Reads the latest `.diy-score.json` for the article
2. Ranks dimensions by `(10 - score) * weight` (biggest weighted gap first)
3. Prints each dimension's issues as a numbered checklist
4. Shows estimated point gain per fix and the total points recoverable
5. Prints the workflow steps to follow

### Optimization Loop

```
Score -> Read issues -> Fix weakest weighted dimension -> Re-score -> Repeat
```

Typically takes 2-3 loops to reach 9.0. Save the final passing score with `--save`.

**Step-by-step:**

1. Run the scorer
2. Identify the biggest opportunity: calculate weighted gap `(10 - score) * weight` per dimension. Fix the highest gap first.
3. Or use the `revise` command for a prioritized checklist
4. Fix the top issues in the MDX file
5. Re-score. Repeat until >= 9.0.

### Common Bottlenecks and Fixes

| Issue | Fix |
|-------|-----|
| **Writing Quality vs NLP tension** | Some NLP terms force passive constructions. Restructure to active voice while keeping the term. NLP scorer counts occurrences anywhere in the article. |
| **Word count outside competitor range** | Check `targets.wordCount` in `.diy-surfer-targets.json`. If over: trim redundant examples, merge sections. If under: add examples, citations, comparison tables, expand FAQ. |
| **Flesch score below 50** | Replace jargon: "pursuant to" -> "under", "notwithstanding" -> "despite". Break compound sentences at conjunctions. |
| **AEO answer paragraphs failing** | Two common failures: paragraph too short/long (<30 or >100 words), or paragraph does not reference heading's topic words. Convert statement headings to questions. |
| **NLP high-priority terms below target** | Open `.diy-surfer-targets.json`, find terms with `targetMin` > current count. Add naturally throughout the article. |
| **Missing internal links** | Add links to related articles using `/blog/<slug>` format. Run `list` command to see all published articles. |
| **Missing authority links** | Add links to irs.gov, fincen.gov, law.cornell.edu (see Section 10 for common patterns). |

### Biggest Levers for Score Improvement

| Dimension | Weight | Common Fixes |
|-----------|--------|-------------|
| NLP Coverage | 22% | Hit high-priority NLP terms at their target frequencies |
| AEO Signals | 15% | Add Q&A headings ("What is...?", "How do I...?"), answer paragraphs, citations |
| LLM Quality | 15% | Improve accuracy, depth, actionability (skip with `--no-llm` for fast iteration) |
| Structure | 12% | Add H2/H3 headings, FAQ section, internal links, CTAs |
| Readability | 10% | Shorten sentences (<25 words), break long paragraphs, simplify vocabulary |
| Keyword Coverage | 10% | Add keyword to H1, H2, meta description, first 150 words |
| Schema Markup | 8% | Add FAQ schema, meta description 150-160 chars |
| Writing Quality | 8% | Reduce passive voice, add transitions, remove cliches |

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

As of March 2026:
- **55 total articles** in the content queue (19 waves 1-2, 36 waves 3-5)
- **19 published** articles (status: `published`, live since March 1-2)
- **36 pending** articles (written and scored, staggered `publishedDate` values)
- **54 articles score >=9.0 DIY**; 1 at 8.4 (`fbar-vs-form-8938-when-file-both`)
- Publishing schedule: Mon-Fri 5/week, March 9 through April 27, 2026

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

## 10.5. SurferSEO Content Editor Optimization (Legacy — Optional)

> **SurferSEO subscription cancelled as of March 2026.** This section is retained for reference only. The DIY scorer (Section 7b) is now the primary scoring tool. Use this workflow only if you reactivate SurferSEO.

After an article is deployed and accessible at `fbardirect.com/blog/<slug>`, you can optionally use SurferSEO Content Editor to optimize against SERP competitors.

### Prerequisites

- SurferSEO account logged in at https://app.surferseo.com
- Chrome DevTools MCP connected
- Article live at `fbardirect.com/blog/<slug>` (must return 200)
- Credentials in `d2c/.env`: `SURFER_EMAIL`, `SURFER_PASSWORD`

### Score Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Content Score | **≥90** | Legacy SEO quality gate. |
| NLP terms green | 90%+ high-priority, 70%+ medium-priority | Check Terms panel |
| Word count | Within Surfer's recommended range | Finalize BEFORE optimizing terms |
| Headings | Within Surfer's recommended range | Match H2/H3 count targets |

### Workflow: Create Content Editor Query

1. Navigate to **Write** section in SurferSEO
2. Click **New Content** → "Write Yourself"
3. Enter the target keyword (from content-queue.json)
4. Set location: **United States**, device: **Desktop**
5. Toggle **Import content from URL** → enter `https://fbardirect.com/blog/<slug>`
6. Review competitors list:
   - Remove outliers (Wikipedia, IRS.gov mega-pages, 9,000+ word pages when avg is 1,500)
   - Ensure 3+ different domains remain
   - All competitors must match the same search intent
7. Click **Create** → wait for SERP analysis to complete

### Workflow: Optimize Content

Follow this order — making changes out of sequence causes density miscalculations:

1. **Word count first**: Get content within Surfer's recommended range. All density calculations depend on total length.
2. **NLP/semantic terms**: Work through the Terms panel. Incorporate terms naturally into existing sections. Add new subsections if needed for missing topic areas. Aim for 80%+ green.
3. **Heading structure**: Compare your H2/H3 count against Surfer's Outline Builder recommendations. Adjust as needed.
4. **Images**: Meet the recommended image count. Add relevant alt text containing secondary keywords.
5. **Internal links**: Link to related FBAR blog articles within the cluster.
6. **Auto-Optimize (once)**: Run at the end for last-mile NLP term insertions. Review every change — do not accept blindly.

### Applying Recommendations to MDX

Based on SurferSEO feedback, edit `src/content/blog/<slug>.mdx`:

- Add missing NLP terms naturally into existing sentences or new subsections
- Adjust heading structure if Surfer shows a gap
- Expand or trim content to hit the word count range
- Bold recommended terms where natural
- Add images with alt text if image count is below target

After editing:
```bash
# Re-validate
node scripts/validate-article.mjs <slug>
# Re-promote (overwrites blog copy)
node scripts/promote-article.mjs <slug> --force
# Commit, push, wait for CI + Build & Push, deploy
```

### Re-Check in SurferSEO

After deploying the updated article:
1. In SurferSEO Content Editor, re-import from the live URL
2. Verify the Content Score improved
3. If below target: repeat optimization (max 3 iterations)

### Iteration Strategy

- **Max 3 iterations** per article (post-deploy optimization)
- Articles written with Phase B NLP targets should require 0-1 iterations to reach ≥90
- Make ALL recommended changes in one pass, not one-by-one
- Batch multiple articles per deploy to reduce CI/deploy cycles (edit 3-5 articles, deploy once, then score all)
- Stop optimizing when ≥90 or when further changes degrade readability/legal accuracy

### Common SurferSEO Recommendations and Fixes

| Recommendation | How to Apply |
|----------------|-------------|
| Missing NLP terms | Weave into existing sections where they fit contextually. Do not force-insert. |
| Low word count | Add substantive content — new examples, deeper explanations, additional subtopics. |
| Too few headings | Add H2/H3 headings for subtopics Surfer identifies. Match PAA questions where relevant. |
| Missing images | Add infographics, process diagrams, comparison tables. Use relevant alt text. |
| Terms overused | Back off — reduce repetition. Surfer marks overuse with exclamation marks. |

### Important Caveats

**SurferSEO does NOT evaluate E-E-A-T.** It only measures on-page content signals (terms, structure, density). You must separately verify:
- Author byline and credentials
- Source citations (FinCEN.gov, IRS.gov, law.cornell.edu)
- Tax advice disclaimers
- Schema markup (Article, FAQ)

**Re-verify factual accuracy after every optimization edit.** Adding NLP terms or restructuring can introduce errors in FBAR/tax content.

**Legal accuracy ALWAYS wins over NLP targets** — never change statute citations, dollar amounts, or penalty figures to hit an NLP term frequency. Readability must not degrade below professional standards to hit NLP targets.

### Content Editor vs Content Audit

| Feature | Content Editor | Content Audit |
|---------|---------------|---------------|
| Best for | New/deep optimization | Monitoring published pages |
| Scope | Article text only | Full page `<body>` (nav, sidebar, footer) |
| Data source | SERP competitor analysis | GSC data + SERP analysis |
| Use when | Writing or heavy optimization | Quarterly page freshness checks |

Scores **will differ** between the two tools for the same content.

---

## 10.6. NLP Target Extraction (Phase B)

Before writing ANY article, NLP targets must be extracted and saved as a JSON file. This is a **hard gate** — writing must not begin until NLP targets exist.

### Primary Method: DIY `extract` Command

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/seo-scorer/index.mjs extract "fbar your target keyword" --slug fbar-your-topic-slug
```

This does the following:
1. Fetches top 10 SERP results for the keyword via Serper.dev
2. If fewer than 7 results, expands the corpus via DataForSEO keyword suggestions, authority seed URLs (irs.gov, fincen.gov), and related published articles from your own blog
3. Scrapes competitor article text (article-extractor primary, cheerio fallback)
4. Runs TF-IDF + n-gram analysis (unigrams, bigrams, trigrams) across the corpus
5. Enriches with entity extraction via compromise NLP
6. Calculates per-term frequency targets (p25/p75 of competitor usage counts)
7. Classifies terms into high/medium/low priority tiers

**Output:** `src/content/drafts/fbar-your-topic-slug.diy-surfer-targets.json`

**Options:**
- `--slug <slug>` — Override the output filename (default: auto-generated from keyword)
- `--num <n>` — Number of SERP results to analyze (default: 10)
- `--no-expand` — Skip corpus expansion (faster, but fewer terms for niche keywords)
- `--no-google-nlp` — Skip Google NLP API enrichment
- `--no-cache` — Force fresh scraping (ignore cached competitor texts)
- `--json` — Output JSON only

**Requires:** `SERPER_API_KEY` in `d2c/.env` (free tier: 2,500 queries/mo at serper.dev)

### Output Format

The targets file contains:
- `terms.high_priority` — must-have terms with `targetMin` / `targetMax` frequency ranges
- `terms.medium_priority` — should-have terms
- `terms.low_priority` — nice-to-have terms
- `targets.wordCount.min` / `max` — competitor word count range

Review the output. High-priority terms are the most important for your NLP Coverage score (22% of total weight).

### GATE: NLP Targets Must Exist Before Writing

The writing agent (Phase C) must check for one of these files before beginning:

```
src/content/drafts/<slug>.diy-surfer-targets.json   (DIY — primary)
src/content/drafts/<slug>.surfer-targets.json        (legacy SurferSEO — still loaded if present)
```

If neither file exists, run the `extract` command above to generate targets. Writing without NLP targets produces articles that score poorly on the NLP Coverage dimension (22% of total weight).

### Legacy Method: SurferSEO Browser Extraction

> **SurferSEO subscription cancelled as of March 2026.** This method is retained for reference only. Use the DIY `extract` command for all new articles.

See Section 12.1 for the browser-automated SurferSEO extraction JavaScript function, which was used for Wave 1-2 articles.

### When to Re-Extract

- **Keyword change**: If the target keyword changes, re-extract targets with the new keyword
- **Major SERP shift**: If competitors change significantly (new entrants, major rewrites), re-extract
- **Score plateau**: If score is stuck below 9.0 after 2 iterations, re-extract to check for updated competitor data

---

## 11. Quick Reference Card

```
KEYWORD:     (See Section 1.5 — validate via Semrush + competitor monitor)
NLP EXTRACT: node scripts/seo-scorer/index.mjs extract "<keyword>" --slug <slug>
               (GATE: .diy-surfer-targets.json must exist before writing — see Section 10.6)
VALIDATE:    node scripts/validate-article.mjs <slug>
DIY SCORE:   node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save  (primary gate)
DIY REVISE:  node scripts/seo-scorer/index.mjs revise <slug>
DIY LIST:    node scripts/seo-scorer/index.mjs list
DIY BATCH:   node scripts/seo-scorer/index.mjs batch --no-llm --no-serp --save
HERO IMG:    node scripts/generate-hero-image.mjs <slug>
HERO MISS:   node scripts/generate-hero-image.mjs --missing
PROMOTE:     node scripts/promote-article.mjs <slug> [--force]
SWA SCORE:   node scripts/score-via-swa.mjs --playbook --slug <slug> --keyword "<kw>"  (optional)
SWA LIST:    node scripts/score-via-swa.mjs --list
SURFER:      (cancelled March 2026 — use DIY scorer instead. See Section 10.5 for legacy reference.)
COMPETE:     node scripts/competitor/monitor.mjs
DEPLOY:      git push -> CI -> GHCR -> ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'
```

### Full Pipeline Sequence (Research-First)

```
=== Phase A: Keyword Research ===
A1. KEYWORD RESEARCH: Validate keyword (Section 1.5)
    - Run competitor monitor, check Semrush, cross-reference content-queue.json
    - Add validated keyword + topic to content-queue.json

=== Phase B: NLP Target Extraction (GATE — must complete before writing) ===
B1. EXTRACT: node scripts/seo-scorer/index.mjs extract "<keyword>" --slug <slug>
B2. Review output at src/content/drafts/<slug>.diy-surfer-targets.json
B3. GATE CHECK: .diy-surfer-targets.json must exist before proceeding

=== Phase C: Write Draft WITH NLP Targets ===
C1. Pick topic from content-queue.json (status: pending)
C2. Read .diy-surfer-targets.json — target all high-priority NLP terms, 70%+ medium-priority
C3. Write draft -> src/content/drafts/<slug>.mdx (within target word count + heading ranges)
C4. VALIDATE: node scripts/validate-article.mjs <slug>
    (hero image is a soft warning at this stage — does not block)
C5. Fix any hard failures, re-validate until PASS
C6. DIY SCORE: node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save
C7. If <9.0: revise and re-score (see Section 7b optimization loop)
C8. HERO IMAGE: node scripts/generate-hero-image.mjs <slug>
    (generates 1200x630 webp → public/blog/<slug>.webp, updates frontmatter)
C9. RE-VALIDATE: node scripts/validate-article.mjs <slug>
    (confirm hero image warning is gone)

=== Phase D: Promote ===
D1. PROMOTE: node scripts/promote-article.mjs <slug>

=== Phase E: Deploy ===
E1. git add + commit + push
E2. Wait for CI + Build & Push to complete
E3. DEPLOY: ssh fbar 'cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app'

=== Phase F: Score Verification ===
F1. DIY score >=9.0: article is production-ready.
F2. [Optional] SWA SCORE: Use Chrome DevTools MCP to score via SWA
F3. [Optional] SAVE: node scripts/score-via-swa.mjs --save ...
```

---

## 12. Repeatable Session Playbook

Use this playbook when processing a batch of 5-7 articles in a single Claude Code session. Works for both rewriting existing articles (Wave 1 fix) and writing new articles from scratch.

### Pre-Flight

```
□ Read content-queue.json — identify next batch by publishedDate or priority
□ Verify SERPER_API_KEY is set in d2c/.env (needed for NLP extraction)
□ Read this runbook + writer-guide.md to refresh context
```

### Phase B — NLP Target Extraction (~5 min, can parallelize)

For each article in the batch:

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
node scripts/seo-scorer/index.mjs extract "<keyword>" --slug <slug>
```

Output: `src/content/drafts/<slug>.diy-surfer-targets.json`

**GATE**: Every article must have `.diy-surfer-targets.json` (or legacy `.surfer-targets.json`) before proceeding to Phase C.

### Phase C — Write/Rewrite (~10 min, parallel subagents)

Spawn N parallel subagents (one per article). Each subagent receives:
- `.diy-surfer-targets.json` (NLP terms + target frequencies)
- `writer-guide.md` (YMYL guardrails, structure rules)
- Current `.mdx` file (if rewriting) or `content-queue.json` entry (if new)
- Instructions: target ALL high-priority NLP terms, ≥70% medium-priority, word count within target range, YMYL accuracy wins over NLP optimization

### Phase D — Validate + Images + Promote (~10 min)

```bash
cd /c/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c
for slug in <slug1> <slug2> ...; do
  node scripts/validate-article.mjs $slug
  node scripts/generate-hero-image.mjs $slug
  node scripts/promote-article.mjs $slug --force
done
```

### Phase E — Deploy (~15 min)

```bash
# 1. Stage and commit
git add src/content/blog/*.mdx src/content/drafts/*.mdx
git commit -m "feat(d2c): rewrite batch N articles with SurferSEO NLP targets"
git push

# 2. Wait for CI (D2C FBAR CI) + Build & Push (GHCR)
# 3. Deploy to Hetzner
ssh -i ~/.ssh/hetzner_claude root@178.156.250.116 \
  "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml \
   pull d2c-app && docker compose -f docker-compose.prod.yml up -d d2c-app"
```

### Phase F — DIY Score Verification (~5 min)

For each article:

```bash
node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save
```

- **≥9.0**: Done. Article is production-ready.
- **8.0-8.9**: Run `revise` command, fix top issues, re-score.
- **<8.0**: Deeper review — likely needs structural changes or word count adjustment.

### Post-Flight

```
□ Update content-queue.json status → "published" for newly published articles
□ Note any deferred articles for next session
```

---

## 12.1. Browser-Automated NLP Extraction (Legacy — SurferSEO)

> **SurferSEO subscription cancelled as of March 2026.** Use the DIY `extract` command instead (Section 10.6). This section is retained for reference only.

When extracting NLP entities from SurferSEO via Chrome DevTools MCP, use this JavaScript function in `evaluate_script`:

```javascript
async () => {
  // Click the SEO/Write & Optimize button to open the entities panel
  const buttons = Array.from(document.querySelectorAll('button'));
  const seoBtn = buttons.find(b => b.textContent.includes('SEO'))
    || buttons.find(b => b.textContent.includes('Write & Optimize'));
  if (seoBtn) seoBtn.click();

  // Wait for the Terms panel to render
  await new Promise(r => setTimeout(r, 3000));

  // Extract all terms from the tab panel
  const tabPanels = document.querySelectorAll('[role="tabpanel"]');
  if (tabPanels.length === 0) return { error: "No tab panels found" };
  const panel = tabPanels[0];
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, null, false);
  const texts = [];
  let node;
  while (node = walker.nextNode()) {
    const t = node.textContent.trim();
    if (t) texts.push(t);
  }

  // Parse term / current / target pattern
  const parsed = [];
  for (let j = 0; j < texts.length; j++) {
    if (texts[j] === "/" && j > 1 && j < texts.length - 1) {
      const current = parseInt(texts[j - 1]);
      const target = texts[j + 1];
      if (!isNaN(current)) {
        const term = texts[j - 2];
        if (term && !/^\d+$/.test(term) && term !== "/")
          parsed.push({ term, current, target });
      }
    }
  }
  return { count: parsed.length, terms: parsed };
}
```

**Target parsing**: The `target` field contains either a single number (`"5"`) or a range with an en-dash (`"3–8"`). Parse with:

```javascript
function parseTarget(t) {
  if (t.includes('\u2013')) { // en-dash
    const [min, max] = t.split('\u2013').map(Number);
    return { min, max };
  }
  return { min: Number(t), max: Number(t) };
}
```

**Priority classification** (for `.surfer-targets.json`):
- **high_priority**: `targetMax >= 8` OR (`targetMin >= 3` AND `targetMax >= 5`)
- **medium_priority**: `targetMax >= 2`
- **low_priority**: `targetMax <= 1`

### Saving the JSON File

Use the Write tool (not Bash) to create `src/content/drafts/<slug>.surfer-targets.json` directly. The inline Node.js approach via Bash fails on Windows due to `/dev/stdin` issues and quoting problems with en-dash characters.

---

## 13. Current Status

As of 2026-03-03:

- **55 total articles** in the content queue
- **19 published** (waves 1-2, live since March 1-2)
- **36 pending** (waves 3-5, articles written and scored)
- **54 articles score >= 9.0**; 1 at 8.4 (`fbar-vs-form-8938-when-file-both`)
- Publishing schedule: March 10 through April 28, 2026 (staggered `publishedDate` values, Mon-Fri 5/week)

### How Scheduled Publishing Works

The blog page in `src/lib/blog.ts` filters articles by `publishedDate <= now` at **build time** (when the Docker image is built). Articles with future `publishedDate` values exist in the Git repo and Docker image but are not rendered on the live site until:

1. The `publishedDate` has passed, AND
2. The Docker image is rebuilt

This means you must rebuild the Docker image periodically for scheduled articles to go live. There is no automatic deployment trigger.

### Recommended: Weekly Rebuild

**Option A: Manual rebuild (simplest)**

SSH in weekly and run:
```bash
cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app
```

**Option B: Server cron (recommended)**

Add a weekly cron on Hetzner to auto-rebuild:
```bash
# Rebuilds every Monday at 6 AM UTC
0 6 * * 1 cd /opt/fbar && docker compose pull d2c-app && docker compose up -d d2c-app >> /var/log/d2c-rebuild.log 2>&1
```

**Option C: Push a trivial commit**

Push any commit to `main` to trigger the GitHub Actions CI/CD pipeline that builds and pushes a new Docker image. Then pull on Hetzner.

### Verify After Deploy

After rebuilding, check that new articles appear:
```bash
curl -s https://fbardirect.com/blog | grep -c "article"
```

Or visit `https://fbardirect.com/blog` in a browser.

---

## 14. File Conventions

| Pattern | Location | Purpose | Regenerable? |
|---------|----------|---------|-------------|
| `<slug>.diy-surfer-targets.json` | drafts/ | DIY-generated NLP targets (primary) | Yes — via `extract` command |
| `<slug>.surfer-targets.json` | drafts/ | Manual Surfer targets (legacy) | No — do not overwrite |
| `<slug>.diy-score.attempt-N.json` | blog/ or drafts/ | Score history per iteration | Yes |
| `<slug>.diy-score.json` | blog/ or drafts/ | Latest score (legacy naming) | Yes |
| `<slug>.validation.json` | drafts/ | Article validation results | Yes |

**NLP target loading priority:** The article fetcher loads `.surfer-targets.json` first. If not found, it falls back to `.diy-surfer-targets.json`. Manual Surfer targets always take precedence when both exist.

**Caching:**
- SERP results: `scripts/seo-scorer/.serp-cache/`
- Competitor texts: `scripts/seo-scorer/.nlp-cache/<slug>/` (7-day TTL, keyed by URL SHA-256)
- GSC snapshots: `scripts/seo-scorer/data/` (SQLite)

---

## 15. Architecture Reference

### NLP Extraction Pipeline

```
SERP fetch (Serper.dev)
  -> Corpus expansion (DataForSEO + authority seeds + self-reference articles)
    -> Page scraping (Tier 1: article-extractor, Tier 2: cheerio fallback)
      -> Tokenization + domain-aware stop-word filtering
        -> N-gram generation (unigrams, bigrams, trigrams)
          -> TF-IDF scoring across competitor corpus
            -> Entity enrichment (compromise NLP)
              -> Per-term frequency targets (p25/p75 of competitor counts)
                -> Priority classification (high / medium / low)
                  -> Output .diy-surfer-targets.json
```

### Key Source Files

| File | Purpose |
|------|---------|
| `scripts/seo-scorer/index.mjs` | CLI entry point (commander-based) |
| `scripts/seo-scorer/utils/config.mjs` | Central config: weights, paths, API keys, thresholds |
| `scripts/seo-scorer/analyzers/nlp-extract.mjs` | Core NLP pipeline: tokenize, TF-IDF, n-grams, entity enrichment |
| `scripts/seo-scorer/analyzers/nlp-coverage.mjs` | Scores article text against NLP targets |
| `scripts/seo-scorer/analyzers/readability.mjs` | Flesch, ARI, sentence/paragraph analysis |
| `scripts/seo-scorer/analyzers/writing-quality.mjs` | write-good, passive voice, transitions, cliches |
| `scripts/seo-scorer/analyzers/structure.mjs` | Headings, links, word count, FAQ, CTA |
| `scripts/seo-scorer/analyzers/keyword-coverage.mjs` | Keyword placement, density, TF-IDF, semantic |
| `scripts/seo-scorer/analyzers/schema-markup.mjs` | FAQ/Article/HowTo schema signals |
| `scripts/seo-scorer/analyzers/aeo-signals.mjs` | Answer paragraphs, citations, entities, PAA |
| `scripts/seo-scorer/analyzers/llm-quality.mjs` | Claude API content quality check |
| `scripts/seo-scorer/fetchers/article.mjs` | Article loader (keyword resolution, target loading) |
| `scripts/seo-scorer/fetchers/serp.mjs` | SERP data fetcher (Serper.dev) |
| `scripts/seo-scorer/fetchers/competitor-text.mjs` | Tiered page scraping with disk cache |
| `scripts/seo-scorer/fetchers/keyword-expand.mjs` | Corpus expansion (DataForSEO + seeds) |
| `scripts/seo-scorer/fetchers/gsc.mjs` | Google Search Console API client |
| `scripts/seo-scorer/scorers/weighted.mjs` | Weighted score calculator with redistribution |
| `scripts/seo-scorer/scorers/report.mjs` | Console and JSON report generation |

### Publishing Checklist

- [ ] NLP targets extracted (`extract` command or legacy `.surfer-targets.json`)
- [ ] Article scores >= 9.0 OVERALL (`node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp`)
- [ ] Validation passes (`node scripts/validate-article.mjs <slug>`)
- [ ] Frontmatter complete: `title`, `description` (120-160 chars), `publishedDate`, `author`, `heroImage`
- [ ] MDX copied from `drafts/` to `blog/` (`cp src/content/drafts/<slug>.mdx src/content/blog/<slug>.mdx`)
- [ ] `content-queue.json` updated: `status` -> `"published"`, `diyScore`, `diyScoredAt` added
- [ ] Hero image exists at `public/blog/<slug>.webp` (or use a shared placeholder)
- [ ] Internal links point to existing published articles (check slugs against content queue)
- [ ] Authority links are valid URLs (irs.gov, fincen.gov, law.cornell.edu)
- [ ] No broken markdown (tables render, lists properly formatted, no unclosed tags)
- [ ] Git committed and pushed to `main`
- [ ] Docker rebuilt on Hetzner: `docker compose pull d2c-app && docker compose up -d d2c-app`

---
