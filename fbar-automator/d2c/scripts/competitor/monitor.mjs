#!/usr/bin/env node
// monitor.mjs
// Weekly competitor content monitoring — fetches sitemaps + RSS, diffs against previous snapshots

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Sitemapper from 'sitemapper';
import Parser from 'rss-parser';
import { competitors, config } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = path.resolve(__dirname, config.snapshotsDir);
const REPORTS_DIR = path.resolve(__dirname, config.reportsDir);
const QUEUE_PATH = path.resolve(__dirname, config.contentQueuePath);
const TIMEOUT = 15000;

// --- Helpers ---

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSnapshot(domain) {
  const file = path.join(SNAPSHOTS_DIR, `${domain}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveSnapshot(domain, data) {
  const file = path.join(SNAPSHOTS_DIR, `${domain}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function loadContentQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  return queue.topics || [];
}

function inferTopic(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '');
    const segment = pathname.split('/').filter(Boolean).pop() || '';
    return segment.replace(/[-_]/g, ' ').toLowerCase();
  } catch {
    return '';
  }
}

function checkCoverage(url, topics) {
  const inferred = inferTopic(url);
  if (!inferred) return { inferred, status: '❓ Unknown', slug: null };
  const words = inferred.split(/\s+/).filter(w => w.length > 3);
  for (const topic of topics) {
    const slugWords = topic.slug.replace(/-/g, ' ');
    const match = words.some(w => slugWords.includes(w));
    if (match) {
      if (topic.status === 'published') return { inferred, status: '✅ Published', slug: topic.slug };
      return { inferred, status: '⚠️ Pending', slug: topic.slug };
    }
  }
  return { inferred, status: '❌ Not covered', slug: null };
}

// --- Fetchers ---

async function fetchSitemap(url) {
  const sitemap = new Sitemapper({ url, timeout: TIMEOUT });
  const { sites } = await sitemap.fetch();
  return sites || [];
}

async function fetchRss(urls) {
  const parser = new Parser({ timeout: TIMEOUT });
  const entries = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
        entries.push({
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate ? item.pubDate.slice(0, 10) : '',
        });
      }
    } catch (err) {
      console.log(`  ⚠️  RSS fetch failed for ${url}: ${err.message}`);
    }
  }
  return entries;
}

// --- Main ---

async function processCompetitor(comp) {
  console.log(`\n🔍 ${comp.name} (${comp.domain})`);
  const prev = loadSnapshot(comp.domain);
  let sitemapUrls = [];
  let rssEntries = [];

  // Fetch sitemap
  try {
    sitemapUrls = await fetchSitemap(comp.sitemapUrl);
    console.log(`  📊 Sitemap: ${sitemapUrls.length} URLs`);
  } catch (err) {
    console.log(`  ⚠️  Sitemap fetch failed: ${err.message}`);
  }

  // Fetch RSS
  if (comp.rssUrls.length > 0) {
    rssEntries = await fetchRss(comp.rssUrls);
    console.log(`  📰 RSS: ${rssEntries.length} entries`);
  }

  // Diff
  let newSitemapUrls = [];
  let newRssEntries = [];
  let isBaseline = false;

  if (!prev) {
    isBaseline = true;
    console.log('  ✅ Baseline established');
  } else {
    const prevUrls = new Set(prev.sitemapUrls || []);
    const prevLinks = new Set((prev.rssEntries || []).map(e => e.link));
    newSitemapUrls = sitemapUrls.filter(u => !prevUrls.has(u));
    newRssEntries = rssEntries.filter(e => !prevLinks.has(e.link));
    if (newSitemapUrls.length || newRssEntries.length) {
      console.log(`  🔍 New pages: ${newSitemapUrls.length}, New posts: ${newRssEntries.length}`);
    } else {
      console.log('  ✅ No changes');
    }
  }

  // Save updated snapshot
  saveSnapshot(comp.domain, {
    domain: comp.domain,
    fetchedAt: new Date().toISOString(),
    sitemapUrls,
    rssEntries,
  });

  return { comp, isBaseline, newSitemapUrls, newRssEntries };
}

