# Blog Engine Writer Guide

Comprehensive reference for autonomous article writing agents. Follow every rule exactly.

This guide is niche-agnostic. All niche-specific values (disclaimers, CTAs, authority domains, crosslinks) come from the project config in `configs/<name>.json`.

---

## 0. Read NLP Targets Before Writing

Before writing ANY article, the agent MUST read the NLP targets file:

1. `output/<slug>/surfer-targets.json` **(PRIMARY -- SurferSEO-extracted NLP targets)**
2. If no targets file exists, generate targets using the Surfer workflow or DIY extract command before proceeding.

### What to target:
- ALL high_priority terms at their target frequency ranges
- >=70% of medium_priority terms at their target frequency ranges
- Word count within the `targets.wordCount` range (min-max)
- Heading count within the `targets.headings` range (min-max)

**PRIMARY GATE**: SurferSEO Content Score >=90 (verified via `surfer-targets.json`)

### Accuracy Override:
Factual accuracy ALWAYS wins over NLP term targets. Never change factual claims, citations, dollar amounts, or legal references to hit an NLP target. If an NLP target conflicts with accuracy, accuracy wins.

### If no targets file exists:
Generate targets before writing. Do NOT proceed with writing until `output/<slug>/surfer-targets.json` exists.

---

## 1. Research Before Writing

**Mandatory**: Every article MUST have a research brief before the writing phase begins.

### Research Brief Process

1. **Read authority sources** from the project config (`research.authorityDomains`, `research.primarySources`)
2. **Analyze top 5-10 SERP competitors** for the target keyword
3. **Output** a research brief to `output/<slug>/research-brief.md`

### Research Brief Contents

```markdown
# Research Brief: [Target Keyword]

## Key Facts with Citations
- [Fact 1] — Source: [URL or statute]
- [Fact 2] — Source: [URL or statute]
...

## Competitor Gaps
- [Gap 1]: Competitors miss [topic/angle]
- [Gap 2]: No competitor covers [specific detail]
...

## Unique Angles
- [Angle 1]: We can differentiate by [approach]
- [Angle 2]: Fresh data/perspective on [topic]
...

## Authority Sources to Cite
- [Source 1]: [URL]
- [Source 2]: [URL]
...
```

**No writing without a research brief.** The brief ensures factual accuracy, identifies competitor gaps, and provides unique angles that improve both SEO and reader value.

---

## 2. Frontmatter Schema

```yaml
---
title: "[Keyword-Rich Title]"
description: "[150-160 chars, includes target keyword, summarizes article value]"
publishedDate: "YYYY-MM-DD"
author: "[Author name from config — config.author.name, config.author.credentials]"
heroImage: "/blog/[slug].webp"
---
```

- `title`: Must contain the target keyword. Max ~70 chars for SERP display.
- `description`: Must contain the target keyword. 150-160 chars ideal.
- `publishedDate`: Use a future date.
- `author`: Use the name and credentials from the project config.
- `heroImage`: Path to the hero image. Generated separately via `generate-hero-image.mjs`.

---

## 3. Article Structure

### Heading Hierarchy

```
# [H1 -- Article Title, matches frontmatter title, contains keyword] (exactly 1)

[Disclaimer paragraph — use disclaimerTop from project config, if configured]

[Intro: 2-3 paragraphs, keyword in first 150 words, hook + context + scope]

## [H2 -- Major Section] (at least 3 H2s, at least 2 should be questions ending with ?)
[Answer paragraph: 30-100 words, directly answers the heading, contains heading topic words]

### [H3 -- Subsection] (at least 2 H3s total)
[Content]

## [H2 -- Another Section]
...

## Frequently Asked Questions
[FAQ section with bold questions and answer paragraphs]

## [CTA Section — if CTAs are configured]
[CTA paragraph with links from config.content.ctaTemplates]

[Disclaimer paragraph — use disclaimerBottom from project config, if configured]
```

### Key Rules
- Exactly 1 H1 (the article title)
- At least 3 H2 headings
- At least 2 H3 headings
- H1 -> H2 -> H3 hierarchy, no skipping levels
- At least 2 H2s should be questions ending with `?`
- Include a "Frequently Asked Questions" section
- Include at least 1 comparison table (use markdown `| | |` tables)
- Include at least 1 bulleted or numbered list

---

## 4. Disclaimers

Use disclaimers from the project config:

- **Top disclaimer**: `config.content.disclaimerTop` -- place as first paragraph after H1
- **Bottom disclaimer**: `config.content.disclaimerBottom` -- place as last paragraph

If the config does not specify disclaimers (or `config.validation.requireDisclaimers` is false), omit them.

The validator checks for the exact disclaimer text (case-insensitive substring match). Copy it verbatim from the config.

