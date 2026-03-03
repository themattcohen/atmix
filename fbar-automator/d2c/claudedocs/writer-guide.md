# FBAR Direct Blog Writer Guide

Comprehensive reference for autonomous article writing agents. Follow every rule exactly.

---

## 0. Read NLP Targets Before Writing

Before writing ANY article, the agent MUST read the NLP targets file. Check for these files in order:

1. `src/content/drafts/<slug>.surfer-targets.json` (legacy SurferSEO targets — takes precedence if present)
2. `src/content/drafts/<slug>.diy-surfer-targets.json` (DIY-generated targets — used for all new articles)

**For new articles**, generate targets with the DIY extract command:
```bash
cd d2c
node scripts/seo-scorer/index.mjs extract "<keyword>" --slug <slug>
```
This outputs `src/content/drafts/<slug>.diy-surfer-targets.json` with NLP terms derived from SERP competitor analysis.

### What to target:
- ALL high_priority terms at their target frequency ranges
- ≥70% of medium_priority terms at their target frequency ranges
- Word count within the `targets.wordCount` range (min-max)
- Heading count within the `targets.headings` range (min-max)

### YMYL Override:
Legal accuracy ALWAYS wins over NLP term targets. Never change statute citations,
dollar amounts, or penalty figures to hit an NLP target. If an NLP target conflicts
with legal accuracy, legal accuracy wins.

### If no targets file exists:
Run the DIY extract command above to generate targets. Do NOT proceed with writing
until `.diy-surfer-targets.json` exists. See the blog pipeline runbook Section 10.6.

---

## 1. Frontmatter Schema

```yaml
---
title: "FBAR [Topic]: [Descriptive Subtitle]"
description: "[150-160 chars, includes target keyword, summarizes article value]"
publishedDate: "YYYY-MM-DD"
author: "Matt Cohen, CPA"
heroImage: "/blog/[slug].webp"
---
```

- `title`: Must contain the target keyword. Max ~70 chars for SERP display.
- `description`: Must contain the target keyword. 150-160 chars ideal.
- `publishedDate`: Use the date from content-queue.json.
- `author`: Always "Matt Cohen, CPA".
- `heroImage`: Always "/blog/[slug].webp" — image generated separately.

---

## 2. Article Structure

### Heading Hierarchy

```
# [H1 — Article Title, matches frontmatter title, contains keyword] (exactly 1)

[Top disclaimer paragraph]

[Intro: 2-3 paragraphs, keyword in first 150 words, hook + context + scope]

## [H2 — Major Section] (at least 3 H2s, at least 2 should be questions ending with ?)
[Answer paragraph: 30-100 words, directly answers the heading, contains heading topic words]

### [H3 — Subsection] (at least 2 H3s total)
[Content]

## [H2 — Another Section]
...

## Frequently Asked Questions
[FAQ section with bold questions and answer paragraphs]

## [CTA Section — e.g., "Let FBAR Direct Handle Your Filing"]
[CTA paragraph with links to /pricing and /how-it-works]

[Bottom disclaimer paragraph]
```

### Key Rules
- Exactly 1 H1 (the article title)
- At least 3 H2 headings
- At least 2 H3 headings
- H1 → H2 → H3 hierarchy, no skipping levels
- At least 2 H2s should be questions ending with `?`
- Include a "Frequently Asked Questions" section
- Include at least 1 comparison table (use markdown `| | |` tables)
- Include at least 1 bulleted or numbered list

---

## 3. Disclaimers (EXACT TEXT REQUIRED)

### Top Disclaimer (first paragraph after H1)

IMPORTANT: The validator checks for this EXACT text (case-insensitive substring match). Copy it verbatim:

```
FBAR Direct prepares and files your FBAR (FinCEN Form 114) on your behalf. You are responsible for reviewing all information for accuracy before submission to FinCEN. This article is for informational purposes only and does not constitute tax, legal, or financial advice.
```

### Bottom Disclaimer (last paragraph)

The validator checks for the substring "tax regulations change frequently. always verify current requirements at" (case-insensitive). Your bottom disclaimer MUST contain that exact phrase. Use this template:

```
Tax regulations change frequently. Always verify current requirements at [IRS.gov](https://www.irs.gov) or [FinCEN.gov](https://www.fincen.gov). For advice specific to your situation, consult a qualified tax professional. This article is current as of [publishedDate in "Month DD, YYYY" format].
```

