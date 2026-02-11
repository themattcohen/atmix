/**
 * Blue Bucket Server - Lookup Customer Handler
 *
 * Handles customer lookup by phone number.
 * First checks Redis for cached mapping, then queries Jobber for full details.
 */

const config = require('../config');
const { getPhoneMapping } = require('../redis');
const { query: jobberQuery } = require('../jobber/client');
const { GET_REQUEST, GET_CLIENT } = require('../jobber/queries');

// Simple in-memory rate limiter for customer lookups
const lookupRateMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check if a caller has exceeded the lookup rate limit.
 * @param {string} key - Rate limit key (phone number or identifier)
 * @returns {boolean} True if rate limited
 */
function isRateLimited(key) {
  if (!key) return false;
  const now = Date.now();
  const entry = lookupRateMap.get(key);

  if (!entry || now > entry.resetTime) {
    lookupRateMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Normalize phone number to consistent format for lookup.
 * Removes all non-digit characters and ensures proper format.
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return '';

  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle US numbers without country code
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Remove leading 1 if present for consistent storage
  if (digits.length === 11 && digits.startsWith('1')) {
    // Keep the +1 prefix for E.164
    return '+' + digits;
  }

  // Add + prefix if not present
  if (!digits.startsWith('+')) {
    return '+' + digits;
  }

  return digits;
}

/**
 * Look up customer information by phone number.
 *
 * Process:
 * 1. Normalize the phone number
 * 2. Check Redis for cached phone-to-request mapping
 * 3. If found, query Jobber for full Request details
 * 4. Return customer info with property details
 *
 * @param {Object} params - Lookup parameters
 * @param {string} params.phone_number - Customer phone number
 * @param {Object} [callMetadata] - Optional call metadata from Retell
 * @param {string} [callMetadata.call_id] - Retell call ID
 * @param {string} [callMetadata.from_number] - Caller's phone number
 * @returns {Object} Customer lookup result
 *
 * @example
 * const result = await handleLookupCustomer({
 *   phone_number: '+13035551234'
 * });
 * // Returns: { found: true, requestId: '...', customer: { ... } }
 */
async function handleLookupCustomer({ phone_number }, callMetadata = {}) {
  console.log('[LookupCustomer] Looking up customer:', {
    phone_number,
    call_id: callMetadata?.call_id,
  });

  // Rate limit by phone number (or from_number fallback)
  const rateLimitKey = phone_number || callMetadata?.from_number;
  if (isRateLimited(rateLimitKey)) {
    console.warn('[LookupCustomer] Rate limited:', rateLimitKey);
    return {
      found: false,
      error: 'Too many lookup requests. Please try again in a minute.',
    };
  }

  try {
    // Normalize the phone number
    const normalizedPhone = normalizePhone(phone_number);

    if (!normalizedPhone || normalizedPhone.length < 10) {
      console.log('[LookupCustomer] Invalid phone number format');
      return {
        found: false,
        error: 'Invalid phone number format',
      };
    }

    console.log('[LookupCustomer] Normalized phone:', normalizedPhone);

    // Check Redis for phone-to-request mapping
    let mapping = null;
    try {
      mapping = await getPhoneMapping(normalizedPhone);
    } catch (redisError) {
      console.error('[LookupCustomer] Redis lookup error:', redisError.message);
      // Continue without cached mapping
    }

    if (!mapping) {
      console.log('[LookupCustomer] No mapping found in Redis');
      return {
        found: false,
        message: 'No customer record found for this phone number',
        phone_searched: normalizedPhone,
      };
    }

    console.log('[LookupCustomer] Found mapping in Redis:', {
      requestId: mapping.requestId,
      propertyId: mapping.propertyId,
      clientId: mapping.clientId,
    });

    // If we have a request ID, query Jobber for full details
    if (mapping.requestId) {
      try {
        const requestData = await jobberQuery(GET_REQUEST, { id: mapping.requestId });

        if (requestData?.request) {
          const request = requestData.request;
          const client = request.client;
          const property = request.property;

          console.log('[LookupCustomer] Found request in Jobber:', {
            requestId: request.id,
            clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown',
          });

          // Build customer response
          const customer = {
            id: client?.id || mapping.clientId,
            name: client ? `${client.firstName} ${client.lastName}`.trim() : mapping.name,
            firstName: client?.firstName || mapping.firstName,
            lastName: client?.lastName || mapping.lastName,
            email: getPrimaryEmail(client?.emails),
            phone: getPrimaryPhone(client?.phones) || normalizedPhone,
            address: formatAddress(property?.address),
          };

          return {
            found: true,
            requestId: mapping.requestId,
            propertyId: property?.id || mapping.propertyId,
            clientId: client?.id || mapping.clientId,
            customer,
            requestDetails: {
              title: request.title,
              description: request.jobDescription,
              source: request.source,
              createdAt: request.createdAt,
            },
          };
        }
      } catch (jobberError) {
        console.error('[LookupCustomer] Jobber query error:', jobberError.message);
        // Fall back to cached mapping data
      }
    }

    // If Jobber query failed or no request ID, return cached mapping data
    console.log('[LookupCustomer] Returning cached mapping data');
    return {
      found: true,
      requestId: mapping.requestId || null,
      propertyId: mapping.propertyId || null,
      clientId: mapping.clientId || null,
      customer: {
        id: mapping.clientId,
        name: mapping.name || 'Unknown',
        firstName: mapping.firstName,
        lastName: mapping.lastName,
        email: mapping.email,
        phone: normalizedPhone,
        address: mapping.address,
      },
      source: 'cache',
    };
  } catch (error) {
    console.error('[LookupCustomer] Error looking up customer:', error.message);
    return {
      found: false,
      error: 'Unable to lookup customer at this time',
      details: config.isDevelopment ? error.message : undefined,
    };
  }
}

/**
 * Extract primary email from Jobber email array.
 * @param {Array} emails - Array of email objects
 * @returns {string|null} Primary email address or null
 */
function getPrimaryEmail(emails) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return null;
  }
  const primary = emails.find((e) => e.primary);
  return primary?.address || emails[0]?.address || null;
}

/**
 * Extract primary phone from Jobber phone array.
 * @param {Array} phones - Array of phone objects
 * @returns {string|null} Primary phone number or null
 */
function getPrimaryPhone(phones) {
  if (!Array.isArray(phones) || phones.length === 0) {
    return null;
  }
  const primary = phones.find((p) => p.primary);
  return primary?.number || phones[0]?.number || null;
}

/**
 * Format Jobber address object into readable string.
 * @param {Object} address - Jobber address object
 * @returns {string|null} Formatted address string or null
 */
function formatAddress(address) {
  if (!address) {
    return null;
  }

  const parts = [];

  if (address.street1) {
    parts.push(address.street1);
  }
  if (address.street2) {
    parts.push(address.street2);
  }
  if (address.city) {
    const cityPart = [address.city];
    if (address.province) {
      cityPart.push(address.province);
    }
    if (address.postalCode) {
      cityPart.push(address.postalCode);
    }
    parts.push(cityPart.join(', '));
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

module.exports = {
  handleLookupCustomer,
  normalizePhone,
};
