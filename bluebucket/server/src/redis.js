/**
 * Blue Bucket Server - Redis Client Module
 *
 * Upstash Redis client with helpers for phone mappings and token storage.
 * Uses REST-based Redis for serverless compatibility.
 */

const { Redis } = require('@upstash/redis');
const config = require('./config');

/**
 * Redis key prefixes for organized storage.
 */
const KEYS = {
  PHONE_MAPPING: 'phone:',
  TOKENS: 'jobber:tokens',
  CALL_STATE: 'call:',
};

/**
 * Initialize Upstash Redis client.
 * Returns null if configuration is missing.
 */
let redis = null;

function initializeClient() {
  if (redis) {
    return redis;
  }

  if (!config.redis.url || !config.redis.token) {
    console.warn('[REDIS] Missing Upstash credentials - Redis operations will fail');
    return null;
  }

  try {
    redis = new Redis({
      url: config.redis.url,
      token: config.redis.token,
    });
    console.log('[REDIS] Client initialized');
    return redis;
  } catch (error) {
    console.error('[REDIS] Failed to initialize client:', error.message);
    return null;
  }
}

/**
 * Ensures Redis client is available.
 * @throws {Error} If Redis is not configured.
 */
function requireClient() {
  const client = initializeClient();
  if (!client) {
    throw new Error('Redis client not available - check configuration');
  }
  return client;
}

// ============================================
// Core Redis Operations
// ============================================

/**
 * Get a value from Redis.
 * @param {string} key - The key to retrieve.
 * @returns {Promise<any>} The stored value or null.
 */
async function get(key) {
  try {
    const client = requireClient();
    const value = await client.get(key);
    return value;
  } catch (error) {
    console.error(`[REDIS] GET error for key "${key}":`, error.message);
    throw error;
  }
}

/**
 * Set a value in Redis with optional TTL.
 * @param {string} key - The key to set.
 * @param {any} value - The value to store (will be JSON serialized by Upstash).
 * @param {number} [ttl] - Optional TTL in seconds.
 * @returns {Promise<string>} "OK" on success.
 */
async function set(key, value, ttl) {
  try {
    const client = requireClient();
    if (ttl) {
      return await client.set(key, value, { ex: ttl });
    }
    return await client.set(key, value);
  } catch (error) {
    console.error(`[REDIS] SET error for key "${key}":`, error.message);
    throw error;
  }
}

/**
 * Delete a key from Redis.
 * @param {string} key - The key to delete.
 * @returns {Promise<number>} Number of keys deleted (0 or 1).
 */
async function del(key) {
  try {
    const client = requireClient();
    return await client.del(key);
  } catch (error) {
    console.error(`[REDIS] DEL error for key "${key}":`, error.message);
    throw error;
  }
}

/**
 * Check if a key exists in Redis.
 * @param {string} key - The key to check.
 * @returns {Promise<boolean>} True if key exists.
 */
async function exists(key) {
  try {
    const client = requireClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`[REDIS] EXISTS error for key "${key}":`, error.message);
    throw error;
  }
}

// ============================================
// Phone Mapping Helpers
// ============================================

/**
 * Store phone-to-client mapping data.
 * Used to associate incoming caller phone numbers with Jobber client data.
 *
 * @param {string} phone - Normalized E.164 phone number.
 * @param {Object} data - Client data to associate.
 * @param {string} [data.jobberId] - Jobber client ID.
 * @param {string} [data.name] - Client name.
 * @param {Object} [data.address] - Client address.
 * @param {Array} [data.properties] - Client properties.
 * @param {string} [data.lastCall] - ISO timestamp of last call.
 * @returns {Promise<string>} "OK" on success.
 */
async function storePhoneMapping(phone, data) {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  const key = KEYS.PHONE_MAPPING + phone;
  const payload = {
    ...data,
    phone,
    updatedAt: new Date().toISOString(),
  };

  console.log(`[REDIS] Storing phone mapping for ${phone}`);
  return await set(key, payload, config.phoneMappingTtl);
}

/**
 * Retrieve phone-to-client mapping data.
 *
 * @param {string} phone - Normalized E.164 phone number.
 * @returns {Promise<Object|null>} Stored client data or null if not found.
 */
async function getPhoneMapping(phone) {
  if (!phone) {
    return null;
  }

  const key = KEYS.PHONE_MAPPING + phone;
  const data = await get(key);

  if (data) {
    console.log(`[REDIS] Found phone mapping for ${phone}`);
  }

  return data;
}

/**
 * Delete phone-to-client mapping.
 *
 * @param {string} phone - Normalized E.164 phone number.
 * @returns {Promise<number>} Number of keys deleted.
 */
