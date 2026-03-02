#!/usr/bin/env node
// generate-hero-image.mjs
// Generates 1200x630 blog hero images using Google Imagen 3.
//
// Usage:
//   node scripts/generate-hero-image.mjs <slug>          # single article
//   node scripts/generate-hero-image.mjs --missing       # all published articles missing images
//   node scripts/generate-hero-image.mjs --help

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import matter from 'gray-matter';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D2C_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(D2C_ROOT, '.env') });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOG_DIR = path.join(D2C_ROOT, 'src/content/blog');
const OUTPUT_DIR = path.join(D2C_ROOT, 'public/blog');
const QUEUE_PATH = path.join(D2C_ROOT, 'src/content/content-queue.json');
const MODEL = 'imagen-4.0-generate-001';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

// ---------------------------------------------------------------------------
// Topic-to-imagery mapping
// ---------------------------------------------------------------------------

/** Maps keywords found in article titles/descriptions to relevant visual concepts. */
const IMAGERY_MAP = [
  { pattern: /penalt|fine|violation|enforce/i, imagery: 'warning signs, legal consequences, caution symbols, scales of justice' },
  { pattern: /cryptocurren|crypto|bitcoin|digital asset/i, imagery: 'cryptocurrency coins, digital assets, blockchain networks, global digital exchanges' },
  { pattern: /green card|immigrant|permanent residen/i, imagery: 'immigration documents, permanent residency, international banking, passports' },
  { pattern: /deadline|extension|due date|april|october/i, imagery: 'calendar, clock, timeline, important dates, countdown' },
  { pattern: /first.time|beginner|guide|how to file/i, imagery: 'step-by-step pathway, onboarding, checklist, getting started' },
  { pattern: /joint account|spouse|married/i, imagery: 'two people, shared documents, partnership, joint ownership' },
  { pattern: /uk|united kingdom|british|london/i, imagery: 'British landmarks, Union Jack motifs, London skyline, UK banking' },
  { pattern: /fatca|form 8938|comparison|vs\b/i, imagery: 'side-by-side documents, comparison charts, dual filing, contrasting forms' },
  { pattern: /maximum.value|calculat|valuation|exchange rate/i, imagery: 'calculator, currency symbols, financial charts, valuation graphs' },
  { pattern: /canada|rrsp|tfsa|canadian/i, imagery: 'Canadian maple leaf motifs, northern banking, cross-border finance' },
  { pattern: /australia|superannuation/i, imagery: 'Australian motifs, retirement funds, Southern Hemisphere banking' },
  { pattern: /india|nre|nro/i, imagery: 'Indian motifs, cross-border banking, emerging market finance' },
  { pattern: /israel/i, imagery: 'Israeli motifs, Mediterranean banking, Middle Eastern finance' },
  { pattern: /japan|nenkin/i, imagery: 'Japanese motifs, Asian banking, yen currency' },
  { pattern: /germany|bausp/i, imagery: 'German motifs, European banking, euro currency' },
  { pattern: /france|livret/i, imagery: 'French motifs, European banking, Parisian architecture' },
  { pattern: /china|rmb/i, imagery: 'Chinese motifs, Asian finance, renminbi currency' },
  { pattern: /streamlin|voluntary disclos|delinquent/i, imagery: 'fresh start, compliance pathway, resolution, olive branch' },
  { pattern: /trust|estate|beneficiar/i, imagery: 'legal documents, trust structures, estate planning, family wealth' },
  { pattern: /business|corporate|signatory/i, imagery: 'corporate buildings, business finance, executive offices' },
  { pattern: /life insurance|policy/i, imagery: 'insurance documents, protection umbrella, financial security' },
  { pattern: /mutual fund|pfic|investment/i, imagery: 'investment portfolios, fund charts, financial markets' },
  { pattern: /audit|irs|exam/i, imagery: 'audit documents, magnifying glass, examination, compliance review' },
  { pattern: /threshold|\$10.000|aggregate/i, imagery: 'threshold bar, financial limit, accumulation, balance scales' },
  { pattern: /expat|living abroad|overseas/i, imagery: 'globe, airplane, international living, world map' },
  { pattern: /child|minor/i, imagery: 'family finance, guardianship, youth savings, parental responsibility' },
  { pattern: /amend|correct|fix/i, imagery: 'correction marks, editing, revision, improvement arrows' },
  { pattern: /statute of limitation/i, imagery: 'hourglass, ticking clock, legal timeline, expiring deadline' },
];

/**
 * Derives relevant visual imagery from the article title and description.
 * Falls back to generic financial compliance imagery.
 */
function deriveImagery(title, description) {
  const text = `${title} ${description}`;
  const matches = IMAGERY_MAP
    .filter(({ pattern }) => pattern.test(text))
    .map(({ imagery }) => imagery);

  if (matches.length > 0) {
    return matches.slice(0, 3).join(', ');
  }
  return 'financial documents, compliance forms, international banking, secure filing';
}

/**
 * Derives a short topic phrase from the article title.
 */
