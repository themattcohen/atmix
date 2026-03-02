/**
 * writing-quality.mjs — Writing quality dimension analyzer for the SEO/AEO scorer.
 *
 * Evaluates prose quality using write-good suggestions, passive voice
 * detection, weasel word counting, adverb density, cliche scanning,
 * and transition word usage.
 *
 * Scoring rubric (0-10 total):
 *   write-good issues per 500 words — up to 3 pts
 *   Passive voice instances          — up to 2 pts
 *   Weasel words                     — up to 1 pt
 *   Adverb density                   — up to 1 pt
 *   Cliche detection                 — up to 1.5 pts
 *   Transition word usage            — up to 1.5 pts
 *
 * Weight: 0.08
 */

import writeGood from 'write-good';

const DIMENSION = 'writingQuality';
const WEIGHT = 0.08;

// ---------------------------------------------------------------------------
// Cliche patterns — common tax/legal writing cliches to flag
// ---------------------------------------------------------------------------

const CLICHE_PATTERNS = [
  'navigate the complex',
  'peace of mind',
  'rest assured',
  "it's important to note",
  'it is important to note',
  'at the end of the day',
  'needless to say',
  'in today\'s world',
  'in this day and age',
  'when it comes to',
  'the bottom line is',
  'last but not least',
  'better safe than sorry',
];

// ---------------------------------------------------------------------------
// Transition words — indicators of logical flow
// ---------------------------------------------------------------------------