async function deletePhoneMapping(phone) {
  if (!phone) {
    return 0;
  }

  const key = KEYS.PHONE_MAPPING + phone;
  console.log(`[REDIS] Deleting phone mapping for ${phone}`);
  return await del(key);
}

// ============================================
// Token Storage Helpers
// ============================================

/**
 * Store Jobber OAuth tokens.
 * Automatically calculates expiration from token data.
 *
 * @param {Object} tokens - OAuth token data.
 * @param {string} tokens.access_token - Access token.
 * @param {string} tokens.refresh_token - Refresh token.
 * @param {number} tokens.expires_in - Token lifetime in seconds.
 * @param {string} [tokens.token_type] - Token type (usually "Bearer").
 * @returns {Promise<string>} "OK" on success.
 */
async function storeTokens(tokens) {
  if (!tokens || !tokens.access_token) {
    throw new Error('Invalid token data');
  }

  const payload = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || 'Bearer',
    expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
    storedAt: new Date().toISOString(),
  };

  // Store without TTL since we need refresh token to persist
  // Access token expiry is handled by expiresAt field
  console.log('[REDIS] Storing Jobber OAuth tokens');
  return await set(KEYS.TOKENS, payload);
}

/**
 * Retrieve stored Jobber OAuth tokens.
 *
 * @returns {Promise<Object|null>} Token data or null if not found.
 * @property {string} accessToken - The access token.
 * @property {string} refreshToken - The refresh token.
 * @property {string} tokenType - Token type (usually "Bearer").
 * @property {string} expiresAt - ISO timestamp of expiration.
 * @property {boolean} isExpired - Whether the access token is expired.
 */
async function getTokens() {
  const data = await get(KEYS.TOKENS);

  if (!data) {
    console.log('[REDIS] No stored tokens found');
    return null;
  }

  // Add computed expiration check
  const expiresAt = new Date(data.expiresAt);
  const isExpired = expiresAt <= new Date();

  return {
    ...data,
    isExpired,
  };
}

/**
 * Delete stored Jobber OAuth tokens.
 * Use when deauthorizing or on refresh failure.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
async function deleteTokens() {
  console.log('[REDIS] Deleting Jobber OAuth tokens');
  return await del(KEYS.TOKENS);
}

// ============================================
// Call State Helpers
// ============================================

/**
 * Store call state for an active call.
 * Used to maintain context across webhook invocations.
 *
 * @param {string} callId - Retell call ID.
 * @param {Object} state - Call state data.
 * @param {number} [ttl=3600] - TTL in seconds (default 1 hour).
 * @returns {Promise<string>} "OK" on success.
 */
async function storeCallState(callId, state, ttl = 3600) {
  if (!callId) {
    throw new Error('Call ID is required');
  }

  const key = KEYS.CALL_STATE + callId;
  const payload = {
    ...state,
    callId,
    updatedAt: new Date().toISOString(),
  };

  return await set(key, payload, ttl);
}

/**
 * Retrieve call state for an active call.
 *
 * @param {string} callId - Retell call ID.
 * @returns {Promise<Object|null>} Call state or null if not found.
 */
async function getCallState(callId) {
  if (!callId) {
    return null;
  }

  const key = KEYS.CALL_STATE + callId;
  return await get(key);
}

/**
 * Delete call state after call ends.
 *
 * @param {string} callId - Retell call ID.
 * @returns {Promise<number>} Number of keys deleted.
 */
async function deleteCallState(callId) {
  if (!callId) {
    return 0;
  }

  const key = KEYS.CALL_STATE + callId;
  return await del(key);
}

// ============================================
// Health Check
// ============================================

/**
 * Check Redis connectivity.
 *
 * @returns {Promise<boolean>} True if Redis is accessible.
 */
async function ping() {
  try {
    const client = requireClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[REDIS] Ping failed:', error.message);
    return false;
  }
}

/**
 * Get Redis health status.
 *
 * @returns {Promise<Object>} Health status object.
 */
async function healthCheck() {
  const start = Date.now();
  try {
    const isConnected = await ping();
    const latency = Date.now() - start;

    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      latency: `${latency}ms`,
      connected: isConnected,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      connected: false,
    };
  }
}

module.exports = {
  // Core operations
  get,
  set,
  del,
  exists,

  // Phone mapping helpers
  storePhoneMapping,
  getPhoneMapping,
  deletePhoneMapping,

  // Token storage helpers
  storeTokens,
  getTokens,
  deleteTokens,

  // Call state helpers
  storeCallState,
  getCallState,
  deleteCallState,

  // Health check
  ping,
  healthCheck,

  // Key prefixes (for testing/debugging)
  KEYS,
};
