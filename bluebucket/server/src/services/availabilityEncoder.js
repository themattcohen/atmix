/**
 * Blue Bucket Server - Availability Encoder Service
 *
 * Pre-computes 3 weeks of appointment availability and encodes it in a
 * token-efficient bitfield format for the Retell AI agent.
 *
 * Format: AM21:1110111|PM21:0111011|AM27:1111111|PM27:1101111|AM03:1010101|PM03:1111111
 *
 * Each block: [Period][StartDay]:[7-bit availability]
 * - Period: AM (9 AM) or PM (1 PM)
 * - StartDay: Day of month for Monday of that week
 * - Bits: 1=open, 0=closed, positions Mon-Sun
 */

const { format, addDays, parseISO, startOfWeek, addWeeks } = require('date-fns');
const { utcToZonedTime: toZonedTime, zonedTimeToUtc: fromZonedTime } = require('date-fns-tz');
const config = require('../config');
const redis = require('../redis');
const { query: jobberQuery } = require('../jobber/client');
const { GET_VISITS, GET_USERS } = require('../jobber/queries');

// Cache key for availability data
const CACHE_KEY = 'availability:encoded';
const CACHE_TTL = 15 * 60; // 15 minutes in seconds

/**
 * Generate compressed availability string for the next 3 weeks.
 *
 * Process:
 * 1. Check cache for recent availability data
 * 2. Query Jobber for scheduled visits (21 days)
 * 3. Query Jobber for team capacity (users with availableForScheduling: true)
 * 4. Calculate open/closed for each AM/PM slot
 * 5. Encode to bitfield format
 * 6. Cache and return
 *
 * @returns {Promise<Object>} Availability data
 * @returns {string} .encoded - Bitfield string (e.g., "AM21:1110111|PM21:...")
 * @returns {string} .startDate - ISO date of first day covered
 * @returns {string} .generatedAt - ISO timestamp of generation
 * @returns {number} .teamCapacity - Team members available for scheduling
 */
async function generateAvailabilityMap() {
  const startTime = Date.now();
  const timezone = config.businessTz;

  console.log('[AVAILABILITY] Generating map for next 3 weeks');

  try {
    // Check cache first
    const cached = await getCachedAvailability();
    if (cached) {
      console.log('[AVAILABILITY] Returning cached availability');
      return cached;
    }

    // Calculate date range: next Monday + 21 days
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);

    // Find next Monday (weekStartsOn: 1 = Monday)
    const nextMonday = getNextMonday(zonedNow);
    const endDate = addDays(nextMonday, 21);

    // Convert to ISO for Jobber API
    const afterDate = fromZonedTime(addDays(nextMonday, -1), timezone).toISOString();
    const beforeDate = fromZonedTime(addDays(endDate, 1), timezone).toISOString();

    console.log('[AVAILABILITY] Querying Jobber for date range:', {
      after: afterDate,
      before: beforeDate,
    });

    // Query Jobber for visits and users in parallel
    const [firstVisitsData, usersData] = await Promise.all([
      jobberQuery(GET_VISITS, { after: afterDate, before: beforeDate }),
      jobberQuery(GET_USERS),
    ]);

    // Paginate through all visits if there are more pages
    let visits = firstVisitsData?.visits?.nodes || [];
    let pageInfo = firstVisitsData?.visits?.pageInfo;

    while (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      console.log(`[AVAILABILITY] Fetching next page of visits (cursor: ${pageInfo.endCursor})`);
      const nextData = await fetchVisitsPage(afterDate, beforeDate, pageInfo.endCursor);
      const nextVisits = nextData?.visits?.nodes || [];
      visits = visits.concat(nextVisits);
      pageInfo = nextData?.visits?.pageInfo;
    }

    const users = (usersData?.users?.nodes || []).filter(
      (user) => user.availableForScheduling && user.status === 'ACTIVE'
    );

    const teamCapacity = users.length || config.business.teamCapacity;

    console.log('[AVAILABILITY] Team capacity:', teamCapacity);
    console.log('[AVAILABILITY] Visits found:', visits.length);

    // Build availability map
    const encoded = encodeAvailability({
      startDate: nextMonday,
      visits,
      teamCapacity,
      timezone,
    });

    const result = {
      encoded,
      startDate: format(nextMonday, 'yyyy-MM-dd'),
      generatedAt: new Date().toISOString(),
      teamCapacity,
    };

    console.log('[AVAILABILITY] Encoded result:', encoded);
    console.log(`[AVAILABILITY] Generation took ${Date.now() - startTime}ms`);

    // Cache the result
    await cacheAvailability(result);

    return result;
  } catch (error) {
    console.error('[AVAILABILITY] Failed to generate availability map:', error.message);
    throw error;
  }
}

/**
 * Fetch a page of visits with cursor-based pagination.
 * Uses an inline query variant since the shared GET_VISITS query doesn't accept a cursor param.
 *
 * @param {string} afterDate - ISO date for start filter
 * @param {string} beforeDate - ISO date for end filter
 * @param {string} afterCursor - Cursor for pagination
 * @returns {Promise<Object>} Visits data with nodes and pageInfo
 */