---

## 4. Banned Phrases (35 — hard fail if found)

These exact phrases must NOT appear anywhere in the article body:

```
in today's fast-paced world
navigating the complex landscape
it's important to note
it's worth mentioning
without further ado
let's dive in
when it comes to
at the end of the day
the bottom line is
in conclusion
comprehensive guide
everything you need to know
unlock the power of
streamline your
leverage
utilize
empower
seamless
robust
cutting-edge
game-changer
in this comprehensive guide
let's explore
it goes without saying
in a nutshell
rest assured
needless to say
as we all know
crucial
essential
vital
transform
unlock
```

---

## 5. Banned Filler Words (12 — tone fail)

Remove or replace these:

| Filler | Replacement |
|--------|-------------|
| add up | total / sum |
| basically | (remove) |
| actually | (remove) |
| just | (remove) |
| really | (remove) |
| simply | (remove) |
| sort of | (remove) |
| kind of | (remove) |
| definitely | (remove) |
| pretty much | (remove) |
| a ton of | many / several |
| in order to | to |

---

## 6. Complex → Simple Word Substitutions (10)

| Complex | Simple |
|---------|--------|
| denominated | held in |
| electronically | online |
| authorization | approval |
| superannuation | retirement fund (after first use, can use "super" for Australian context) |
| independently | separately |
| approximately | about |
| subsequently | then |
| determination | decision |
| constitute | make up |
| requirements | rules (where meaning is preserved) |

Tax-specific terms (FBAR, FinCEN, CFR, USC, IRC) are exempt — only replace general vocabulary.

---

## 7. Validation Hard-Fail Rules (12 checks)

The `validate-article.mjs` script checks all of these. ALL must pass:

1. **Top disclaimer present** — exact text from Section 3 above
2. **Bottom disclaimer present** — must contain "Tax regulations change frequently. Always verify current requirements at"
3. **Frontmatter complete** — title, description, publishedDate, author all present
4. **Word count ≥ 2000** — aim for 2000-3000 words
5. **Exactly 1 H1** — the article title
6. **At least 2 CTA links** — links containing `/pricing`, `/how-it-works`, `/signup`, or `fbardirect.com`
7. **Zero banned phrases** — none of the 35 phrases from Section 4
8. **Citation density ≥ 2 per 500 words** — count authority links + statute references (31 USC, 31 CFR, IRC)
9. **Dollar amount density ≥ 3 per 500 words** — include specific dollar amounts ($10,000, $16,117, $100,000, etc.)
10. **Penalty claims cite statute** — any "$X,XXX...penalty/fine/violation" must have USC/CFR/IRC within 200 chars
11. **Deadline claims cite source** — any "due/deadline/must file...YYYY" must cite CFR/IRS/Notice within 200 chars
12. **Published date is future** — publishedDate must be after 2026-03-01

---

## 8. DIY Scorer Dimension Targets

> **Note:** The DIY scorer (`seo-scorer/`) is the **primary SEO quality gate** (target >=9.0). SurferSEO subscription was cancelled as of March 2026. See Section 0 for the NLP targets workflow.

The `seo-scorer` scores 6 dimensions (7 with LLM, but we use `--no-llm`). When `--no-llm` is used, the 6 dimensions are re-weighted to sum to 1.0. Target ≥ 9.0/10 overall.

### Readability (weight 0.12 → ~0.15 without LLM)
- **Flesch Reading Ease**: 50-70 (3/3 pts). Write clear sentences about tax topics.
- **Avg sentence length**: 12-22 words (2/2 pts). Mix short declarative with moderate explanatory.
- **Long sentences**: < 10% over 25 words (2/2 pts). Split at conjunctions.
- **Long paragraphs**: < 5% over 150 words (1.5/1.5 pts). Use short paragraphs.
- **ARI grade**: 8-14 (1.5/1.5 pts). Tax content naturally falls here.

### Writing Quality (weight 0.08 → ~0.10 without LLM)
- Minimal passive voice (< 5 instances)
- Active voice: "You must file" not "The FBAR must be filed"
- Avoid "it is" constructions: "It is not filed..." → "You do not file..."
- No filler words from banned list

