/**
 * keyword-expand.mjs — Corpus expansion for niche keywords with sparse SERP results.
 *
 * Augments a keyword's analysis corpus with:
 *   1. DataForSEO keyword_suggestions — variant queries driving additional SERP fetches
 *   2. Hardcoded IRS/FinCEN authority seed URLs
 *   3. Self-referencing published articles from this site whose topics overlap
 *
 * Falls back gracefully when DataForSEO credentials are absent (uses the
 * `serpRelatedSearches` param instead) and when the content queue is missing
 * or unreadable. Never throws — all errors are logged as warnings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchSerpData } from './serp.mjs';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const D2C_ROOT = path.resolve(__dirname, '..', '..', '..');
const DRAFTS_DIR = path.join(D2C_ROOT, 'src', 'content', 'drafts');
const BLOG_DIR = path.join(D2C_ROOT, 'src', 'content', 'blog');
const QUEUE_PATH = path.join(D2C_ROOT, 'src', 'content', 'content-queue.json');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATAFORSEO_ENDPOINT =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live';

/** IRS / FinCEN authoritative sources always included in the expanded corpus. */
const AUTHORITY_SEED_URLS = [
  'https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar',
  'https://www.fincen.gov/report-foreign-bank-and-financial-accounts',
  'https://bsaefiling.fincen.treas.gov/NoRegFBARFiler.html',
  'https://www.irs.gov/individuals/international-taxpayers/foreign-bank-and-financial-accounts',
];

// ---------------------------------------------------------------------------
// DataForSEO helpers
// ---------------------------------------------------------------------------

/**
 * Fetch keyword suggestions from DataForSEO.
 *
 * Returns an array of query strings (top 3-5 by search volume). Returns an
 * empty array if credentials are missing or the request fails.
 *
 * @param {string} keyword
 * @returns {Promise<string[]>}
 */
