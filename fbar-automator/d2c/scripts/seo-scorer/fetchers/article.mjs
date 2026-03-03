/**
 * article.mjs — Article loader and normalizer.
 *
 * Reads an MDX article from disk (drafts or published blog directory),
 * resolves the target keyword from the content queue, and returns a
 * fully normalized article object ready for scoring.
 *
 * External dependencies (all in d2c/package.json):
 *   - remark, remark-gfm, remark-html  (Markdown -> HTML)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

import {
  QUEUE_PATH,
  DRAFTS_DIR,
  BLOG_DIR,
} from '../utils/config.mjs';

import {
  stripMarkdown,
  extractHeadings,
  extractLinks,
  parseFrontmatter,
  extractParagraphs,
  extractSentences,
} from '../utils/markdown.mjs';

import { getWords, countWords } from '../utils/text.mjs';

// ---------------------------------------------------------------------------
// Content queue lookup
// ---------------------------------------------------------------------------

/**
 * Read the content queue manifest and return the entry matching a slug.
 *
 * @param {string} slug  Article slug (e.g. "fbar-first-time-filer-guide").
 * @returns {Promise<object|null>}  Queue entry or null if not found.
 */
async function lookupQueueEntry(slug) {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf-8');
    const queue = JSON.parse(raw);
    const topics = queue.topics || [];
    return topics.find((t) => t.slug === slug) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the MDX file path for a slug.
 *
 * Lookup order:
 *   1. Drafts directory  (work-in-progress articles)
 *   2. Blog directory    (published articles)
 *
 * When `published` is true, the blog directory is checked first.
 *
 * @param {string}  slug
 * @param {boolean} published  Prefer published version.
 * @returns {Promise<string>}  Absolute file path.
 * @throws {Error}  If no MDX file is found in either directory.
 */
async function resolveFilePath(slug, published) {
  const draftPath = path.join(DRAFTS_DIR, `${slug}.mdx`);
  const blogPath = path.join(BLOG_DIR, `${slug}.mdx`);

  const first = published ? blogPath : draftPath;
  const second = published ? draftPath : blogPath;

  for (const candidate of [first, second]) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // not found — try next
    }
  }

  throw new Error(
    `Article not found for slug "${slug}". ` +
      `Checked:\n  ${draftPath}\n  ${blogPath}`,
  );
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

/**
 * Render Markdown body to HTML using remark + remark-gfm + remark-html.
 *
 * @param {string} markdownBody  Markdown content (frontmatter already stripped).
 * @returns {Promise<string>}    HTML string.
 */
async function renderHtml(markdownBody) {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdownBody);

  return String(result);
}

// ---------------------------------------------------------------------------
// Content feature detection
// ---------------------------------------------------------------------------

/**
 * Detect structural content features in the Markdown body.
 *
 * @param {string} body       MDX body (after frontmatter).
 * @param {string} plainText  Stripped plain text.
 * @returns {{
 *   hasFAQ: boolean,
 *   hasTable: boolean,
 *   hasList: boolean,
 *   hasDisclaimer: boolean,
 * }}
 */
function detectFeatures(body, plainText) {
  const bodyLower = body.toLowerCase();
  const textLower = plainText.toLowerCase();

  // FAQ — heading containing "FAQ", "frequently asked", or "common questions"
  const hasFAQ =
    /^#{1,6}\s+.*(?:faq|frequently\s+asked|common\s+questions)/im.test(body);

  // Table — pipe-delimited table syntax
  const hasTable = /^\|.+\|$/m.test(body);

  // List — unordered or ordered list items
  const hasList = /^\s*[-*+]\s+/m.test(body) || /^\s*\d+\.\s+/m.test(body);

  // Disclaimer — common legal/financial disclaimer phrases
  const hasDisclaimer =
    textLower.includes('not constitute') ||
    textLower.includes('informational purposes only') ||
    textLower.includes('does not constitute') ||
    textLower.includes('consult a qualified') ||
    textLower.includes('this article is for informational') ||
    textLower.includes('disclaimer');

  return { hasFAQ, hasTable, hasList, hasDisclaimer };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and normalize an article for scoring.
 *
 * @param {string} slug  Article slug (filename without .mdx extension).
 * @param {object} [options]
 * @param {boolean} [options.published=false]       Prefer published version.
 * @param {string|null} [options.keywordOverride=null]  Override keyword lookup.
 * @returns {Promise<object>}  Normalized article object.
 * @throws {Error}  If article file or keyword cannot be resolved.
 */
export async function loadArticle(
  slug,
  { published = false, keywordOverride = null } = {},
) {
  // 1. Resolve file path
  const filePath = await resolveFilePath(slug, published);

  // 2. Read raw content
  const rawContent = await fs.readFile(filePath, 'utf-8');

  // 3. Parse frontmatter
  const { meta, body } = parseFrontmatter(rawContent);

  // 4. Resolve keyword
  let keyword = keywordOverride;
  if (!keyword) {
    const entry = await lookupQueueEntry(slug);
    if (entry && entry.keyword) {
      keyword = entry.keyword;
    }
  }
  if (!keyword) {
    throw new Error(
      `No keyword found for slug "${slug}". ` +
        `Provide keywordOverride or add slug to content-queue.json.`,
    );
  }

  // 5. Process text
  const plainText = stripMarkdown(body);
  const words = getWords(plainText);
  const wordCount = words.length;
  const sentences = extractSentences(plainText);
  const paragraphs = extractParagraphs(body);
  const headings = extractHeadings(body);
  const links = extractLinks(body);

  // 6. Render HTML
  const html = await renderHtml(body);

  // 7. Detect features
  const { hasFAQ, hasTable, hasList, hasDisclaimer } = detectFeatures(
    body,
    plainText,
  );

  // 8. Load NLP targets: Surfer (manual) first, DIY fallback second
  let surferTargets = null;
  const surferPath = path.join(DRAFTS_DIR, `${slug}.surfer-targets.json`);
  const diySurferPath = path.join(DRAFTS_DIR, `${slug}.diy-surfer-targets.json`);
  for (const candidatePath of [surferPath, diySurferPath]) {
    try {
      const raw = await fs.readFile(candidatePath, 'utf-8');
      surferTargets = JSON.parse(raw);
      break; // Use first found
    } catch {
      // Try next candidate
    }
  }

  return {
    slug,
    keyword,
    filePath,
    meta,
    rawContent,
    body,
    plainText,
    html,
    words,
    wordCount,
    sentences,
    paragraphs,
    headings,
    links,
    hasFAQ,
    hasTable,
    hasList,
    hasDisclaimer,
    surferTargets,
  };
}
