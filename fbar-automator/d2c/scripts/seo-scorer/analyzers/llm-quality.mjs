/**
 * llm-quality.mjs — LLM-powered article quality analyzer.
 *
 * Uses Claude Haiku to judge article quality across six sub-dimensions:
 * accuracy, depth, actionability, trustworthiness, uniqueValue, and
 * audienceAlignment. This is the heaviest scoring dimension (30% weight)
 * because it captures nuances that rule-based checks cannot.
 *
 * Cost: ~$0.30 per batch using claude-haiku-4-5-20251001.
 *
 * Weight: 0.30 (as defined in config.mjs DIMENSION_WEIGHTS).
 */

import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION = 'llmQuality';
const WEIGHT = 0.30;

const MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

/** Max words to send to the LLM (first ~4000 words of article). */
const MAX_ARTICLE_WORDS = 4000;

/** Sub-dimension weights for aggregate score calculation. */
const SUB_WEIGHTS = {
  accuracy: 0.25,
  depth: 0.20,
  actionability: 0.20,
  trustworthiness: 0.15,
  uniqueValue: 0.10,
  audienceAlignment: 0.10,
};

const SUB_DIMENSIONS = Object.keys(SUB_WEIGHTS);

const FALLBACK_SCORE = 5.0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Truncate article content to the first MAX_ARTICLE_WORDS words.
 *
 * @param {string} plainText  Stripped article text.
 * @returns {string}
 */
function truncateContent(plainText) {
  const words = plainText.split(/\s+/);
  if (words.length <= MAX_ARTICLE_WORDS) return plainText;
  return words.slice(0, MAX_ARTICLE_WORDS).join(' ') + '\n\n[...truncated]';
}

/**
 * Build the evaluation prompt for Claude.
 *
 * @param {string} keyword  Target keyword.
 * @param {string} articleContent  Truncated article text.
 * @returns {string}
 */
function buildPrompt(keyword, articleContent) {
  return `You are an expert SEO content quality judge for a US tax compliance blog (fbardirect.com) focused on FBAR (Foreign Bank Account Report) filing.

Evaluate the following article for the target keyword: "${keyword}"

Rate each dimension 0-10 and provide specific issues. Return ONLY valid JSON:

{
  "accuracy": { "score": X, "issues": ["..."] },
  "depth": { "score": X, "issues": ["..."] },
  "actionability": { "score": X, "issues": ["..."] },
  "trustworthiness": { "score": X, "issues": ["..."] },
  "uniqueValue": { "score": X, "issues": ["..."] },
  "audienceAlignment": { "score": X, "issues": ["..."] }
}

Scoring guide:
- accuracy: Factual correctness of tax/legal information, correct thresholds, dates, penalties
- depth: Comprehensiveness of topic coverage, edge cases addressed, nuanced explanations
- actionability: Clear next steps, practical guidance, specific instructions readers can follow
- trustworthiness: Authoritative tone, proper sourcing, professional disclaimers, no fear-mongering
- uniqueValue: What this article offers that generic FBAR articles don't (real examples, calculators, unique angles)
- audienceAlignment: Appropriate for target audience (US persons with foreign accounts, first-time filers, expats)

ARTICLE CONTENT:
---
${articleContent}
---`;
}

/**
 * Parse a JSON response from the LLM. Falls back to regex extraction
 * if the response is not valid JSON.
 *
 * @param {string} text  Raw LLM response text.
 * @returns {object|null}  Parsed scores object or null on failure.
 */