---

## 5. Banned Phrases (33 -- hard fail if found)

These exact phrases must NOT appear anywhere in the article body. Defined in `anti-slop-rules.json`:

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

## 6. Banned Filler Words (12 -- tone fail)

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

## 7. Complex -> Simple Word Substitutions (9)

| Complex | Simple |
|---------|--------|
| denominated | held in |
| electronically | online |
| authorization | approval |
| independently | separately |
| approximately | about |
| subsequently | then |
| determination | decision |
| constitute | make up |
| requirements | rules (where meaning is preserved) |

Niche-specific technical terms (from `config.content.protectedWords`) are exempt -- only replace general vocabulary.

---

## 8. Validation Hard-Fail Rules

The `validate-article.mjs` script checks these. **Universal checks** always run. **Config-driven checks** only run if the config enables them.

### Universal Checks (always run):
1. **Frontmatter complete** -- title, description, publishedDate, author, heroImage all present
2. **Word count >= 2000** -- aim for 2000-3000 words
3. **Exactly 1 H1** -- the article title
4. **Zero banned phrases** -- none of the 33 phrases from Section 5
5. **Published date is future** -- publishedDate must be after today

### Config-Driven Checks:
6. **Disclaimers present** (`requireDisclaimers`) -- exact text from config
7. **CTA links** (`requireCTAs`) -- links matching patterns from config
8. **Dollar amount density** (`requireDollarAmounts`) -- density from config
9. **Citation density** (`requireStatuteCitations`) -- authority link + statute density from config
10. **Penalty claims cite statute** (`requireStatuteCitations` + `penaltyClaimPattern`) -- dollar penalty claims need statute within 200 chars
11. **Deadline claims cite source** (`requireStatuteCitations` + `deadlineClaimPattern`) -- deadline claims need citation within 200 chars

---

## 9. DIY Scorer Dimension Targets (Supplementary Reference)

> **Note:** The **primary SEO quality gate is SurferSEO Content Score >=90** (verified via `surfer-targets.json`). These dimensions are supplementary reference.

### Readability
- **Flesch Reading Ease**: 50-70. Write clear sentences.
- **Avg sentence length**: 12-22 words. Mix short declarative with moderate explanatory.
- **Long sentences**: < 10% over 25 words. Split at conjunctions.
- **Long paragraphs**: < 5% over 150 words. Use short paragraphs.

### Writing Quality
- Minimal passive voice (< 5 instances)
- Active voice: "You must file" not "The form must be filed"
- Avoid "it is" constructions
- No filler words from banned list

### Structure
- Exactly 1 H1, >= 3 H2 headings, >= 2 H3 headings
- FAQ section present
- >= 3 internal links (if crosslinks configured)
- >= 3 authority external links
- Has table AND list
- Word count 1500-3000
- Disclaimer present (if configured)
- CTA links present (if configured)

### Keyword Coverage
- Keyword in H1/title
- Keyword in first 150 words
- Keyword in >= 1 H2 heading
- Keyword in meta description
- Keyword density 0.5-2.5%
- Semantic variations: each significant keyword word appears >= 3 times

### AEO Signals (Answer Engine Optimization)
- **Answer paragraphs**: After each H2, first paragraph should be 30-100 words and reference the heading topic
- **Question headings**: >= 3 headings ending with `?`
- **Citation density**: >= 2 authority citations per 500 words (if configured)
- **Definition sentences**: >= 2 clear "X is Y" definitions
- **Numbered step list**: At least one list with 3+ numbered items

---

## 10. Authority Link Domains

Use authority domains from the project config (`config.research.authorityDomains`).

Every article needs >= 3 authority links. Use markdown link format:

```markdown
[Link text](https://authority-domain.example/path)
```

---

## 11. CTA Link Patterns

Use CTA templates from the project config (`config.content.ctaTemplates`).

If CTAs are configured (`config.validation.requireCTAs`), include at least 2 CTA links:
- Once in the middle of the article (after a section explaining a pain point)
- Once near the end in a dedicated CTA section

If CTAs are not configured, omit CTA sections entirely.

---

## 12. Internal Crosslinks

Use crosslinks from the project config (`config.content.crosslinks`).

If crosslinks are configured, link to at least 3 related articles using the link base from `config.content.internalLinkBase`.

If no crosslinks are configured, omit internal links or link to relevant articles as appropriate.

---

## 13. Writing Style Rules

### Tone
- Write in the tone specified by the project config (`config.content.toneGuidance`).
- Default: Professional but accessible. Not academic, not casual.
- Use "you" and "your" to address the reader directly.