### Structure (weight 0.12 → ~0.15 without LLM)
- Exactly 1 H1 (1 pt)
- ≥ 3 H2 headings (1 pt)
- ≥ 2 H3 headings (0.5 pt)
- FAQ section present (1 pt)
- ≥ 3 internal links to /blog/* (1 pt)
- ≥ 3 authority external links (1 pt)
- Has table AND list (1 pt)
- Word count 1500-3000 (1 pt)
- Disclaimer present (0.5 pt)
- CTA links present (1 pt)
- Valid heading hierarchy (0.5 pt)

### Keyword Coverage (weight 0.20 → ~0.25 without LLM)
- Keyword in H1/title (1.5 pts)
- Keyword in first 150 words (1 pt)
- Keyword in ≥ 1 H2 heading (1 pt)
- Keyword in meta description (1 pt)
- Keyword density 0.5-2.5% (1.5 pts)
- Semantic variations: each significant keyword word appears ≥ 3 times (1 pt)
- TF-IDF score ≥ 0.75 (1 pt)
- Keyword in URL slug (0.5 pt) — slug is pre-assigned, should already match

### Schema Markup (weight 0.08 → ~0.10 without LLM)
- FAQ section triggers FAQ schema detection
- Include clear Q&A pairs in FAQ

### AEO Signals (weight 0.20 → ~0.25 without LLM)
- **Answer paragraphs**: After each H2, first paragraph should be 30-100 words and reference the heading topic (2 pts)
- **Question headings**: ≥ 3 headings ending with `?` (1.5 pts)
- **Citation density**: ≥ 2 authority citations per 500 words (1.5 pts)
- **Entity coverage**: Mention FBAR, FinCEN, BSA, foreign financial account, Report of Foreign Bank and Financial Accounts, $10,000 threshold (1 pt)
- **Definition sentences**: ≥ 2 clear "X is Y" definitions (1 pt)
- **Numbered step list**: At least one list with 3+ numbered items (0.5 pt)

---

## 9. Internal Crosslink Targets

Link to at least 3 of these articles using relative paths. Pick the most relevant ones for each topic.

### Published (9 articles)
```
/blog/fbar-cryptocurrency-foreign-exchanges
/blog/fbar-filing-deadline-2026
/blog/fbar-green-card-holders
/blog/fbar-penalties-what-happens-if-you-dont-file
/blog/how-to-calculate-maximum-account-value-fbar
/blog/fbar-first-time-filer-guide
/blog/fbar-vs-fatca-form-8938-differences
/blog/fbar-uk-bank-accounts
/blog/fbar-joint-account-reporting-rules
```

### Batch (25 articles — these are being written simultaneously, link by path)
```
/blog/fbar-canada-rrsp-tfsa-reporting
/blog/fbar-streamlined-filing-compliance-procedures
/blog/fbar-foreign-pension-retirement-accounts
/blog/fbar-australia-superannuation-bank-accounts
/blog/fbar-exchange-rates-treasury-department
/blog/fbar-india-nre-nro-accounts
/blog/who-is-a-us-person-fbar-filing
/blog/fbar-willful-vs-non-willful-penalties
/blog/fbar-business-accounts-signatory-authority
/blog/fbar-delinquent-filing-procedures
/blog/fbar-germany-bank-accounts-bausparen
/blog/fbar-vs-form-3520-foreign-trusts
/blog/fbar-foreign-life-insurance-policies
/blog/fbar-reasonable-cause-defense
/blog/fbar-france-livret-a-pea-accounts
/blog/fbar-foreign-mutual-funds-pfic
/blog/fbar-statute-of-limitations
/blog/fbar-japan-bank-accounts-nenkin
/blog/fbar-trust-reporting-requirements
/blog/fbar-mexico-bank-accounts
/blog/fbar-amending-correcting-filed-fbar
/blog/fbar-singapore-cpf-bank-accounts
/blog/fbar-voluntary-disclosure-practice
/blog/fbar-vs-form-8865-foreign-partnership
/blog/fbar-israel-bank-accounts-pensions
```

### Crosslink Strategy
- Country articles link to each other and to threshold/deadline/penalty articles
- Penalty articles link to willful vs non-willful, reasonable cause, statute of limitations
- Compliance articles link to streamlined, delinquent, voluntary disclosure
- "vs" articles link to both forms discussed
- Every article should link to at least 1 published article and at least 2 batch articles

---

## 10. Authority Link Domains

Use these domains for authoritative external links:

```
irs.gov          — IRS forms, publications, procedures
fincen.gov       — FinCEN guidance, BSA E-Filing
law.cornell.edu  — USC and CFR statutory text
congress.gov     — Legislative text
treasury.gov     — Treasury rates, regulations
gpo.gov          — Government Publishing Office
```

Every article needs ≥ 3 authority links. Common patterns:
- `[31 CFR 1010.350](https://www.law.cornell.edu/cfr/text/31/1010.350)` — FBAR regulation
- `[31 USC 5314](https://www.law.cornell.edu/uscode/text/31/5314)` — BSA reporting statute
- `[31 USC 5321](https://www.law.cornell.edu/uscode/text/31/5321)` — BSA penalties
- `[IRS Streamlined Procedures](https://www.irs.gov/individuals/international-taxpayers/streamlined-filing-compliance-procedures)`
- `[Form 8938](https://www.irs.gov/forms-pubs/about-form-8938)` — FATCA
- `[BSA E-Filing](https://bsaefiling.fincen.treas.gov/)` — Filing system
- `[Treasury exchange rates](https://fiscal.treasury.gov/reports-statements/treasury-reporting-rates-exchange/current.html)`

---

## 11. CTA Link Patterns

Include at least 2 CTA links. Use these patterns:

```markdown
[Let FBAR Direct prepare your filing](/pricing)
[See how it works](/how-it-works)
[Start your FBAR filing today](/pricing)
[Get started with FBAR Direct](/signup)
```

Place CTAs:
- Once in the middle of the article (after a section explaining a pain point)
- Once near the end in a dedicated CTA section

---

## 12. Writing Style Rules

### Tone
- **Somewhat formal**: Professional but accessible. Not academic, not casual.
- Tax content with a human voice. Write like a CPA explaining to a client.
- Use "you" and "your" to address the reader directly.

### Sentence Construction
- Target 15-20 words per sentence average.
- Split any sentence over 25 words at conjunctions (and, but, or, which).
- Max 4 sentences per paragraph. Use bullet lists for 3+ items.
- Start with the answer, not the setup. Lead with value.

### Active Voice
- "You must file the FBAR" NOT "The FBAR must be filed"
- "The IRS assesses penalties" NOT "Penalties are assessed"
- "FinCEN requires reporting" NOT "Reporting is required by FinCEN"

### Specificity
- Use exact dollar amounts: $10,000 threshold, $16,117 non-willful penalty, $100,000 willful penalty
- Cite statutes: 31 USC 5314, 31 CFR 1010.350, IRC 6038D
- Name specific institutions, account types, forms
- Include realistic scenarios with names and numbers

### FAQ Section Pattern
```markdown
## Frequently Asked Questions

**Do I need to report [specific thing]?**

[30-80 word answer paragraph. Start with Yes/No. Cite statute. Link to related article.]

**What happens if [specific scenario]?**

[30-80 word answer paragraph. Concrete answer with dollar amounts and citations.]
```

Aim for 4-6 FAQ questions per article. Each answer should be a self-contained paragraph that AI engines can extract as a featured answer.

---

## 13. Dollar Amount Reference Sheet

Use these specific amounts (with statute citations nearby):

| Amount | Context | Citation |
|--------|---------|----------|
| $10,000 | FBAR aggregate threshold | 31 CFR 1010.306 |
| $16,117 | Non-willful penalty per violation (2025 inflation) | 31 USC 5321(a)(5)(B) |
| $12,909 | Non-willful penalty (2023 base) | 31 USC 5321(a)(5)(B) |
| $100,000 | Willful penalty floor (or 50% of balance) | 31 USC 5321(a)(5)(C) |
| $50,000 | FATCA domestic threshold (last day) | 26 USC 6038D |
| $75,000 | FATCA domestic threshold (any time) | 26 USC 6038D |
| $200,000 | FATCA expat threshold (last day, single) | 26 USC 6038D |
| $300,000 | FATCA expat threshold (any time, single) | 26 USC 6038D |
| $400,000 | FATCA expat threshold (last day, joint) | 26 USC 6038D |
| $600,000 | FATCA expat threshold (any time, joint) | 26 USC 6038D |
| $10,000 | Form 3520 foreign gift threshold | IRC 6039F |

---

## 14. Structural Template (from published article)

```mdx
---
title: "FBAR [Topic]: [Subtitle]"
description: "[keyword-rich 150-160 char description]"
publishedDate: "YYYY-MM-DD"
author: "Matt Cohen, CPA"
heroImage: "/blog/[slug].webp"
---

FBAR Direct prepares and files your FBAR (FinCEN Form 114) on your behalf. You must review all details for accuracy before we submit to FinCEN. This article is for general guidance only and does not constitute tax, legal, or financial advice.

# FBAR [Topic]: [Subtitle matching title]

[2-3 intro paragraphs. Keyword in first sentence. Context, scope, why reader should care.]

## [Question H2 — e.g., "Which Accounts Are Reportable?"]?

[Answer paragraph 30-100 words directly answering the question, with authority citations.]

[More detail, examples, bullet lists as needed.]

### [H3 — Specific Subtopic]

[Detailed content with dollar amounts, citations, examples.]

### [H3 — Another Subtopic]

[Content...]

## [Question H2 — e.g., "What Penalties Apply?"]?

[Answer paragraph with specific dollar amounts and statute citations.]

[Table comparing penalties, thresholds, or options.]

| Category | Detail | Citation |
|----------|--------|----------|
| ... | ... | ... |

## [Statement H2 — e.g., "Real-World Scenarios"]

### Scenario 1: [Descriptive Name]

[Realistic example with specific names, amounts, account types, USD conversions.]

### Scenario 2: [Descriptive Name]

[Another scenario showing a different filing situation.]

## [Question H2]?

[Answer paragraph.]

1. Step one of a process
2. Step two of a process
3. Step three of a process

[FBAR Direct can help — [see our pricing](/pricing) for filing support.]

## Frequently Asked Questions

**[Question about topic]?**

[30-80 word answer. Start with Yes/No when applicable. Cite statute. Internal link.]

**[Question about topic]?**

[30-80 word answer.]

**[Question about topic]?**

[30-80 word answer.]

**[Question about topic]?**

[30-80 word answer.]

## Let FBAR Direct Handle Your [Topic] Filing

[Topic] makes FBAR filing harder — [specific pain points]. Getting these wrong can lead to penalties or IRS notices.

[Let FBAR Direct prepare your filing](/pricing) — you review and approve before we submit to FinCEN. Upload your statements and we handle conversion, reporting, and submission. [See how it works](/how-it-works).

This article is current as of [Month DD, YYYY]. Tax rules change — verify current rules at [IRS.gov](https://www.irs.gov) or [FinCEN.gov](https://www.fincen.gov). Consult a qualified tax pro for advice specific to your case.
```

---

## 15. Agent Execution Steps

0. **READ THIS GUIDE** — internalize all rules before writing.
1. **READ NLP TARGETS**: Read `src/content/drafts/<slug>.diy-surfer-targets.json` (or `.surfer-targets.json` for legacy articles) — target ALL high-priority NLP terms at specified frequencies, >=70% medium-priority terms, word count and heading count within target ranges. If no targets file exists, run: `node scripts/seo-scorer/index.mjs extract "<keyword>" --slug <slug>` (see Section 0).
2. **WRITE** the draft to `src/content/drafts/<slug>.mdx` following this guide exactly, incorporating NLP targets throughout.
3. **VALIDATE**: `node scripts/validate-article.mjs <slug>` — fix until all checks PASS.
4. **SCORE**: `set -a && source .env && set +a && node scripts/seo-scorer/index.mjs score <slug> --no-llm --no-serp --save`
5. **If DIY score < 9.0**: Read the `.diy-score.json` file, identify lowest `(10 - score) * weight` dimensions, fix those issues, re-score. Max 4 iterations.
6. **If DIY score >= 9.0**: DONE with writing phase. Report final score.

### Common Score Fixes
- **Low readability**: Split sentences over 25 words. Shorten paragraphs.
- **Low keyword coverage**: Add keyword to H1, first paragraph, H2, meta description. Increase density to 0.5-2.5%.
- **Low structure**: Add more H2s, H3s, internal links, authority links, tables, lists.
- **Low AEO**: Add question headings (ending with ?), concise answer paragraphs (30-100w), definition sentences, numbered lists.
- **Low writing quality**: Convert passive to active voice. Remove filler words. Fix "it is" constructions.