function parseResponse(text) {
  // First try: direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (validateScores(parsed)) return parsed;
  } catch {
    // Fall through to regex extraction
  }

  // Second try: extract JSON block from markdown code fence
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (validateScores(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  // Third try: find the first { ... } block in the response
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (validateScores(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  // Fourth try: regex-based score extraction as last resort
  const scores = {};
  for (const dim of SUB_DIMENSIONS) {
    const scoreMatch = text.match(
      new RegExp(`"${dim}"\\s*:\\s*\\{[^}]*"score"\\s*:\\s*(\\d+(?:\\.\\d+)?)`),
    );
    if (scoreMatch) {
      scores[dim] = {
        score: Math.min(10, Math.max(0, parseFloat(scoreMatch[1]))),
        issues: [],
      };
    }
  }

  if (Object.keys(scores).length >= 4) {
    // Fill in missing dimensions with default score
    for (const dim of SUB_DIMENSIONS) {
      if (!scores[dim]) {
        scores[dim] = { score: FALLBACK_SCORE, issues: [] };
      }
    }
    return scores;
  }

  return null;
}

/**
 * Validate that a parsed object has the expected structure.
 *
 * @param {object} scores
 * @returns {boolean}
 */
function validateScores(scores) {
  if (!scores || typeof scores !== 'object') return false;

  for (const dim of SUB_DIMENSIONS) {
    if (!scores[dim]) return false;
    if (typeof scores[dim].score !== 'number') return false;
    if (scores[dim].score < 0 || scores[dim].score > 10) return false;
  }

  return true;
}

/**
 * Calculate the weighted aggregate score from sub-dimension scores.
 *
 * @param {object} scores  Parsed scores object.
 * @returns {number}  Aggregate score 0-10.
 */
function calculateAggregate(scores) {
  let aggregate = 0;

  for (const [dim, weight] of Object.entries(SUB_WEIGHTS)) {
    const dimScore = scores[dim]?.score ?? FALLBACK_SCORE;
    aggregate += dimScore * weight;
  }

  return Math.max(0, Math.min(10, aggregate));
}

/**
 * Flatten all sub-dimension issues into a single array, prefixed
 * with the dimension name.
 *
 * @param {object} scores  Parsed scores object.
 * @returns {string[]}
 */
function flattenIssues(scores) {
  const issues = [];

  for (const dim of SUB_DIMENSIONS) {
    const dimIssues = scores[dim]?.issues || [];
    for (const issue of dimIssues) {
      if (typeof issue === 'string' && issue.trim()) {
        issues.push(`[${dim}] ${issue.trim()}`);
      }
    }
  }

  return issues;
}

/**
 * Call the Claude API with a timeout.
 *
 * @param {Anthropic} client  Anthropic SDK client.
 * @param {string} prompt  User message content.
 * @returns {Promise<{ text: string, tokensUsed: number }>}
 */
async function callClaude(client, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal },
    );

    const text =
      response.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('') || '';

    const tokensUsed =
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0);

    return { text, tokensUsed };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze article quality using Claude Haiku.
 *
 * @param {object} article  Parsed article object.
 * @param {object} [options]  Optional config. May contain llmApiKey.
 * @returns {Promise<{ dimension: string, score: number, weight: number, details: object, issues: string[] }>}
 */
export async function analyze(article, options = {}) {
  const apiKey = options.llmApiKey || process.env.ANTHROPIC_API_KEY || '';

  // Gate: no API key available
  if (!apiKey) {
    return {
      dimension: DIMENSION,
      score: FALLBACK_SCORE,
      weight: WEIGHT,
      details: {
        accuracy: FALLBACK_SCORE,
        depth: FALLBACK_SCORE,
        actionability: FALLBACK_SCORE,
        trustworthiness: FALLBACK_SCORE,
        uniqueValue: FALLBACK_SCORE,
        audienceAlignment: FALLBACK_SCORE,
        model: null,
        tokensUsed: 0,
      },
      issues: [
        'LLM quality scoring disabled — set ANTHROPIC_API_KEY environment variable to enable',
      ],
    };
  }

  const client = new Anthropic({ apiKey });
  const keyword = article.keyword || article.slug || 'FBAR';
  const articleContent = truncateContent(article.plainText || article.body || '');
  const prompt = buildPrompt(keyword, articleContent);

  let text = '';
  let tokensUsed = 0;

  try {
    const result = await callClaude(client, prompt);
    text = result.text;
    tokensUsed = result.tokensUsed;
  } catch (err) {
    const errorMessage =
      err.name === 'AbortError'
        ? `LLM API call timed out after ${TIMEOUT_MS / 1000}s`
        : `LLM API call failed: ${err.message || String(err)}`;

    return {
      dimension: DIMENSION,
      score: FALLBACK_SCORE,
      weight: WEIGHT,
      details: {
        accuracy: FALLBACK_SCORE,
        depth: FALLBACK_SCORE,
        actionability: FALLBACK_SCORE,
        trustworthiness: FALLBACK_SCORE,
        uniqueValue: FALLBACK_SCORE,
        audienceAlignment: FALLBACK_SCORE,
        model: MODEL_ID,
        tokensUsed: 0,
        error: errorMessage,
      },
      issues: [errorMessage],
    };
  }

  // Parse the response
  const scores = parseResponse(text);

  if (!scores) {
    return {
      dimension: DIMENSION,
      score: FALLBACK_SCORE,
      weight: WEIGHT,
      details: {
        accuracy: FALLBACK_SCORE,
        depth: FALLBACK_SCORE,
        actionability: FALLBACK_SCORE,
        trustworthiness: FALLBACK_SCORE,
        uniqueValue: FALLBACK_SCORE,
        audienceAlignment: FALLBACK_SCORE,
        model: MODEL_ID,
        tokensUsed,
        error: 'Failed to parse LLM response as valid JSON',
        rawResponse: text.slice(0, 500),
      },
      issues: [
        'LLM response could not be parsed — score defaulted to 5.0. Raw response saved in details.',
      ],
    };
  }

  // Calculate aggregate score
  const aggregateScore = calculateAggregate(scores);
  const issues = flattenIssues(scores);

  return {
    dimension: DIMENSION,
    score: Math.round(aggregateScore * 100) / 100,
    weight: WEIGHT,
    details: {
      accuracy: scores.accuracy?.score ?? FALLBACK_SCORE,
      depth: scores.depth?.score ?? FALLBACK_SCORE,
      actionability: scores.actionability?.score ?? FALLBACK_SCORE,
      trustworthiness: scores.trustworthiness?.score ?? FALLBACK_SCORE,
      uniqueValue: scores.uniqueValue?.score ?? FALLBACK_SCORE,
      audienceAlignment: scores.audienceAlignment?.score ?? FALLBACK_SCORE,
      model: MODEL_ID,
      tokensUsed,
    },
    issues,
  };
}
