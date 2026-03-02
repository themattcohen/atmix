/**
 * config.mjs — Central configuration for the SEO/AEO content scorer.
 *
 * All dimension weights MUST sum to 1.0. Paths are resolved relative
 * to the script directory using import.meta.url so the scorer works
 * from any working directory.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the seo-scorer tool itself. */
export const SCORER_ROOT = path.resolve(__dirname, '..');

/** Root of the D2C Next.js project (two levels above scripts/seo-scorer). */
export const D2C_ROOT = path.resolve(SCORER_ROOT, '..', '..');

/** Path to the content queue manifest. */
export const QUEUE_PATH = path.join(D2C_ROOT, 'src', 'content', 'content-queue.json');

/** Directory where draft articles live. */
export const DRAFTS_DIR = path.join(D2C_ROOT, 'src', 'content', 'drafts');

/** Directory where published blog articles live. */
export const BLOG_DIR = path.join(D2C_ROOT, 'src', 'content', 'blog');

/** Directory where per-article score reports are persisted. */
export const SCORES_DIR = path.join(SCORER_ROOT, '.scores');

/** Directory where cached SERP results are stored. */
export const SERP_CACHE_DIR = path.join(SCORER_ROOT, '.serp-cache');

// ---------------------------------------------------------------------------
// API keys (read from environment — never hard-coded)
// ---------------------------------------------------------------------------

export const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
if (!SERPER_API_KEY) {
  console.warn('[seo-scorer] WARNING: SERPER_API_KEY is not set. SERP-dependent scoring (PAA coverage, related keywords) will be skipped. Set SERPER_API_KEY in .env for full scoring.');
}
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ---------------------------------------------------------------------------
// Scoring dimensions — weights MUST sum to 1.0
// ---------------------------------------------------------------------------

/**
 * Each dimension produces a 0-10 sub-score. The final score is the
 * weighted sum:  sum(weight_i * subscore_i).
 */
export const DIMENSION_WEIGHTS = {
  readability:      0.12,
  writingQuality:   0.08,
  structure:        0.12,
  keywordCoverage:  0.20,
  schemaMarkup:     0.08,
  aeoSignals:       0.20,
  llmQuality:       0.20,
};

// Sanity-check: weights must sum to 1.0 (within floating-point tolerance).
const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1.0) > 1e-9) {
  throw new Error(
    `DIMENSION_WEIGHTS must sum to 1.0, got ${weightSum.toFixed(6)}`,
  );
}

// ---------------------------------------------------------------------------
// Scoring thresholds
// ---------------------------------------------------------------------------

/** Minimum weighted score (out of 10) to pass. */
export const PASS_THRESHOLD = 9.0;

/** Maximum scoring attempts before giving up on an article. */
export const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Readability targets
// ---------------------------------------------------------------------------

/** Ideal Flesch Reading Ease range for web content. */
export const FLESCH_TARGET = { min: 50, max: 70 };

// ---------------------------------------------------------------------------
// Keyword density targets
// ---------------------------------------------------------------------------

/** Ideal keyword density as a percentage of total words. */
export const KEYWORD_DENSITY_RANGE = { min: 0.5, max: 2.5 };

// ---------------------------------------------------------------------------
// Authority domains — used to classify links as authoritative sources
// ---------------------------------------------------------------------------

export const AUTHORITY_DOMAINS = [
  'irs.gov',
  'fincen.gov',
  'law.cornell.edu',
  'congress.gov',
  'treasury.gov',
  'gpo.gov',
];
