/**
 * nlp-extract.mjs — NLP extraction pipeline for SEO scorer.
 *
 * Analyzes competitor page texts to generate NLP term targets that mirror
 * what SurferSEO produces manually. Terms are ranked into high/medium/low
 * priority tiers using TF-IDF scoring, document frequency, and compromise
 * entity enrichment.
 *
 * Pipeline:
 *   1. Tokenize + stop-word filter (with domain-protected words)
 *   2. N-gram generation (unigrams, bigrams, trigrams)
 *   3. TF-IDF scoring across the competitor corpus
 *   4. Entity enrichment via compromise .topics()
 *   5. (Google NLP — skipped, see comment below)
 *   6. Per-term frequency targets (p25/p75 of competitor counts)
 *   7. Priority classification (high / medium / low)
 *   8. Deduplication and cleanup
 *
 * External dependencies (all already installed):
 *   - natural         (TfIdf, WordTokenizer, NGrams)
 *   - compromise      (entity / topic extraction)
 *   - stopword        (removeStopwords)
 */

import natural from 'natural';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';

import { getKeywordOccurrences } from '../utils/text.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Domain-specific words that must never be removed by the stop-word filter.
 * After removeStopwords(), we re-inject any of these that were dropped.
 */
const PROTECTED_WORDS = new Set([
  'fbar', 'irs', 'fincen', 'bsa', 'tcc', 'tin', 'ssn', 'itin', 'ein',
  'usd', 'cpa', 'cia',
]);

/**
 * Common English words that leak through the stopword package but should
 * never appear as NLP target terms. These have no SEO value.
 */
const EXTRA_STOP_WORDS = new Set([
  'not', 'also', 'may', 'can', 'one', 'two', 'use', 'get', 'set', 'see',
  'new', 'way', 'per', 'let', 'due', 'via', 'yet', 'now', 'just', 'well',
  'even', 'much', 'many', 'more', 'most', 'very', 'each', 'only', 'such',
  'than', 'both', 'some', 'like', 'make', 'made', 'find', 'take', 'come',
  'could', 'would', 'should', 'might', 'still', 'also', 'been', 'does',
  'have', 'will', 'with', 'from', 'they', 'that', 'this', 'what', 'when',
  'which', 'where', 'there', 'here', 'then', 'them', 'those', 'these',
  'other', 'about', 'after', 'before', 'being', 'between', 'same',
  'into', 'over', 'under', 'again', 'once', 'back', 'down', 'were',
  'need', 'want', 'know', 'help', 'look', 'keep', 'give', 'must',
  'part', 'case', 'used', 'using', 'based', 'first', 'last', 'next',
  'include', 'including', 'included', 'includes',
  'however', 'example', 'certain', 'different',
]);

/**
 * Stop words used to evaluate whether an n-gram has enough "content" words
 * to be meaningful. Common function words that connect content words.
 */
const NGRAM_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
  'has', 'had', 'have', 'do', 'did', 'does', 'if', 'it', 'its', 'no',
  'not', 'so', 'up', 'he', 'she', 'we', 'my', 'me', 'us', 'am',
  'than', 'that', 'this', 'from', 'into', 'will', 'can', 'may',
  'your', 'you', 'who', 'all', 'any',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Simple percentile calculation on a numeric array.
 *
 * @param {number[]} arr
 * @param {number}   p    Percentile 0-100.
 * @returns {number}
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Tokenize document text and apply stop-word filtering, preserving
 * domain-protected words that stopword would otherwise remove.
 *
 * @param {string} text
 * @returns {string[]}  Filtered lowercase tokens, length ≥ 3.
 */
function tokenizeAndFilter(text) {
  const tokenizer = new natural.WordTokenizer();
  const raw = tokenizer.tokenize(text.toLowerCase()) || [];

  // Identify which protected words are present before filtering
  const presentProtected = raw.filter(t => PROTECTED_WORDS.has(t));

  // Apply stop-word removal; keep tokens ≥ 3 chars
  const filtered = removeStopwords(raw).filter(t => t.length >= 3 && !EXTRA_STOP_WORDS.has(t));

  // Re-inject any protected words that were removed
  for (const pw of presentProtected) {
    if (!filtered.includes(pw)) {
      filtered.push(pw);
    }
  }

  return filtered;
}

/**
 * Tokenize with minimal filtering — lowercase, length >= 2, no pure numbers.
 * Used for n-gram generation so connecting words (a, an, the, of, etc.)
 * are preserved in bigrams/trigrams/quadgrams.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeMinimal(text) {
  const tokenizer = new natural.WordTokenizer();
  const raw = tokenizer.tokenize(text.toLowerCase()) || [];
  return raw.filter(t => t.length >= 2 && !/^\d+$/.test(t));
}

/**
 * Check whether an n-gram has enough "content words" (non-stop-words)
 * to be meaningful. Requires at least ceil(n/2) content words.
 *
 * @param {string[]} gramTokens
 * @returns {boolean}
 */
