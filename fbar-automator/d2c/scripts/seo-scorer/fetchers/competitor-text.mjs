/**
 * competitor-text.mjs — Tiered competitor page scraper with disk caching.
 *
 * Attempts to extract clean article text from competitor URLs using two tiers:
 *   Tier 1: @extractus/article-extractor (highest quality, structured extraction)
 *   Tier 2: cheerio manual boilerplate removal (fallback)
 *
 * Scraped texts are cached to disk with a 7-day TTL. Cache files are keyed
 * by SHA-256 of the URL (first 16 chars) and stored under
 * <cacheDir>/<keywordSlug>/. A 2-second inter-domain delay and 5-second
 * per-request timeout prevent hammering competitor sites.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { extract } from '@extractus/article-extractor';
import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Fallback cache dir if none provided via options. */
const NLP_CACHE_DIR = path.join(__dirname, '..', '.nlp-cache');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 5_000;
const INTER_DOMAIN_DELAY_MS = 2_000;
const MIN_TEXT_LENGTH = 500;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Selectors for boilerplate elements to remove in Tier 2. */
const BOILERPLATE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  'noscript',
  '[class*="sidebar"]',
  '[class*="menu"]',
  '[class*="cookie"]',
  '[class*="popup"]',
  '[class*="banner"]',
  '[class*="modal"]',
  '[class*="overlay"]',
].join(', ');

/** Selectors for main content candidates, in priority order. */
const CONTENT_SELECTORS = [
  'article',
  'main',
  '[class*="content"]',
  '[class*="post"]',
  'body',
];

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string, collapsing whitespace.
 *
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Count approximate word count of plain text.
 *
 * @param {string} text
 * @returns {number}
 */
function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cache filename from a URL.
 *
 * @param {string} url
 * @returns {string}  `<sha256_16chars>.json`
 */
function urlCacheKey(url) {
  return (
    crypto.createHash('sha256').update(url).digest('hex').slice(0, 16) + '.json'
  );
}

/**
 * Ensure a cache subdirectory exists.
 *
 * @param {string} dir
 */
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Try to read a cached scrape result for a URL.
 *
 * @param {string} cacheDir   Top-level cache directory.
 * @param {string} slug       Keyword slug used as subdirectory name.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
async function readCache(cacheDir, slug, url) {
  try {
    const filePath = path.join(cacheDir, slug, urlCacheKey(url));
    const raw = await fs.readFile(filePath, 'utf-8');
    const cached = JSON.parse(raw);

    if (cached.cachedAt) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return cached;
      }
    }

    return null; // expired
  } catch {
    return null; // missing or corrupt
  }
}

/**
 * Write a scrape result to the cache.
 *
 * @param {string} cacheDir
 * @param {string} slug
 * @param {string} url
 * @param {{ url: string, text: string, wordCount: number }} data
 */
