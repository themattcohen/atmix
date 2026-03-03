/**
 * gsc-matcher.mjs — Match GSC queries to NLP target terms.
 *
 * Uses a two-tier matching strategy:
 *   Tier 1 — Exact/substring: case-insensitive, whitespace-normalized.
 *   Tier 2 — Fuzzy: Fuse.js with threshold 0.35, minMatchCharLength 4.
 *
 * Each NLP term is deduplicated to its best GSC match (highest impressions).
 *
 * External dependencies (all in d2c/package.json):
 *   - fuse.js
 */

import Fuse from 'fuse.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a string for comparison: lowercase + collapse whitespace.
 *
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check if two strings match via exact substring containment (either direction).
 *
 * @param {string} query  GSC query (already normalized).
 * @param {string} term   NLP term (already normalized).
 * @returns {boolean}
 */
function isSubstringMatch(query, term) {
  return query.includes(term) || term.includes(query);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match GSC queries to NLP target terms using exact/substring + fuzzy matching.
 *
 * Each NLP term is matched to at most one GSC query (highest impressions wins
 * when multiple queries match).
 *
 * @param {Array<{query: string, clicks: number, impressions: number, ctr: number, position: number}>} gscQueries
 * @param {Array<{term: string, targetMin: number, targetMax: number}>} nlpTerms  All priority tiers combined.
 * @returns {Array<{nlpTerm: string, gscQuery: string, matchType: 'exact'|'fuzzy', clicks: number, impressions: number, ctr: number, position: number}>}
 */
export function matchQueriesToTerms(gscQueries, nlpTerms) {
  if (!gscQueries?.length || !nlpTerms?.length) return [];

  // Pre-normalize all queries and terms once
  const normalizedQueries = gscQueries.map(q => ({ ...q, _norm: normalize(q.query) }));
  const normalizedTerms = nlpTerms.map(t => ({ ...t, _norm: normalize(t.term) }));

  // Build Fuse index on NLP terms for fuzzy matching (Tier 2)
  const fuse = new Fuse(normalizedTerms, {
    keys: ['_norm'],
    threshold: 0.35,
    minMatchCharLength: 4,
    includeScore: true,
  });

  // For each NLP term, collect all candidate matches, then keep the best
  const results = [];

  for (const nlpTerm of normalizedTerms) {
    /** @type {Array<{query: object, matchType: string}>} */
    const candidates = [];

    // Tier 1 — exact/substring
    for (const q of normalizedQueries) {
      if (isSubstringMatch(q._norm, nlpTerm._norm)) {
        candidates.push({ query: q, matchType: 'exact' });
      }
    }

    // Tier 2 — fuzzy (only if no exact match found)
    if (candidates.length === 0) {
      // Search the NLP term list with each GSC query to find if this term is a fuzzy match
      for (const q of normalizedQueries) {
        const fuseResults = new Fuse([nlpTerm], {
          keys: ['_norm'],
          threshold: 0.35,
          minMatchCharLength: 4,
          includeScore: true,
        }).search(q._norm);

        if (fuseResults.length > 0) {
          candidates.push({ query: q, matchType: 'fuzzy' });
        }
      }
    }

    if (candidates.length === 0) continue;

    // Dedup: pick the candidate with the highest impressions
    const best = candidates.reduce((a, b) =>
      (a.query.impressions >= b.query.impressions ? a : b),
    );

    results.push({
      nlpTerm: nlpTerm.term,
      gscQuery: best.query.query,
      matchType: best.matchType,
      clicks: best.query.clicks,
      impressions: best.query.impressions,
      ctr: best.query.ctr,
      position: best.query.position,
    });
  }

  return results;
}

/**
 * Compute NLP term coverage summary from match results.
 *
 * @param {Array<{nlpTerm: string}>} matches  Output from matchQueriesToTerms.
 * @param {Array<{term: string}>} allTerms    All NLP terms across tiers.
 * @returns {{ covered: number, total: number, pct: number, uncoveredTerms: string[] }}
 */
export function computeCoverage(matches, allTerms) {
  if (!allTerms?.length) {
    return { covered: 0, total: 0, pct: 0, uncoveredTerms: [] };
  }

  const coveredSet = new Set(matches.map(m => normalize(m.nlpTerm)));
  const total = allTerms.length;
  const uncoveredTerms = allTerms
    .filter(t => !coveredSet.has(normalize(t.term)))
    .map(t => t.term);
  const covered = total - uncoveredTerms.length;

  return {
    covered,
    total,
    pct: total > 0 ? Math.round((covered / total) * 100) : 0,
    uncoveredTerms,
  };
}
