/**
 * gsc-store.mjs — SQLite persistence for historical GSC snapshots.
 *
 * Stores per-page, per-query GSC search analytics snapshots for trend
 * analysis over time. Uses a lazy-initialized singleton DB connection
 * with WAL mode for concurrent read safety.
 *
 * DB path: scripts/seo-scorer/data/gsc-snapshots.db
 *
 * External dependencies (all in d2c/package.json):
 *   - better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the SQLite database file. */
const DB_PATH = path.join(__dirname, '..', 'data', 'gsc-snapshots.db');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS gsc_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    page_url     TEXT    NOT NULL,
    query        TEXT    NOT NULL,
    fetch_date   TEXT    NOT NULL,
    period_start TEXT    NOT NULL,
    period_end   TEXT    NOT NULL,
    clicks       INTEGER DEFAULT 0,
    impressions  INTEGER DEFAULT 0,
    ctr          REAL    DEFAULT 0,
    position     REAL    DEFAULT 0,
    UNIQUE(page_url, query, fetch_date, period_start, period_end)
  );
`;

// ---------------------------------------------------------------------------
// Singleton DB connection
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Database|null} */
let _db = null;

/**
 * Get (or lazily initialize) the singleton database connection.
 *
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.exec(CREATE_TABLE_SQL);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a GSC snapshot to the database.
 *
 * Uses INSERT OR REPLACE for idempotency — re-running the same fetch date
 * will overwrite the previous result rather than creating duplicates.
 *
 * @param {string} pageUrl
 * @param {Array<{query: string, clicks: number, impressions: number, ctr: number, position: number}>} queries
 * @param {{ fetchDate: string, periodStart: string, periodEnd: string }} options
 * @returns {void}
 */
export function saveSnapshot(pageUrl, queries, { fetchDate, periodStart, periodEnd }) {
  if (!queries?.length) return;

  try {
    const db = getDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO gsc_snapshots
        (page_url, query, fetch_date, period_start, period_end, clicks, impressions, ctr, position)
      VALUES
        (@pageUrl, @query, @fetchDate, @periodStart, @periodEnd, @clicks, @impressions, @ctr, @position)
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(row);
      }
    });

    insertMany(queries.map(q => ({
      pageUrl,
      query: q.query,
      fetchDate,
      periodStart,
      periodEnd,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    })));
  } catch (err) {
    console.warn(`[gsc-store] Failed to save snapshot for "${pageUrl}": ${err.message}`);
  }
}

/**
 * Get the most recent snapshot for a page URL.
 *
 * @param {string} pageUrl
 * @returns {Array<{query: string, clicks: number, impressions: number, ctr: number, position: number, fetchDate: string, periodStart: string, periodEnd: string}>|null}
 *   Array of query rows, or null if no snapshot exists.
 */
export function getLatestSnapshot(pageUrl) {
  try {
    const db = getDb();

    // Find the most recent fetch_date for this page
    const latestDate = db.prepare(`
      SELECT fetch_date
      FROM gsc_snapshots
      WHERE page_url = ?
      ORDER BY fetch_date DESC
      LIMIT 1
    `).pluck().get(pageUrl);

    if (!latestDate) return null;

    const rows = db.prepare(`
      SELECT query, clicks, impressions, ctr, position,
             fetch_date AS fetchDate,
             period_start AS periodStart,
             period_end AS periodEnd
      FROM gsc_snapshots
      WHERE page_url = ? AND fetch_date = ?
      ORDER BY impressions DESC
    `).all(pageUrl, latestDate);

    return rows.length ? rows : null;
  } catch (err) {
    console.warn(`[gsc-store] Failed to read snapshot for "${pageUrl}": ${err.message}`);
    return null;
  }
}

/**
 * Compare the latest two snapshots for ranking trend analysis.
 *
 * Queries that appear only in the latest snapshot are tagged 'new'.
 * Stable is defined as position delta within ±0.5.
 *
 * @param {string} pageUrl
 * @returns {Array<{
 *   query: string,
 *   prevPosition: number|null,
 *   currPosition: number,
 *   delta: number,
 *   direction: 'improved'|'declined'|'stable'|'new'
 * }>|null}  Null if fewer than two snapshots exist.
 */
export function getRankingTrends(pageUrl) {
  try {
    const db = getDb();

    // Find the two most recent distinct fetch dates for this page
    const dates = db.prepare(`
      SELECT DISTINCT fetch_date
      FROM gsc_snapshots
      WHERE page_url = ?
      ORDER BY fetch_date DESC
      LIMIT 2
    `).pluck().all(pageUrl);

    if (dates.length < 2) return null;

    const [currDate, prevDate] = dates;

    /**
     * @param {string} date
     * @returns {Map<string, number>}
     */
    function loadPositionMap(date) {
      const rows = db.prepare(`
        SELECT query, position
        FROM gsc_snapshots
        WHERE page_url = ? AND fetch_date = ?
      `).all(pageUrl, date);

      return new Map(rows.map(r => [r.query, r.position]));
    }

    const currMap = loadPositionMap(currDate);
    const prevMap = loadPositionMap(prevDate);

    const trends = [];

    for (const [query, currPosition] of currMap.entries()) {
      const prevPosition = prevMap.has(query) ? prevMap.get(query) : null;
      const delta = prevPosition !== null ? prevPosition - currPosition : 0;

      let direction;
      if (prevPosition === null) {
        direction = 'new';
      } else if (delta > 0.5) {
        direction = 'improved';
      } else if (delta < -0.5) {
        direction = 'declined';
      } else {
        direction = 'stable';
      }

      trends.push({
        query,
        prevPosition,
        currPosition: Math.round(currPosition * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        direction,
      });
    }

    // Sort by absolute delta descending (most movement first)
    trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return trends;
  } catch (err) {
    console.warn(`[gsc-store] Failed to compute ranking trends for "${pageUrl}": ${err.message}`);
    return null;
  }
}
