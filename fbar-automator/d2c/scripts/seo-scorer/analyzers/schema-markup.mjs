/**
 * schema-markup.mjs — Structured data signal analyzer.
 *
 * Evaluates an MDX blog article for structured data readiness:
 * FAQ schema signals, Article/BlogPosting frontmatter, breadcrumb
 * structure, meta description quality, social tags, TOC depth,
 * HowTo patterns, and list schema signals.
 *
 * Weight: 0.08 (as defined in config.mjs DIMENSION_WEIGHTS).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMENSION = 'schemaMarkup';
const WEIGHT = 0.08;

const META_DESC_MIN = 120;
const META_DESC_MAX = 160;
const TOC_MIN_H2_COUNT = 3;
const LIST_MIN_ITEMS = 5;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the article contains a FAQ section with structured Q&A
 * content. The pattern we look for:
 *   - An H2 or H3 heading containing "FAQ" (case-insensitive)
 *   - Followed by bold-text questions (**Question?**) with paragraph answers
 *   - OR heading-level questions (### Question?) with paragraph answers
 *
 * @param {object} article
 * @returns {{ detected: boolean, questionCount: number }}
 */
function detectFaqSignals(article) {
  const { headings, body } = article;

  // Check for a heading that contains "FAQ" or "Frequently Asked"
  const faqHeading = headings.find(
    (h) =>
      h.level >= 2 &&
      (/\bfaq\b/i.test(h.text) || /frequently\s+asked/i.test(h.text)),
  );

  if (!faqHeading) {
    return { detected: false, questionCount: 0 };
  }

  // Count bold-text Q&A pairs: **Question?** followed by a paragraph
  const boldQaPattern = /\*\*[^*]+\?\*\*/g;
  const boldMatches = body.match(boldQaPattern) || [];

  // Count sub-heading Q&A pairs: ### Question?
  const headingQaPattern = /^#{2,4}\s+.+\?$/gm;
  const headingMatches = body.match(headingQaPattern) || [];

  const questionCount = boldMatches.length + headingMatches.length;

  return { detected: questionCount >= 2, questionCount };
}

/**
 * Check frontmatter fields that enable Article/BlogPosting schema.
 *
 * @param {object} meta  Frontmatter metadata.
 * @returns {{ hasTitle: boolean, hasDescription: boolean, hasDate: boolean, hasAuthor: boolean, score: number }}
 */
function checkArticleSchemaFields(meta) {
  const hasTitle = Boolean(meta.title && meta.title.trim());
  const hasDescription = Boolean(meta.description && meta.description.trim());
  const hasDate = Boolean(
    meta.publishedDate || meta.publishDate || meta.date || meta.createdAt,
  );
  const hasAuthor = Boolean(meta.author && meta.author.trim());

  let score = 0;
  if (hasTitle) score += 0.5;
  if (hasDescription) score += 0.5;
  if (hasDate) score += 0.5;
  if (hasAuthor) score += 0.5;

  return { hasTitle, hasDescription, hasDate, hasAuthor, score };
}

/**
 * Score the meta description by presence and length.
 *
 * @param {object} meta
 * @returns {{ length: number, score: number }}
 */
function scoreMetaDescription(meta) {
  const desc = meta.description || '';
  const length = desc.trim().length;

  if (length === 0) {
    return { length: 0, score: 0 };
  }

  if (length >= META_DESC_MIN && length <= META_DESC_MAX) {
    return { length, score: 1.5 };
  }

  // Present but wrong length
  return { length, score: 0.5 };
}

/**
 * Check for hero image in frontmatter (enables og:image).
 *
 * @param {object} meta
 * @returns {boolean}
 */
function hasHeroImage(meta) {
  return Boolean(
    meta.heroImage ||
      meta.image ||
      meta.ogImage ||
      meta.coverImage ||
      meta.thumbnail,
  );
}

/**
 * Check if the heading structure supports a table of contents.
 * Requires >= TOC_MIN_H2_COUNT H2 headings with descriptive text.
 *
 * @param {Array<{ level: number, text: string }>} headings
 * @returns {boolean}
 */
function hasTocSignal(headings) {
  const h2s = headings.filter((h) => h.level === 2);
  if (h2s.length < TOC_MIN_H2_COUNT) return false;

  // "Descriptive" = at least 3 words in the heading text
  const descriptiveCount = h2s.filter(
    (h) => h.text.split(/\s+/).length >= 3,
  ).length;

  return descriptiveCount >= TOC_MIN_H2_COUNT;
}

/**
 * Detect HowTo schema signals: numbered steps or "Step N:" patterns.
 *
 * @param {string} body  MDX body content.
 * @returns {boolean}
 */
function detectHowToSignal(body) {
  // Pattern: "Step 1:", "Step 2:", etc.
  const stepPattern = /\bstep\s+\d+[.:]/gi;
  const stepMatches = body.match(stepPattern) || [];
  if (stepMatches.length >= 3) return true;

  // Pattern: ordered list with >=3 items that look instructional
  const orderedListItems = body.match(/^\s*\d+\.\s+.+$/gm) || [];
  return orderedListItems.length >= 3;
}

