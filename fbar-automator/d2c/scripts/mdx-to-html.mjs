#!/usr/bin/env node
// mdx-to-html.mjs
// Converts .mdx body (minus frontmatter) to HTML for SurferSEO editor injection.
// Usage:
//   node scripts/mdx-to-html.mjs <slug>        # single article
//   node scripts/mdx-to-html.mjs --all          # all articles in drafts/
// Output: /tmp/<slug>.html (or C:\tmp on Windows)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D2C_ROOT = path.resolve(__dirname, '..');
const DRAFTS_DIR = path.join(D2C_ROOT, 'src', 'content', 'drafts');
const BLOG_DIR = path.join(D2C_ROOT, 'src', 'content', 'blog');

// Use /tmp on Unix, os.tmpdir() on Windows
const TMP_DIR = process.platform === 'win32' ? os.tmpdir() : '/tmp';

async function convertToHtml(slug) {
  // Try drafts first, then blog
  let mdxPath = path.join(DRAFTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(mdxPath)) {
    mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
  }
  if (!fs.existsSync(mdxPath)) {
    console.error(`ERROR: ${slug}.mdx not found in drafts/ or blog/`);
    return null;
  }

  const raw = fs.readFileSync(mdxPath, 'utf-8');
  const { content } = matter(raw);

  // Strip any remaining MDX/JSX components (e.g. <Component />) — pure markdown only
  const cleaned = content.replace(/<[A-Z][A-Za-z]*\s*[^>]*\/?\s*>/g, '');

  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(cleaned);

  const html = String(result);
  const outPath = path.join(TMP_DIR, `${slug}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  console.log(`OK: ${slug} → ${outPath} (${html.length} bytes, ~${wordCount} words)`);
  return outPath;
}

// --- CLI ---
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/mdx-to-html.mjs <slug>');
  console.error('       node scripts/mdx-to-html.mjs --all');
  process.exit(1);
}

if (arg === '--all') {
  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.mdx'));
  console.log(`Converting ${files.length} articles...`);
  for (const f of files) {
    const slug = f.replace('.mdx', '');
    await convertToHtml(slug);
  }
} else {
  const result = await convertToHtml(arg);
  if (!result) process.exit(1);
}
