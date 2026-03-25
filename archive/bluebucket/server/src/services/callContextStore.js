/**
 * Blue Bucket Server - Call Context Store
 *
 * Redis-backed store for active call context.
 * Maps Twilio CallSid to lead data (requestId, propertyId, customerName, phone).
 *
 * Used to correlate Twilio call-status webhooks back to the original lead data
 * so we can log outcomes to the correct Jobber Request.
 *
 * Features:
 * - Redis-backed for distributed/persistent storage
 * - TTL-based expiry (1 hour) handled by Redis
 * - Simple get/set/remove interface
 */

const redis = require('../redis');

// TTL for stored contexts (1 hour in seconds)
const TTL_SECONDS = 3600;

// Redis key prefix
const KEY_PREFIX = 'callctx:';

/**
 * Store call context for a CallSid.
 *
 * @param {string} callSid - Twilio CallSid
 * @param {Object} context - Context data to store
 * @param {string} context.requestId - Jobber Request ID
 * @param {string} context.propertyId - Jobber Property ID
 * @param {string} context.customerName - Customer name
 * @param {string} context.phone - Phone number
 * @param {string} [context.source] - Lead source (e.g., "Angi")
 * @param {string} [context.initiatedAt] - ISO timestamp of call initiation
 */
async function store(callSid, context) {
  const key = KEY_PREFIX + callSid;
  const data = {
    ...context,
    storedAt: new Date().toISOString(),
  };

  await redis.set(key, data, TTL_SECONDS);

  console.log(`[CALL_CONTEXT] Stored context for ${callSid}`, {
    requestId: context.requestId,
  });
}

/**
 * Get call context for a CallSid.
 *
 * @param {string} callSid - Twilio CallSid
 * @returns {Promise<Object|null>} Context data or null if not found/expired
 */
async function get(callSid) {
  const key = KEY_PREFIX + callSid;
  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  return data;
}

/**
 * Remove call context for a CallSid.
 *
 * @param {string} callSid - Twilio CallSid
 * @returns {Promise<boolean>} True if removed, false if not found
 */
async function remove(callSid) {
  const key = KEY_PREFIX + callSid;
  const deleted = await redis.del(key);

  if (deleted > 0) {
    console.log(`[CALL_CONTEXT] Removed context for ${callSid}`);
  }

  return deleted > 0;
}

/**
 * Clear all stored contexts (for testing).
 * Note: In Redis, this would require scanning keys. For testing only.
 */
async function clear() {
  console.log('[CALL_CONTEXT] Clear called - no-op in Redis mode (TTL handles expiry)');
}

module.exports = {
  store,
  get,
  remove,
  clear,
};
