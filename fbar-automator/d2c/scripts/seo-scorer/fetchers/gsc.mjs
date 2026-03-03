/**
 * gsc.mjs — Google Search Console API client.
 *
 * Fetches search analytics queries for a specific page URL using
 * service account credentials. Returns null when GSC credentials
 * are not configured so callers can degrade gracefully.
 *
 * External dependencies (all in d2c/package.json):
 *   - @googleapis/searchconsole
 *   - google-auth-library
 */

import { searchconsole } from '@googleapis/searchconsole';
import { GoogleAuth } from 'google-auth-library';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch GSC search analytics queries for a specific page URL.
 *
 * Returns null when GSC credentials are not configured.
 *
 * @param {string} pageUrl  Full URL of the page to analyze.
 * @param {object} [options]
 * @param {string} [options.startDate]  Start date (YYYY-MM-DD). Default: 31 days ago.
 * @param {string} [options.endDate]    End date (YYYY-MM-DD). Default: 3 days ago.
 * @param {string} [options.siteUrl]    GSC property URL. Default: 'sc-domain:fbardirect.com'.
 * @returns {Promise<Array<{query: string, clicks: number, impressions: number, ctr: number, position: number}>|null>}
 */
export async function fetchGscQueries(pageUrl, { startDate, endDate, siteUrl } = {}) {
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = process.env.GSC_PRIVATE_KEY?.replaceAll('\\n', '\n');

  if (!clientEmail || !privateKey) {
    console.warn('[gsc] GSC_CLIENT_EMAIL or GSC_PRIVATE_KEY not set — skipping GSC data fetch.');
    return null; // not configured — caller handles gracefully
  }

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const client = searchconsole({ version: 'v1', auth });

  // Default: last 28 days, excluding 3-day processing lag
  const end = endDate || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const start = startDate || new Date(new Date(end).getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const response = await client.searchanalytics.query({
      siteUrl: siteUrl || 'sc-domain:fbardirect.com',
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
        }],
        rowLimit: 25000,
        dataState: 'final',
      },
    });

    return (response.data.rows || []).map(row => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  } catch (err) {
    console.warn(`[gsc] Failed to fetch GSC data for "${pageUrl}": ${err.message}`);
    return null;
  }
}
