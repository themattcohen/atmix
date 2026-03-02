/**
 * text.mjs — Text analysis utilities.
 *
 * Provides word counting, n-gram generation, keyword density,
 * TF-IDF scoring, NLP entity extraction, and sentence complexity.
 *
 * External dependencies:
 *   - natural  (TF-IDF)
 *   - compromise  (NLP entity extraction)
 */

import natural from 'natural';
import nlp from 'compromise';

// ---------------------------------------------------------------------------
// Word utilities
// ---------------------------------------------------------------------------

/**
 * Count the number of words in a text string.
 *
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  return getWords(text).length;
}

/**
 * Split text into an array of non-empty word tokens.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function getWords(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

// ---------------------------------------------------------------------------
// N-gram generation
// ---------------------------------------------------------------------------

/**
 * Generate n-grams from an array of words using a sliding window.
 * Each n-gram is a space-joined, lowercased string.
 *
 * @param {string[]} words  Array of word tokens.
 * @param {number}   n      Window size (e.g. 2 for bigrams).
 * @returns {string[]}
 */
export function getNgrams(words, n) {
  if (n < 1 || words.length < n) return [];

  const ngrams = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(
      words
        .slice(i, i + n)
        .map((w) => w.toLowerCase())
        .join(' '),
    );
  }
  return ngrams;
}

/**
 * Ratio of unique n-grams to total n-grams (0-1).
 * A higher ratio indicates more lexical diversity.
 *
 * @param {string[]} ngrams
 * @returns {number}  0-1 ratio, or 0 if the array is empty.
 */
export function getUniqueRatio(ngrams) {
  if (ngrams.length === 0) return 0;
  return new Set(ngrams).size / ngrams.length;
}

// ---------------------------------------------------------------------------
// Keyword analysis
// ---------------------------------------------------------------------------

/**
 * Calculate keyword density as a percentage of total words.
 *
 * For multi-word keywords (3+ words), also calculates individual
 * significant word density and returns the higher of:
 * (a) exact phrase density, or
 * (b) average individual word density (words >3 chars only).
 *
 * This prevents 4-5 word keyword phrases from always showing 0% density
 * even when the individual keyword terms appear frequently.
 *
 * @param {string} plainText  Text to search in.
 * @param {string} keyword    Target keyword or phrase.
 * @returns {number}  Percentage (e.g. 1.5 means 1.5%).
 */
export function getKeywordDensity(plainText, keyword) {
  const totalWords = countWords(plainText);
  if (totalWords === 0) return 0;

  // Exact phrase density
  const occurrences = getKeywordOccurrences(plainText, keyword);
  const keywordWordCount = keyword.trim().split(/\s+/).length;
  const phraseDensity = (occurrences * keywordWordCount * 100) / totalWords;

  // For multi-word keywords, also check individual significant words
  if (keywordWordCount >= 3) {
    const sigWords = keyword.toLowerCase().replace(/[-–—]/g, ' ')
      .split(/\s+/).filter(w => w.length > 3);
    if (sigWords.length > 0) {
      const normalizedText = plainText.replace(/[-–—]/g, ' ');
      let totalDensity = 0;
      for (const word of sigWords) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = normalizedText.match(re) || [];
        totalDensity += (matches.length * 100) / totalWords;
      }
      const avgWordDensity = totalDensity / sigWords.length;
      return Math.max(phraseDensity, avgWordDensity);
    }
  }

  return phraseDensity;
}

/**
 * Count case-insensitive occurrences of a keyword in text.
 *
 * Uses word-boundary matching to avoid partial matches
 * (e.g. "bar" should not match inside "fbar").
 *
 * @param {string} text
 * @param {string} keyword
 * @returns {number}
 */
export function getKeywordOccurrences(text, keyword) {
  if (!keyword || !text) return 0;

  // Normalize hyphens/dashes to spaces in both text and keyword
  // so "first-time filer" matches "first time filer"
  const normalizedText = text.replace(/[-–—]/g, ' ');
  const normalizedKw = keyword.replace(/[-–—]/g, ' ');

  // Escape regex special characters in the keyword
  const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  const matches = normalizedText.match(re);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// TF-IDF scoring
// ---------------------------------------------------------------------------

/**
 * Compute a TF-IDF score for a keyword against a text document,
 * optionally using a corpus of additional documents for IDF weighting.
 *
 * When no corpus is supplied, a single-document TF score is returned
 * (IDF component is neutral at log(1/1) = 0, so we fall back to TF
 * only which is still useful as a relative density metric).
 *
 * @param {string}   text     Primary document text.
 * @param {string}   keyword  Target keyword or phrase.
 * @param {string[]} [corpus] Optional array of additional document texts.
 * @returns {number}  TF-IDF score (higher = more distinctive).
 */
export function getTfIdfScore(text, keyword, corpus = []) {
  const tfidf = new natural.TfIdf();

  // Add the target document first (index 0)
  tfidf.addDocument(text);

  // Add corpus documents
  for (const doc of corpus) {
    tfidf.addDocument(doc);
  }

  // Measure the keyword's TF-IDF in document 0
  let score = 0;
  tfidf.tfidfs(keyword, (docIndex, measure) => {
    if (docIndex === 0) {
      score = measure;
    }
  });

  return score;
}

// ---------------------------------------------------------------------------
// Entity extraction (compromise NLP)
// ---------------------------------------------------------------------------

/**
 * Extract named entities from text using compromise NLP.
 *
 * Returns structured entities relevant to FBAR/tax content:
 * people, organizations, places, monetary amounts, and legal statutes.
 *
 * @param {string} text  Plain text to analyze.
 * @returns {{
 *   people: string[],
 *   organizations: string[],
 *   places: string[],
 *   amounts: string[],
 *   statutes: string[]
 * }}
 */
export function extractEntities(text) {
  const doc = nlp(text);

  const people = doc.people().out('array');
  const organizations = doc.organizations().out('array');
  const places = doc.places().out('array');

  // Monetary amounts — compromise tags #Money, but also match via regex
  // for patterns like "$10,000" or "10,000 USD" that compromise may miss.
  const amounts = [];
  const moneyMatches = text.match(
    /\$[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{1,2})?\s*(?:USD|dollars?)\b/gi,
  );
  if (moneyMatches) {
    amounts.push(...new Set(moneyMatches.map((m) => m.trim())));
  }

  // Legal statutes — match patterns like "31 USC 5314", "26 CFR 1010.350",
  // "IRC 6038D", "IRM 4.26.16"
  const statutes = [];
  const statuteRe =
    /\b\d+\s+(?:USC|U\.S\.C\.|CFR|C\.F\.R\.)\s+[\d.]+(?:\([a-z0-9]+\))*\b/gi;
  const ircRe = /\bIRC\s+\d+[A-Z]?\b/gi;
  const irmRe = /\bIRM\s+[\d.]+\b/gi;

  for (const re of [statuteRe, ircRe, irmRe]) {
    const matches = text.match(re);
    if (matches) {
      statutes.push(...matches.map((m) => m.trim()));
    }
  }

  return {
    people: [...new Set(people)],
    organizations: [...new Set(organizations)],
    places: [...new Set(places)],
    amounts,
    statutes: [...new Set(statutes)],
  };
}

// ---------------------------------------------------------------------------
// Sentence complexity
// ---------------------------------------------------------------------------

/**
 * Calculate sentence complexity as word count per sentence.
 * Longer sentences are harder to read.
 *
 * @param {string} sentence  A single sentence string.
 * @returns {number}  Number of words in the sentence.
 */
export function sentenceComplexity(sentence) {
  return getWords(sentence).length;
}
