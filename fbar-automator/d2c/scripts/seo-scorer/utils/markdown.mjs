/**
 * markdown.mjs — Markdown processing utilities.
 *
 * Pure functions for stripping, parsing, and extracting structured data
 * from MDX / Markdown content.  No external dependencies — all parsing
 * is regex-based so the module stays lightweight and fast.
 */

import { AUTHORITY_DOMAINS } from './config.mjs';

// ---------------------------------------------------------------------------
// stripMarkdown — convert Markdown to readable plain text
// ---------------------------------------------------------------------------

/**
 * Remove Markdown/MDX syntax and return plain text suitable for
 * readability scoring, word counting, and NLP analysis.
 *
 * Removal order matters — fenced code blocks are stripped first so
 * their contents don't get partially mangled by later passes.
 *
 * @param {string} md  Raw Markdown/MDX content.
 * @returns {string}   Plain text with Markdown syntax removed.
 */
export function stripMarkdown(md) {
  // Normalize CRLF to LF for consistent regex matching
  let text = md.replace(/\r\n/g, '\n');

  // 1. Fenced code blocks (```...```)
  text = text.replace(/```[\s\S]*?```/g, '');

  // 2. Inline code (`...`)
  text = text.replace(/`[^`]+`/g, '');

  // 3. Images ![alt](url) — drop entirely
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 4. Links [text](url) — keep link text only
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 5. Heading markers (# ... ######)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 6. Bold (**text** or __text__)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');

  // 7. Italic (*text* or _text_) — use word-boundary aware pattern
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // 8. Strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 9. Unordered list markers (-, *, +)
  text = text.replace(/^\s*[-*+]\s+/gm, '');

  // 10. Ordered list markers (1. 2. etc.)
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // 11. Table rows — keep cell text, drop pipes and alignment dashes
  // First strip separator rows (|---|---|)
  text = text.replace(/^\|[\s:|-]+\|$/gm, '');
  // Then strip leading/trailing pipes on content rows
  text = text.replace(/^\|(.+)\|$/gm, (_, row) =>
    row
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(' '),
  );

  // 12. Blockquotes (> ...)
  text = text.replace(/^\s*>\s?/gm, '');

  // 13. HTML tags (including self-closing and MDX components)
  text = text.replace(/<\/?[^>]+>/g, '');

  // 14. Horizontal rules (---, ***, ___)
  text = text.replace(/^[\s]*([-*_]){3,}\s*$/gm, '');

  // 15. MDX import / export statements
  text = text.replace(/^(import|export)\s+.*$/gm, '');

  // 16. Collapse multiple blank lines to one
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ---------------------------------------------------------------------------
// extractHeadings — pull heading hierarchy from Markdown
// ---------------------------------------------------------------------------

/**
 * Extract all ATX-style headings from Markdown source.
 *
 * @param {string} md  Raw Markdown content.
 * @returns {Array<{ level: number, text: string, line: number }>}
 */
export function extractHeadings(md) {
  const headings = [];
  // Normalize CRLF to LF before splitting
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1, // 1-based line number
      });
    }
  }

  return headings;
}

// ---------------------------------------------------------------------------
// extractLinks — collect all links with classification
// ---------------------------------------------------------------------------

/**
 * Extract Markdown links with internal / authority classification.
 *
 * Internal links start with `/blog/`.
 * Authority links point to domains in the AUTHORITY_DOMAINS list.
 *
 * @param {string} md  Raw Markdown content.
 * @returns {Array<{ text: string, url: string, isInternal: boolean, isAuthority: boolean }>}
 */
export function extractLinks(md) {
  const links = [];
  // Normalize CRLF to LF
  const normalized = md.replace(/\r\n/g, '\n');
  // Match [text](url) but NOT ![alt](url)
  const linkRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRe.exec(normalized)) !== null) {
    const text = match[1];
    const url = match[2];
    const isInternal = url.startsWith('/blog/');

    let isAuthority = false;
    try {
      // Absolute URLs — check domain
      const hostname = new URL(url).hostname.toLowerCase();
      isAuthority = AUTHORITY_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      // Relative URL or malformed — not authority
    }

    links.push({ text, url, isInternal, isAuthority });
  }

  return links;
}

// ---------------------------------------------------------------------------
// parseFrontmatter — lightweight YAML-like frontmatter parser
// ---------------------------------------------------------------------------

/**
 * Split content into frontmatter metadata and Markdown body.
 *
 * Handles quoted values, bare values, and multi-line YAML strings.
 * This is intentionally minimal — it covers the subset of YAML used
 * in the blog MDX files without pulling in a full YAML parser.
 *
 * @param {string} content  Full file content including `---` delimiters.
 * @returns {{ meta: Record<string, string>, body: string }}
 */
export function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { meta: {}, body: content };
  }

  const yamlBlock = fmMatch[1];
  const body = content.slice(fmMatch[0].length).trim();
  const meta = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  return { meta, body };
}

// ---------------------------------------------------------------------------
// extractParagraphs — split body into paragraph blocks
// ---------------------------------------------------------------------------

/**
 * Split Markdown body into individual paragraphs.
 *
 * Paragraphs are separated by one or more blank lines. Headings and
 * blank-only blocks are excluded from the result.
 *
 * @param {string} md  Markdown body (after frontmatter removal).
 * @returns {string[]}
 */
export function extractParagraphs(md) {
  // Normalize CRLF to LF
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => {
      if (!block) return false;
      // Skip heading-only blocks
      if (/^#{1,6}\s+/.test(block) && !block.includes('\n')) return false;
      return true;
    });
}

// ---------------------------------------------------------------------------
// extractSentences — split plain text into sentences
// ---------------------------------------------------------------------------

/**
 * Split plain text into sentences.
 *
 * Uses a simple heuristic: split on sentence-ending punctuation (.!?)
 * followed by a space, newline, or end of string. Handles common
 * abbreviations (e.g., "U.S.", "Dr.") by not splitting on single-letter
 * followed by a period.
 *
 * @param {string} plainText  Text with Markdown already stripped.
 * @returns {string[]}
 */
export function extractSentences(plainText) {
  // Normalize CRLF to LF and replace common abbreviations with placeholders
  let text = plainText.replace(/\r\n/g, '\n');
  text = text.replace(/\bU\.S\./g, 'U\u200BS\u200B');
  text = text.replace(/\be\.g\./g, 'e\u200Bg\u200B');
  text = text.replace(/\bi\.e\./g, 'i\u200Be\u200B');
  text = text.replace(/\bvs\./g, 'vs\u200B');
  text = text.replace(/\betc\./g, 'etc\u200B');
  text = text.replace(/\bDr\./g, 'Dr\u200B');
  text = text.replace(/\bMr\./g, 'Mr\u200B');
  text = text.replace(/\bMrs\./g, 'Mrs\u200B');
  text = text.replace(/\bMs\./g, 'Ms\u200B');
  text = text.replace(/\bSt\./g, 'St\u200B');
  text = text.replace(/\bCFR\s/g, 'CFR ');
  text = text.replace(/\bUSC\s/g, 'USC ');

  // Split on sentence-ending punctuation
  const raw = text.split(/(?<=[.!?])\s+/);

  return raw
    .map((s) => s.replace(/\u200B/g, '.').trim())
    .filter((s) => s.length > 0);
}
