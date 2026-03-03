# DIY SEO Scorer Workflow

Replaces SurferSEO ($89/mo) with a $0/mo pipeline built on TF-IDF, NLP entity extraction, SERP scraping, and local scoring.

---

## 1. Overview

The DIY SEO scorer lives at `d2c/scripts/seo-scorer/`. It scores articles across 8 dimensions with configurable weights:

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| NLP Coverage | 22% | Term frequency vs competitor-derived targets |
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

---

## 2. Writing a New Article (Step by Step)

### Step 1: Add Topic to Content Queue

Edit `src/content/content-queue.json`. Add a new entry to the `topics` array:

```json
{
  "slug": "fbar-your-topic-slug",
  "keyword": "fbar your target keyword",
  "intent": "informational",
  "brief": "One-sentence description of what the article covers.",
  "status": "pending",
  "pillar": "fbar-requirements",
  "publishedDate": "2026-04-15"
}
```

Pillar values: `fbar-requirements`, `account-types`, `country-specific`, `penalties-compliance`, `deadlines-extensions`, `exchange-rates-valuation`, `fbar-vs-others`

### Step 2: Extract NLP Targets

```bash
cd d2c
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

The targets file contains:
- `terms.high_priority` — must-have terms with `targetMin` / `targetMax` frequency ranges
- `terms.medium_priority` — should-have terms
- `terms.low_priority` — nice-to-have terms
- `targets.wordCount.min` / `max` — competitor word count range

Review the output. High-priority terms are the most important for your NLP Coverage score (22% of total weight).

Options:
- `--slug <slug>` — Override the output filename (default: auto-generated from keyword)
- `--num <n>` — Number of SERP results to analyze (default: 10)
- `--no-expand` — Skip corpus expansion (faster, but fewer terms for niche keywords)
- `--no-google-nlp` — Skip Google NLP API enrichment
- `--no-cache` — Force fresh scraping (ignore cached competitor texts)
- `--json` — Output JSON only

### Step 3: Write the MDX Draft

Create `src/content/drafts/fbar-your-topic-slug.mdx` using the article template in Section 6.

Key writing guidelines:
- **Word count**: Check the `.diy-surfer-targets.json` for `targets.wordCount.min` and `max`. Stay within range.
- **H2 headings**: Use question format ("What Is...?", "How Does...?", "Who Must...?"). Minimum 3 H2s.
- **Answer paragraphs**: Immediately after each H2, write a 30-100 word paragraph that directly answers the question. AI engines extract these.
- **NLP terms**: Weave high-priority terms into paragraphs naturally. Check `targetMin` values. Some terms need 3-5 mentions, others just 1.
- **Internal links**: Link to 3+ existing blog articles using `/blog/<slug>` paths.
- **Authority links**: Link to 3+ authoritative sources (irs.gov, fincen.gov, law.cornell.edu, congress.gov, treasury.gov, gpo.gov).
- **CTA**: Include at least one link to `/pricing`, `/signup`, or `/get-started`.
- **Disclaimer**: Keep the standard disclaimer paragraph after frontmatter.
- **FAQ section**: Add an `## FAQ` section with 4-6 bold-text Q&A pairs (`**Question?**` with paragraph answers).

### Step 4: Score the Draft

```bash
node scripts/seo-scorer/index.mjs score fbar-your-topic-slug --no-llm --no-serp
```

The `--no-llm` flag skips the Claude API call (faster, free). The `--no-serp` flag skips SERP fetching (avoids using Serper quota on every scoring iteration).

For a full score with all dimensions:

```bash
node scripts/seo-scorer/index.mjs score fbar-your-topic-slug
```

### Step 5: Optimize Until >= 9.0

Run scorer, fix the lowest-weighted-gap dimension, re-score, repeat. Usually takes 2-3 loops. See Section 4 for the detailed optimization guide.

Save the final score:

```bash
node scripts/seo-scorer/index.mjs score fbar-your-topic-slug --no-llm --no-serp --save
```

### Step 6: Promote to Published

```bash
cp src/content/drafts/fbar-your-topic-slug.mdx src/content/blog/fbar-your-topic-slug.mdx
```

### Step 7: Update Content Queue

