# Gap #20: Blog placeholder — zero published articles

## Status: DONE (2026-03-01)

All items in this gap have been resolved:
- **Rendering bug fixed**: Added `remark` + `remark-html` pipeline to `d2c/src/lib/blog.ts`. Raw markdown is now converted to HTML before rendering via `renderMarkdownToHtml()`. XSS protection preserved via `sanitize-html` post-conversion.
- **Typography plugin installed**: `@tailwindcss/typography` added to `package.json` and `tailwind.config.ts`. `prose` classes now render correctly on blog posts.
- **5 blog articles published** (commit 4dbe9a5):
  1. `how-to-calculate-maximum-account-value-fbar.mdx` — 2,154 words
  2. `fbar-green-card-holders.mdx` — 2,044 words
  3. `fbar-cryptocurrency-foreign-exchanges.mdx` — 2,279 words
  4. `fbar-filing-deadline-2026.mdx` — 2,176 words
  5. `fbar-penalties-what-happens-if-you-dont-file.mdx` — 2,533 words
- **Blog E2E tests passing**: All 9 tests in `tests/e2e/blog.spec.ts` pass (fixed navigation tests for Next.js soft navigation).
- **Author schema enhanced**: BlogPosting JSON-LD includes `jobTitle: 'CPA'` and `affiliation: FBAR Direct`.

### Remaining (not code):
- n8n content pipeline (GTM_V1_REVISED.md Section 5) — not yet implemented
- Additional articles beyond first 5 — needed for Content grade A

---

**Severity:** Low
**Effort:** XL (1-3 days for first 5 articles + n8n pipeline setup; S for a single manual article)
**Depends on:** None (infrastructure is complete)

## Problem

The blog index at `/blog` renders "Articles coming soon." (line 23 of `blog/page.tsx`) because `src/content/blog/` contains only a `.gitkeep` file. The MDX infrastructure is fully operational — packages installed, routes defined, `getBlogPosts()` implemented — but zero `.mdx` files exist. The blog is indexed by the sitemap and crawled by search engines, serving an empty page against a URL that implies live content.

SEO impact is direct: the blog is the primary inbound organic channel in the GTM strategy (GTM_V1_REVISED.md, Section 3, "What Remains"). Without content, the five programmatic country pages and three comparison pages link to a dead resource, reducing internal link equity.

## Current State

**Infrastructure (all complete — do not modify):**

- `d2c/src/lib/blog.ts` — `getBlogPosts()` reads `src/content/blog/*.mdx` via `gray-matter`, sorts by `publishedDate` descending. `getBlogPost(slug)` returns `{ meta, content }` where `content` is raw markdown string (lines 16-39).
- `d2c/src/app/(marketing)/blog/page.tsx` — Index page. Line 12 calls `getBlogPosts()`. Lines 22-24: if `posts.length === 0`, renders `<p className="text-gray-500">Articles coming soon.</p>`. Lines 25-39: renders post list when articles exist.
- `d2c/src/app/(marketing)/blog/[slug]/page.tsx` — Detail page. Lines 7-8: `generateStaticParams()` calls `getBlogPosts()` — returns empty array with zero articles, so no static pages are pre-built. Line 82: renders content via `dangerouslySetInnerHTML` from gray-matter's `content` string (raw markdown, not rendered HTML — this is a rendering bug, see Risks section).
- `d2c/src/content/blog/` — Directory exists, contains only `.gitkeep`.
- **MDX packages installed:** `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `remark-gfm`, `gray-matter` (per GTM_V1_REVISED.md Phase 3 status).

**The automated pipeline (not yet built):**

GTM_V1_REVISED.md Section 5 documents a full n8n + Claude API + Gemini pipeline. That pipeline is the right long-term solution but is a separate XL effort. The gap here is addressable independently by writing MDX files manually.

## Implementation Plan

### Option A: Manual first articles (unblocks SEO immediately, S effort per article)

Write `.mdx` files directly in `d2c/src/content/blog/`. No code changes required. The infrastructure picks them up automatically on the next build.

**Required frontmatter schema** (from `blog.ts` line 23, `BlogPost` interface lines 6-12):

```mdx
---
title: "How to Calculate Maximum Account Value for FBAR"
slug: "how-to-calculate-maximum-account-value-fbar"
description: "Step-by-step guide to finding the highest balance across all 12 monthly statements, converting foreign currencies using Treasury reporting rates, and what counts as maximum value under 31 CFR 1010.350."
publishedDate: "2026-02-20"
author: "[Founder Name], CPA"
heroImage: "/blog/how-to-calculate-maximum-account-value-fbar/hero.png"
---

## [First section heading — never use "Introduction"]

