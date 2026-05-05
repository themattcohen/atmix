/**
 * update-wp-pages.mjs
 *
 * Updates all 27 treatment Learn More pages on usmobileiv.com with the
 * polished page template defined in create-wp-pages.mjs.
 *
 * For each treatment:
 *   1. GETs the existing page by slug under parent=891.
 *   2. Computes a content hash. Skips if already up to date.
 *   3. PUTs the new title (correctly decoded) and new content template.
 *
 * Also fixes the "Myers\\" title encoding bug from the initial create run by
 * sending the correct treatment.name to the WP REST title field.
 *
 * Auth: WP_USER + WP_APP_PASSWORD from Doppler prd_usmiv.
 *
 * Usage: node scripts/update-wp-pages.mjs [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const WP_API    = 'https://usmobileiv.com/wp-json/wp/v2';
const PARENT_ID = 891;

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function getCreds() {
  if (process.env.WP_USER && process.env.WP_APP_PASSWORD) {
    return { user: process.env.WP_USER, pass: process.env.WP_APP_PASSWORD };
  }
  console.log('Fetching WP_USER, WP_APP_PASSWORD from Doppler prd_usmiv...');
  const raw = execSync(
    'doppler secrets get WP_USER WP_APP_PASSWORD --project atmix --config prd_usmiv --plain',
    { encoding: 'utf8' }
  ).trim();
  const [user, pass] = raw.split('\n');
  if (!user || !pass) {
    throw new Error('Could not read WP_USER / WP_APP_PASSWORD from Doppler');
  }
  return { user: user.trim(), pass: pass.trim() };
}

function basicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

// ---------------------------------------------------------------------------
// Catalog parsing (handles escaped single-quotes such as Myers\' Cocktail)
// ---------------------------------------------------------------------------

const CATALOG_FILES = [
  'src/data/catalog/iv.ts',
  'src/data/catalog/injections.ts',
  'src/data/catalog/labs.ts',
  'src/data/catalog/nad.ts',
  'src/data/catalog/weightLoss.ts',
];

// Unescape JS single-quoted string escape sequences.
function unescapeJsStr(raw) {
  return raw
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function parseCatalogFile(filePath) {
  const src = readFileSync(resolve(ROOT, filePath), 'utf8');
  const treatments = [];

  const objectRe = /export\s+const\s+(\w+)\s*=\s*\{([^]*?)\}\s+as\s+const/g;
  let match;
  while ((match = objectRe.exec(src)) !== null) {
    const body = match[2];
    // Pattern handles \' inside JS single-quoted strings.
    const QUOTED = /'((?:[^'\\]|\\.)*)'/.source;
    const idRe    = new RegExp(`\\bid\\s*:\\s*${QUOTED}`);
    const nameRe  = new RegExp(`\\bname\\s*:\\s*${QUOTED}`);
    const descRe  = new RegExp(`\\bshortDesc\\s*:\\s*${QUOTED}`);
    const catRe   = new RegExp(`\\bcategory\\s*:\\s*${QUOTED}`);

    const idMatch   = body.match(idRe);
    const nameMatch = body.match(nameRe);
    const descMatch = body.match(descRe);
    const catMatch  = body.match(catRe);

    if (!idMatch) continue;

    treatments.push({
      id:        unescapeJsStr(idMatch[1]),
      name:      nameMatch ? unescapeJsStr(nameMatch[1])  : unescapeJsStr(idMatch[1]),
      shortDesc: descMatch ? unescapeJsStr(descMatch[1])  : '',
      category:  catMatch  ? unescapeJsStr(catMatch[1])   : 'iv',
    });
  }

  return treatments;
}

function loadAllTreatments() {
  const all = [];
  for (const f of CATALOG_FILES) {
    all.push(...parseCatalogFile(f));
  }
  return all;
}

// ---------------------------------------------------------------------------
// Page content template (self-contained with inline CSS + v1 JS renderer)
// v6: Full v1 design port with accordion dropdowns, Why This Works callout,
//     personas grid, What to Expect, GLP-1 block, related rail, sticky CTA.
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Encode a string safe for use as a WP REST API title field.
 *
 * WP REST applies wp_slash() to incoming data before passing it to
 * wp_insert_post(), which calls wp_unslash() internally. On some installs
 * (and with certain plugin filters) the unslash pass is skipped or runs
 * twice, causing apostrophes to be stored as literal backslashes or stripped
 * entirely. Encoding apostrophes as HTML entities before the POST bypasses
 * the slashing round-trip entirely: WP stores the entity verbatim and
 * wptexturize() renders it as a curly apostrophe in the page title.
 */
