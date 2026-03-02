/**
 * keyword-coverage.mjs — Keyword coverage dimension analyzer for the SEO/AEO scorer.
 *
 * Evaluates how well the target keyword is distributed and emphasised
 * across the article: title/H1, first paragraph, H2 headings, meta
 * description, density, semantic variations, TF-IDF relevance, LSI/SERP
 * related keywords, and URL slug.
 *
 * Scoring rubric (0-10 total):
 *   Keyword in H1/title         — 1.5 pts
 *   Keyword in first paragraph  — 1 pt
 *   Keyword in >= 1 H2          — 1 pt
 *   Keyword in meta description — 1 pt
 *   Keyword density 0.5-2.5%    — 1.5 pts  (0.3-0.5% or 2.5-3% = 0.75)
 *   Semantic keyword variations  — 1 pt
 *   TF-IDF relevance            — 1 pt     (top quartile = 1, second = 0.5)
 *   LSI/related from SERP data  — 1 pt     (>= 5 = 1, 3-4 = 0.5)
 *   Keyword in URL slug         — 0.5 pt
 *
 * Weight: 0.15
 */

import { getKeywordDensity, getKeywordOccurrences, getTfIdfScore } from '../utils/text.mjs';
import { KEYWORD_DENSITY_RANGE } from '../utils/config.mjs';

const DIMENSION = 'keywordCoverage';
const WEIGHT = 0.15;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first N words of plain text.
 */
function getFirstNWords(text, n) {
  return text.split(/\s+/).slice(0, n).join(' ');
}

/**
 * Check if any heading at the given level contains the keyword.
 */
function keywordInHeadingLevel(headings, level, keyword) {
  // Normalize hyphens so "first-time" matches "first time"
  const kw = keyword.toLowerCase().replace(/[-–—]/g, ' ');
  return headings
    .filter(h => h.level === level)
    .some(h => h.text.toLowerCase().replace(/[-–—]/g, ' ').includes(kw));
}

/**
 * Check if significant words (>3 chars) from the keyword each appear
 * at least N times in the text.
 *
 * @returns {{ covered: number, total: number, missing: string[] }}
 */
function checkSemanticCoverage(text, keyword, minOccurrences = 3) {
  const lower = text.toLowerCase();
  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (words.length === 0) return { covered: 0, total: 0, missing: [] };

  const missing = [];
  let covered = 0;

  for (const word of words) {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    const matches = lower.match(pattern);
    const count = matches ? matches.length : 0;

    if (count >= minOccurrences) {
      covered++;
    } else {
      missing.push(`"${word}" (${count}x, need ${minOccurrences}+)`);
    }
  }

  return { covered, total: words.length, missing };
}

/**
 * Check how many SERP-provided related keywords appear in the article.
 *
 * @param {string} text - Plain text of the article.
 * @param {string[]} relatedKeywords - Related keywords from SERP data.
 * @returns {{ found: string[], missing: string[], count: number }}
 */
function checkRelatedKeywords(text, relatedKeywords) {
  if (!relatedKeywords || relatedKeywords.length === 0) {
    return { found: [], missing: [], count: 0 };
  }

  const lower = text.toLowerCase();
  const found = [];
  const missing = [];

  for (const rk of relatedKeywords) {
    if (lower.includes(rk.toLowerCase())) {
      found.push(rk);
    } else {
      missing.push(rk);
    }
  }

  return { found, missing, count: found.length };
}

/**
 * Check if keyword words appear in the URL slug.
 */
function keywordInSlug(slug, keyword) {
  if (!slug || !keyword) return false;

  const slugLower = slug.toLowerCase();
  const kwWords = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  // At least half the keyword words should appear in the slug
  const matches = kwWords.filter(w => slugLower.includes(w));
  return matches.length >= Math.ceil(kwWords.length / 2);
}

// ---------------------------------------------------------------------------
// Sub-criterion scorers
// ---------------------------------------------------------------------------

function scoreDensity(density) {
  const { min, max } = KEYWORD_DENSITY_RANGE;

  if (density >= min && density <= max) return 1.5;
  if ((density >= 0.3 && density < min) || (density > max && density <= 3.0)) return 0.75;
  return 0;
}

function scoreTfIdf(normalised) {
  // normalised is 0-1 from getTfIdfScore
  if (normalised >= 0.75) return 1;    // top quartile
  if (normalised >= 0.5) return 0.5;   // second quartile
  return 0;
}