Edit `src/content/content-queue.json`:
- Set `"status": "published"`
- Add `"diyScore": 9.2` (your final score)
- Add `"diyScoredAt": "2026-04-15T12:00:00.000Z"` (ISO timestamp)

### Step 8: Deploy

```bash
git add src/content/blog/fbar-your-topic-slug.mdx src/content/content-queue.json
git commit -m "feat(d2c): publish fbar-your-topic-slug article (DIY 9.2)"
git push origin main
```

Wait for GitHub Actions to build and push the Docker image to GHCR, then on Hetzner:

```bash
docker compose pull d2c-app && docker compose up -d d2c-app
```

---

## 3. Scoring Dimensions Explained

### Readability (weight: 10%)

**What it measures:** How accessible the article is for a general web audience reading about tax/legal topics.

**Sub-criteria:**
| Sub-criterion | Full marks | Partial | Points |
|--------------|-----------|---------|--------|
| Flesch Reading Ease | 50-70 | 40-50 or 70-80 | up to 3 |
| Avg sentence length | 12-22 words | 10-12 or 22-25 | up to 2 |
| Long sentence % | <10% over 25 words | 10-15% | up to 2 |
| Long paragraph % | <5% over 150 words | 5-10% | up to 1.5 |
| ARI grade level | 8-14 | 6-8 or 14-16 | up to 1.5 |

**How to score well:**
- Break long sentences. If a sentence has a comma-separated list, consider bullets instead.
- Use plain English: "under" not "pursuant to", "must" not "is required to", "despite" not "notwithstanding".
- Keep paragraphs to 3-5 sentences.

**Common pitfalls:**
- Legal citations (31 CFR 1010.350) inflate ARI. This is expected. The scorer's ARI target (8-14) accounts for tax/legal domain content.
- Flesch below 50 usually means too many long compound sentences, not vocabulary issues.

### Writing Quality (weight: 8%)

**What it measures:** Prose quality using the `write-good` library plus transition/cliche analysis.

**Sub-criteria:**
| Sub-criterion | Full marks | Points |
|--------------|-----------|--------|
| write-good issues per 500 words | <5 | up to 3 |
| Passive voice instances | <=5 | up to 2 |
| Weasel words | <=3 | up to 1 |
| Adverb density | <1% | up to 1 |
| Cliche count | 0 | up to 1.5 |
| Transition word rate | >=1 per 300 words | up to 1.5 |

**How to score well:**
- Convert passive to active: "is required by FinCEN" becomes "FinCEN requires"
- Add transition words: However, Additionally, Therefore, For example, Specifically, In contrast, Furthermore, Consequently, Nevertheless, Meanwhile
- Eliminate cliches: "navigate the complex", "peace of mind", "it's important to note", "when it comes to", "at the end of the day", "better safe than sorry"
- Cut adverbs: "very", "really", "extremely", "basically"

**Common pitfalls:**
- Tax/legal content legitimately needs some passive voice ("must be filed", "may be assessed"). The scorer allows up to 5 passive instances at full marks.
- Hedging words ("generally", "typically", "may") are appropriate for tax content. Up to 3 are allowed without penalty.

### Structure (weight: 12%)

**What it measures:** Content organization, heading hierarchy, linking, and structural elements.