/**
 * Detect list schema signals: structured lists with >= LIST_MIN_ITEMS items.
 *
 * @param {string} body
 * @returns {boolean}
 */
function detectListSignal(body) {
  // Count consecutive unordered list items (-, *, +)
  const unorderedItems = body.match(/^\s*[-*+]\s+.+$/gm) || [];
  if (unorderedItems.length >= LIST_MIN_ITEMS) return true;

  // Count consecutive ordered list items
  const orderedItems = body.match(/^\s*\d+\.\s+.+$/gm) || [];
  return orderedItems.length >= LIST_MIN_ITEMS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze an article for structured data / schema markup readiness.
 *
 * @param {object} article  Parsed article object.
 * @param {object} [options]  Optional config (unused by this analyzer).
 * @returns {{ dimension: string, score: number, weight: number, details: object, issues: string[] }}
 */
export function analyze(article, options = {}) {
  const issues = [];
  let score = 0;

  // 1. FAQ schema signals (2 pts)
  const faq = detectFaqSignals(article);
  const hasFaqSchema = faq.detected;
  if (hasFaqSchema) {
    score += 2;
  } else if (faq.questionCount > 0) {
    score += 0.5;
    issues.push(
      `FAQ section found but only ${faq.questionCount} Q&A pair(s) detected — add at least 2 structured Q&A pairs for FAQ rich results`,
    );
  } else {
    issues.push(
      'Add FAQ section with structured Q&A format (## FAQ heading + **bold questions** with paragraph answers) for FAQ rich results',
    );
  }

  // 2. Article/BlogPosting schema signals (2 pts)
  const articleSchema = checkArticleSchemaFields(article.meta);
  const hasArticleSchema = articleSchema.score === 2;
  score += articleSchema.score;

  if (!articleSchema.hasTitle) {
    issues.push('Add "title" to frontmatter for Article schema');
  }
  if (!articleSchema.hasDescription) {
    issues.push('Add "description" to frontmatter for Article schema');
  }
  if (!articleSchema.hasDate) {
    issues.push(
      'Add "publishedDate" to frontmatter for Article schema datePublished',
    );
  }
  if (!articleSchema.hasAuthor) {
    issues.push('Add "author" to frontmatter for Article schema author field');
  }

  // 3. Breadcrumb signals (1 pt) — /blog/ path is always true for our articles
  const hasBreadcrumb =
    article.slug?.includes('blog') ||
    article.filePath?.includes('blog') ||
    article.filePath?.includes('drafts');
  if (hasBreadcrumb) {
    score += 1;
  } else {
    issues.push('Article should be nested under /blog/ path for breadcrumb schema');
  }

  // 4. Meta description quality (1.5 pts)
  const metaDesc = scoreMetaDescription(article.meta);
  const metaDescLength = metaDesc.length;
  score += metaDesc.score;

  if (metaDesc.length === 0) {
    issues.push('Add a meta description (120-160 characters) to frontmatter');
  } else if (metaDesc.length < META_DESC_MIN) {
    issues.push(
      `Meta description is ${metaDesc.length} chars — expand to ${META_DESC_MIN}-${META_DESC_MAX} for optimal SERP display`,
    );
  } else if (metaDesc.length > META_DESC_MAX) {
    issues.push(
      `Meta description is ${metaDesc.length} chars — shorten to ${META_DESC_MIN}-${META_DESC_MAX} to avoid SERP truncation`,
    );
  }

  // 5. Open Graph / social tags (1 pt)
  const heroImage = hasHeroImage(article.meta);
  if (heroImage) {
    score += 1;
  } else {
    issues.push(
      'Add "heroImage" to frontmatter for og:image social sharing previews',
    );
  }

  // 6. Table of contents signal (1 pt)
  const tocSignal = hasTocSignal(article.headings);
  if (tocSignal) {
    score += 1;
  } else {
    const h2Count = article.headings.filter((h) => h.level === 2).length;
    if (h2Count < TOC_MIN_H2_COUNT) {
      issues.push(
        `Only ${h2Count} H2 headings — add at least ${TOC_MIN_H2_COUNT} descriptive H2s for table-of-contents / jump-link rich results`,
      );
    } else {
      issues.push(
        'H2 headings are too short — use descriptive text (3+ words) for better TOC rich results',
      );
    }
  }

  // 7. HowTo schema signal (0.5 pt)
  const hasHowToSignal = detectHowToSignal(article.body);
  if (hasHowToSignal) {
    score += 0.5;
  }

  // 8. List schema signal (1 pt)
  const hasListSignal = detectListSignal(article.body);
  if (hasListSignal) {
    score += 1;
  } else {
    issues.push(
      `Add a structured list with ${LIST_MIN_ITEMS}+ items to enable list-style rich results`,
    );
  }

  // Clamp to 0-10
  score = Math.max(0, Math.min(10, score));

  return {
    dimension: DIMENSION,
    score: Math.round(score * 100) / 100,
    weight: WEIGHT,
    details: {
      hasFaqSchema,
      hasArticleSchema,
      hasBreadcrumb: Boolean(hasBreadcrumb),
      metaDescLength,
      hasHeroImage: heroImage,
      hasTocSignal: tocSignal,
      hasHowToSignal,
      hasListSignal,
    },
    issues,
  };
}