async function run() {
  console.log('=== Competitor Monitor ===\n');
  ensureDir(SNAPSHOTS_DIR);
  ensureDir(REPORTS_DIR);

  const results = [];
  for (const comp of competitors) {
    try {
      const result = await processCompetitor(comp);
      results.push(result);
    } catch (err) {
      console.log(`\n❌ ${comp.name}: ${err.message}`);
      results.push({ comp, isBaseline: false, newSitemapUrls: [], newRssEntries: [], error: err.message });
    }
  }

  // --- Generate report ---
  const today = new Date().toISOString().slice(0, 10);
  const topics = loadContentQueue();
  const lines = [];

  lines.push(`# Competitor Monitor Report — ${today}\n`);
  lines.push('## Summary\n');
  lines.push('| Competitor | New Pages | New Blog Posts | Status |');
  lines.push('|-----------|-----------|----------------|--------|');

  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.comp.domain} | — | — | ❌ Error |`);
    } else if (r.isBaseline) {
      lines.push(`| ${r.comp.domain} | — | — | 📊 Baseline |`);
    } else {
      const hasNew = r.newSitemapUrls.length > 0 || r.newRssEntries.length > 0;
      const status = hasNew ? '🔍 New content' : '✅ No changes';
      lines.push(`| ${r.comp.domain} | ${r.newSitemapUrls.length} | ${r.newRssEntries.length} | ${status} |`);
    }
  }

  lines.push('\n## Detailed Changes\n');
  const coverageRows = [];

  for (const r of results) {
    lines.push(`### ${r.comp.domain} (${r.comp.type})\n`);
    if (r.error) {
      lines.push(`Error fetching data: ${r.error}\n`);
      continue;
    }
    if (r.isBaseline) {
      lines.push('Baseline snapshot established.\n');
      continue;
    }
    if (r.newSitemapUrls.length === 0 && r.newRssEntries.length === 0) {
      lines.push('No new content detected.\n');
      continue;
    }
    if (r.newSitemapUrls.length > 0) {
      lines.push(`**New Sitemap URLs (${r.newSitemapUrls.length}):**`);
      for (const u of r.newSitemapUrls) {
        lines.push(`- ${u}`);
        coverageRows.push({ url: u, ...checkCoverage(u, topics) });
      }
      lines.push('');
    }
    if (r.newRssEntries.length > 0) {
      lines.push(`**New RSS Posts (${r.newRssEntries.length}):**`);
      for (const e of r.newRssEntries) {
        const title = e.title || 'Untitled';
        const date = e.pubDate ? ` — Published ${e.pubDate}` : '';
        lines.push(`- [${title}](${e.link})${date}`);
        coverageRows.push({ url: e.link, ...checkCoverage(e.link, topics) });
      }
      lines.push('');
    }
  }

  // Coverage check
  if (coverageRows.length > 0) {
    lines.push('## Coverage Check\n');
    lines.push('Checking if new competitor content overlaps with our existing topics...\n');
    lines.push('| Competitor URL | Inferred Topic | Our Coverage | Action |');
    lines.push('|---------------|----------------|-------------|--------|');
    for (const row of coverageRows) {
      const action =
        row.status.includes('Published') ? 'Review for improvements' :
        row.status.includes('Pending') ? 'Prioritize writing' :
        row.status.includes('Not covered') ? 'Consider adding to queue' :
        'Investigate';
      const shortUrl = row.url.length > 60 ? row.url.slice(0, 57) + '...' : row.url;
      lines.push(`| ${shortUrl} | ${row.inferred} | ${row.status} | ${action} |`);
    }
    lines.push('');
  }

  // Recommended actions
  const reviewItems = coverageRows.filter(r => r.status.includes('Published'));
  const writeItems = coverageRows.filter(r => r.status.includes('Not covered'));
  const monitorItems = coverageRows.filter(r => r.status.includes('Pending'));

  lines.push('## Recommended Actions\n');
  if (reviewItems.length > 0) {
    lines.push(`1. **Review**: ${reviewItems.map(r => r.inferred).join(', ')} — competitors are also covering these`);
  }
  if (writeItems.length > 0) {
    lines.push(`2. **Write**: ${writeItems.map(r => r.inferred).join(', ')} — competitors cover these but we don't`);
  }
  if (monitorItems.length > 0) {
    lines.push(`3. **Monitor**: ${monitorItems.map(r => r.inferred).join(', ')} — in our queue, prioritize writing`);
  }
  if (reviewItems.length === 0 && writeItems.length === 0 && monitorItems.length === 0) {
    lines.push('No new competitor content detected this cycle. Continue with current content plan.');
  }
  lines.push('');

  const report = lines.join('\n');
  const reportPath = path.join(REPORTS_DIR, `${today}.md`);
  fs.writeFileSync(reportPath, report);

  console.log(`\n✅ Report saved to ${reportPath}`);
}

run().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