**Sub-criteria:**
| Sub-criterion | Requirement | Points |
|--------------|------------|--------|
| H1 heading | Exactly 1 | 1 |
| H2 headings | >= 3 | 1 |
| H3 headings | >= 2 | 0.5 |
| FAQ section | Present | 1 |
| Internal links | >= 3 to /blog/* | 1 |
| Authority links | >= 3 (irs.gov, fincen.gov, etc.) | 1 |
| Table and/or list | Has both | 1 |
| Word count | Within competitor range | 1 |
| Disclaimer | Present | 0.5 |
| CTA links | >= 1 to /pricing, /signup, /get-started | 1 |
| Heading hierarchy | No level skips (H1->H2->H3) | 0.5 |

**Authority domains recognized:** irs.gov, fincen.gov, law.cornell.edu, congress.gov, treasury.gov, gpo.gov

**How to score well:**
- Use exactly one H1 (the article title). All other sections use H2/H3.
- Include a markdown table (comparison, summary, or requirements table).
- Include at least one bulleted or numbered list.
- Link to at least 3 other `/blog/*` articles.
- Link to at least 3 authority sources.
- Add at least one link to `/pricing` or `/signup`.
- Keep the standard disclaimer paragraph.
- Add an FAQ section.

**Common pitfalls:**
- Skipping heading levels (H2 -> H4 without H3) breaks hierarchy validation.
- Missing FAQ section is an easy 1-point loss.
- Word count outside the competitor range from `.diy-surfer-targets.json` costs a full point.

### Keyword Coverage (weight: 10%)

**What it measures:** How well the target keyword is placed and distributed across the article.

**Sub-criteria:**
| Sub-criterion | Requirement | Points |
|--------------|------------|--------|
| Keyword in H1/title | Present | 1.5 |
| Keyword in first 150 words | Present | 1 |
| Keyword in >= 1 H2 | Present | 1 |
| Keyword in meta description | Present | 1 |
| Keyword density | 0.5-2.5% | 1.5 |
| Semantic variations | All keyword words appear 3+ times | 1 |
| TF-IDF relevance | Top quartile (>=0.75 normalized) | 1 |
| SERP related keywords | 5+ found in article (requires --serp) | 1 |
| Keyword in URL slug | Present | 0.5 |

**How to score well:**
- Put the exact keyword phrase in the title, H1, meta description, and first paragraph.
- Use the keyword naturally in at least one H2 heading.
- Density 0.5-2.5% means roughly 1-5 uses per 500 words for a multi-word keyword.
- Use keyword component words independently throughout (e.g., for "fbar green card holders" use "fbar", "green card", "holders" separately in various paragraphs).

**Common pitfalls:**
- Forgetting the keyword in the meta description.
- Over-stuffing (>2.5% density) triggers a partial credit penalty.
- Hyphen matching: the scorer treats "first-time" as matching "first time".

### NLP Coverage (weight: 22% -- highest)

**What it measures:** How many NLP terms from the `.diy-surfer-targets.json` file appear at their target frequency.

**Sub-criteria:**
| Tier | Scoring | Points |
|------|---------|--------|
| High priority | Average per-term score (actual/target) | up to 5 |
| Medium priority | % of terms meeting targetMin (need >=70%) | up to 3 |
| Low priority | % of terms present at all (need >=50%) | up to 2 |

**Per-term scoring:**
- At or above targetMin and at/below targetMax: 1.0 (full credit)
- Above targetMax: small penalty (1.5x over = 0.8, 2x over = 0.6)
- Below targetMin but present: proportional credit (actual / targetMin)
- Missing entirely: 0

**How to inject NLP terms naturally:**
1. Open the `.diy-surfer-targets.json` file
2. Focus on high-priority terms first (they drive 5 of the 10 NLP points)
3. For each term, check its `targetMin`. Search the MDX for current count.
4. Add terms where they fit contextually. "financial institution" can replace "bank" in some sentences. "filing requirements" can appear in section transitions.
5. Use terms in headings where they fit: "## Which Foreign Financial Accounts Must You Report?"

**Common pitfalls:**
- NLP terms sometimes require passive constructions that hurt Writing Quality. Find active voice alternatives: instead of "accounts are required to be reported", write "you must report these accounts" and use "required" in a different sentence.
- Over-injecting makes content sound robotic. Stay within `targetMax`.
- If no `.diy-surfer-targets.json` exists, the NLP dimension is skipped entirely. The 22% weight redistributes to other dimensions, but you lose the most powerful scoring lever.

### Schema Markup (weight: 8%)

**What it measures:** Structured data readiness for rich results in Google.

**Sub-criteria:**
| Sub-criterion | Requirement | Points |
|--------------|------------|--------|
| FAQ schema signals | 2+ Q&A pairs under FAQ heading | 2 |
| Article schema fields | title + description + date + author in frontmatter | 2 |
| Breadcrumb signal | Article in /blog/ path | 1 |
| Meta description | 120-160 characters | 1.5 |
| Hero image | heroImage in frontmatter | 1 |
| TOC signal | 3+ descriptive H2s (3+ words each) | 1 |
| HowTo signal | 3+ numbered steps | 0.5 |
| List signal | 5+ list items | 1 |

**How to score well:**
- Complete frontmatter: `title`, `description`, `publishedDate`, `author`, `heroImage`
- Meta description between 120-160 characters. Include the keyword.
- FAQ section with `**bold question?**` format and paragraph answers (at least 2 Q&A pairs).
- Include at least one numbered list with 3+ items for HowTo signals.
- Include at least one list (bulleted or numbered) with 5+ items.

**Common pitfalls:**
- Meta description too short (<120 chars) or too long (>160 chars) drops from 1.5 to 0.5 points.
- FAQ section needs at least 2 distinct Q&A pairs. One pair only gets 0.5 points.
- Missing `heroImage` in frontmatter loses og:image social sharing.

### AEO Signals (weight: 15%)

**What it measures:** Answer Engine Optimization — how likely AI systems (ChatGPT, Perplexity, Google AI Overviews) are to cite this article.

**Sub-criteria:**
| Sub-criterion | Requirement | Points |
|--------------|------------|--------|
| Answer paragraphs | 50%+ of H2s have 30-100 word answers | 2 |
| Question headings | 3+ headings ending with ? | 1.5 |
| Citation density | 2+ refs per 500 words | 1.5 |
| Entity clarity | 5+ key FBAR entities mentioned | 1 |
| PAA coverage | 3+ PAA questions addressed (requires --serp) | 1.5 |
| Definition sentences | 2+ "X is Y" patterns | 1 |
| Numbered step lists | 3+ ordered items | 0.5 |

**Key FBAR entities the scorer checks for:**
FBAR, FinCEN, BSA, foreign financial account, Report of Foreign Bank and Financial Accounts, $10,000 threshold

**What counts as citations:** Authority domain links (irs.gov, fincen.gov, etc.) + statutory references in the text (31 USC 5314, 31 CFR 1010.350, IRC 6038D, Title 31).

**How to score well:**
- Every H2 should be a question ("What Is...?", "How Does...?", "Who Must...?").
- Immediately after each H2, write a 30-100 word paragraph that directly answers that question and references the heading's topic words.
- Include statutory citations and authority links. Target 2+ per 500 words.
- Include clear definition sentences early: "An FBAR is a report filed with FinCEN..."
- Include at least one numbered list of steps.

**Common pitfalls:**
- Answer paragraphs too short (<30 words) or too long (>100 words) don't get credit.
- Answer paragraphs must reference the heading's topic words (40%+ overlap of significant words).
- Without `--serp`, PAA coverage is excluded and remaining AEO scores are scaled up to 10.

---

## 4. Optimization Loop Guide

### The Loop

```
Score -> Read issues -> Fix weakest weighted dimension -> Re-score -> Repeat
```

Typically takes 2-3 loops to reach 9.0. Save the final passing score with `--save`.

### Step-by-Step

1. **Run the scorer:**
   ```bash
   node scripts/seo-scorer/index.mjs score fbar-your-slug --no-llm --no-serp
   ```

2. **Identify the biggest opportunity.** The report shows each dimension score. Calculate the weighted gap: `(10 - score) * weight`. Fix the dimension with the highest weighted gap first.

3. **Or use the revise command** for a prioritized checklist:
   ```bash
   node scripts/seo-scorer/index.mjs score fbar-your-slug --no-llm --no-serp --save
   node scripts/seo-scorer/index.mjs revise fbar-your-slug
   ```
   The revise command sorts dimensions by recoverable points and lists specific issues.

4. **Fix the top issues.** Edit the MDX file in `src/content/drafts/`.

5. **Re-score.** Repeat until >= 9.0.

### Common Bottlenecks and Fixes

**Writing Quality vs NLP tension:**
Some NLP terms force passive constructions ("accounts are required to be reported"). Fix: restructure to active voice while keeping the term. "You must report these accounts" + use "required" in a different sentence. The NLP scorer counts term occurrences anywhere in the article, so the term does not need to appear in the same sentence as the active construction.

**Word count outside competitor range:**
Check `targets.wordCount` in the `.diy-surfer-targets.json`. If over: trim redundant examples, merge overlapping sections, cut filler phrases ("It is important to note that..."). If under: add depth with examples, case law citations, comparison tables, or expand the FAQ.

**Flesch score below 50:**
Replace jargon: "pursuant to" -> "under", "in accordance with" -> "under", "notwithstanding" -> "despite", "aforementioned" -> "this", "in the event that" -> "if". Break compound sentences at conjunctions. The target is 50-70 for tax/legal content.

**AEO answer paragraphs failing:**
Two common failures: (a) paragraph too short or too long, (b) paragraph does not reference the heading's topic words. Convert statement headings to questions: "Filing Deadline" -> "What Is the FBAR Filing Deadline?" Then write a 30-100 word paragraph that uses words from the heading ("FBAR", "filing", "deadline") and directly answers the question.

**NLP high-priority terms below target:**
Open the `.diy-surfer-targets.json`, find terms with `targetMin` > current count. Search the MDX for current uses. Add the term to paragraphs where it fits contextually. For multi-word terms like "financial institution" or "foreign financial accounts", you usually need 3-5 mentions spread across the article.

**Missing internal links:**
Add links to related articles using `/blog/<slug>` format. Run `node scripts/seo-scorer/index.mjs list` to see all published articles and their keywords. Pick 3+ articles in related pillars.

**Missing authority links:**
Add links to irs.gov, fincen.gov, law.cornell.edu. Common patterns:
- `[31 CFR 1010.350](https://www.law.cornell.edu/cfr/text/31/1010.350)`
- `[31 USC 5314](https://www.law.cornell.edu/uscode/text/31/5314)`
- `[BSA E-Filing](https://bsaefiling.fincen.gov/)`
- `[IRS FBAR page](https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar)`

---

## 5. Batch Operations

### Score all published articles that lack a score file

```bash
cd d2c
node scripts/seo-scorer/index.mjs batch --no-llm --no-serp --save
```

### Score a single article with report saved

```bash
node scripts/seo-scorer/index.mjs score fbar-your-slug --no-llm --no-serp --save
```

### List all articles and their scoring status

```bash
node scripts/seo-scorer/index.mjs list
```

### Extract NLP targets for a new keyword

```bash
node scripts/seo-scorer/index.mjs extract "fbar your keyword" --slug fbar-your-slug
```

Output: `src/content/drafts/fbar-your-slug.diy-surfer-targets.json`

### Validate DIY targets against Surfer targets

```bash
node scripts/seo-scorer/index.mjs validate-nlp fbar-your-slug
```

Only works for articles that have a `.surfer-targets.json` file (from a previous SurferSEO export). Reports precision, recall, and F1 per priority tier using Porter stemming for fuzzy matching.

### GSC feedback (after articles have been live for 2-4 weeks)

```bash
# Single article
node scripts/seo-scorer/index.mjs gsc fbar-your-slug --days 28 --save

# All published articles
node scripts/seo-scorer/index.mjs gsc-batch --days 28 --save
```

Shows which search queries drive impressions, identifies CTR gaps (high impressions but low clicks), matches queries to NLP terms, and tracks ranking trends over saved snapshots.

---

## 6. Article Template

```mdx
---
title: "Your Title with Primary Keyword"
description: "120-160 char meta description with primary keyword. Describe what the reader will learn."
publishedDate: "2026-04-15"
author: "Matt Cohen, CPA"
heroImage: "/blog/your-slug.webp"
---

FBAR Direct prepares and files your FBAR (FinCEN Form 114) on your behalf. You are responsible for reviewing all information for accuracy before submission to FinCEN. This article is for informational purposes only and does not constitute tax, legal, or financial advice.

# Your Title with Primary Keyword

The **primary keyword** appears in the first 150 words. This opening paragraph (30-100 words) directly answers the main question. It references core entities: FBAR, FinCEN, foreign financial accounts, and the $10,000 threshold. Include a statutory citation like [31 CFR 1010.350](https://www.law.cornell.edu/cfr/text/31/1010.350).

The second paragraph provides context and previews what the article covers. Link to the [BSA E-Filing system](https://bsaefiling.fincen.gov/) or other authority sources.

## What Is [Topic as Question]?

A concise 30-100 word answer paragraph that directly answers this question. Reference the heading's topic words. Include a citation or statute reference. This paragraph is what AI answer engines extract as featured answers.

Additional depth paragraphs follow. Use NLP terms naturally here.

### Sub-Topic Under First H2

More specific information. Use H3 for subdivisions within each H2 section.

## How Does [Related Aspect] Work?

Another 30-100 word answer paragraph. Each H2 follows this question-then-answer pattern.

| Column 1 | Column 2 | Column 3 |
|-----------|----------|----------|
| Data | Data | Data |
| Data | Data | Data |

1. First step in a process
2. Second step
3. Third step
4. Fourth step

## Who Must [Relevant Question]?

Answer paragraph. Link to related articles: see our [first-time filer guide](/blog/fbar-first-time-filer-guide) and [penalties guide](/blog/fbar-penalties-what-happens-if-you-dont-file).

## [Additional Question-Format H2s as Needed]

Answer paragraph. Continue adding H2 sections until you have covered the topic thoroughly and hit your word count target.

## FAQ

**What is [common question]?**

Answer paragraph (2-4 sentences).

**How do I [another common question]?**

Answer paragraph.

**When is [deadline/timing question]?**

Answer paragraph.

**What happens if [consequence question]?**

Answer paragraph.

## Take the Next Step

If you have foreign financial accounts that may need FBAR reporting, [FBAR Direct](/pricing) can prepare and file your FBAR on your behalf. [Get started today](/signup).
```

---

## 7. Publishing Checklist

- [ ] Article scores >= 9.0 OVERALL (`node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp`)
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

## 8. Current Status

As of 2026-03-03:

- **55 total articles** in the content queue
- **19 published** (waves 1-2, live since March 1-2)
- **36 pending** (waves 3-5, articles written and scored)
- **54 articles score >= 9.0**; 1 at 8.4 (`fbar-vs-form-8938-when-file-both`)
- Publishing schedule: March 10 through April 28, 2026 (staggered `publishedDate` values)

### How Scheduled Publishing Works

The blog page in `src/lib/blog.ts` filters articles by `publishedDate <= now` at **build time** (when the Docker image is built). Articles with future `publishedDate` values exist in the Git repo and Docker image but are not rendered on the live site until:

1. The `publishedDate` has passed, AND
2. The Docker image is rebuilt

This means you must rebuild the Docker image periodically for scheduled articles to go live. There is no automatic deployment trigger.

---

## 9. Deployment

### Standard Deploy (after writing and scoring new articles)

```bash
# Local machine — commit and push
git add src/content/blog/<slug>.mdx src/content/content-queue.json
git commit -m "feat(d2c): publish <slug> article (DIY 9.X)"
git push origin main

# GitHub Actions builds Docker image -> pushes to GHCR
# Wait for the "D2C FBAR Build & Push" workflow to complete

# SSH to Hetzner
ssh root@178.156.250.116
cd /opt/fbar
docker compose pull d2c-app && docker compose up -d d2c-app
```

### Scheduled Article Publishing

For articles with future `publishedDate` values that are already in the Docker image, you only need to rebuild periodically so articles whose dates have passed become visible on the site.

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

## 10. File Conventions

| Pattern | Location | Purpose | Regenerable? |
|---------|----------|---------|-------------|
| `<slug>.surfer-targets.json` | drafts/ | Manual Surfer targets (legacy) | No -- do not overwrite |
| `<slug>.diy-surfer-targets.json` | drafts/ | DIY-generated NLP targets | Yes |
| `<slug>.diy-score.attempt-N.json` | blog/ or drafts/ | Score history per iteration | Yes |
| `<slug>.diy-score.json` | blog/ or drafts/ | Latest score (legacy naming) | Yes |
| `<slug>.validation.json` | drafts/ | Article validation results | Yes |

**NLP target loading priority:** The article fetcher loads `.surfer-targets.json` first. If not found, it falls back to `.diy-surfer-targets.json`. Manual Surfer targets always take precedence when both exist.

**Caching:**
- SERP results: `scripts/seo-scorer/.serp-cache/`
- Competitor texts: `scripts/seo-scorer/.nlp-cache/<slug>/` (7-day TTL, keyed by URL SHA-256)
- GSC snapshots: `scripts/seo-scorer/data/` (SQLite)

---

## 11. Architecture Reference

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