function encodeTitleForWp(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#8217;')
    .replace(/"/g, '&#8220;');
}

// INLINE_STYLES: v1 treatment-detail.css ported into scoped, px-based, Bricks-defended CSS.
// All rem values converted to px (N*16). Global selectors scoped to .wiz-treatment-v1.
// Bricks/Automatic.css defenses added with !important.
// Keep byte-identical between update-wp-pages.mjs and create-wp-pages.mjs.
const INLINE_STYLES = `<style>
/* ============================================================
   Wizard of IV -- Treatment Detail -- v6 (v1 port, px-based, scoped)
   Scoped to .wiz-treatment-v1 so nothing leaks into Bricks shell.
   All sizes converted from rem to px (N rem = N*16 px).
   Bricks/Automatic.css defended with !important overrides.
   ============================================================ */

/* --- Hide duplicate Bricks H1 when our content is on the page --- */
body:has(.wiz-treatment-v1) .brxe-heading h1,
body:has(.wiz-treatment-v1) h1.entry-title,
body:has(.wiz-treatment-v1) h1.page-title,
body:has(.wiz-treatment-v1) .page-header h1,
body:has(.wiz-treatment-v1) article.hentry > h1,
body:has(.wiz-treatment-v1) .hentry > h1 {
  display: none;
}

/* --- Escape Bricks post-content column overflow clip --- */
body:has(.wiz-treatment-v1) .brxe-post-content,
body:has(.wiz-treatment-v1) .brxe-section,
body:has(.wiz-treatment-v1) .brxe-container,
body:has(.wiz-treatment-v1) .brxe-block,
body:has(.wiz-treatment-v1) .brxe-div,
body:has(.wiz-treatment-v1) article.hentry {
  overflow: visible !important;
}

/* --- Scope reset: box-sizing only, no global margin/padding wipe --- */
.wiz-treatment-v1 *,
.wiz-treatment-v1 *::before,
.wiz-treatment-v1 *::after {
  box-sizing: border-box !important;
}

/* --- Custom Properties on scope root --- */
.wiz-treatment-v1 {
  --td-color-navy:        #1E4969;
  --td-color-navy-dark:   #163650;
  --td-color-navy-light:  #EAF0F5;
  --td-color-teal-brand:  #44B7BC;
  --td-color-teal-wcag:   #2A8A8F;
  --td-color-teal-light:  #E8F6F7;
  --td-color-dark:        #081E2B;
  --td-color-surface:     #FFFFFF;
  --td-color-bg:          #F7F9FB;
  --td-color-border:      #DDE4EA;
  --td-color-muted:       #5A7384;
  --td-color-muted-light: #8BA3B3;
  --td-font-heading:      'Montserrat', system-ui, sans-serif;
  --td-font-body:         'Open Sans', system-ui, sans-serif;
  --td-radius-sm:         6px;
  --td-radius-md:         10px;
  --td-radius-lg:         16px;
  --td-shadow-card:       0 1px 4px rgba(8, 30, 43, 0.08);
  --td-shadow-hover:      0 4px 16px rgba(8, 30, 43, 0.12);
  --td-transition:        0.18s ease;
  /* font-size on scope root acts as the 16px base (replaces html{font-size:16px}) */
  font-size: 16px;
  font-family: var(--td-font-body);
  color: var(--td-color-dark);
  background: var(--td-color-bg);
  line-height: 1.6;
  /* Full-bleed escape from Bricks post-content column */
  width: 100vw !important;
  position: relative;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0;
  overflow-x: hidden;
  /* Space for sticky CTA on mobile */
  padding-bottom: 80px;
}

@media (min-width: 768px) {
  .wiz-treatment-v1 {
    padding-bottom: 0;
  }
}

.wiz-treatment-v1 a {
  color: var(--td-color-teal-wcag);
  text-decoration: none;
}
.wiz-treatment-v1 a:hover {
  text-decoration: underline;
}
.wiz-treatment-v1 a:focus-visible {
  outline: 2px solid var(--td-color-teal-wcag);
  outline-offset: 3px;
  border-radius: 3px;
}
.wiz-treatment-v1 ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.wiz-treatment-v1 svg {
  display: inline-block !important;
  vertical-align: middle;
  flex-shrink: 0;
}
.wiz-treatment-v1 button {
  font-family: var(--td-font-body);
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
}
.wiz-treatment-v1 button:focus-visible {
  outline: 2px solid var(--td-color-teal-wcag);
  outline-offset: 3px;
}
#td-app {
  min-height: 100vh;
}

/* --- Nav Bar --- */
.wiz-treatment-v1 .td-nav {
  display: block !important;
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--td-color-surface);
  border-bottom: 1px solid var(--td-color-border);
}
.wiz-treatment-v1 .td-nav > * {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 52px;
  width: 100%;
}
.wiz-treatment-v1 .td-nav__back {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-family: var(--td-font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--td-color-navy);
  text-decoration: none;
  padding: 6px 10px 6px 4px;
  border-radius: var(--td-radius-sm);
  transition: color var(--td-transition), background var(--td-transition);
}
.wiz-treatment-v1 .td-nav__back:hover {
  color: var(--td-color-teal-wcag);
  background: var(--td-color-teal-light);
  text-decoration: none;
}
.wiz-treatment-v1 .td-nav__back-arrow {
  display: inline-flex !important;
  align-items: center;
}
.wiz-treatment-v1 .td-nav__back-arrow svg {
  width: 18px;
  height: 18px;
}
.wiz-treatment-v1 .td-nav__wordmark {
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 15px;
  color: var(--td-color-navy);
  letter-spacing: 0.01em;
}

/* --- Hero Header --- */
.wiz-treatment-v1 .td-hero {
  display: block !important;
  background: linear-gradient(135deg, var(--td-color-navy) 0%, #1a5f81 100%);
  color: #fff;
  padding: 32px 16px 40px;
  /* Full-bleed hero */
  width: 100vw !important;
  margin-left: calc(50% - 50vw) !important;
  margin-right: calc(50% - 50vw) !important;
}
.wiz-treatment-v1 .td-hero__inner {
  max-width: 720px;
  margin: 0 auto;
}
.wiz-treatment-v1 .td-hero__name {
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 28px;
  line-height: 1.2;
  color: #fff;
  margin-top: 12px;
  margin-bottom: 10px;
}
.wiz-treatment-v1 .td-hero__meta {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.wiz-treatment-v1 .td-hero__price {
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 22px;
  color: #A8E0E3;
}
.wiz-treatment-v1 .td-hero__sep {
  color: rgba(255, 255, 255, 0.4);
  font-size: 18px;
}
.wiz-treatment-v1 .td-hero__duration {
  display: inline-flex !important;
  align-items: center;
  gap: 5px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.82);
}
.wiz-treatment-v1 .td-hero__duration svg {
  width: 16px;
  height: 16px;
}
.wiz-treatment-v1 .td-hero__desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.6;
  max-width: 540px;
  margin-bottom: 20px;
}
.wiz-treatment-v1 .td-hero__actions {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}
.wiz-treatment-v1 .td-hero__book-btn {
  display: inline-block !important;
  background: #fff;
  color: var(--td-color-navy);
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 15px;
  padding: 12px 24px;
  border-radius: var(--td-radius-md);
  text-decoration: none;
  transition: background var(--td-transition), transform var(--td-transition);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
.wiz-treatment-v1 .td-hero__book-btn:hover {
  background: var(--td-color-teal-light);
  text-decoration: none;
  transform: translateY(-1px);
}
.wiz-treatment-v1 .td-hero__book-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
.wiz-treatment-v1 .td-hero__phone {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  transition: color var(--td-transition);
}
.wiz-treatment-v1 .td-hero__phone svg {
  width: 16px;
  height: 16px;
}
.wiz-treatment-v1 .td-hero__phone:hover {
  color: #fff;
  text-decoration: none;
}

/* --- Category Badge --- */
.wiz-treatment-v1 .td-category-badge {
  display: inline-block !important;
  font-family: var(--td-font-heading);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

/* --- Section Wrapper --- */
.wiz-treatment-v1 .td-section {
  display: block !important;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px;
}
.wiz-treatment-v1 .td-section-title {
  display: block !important;
  font-family: var(--td-font-heading);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--td-color-navy);
  margin-bottom: 16px;
}

/* --- Why This Works --- */
.wiz-treatment-v1 .td-why {
  display: block !important;
  background: var(--td-color-surface);
  border-bottom: 1px solid var(--td-color-border);
}
.wiz-treatment-v1 .td-why__inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 16px;
  border-left: 4px solid var(--td-color-teal-wcag);
  padding-left: 20px;
  background: rgba(42, 138, 143, 0.04);
  border-radius: 0 var(--td-radius-sm) var(--td-radius-sm) 0;
}
.wiz-treatment-v1 .td-section.td-why {
  padding-top: 0;
  padding-bottom: 0;
}
.wiz-treatment-v1 .td-section.td-why .td-why__inner {
  max-width: none;
  margin: 28px 0;
}
.wiz-treatment-v1 .td-why__text {
  font-size: 16px;
  color: var(--td-color-dark);
  line-height: 1.65;
  margin: 0;
}
.wiz-treatment-v1 .td-why__note {
  display: block;
  margin-top: 10px;
  font-size: 14px;
  font-style: italic;
  color: var(--td-color-muted);
  line-height: 1.5;
}

/* --- Ingredients / Lab Cards --- */
.wiz-treatment-v1 .td-ingredients {
  display: block !important;
  background: var(--td-color-bg);
}
.wiz-treatment-v1 .td-ingredient-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px;
}
.wiz-treatment-v1 .td-ingredient-card {
  display: block !important;
  background: var(--td-color-surface);
  border: 1px solid var(--td-color-border);
  border-radius: var(--td-radius-md);
  overflow: hidden;
  box-shadow: var(--td-shadow-card);
  transition: box-shadow var(--td-transition);
}
.wiz-treatment-v1 .td-ingredient-card--open {
  border-color: var(--td-color-teal-wcag);
  box-shadow: 0 2px 10px rgba(42, 138, 143, 0.12);
}
.wiz-treatment-v1 .td-ingredient-card__trigger {
  width: 100%;
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  transition: background var(--td-transition);
}
.wiz-treatment-v1 .td-ingredient-card__trigger:hover {
  background: var(--td-color-bg);
}
.wiz-treatment-v1 .td-ingredient-card__name {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
  color: var(--td-color-navy);
  line-height: 1.4;
}
.wiz-treatment-v1 .td-ingredient-card__short {
  display: inline-block !important;
  flex: 2;
  font-size: 14px;
  color: var(--td-color-muted);
  line-height: 1.4;
  padding-top: 1px;
}
.wiz-treatment-v1 .td-ingredient-card__chevron {
  display: flex !important;
  align-items: center;
  color: var(--td-color-muted-light);
  transition: transform var(--td-transition);
  margin-top: 2px;
}
.wiz-treatment-v1 .td-ingredient-card__chevron svg {
  width: 18px;
  height: 18px;
}
.wiz-treatment-v1 .td-ingredient-card--open .td-ingredient-card__chevron {
  transform: rotate(180deg);
}
.wiz-treatment-v1 .td-ingredient-card__body {
  padding: 0 16px 16px 16px;
  border-top: 1px solid var(--td-color-border);
  animation: td-expand 0.16s ease;
}
.wiz-treatment-v1 .td-ingredient-card__detail {
  font-size: 15px;
  color: var(--td-color-dark);
  line-height: 1.6;
  margin-bottom: 10px;
  padding-top: 12px;
}

/* --- Evidence Badges --- */
.wiz-treatment-v1 .td-evidence-badge {
  display: inline-block !important;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 12px;
  text-transform: uppercase;
}
.wiz-treatment-v1 .td-evidence-badge--strong {
  background: #E6F5EE;
  color: #1A6B3C;
  border: 1px solid #A8D8C0;
}
.wiz-treatment-v1 .td-evidence-badge--moderate {
  background: #E8F2FB;
  color: #1A4A7A;
  border: 1px solid #A8C8E8;
}
.wiz-treatment-v1 .td-evidence-badge--emerging {
  background: #FDF4E7;
  color: #7A4E00;
  border: 1px solid #E8C87A;
}

/* --- Persona Cards --- */
.wiz-treatment-v1 .td-personas {
  display: block !important;
  background: var(--td-color-surface);
  border-top: 1px solid var(--td-color-border);
  border-bottom: 1px solid var(--td-color-border);
}
.wiz-treatment-v1 .td-persona-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.wiz-treatment-v1 .td-persona-card {
  display: block !important;
  background: var(--td-color-bg);
  border: 1px solid var(--td-color-border);
  border-radius: var(--td-radius-md);
  padding: 14px 16px;
}
.wiz-treatment-v1 .td-persona-card__headline {
  font-weight: 600;
  font-size: 15px;
  color: var(--td-color-navy);
  margin-bottom: 4px;
  line-height: 1.35;
}
.wiz-treatment-v1 .td-persona-card__detail {
  font-size: 14px;
  color: var(--td-color-muted);
  line-height: 1.5;
}

/* --- What to Expect Grid --- */
.wiz-treatment-v1 .td-expect {
  display: block !important;
  background: var(--td-color-bg);
}
.wiz-treatment-v1 .td-expect-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.wiz-treatment-v1 .td-expect-cell {
  display: flex !important;
  flex-direction: column !important;
  background: var(--td-color-surface);
  border: 1px solid var(--td-color-border);
  border-radius: var(--td-radius-md);
  padding: 16px;
  gap: 4px;
}
.wiz-treatment-v1 .td-expect-cell__icon {
  display: flex !important;
  color: var(--td-color-teal-wcag);
}
.wiz-treatment-v1 .td-expect-cell__icon svg {
  width: 20px;
  height: 20px;
}
.wiz-treatment-v1 .td-expect-cell__label {
  display: block !important;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--td-color-muted);
}
.wiz-treatment-v1 .td-expect-cell__value {
  display: block !important;
  font-size: 15px;
  font-weight: 500;
  color: var(--td-color-dark);
  line-height: 1.4;
}

/* --- GLP-1 Section --- */
.wiz-treatment-v1 .td-glp1 {
  display: block !important;
  background: var(--td-color-surface);
  border-top: 1px solid var(--td-color-border);
  border-bottom: 1px solid var(--td-color-border);
}
.wiz-treatment-v1 .td-glp1__block {
  display: block !important;
  margin-bottom: 24px;
}
.wiz-treatment-v1 .td-glp1__block:last-child {
  margin-bottom: 0;
}
.wiz-treatment-v1 .td-glp1__subheading {
  font-family: var(--td-font-heading);
  font-weight: 600;
  font-size: 15px;
  color: var(--td-color-navy);
  margin-bottom: 12px;
}
.wiz-treatment-v1 .td-glp1__eligibility-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px;
}
.wiz-treatment-v1 .td-glp1__eligibility-item {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start;
  gap: 10px;
  font-size: 15px;
  color: var(--td-color-dark);
  line-height: 1.5;
}
.wiz-treatment-v1 .td-glp1__eligibility-item svg {
  width: 16px;
  height: 16px;
  color: var(--td-color-teal-wcag);
  flex-shrink: 0;
  margin-top: 3px;
}
.wiz-treatment-v1 .td-glp1__table-wrap {
  overflow-x: auto;
  border-radius: var(--td-radius-md);
  border: 1px solid var(--td-color-border);
}
.wiz-treatment-v1 .td-glp1-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.wiz-treatment-v1 .td-glp1-table th {
  background: var(--td-color-navy-light);
  font-family: var(--td-font-heading);
  font-weight: 600;
  font-size: 13px;
  color: var(--td-color-navy);
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid var(--td-color-border);
  white-space: nowrap;
}
.wiz-treatment-v1 .td-glp1-table td {
  padding: 10px 14px;
  color: var(--td-color-dark);
  border-bottom: 1px solid var(--td-color-border);
  vertical-align: top;
  line-height: 1.45;
}
.wiz-treatment-v1 .td-glp1-table tr:last-child td {
  border-bottom: none;
}
.wiz-treatment-v1 .td-glp1-table tbody tr:nth-child(even) td {
  background: var(--td-color-bg);
}
.wiz-treatment-v1 .td-glp1__se-group {
  display: block !important;
  margin-bottom: 14px;
}
.wiz-treatment-v1 .td-glp1__se-group:last-child {
  margin-bottom: 0;
}
.wiz-treatment-v1 .td-glp1__se-serious-header {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
}
.wiz-treatment-v1 .td-glp1__se-serious-header svg {
  width: 18px;
  height: 18px;
  color: #B53D00;
  flex-shrink: 0;
}
.wiz-treatment-v1 .td-glp1__se-label {
  display: block !important;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.wiz-treatment-v1 .td-glp1__se-label--common { color: var(--td-color-muted); }
.wiz-treatment-v1 .td-glp1__se-label--less-common { color: #5A5A00; }
.wiz-treatment-v1 .td-glp1__se-label--serious { color: #B53D00; margin-bottom: 0; }
.wiz-treatment-v1 .td-glp1__se-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 5px;
  margin-top: 8px;
}
.wiz-treatment-v1 .td-glp1__se-list li {
  font-size: 15px;
  color: var(--td-color-dark);
  padding-left: 16px;
  position: relative;
  line-height: 1.5;
}
.wiz-treatment-v1 .td-glp1__se-list li::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  top: 10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--td-color-muted-light);
}
.wiz-treatment-v1 .td-glp1__se-label--serious + .td-glp1__se-list li::before {
  background: #B53D00;
}
.wiz-treatment-v1 .td-glp1__bloodwork {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start;
  gap: 14px;
  background: var(--td-color-navy-light);
  border-radius: var(--td-radius-md);
  padding: 16px;
  border: 1px solid #C8D8E8;
}
.wiz-treatment-v1 .td-glp1__bloodwork-icon {
  display: flex !important;
  color: var(--td-color-navy);
  flex-shrink: 0;
  margin-top: 2px;
}
.wiz-treatment-v1 .td-glp1__bloodwork-icon svg {
  width: 22px;
  height: 22px;
}
.wiz-treatment-v1 .td-glp1__bloodwork-label {
  display: block !important;
  font-weight: 600;
  font-size: 14px;
  color: var(--td-color-navy);
  margin-bottom: 4px;
}
.wiz-treatment-v1 .td-glp1__bloodwork-text {
  font-size: 14px;
  color: var(--td-color-dark);
  line-height: 1.55;
}

/* --- Trust Bar --- */
.wiz-treatment-v1 .td-trust {
  display: block !important;
  background: var(--td-color-surface);
  border-top: 1px solid var(--td-color-border);
  border-bottom: 1px solid var(--td-color-border);
  padding: 24px 16px;
  text-align: center;
}
.wiz-treatment-v1 .td-trust__inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex !important;
  flex-direction: column !important;
  align-items: center;
  gap: 12px;
}
.wiz-treatment-v1 .td-trust__reviews {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
}
.wiz-treatment-v1 .td-trust__stars {
  display: flex !important;
  flex-direction: row !important;
  gap: 2px;
}
.wiz-treatment-v1 .td-trust__star {
  display: inline-flex !important;
  color: #F5A623;
}
.wiz-treatment-v1 .td-trust__star svg {
  width: 16px;
  height: 16px;
}
.wiz-treatment-v1 .td-trust__rating {
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 16px;
  color: var(--td-color-dark);
}
.wiz-treatment-v1 .td-trust__count {
  font-size: 14px;
  color: var(--td-color-muted);
}
.wiz-treatment-v1 .td-trust__items {
  display: flex !important;
  flex-direction: column !important;
  align-items: center;
  gap: 6px;
}
.wiz-treatment-v1 .td-trust__item {
  display: inline-flex !important;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  color: var(--td-color-muted);
}
.wiz-treatment-v1 .td-trust__item svg {
  width: 15px;
  height: 15px;
  color: var(--td-color-teal-wcag);
  flex-shrink: 0;
}

/* --- Related Treatments --- */
.wiz-treatment-v1 .td-related {
  display: block !important;
  background: var(--td-color-bg);
}
.wiz-treatment-v1 .td-related-grid {
  display: flex !important;
  flex-direction: row !important;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.wiz-treatment-v1 .td-related-grid::-webkit-scrollbar {
  display: none;
}
.wiz-treatment-v1 .td-related-card {
  flex: 0 0 260px;
  display: flex !important;
  flex-direction: row !important;
  background: var(--td-color-surface);
  border: 1px solid var(--td-color-border);
  border-radius: var(--td-radius-md);
  padding: 16px;
  text-decoration: none;
  align-items: flex-start;
  gap: 12px;
  box-shadow: var(--td-shadow-card);
  transition: box-shadow var(--td-transition), border-color var(--td-transition);
}
.wiz-treatment-v1 .td-related-card:hover {
  border-color: var(--td-color-teal-wcag);
  box-shadow: var(--td-shadow-hover);
  text-decoration: none;
}
.wiz-treatment-v1 .td-related-card__body {
  display: block !important;
  flex: 1;
  min-width: 0;
}
.wiz-treatment-v1 .td-related-card__name {
  display: block !important;
  font-weight: 600;
  font-size: 15px;
  color: var(--td-color-navy);
  margin-bottom: 3px;
  line-height: 1.35;
}
.wiz-treatment-v1 .td-related-card__price {
  display: block !important;
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 14px;
  color: var(--td-color-teal-wcag);
  margin-bottom: 5px;
}
.wiz-treatment-v1 .td-related-card__desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  color: var(--td-color-muted);
  line-height: 1.45;
}
.wiz-treatment-v1 .td-related-card__arrow {
  display: flex !important;
  align-items: center;
  color: var(--td-color-muted-light);
  flex-shrink: 0;
  margin-top: 2px;
  transition: color var(--td-transition), transform var(--td-transition);
}
.wiz-treatment-v1 .td-related-card__arrow svg {
  width: 18px;
  height: 18px;
}
.wiz-treatment-v1 .td-related-card:hover .td-related-card__arrow {
  color: var(--td-color-teal-wcag);
  transform: translateX(3px);
}

/* --- Footer --- */
.wiz-treatment-v1 .td-footer {
  display: block !important;
  background: var(--td-color-navy);
  padding: 24px 16px;
}
.wiz-treatment-v1 .td-footer__inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex !important;
  flex-direction: column !important;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.wiz-treatment-v1 .td-footer__quiz {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.75);
}
.wiz-treatment-v1 .td-footer__quiz-link {
  color: var(--td-color-teal-brand);
  text-decoration: underline;
  transition: color var(--td-transition);
}
.wiz-treatment-v1 .td-footer__quiz-link:hover {
  color: #fff;
}
.wiz-treatment-v1 .td-footer__phone {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
}
.wiz-treatment-v1 .td-footer__phone svg {
  width: 15px;
  height: 15px;
  color: rgba(255, 255, 255, 0.5);
}
.wiz-treatment-v1 .td-footer__phone a {
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: color var(--td-transition);
}
.wiz-treatment-v1 .td-footer__phone a:hover {
  color: #fff;
}

/* --- Not Found --- */
.wiz-treatment-v1 .td-not-found {
  min-height: 60vh;
  display: flex !important;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}
.wiz-treatment-v1 .td-not-found__inner {
  max-width: 480px;
  text-align: center;
}
.wiz-treatment-v1 .td-not-found__heading {
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 24px;
  color: var(--td-color-navy);
  margin-bottom: 12px;
}
.wiz-treatment-v1 .td-not-found__message {
  font-size: 16px;
  color: var(--td-color-muted);
  margin-bottom: 24px;
  line-height: 1.6;
}
.wiz-treatment-v1 .td-not-found__btn {
  display: inline-block !important;
  background: var(--td-color-navy);
  color: #fff;
  font-family: var(--td-font-heading);
  font-weight: 600;
  font-size: 15px;
  padding: 12px 24px;
  border-radius: var(--td-radius-md);
  text-decoration: none;
  transition: background var(--td-transition);
}
.wiz-treatment-v1 .td-not-found__btn:hover {
  background: var(--td-color-navy-dark);
  text-decoration: none;
}

/* --- Sticky Mobile CTA --- */
.wiz-treatment-v1 .td-sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: var(--td-color-surface);
  border-top: 1px solid var(--td-color-border);
  padding: 10px 16px;
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -2px 12px rgba(8, 30, 43, 0.1);
}
.wiz-treatment-v1 .td-sticky-cta__btn {
  flex: 1;
  display: block !important;
  text-align: center;
  background: var(--td-color-navy);
  color: #fff;
  font-family: var(--td-font-heading);
  font-weight: 700;
  font-size: 15px;
  padding: 12px 16px;
  border-radius: var(--td-radius-md);
  text-decoration: none;
  transition: background var(--td-transition);
}
.wiz-treatment-v1 .td-sticky-cta__btn:hover {
  background: var(--td-color-navy-dark);
  text-decoration: none;
}
.wiz-treatment-v1 .td-sticky-cta__phone {
  display: flex !important;
  flex-direction: column !important;
  align-items: center;
  font-size: 12px;
  color: var(--td-color-muted);
  text-decoration: none;
  min-width: 72px;
  transition: color var(--td-transition);
}
.wiz-treatment-v1 .td-sticky-cta__phone:hover {
  color: var(--td-color-navy);
  text-decoration: none;
}

/* --- Responsive 768px+ --- */
@media (min-width: 768px) {
  .wiz-treatment-v1 .td-sticky-cta { display: none !important; }
  .wiz-treatment-v1 .td-hero { padding: 48px 32px 56px; }
  .wiz-treatment-v1 .td-hero__name { font-size: 36px; }
  .wiz-treatment-v1 .td-hero__price { font-size: 26px; }
  .wiz-treatment-v1 .td-section { padding: 40px 32px; }
  .wiz-treatment-v1 .td-persona-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
  .wiz-treatment-v1 .td-expect-grid { grid-template-columns: repeat(4, 1fr); }
  .wiz-treatment-v1 .td-related-grid { display: grid !important; grid-template-columns: repeat(3, 1fr); overflow-x: visible; }
  .wiz-treatment-v1 .td-related-card { flex: unset; }
  .wiz-treatment-v1 .td-trust__items { flex-direction: row !important; gap: 24px; }
  .wiz-treatment-v1 .td-footer__inner { flex-direction: row !important; justify-content: space-between; text-align: left; align-items: center; }
}

/* --- Animations --- */
@keyframes td-expand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* --- Reduced Motion --- */
@media (prefers-reduced-motion: reduce) {
  .wiz-treatment-v1 *,
  .wiz-treatment-v1 *::before,
  .wiz-treatment-v1 *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>`;

// v1 JS renderer with exactly 4 edits applied:
// 1. Slug from path instead of ?slug= query string
// 2. configUrl -> WP REST endpoint, no Cloudflare Worker
// 3. detailUrl -> plugin-served /wp-content/plugins/wizard-of-iv/assets/treatments-detail.json
// 4. Related card hrefs -> /treatments/<slug>/
const V1_RENDERER_JS = `(function (root) {
  'use strict';

  var CATEGORY_LABELS = {
    iv:         'IV Drip',
    nad:        'NAD+ IV',
    weightLoss: 'Weight Loss',
    injection:  'Injection',
    lab:        'Lab Panel'
  };

  var EVIDENCE_LABELS = {
    strong:   'Clinically supported',
    moderate: 'Well-studied',
    emerging: 'Emerging research'
  };

  var EVIDENCE_MODIFIERS = {
    strong:   'td-evidence-badge--strong',
    moderate: 'td-evidence-badge--moderate',
    emerging: 'td-evidence-badge--emerging'
  };

  var ICONS = {
    clock:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><polyline points="10 6 10 10 13 12"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="16" height="14" rx="2"/><line x1="2" y1="9" x2="18" y2="9"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="13" y1="2" x2="13" y2="6"/></svg>',
    bolt:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 2 3 12 10 12 9 18 17 8 10 8 11 2"/></svg>',
    repeat:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 2 17 8 11 8"/><polyline points="3 18 3 12 9 12"/><path d="M17 8A8 8 0 0 0 5.3 5.3"/><path d="M3 12a8 8 0 0 0 11.7 2.7"/></svg>',
    heart:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.5-7 9-7 9z"/></svg>',
    chevron:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 8 10 13 15 8"/></svg>',
    check:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 10 8 14 16 6"/></svg>',
    star:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><polygon points="10 2 12.4 7.5 18.5 7.9 14 11.9 15.5 18 10 14.8 4.5 18 6 11.9 1.5 7.9 7.6 7.5"/></svg>',
    phone:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2h4l2 5-2.5 1.5A11 11 0 0 0 13.5 14.5L15 12l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 2 4a2 2 0 0 1 2-2z"/></svg>',
    arrow:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="10" x2="17" y2="10"/><polyline points="12 5 17 10 12 15"/></svg>',
    warning:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2L2 17h16L10 2z"/><line x1="10" y1="8" x2="10" y2="12"/><line x1="10" y1="15" x2="10.01" y2="15" stroke-width="2.5"/></svg>',
    info:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><line x1="10" y1="9" x2="10" y2="14"/><line x1="10" y1="6" x2="10.01" y2="6" stroke-width="2.5"/></svg>',
    vial:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2l6 0"/><path d="M8 2v8l-3 5a1.5 1.5 0 0 0 1.3 2.3h7.4A1.5 1.5 0 0 0 15 15l-3-5V2"/><line x1="6" y1="12" x2="14" y2="12"/></svg>',
    shield:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/></svg>'
  };

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildAcuityUrl(wizardConfig, treatment) {
    var base = (wizardConfig.meta && wizardConfig.meta.acuityBase) || 'https://usmobilemedics.as.me/usmobileiv';
    if (treatment.acuityTypeId) {
      return base + '?appointmentTypeID=' + encodeURIComponent(treatment.acuityTypeId);
    }
    return base;
  }

  function renderCategoryBadge(category) {
    var label = CATEGORY_LABELS[category] || category;
    return '<span class="td-category-badge td-category-badge--' + esc(category) + '">' + esc(label) + '</span>';
  }

  function renderNav() {
    return [
      '<nav class="td-nav" role="navigation" aria-label="Page navigation">',
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:52px;">',
          '<a href="/treatments/" class="td-nav__back">',
            '<span class="td-nav__back-arrow"><svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 20 20\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' aria-hidden=\\'true\\'><line x1=\\'17\\' y1=\\'10\\' x2=\\'3\\' y2=\\'10\\'/><polyline points=\\'8 5 3 10 8 15\\'/></svg></span>',
            'All Treatments',
          '</a>',
          '<span class="td-nav__wordmark">US Mobile IV</span>',
        '</div>',
      '</nav>'
    ].join('');
  }

  function renderHero(treatment, wizardConfig) {
    var acuityUrl = buildAcuityUrl(wizardConfig, treatment);
    var priceText = treatment.priceLabel || ('$' + treatment.price);
    var phone = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';

    return [
      '<header class="td-hero">',
        '<div class="td-hero__inner">',
          renderCategoryBadge(treatment.category),
          '<h1 class="td-hero__name">' + esc(treatment.name) + '</h1>',
          '<div class="td-hero__meta">',
            '<span class="td-hero__price">' + esc(priceText) + '</span>',
            treatment.duration
              ? '<span class="td-hero__sep" aria-hidden="true">&#183;</span><span class="td-hero__duration">' + ICONS.clock + esc(treatment.duration) + '</span>'
              : '',
          '</div>',
          '<p class="td-hero__desc">' + esc(treatment.shortDesc) + '</p>',
          '<div class="td-hero__actions">',
            '<a href="' + esc(acuityUrl) + '" class="td-hero__book-btn" target="_blank" rel="noopener">Book This Treatment</a>',
            phone
              ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '" class="td-hero__phone">' + ICONS.phone + esc(phone) + '</a>'
              : '',
          '</div>',
        '</div>',
      '</header>'
    ].join('');
  }

  function renderWhySection(whyText, noteText) {
    if (!whyText) return '';
    var noteHtml = noteText
      ? '<em class="td-why__note">' + esc(noteText) + '</em>'
      : '';
    return [
      '<section class="td-section td-why" aria-labelledby="td-why-heading">',
        '<div class="td-why__inner">',
          '<h2 class="td-section-title" id="td-why-heading">Why This Works</h2>',
          '<p class="td-why__text">' + esc(whyText) + '</p>',
          noteHtml,
        '</div>',
      '</section>'
    ].join('');
  }

  function renderIngredientCard(item, index) {
    var evidenceLevel = item.evidence || item.evidenceLevel || 'moderate';
    var evidenceMod   = EVIDENCE_MODIFIERS[evidenceLevel] || EVIDENCE_MODIFIERS.moderate;
    var evidenceLabel = EVIDENCE_LABELS[evidenceLevel]    || EVIDENCE_LABELS.moderate;
    var cardId        = 'td-ingredient-' + index;
    var bodyId        = 'td-ingredient-body-' + index;

    return [
      '<div class="td-ingredient-card" id="' + cardId + '">',
        '<button class="td-ingredient-card__trigger" aria-expanded="false" aria-controls="' + bodyId + '">',
          '<span class="td-ingredient-card__name">' + esc(item.name) + '</span>',
          item.whatItDoes
            ? '<span class="td-ingredient-card__short">' + esc(item.whatItDoes) + '</span>'
            : (item.benefit ? '<span class="td-ingredient-card__short">' + esc(item.benefit) + '</span>' : ''),
          '<span class="td-ingredient-card__chevron">' + ICONS.chevron + '</span>',
        '</button>',
        '<div class="td-ingredient-card__body" id="' + bodyId + '" hidden>',
          item.whyItMatters
            ? '<p class="td-ingredient-card__detail">' + esc(item.whyItMatters) + '</p>'
            : (item.benefit && item.whatItDoes ? '<p class="td-ingredient-card__detail">' + esc(item.benefit) + '</p>' : ''),
          '<span class="td-evidence-badge ' + evidenceMod + '">' + esc(evidenceLabel) + '</span>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderLabTestCard(test, index) {
    var name  = (typeof test === 'string') ? test : (test.name || test);
    var desc  = (typeof test === 'object' && test.description) ? test.description : null;
    var cardId  = 'td-lab-' + index;
    var bodyId  = 'td-lab-body-' + index;

    return [
      '<div class="td-ingredient-card" id="' + cardId + '">',
        '<button class="td-ingredient-card__trigger" aria-expanded="false" aria-controls="' + bodyId + '">',
          '<span class="td-ingredient-card__name">' + esc(name) + '</span>',
          desc ? '<span class="td-ingredient-card__short">' + esc(desc) + '</span>' : '',
          '<span class="td-ingredient-card__chevron">' + ICONS.chevron + '</span>',
        '</button>',
        '<div class="td-ingredient-card__body" id="' + bodyId + '" hidden>',
          desc
            ? '<p class="td-ingredient-card__detail">' + esc(desc) + '</p>'
            : '<p class="td-ingredient-card__detail">Standard diagnostic marker included in this panel.</p>',
          '<span class="td-evidence-badge td-evidence-badge--strong">Clinically supported</span>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderIngredientsSection(treatment, detailData) {
    var isLab   = treatment.category === 'lab';
    var heading = isLab ? "What\\'s Tested" : "What\\'s Inside";
    var sectionId = 'td-ingredients-heading';

    var cards = '';
    if (isLab) {
      var tests = (detailData && detailData.labTests) || treatment.tests || [];
      if (!tests.length) return '';
      cards = tests.map(function (t, i) { return renderLabTestCard(t, i); }).join('');
    } else {
      var ingredients = (detailData && detailData.ingredients) || treatment.ingredients || [];
      if (!ingredients.length) return '';
      cards = ingredients.map(function (item, i) { return renderIngredientCard(item, i); }).join('');
    }

    return [
      '<section class="td-section td-ingredients" aria-labelledby="' + sectionId + '">',
        '<h2 class="td-section-title" id="' + sectionId + '">' + heading + '</h2>',
        '<div class="td-ingredient-list">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  function renderPersonasSection(detailData, treatment) {
    var personas = (detailData && detailData.personas);
    if (!personas || !personas.length) {
      if (!treatment.bestFor || !treatment.bestFor.length) return '';
      personas = treatment.bestFor.map(function (label) {
        return { headline: label, detail: 'This treatment is an excellent fit for this need.' };
      });
    }

    var cards = personas.map(function (p) {
      return [
        '<div class="td-persona-card">',
          '<p class="td-persona-card__headline">' + esc(p.headline) + '</p>',
          p.detail ? '<p class="td-persona-card__detail">' + esc(p.detail) + '</p>' : '',
        '</div>'
      ].join('');
    }).join('');

    return [
      '<section class="td-section td-personas" aria-labelledby="td-personas-heading">',
        '<h2 class="td-section-title" id="td-personas-heading">Who This Is For</h2>',
        '<div class="td-persona-grid">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  function renderExpectSection(detailData) {
    var ex = detailData && (detailData.whatToExpect || detailData.expect);
    if (!ex) return '';

    var items = [
      ex.onset      ? { icon: ICONS.bolt,   label: 'Onset',     value: ex.onset }      : null,
      ex.duration   ? { icon: ICONS.clock,  label: 'Duration',  value: ex.duration }   : null,
      ex.frequency  ? { icon: ICONS.repeat, label: 'Frequency', value: ex.frequency }  : null,
      ex.howItFeels ? { icon: ICONS.heart,  label: 'Sensation', value: ex.howItFeels } : null
    ].filter(Boolean);

    if (!items.length) return '';

    var cells = items.map(function (item) {
      return [
        '<div class="td-expect-cell">',
          '<span class="td-expect-cell__icon">' + item.icon + '</span>',
          '<span class="td-expect-cell__label">' + esc(item.label) + '</span>',
          '<span class="td-expect-cell__value">' + esc(item.value) + '</span>',
        '</div>'
      ].join('');
    }).join('');

    return [
      '<section class="td-section td-expect" aria-labelledby="td-expect-heading">',
        '<h2 class="td-section-title" id="td-expect-heading">What to Expect</h2>',
        '<div class="td-expect-grid">',
          cells,
        '</div>',
      '</section>'
    ].join('');
  }

  function renderGlp1Section(slug, detailData) {
    var isGlp1 = (slug === 'semaglutide' || slug === 'tirzepatide');
    if (!isGlp1) return '';

    var glp1 = (detailData && detailData.glp1) || {};

    var defaultEligibility = [
      'BMI of 30 or higher',
      'BMI of 27 or higher with a weight-related health condition (type 2 diabetes, high blood pressure, high cholesterol)',
      'No personal or family history of medullary thyroid cancer or MEN2 syndrome',
      'Not currently pregnant or planning to become pregnant'
    ];
    var eligibilityItems;
    if (Array.isArray(glp1.eligibility)) {
      eligibilityItems = glp1.eligibility;
    } else if (glp1.eligibility && typeof glp1.eligibility === 'object') {
      eligibilityItems = [];
      if (glp1.eligibility.bmiRequirement) eligibilityItems.push(glp1.eligibility.bmiRequirement);
      if (Array.isArray(glp1.eligibility.contraindications)) {
        eligibilityItems = eligibilityItems.concat(glp1.eligibility.contraindications);
      }
      if (glp1.eligibility.requiresConsult && typeof glp1.eligibility.requiresConsult === 'string') {
        eligibilityItems.push(glp1.eligibility.requiresConsult);
      } else if (glp1.eligibility.requiresConsult === true) {
        eligibilityItems.push('Medical consultation required before starting');
      }
      if (!eligibilityItems.length) eligibilityItems = defaultEligibility;
    } else {
      eligibilityItems = defaultEligibility;
    }
    var eligibilityList = eligibilityItems.map(function (e) {
      return '<li class="td-glp1__eligibility-item">' + ICONS.check + '<span>' + esc(e) + '</span></li>';
    }).join('');

    var dosingRows = (glp1.dosingSchedule || glp1.dosing || []);
    var dosingTable = '';
    if (dosingRows.length) {
      var tableRows = dosingRows.map(function (row) {
        return '<tr><td>' + esc(row.week || row.period || '') + '</td><td>' + esc(row.dose) + '</td><td>' + esc(row.purpose || row.notes || '') + '</td></tr>';
      }).join('');
      dosingTable = [
        '<div class="td-glp1__table-wrap">',
          '<table class="td-glp1-table" aria-label="Dosing schedule">',
            '<thead><tr><th>Period</th><th>Dose</th><th>Notes</th></tr></thead>',
            '<tbody>' + tableRows + '</tbody>',
          '</table>',
        '</div>'
      ].join('');
    }

    var sideEffects = glp1.sideEffects || {
      common:    ['Nausea (most common, typically improves over time)', 'Constipation or diarrhea', 'Reduced appetite', 'Mild fatigue'],
      lessCommon: ['Vomiting', 'Acid reflux', 'Injection site reactions'],
      serious:   ['Pancreatitis (severe abdominal pain -- seek immediate care)', 'Gallbladder problems', 'Allergic reactions']
    };

    var commonList     = (sideEffects.common     || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var lessCommonList = (sideEffects.lessCommon  || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var seriousList    = (sideEffects.serious     || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var managementTip  = typeof sideEffects.managementTips === 'string' ? sideEffects.managementTips : '';

    var bloodworkNote = glp1.bloodworkNote || 'Initial bloodwork ($99) is required before starting. This typically includes a CBC, CMP, HbA1c, and lipid panel to establish your baseline and ensure safe prescribing.';

    return [
      '<section class="td-section td-glp1" aria-labelledby="td-glp1-heading">',
        '<h2 class="td-section-title" id="td-glp1-heading">Program Information</h2>',
        '<div class="td-glp1__block">',
          '<h3 class="td-glp1__subheading">Eligibility Criteria</h3>',
          '<ul class="td-glp1__eligibility-list">' + eligibilityList + '</ul>',
        '</div>',
        dosingTable
          ? '<div class="td-glp1__block"><h3 class="td-glp1__subheading">Dosing Schedule</h3>' + dosingTable + '</div>'
          : '',
        '<div class="td-glp1__block">',
          '<h3 class="td-glp1__subheading">Side Effects</h3>',
          commonList    ? '<div class="td-glp1__se-group"><p class="td-glp1__se-label td-glp1__se-label--common">Common</p><ul class="td-glp1__se-list">' + commonList + '</ul></div>' : '',
          lessCommonList? '<div class="td-glp1__se-group"><p class="td-glp1__se-label td-glp1__se-label--less-common">Less Common</p><ul class="td-glp1__se-list">' + lessCommonList + '</ul></div>' : '',
          seriousList   ? '<div class="td-glp1__se-group"><div class="td-glp1__se-serious-header">' + ICONS.warning + '<p class="td-glp1__se-label td-glp1__se-label--serious">Serious -- Seek Immediate Care</p></div><ul class="td-glp1__se-list">' + seriousList + '</ul></div>' : '',
          managementTip ? '<p class="td-glp1__management-tip">' + esc(managementTip) + '</p>' : '',
        '</div>',
        '<div class="td-glp1__block td-glp1__bloodwork">',
          '<span class="td-glp1__bloodwork-icon">' + ICONS.vial + '</span>',
          '<div>',
            '<p class="td-glp1__bloodwork-label">Required Bloodwork</p>',
            '<p class="td-glp1__bloodwork-text">' + esc(bloodworkNote) + '</p>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  function renderTrustBar(wizardConfig) {
    var meta   = wizardConfig.meta || {};
    var rating = meta.reviewRating || '5.0';
    var count  = meta.reviewCount  || '';
    var stars  = Array(5).fill('<span class="td-trust__star">' + ICONS.star + '</span>').join('');

    return [
      '<section class="td-trust" aria-label="Trust indicators">',
        '<div class="td-trust__inner">',
          '<div class="td-trust__reviews">',
            '<span class="td-trust__stars" aria-label="' + rating + ' out of 5 stars">' + stars + '</span>',
            '<span class="td-trust__rating">' + esc(rating) + '</span>',
            count ? '<span class="td-trust__count">(' + esc(count) + ' reviews)</span>' : '',
          '</div>',
          '<div class="td-trust__items">',
            '<span class="td-trust__item">' + ICONS.shield + 'Licensed RNs and paramedics</span>',
            '<span class="td-trust__item">' + ICONS.check  + 'We come to you -- home, hotel, office</span>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  function renderStickyCta(treatment, wizardConfig) {
    var acuityUrl = buildAcuityUrl(wizardConfig, treatment);
    var phone     = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';

    return [
      '<div class="td-sticky-cta" role="complementary" aria-label="Book this treatment">',
        '<a href="' + esc(acuityUrl) + '" class="td-sticky-cta__btn" target="_blank" rel="noopener">Book This Treatment</a>',
        phone
          ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '" class="td-sticky-cta__phone">' + esc(phone) + '</a>'
          : '',
      '</div>'
    ].join('');
  }

  function renderRelatedSection(relatedSlugs, wizardConfig) {
    if (!relatedSlugs || !relatedSlugs.length) return '';

    var treatments = wizardConfig.treatments || {};
    var cards = relatedSlugs.slice(0, 3).map(function (slug) {
      var t = treatments[slug];
      if (!t) return '';
      var priceText = t.priceLabel || ('$' + t.price);
      return [
        '<a href="/treatments/' + esc(slug) + '/" class="td-related-card">',
          '<div class="td-related-card__body">',
            '<p class="td-related-card__name">' + esc(t.name) + '</p>',
            '<p class="td-related-card__price">' + esc(priceText) + '</p>',
            t.shortDesc ? '<p class="td-related-card__desc">' + esc(t.shortDesc) + '</p>' : '',
          '</div>',
          '<span class="td-related-card__arrow">' + ICONS.arrow + '</span>',
        '</a>'
      ].join('');
    }).filter(Boolean).join('');

    if (!cards) return '';

    return [
      '<section class="td-section td-related" aria-labelledby="td-related-heading">',
        '<h2 class="td-section-title" id="td-related-heading">Related Treatments</h2>',
        '<div class="td-related-grid">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  function renderFooter(wizardConfig) {
    var phone = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';
    return [
      '<footer class="td-footer">',
        '<div class="td-footer__inner">',
          '<p class="td-footer__quiz">',
            'Not what you need? ',
            '<a href="/treatments/" class="td-footer__quiz-link">See all treatments</a>',
          '</p>',
          phone
            ? '<p class="td-footer__phone">' + ICONS.phone + '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '">' + esc(phone) + '</a></p>'
            : '',
        '</div>',
      '</footer>'
    ].join('');
  }

  function renderNotFound(slug) {
    document.title = 'Treatment Not Found | US Mobile IV';
    var msg = slug
      ? 'The treatment <strong>' + esc(slug) + '</strong> was not found.'
      : 'No treatment was specified.';
    return [
      renderNav(),
      '<main class="td-not-found">',
        '<div class="td-not-found__inner">',
          '<h1 class="td-not-found__heading">Treatment Not Found</h1>',
          '<p class="td-not-found__message">' + msg + '</p>',
          '<a href="/treatments/" class="td-not-found__btn">View All Treatments</a>',
        '</div>',
      '</main>'
    ].join('');
  }

  function renderPage(slug, detailData, wizardConfig) {
    var coreTreatment = (wizardConfig.treatments || {})[slug];
    if (!coreTreatment) {
      return renderNotFound(slug);
    }

    var treatment = {};
    var coreFields = ['name', 'price', 'priceLabel', 'duration', 'shortDesc', 'acuityTypeId', 'category', 'bestFor'];
    coreFields.forEach(function (k) {
      if (coreTreatment[k] !== undefined) treatment[k] = coreTreatment[k];
    });
    if (coreTreatment.ingredients) treatment.ingredients = coreTreatment.ingredients;
    if (coreTreatment.tests)       treatment.tests       = coreTreatment.tests;
    if (detailData) {
      Object.keys(detailData).forEach(function (k) {
        treatment[k] = detailData[k];
      });
    }

    var whyText      = (coreTreatment && coreTreatment.whyMatch) || (wizardConfig.whyMatch || {})[slug] || '';
    var noteText     = (coreTreatment && coreTreatment.note) || '';
    var relatedSlugs = (detailData && detailData.relatedSlugs) || [];

    document.title = treatment.name + ' | US Mobile IV';

    return [
      renderNav(),
      '<main id="td-main">',
        renderHero(treatment, wizardConfig),
        renderWhySection(whyText, noteText),
        renderIngredientsSection(treatment, detailData),
        renderPersonasSection(detailData, treatment),
        renderExpectSection(detailData),
        renderGlp1Section(slug, detailData),
        renderTrustBar(wizardConfig),
        renderRelatedSection(relatedSlugs, wizardConfig),
        renderFooter(wizardConfig),
      '</main>',
      renderStickyCta(treatment, wizardConfig)
    ].join('');
  }

  function bindExpandCards(container) {
    var triggers = container.querySelectorAll('.td-ingredient-card__trigger');
    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var bodyId   = btn.getAttribute('aria-controls');
        var body     = document.getElementById(bodyId);
        var card     = btn.closest('.td-ingredient-card');

        btn.setAttribute('aria-expanded', String(!expanded));
        if (body) { body.hidden = expanded; }
        if (card) { card.classList.toggle('td-ingredient-card--open', !expanded); }
      });
    });
  }

  function init() {
    var app = document.getElementById('td-app');
    if (!app) return;

    // EDIT 1: Slug from URL path (last non-empty segment), not ?slug= query string
    var slug = root.location.pathname.split('/').filter(Boolean).pop() || '';

    // EDIT 2: WP REST config endpoint (no Cloudflare Worker)
    var configUrl = '/wp-json/wizard-of-iv/v1/config';

    // EDIT 3: Plugin-served detail JSON
    var detailUrl = '/wp-content/plugins/wizard-of-iv/assets/treatments-detail.json';

    Promise.all([
      fetch(detailUrl).then(function (r) {
        if (!r.ok) return {};
        return r.json().catch(function () { return {}; });
      }),
      fetch(configUrl).then(function (r) {
        if (!r.ok) throw new Error('Failed to load wizard config');
        return r.json();
      })
    ]).then(function (results) {
      var rawDetail    = results[0];
      var wizardConfig = results[1];

      // EDIT 5: Defend against WP slug canonicalization forcing camelCase to lowercase.
      // /treatments/myersGold/ becomes /treatments/myersgold/ in the WP sitemap and
      // canonical URL. Map the lowercased path segment back to the camelCase config key.
      if (slug && wizardConfig && wizardConfig.treatments && !wizardConfig.treatments[slug]) {
        var lowerSlug = slug.toLowerCase();
        var keys = Object.keys(wizardConfig.treatments);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].toLowerCase() === lowerSlug) {
            slug = keys[i];
            break;
          }
        }
      }

      var detailMap = {};
      var detailArr = rawDetail.treatments || rawDetail;
      if (Array.isArray(detailArr)) {
        detailArr.forEach(function (t) { if (t.slug) detailMap[t.slug] = t; });
      } else {
        detailMap = detailArr;
      }
      var detailData = slug ? (detailMap[slug] || null) : null;

      var html;
      if (!slug || !(wizardConfig.treatments || {})[slug]) {
        html = renderNotFound(slug);
      } else {
        html = renderPage(slug, detailData, wizardConfig);
      }

      app.innerHTML = html;
      bindExpandCards(app);

    }).catch(function (err) {
      console.error('[TreatmentDetail] Failed to load data:', err);
      app.innerHTML = renderNotFound(slug);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));`;

function buildPageContent(treatment) {
  // Wrap in wp:html block markers so WordPress does NOT apply wpautop()
  // (which wraps bare block-level elements and style tags in <p> tags).
  const inner = `${INLINE_STYLES}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;500&display=swap" rel="stylesheet">

<div class="wiz-treatment-v1">
  <div id="td-app"></div>
  <script>
${V1_RENDERER_JS}
  </script>
</div>`;

  return `<!-- wp:html -->\n${inner}\n<!-- /wp:html -->`;
}

// ---------------------------------------------------------------------------
// Content hash (for idempotency check)
// ---------------------------------------------------------------------------

function contentHash(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Sentinel comment embedded in each page so we can detect our version.
// Format: <!-- wiz-v2-hash:<hash> -->
function taggedContent(treatment) {
  const body = buildPageContent(treatment);
  const hash = contentHash(body);
  return { body, hash, tagged: `<!-- wiz-v2-hash:${hash} -->\n${body}` };
}

function extractHash(rawContent) {
  if (!rawContent) return null;
  const m = rawContent.match(/<!-- wiz-v2-hash:([a-f0-9]+) -->/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// WP REST helpers
// ---------------------------------------------------------------------------

async function getPage(slug, auth) {
  const url = `${WP_API}/pages?slug=${encodeURIComponent(slug)}&parent=${PARENT_ID}&status=any&_fields=id,slug,title,content`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: auth },
  });
  if (!res.ok) throw new Error(`GET pages?slug=${slug} failed: HTTP ${res.status}`);
  const pages = await res.json();
  return Array.isArray(pages) && pages.length > 0 ? pages[0] : null;
}

async function updatePage(pageId, treatment, taggedBody, auth) {
  const payload = {
    title:   encodeTitleForWp(treatment.name),
    content: taggedBody,
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] PUT /wp-json/wp/v2/pages/${pageId}  title="${treatment.name}"`);
    return { id: pageId };
  }

  const res = await fetch(`${WP_API}/pages/${pageId}`, {
    method: 'POST', // WP REST uses POST with id, not PUT
    headers: {
      'Content-Type': 'application/json',
      Accept:         'application/json',
      Authorization:  auth,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST pages/${pageId} failed: HTTP ${res.status}\n${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const treatments = loadAllTreatments();
  console.log(`Loaded ${treatments.length} treatments from catalog`);

  if (DRY_RUN) {
    console.log('Running in DRY-RUN mode. No changes will be written.\n');
  }

  const { user, pass } = getCreds();
  const auth = basicAuth(user, pass);

  let updated  = 0;
  let skipped  = 0;
  let missing  = 0;
  let failed   = 0;

  for (const t of treatments) {
    try {
      const page = await getPage(t.id, auth);
      if (!page) {
        console.log(`  MISSING  /treatments/${t.id}/  (page not found under parent=${PARENT_ID}; run create-wp-pages.mjs first)`);
        missing++;
        continue;
      }

      const { body, hash, tagged } = taggedContent(t);

      // Check if current content already has our hash
      // WP REST returns rendered HTML for content.rendered; raw is in content.raw
      const existingRaw = (page.content && (page.content.raw || page.content.rendered)) || '';
      const existingHash = extractHash(existingRaw);

      if (existingHash === hash) {
        console.log(`  SKIP     /treatments/${t.id}/  (content up to date, hash=${hash})`);
        skipped++;
        continue;
      }

      // Also check if the WP title needs fixing
      const wpTitle = page.title && (page.title.raw || page.title.rendered || '');
      const titleNeedsUpdate = wpTitle !== t.name && wpTitle.replace(/&amp;/g, '&').replace(/&#039;/g, "'") !== t.name;

      await updatePage(page.id, t, tagged, auth);
      console.log(`  UPDATE   /treatments/${t.id}/  (id=${page.id}, title="${t.name}"${existingHash ? ', was hash=' + existingHash : ', first polish'})`);
      updated++;
    } catch (err) {
      console.error(`  ERROR    ${t.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (up to date): ${skipped}  Missing: ${missing}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
