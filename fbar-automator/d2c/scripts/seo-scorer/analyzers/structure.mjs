/**
 * structure.mjs — Content structure dimension analyzer for the SEO/AEO scorer.
 *
 * Evaluates the structural elements of an article: heading hierarchy,
 * FAQ presence, internal/authority links, tables/lists, word count,
 * disclaimers, and CTAs.
 *
 * Scoring rubric (0-10 total):
 *   Exactly 1 H1               — 1 pt
 *   >= 3 H2 headings           — 1 pt   (2 = 0.5)
 *   >= 2 H3 headings           — 0.5 pt
 *   FAQ section present         — 1 pt
 *   Internal links (>= 3)      — 1 pt   (2 = 0.5)
 *   Authority external links    — 1 pt   (2 = 0.5)
 *   Has table OR list (each)   — 0.5 pt  (max 1)
 *   Word count 1500-3000       — 1 pt   (1200-1500 or 3000-4000 = 0.5)
 *   Disclaimer present          — 0.5 pt
 *   CTA links present           — 1 pt
 *   Logical heading hierarchy   — 0.5 pt
 *
 * Weight: 0.12
 */

import { AUTHORITY_DOMAINS } from '../utils/config.mjs';

const DIMENSION = 'structure';
const WEIGHT = 0.12;

// CTA path patterns that indicate conversion-oriented links
const CTA_PATHS = ['/pricing', '/signup', '/sign-up', '/get-started', '/register'];

// Disclaimer phrases that satisfy legal/compliance requirements
const DISCLAIMER_PHRASES = [
  'does not constitute tax',
  'does not constitute legal',
  'informational purposes only',
  'not intended as tax advice',
  'not intended as legal advice',
  'consult a qualified',
  'consult a tax professional',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the heading hierarchy is logically valid.
 * No level should be skipped (e.g., H1 -> H3 without an H2 in between).
 *
 * @param {Array<{ level: number }>} headings
 * @returns {boolean}
 */
function isHeadingHierarchyValid(headings) {
  if (headings.length === 0) return true;

  let prevLevel = 0;
  for (const h of headings) {
    // A jump of more than 1 level from the previous heading is invalid
    // (e.g., H1 -> H3, or H2 -> H4). Going to a shallower level is fine.
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      return false;
    }
    prevLevel = h.level;
  }
  return true;
}

/**
 * Count links matching CTA paths.
 */
function countCtaLinks(links) {
  return links.filter(link => {
    const lower = (link.url || '').toLowerCase();
    return CTA_PATHS.some(p => lower.includes(p));
  }).length;
}

/**
 * Check if disclaimer text is present in the article body.
 */