### Sentence Construction
- Target 15-20 words per sentence average.
- Split any sentence over 25 words at conjunctions (and, but, or, which).
- Max 4 sentences per paragraph. Use bullet lists for 3+ items.
- Start with the answer, not the setup. Lead with value.

### Active Voice
- "You must file the form" NOT "The form must be filed"
- "The IRS assesses penalties" NOT "Penalties are assessed"
- Active constructions throughout

### Specificity
- Use exact dollar amounts where applicable
- Cite statutes and authoritative sources
- Name specific institutions, account types, forms
- Include realistic scenarios with names and numbers

### FAQ Section Pattern
```markdown
## Frequently Asked Questions

**Do I need to [specific thing]?**

[30-80 word answer paragraph. Start with Yes/No. Cite source. Link to related article.]

**What happens if [specific scenario]?**

[30-80 word answer paragraph. Concrete answer with specific details and citations.]
```

Aim for 4-6 FAQ questions per article. Each answer should be a self-contained paragraph that AI engines can extract as a featured answer.

---

## 14. Structural Template

```mdx
---
title: "[Keyword-Rich Title]"
description: "[keyword-rich 150-160 char description]"
publishedDate: "YYYY-MM-DD"
author: "[Author from config]"
heroImage: "/blog/[slug].webp"
---

[Top disclaimer from config, if configured]

# [Title matching frontmatter title]

[2-3 intro paragraphs. Keyword in first sentence. Context, scope, why reader should care.]

## [Question H2 -- e.g., "What Are the Filing Requirements?"]?

[Answer paragraph 30-100 words directly answering the question, with authority citations.]

[More detail, examples, bullet lists as needed.]

### [H3 -- Specific Subtopic]

[Detailed content with citations, examples.]

### [H3 -- Another Subtopic]

[Content...]

## [Question H2 -- e.g., "What Are the Penalties?"]?

[Answer paragraph with specific details and citations.]

[Table comparing options, thresholds, or categories.]

| Category | Detail | Citation |
|----------|--------|----------|
| ... | ... | ... |

## [Statement H2 -- e.g., "Real-World Scenarios"]

### Scenario 1: [Descriptive Name]

[Realistic example with specific names, amounts, details.]

### Scenario 2: [Descriptive Name]

[Another scenario showing a different situation.]

## [Question H2]?

[Answer paragraph.]

1. Step one of a process
2. Step two of a process
3. Step three of a process

[CTA link from config, if configured]

## Frequently Asked Questions

**[Question about topic]?**

[30-80 word answer. Start with Yes/No when applicable. Cite source. Internal link.]

**[Question about topic]?**

[30-80 word answer.]

**[Question about topic]?**

[30-80 word answer.]

**[Question about topic]?**

[30-80 word answer.]

## [CTA Section — if configured]

[CTA paragraph with links from config.content.ctaTemplates]

[Bottom disclaimer from config, if configured. Include "This article is current as of [Month DD, YYYY]." with the publishedDate.]
```

---

## 15. Agent Execution Steps

0. **READ THIS GUIDE** -- internalize all rules before writing.
1. **LOAD CONFIG**: Read the project config from `configs/<name>.json`. Understand niche-specific requirements.
2. **RESEARCH**: Read authority sources from config. Analyze top 5-10 SERP competitors. Output research brief to `output/<slug>/research-brief.md`. (See Section 1.)
3. **READ NLP TARGETS**: Read `output/<slug>/surfer-targets.json` -- target ALL high-priority NLP terms at specified frequencies, >=70% medium-priority terms, word count and heading count within target ranges. If no targets file exists, generate targets first.
4. **WRITE** the draft to `output/<slug>/article.mdx` following this guide exactly, incorporating NLP targets throughout.
5. **VALIDATE**: `node scripts/validate-article.mjs <slug> --config configs/<name>.json` -- fix until all checks PASS.
6. **GENERATE HERO**: `node scripts/generate-hero-image.mjs <slug> --config configs/<name>.json` -- generates `output/<slug>/hero.webp`.
7. **VERIFY SURFER SCORE**: Verify that the article hits **SurferSEO Content Score >=90** against the `surfer-targets.json` file. This is the PRIMARY quality gate.
8. **DONE**: Once Surfer score >=90 is verified, writing phase is complete. Report final Surfer score.

### Common Score Fixes
- **Low readability**: Split sentences over 25 words. Shorten paragraphs.
- **Low keyword coverage**: Add keyword to H1, first paragraph, H2, meta description. Increase density to 0.5-2.5%.
- **Low structure**: Add more H2s, H3s, internal links, authority links, tables, lists.
- **Low AEO**: Add question headings (ending with ?), concise answer paragraphs (30-100w), definition sentences, numbered lists.
- **Low writing quality**: Convert passive to active voice. Remove filler words. Fix "it is" constructions.
