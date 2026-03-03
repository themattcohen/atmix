/**
 * serp.mjs — SERP data fetcher using Serper.dev API.
 *
 * Fetches Google SERP data for a keyword and returns a normalized
 * result with top organic results, People Also Ask questions,
 * related keywords, and detected SERP features.
 *
 * Results are cached to disk with a 24-hour TTL to minimize API usage
 * (Serper.dev free tier: 2,500 queries/month).
 *
 * If SERPER_API_KEY is not configured, all methods return null
 * gracefully — SERP data is an optional enhancement.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { SERPER_API_KEY, SERP_CACHE_DIR } from '../utils/config.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERPER_ENDPOINT = 'https://google.serper.dev/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * Generate a filesystem-safe cache key from a keyword.
 *
 * @param {string} keyword
 * @returns {string}  SHA-256 hex digest (first 16 chars).
 */
function cacheKey(keyword, num = 10) {
  const base = keyword.toLowerCase().trim();
  const suffix = num !== 10 ? `_n${num}` : '';
  return crypto
    .createHash('sha256')
    .update(base + suffix)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Ensure the cache directory exists.
 */
async function ensureCacheDir() {
  await fs.mkdir(SERP_CACHE_DIR, { recursive: true });
}

/**
 * Try to read a cached SERP result.
 *
 * @param {string} keyword
 * @returns {Promise<object|null>}  Cached data or null if missing/expired.
 */
async function readCache(keyword, num = 10) {
  try {
    const filePath = path.join(SERP_CACHE_DIR, `${cacheKey(keyword, num)}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const cached = JSON.parse(raw);

    // Check TTL
    if (cached.fetchedAt) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return cached;
      }
    }

    return null; // expired
  } catch {
    return null; // file not found or corrupt
  }
}

/**
 * Write a SERP result to the cache.
 *
 * @param {string} keyword
 * @param {object} data  Normalized SERP data.
 */
async function writeCache(keyword, data, num = 10) {
  await ensureCacheDir();
  const filePath = path.join(SERP_CACHE_DIR, `${cacheKey(keyword, num)}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// SERP feature detection
// ---------------------------------------------------------------------------

/**
 * Detect which SERP features are present in the Serper response.
 *
 * @param {object} response  Raw Serper API response.
 * @returns {string[]}  List of detected feature names.
 */
function detectSerpFeatures(response) {
  const features = [];

  if (response.answerBox) {
    features.push('featured_snippet');
  }
  if (response.knowledgeGraph) {
    features.push('knowledge_panel');
  }
  if (response.peopleAlsoAsk && response.peopleAlsoAsk.length > 0) {
    features.push('people_also_ask');
  }
  if (response.relatedSearches && response.relatedSearches.length > 0) {
    features.push('related_searches');
  }
  if (response.videos && response.videos.length > 0) {
    features.push('video');
  }
  if (response.images && response.images.length > 0) {
    features.push('images');
  }
  if (response.topStories && response.topStories.length > 0) {
    features.push('top_stories');
  }
  if (response.sitelinks) {
    features.push('sitelinks');
  }

  // Check organic results for FAQ rich results
  const organicResults = response.organic || [];
  const hasFaqRich = organicResults.some(
    (r) => r.sitelinks || (r.richSnippet && r.richSnippet.top),
  );
  if (hasFaqRich) {
    features.push('faq');
  }

  return features;
}

// ---------------------------------------------------------------------------
// Response normalization
// ---------------------------------------------------------------------------

/**
 * Normalize the raw Serper API response into our standard format.
 *
 * @param {string} keyword   The search keyword.
 * @param {object} response  Raw Serper API response.
 * @returns {object}  Normalized SERP data.
 */
function normalizeResponse(keyword, response) {
  // Top organic results
  const organicResults = response.organic || [];
  const topResults = organicResults.slice(0, 10).map((item, index) => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    position: index + 1,
  }));

  // People Also Ask
  const paaQuestions = (response.peopleAlsoAsk || []).map(
    (item) => item.question || item.title || '',
  );

  // Related keywords
  const relatedKeywords = (response.relatedSearches || []).map(
    (item) => item.query || '',
  );

  // SERP features
  const serpFeatures = detectSerpFeatures(response);

  return {
    keyword,
    topResults,
    paaQuestions,
    relatedKeywords,
    serpFeatures,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch SERP data for a keyword from the Serper.dev API.
 *
 * Returns cached data if available and fresh (< 24h). Otherwise
 * makes a live API call and caches the result.
 *
 * Returns `null` (does not throw) when:
 *   - SERPER_API_KEY is not configured
 *   - The API request fails
 *
 * @param {string} keyword  Search keyword or phrase.
 * @param {object} [options]
 * @param {number} [options.num=10]  Number of SERP results to request (max 20).
 * @returns {Promise<object|null>}  Normalized SERP data or null.
 */
export async function fetchSerpData(keyword, { num = 10 } = {}) {
  if (!SERPER_API_KEY) {
    return null;
  }

  // Check cache first
  const cached = await readCache(keyword, num);
  if (cached) {
    return cached;
  }

  // Make API request
  try {
    const response = await fetch(SERPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: keyword,
        num: Math.min(num, 20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(
        `[serp] Serper API returned ${response.status}: ${errorText}`,
      );
      return null;
    }

    const raw = await response.json();
    const data = normalizeResponse(keyword, raw);

    // Cache the result
    await writeCache(keyword, data, num);

    return data;
  } catch (err) {
    console.error(`[serp] Failed to fetch SERP data for "${keyword}":`, err.message);
    return null;
  }
}