function scoreRelatedKeywords(count) {
  if (count >= 5) return 1;
  if (count >= 3) return 0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

/**
 * Analyse keyword coverage across the article.
 *
 * @param {object} article - Parsed article object from fetchers/article.mjs.
 * @param {object} [options] - Options with optional serpData and llmApiKey.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, options = {}) {
  const {
    slug = '',
    keyword = '',
    meta = {},
    plainText = '',
    wordCount = 0,
    headings = [],
  } = article;

  if (!keyword) {
    return {
      dimension: DIMENSION,
      score: 0,
      weight: WEIGHT,
      details: {},
      issues: ['No target keyword specified. Cannot analyse keyword coverage.'],
    };
  }

  if (!plainText || wordCount === 0) {
    return {
      dimension: DIMENSION,
      score: 0,
      weight: WEIGHT,
      details: {},
      issues: ['Article has no analysable text content.'],
    };
  }

  // Normalize hyphens for matching (so "first-time" matches "first time")
  const kwLower = keyword.toLowerCase().replace(/[-–—]/g, ' ');

  // --- Check keyword placement ---
  const kwInH1 = keywordInHeadingLevel(headings, 1, keyword)
    || (meta.title || '').toLowerCase().replace(/[-–—]/g, ' ').includes(kwLower);

  const firstParagraph = getFirstNWords(plainText, 150);
  const kwInFirstPara = firstParagraph.toLowerCase().replace(/[-–—]/g, ' ').includes(kwLower);

  const kwInH2 = keywordInHeadingLevel(headings, 2, keyword);

  const kwInMeta = (meta.description || '').toLowerCase().replace(/[-–—]/g, ' ').includes(kwLower);

  const kwInSlug = keywordInSlug(slug, keyword);

  // --- Keyword density ---
  // getKeywordDensity(plainText, keyword) returns percentage directly
  const density = getKeywordDensity(plainText, keyword);

  // --- Semantic coverage ---
  const semantic = checkSemanticCoverage(plainText, keyword);
  const semanticCovered = semantic.total > 0
    ? semantic.covered === semantic.total
    : false;

  // --- TF-IDF ---
  // getTfIdfScore returns a raw score; normalise to 0-1 for quartile scoring.
  // For a single-document TF measure, scores above 0.3 per keyword term
  // indicate strong relevance. We average across keyword terms and clamp.
  const rawTfIdf = getTfIdfScore(plainText, keyword);
  const keywordTermCount = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3).length || 1;
  const avgTfIdf = rawTfIdf / keywordTermCount;
  const tfidfNorm = Math.min(avgTfIdf / 0.3, 1.0);

  // --- Related keywords from SERP data ---
  const relatedKeywords = options.serpData?.relatedKeywords || [];
  const related = checkRelatedKeywords(plainText, relatedKeywords);

  // --- Score each sub-criterion ---
  let score = 0;

  const kwInH1Score = kwInH1 ? 1.5 : 0;
  score += kwInH1Score;

  const kwInFirstParaScore = kwInFirstPara ? 1 : 0;
  score += kwInFirstParaScore;

  const kwInH2Score = kwInH2 ? 1 : 0;
  score += kwInH2Score;

  const kwInMetaScore = kwInMeta ? 1 : 0;
  score += kwInMetaScore;

  const densityScore = scoreDensity(density);
  score += densityScore;

  const semanticScore = semanticCovered ? 1 : (
    semantic.total > 0 && semantic.covered >= semantic.total * 0.5 ? 0.5 : 0
  );
  score += semanticScore;

  const tfidfScore = scoreTfIdf(tfidfNorm);
  score += tfidfScore;

  const relatedScore = scoreRelatedKeywords(related.count);
  score += relatedScore;

  const slugScore = kwInSlug ? 0.5 : 0;
  score += slugScore;

  const totalScore = Math.min(10, score);

  // --- Generate actionable issues ---
  const issues = [];

  if (!kwInH1) {
    issues.push(`Add keyword "${keyword}" to the H1 heading or page title.`);
  }

  if (!kwInFirstPara) {
    issues.push(`Add keyword "${keyword}" within the first 150 words.`);
  }

  if (!kwInH2) {
    issues.push(`Add keyword "${keyword}" to at least one H2 heading.`);
  }

  if (!kwInMeta) {
    issues.push(`Add keyword "${keyword}" to the meta description.`);
  }

  if (densityScore < 1.5) {
    const { min, max } = KEYWORD_DENSITY_RANGE;
    if (density < min) {
      issues.push(
        `Keyword density is ${density.toFixed(2)}% (below ideal ${min}-${max}%). ` +
        'Add more natural keyword mentions throughout the article.',
      );
    } else if (density > max) {
      issues.push(
        `Keyword density is ${density.toFixed(2)}% (above ideal ${min}-${max}%). ` +
        'Reduce keyword repetition to avoid over-optimisation.',
      );
    }
  }

  if (!semanticCovered && semantic.missing.length > 0) {
    issues.push(
      `Semantic keyword gaps: ${semantic.missing.join(', ')}. ` +
      'Use these terms at least 3 times each throughout the article.',
    );
  }

  if (tfidfScore < 1) {
    issues.push(
      `TF-IDF relevance score is ${tfidfNorm.toFixed(2)} (target >= 0.75). ` +
      'Increase keyword term frequency relative to overall content.',
    );
  }

  if (relatedKeywords.length > 0 && related.count < 3) {
    const sampleMissing = related.missing.slice(0, 5).map(k => `"${k}"`).join(', ');
    issues.push(
      `Only ${related.count} of ${relatedKeywords.length} SERP-related keywords found. ` +
      `Consider adding: ${sampleMissing}.`,
    );
  }

  if (!kwInSlug) {
    issues.push(
      `URL slug "${slug}" does not contain keyword words. ` +
      'Include primary keyword terms in the slug for better URL signals.',
    );
  }

  return {
    dimension: DIMENSION,
    score: Math.round(totalScore * 100) / 100,
    weight: WEIGHT,
    details: {
      density: Math.round(density * 100) / 100,
      kwInH1,
      kwInH2,
      kwInFirstPara,
      kwInMeta,
      kwInSlug,
      semanticCoverage: semantic.total > 0
        ? `${semantic.covered}/${semantic.total}`
        : 'N/A',
      tfidfScore: Math.round(tfidfNorm * 100) / 100,
      relatedKeywordsFound: related.count,
      relatedKeywordsTotal: relatedKeywords.length,
    },
    issues,
  };
}