async function writeCache(cacheDir, slug, url, data) {
  const slugDir = path.join(cacheDir, slug);
  await ensureDir(slugDir);
  const filePath = path.join(slugDir, urlCacheKey(url));
  await fs.writeFile(
    filePath,
    JSON.stringify({ ...data, cachedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// Tier 1: article-extractor
// ---------------------------------------------------------------------------

/**
 * Attempt Tier 1 extraction using @extractus/article-extractor.
 *
 * @param {string} url
 * @param {string} html  Raw HTML string.
 * @returns {string|null}  Plain text or null if extraction fails/too short.
 */
async function extractTier1(url, html) {
  try {
    const article = await extract(url, { html });
    if (article && article.content) {
      const text = stripHtml(article.content);
      if (text.length >= MIN_TEXT_LENGTH) {
        return text;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 2: cheerio manual extraction
// ---------------------------------------------------------------------------

/**
 * Attempt Tier 2 extraction using cheerio with boilerplate removal.
 *
 * @param {string} html  Raw HTML string.
 * @returns {string|null}  Plain text or null if extraction fails/too short.
 */
function extractTier2(html) {
  try {
    const $ = cheerio.load(html);

    // Remove boilerplate elements
    $(BOILERPLATE_SELECTORS).remove();

    // Find the first non-empty content candidate
    for (const selector of CONTENT_SELECTORS) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.text().replace(/\s+/g, ' ').trim();
        if (text.length >= MIN_TEXT_LENGTH) {
          return text;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with a hard timeout and browser-like User-Agent.
 *
 * @param {string} url
 * @returns {Promise<string|null>}  Raw HTML or null on error/timeout.
 */
async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[competitor-text] HTTP ${response.status} for ${url} — skipping`,
      );
      return null;
    }

    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[competitor-text] Timeout fetching ${url} — skipping`);
    } else {
      console.warn(`[competitor-text] Fetch error for ${url}: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Inter-domain delay tracker
// ---------------------------------------------------------------------------

/** Maps hostname → timestamp of last request. */
const lastRequestByDomain = new Map();

/**
 * Sleep long enough to honour the per-domain rate limit.
 *
 * @param {string} hostname
 */
async function respectDomainDelay(hostname) {
  const last = lastRequestByDomain.get(hostname);
  if (last !== undefined) {
    const elapsed = Date.now() - last;
    if (elapsed < INTER_DOMAIN_DELAY_MS) {
      await new Promise((r) =>
        setTimeout(r, INTER_DOMAIN_DELAY_MS - elapsed),
      );
    }
  }
  lastRequestByDomain.set(hostname, Date.now());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape and return clean text from a list of competitor URLs.
 *
 * Uses a two-tier extraction strategy (article-extractor → cheerio) with
 * 7-day disk caching. Skips pages that yield fewer than 500 characters
 * of text after extraction. Applies a 2-second inter-domain delay and a
 * 5-second per-request timeout.
 *
 * @param {string[]} urls                  Competitor URLs to scrape.
 * @param {object}  [options]
 * @param {string}  [options.cacheDir]     Root cache directory (default: .nlp-cache).
 * @param {string}  [options.keywordSlug]  Subdirectory name for this keyword's cache.
 * @param {boolean} [options.noCache]      Skip cache reads (still writes).
 * @returns {Promise<Array<{ url: string, text: string, wordCount: number, success: boolean }>>}
 */
export async function scrapeCompetitorTexts(
  urls,
  { cacheDir = NLP_CACHE_DIR, keywordSlug = '_default', noCache = false } = {},
) {
  const results = [];

  for (const url of urls) {
    // Check cache first (unless noCache)
    if (!noCache) {
      const cached = await readCache(cacheDir, keywordSlug, url);
      if (cached) {
        results.push({
          url: cached.url,
          text: cached.text,
          wordCount: cached.wordCount,
          success: true,
        });
        continue;
      }
    }

    // Honour per-domain delay
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      console.warn(`[competitor-text] Invalid URL: ${url} — skipping`);
      results.push({ url, text: '', wordCount: 0, success: false });
      continue;
    }
    await respectDomainDelay(hostname);

    // Fetch HTML
    const html = await fetchHtml(url);
    if (!html) {
      results.push({ url, text: '', wordCount: 0, success: false });
      continue;
    }

    // Tier 1: article-extractor
    let text = await extractTier1(url, html);

    // Tier 2: cheerio fallback
    if (!text) {
      text = extractTier2(html);
    }

    if (!text) {
      console.warn(
        `[competitor-text] Could not extract ≥${MIN_TEXT_LENGTH} chars from ${url} — skipping`,
      );
      results.push({ url, text: '', wordCount: 0, success: false });
      continue;
    }

    const wc = wordCount(text);
    const entry = { url, text, wordCount: wc };

    // Write to cache
    await writeCache(cacheDir, keywordSlug, url, entry);

    results.push({ ...entry, success: true });
  }

  return results;
}
