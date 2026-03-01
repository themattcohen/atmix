#!/usr/bin/env node
// promote-article.mjs
// Promotes a validated article from drafts/ to content/blog/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D2C_ROOT = path.resolve(__dirname, '..');

// --- CLI ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const slug = args.find(a => !a.startsWith('--'));

if (!slug) {
  console.error('Usage: node scripts/promote-article.mjs <slug> [--force]');
  console.error('  Promotes src/content/drafts/<slug>.mdx to src/content/blog/<slug>.mdx');
  console.error('  --force  Overwrite if article already exists in content/blog/');
  process.exit(1);
}

const draftsDir = path.join(D2C_ROOT, 'src/content/drafts');
const blogDir = path.join(D2C_ROOT, 'src/content/blog');
const validationPath = path.join(draftsDir, `${slug}.validation.json`);
const draftPath = path.join(draftsDir, `${slug}.mdx`);
const blogPath = path.join(blogDir, `${slug}.mdx`);
const queuePath = path.join(D2C_ROOT, 'src/content/content-queue.json');

// 1. Check validation report exists
if (!fs.existsSync(validationPath)) {
  console.error(`ERROR: No validation report found at src/content/drafts/${slug}.validation.json`);
  console.error('Run validate-article.mjs first.');
  process.exit(1);
}

// 2. Check validation passed
const report = JSON.parse(fs.readFileSync(validationPath, 'utf-8'));
if (!report.passed) {
  console.error('ERROR: Article failed validation. Fix issues and re-validate.');
  if (report.failedChecks && report.failedChecks.length > 0) {
    console.error('Failed checks:');
    for (const check of report.failedChecks) {
      console.error(`  - ${check}`);
    }
  }
  process.exit(1);
}

// 3. Check draft MDX exists
if (!fs.existsSync(draftPath)) {
  console.error(`ERROR: Draft file not found at src/content/drafts/${slug}.mdx`);
  process.exit(1);
}

// 4. Check blog destination
if (fs.existsSync(blogPath) && !force) {
  console.error(`ERROR: Article already exists in content/blog/${slug}.mdx`);
  console.error('Use --force to overwrite.');
  process.exit(1);
}

// 5. Ensure blog directory exists
if (!fs.existsSync(blogDir)) {
  fs.mkdirSync(blogDir, { recursive: true });
}

// 6. Copy draft to blog (keep draft as archive)
fs.copyFileSync(draftPath, blogPath);

// 7. Update content-queue.json
if (fs.existsSync(queuePath)) {
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
  const topic = queue.topics.find(t => t.slug === slug);
  if (topic) {
    topic.status = 'published';
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n');
    console.log(`  Queue: status updated to "published"`);
  } else {
    console.log(`  Queue: slug "${slug}" not found in content-queue.json (skipped)`);
  }
} else {
  console.log(`  Queue: content-queue.json not found (skipped)`);
}

// 8. Summary
console.log(`Promoted: ${slug}`);
console.log(`  From: src/content/drafts/${slug}.mdx`);
console.log(`  To:   src/content/blog/${slug}.mdx`);
