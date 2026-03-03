#!/usr/bin/env node
// generate-hero-image.mjs
// Generates 1200x630 blog hero images using Google Imagen.
// Generalized from D2C — reads imagery config from niche config file.
//
// Usage:
//   node scripts/generate-hero-image.mjs <slug>                         # single article
//   node scripts/generate-hero-image.mjs <slug> --config <config-path>  # with explicit config
//   node scripts/generate-hero-image.mjs --help

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import matter from 'gray-matter';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ENGINE_ROOT, '.env') });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'imagen-4.0-generate-001';
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
generate-hero-image.mjs — Generate blog hero images using Google Imagen

Usage:
  node scripts/generate-hero-image.mjs <slug>                         Generate for one article
  node scripts/generate-hero-image.mjs <slug> --config <config-path>  Use specific config
  node scripts/generate-hero-image.mjs --help                         Show this help

Environment:
  GEMINI_API_KEY   Required. Google AI Studio API key.

Input:
  Article is read from output/<slug>/article.mdx

Output:
  Image is saved as output/<slug>/hero.webp (1200x630, webp format).
`);
  process.exit(0);
}

const slug = args.find(a => !a.startsWith('--'));
if (!slug) {
  console.error('ERROR: No slug provided. Run with --help for usage.');
  process.exit(1);
}

const configFlagIdx = args.indexOf('--config');
const configArg = configFlagIdx !== -1 ? args[configFlagIdx + 1] : null;

// ---------------------------------------------------------------------------
// Load config
// ---------------------------------------------------------------------------

function findConfig() {
  if (configArg) {
    const p = path.isAbsolute(configArg) ? configArg : path.resolve(configArg);
    if (!fs.existsSync(p)) {
      console.error(`ERROR: Config not found at ${p}`);
      process.exit(1);
    }
    return p;
  }
  const configsDir = path.join(ENGINE_ROOT, 'configs');
  const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  if (files.length === 0) {
    console.error('ERROR: No config files found in configs/. Create one or use --config flag.');
    process.exit(1);
  }
  if (files.length > 1) {
    console.error(`WARNING: Multiple configs found: ${files.join(', ')}. Using ${files[0]}. Specify with --config.`);
  }
  return path.join(configsDir, files[0]);
}

const configPath = findConfig();
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(`Config: ${path.relative(ENGINE_ROOT, configPath)}`);

const heroConfig = config.heroImage || {};
const style = heroConfig.style || 'Professional illustration, clean minimalist design';
const colorScheme = heroConfig.colorScheme || 'navy blue, white, gold accents';
const imageryMap = heroConfig.imageryMap || {};

// ---------------------------------------------------------------------------
// Topic-to-imagery mapping (config-driven)
// ---------------------------------------------------------------------------

/**
 * Derives relevant visual imagery from the article title and description
 * using the config's imageryMap. Keys are regex pattern strings.
 */
function deriveImagery(title, description) {
  const text = `${title} ${description}`;
  const matches = [];

  for (const [patternStr, imagery] of Object.entries(imageryMap)) {
    if (patternStr === 'default') continue;
    try {
      const regex = new RegExp(patternStr, 'i');
      if (regex.test(text)) {
        matches.push(imagery);
      }
    } catch {
      // Skip invalid regex patterns
    }
  }

  if (matches.length > 0) {
    return matches.slice(0, 3).join(', ');
  }
  return imageryMap.default || 'professional documents, business planning, clean design';
}

/**
 * Derives a short topic phrase from the article title.
 */
function deriveTopic(title) {
  return title
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
    `${style} for a blog article about ${topic}.`,
    `Color palette: ${colorScheme}.`,
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
  const articleDir = path.join(ENGINE_ROOT, 'output', slug);
  const mdxPath = path.join(articleDir, 'article.mdx');

  if (!fs.existsSync(mdxPath)) {
    console.error(`  ERROR: Article not found: output/${slug}/article.mdx`);
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
        aspectRatio: '16:9',
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
  if (!fs.existsSync(articleDir)) {
    fs.mkdirSync(articleDir, { recursive: true });
  }

  const outputPath = path.join(articleDir, 'hero.webp');
  fs.writeFileSync(outputPath, webpBuffer);
  const sizeKb = (webpBuffer.length / 1024).toFixed(1);
  console.log(`  Saved: output/${slug}/hero.webp (${sizeKb} KB)`);

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY is not set. Add it to your .env file.');
  console.error('Get a key at: https://aistudio.google.com/apikey');
  process.exit(1);
}

console.log(`Generating hero image for: ${slug}\n`);
const ok = await generateImage(slug, apiKey);
if (!ok) {
  process.exit(1);
}