function deriveTopic(title) {
  // Strip common prefixes/suffixes like "FBAR", year references, "Complete Guide", etc.
  return title
    .replace(/^FBAR\s*/i, '')
    .replace(/:\s*Complete.*$/i, '')
    .replace(/:\s*What.*$/i, '')
    .replace(/:\s*How.*$/i, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || title;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(title, description) {
  const topic = deriveTopic(title);
  const imagery = deriveImagery(title, description);

  return [
    `Professional financial compliance illustration for a blog article about ${topic}.`,
    `Clean, minimalist design with navy blue (#1a4480), white, and gold accents.`,
    `Abstract geometric shapes or icons suggesting ${imagery}.`,
    `No text, no words, no letters, no numbers, no watermarks.`,
    `Corporate, trustworthy aesthetic. Soft gradients and clean lines.`,
    `High resolution, suitable for web banner at 1200x630 pixels.`,
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

async function generateImage(slug, apiKey) {
  const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(mdxPath)) {
    console.error(`  ERROR: Article not found: src/content/blog/${slug}.mdx`);
    return false;
  }

  const raw = fs.readFileSync(mdxPath, 'utf-8');
  const { data: frontmatter } = matter(raw);
  const title = frontmatter.title || slug;
  const description = frontmatter.description || '';

  const prompt = buildPrompt(title, description);
  console.log(`  Prompt: ${prompt.slice(0, 120)}...`);

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateImages({
      model: MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',        // closest standard ratio to 1200x630 (1.9:1)
      },
    });
  } catch (err) {
    console.error(`  ERROR generating image: ${err.message}`);
    if (err.message?.includes('SAFETY')) {
      console.error('  The prompt was blocked by safety filters. Try a different article.');
    }
    return false;
  }

  const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    const reason = response?.generatedImages?.[0]?.raiFilteredReason;
    console.error(`  ERROR: No image data returned.${reason ? ` Reason: ${reason}` : ''}`);
    return false;
  }

  // Decode base64 PNG, resize to exact 1200x630, convert to webp
  const pngBuffer = Buffer.from(imageBytes, 'base64');
  const webpBuffer = await sharp(pngBuffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toBuffer();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `${slug}.webp`);
  fs.writeFileSync(outputPath, webpBuffer);
  const sizeKb = (webpBuffer.length / 1024).toFixed(1);
  console.log(`  Saved: public/blog/${slug}.webp (${sizeKb} KB)`);

  // Update frontmatter heroImage field
  updateFrontmatter(mdxPath, slug);

  return true;
}

// ---------------------------------------------------------------------------
// Frontmatter update
// ---------------------------------------------------------------------------

function updateFrontmatter(mdxPath, slug) {
  const raw = fs.readFileSync(mdxPath, 'utf-8');
  const expectedHeroImage = `/blog/${slug}.webp`;

  // Check if heroImage is already correct
  if (raw.includes(`heroImage: "${expectedHeroImage}"`)) {
    console.log(`  Frontmatter: heroImage already set to ${expectedHeroImage}`);
    return;
  }

  let updated;
  if (/^heroImage:/m.test(raw)) {
    // Replace existing heroImage line
    updated = raw.replace(
      /^heroImage:.*$/m,
      `heroImage: "${expectedHeroImage}"`
    );
  } else {
    // Insert heroImage before the closing ---
    // Find the second --- (end of frontmatter)
    const secondDash = raw.indexOf('---', raw.indexOf('---') + 3);
    if (secondDash === -1) {
      console.error('  WARNING: Could not find frontmatter delimiters. heroImage not updated.');
      return;
    }
    updated = raw.slice(0, secondDash) + `heroImage: "${expectedHeroImage}"\n` + raw.slice(secondDash);
  }

  fs.writeFileSync(mdxPath, updated, 'utf-8');
  console.log(`  Frontmatter: heroImage updated to ${expectedHeroImage}`);
}

// ---------------------------------------------------------------------------
// --missing mode
// ---------------------------------------------------------------------------

async function generateMissing(apiKey) {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error('ERROR: content-queue.json not found.');
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  const published = queue.topics.filter(t => t.status === 'published');

  if (published.length === 0) {
    console.log('No published articles found in content-queue.json.');
    return;
  }

  const missing = published.filter(t => {
    const imgPath = path.join(OUTPUT_DIR, `${t.slug}.webp`);
    return !fs.existsSync(imgPath);
  });

  if (missing.length === 0) {
    console.log(`All ${published.length} published articles already have hero images.`);
    return;
  }

  console.log(`Found ${missing.length} published article(s) missing hero images:\n`);
  for (const t of missing) {
    console.log(`  - ${t.slug}`);
  }
  console.log('');

  let success = 0;
  let failed = 0;

  for (const t of missing) {
    console.log(`Generating: ${t.slug}`);
    const ok = await generateImage(t.slug, apiKey);
    if (ok) {
      success++;
    } else {
      failed++;
    }
    console.log('');

    // Small delay between requests to avoid rate limiting
    if (missing.indexOf(t) < missing.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`Done: ${success} generated, ${failed} failed.`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
generate-hero-image.mjs — Generate blog hero images using Google Imagen 3

Usage:
  node scripts/generate-hero-image.mjs <slug>       Generate for one article
  node scripts/generate-hero-image.mjs --missing     Generate for all published articles missing images
  node scripts/generate-hero-image.mjs --help        Show this help

Environment:
  GEMINI_API_KEY   Required. Google AI Studio API key.

Output:
  Images are saved as public/blog/<slug>.webp (1200x630, webp format).
  Article frontmatter heroImage field is updated to /blog/<slug>.webp.
`);
  process.exit(0);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY is not set. Add it to your .env file.');
  console.error('Get a key at: https://aistudio.google.com/apikey');
  process.exit(1);
}

if (args.includes('--missing')) {
  await generateMissing(apiKey);
} else {
  const slug = args.find(a => !a.startsWith('--'));
  if (!slug) {
    console.error('ERROR: No slug provided. Run with --help for usage.');
    process.exit(1);
  }
  console.log(`Generating hero image for: ${slug}\n`);
  const ok = await generateImage(slug, apiKey);
  if (!ok) {
    process.exit(1);
  }
}