async function fetchDataForSeoSuggestions(keyword) {
  const login = process.env.DATAFORSEO_LOGIN || '';
  const password = process.env.DATAFORSEO_PASSWORD || '';

  if (!login || !password) {
    return [];
  }

  const credentials = Buffer.from(`${login}:${password}`).toString('base64');

  try {
    const response = await fetch(DATAFORSEO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        { keyword, language_code: 'en', location_code: 2840 },
      ]),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.warn(
        `[keyword-expand] DataForSEO returned ${response.status}: ${errorText}`,
      );
      return [];
    }

    const json = await response.json();
    const items =
      json?.tasks?.[0]?.result?.[0]?.items ||
      json?.tasks?.[0]?.result ||
      [];

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    // Sort descending by search_volume, take top 5
    const sorted = [...items]
      .filter((item) => item.keyword && item.keyword !== keyword)
      .sort(
        (a, b) =>
          (b.keyword_info?.search_volume ?? 0) -
          (a.keyword_info?.search_volume ?? 0),
      )
      .slice(0, 5);

    return sorted.map((item) => item.keyword);
  } catch (err) {
    console.warn(
      `[keyword-expand] DataForSEO request failed for "${keyword}": ${err.message}`,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Content-queue helpers
// ---------------------------------------------------------------------------

/**
 * Load the content queue JSON, returning an empty array on failure.
 *
 * @returns {Promise<object[]>}
 */
async function loadContentQueue() {
  try {
    const raw = await fs.readFile(QUEUE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Support both array and { topics: [] } shapes
    return Array.isArray(parsed) ? parsed : (parsed.topics ?? []);
  } catch {
    return [];
  }
}

/**
 * Extract significant words (length > 3) from a keyword phrase.
 *
 * @param {string} phrase
 * @returns {string[]}
 */
function significantWords(phrase) {
  return phrase
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
}

/**
 * Check whether two keyword phrases share ≥ 2 significant words.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function keywordsOverlap(a, b) {
  const setA = new Set(significantWords(a));
  const wordsB = significantWords(b);
  const overlap = wordsB.filter((w) => setA.has(w));
  return overlap.length >= 2;
}

/**
 * Strip MDX/Markdown frontmatter and return plain text.
 *
 * Does not import any other modules — intentionally self-contained to
 * avoid circular dependencies with loadArticle.
 *
 * @param {string} raw  Raw MDX/Markdown file contents.
 * @returns {string}
 */
function mdxToPlainText(raw) {
  // Remove YAML frontmatter (--- ... ---)
  let text = raw.replace(/^---[\s\S]*?---\s*/m, '');

  // Remove import/export lines
  text = text.replace(/^(import|export)\s+.*$/gm, '');

  // Remove JSX/HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Remove markdown headings, bold, italic, links, code fences
  text = text
    .replace(/^#+\s+/gm, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/```[\s\S]*?```/g, '');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Find published articles in the content queue that overlap with `keyword`,
 * load their MDX, and return extracted plain text.
 *
 * @param {string} keyword      The target keyword.
 * @param {string} [draftsDir]  Override for drafts directory.
 * @param {string} [blogDir]    Override for blog directory.
 * @returns {Promise<Array<{ slug: string, text: string, keyword: string }>>}
 */
async function loadSelfRefArticles(keyword, draftsDir, blogDir) {
  const dDir = draftsDir || DRAFTS_DIR;
  const bDir = blogDir || BLOG_DIR;
  const queue = await loadContentQueue();
  const results = [];

  for (const topic of queue) {
    if (topic.status !== 'published') continue;
    const topicKeyword = topic.keyword || topic.slug || '';
    if (!keywordsOverlap(keyword, topicKeyword)) continue;

    const slug = topic.slug || '';
    if (!slug) continue;

    // Try blog dir first, fall back to drafts
    const candidates = [
      path.join(bDir, `${slug}.mdx`),
      path.join(dDir, `${slug}.mdx`),
    ];

    let text = null;
    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        text = mdxToPlainText(raw);
        break;
      } catch {
        // try next candidate
      }
    }

    if (text && text.length > 100) {
      results.push({ slug, text, keyword: topicKeyword });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand the analysis corpus for a keyword with variant queries and authority content.
 *
 * Workflow:
 *   1. Fetch DataForSEO keyword suggestions (or use `serpRelatedSearches` as fallback).
 *   2. For each query variation, fetch SERP results to gather competitor URLs.
 *   3. Always include hardcoded IRS/FinCEN authority seed URLs.
 *   4. Scan the content queue for published articles that overlap with `keyword`.
 *
 * @param {string}   keyword                        Primary keyword being scored.
 * @param {object}  [options]
 * @param {string[]} [options.serpRelatedSearches]  Fallback query variants (used when DataForSEO credentials are absent).
 * @param {string}  [options.draftsDir]             Override for drafts directory path.
 * @param {string}  [options.blogDir]               Override for blog directory path.
 * @returns {Promise<{
 *   expandedUrls: string[],
 *   queryVariations: string[],
 *   authSeeds: string[],
 *   selfRefArticles: Array<{ slug: string, text: string, keyword: string }>
 * }>}
 */
export async function expandCorpus(
  keyword,
  { serpRelatedSearches = [], draftsDir, blogDir } = {},
) {
  // Step 1: Get query variations
  let queryVariations = await fetchDataForSeoSuggestions(keyword);

  // Fallback: use serpRelatedSearches if DataForSEO returned nothing
  if (queryVariations.length === 0 && serpRelatedSearches.length > 0) {
    queryVariations = serpRelatedSearches.slice(0, 5);
  }

  // Step 2: Fetch SERP data for each variation, collect unique URLs
  const expandedUrlSet = new Set();

  await Promise.all(
    queryVariations.map(async (query) => {
      try {
        const serpData = await fetchSerpData(query);
        if (serpData && Array.isArray(serpData.topResults)) {
          for (const result of serpData.topResults) {
            if (result.url) {
              expandedUrlSet.add(result.url);
            }
          }
        }
      } catch (err) {
        console.warn(
          `[keyword-expand] SERP fetch failed for variation "${query}": ${err.message}`,
        );
      }
    }),
  );

  const expandedUrls = Array.from(expandedUrlSet);

  // Step 3: Authority seeds (always included)
  const authSeeds = [...AUTHORITY_SEED_URLS];

  // Step 4: Self-referencing published articles
  let selfRefArticles = [];
  try {
    selfRefArticles = await loadSelfRefArticles(keyword, draftsDir, blogDir);
  } catch (err) {
    console.warn(
      `[keyword-expand] Self-ref article load failed for "${keyword}": ${err.message}`,
    );
  }

  return {
    expandedUrls,
    queryVariations,
    authSeeds,
    selfRefArticles,
  };
}
