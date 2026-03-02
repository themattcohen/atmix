/**
 * aeo-signals.mjs — Answer Engine Optimization signal analyzer.
 *
 * Evaluates how well an article is optimized for AI citation in
 * ChatGPT, Perplexity, Google AI Overviews, and similar answer
 * engines. Checks answer paragraph quality, question-format headings,
 * citation density, entity clarity, PAA coverage, definition
 * sentences, and numbered step lists.
 *
 * Weight: 0.15 (as defined in config.mjs DIMENSION_WEIGHTS).
 */

import { AUTHORITY_DOMAINS } from '../utils/config.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION = 'aeoSignals';
const WEIGHT = 0.15;

/** Min / max word count for a "good" answer paragraph. */
const ANSWER_PARA_MIN_WORDS = 30;
const ANSWER_PARA_MAX_WORDS = 100;

/** Minimum significant-word overlap ratio to count a PAA match. */
const PAA_MATCH_THRESHOLD = 0.5;

/** Words per block for citation density calculation. */
const CITATION_DENSITY_BLOCK_SIZE = 500;

/** Key FBAR entities that should be clearly mentioned. */
const KEY_ENTITIES = [
  'FBAR',
  'FinCEN',
  'BSA',
  'foreign financial account',
  'Report of Foreign Bank and Financial Accounts',
  '$10,000 threshold',
  '\\$10,000',
  '10,000',
];

/** Statute / regulation reference patterns. */
const STATUTE_PATTERNS = [
  /\b\d+\s*U\.?S\.?C\.?\s*[^\s,]+/gi,  // 31 USC 5314
  /\b\d+\s*C\.?F\.?R\.?\s*[^\s,]+/gi,  // 31 CFR 1010.350
  /\bI\.?R\.?C\.?\s*[^\s,]+/gi,         // IRC 6038D
  /\bTitle\s+\d+/gi,                     // Title 31
];

/** Stop words excluded from PAA keyword overlap. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'about', 'up', 'down', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'every', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'their',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract significant (non-stop) words from a string, lowercased.
 *
 * @param {string} text
 * @returns {string[]}
 */
function significantWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Count words in a text string.
 *
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Get the first paragraph of text that follows each H2 heading in the body.
 * Returns an array of { heading, paragraph, wordCount } objects.
 *
 * @param {string} body  MDX body content.
 * @param {Array<{ level: number, text: string }>} headings
 * @returns {Array<{ heading: string, paragraph: string, wordCount: number }>}
 */