const TRANSITION_WORDS = [
  'however', 'therefore', 'additionally', 'furthermore', 'moreover',
  'consequently', 'specifically', 'nevertheless', 'meanwhile', 'otherwise',
  'similarly', 'alternatively', 'accordingly', 'subsequently', 'conversely',
  'in addition', 'as a result', 'on the other hand', 'for example',
  'for instance', 'in contrast', 'in particular', 'in other words',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Count passive voice instances from write-good output.
 */
function countPassive(suggestions) {
  return suggestions.filter(s => s.reason.includes('passive voice')).length;
}

/**
 * Count weasel word instances from write-good output.
 */
function countWeasel(suggestions) {
  return suggestions.filter(s => s.reason.includes('weasel word')).length;
}

/**
 * Count adverb suggestions from write-good output.
 * write-good flags adverbs with "can weaken meaning" that are not also weasel words,
 * plus explicit "is an adverb" reasons in some versions.
 */
function countAdverbs(suggestions) {
  return suggestions.filter(s => {
    const r = s.reason.toLowerCase();
    return (r.includes('can weaken meaning') && !r.includes('weasel'))
      || r.includes('is an adverb');
  }).length;
}

/**
 * Count cliche occurrences in plain text.
 * @returns {{ count: number, found: string[] }}
 */
function findCliches(text) {
  const lower = text.toLowerCase();
  const found = [];

  for (const cliche of CLICHE_PATTERNS) {
    // Count all occurrences of each cliche
    let idx = 0;
    while (true) {
      const pos = lower.indexOf(cliche, idx);
      if (pos === -1) break;
      found.push(cliche);
      idx = pos + cliche.length;
    }
  }

  return { count: found.length, found: [...new Set(found)] };
}

/**
 * Count transition word/phrase occurrences in plain text.
 * @returns {{ count: number, rate: number }} rate = transitions per 300 words
 */
function countTransitions(text, wordCount) {
  const lower = text.toLowerCase();
  let count = 0;

  for (const tw of TRANSITION_WORDS) {
    // Use word boundary matching for single words, indexOf for phrases
    if (tw.includes(' ')) {
      let idx = 0;
      while (true) {
        const pos = lower.indexOf(tw, idx);
        if (pos === -1) break;
        count++;
        idx = pos + tw.length;
      }
    } else {
      const pattern = new RegExp(`\\b${tw}\\b`, 'gi');
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }
  }

  const rate = wordCount > 0 ? count / (wordCount / 300) : 0;
  return { count, rate };
}

// ---------------------------------------------------------------------------
// Sub-criterion scorers
// ---------------------------------------------------------------------------

/**
 * Score write-good issues per 500 words (0-3 pts).
 * Calibrated for tax/legal content where jargon triggers false positives.
 */
function scoreIssuesPer500(issuesPer500) {
  if (issuesPer500 < 5) return 3;
  if (issuesPer500 <= 8) return 2;
  if (issuesPer500 <= 12) return 1;
  return 0;
}

/**
 * Score passive voice count (0-2 pts).
 * Calibrated for tax/legal content where passive voice is often required
 * ("must be filed", "may be assessed", "are required to report").
 */
function scorePassive(count) {
  if (count <= 5) return 2;
  if (count <= 10) return 1;
  return 0;
}

/**
 * Score weasel word count (0-1 pt).
 * Calibrated for tax/legal content where hedging is appropriate
 * ("generally", "typically", "may").
 */
function scoreWeasel(count) {
  if (count <= 3) return 1;
  if (count <= 6) return 0.5;
  return 0;
}

/**
 * Score adverb density as percentage of total words (0-1 pt).
 */
function scoreAdverbs(density) {
  if (density < 1) return 1;
  if (density <= 2) return 0.5;
  return 0;
}

/**
 * Score cliche count (0-1.5 pts).
 */
function scoreCliches(count) {
  if (count === 0) return 1.5;
  if (count <= 2) return 1;
  return 0;
}

/**
 * Score transition word rate (0-1.5 pts).
 * Rate = transitions per 300 words.
 */
function scoreTransitions(rate) {
  // >= 1 per 300 words = full marks
  if (rate >= 1) return 1.5;
  // >= 1 per 500 words = 0.6 per 300 words
  if (rate >= 0.6) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

/**
 * Analyse the writing quality of an article.
 *
 * @param {object} article - Parsed article object from fetchers/article.mjs.
 * @param {object} [_options] - Unused; present for interface consistency.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, _options = {}) {
  const { plainText, wordCount } = article;

  if (!plainText || wordCount === 0) {
    return {
      dimension: DIMENSION,
      score: 0,
      weight: WEIGHT,
      details: {
        issuesPer500: 0, passiveCount: 0, weaselCount: 0,
        adverbCount: 0, clicheCount: 0, transitionRate: 0,
      },
      issues: ['Article has no analysable text content.'],
    };
  }

  // --- Run write-good analysis ---
  const allSuggestions = writeGood(plainText);
  const issuesPer500 = wordCount > 0
    ? (allSuggestions.length / wordCount) * 500
    : 0;

  const passiveCount = countPassive(allSuggestions);
  const weaselCount = countWeasel(allSuggestions);
  const adverbCount = countAdverbs(allSuggestions);
  const adverbDensity = wordCount > 0 ? (adverbCount / wordCount) * 100 : 0;

  // --- Cliche analysis ---
  const cliches = findCliches(plainText);

  // --- Transition word analysis ---
  const transitions = countTransitions(plainText, wordCount);

  // --- Score each sub-criterion ---
  const issuesScore = scoreIssuesPer500(issuesPer500);
  const passiveScore = scorePassive(passiveCount);
  const weaselScore = scoreWeasel(weaselCount);
  const adverbScore = scoreAdverbs(adverbDensity);
  const clicheScore = scoreCliches(cliches.count);
  const transitionScore = scoreTransitions(transitions.rate);

  const totalScore = Math.min(
    10,
    issuesScore + passiveScore + weaselScore +
    adverbScore + clicheScore + transitionScore,
  );

  // --- Generate actionable issues ---
  const issues = [];

  if (issuesScore < 3) {
    issues.push(
      `${allSuggestions.length} writing issues detected (${issuesPer500.toFixed(1)} per 500 words). ` +
      'Review write-good suggestions to tighten prose.',
    );
  }

  if (passiveCount > 5 && passiveScore < 2) {
    issues.push(
      `${passiveCount} passive voice instance${passiveCount === 1 ? '' : 's'} found (>5). ` +
      'Some passive voice is expected in tax/legal content, but reduce where possible.',
    );
  }

  if (weaselCount > 3 && weaselScore < 1) {
    issues.push(
      `${weaselCount} weasel word${weaselCount === 1 ? '' : 's'} detected (>3). ` +
      'Some hedging is appropriate for tax content, but tighten where possible.',
    );
  }

  if (adverbScore < 1) {
    issues.push(
      `Adverb density is ${adverbDensity.toFixed(1)}% (target <1%). ` +
      'Replace adverbs with stronger verbs.',
    );
  }

  if (cliches.count > 0) {
    const clicheList = cliches.found.map(c => `"${c}"`).join(', ');
    issues.push(
      `${cliches.count} cliche${cliches.count === 1 ? '' : 's'} found: ${clicheList}. ` +
      'Replace with original, specific language.',
    );
  }

  if (transitionScore < 1.5) {
    issues.push(
      `Transition word rate is ${transitions.rate.toFixed(2)} per 300 words ` +
      `(${transitions.count} total). Add transitional phrases like "however", ` +
      '"therefore", "additionally" to improve logical flow.',
    );
  }

  return {
    dimension: DIMENSION,
    score: Math.round(totalScore * 100) / 100,
    weight: WEIGHT,
    details: {
      issuesPer500: Math.round(issuesPer500 * 10) / 10,
      passiveCount,
      weaselCount,
      adverbCount,
      adverbDensity: Math.round(adverbDensity * 100) / 100,
      clicheCount: cliches.count,
      transitionCount: transitions.count,
      transitionRate: Math.round(transitions.rate * 100) / 100,
    },
    issues,
  };
}