function isContentNgram(gramTokens) {
  const contentCount = gramTokens.filter(t => !NGRAM_STOP_WORDS.has(t) && t.length >= 3).length;
  return contentCount >= Math.max(1, Math.ceil(gramTokens.length / 2));
}

/**
 * Generate n-gram strings from a token array using natural.NGrams.
 * Returns flat array of space-joined strings, filtered to only include
 * n-grams with sufficient content words.
 *
 * @param {string[]} tokens
 * @param {number}   n
 * @returns {string[]}
 */
function makeNgrams(tokens, n) {
  if (tokens.length < n) return [];
  let raw;
  if (n === 2) raw = natural.NGrams.bigrams(tokens);
  else if (n === 3) raw = natural.NGrams.trigrams(tokens);
  else if (n === 4) raw = natural.NGrams.ngrams(tokens, 4);
  else return [];
  return raw
    .filter(gram => isContentNgram(gram))
    .map(gram => gram.join(' '));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract NLP term targets from a corpus of competitor page texts.
 *
 * Only competitor entries where `success === true` are used. Self-reference
 * texts are included in the TF-IDF corpus with a 0.7 weight multiplier on
 * their avgTfidf contribution.
 *
 * @param {Array<{ url: string, text: string, wordCount: number, success: boolean }>} competitorTexts
 *   Scraped competitor pages (from fetchers/competitor-text.mjs).
 * @param {object}   [options]
 * @param {string}   [options.keyword='']          Focus keyword (informational only).
 * @param {number}   [options.minDocFreqPct=0.3]   Minimum fraction of docs a term must appear in.
 * @param {boolean}  [options.useGoogleNlp=true]   Accepted but currently a no-op.
 * @param {Array<{ text: string, slug: string, keyword: string, weight: number }>} [options.selfRefTexts=[]]
 *   Our own published articles; weighted at 0.7 in TF-IDF averaging.
 * @returns {Promise<object>}  Surfer-targets-compatible result object.
 */
export async function extractNlpTerms(competitorTexts, {
  keyword = '',
  minDocFreqPct = 0.3,
  useGoogleNlp = true,   // accepted — see Step 5 below
  selfRefTexts = [],
} = {}) {
  // -------------------------------------------------------------------------
  // Empty-corpus guard
  // -------------------------------------------------------------------------
  const validCompetitors = (competitorTexts || []).filter(d => d.success && d.text);

  const emptyResult = () => ({
    slug: '',
    keyword,
    extractedAt: new Date().toISOString(),
    source: 'diy-extract',
    contentScore: { current: 0, avg: 0, top: 0 },
    targets: {
      wordCount: { min: 0, max: 0 },
      headings: { min: 0, max: 0 },
    },
    terms: {
      high_priority: [],
      medium_priority: [],
      low_priority: [],
    },
    corpus: {
      totalDocs: 0,
      competitors: 0,
      selfRef: 0,
      totalWords: 0,
    },
    meta: {
      tfidfTop25: 0,
      tfidfTop60: 0,
      entityBoostedCount: 0,
      minDocFreqPct,
    },
  });

  if (validCompetitors.length === 0) {
    console.warn('[nlp-extract] No successful competitor texts — returning empty result.');
    return emptyResult();
  }

  if (validCompetitors.length === 1) {
    console.warn('[nlp-extract] Only 1 competitor document — results will have limited reliability.');
  }

  const validSelfRef = (selfRefTexts || []).filter(d => d.text);
  const totalDocs = validCompetitors.length + validSelfRef.length;
  const totalWords = validCompetitors.reduce((s, d) => s + (d.wordCount || 0), 0);

  try {
    // -----------------------------------------------------------------------
    // Step 1 & 2: Tokenize, filter stop-words, generate n-grams (per doc)
    // -----------------------------------------------------------------------
    console.log(`[nlp-extract] Tokenizing ${totalDocs} documents...`);

    /** @type {Array<{ tokens: string[], bigrams: string[], trigrams: string[], quadgrams: string[], isCompetitor: boolean }>} */
    const docFeatures = [];

    for (const doc of validCompetitors) {
      const tokens = tokenizeAndFilter(doc.text);
      const minTokens = tokenizeMinimal(doc.text);
      const bigrams = makeNgrams(minTokens, 2);
      const trigrams = makeNgrams(minTokens, 3);
      const quadgrams = makeNgrams(minTokens, 4);
      docFeatures.push({ tokens, bigrams, trigrams, quadgrams, isCompetitor: true });
    }

    for (const doc of validSelfRef) {
      const tokens = tokenizeAndFilter(doc.text);
      const minTokens = tokenizeMinimal(doc.text);
      const bigrams = makeNgrams(minTokens, 2);
      const trigrams = makeNgrams(minTokens, 3);
      const quadgrams = makeNgrams(minTokens, 4);
      docFeatures.push({ tokens, bigrams, trigrams, quadgrams, isCompetitor: false });
    }

    // -----------------------------------------------------------------------
    // Step 3: TF-IDF scoring
    // -----------------------------------------------------------------------
    console.log('[nlp-extract] Computing TF-IDF...');

    const tfidf = new natural.TfIdf();

    // Add each document as a concatenated string of all n-gram types
    for (const feat of docFeatures) {
      const docString = [
        feat.tokens.join(' '),
        feat.bigrams.join(' '),
        feat.trigrams.join(' '),
        feat.quadgrams.join(' '),
      ].join(' ');
      tfidf.addDocument(docString);
    }

    // Collect all unique terms across all documents
    const allTerms = new Set();
    for (const feat of docFeatures) {
      for (const t of feat.tokens) allTerms.add(t);
      for (const t of feat.bigrams) allTerms.add(t);
      for (const t of feat.trigrams) allTerms.add(t);
      for (const t of feat.quadgrams) allTerms.add(t);
    }

    // For each term, compute docFrequency and avgTfidf
    // We need to check per-document membership, so build a Set per doc
    const docTermSets = docFeatures.map(feat =>
      new Set([...feat.tokens, ...feat.bigrams, ...feat.trigrams, ...feat.quadgrams]),
    );

    /** @type {Map<string, { docFrequency: number, avgTfidf: number }>} */
    const termStats = new Map();

    for (const term of allTerms) {
      // Count how many documents contain this term (only competitors for freq threshold)
      let competitorDocCount = 0;
      for (let i = 0; i < validCompetitors.length; i++) {
        if (docTermSets[i].has(term)) competitorDocCount++;
      }

      const docFreqPct = competitorDocCount / validCompetitors.length;

      // Skip terms below minimum threshold early (saves TF-IDF lookups)
      if (docFreqPct < minDocFreqPct) continue;

      // Compute weighted average TF-IDF across all docs containing this term
      let weightedSum = 0;
      let weightedCount = 0;

      tfidf.tfidfs(term, (docIdx, score) => {
        if (score <= 0) return;
        const isCompetitor = docIdx < validCompetitors.length;
        const w = isCompetitor ? 1.0 : 0.7;
        weightedSum += score * w;
        weightedCount += w;
      });

      const avgTfidf = weightedCount > 0 ? weightedSum / weightedCount : 0;

      termStats.set(term, { docFrequency: competitorDocCount, docFreqPct, avgTfidf });
    }

    // -----------------------------------------------------------------------
    // Step 4: Entity enrichment via compromise topics
    // -----------------------------------------------------------------------
    console.log('[nlp-extract] Entity enrichment...');

    // Use the top 3 competitor texts by word count (longest first)
    const top3 = [...validCompetitors]
      .sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))
      .slice(0, 3);

    const concatenated = top3.map(d => d.text).join('\n\n');

    const entityBoostedTerms = new Set();
    try {
      const doc = nlp(concatenated);
      const topics = doc.topics().out('frequency');
      for (const entry of topics) {
        // compromise returns { normal, count } or [{ normal, count }] depending on version
        const term = (entry.normal || entry[0] || '').toLowerCase().trim();
        const count = entry.count || entry[1] || 0;
        if (term && count >= 3) {
          entityBoostedTerms.add(term);
          // Also add the term to termStats if it wasn't captured by n-grams
          // (entity terms may be multi-word with different tokenization)
        }
      }
    } catch (err) {
      console.warn(`[nlp-extract] Entity enrichment warning: ${err.message}`);
    }

    // -----------------------------------------------------------------------
    // Step 5: Google NLP enrichment — not yet implemented.
    // Use compromise entities only.
    // -----------------------------------------------------------------------
    void useGoogleNlp;

    // -----------------------------------------------------------------------
    // Step 6: Frequency targets (p25 / p75 of per-page occurrence counts)
    // -----------------------------------------------------------------------

    // Compute TF-IDF distribution thresholds for priority classification
    const allAvgTfidfs = [...termStats.values()].map(s => s.avgTfidf);
    const tfidfTop25 = percentile(allAvgTfidfs, 75); // top 25% have score >= this
    const tfidfTop60 = percentile(allAvgTfidfs, 40); // top 60% have score >= this

    /** @type {Array<{ term: string, targetMin: number, targetMax: number, docFreqPct: number, avgTfidf: number, entityBoosted: boolean, priority: string }>} */
    const classified = [];

    console.log(`[nlp-extract] Classifying ${termStats.size} terms...`);

    // Keyword words computed once outside the loop (keyword is constant)
    const keywordWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

    for (const [term, stats] of termStats.entries()) {
      // Compute per-page occurrence counts for frequency targets
      const counts = [];
      for (const doc of validCompetitors) {
        const c = getKeywordOccurrences(doc.text, term);
        if (c > 0) counts.push(c);
      }

      const targetMin = counts.length > 0 ? Math.max(1, percentile(counts, 25)) : 1;
      const targetMax = Math.max(targetMin + 1, percentile(counts, 75));

      const entityBoosted = entityBoostedTerms.has(term);

      // Keyword-relevance boost: terms containing focus keyword words get priority help
      const termWords = term.split(/\s+/);
      const keywordOverlap = keywordWords.filter(kw => termWords.some(tw => tw === kw || tw.includes(kw))).length;
      const isKeywordRelevant = keywordOverlap >= 1;
      const isMultiWord = term.includes(' ');

      // Priority classification — boost multi-word and keyword-relevant terms
      let priority = null;
      if (
        (stats.docFreqPct >= 0.70 && (stats.avgTfidf >= tfidfTop25 || entityBoosted)) ||
        (isKeywordRelevant && stats.docFreqPct >= 0.50 && stats.avgTfidf >= tfidfTop60) ||
        (isMultiWord && isKeywordRelevant && stats.docFreqPct >= 0.40)
      ) {
        priority = 'high';
      } else if (
        (stats.docFreqPct >= 0.50 && stats.avgTfidf >= tfidfTop60) ||
        (isMultiWord && stats.docFreqPct >= 0.40 && stats.avgTfidf >= tfidfTop60)
      ) {
        priority = 'medium';
      } else if (stats.docFreqPct >= minDocFreqPct) {
        priority = 'low';
      }

      if (!priority) continue;

      classified.push({
        term,
        targetMin,
        targetMax,
        docFreqPct: stats.docFreqPct,
        avgTfidf: stats.avgTfidf,
        entityBoosted,
        priority,
      });
    }

    // -----------------------------------------------------------------------
    // Step 8: Deduplication and cleanup
    // -----------------------------------------------------------------------

    // Remove pure-number terms
    const deduped = classified.filter(item => !/^\d+$/.test(item.term));

    // Sort by priority tier precedence for substring dedup
    const priorityRank = { high: 0, medium: 1, low: 2 };
    deduped.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

    // Remove terms that are substrings of any higher-or-equal priority term
    // "higher-priority" = earlier in sorted array (lower rank value)
    const kept = [];
    for (let i = 0; i < deduped.length; i++) {
      const candidate = deduped[i];
      let isSubstring = false;

      for (let j = 0; j < i; j++) {
        const superior = deduped[j];
        // Only drop candidate if superior is strictly higher priority
        if (priorityRank[superior.priority] < priorityRank[candidate.priority]) {
          // Check if candidate term is a substring of the superior term
          if (superior.term.includes(candidate.term)) {
            isSubstring = true;
            break;
          }
        }
      }

      if (!isSubstring) kept.push(candidate);
    }

    // Sort each tier: docFrequency desc, then avgTfidf desc
    const tierSort = (a, b) =>
      (b.docFreqPct - a.docFreqPct) || (b.avgTfidf - a.avgTfidf);

    const highItems = kept.filter(t => t.priority === 'high').sort(tierSort);
    const mediumItems = kept.filter(t => t.priority === 'medium').sort(tierSort);
    const lowItems = kept.filter(t => t.priority === 'low').sort(tierSort);

    const toOutput = ({ term, targetMin, targetMax }) => ({ term, targetMin, targetMax });

    return {
      slug: '',
      keyword,
      extractedAt: new Date().toISOString(),
      source: 'diy-extract',
      contentScore: { current: 0, avg: 0, top: 0 },
      targets: {
        wordCount: {
          min: Math.round(percentile(validCompetitors.map(d => d.wordCount || 0), 25)),
          max: Math.round(percentile(validCompetitors.map(d => d.wordCount || 0), 75)),
        },
        headings: { min: 0, max: 0 },
      },
      terms: {
        high_priority: highItems.map(toOutput),
        medium_priority: mediumItems.map(toOutput),
        low_priority: lowItems.map(toOutput),
      },
      corpus: {
        totalDocs,
        competitors: validCompetitors.length,
        selfRef: validSelfRef.length,
        totalWords,
      },
      meta: {
        tfidfTop25,
        tfidfTop60,
        entityBoostedCount: entityBoostedTerms.size,
        minDocFreqPct,
      },
    };

  } catch (err) {
    console.error(`[nlp-extract] Fatal error in extraction pipeline: ${err.message}`);
    return emptyResult();
  }
}