Article body in standard markdown...
```

Note: `slug` in frontmatter is redundant (the filename is used as the slug at `blog.ts` line 23) but harmless to include for n8n pipeline compatibility.

**First 5 articles (per GTM_V1_REVISED.md Section 5, "First 5 Articles"):**

| Priority | Slug | Target keyword |
|----------|------|----------------|
| 1 | `how-to-calculate-maximum-account-value-fbar.mdx` | "how to calculate maximum account value FBAR" |
| 2 | `fbar-green-card-holders.mdx` | "FBAR green card holder" |
| 3 | `fbar-cryptocurrency-foreign-exchanges.mdx` | "FBAR cryptocurrency foreign exchange" |
| 4 | `fbar-filing-deadline-2026.mdx` | "FBAR deadline 2026" |
| 5 | `fbar-penalties-what-happens-if-you-dont-file.mdx` | "FBAR penalty" |

**Minimum article structure (per GTM quality bar in GTM_V1_REVISED.md):**
- 1,500-2,500 words
- Minimum 3 specific dollar amounts per 500 words
- Minimum 2 regulatory citations per 500 words (IRS pub numbers, CFR sections, IRC sections)
- At least one concrete example per section (e.g., "For example, if you have a Swiss account with CHF 50,000...")
- CTA to FBARDirect at least twice: once mid-article, once at end
- No banned phrases: "navigating the complex landscape," "it's important to note," "comprehensive guide," etc.

### Step 2: Fix content rendering bug in `[slug]/page.tsx`

**File:** `d2c/src/app/(marketing)/blog/[slug]/page.tsx`, line 82.

Current code:
```tsx
<div dangerouslySetInnerHTML={{ __html: post.content }} />
```

`getBlogPost()` in `blog.ts` line 38 returns `content` from gray-matter, which is the raw markdown string — not HTML. `dangerouslySetInnerHTML` with raw markdown will render the markdown syntax characters literally (e.g., `## Heading` appears as text, not an `<h2>`).

**Fix:** Use a markdown-to-HTML converter before rendering. The project already has `remark-gfm` installed. Add `remark` + `remark-html` (or use the existing MDX pipeline):

```typescript
// In [slug]/page.tsx — add at top:
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

// In getBlogPost or in the page component:
async function renderMarkdown(content: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  return result.toString();
}

// In BlogPostPage (make it async if not already):
const html = await renderMarkdown(post.content);
// Replace dangerouslySetInnerHTML usage:
<div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
```

`remark-html` needs to be installed: `npm install remark remark-html` (remark-gfm is already present).

Alternatively, replace the filesystem-read approach entirely with Next.js MDX `import()` for full MDX component support, but that requires changing `getBlogPost()` to use dynamic imports — more complexity than needed for text articles.

### Step 3: n8n automated pipeline (XL — separate effort)

The full pipeline is documented in GTM_V1_REVISED.md Section 5 with complete n8n node configurations. This is the correct long-term solution for 3 articles/week cadence. Prerequisites:

- n8n self-hosted and accessible
- Anthropic API key (Sonnet + Haiku access)
- Gemini API key for image generation
- GitHub PAT with `contents:write`
- `d2c/src/content/content-queue.json` created with topic queue

The pipeline commits `.mdx` files and hero images directly to the repo, triggering a rebuild on Hetzner. No code changes to the D2C app are required once the rendering bug (Step 2) is fixed.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/content/blog/*.mdx` | Create: 5 new MDX article files (manual authoring) |
| `d2c/src/app/(marketing)/blog/[slug]/page.tsx` | Fix: replace raw `dangerouslySetInnerHTML` with remark-rendered HTML (line 82) |
| `d2c/src/content/content-queue.json` | Create: topic queue for n8n pipeline (n8n pipeline step only) |

## Environment / Config Changes

None required for manual articles. The blog route is already public (middleware blocklist pattern confirmed in GTM_V1_REVISED.md Phase 0 status).

For the n8n pipeline, the following environment variables are needed on the n8n host (not on the D2C app server):
- `ANTHROPIC_API_KEY` — for Claude API calls in n8n
- `GEMINI_API_KEY` — for Gemini API image generation (fbar-direct project)
- `GITHUB_PAT` — for committing MDX files to the repo

## Testing

**Manual verification after adding first article:**
1. Drop a `.mdx` file into `d2c/src/content/blog/` with correct frontmatter
2. Run `npm run build` in `d2c/` — verify the blog index page pre-renders the article and `[slug]` generates a static route
3. Run `npm run dev` and navigate to `/blog` — article must appear in the list with correct title, description, author, and date
4. Navigate to `/blog/[slug]` — article body must render as formatted HTML (headings, paragraphs, bold, links), not raw markdown characters
5. Verify JSON-LD `BlogPosting` schema renders in `<head>` (check via browser devtools or `curl`)
6. Verify the article appears in `sitemap.xml` at `/sitemap.xml`

**E2E test:** Add a test to `d2c/tests/e2e/marketing.spec.ts` (or a new `blog.spec.ts`) that:
- Navigates to `/blog`
- Asserts the article list renders (not the "coming soon" placeholder)
- Navigates to the first article's detail page
- Asserts the `<h1>` matches the article title
- Asserts the body contains rendered HTML (e.g., at least one `<h2>` tag in the prose div)

## Risks / Notes

**Rendering bug is the most important fix.** Without Step 2, articles would publish with broken formatting. All markdown headings, bold text, links, and lists would appear as raw syntax characters.

**`prose` CSS classes require `@tailwindcss/typography` plugin.** The detail page uses `prose prose-gray max-w-none` on line 79. Verify this plugin is installed (`d2c/package.json` should have `@tailwindcss/typography` in devDependencies). If missing, add it and configure in `tailwind.config.ts`.

**Content indexing timing:** Google typically indexes new pages within 1-4 weeks for an established domain. Seasonal content (e.g., "FBAR deadline 2026") should be published at least 6 weeks before the April 15 deadline to allow indexing time.

**No email preview available:** The `heroImage` frontmatter field is optional (blog.ts line 11). Articles without a hero image will still render correctly on the detail page — the current detail page template does not render a hero image element. If hero images are added, the `<img>` element needs to be added to `[slug]/page.tsx` (currently absent from the template).

**Anti-enumeration pattern in signup route is unrelated** — the "Check your email to continue." response message that currently appears in the signup API (signup/route.ts line 49) implies email verification exists, but it does not (see Gap #22). This is a separate UX gap, not a blog concern.