function extractAnswerParagraphs(body, headings) {
  const results = [];
  const h2Headings = headings.filter((h) => h.level === 2);
  const lines = body.split('\n');

  for (const heading of h2Headings) {
    // Find the line index of this heading in the body
    const headingIdx = lines.findIndex((line) => {
      const cleaned = line.replace(/^#{1,6}\s+/, '').trim();
      return cleaned === heading.text.trim();
    });

    if (headingIdx === -1) continue;

    // Collect the first non-empty, non-heading paragraph after the heading
    let paragraph = '';
    let collecting = false;

    for (let i = headingIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Stop at the next heading
      if (/^#{1,6}\s+/.test(line)) break;

      // Skip empty lines until we find content
      if (!line) {
        if (collecting) break; // end of paragraph
        continue;
      }

      // Skip MDX components, imports, images
      if (line.startsWith('<') || line.startsWith('import ') || line.startsWith('![')) {
        if (collecting) break;
        continue;
      }

      collecting = true;
      paragraph += (paragraph ? ' ' : '') + line;
    }

    if (paragraph) {
      results.push({
        heading: heading.text,
        paragraph,
        wordCount: countWords(paragraph),
      });
    }
  }

  return results;
}

/**
 * Check if a paragraph contains the topic words from its heading.
 *
 * @param {string} paragraph
 * @param {string} headingText
 * @returns {boolean}
 */
function paragraphContainsHeadingTopic(paragraph, headingText) {
  const headingWords = significantWords(headingText);
  if (headingWords.length === 0) return true; // trivial heading

  const paraLower = paragraph.toLowerCase();
  const matchCount = headingWords.filter((w) => paraLower.includes(w)).length;

  return matchCount / headingWords.length >= 0.4;
}

/**
 * Count question-format headings (ending with ?).
 *
 * @param {Array<{ level: number, text: string }>} headings
 * @returns {number}
 */
function countQuestionHeadings(headings) {
  return headings.filter((h) => h.text.trim().endsWith('?')).length;
}

/**
 * Calculate citation density: authority link count + statute references
 * per CITATION_DENSITY_BLOCK_SIZE words.
 *
 * @param {object} article
 * @returns {{ totalCitations: number, densityPer500: number }}
 */
function calculateCitationDensity(article) {
  const { links, body, wordCount } = article;

  // Count authority links
  const authorityLinkCount = links.filter((l) => l.isAuthority).length;

  // Count statute references in the body
  let statuteCount = 0;
  for (const pattern of STATUTE_PATTERNS) {
    const matches = body.match(pattern) || [];
    statuteCount += matches.length;
  }

  const totalCitations = authorityLinkCount + statuteCount;
  const blocks = Math.max(1, wordCount / CITATION_DENSITY_BLOCK_SIZE);
  const densityPer500 = totalCitations / blocks;

  return { totalCitations, densityPer500 };
}

/**
 * Count how many key FBAR entities appear in the article text.
 *
 * @param {string} plainText
 * @returns {{ count: number, found: string[], missing: string[] }}
 */
function checkEntityCoverage(plainText) {
  const textLower = plainText.toLowerCase();
  const found = [];
  const missing = [];

  for (const entity of KEY_ENTITIES) {
    // Handle regex-style patterns (e.g., \\$10,000)
    const searchTerm = entity.replace(/^\\/, '');
    if (textLower.includes(searchTerm.toLowerCase())) {
      found.push(entity.replace(/^\\/, ''));
    } else {
      missing.push(entity.replace(/^\\/, ''));
    }
  }

  // Deduplicate: "$10,000 threshold" and "10,000" and "$10,000" overlap
  const dedupedFound = [...new Set(found)];
  // If any numeric variant was found, count the threshold entity as found
  const hasThresholdVariant =
    dedupedFound.some((e) => e.includes('10,000') || e.includes('10000'));

  const uniqueFound = new Set();
  const uniqueMissing = [];

  for (const entity of KEY_ENTITIES) {
    const clean = entity.replace(/^\\/, '');
    if (clean.includes('10,000') || clean.includes('$10,000')) {
      if (hasThresholdVariant) {
        uniqueFound.add('$10,000 threshold');
      }
    } else if (textLower.includes(clean.toLowerCase())) {
      uniqueFound.add(clean);
    } else {
      uniqueMissing.push(clean);
    }
  }

  // Filter out threshold-related duplicates from missing
  const filteredMissing = hasThresholdVariant
    ? uniqueMissing.filter(
        (e) => !e.includes('10,000') && !e.includes('$10,000'),
      )
    : uniqueMissing;

  return {
    count: uniqueFound.size,
    found: [...uniqueFound],
    missing: filteredMissing,
  };
}

/**
 * Match PAA questions against article headings via keyword overlap.
 *
 * @param {string[]} paaQuestions
 * @param {Array<{ text: string }>} headings
 * @returns {{ matchCount: number, matched: string[], unmatched: string[] }}
 */
function matchPaaQuestions(paaQuestions, headings) {
  if (!paaQuestions || paaQuestions.length === 0) {
    return { matchCount: 0, matched: [], unmatched: [] };
  }

  const headingWordSets = headings.map((h) => significantWords(h.text));
  const matched = [];
  const unmatched = [];

  for (const question of paaQuestions) {
    const qWords = significantWords(question);
    if (qWords.length === 0) continue;

    const isMatched = headingWordSets.some((headingWords) => {
      if (headingWords.length === 0) return false;
      const overlap = qWords.filter((w) => headingWords.includes(w)).length;
      return overlap / qWords.length >= PAA_MATCH_THRESHOLD;
    });

    if (isMatched) {
      matched.push(question);
    } else {
      unmatched.push(question);
    }
  }

  return { matchCount: matched.length, matched, unmatched };
}

/**
 * Count clear definition sentences in the text.
 * Pattern: "X is Y", "X refers to Y", "X means Y", "X is defined as Y"
 *
 * @param {string[]} sentences
 * @returns {number}
 */
function countDefinitions(sentences) {
  const definitionPatterns = [
    /\b(?:is|are)\s+(?:a|an|the)\s+/i,
    /\brefers?\s+to\b/i,
    /\bmeans?\s+/i,
    /\bis\s+defined\s+as\b/i,
    /\bstands?\s+for\b/i,
  ];

  let count = 0;
  for (const sentence of sentences) {
    // Definition sentences are typically moderate length (10-50 words)
    const wc = countWords(sentence);
    if (wc < 8 || wc > 60) continue;

    for (const pattern of definitionPatterns) {
      if (pattern.test(sentence)) {
        count++;
        break;
      }
    }
  }

  return count;
}

/**
 * Check for numbered step lists with >=3 items.
 *
 * @param {string} body
 * @returns {boolean}
 */
function hasNumberedStepList(body) {
  const orderedItems = body.match(/^\s*\d+\.\s+.+$/gm) || [];
  return orderedItems.length >= 3;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze an article for Answer Engine Optimization signals.
 *
 * @param {object} article  Parsed article object.
 * @param {object} [options]  Optional config. May contain serpData.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, options = {}) {
  const { serpData } = options;
  const issues = [];
  let score = 0;

  // -------------------------------------------------------------------------
  // 1. Answer paragraph quality (2 pts)
  // -------------------------------------------------------------------------
  const answerParas = extractAnswerParagraphs(article.body, article.headings);
  const h2Count = article.headings.filter((h) => h.level === 2).length;

  let goodAnswerCount = 0;
  const weakAnswerHeadings = [];

  for (const ap of answerParas) {
    const inRange =
      ap.wordCount >= ANSWER_PARA_MIN_WORDS &&
      ap.wordCount <= ANSWER_PARA_MAX_WORDS;
    const containsTopic = paragraphContainsHeadingTopic(
      ap.paragraph,
      ap.heading,
    );

    if (inRange && containsTopic) {
      goodAnswerCount++;
    } else {
      weakAnswerHeadings.push({
        heading: ap.heading,
        wordCount: ap.wordCount,
        reason: !inRange
          ? `${ap.wordCount} words (target ${ANSWER_PARA_MIN_WORDS}-${ANSWER_PARA_MAX_WORDS})`
          : 'does not reference heading topic',
      });
    }
  }

  const answerRatio = h2Count > 0 ? goodAnswerCount / h2Count : 0;

  if (answerRatio >= 0.5) {
    score += 2;
  } else if (answerRatio >= 0.3) {
    score += 1;
  }

  for (const weak of weakAnswerHeadings.slice(0, 3)) {
    issues.push(
      `Add a concise answer paragraph (${ANSWER_PARA_MIN_WORDS}-${ANSWER_PARA_MAX_WORDS} words) after H2 "${weak.heading}" — current: ${weak.reason}`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Question heading format (1.5 pts)
  // -------------------------------------------------------------------------
  const questionHeadingCount = countQuestionHeadings(article.headings);

  if (questionHeadingCount >= 3) {
    score += 1.5;
  } else if (questionHeadingCount >= 1) {
    score += 0.75;
  }

  if (questionHeadingCount < 3) {
    // Find H2s that could be rephrased as questions
    const nonQuestionH2s = article.headings
      .filter((h) => h.level === 2 && !h.text.trim().endsWith('?'))
      .slice(0, 2);

    for (const h of nonQuestionH2s) {
      issues.push(
        `Rephrase H2 "${h.text}" as a question for better AEO (e.g., "What Are ${h.text}?" or "How Does ${h.text} Work?")`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // 3. Citation density (1.5 pts)
  // -------------------------------------------------------------------------
  const citations = calculateCitationDensity(article);

  if (citations.densityPer500 >= 2) {
    score += 1.5;
  } else if (citations.densityPer500 >= 1) {
    score += 0.75;
  }

  if (citations.densityPer500 < 2) {
    const needed = Math.ceil(
      2 * (article.wordCount / CITATION_DENSITY_BLOCK_SIZE) -
        citations.totalCitations,
    );
    issues.push(
      `Citation density is ${citations.densityPer500.toFixed(1)} per 500 words — add ~${Math.max(1, needed)} more authoritative references (irs.gov, fincen.gov, statute citations) to reach 2.0+`,
    );
  }

  // -------------------------------------------------------------------------
  // 4. Entity clarity (1 pt)
  // -------------------------------------------------------------------------
  const entities = checkEntityCoverage(article.plainText);

  if (entities.count >= 5) {
    score += 1;
  } else if (entities.count >= 3) {
    score += 0.5;
  }

  if (entities.missing.length > 0) {
    issues.push(
      `Missing key FBAR entities: ${entities.missing.slice(0, 3).join(', ')} — mention these clearly for entity recognition by AI systems`,
    );
  }

  // -------------------------------------------------------------------------
  // 5. PAA coverage (1.5 pts) — skip if no SERP data
  // -------------------------------------------------------------------------
  let paaResult = { matchCount: 0, matched: [], unmatched: [] };

  if (serpData?.paaQuestions?.length > 0) {
    paaResult = matchPaaQuestions(serpData.paaQuestions, article.headings);

    if (paaResult.matchCount >= 3) {
      score += 1.5;
    } else if (paaResult.matchCount >= 1) {
      score += 0.75;
    }

    if (paaResult.unmatched.length > 0) {
      for (const q of paaResult.unmatched.slice(0, 2)) {
        issues.push(
          `PAA question not addressed: "${q}" — consider adding a heading/section covering this topic`,
        );
      }
    }
  }
  // When no SERP data, PAA points are excluded from scoring (not penalized)

  // -------------------------------------------------------------------------
  // 6. Concise definitions (1 pt)
  // -------------------------------------------------------------------------
  const definitionCount = countDefinitions(article.sentences);

  if (definitionCount >= 2) {
    score += 1;
  } else if (definitionCount >= 1) {
    score += 0.5;
  }

  if (definitionCount < 2) {
    issues.push(
      'Add clear definition sentences (e.g., "An FBAR is a report filed with FinCEN...") — AI engines extract these as featured answers',
    );
  }

  // -------------------------------------------------------------------------
  // 7. Numbered/step lists (0.5 pt)
  // -------------------------------------------------------------------------
  const hasStepList = hasNumberedStepList(article.body);

  if (hasStepList) {
    score += 0.5;
  } else {
    issues.push(
      'Add a numbered step list (3+ items) — AI engines favor extractable ordered instructions',
    );
  }

  // -------------------------------------------------------------------------
  // Adjust max possible score when no SERP data (PAA is excluded)
  // -------------------------------------------------------------------------
  if (!serpData?.paaQuestions?.length) {
    // Max possible without PAA = 7.5 out of 10
    // Scale up to 10 so the dimension isn't permanently handicapped
    const maxWithoutPaa = 7.5;
    score = (score / maxWithoutPaa) * 10;
  }

  // Clamp to 0-10
  score = Math.max(0, Math.min(10, score));

  return {
    dimension: DIMENSION,
    score: Math.round(score * 100) / 100,
    weight: WEIGHT,
    details: {
      answerParaQuality: {
        good: goodAnswerCount,
        total: h2Count,
        ratio: Math.round(answerRatio * 100) / 100,
      },
      questionHeadingCount,
      citationDensity: {
        total: citations.totalCitations,
        per500Words: Math.round(citations.densityPer500 * 100) / 100,
      },
      entityCoverage: {
        count: entities.count,
        found: entities.found,
        missing: entities.missing,
      },
      paaMatchCount: paaResult.matchCount,
      paaMatched: paaResult.matched,
      paaUnmatched: paaResult.unmatched,
      definitionCount,
      hasStepList,
    },
    issues,
  };
}
