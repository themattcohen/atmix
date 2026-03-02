/**
 * readability.mjs — Readability dimension analyzer for the SEO/AEO scorer.
 *
 * Evaluates how accessible the article text is for a general web audience
 * reading about tax and legal topics. Uses Flesch Reading Ease and
 * Automated Readability Index from the text-readability package, plus
 * sentence and paragraph length analysis.
 *
 * Scoring rubric (0-10 total):
 *   Flesch Reading Ease   — up to 3 pts
 *   Avg sentence length   — up to 2 pts
 *   Long sentence %       — up to 2 pts
 *   Long paragraph %      — up to 1.5 pts
 *   ARI grade level       — up to 1.5 pts
 *
 * Weight: 0.12
 */

import textReadability from 'text-readability';
import { FLESCH_TARGET } from '../utils/config.mjs';

const DIMENSION = 'readability';
const WEIGHT = 0.12;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Score the Flesch Reading Ease value (0-3 pts).
 *
 * Tax/legal web content targets 50-70 for accessibility without
 * oversimplification.
 */
function scoreFlesch(flesch) {
  if (flesch >= FLESCH_TARGET.min && flesch <= FLESCH_TARGET.max) return 3;   // 50-70
  if ((flesch >= 40 && flesch < 50) || (flesch > 70 && flesch <= 80)) return 2;
  if ((flesch >= 30 && flesch < 40) || (flesch > 80 && flesch <= 90)) return 1;
  return 0;
}

/**
 * Score the average sentence length (0-2 pts).
 *
 * 15-20 words per sentence is ideal for online readability.
 */
function scoreAvgSentenceLength(avg) {
  if (avg >= 15 && avg <= 20) return 2;
  if ((avg >= 12 && avg < 15) || (avg > 20 && avg <= 25)) return 1;
  return 0;
}

/**
 * Score the percentage of sentences exceeding 25 words (0-2 pts).
 */
function scoreLongSentencePercentage(pct) {
  if (pct < 10) return 2;
  if (pct <= 15) return 1;
  return 0;
}

/**
 * Score the percentage of paragraphs exceeding 150 words (0-1.5 pts).
 */
function scoreLongParagraphPercentage(pct) {
  if (pct < 5) return 1.5;
  if (pct <= 10) return 1;
  return 0;
}

/**
 * Score the Automated Readability Index (0-1.5 pts).
 *
 * ARI 8-12 corresponds roughly to 8th-12th grade, appropriate for
 * educated general readers dealing with tax/legal content.
 */
function scoreAri(ari) {
  if (ari >= 8 && ari <= 12) return 1.5;
  if (ari >= 6 && ari < 8) return 1;
  if (ari > 12 && ari <= 14) return 1;
  if (ari >= 4 && ari < 6) return 0.5;
  if (ari > 14 && ari <= 16) return 0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

/**
 * Analyse the readability of an article.
 *
 * @param {object} article - Parsed article object from fetchers/article.mjs.
 * @param {object} [_options] - Unused; present for interface consistency.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, _options = {}) {
  const { plainText, sentences, paragraphs, wordCount } = article;

  // Guard against empty content
  if (!plainText || wordCount === 0) {
    return {
      dimension: DIMENSION,
      score: 0,
      weight: WEIGHT,
      details: {
        flesch: 0, ari: 0, avgSentenceLength: 0,
        longSentPct: 0, longParaPct: 0,
      },
      issues: ['Article has no analysable text content.'],
    };
  }

  // --- Compute raw metrics ---
  const flesch = textReadability.default
    ? textReadability.default.fleschReadingEase(plainText)
    : textReadability.fleschReadingEase(plainText);

  const ari = textReadability.default
    ? textReadability.default.automatedReadabilityIndex(plainText)
    : textReadability.automatedReadabilityIndex(plainText);

  const avgSentenceLength = sentences.length > 0
    ? wordCount / sentences.length
    : 0;

  const longSentences = sentences.filter(
    s => s.split(/\s+/).filter(Boolean).length > 25,
  );
  const longSentPct = sentences.length > 0
    ? (longSentences.length / sentences.length) * 100
    : 0;

  const longParagraphs = paragraphs.filter(
    p => p.split(/\s+/).filter(Boolean).length > 150,
  );
  const longParaPct = paragraphs.length > 0
    ? (longParagraphs.length / paragraphs.length) * 100
    : 0;

  // --- Score each sub-criterion ---
  const fleschScore = scoreFlesch(flesch);
  const avgSentScore = scoreAvgSentenceLength(avgSentenceLength);
  const longSentScore = scoreLongSentencePercentage(longSentPct);
  const longParaScore = scoreLongParagraphPercentage(longParaPct);
  const ariScore = scoreAri(ari);

  const totalScore = Math.min(
    10,
    fleschScore + avgSentScore + longSentScore + longParaScore + ariScore,
  );

  // --- Generate actionable issues ---
  const issues = [];

  if (fleschScore < 3) {
    const direction = flesch < FLESCH_TARGET.min ? 'below' : 'above';
    issues.push(
      `Flesch Reading Ease is ${flesch.toFixed(1)} (${direction} ideal ${FLESCH_TARGET.min}-${FLESCH_TARGET.max}). ` +
      (flesch < FLESCH_TARGET.min
        ? 'Simplify sentence structure and use shorter words.'
        : 'Add more substantive vocabulary to match the topic\'s complexity.'),
    );
  }

  if (avgSentScore < 2) {
    issues.push(
      `Average sentence length is ${avgSentenceLength.toFixed(1)} words ` +
      `(target 15-20). ${avgSentenceLength > 20
        ? 'Break long sentences into shorter ones.'
        : 'Combine some very short sentences for better flow.'}`,
    );
  }

  if (longSentences.length > 0 && longSentScore < 2) {
    issues.push(
      `${longSentences.length} sentence${longSentences.length === 1 ? '' : 's'} ` +
      `exceed${longSentences.length === 1 ? 's' : ''} 25 words (${longSentPct.toFixed(1)}% of total). ` +
      'Shorten these for better readability.',
    );
  }

  if (longParagraphs.length > 0 && longParaScore < 1.5) {
    issues.push(
      `${longParagraphs.length} paragraph${longParagraphs.length === 1 ? '' : 's'} ` +
      `exceed${longParagraphs.length === 1 ? 's' : ''} 150 words (${longParaPct.toFixed(1)}% of total). ` +
      'Break these into smaller paragraphs for scannability.',
    );
  }

  if (ariScore < 1.5) {
    issues.push(
      `ARI grade level is ${ari.toFixed(1)} (target 8-12). ` +
      (ari < 8
        ? 'Content may be too simple for the tax/legal audience.'
        : 'Content may be too dense for general readers.'),
    );
  }

  return {
    dimension: DIMENSION,
    score: Math.round(totalScore * 100) / 100,
    weight: WEIGHT,
    details: {
      flesch: Math.round(flesch * 10) / 10,
      ari: Math.round(ari * 10) / 10,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      longSentPct: Math.round(longSentPct * 10) / 10,
      longParaPct: Math.round(longParaPct * 10) / 10,
    },
    issues,
  };
}