async function fetchVisitsPage(afterDate, beforeDate, afterCursor) {
  const PAGINATED_VISITS_QUERY = `
    query GetScheduledVisitsPaginated($after: ISO8601DateTime!, $before: ISO8601DateTime!, $afterCursor: String!) {
      visits(
        first: 100,
        after: $afterCursor,
        filter: {
          startAt: { after: $after, before: $before }
          status: SCHEDULED
        }
      ) {
        nodes {
          id
          title
          startAt
          endAt
          status
          allDay
          instructions
          job {
            id
            jobNumber
            title
          }
          property {
            id
            address {
              street
              city
            }
          }
          assignedUsers {
            nodes {
              id
              name
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  return jobberQuery(PAGINATED_VISITS_QUERY, {
    after: afterDate,
    before: beforeDate,
    afterCursor,
  });
}

/**
 * Get the next Monday from a given date.
 * If today is Monday, returns next Monday (not today).
 *
 * @param {Date} fromDate - Starting date
 * @returns {Date} Next Monday
 */
function getNextMonday(fromDate) {
  const dayOfWeek = fromDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Calculate days until next Monday
  // If today is Monday (1), add 7 days
  // If today is Tuesday (2), add 6 days
  // etc.
  let daysUntilMonday;
  if (dayOfWeek === 0) {
    // Sunday -> next Monday is 1 day away
    daysUntilMonday = 1;
  } else if (dayOfWeek === 1) {
    // Monday -> next Monday is 7 days away
    daysUntilMonday = 7;
  } else {
    // Tuesday-Saturday -> calculate remaining days
    daysUntilMonday = 8 - dayOfWeek;
  }

  const nextMonday = addDays(fromDate, daysUntilMonday);
  // Reset to start of day
  nextMonday.setHours(0, 0, 0, 0);

  return nextMonday;
}

/**
 * Encode availability into bitfield format.
 *
 * @param {Object} params - Encoding parameters
 * @param {Date} params.startDate - First Monday of the range
 * @param {Array} params.visits - Scheduled visits from Jobber
 * @param {number} params.teamCapacity - Number of available team members
 * @param {string} params.timezone - Business timezone
 * @returns {string} Encoded bitfield string
 */
function encodeAvailability({ startDate, visits, teamCapacity, timezone }) {
  const blocks = [];

  // Build a map of visits by date and period (AM/PM)
  const visitCounts = buildVisitCountMap(visits, timezone);

  // Generate 3 weeks (6 blocks: AM + PM for each week)
  for (let week = 0; week < 3; week++) {
    const weekStart = addDays(startDate, week * 7);
    const dayOfMonth = weekStart.getDate();

    // AM block
    const amBits = generateWeekBits(weekStart, 'AM', visitCounts, teamCapacity, timezone);
    blocks.push(`AM${dayOfMonth}:${amBits}`);

    // PM block
    const pmBits = generateWeekBits(weekStart, 'PM', visitCounts, teamCapacity, timezone);
    blocks.push(`PM${dayOfMonth}:${pmBits}`);
  }

  return blocks.join('|');
}

/**
 * Build a map of visit counts by date and period.
 *
 * @param {Array} visits - Visits from Jobber
 * @param {string} timezone - Business timezone
 * @returns {Object} Map of "YYYY-MM-DD-AM|PM" -> count
 */
function buildVisitCountMap(visits, timezone) {
  const counts = {};

  for (const visit of visits) {
    if (!visit.startAt) continue;

    const visitDate = toZonedTime(parseISO(visit.startAt), timezone);
    const dateKey = format(visitDate, 'yyyy-MM-dd');
    const hour = visitDate.getHours();

    // Determine period: AM (before noon) or PM (noon and after)
    const period = hour < 12 ? 'AM' : 'PM';
    const key = `${dateKey}-${period}`;

    // Count assigned users, or 1 if no users specified
    const userCount = visit.assignedUsers?.nodes?.length || 1;
    counts[key] = (counts[key] || 0) + userCount;
  }

  return counts;
}

/**
 * Generate 7-bit availability string for a week.
 *
 * @param {Date} weekStart - Monday of the week
 * @param {string} period - "AM" or "PM"
 * @param {Object} visitCounts - Visit count map
 * @param {number} teamCapacity - Team capacity
 * @param {string} timezone - Business timezone
 * @returns {string} 7-character binary string (e.g., "1110111")
 */
function generateWeekBits(weekStart, period, visitCounts, teamCapacity, timezone) {
  let bits = '';

  for (let day = 0; day < 7; day++) {
    const currentDate = addDays(weekStart, day);
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const key = `${dateKey}-${period}`;

    const bookedCount = visitCounts[key] || 0;

    // Slot is open (1) if booked count is less than team capacity
    const isOpen = bookedCount < teamCapacity;
    bits += isOpen ? '1' : '0';
  }

  return bits;
}

/**
 * Get cached availability data if still valid.
 *
 * @returns {Promise<Object|null>} Cached data or null
 */
async function getCachedAvailability() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      // Verify cache is still valid (generated within TTL)
      const generatedAt = new Date(cached.generatedAt);
      const age = Date.now() - generatedAt.getTime();
      if (age < CACHE_TTL * 1000) {
        return cached;
      }
    }
    return null;
  } catch (error) {
    console.warn('[AVAILABILITY] Cache read failed:', error.message);
    return null;
  }
}

/**
 * Cache availability data.
 *
 * @param {Object} data - Availability data to cache
 */
async function cacheAvailability(data) {
  try {
    await redis.set(CACHE_KEY, data, CACHE_TTL);
  } catch (error) {
    console.warn('[AVAILABILITY] Cache write failed:', error.message);
    // Non-fatal: continue without caching
  }
}

/**
 * Clear the availability cache.
 * Useful when schedule changes occur.
 *
 * @returns {Promise<void>}
 */
async function clearCache() {
  try {
    await redis.del(CACHE_KEY);
    console.log('[AVAILABILITY] Cache cleared');
  } catch (error) {
    console.warn('[AVAILABILITY] Cache clear failed:', error.message);
  }
}

module.exports = {
  generateAvailabilityMap,
  clearCache,
  // Export for testing
  getNextMonday,
  encodeAvailability,
  buildVisitCountMap,
  generateWeekBits,
};