function hasDisclaimerText(plainText) {
  const lower = plainText.toLowerCase();
  return DISCLAIMER_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Count links to authority domains.
 * Uses both the link's isAuthority flag (if set by the fetcher) and
 * a manual check against the AUTHORITY_DOMAINS list.
 */
function countAuthorityLinks(links) {
  return links.filter(link => {
    if (link.isAuthority) return true;
    const url = (link.url || '').toLowerCase();
    return AUTHORITY_DOMAINS.some(domain => url.includes(domain));
  }).length;
}

/**
 * Count internal blog links.
 * Uses the link's isInternal flag or checks for /blog/ path.
 */
function countInternalLinks(links) {
  return links.filter(link => {
    if (link.isInternal) return true;
    const url = (link.url || '').toLowerCase();
    return url.startsWith('/') || url.includes('/blog/');
  }).length;
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

/**
 * Analyse the structural elements of an article.
 *
 * @param {object} article - Parsed article object from fetchers/article.mjs.
 * @param {object} [_options] - Unused; present for interface consistency.
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, _options = {}) {
  const {
    headings = [],
    links = [],
    wordCount = 0,
    plainText = '',
    hasFAQ = false,
    hasTable = false,
    hasList = false,
    hasDisclaimer = false,
  } = article;

  // --- Compute structural metrics ---
  // In MDX blogs, the H1 can come from either a `# Title` in body OR
  // the `title` field in frontmatter (rendered as H1 by the page template).
  // Count either as having an H1.
  const bodyH1Count = headings.filter(h => h.level === 1).length;
  const hasFrontmatterTitle = Boolean(article.meta?.title);
  const h1Count = bodyH1Count > 0 ? bodyH1Count : (hasFrontmatterTitle ? 1 : 0);
  const h2Count = headings.filter(h => h.level === 2).length;
  const h3Count = headings.filter(h => h.level === 3).length;

  const faqPresent = hasFAQ || headings.some(h => {
    const lower = h.text.toLowerCase();
    return lower.includes('faq') || lower.includes('frequently asked');
  });

  const internalLinkCount = countInternalLinks(links);
  const authLinkCount = countAuthorityLinks(links);
  const ctaCount = countCtaLinks(links);
  const disclaimerPresent = hasDisclaimer || hasDisclaimerText(plainText);
  const hierarchyValid = isHeadingHierarchyValid(headings);

  // --- Score each sub-criterion ---
  let score = 0;

  // H1: exactly 1
  const h1Score = h1Count === 1 ? 1 : 0;
  score += h1Score;

  // H2: >= 3 = 1, 2 = 0.5
  const h2Score = h2Count >= 3 ? 1 : (h2Count === 2 ? 0.5 : 0);
  score += h2Score;

  // H3: >= 2 = 0.5
  const h3Score = h3Count >= 2 ? 0.5 : 0;
  score += h3Score;

  // FAQ section
  const faqScore = faqPresent ? 1 : 0;
  score += faqScore;

  // Internal links
  const internalScore = internalLinkCount >= 3 ? 1 : (internalLinkCount === 2 ? 0.5 : 0);
  score += internalScore;

  // Authority links
  const authScore = authLinkCount >= 3 ? 1 : (authLinkCount === 2 ? 0.5 : 0);
  score += authScore;

  // Table and list (0.5 each, max 1)
  const tableScore = hasTable ? 0.5 : 0;
  const listScore = hasList ? 0.5 : 0;
  score += Math.min(1, tableScore + listScore);

  // Word count
  let wordCountScore = 0;
  if (wordCount >= 1500 && wordCount <= 3000) {
    wordCountScore = 1;
  } else if ((wordCount >= 1200 && wordCount < 1500) || (wordCount > 3000 && wordCount <= 4000)) {
    wordCountScore = 0.5;
  }
  score += wordCountScore;

  // Disclaimer
  const disclaimerScore = disclaimerPresent ? 0.5 : 0;
  score += disclaimerScore;

  // CTA links
  const ctaLinkScore = ctaCount >= 1 ? 1 : 0;
  score += ctaLinkScore;

  // Heading hierarchy
  const hierarchyScore = hierarchyValid ? 0.5 : 0;
  score += hierarchyScore;

  const totalScore = Math.min(10, score);

  // --- Generate actionable issues ---
  const issues = [];

  if (h1Count === 0) {
    issues.push('Missing H1 heading. Add exactly one H1 as the article title.');
  } else if (h1Count > 1) {
    issues.push(`${h1Count} H1 headings found. Use exactly one H1 and demote extras to H2.`);
  }

  if (h2Count < 3) {
    issues.push(
      `Only ${h2Count} H2 heading${h2Count === 1 ? '' : 's'} found (need >= 3). ` +
      'Add more H2 sections to improve content organization.',
    );
  }

  if (h3Count < 2) {
    issues.push(
      `Only ${h3Count} H3 heading${h3Count === 1 ? '' : 's'} found (need >= 2). ` +
      'Add H3 sub-sections under H2 headings for deeper structure.',
    );
  }

  if (!faqPresent) {
    issues.push('No FAQ section found. Add an FAQ section with common questions.');
  }

  if (internalLinkCount < 3) {
    issues.push(
      `Only ${internalLinkCount} internal link${internalLinkCount === 1 ? '' : 's'} (need >= 3). ` +
      'Add links to related /blog/* articles for better internal linking.',
    );
  }

  if (authLinkCount < 3) {
    const domainList = AUTHORITY_DOMAINS.slice(0, 3).join(', ');
    issues.push(
      `Only ${authLinkCount} authority link${authLinkCount === 1 ? '' : 's'} (need >= 3). ` +
      `Add links to authoritative sources (${domainList}).`,
    );
  }

  if (!hasTable && !hasList) {
    issues.push('No tables or lists found. Add structured elements for scannability.');
  } else if (!hasTable) {
    issues.push('No table found. Consider adding a comparison or summary table.');
  } else if (!hasList) {
    issues.push('No list found. Consider adding bulleted or numbered lists.');
  }

  if (wordCountScore < 1) {
    if (wordCount < 1200) {
      issues.push(`Word count is ${wordCount} (target 1500-3000). Article needs more depth.`);
    } else if (wordCount < 1500) {
      issues.push(`Word count is ${wordCount} (target 1500-3000). Consider expanding content slightly.`);
    } else {
      issues.push(`Word count is ${wordCount} (target 1500-3000). Consider trimming for focus.`);
    }
  }

  if (!disclaimerPresent) {
    issues.push(
      'No legal disclaimer found. Add "informational purposes only" or ' +
      '"does not constitute tax advice" language.',
    );
  }

  if (ctaCount === 0) {
    issues.push(
      'No CTA links found. Add at least one link to /pricing, /signup, or /get-started.',
    );
  }

  if (!hierarchyValid) {
    issues.push(
      'Heading hierarchy is broken (levels are skipped). ' +
      'Ensure H1 -> H2 -> H3 order without gaps.',
    );
  }

  return {
    dimension: DIMENSION,
    score: Math.round(totalScore * 100) / 100,
    weight: WEIGHT,
    details: {
      h1Count,
      h2Count,
      h3Count,
      hasFAQ: faqPresent,
      internalLinkCount,
      authLinkCount,
      hasTable,
      hasList,
      wordCount,
      hasDisclaimer: disclaimerPresent,
      ctaCount,
      hierarchyValid,
    },
    issues,
  };
}
