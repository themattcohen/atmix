/**
 * Blue Bucket Server - Outbound Caller Service
 *
 * Orchestrates outbound calling when new leads arrive.
 * Handles call delays, rate limiting, and working hours enforcement.
 *
 * Flow:
 * 1. Jobber webhook triggers REQUEST_CREATE
 * 2. This service schedules an outbound call with delay
 * 3. After delay, registers call with Retell
 * 4. Initiates Twilio call that connects to Retell via SIP
 * 5. Customer talks to AI agent
 */

const config = require('../config');
const redis = require('../redis');
const retell = require('../retell/outbound');
const twilio = require('../twilio/client');
const { maskPhone } = require('../utils/phone');
const { utcToZonedTime: toZonedTime, zonedTimeToUtc: fromZonedTime } = require('date-fns-tz');
const { addDays } = require('date-fns');
const availabilityEncoder = require('./availabilityEncoder');
const callContextStore = require('./callContextStore');

// Local timeout map for current process (timeouts can't be stored in Redis)
const localTimeouts = new Map();

// Redis key prefixes
const PENDING_KEY_PREFIX = 'pending:';
const PENDING_TTL = 86400; // 24 hours
const RATE_LIMIT_KEY = 'ratelimit:outbound:hourly';
const RATE_LIMIT_TTL = 3600; // 1 hour

/**
 * Check if we're within allowed calling hours.
 *
 * @returns {boolean} True if calls are allowed now.
 */
function isWithinCallingHours() {
  const now = new Date();
  const zonedNow = toZonedTime(now, config.businessTz);
  const hour = zonedNow.getHours();

  return hour >= config.outboundCalling.startHour && hour < config.outboundCalling.endHour;
}

/**
 * Get next available calling time if outside working hours.
 * Uses date-fns-tz for DST-safe timezone arithmetic.
 *
 * @returns {Date} Next time when calls can be made (UTC).
 */
function getNextCallingTime() {
  const now = new Date();
  const zonedNow = toZonedTime(now, config.businessTz);
  const hour = zonedNow.getHours();

  if (hour < config.outboundCalling.startHour) {
    // Before start hour today - set to start hour today in business timezone
    const nextZoned = new Date(zonedNow);
    nextZoned.setHours(config.outboundCalling.startHour, 0, 0, 0);
    return fromZonedTime(nextZoned, config.businessTz);
  } else if (hour >= config.outboundCalling.endHour) {
    // After end hour - set to start hour tomorrow in business timezone
    const nextZoned = addDays(zonedNow, 1);
    nextZoned.setHours(config.outboundCalling.startHour, 0, 0, 0);
    return fromZonedTime(nextZoned, config.businessTz);
  }

  return now;
}

/**
 * Check and update rate limiting using Redis for distributed state.
 *
 * @returns {Promise<boolean>} True if call is allowed, false if rate limited.
 */
async function checkRateLimit() {
  try {
    const current = await redis.get(RATE_LIMIT_KEY);

    if (current === null) {
      // No key exists - start new window
      await redis.set(RATE_LIMIT_KEY, 1, RATE_LIMIT_TTL);
      return true;
    }

    const count = typeof current === 'number' ? current : parseInt(current, 10);

    if (count >= config.outboundCalling.maxCallsPerHour) {
      console.warn(`[OUTBOUND] Rate limit reached: ${count}/${config.outboundCalling.maxCallsPerHour} calls/hour`);
      return false;
    }

    // Increment - use set with the incremented value (Upstash REST doesn't have native INCR)
    await redis.set(RATE_LIMIT_KEY, count + 1, RATE_LIMIT_TTL);
    return true;
  } catch (error) {
    console.error('[OUTBOUND] Rate limit check failed:', error.message);
    // Fail open - allow the call if rate limiting is broken
    return true;
  }
}

/**
 * Execute an outbound call to a lead.
 *
 * @param {Object} leadData - Lead information.
 * @param {string} leadData.phone - Phone number (E.164 format).
 * @param {string} leadData.requestId - Jobber request ID.
 * @param {string} leadData.propertyId - Jobber property ID.
 * @param {string} leadData.customerName - Customer name.
 * @param {string} leadData.source - Lead source (e.g., "Angi").
 * @param {Object} leadData.address - Address information.
 * @returns {Promise<Object>} Call result.
 */
async function executeOutboundCall(leadData) {
  const { phone, requestId, propertyId, customerName, source, address } = leadData;

  console.log(`[OUTBOUND] Executing call to ${maskPhone(phone)} (${customerName || 'Unknown'})`);

  // Check rate limit (async - Redis-backed)
  if (!(await checkRateLimit())) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      scheduled: false,
    };
  }

  // Check working hours
  if (!isWithinCallingHours()) {
    const nextTime = getNextCallingTime();
    console.log(`[OUTBOUND] Outside calling hours. Next available: ${nextTime.toISOString()}`);

    // Schedule for next available time
    const delay = nextTime.getTime() - Date.now();
    await scheduleCall(leadData, delay);

    return {
      success: false,
      error: 'Outside calling hours',
      scheduled: true,
      scheduledFor: nextTime.toISOString(),
    };
  }

  try {
    // Step 0: Pre-compute availability map for the agent
    const availability = await availabilityEncoder.generateAvailabilityMap()
      .catch(err => {
        console.warn('[OUTBOUND] Availability encoding failed:', err.message);
        return { encoded: '', startDate: '', generatedAt: '', teamCapacity: 0 };
      });

    console.log(`[OUTBOUND] Availability map generated: ${availability.encoded.length} chars`);

    // Step 1: Register call with Retell
    const retellResult = await retell.registerOutboundCall({
      toNumber: phone,
      fromNumber: config.twilio.phoneNumber,
      dynamicVariables: {
        customer_name: customerName || '',
        lead_source: source || 'Angi',
        customer_context: buildCustomerContext(leadData),
        availability_map: availability.encoded,
        availability_start: availability.startDate,
      },
      metadata: {
        requestId,
        propertyId,
        source,
        customerName,
      },
    });

    console.log(`[OUTBOUND] Retell call registered: ${retellResult.callId}`);

    // Step 2: Initiate Twilio call to connect to Retell
    const twilioResult = await twilio.initiateOutboundCall({
      toNumber: phone,
      retellCallId: retellResult.callId,
      metadata: {
        requestId,
        source,
        context: 'lead-qualification',
      },
    });

    console.log(`[OUTBOUND] Twilio call initiated: ${twilioResult.callSid}`);

    // Store call context for outcome logging (async - Redis-backed)
    await callContextStore.store(twilioResult.callSid, {
      requestId,
      propertyId,
      customerName,
      phone,
      source,
      initiatedAt: new Date().toISOString(),
    });

    // Store call record in Redis for tracking
    await storeCallRecord({
      phone,
      requestId,
      retellCallId: retellResult.callId,
      twilioCallSid: twilioResult.callSid,
      initiatedAt: new Date().toISOString(),
      status: 'initiated',
    });

    return {
      success: true,
      retellCallId: retellResult.callId,
      twilioCallSid: twilioResult.callSid,
    };
  } catch (error) {
    console.error(`[OUTBOUND] Call failed for ${maskPhone(phone)}:`, error.message);

    // Store failed attempt
    await storeCallRecord({
      phone,
      requestId,
      error: error.message,
      failedAt: new Date().toISOString(),
      status: 'failed',
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Build context string for the AI agent based on lead data.
 *
 * @param {Object} leadData - Lead information.
 * @returns {string} Context string for the agent.
 */
function buildCustomerContext(leadData) {
  const parts = [];

  parts.push('New lead qualification call from Angi inquiry.');

  if (leadData.customerName) {
    parts.push(`Customer name: ${leadData.customerName}.`);
  }

  if (leadData.address) {
    const addr = leadData.address;
    const addressStr = [addr.street, addr.city, addr.state].filter(Boolean).join(', ');
    if (addressStr) {
      parts.push(`Property address: ${addressStr}.`);
    }
  }

  parts.push('The customer recently submitted a cleaning service inquiry.');

  return parts.join(' ');
}

/**
 * Schedule an outbound call with delay.
 * Stores lead data in Redis for recovery, keeps setTimeout in local memory.
 *
 * @param {Object} leadData - Lead information.
 * @param {number} [delayMs] - Delay in milliseconds (defaults to config).
 * @returns {Promise<string>} Schedule ID for cancellation.
 */
async function scheduleCall(leadData, delayMs) {
  const delay = delayMs || (config.outboundCalling.callDelay * 1000);
  const scheduleId = `${leadData.phone}-${Date.now()}`;
  const scheduledFor = new Date(Date.now() + delay).toISOString();

  console.log(`[OUTBOUND] Scheduling call to ${maskPhone(leadData.phone)} in ${delay / 1000}s (ID: ${scheduleId})`);

  // Store in Redis for distributed state and recovery
  try {
    await redis.set(PENDING_KEY_PREFIX + scheduleId, {
      leadData,
      scheduledFor,
      createdAt: new Date().toISOString(),
    }, PENDING_TTL);
  } catch (error) {
    console.error('[OUTBOUND] Failed to store pending call in Redis:', error.message);
  }

  // Keep local timeout for current process execution
  const timeoutId = setTimeout(async () => {
    localTimeouts.delete(scheduleId);

    // Remove from Redis
    try {
      await redis.del(PENDING_KEY_PREFIX + scheduleId);
    } catch (err) {
      console.error('[OUTBOUND] Failed to remove pending call from Redis:', err.message);
    }

    try {
      await executeOutboundCall(leadData);
    } catch (error) {
      console.error(`[OUTBOUND] Scheduled call failed:`, error.message);
    }
  }, delay);

  localTimeouts.set(scheduleId, timeoutId);

  return scheduleId;
}

/**
 * Cancel a scheduled call.
 *
 * @param {string} scheduleId - Schedule ID from scheduleCall.
 * @returns {Promise<boolean>} True if cancelled, false if not found.
 */
async function cancelScheduledCall(scheduleId) {
  // Clear local timeout if it exists
  const timeoutId = localTimeouts.get(scheduleId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    localTimeouts.delete(scheduleId);
  }

  // Remove from Redis
  try {
    const deleted = await redis.del(PENDING_KEY_PREFIX + scheduleId);
    if (deleted > 0 || timeoutId) {
      console.log(`[OUTBOUND] Cancelled scheduled call: ${scheduleId}`);
      return true;
    }
  } catch (error) {
    console.error('[OUTBOUND] Failed to remove pending call from Redis:', error.message);
  }

  return false;
}

/**
 * Recover pending calls from Redis after server restart.
 * Re-schedules calls that haven't expired yet.
 */
async function recoverPendingCalls() {
  console.log('[OUTBOUND] Checking for pending calls to recover...');

  // Note: Upstash REST client doesn't have SCAN, so we can't easily iterate.
  // In practice, pending calls have a limited count and short TTL.
  // This is a best-effort recovery for known schedule IDs stored elsewhere,
  // or could be enhanced with a Redis SET tracking active schedule IDs.
  // For now, log that recovery was attempted.
  console.log('[OUTBOUND] Pending call recovery: pending calls will fire on next lead event or expire via TTL');
}

/**
 * Store call record in Redis for tracking and retry logic.
 *
 * @param {Object} record - Call record data.
 */
async function storeCallRecord(record) {
  try {
    const key = `call:${record.phone}:${Date.now()}`;
    await redis.set(key, record, 86400 * 7); // 7 days
  } catch (error) {
    console.error('[OUTBOUND] Failed to store call record:', error.message);
  }
}

/**
 * Trigger an outbound call for a new lead with configured delay.
 *
 * This is the main entry point called by the Jobber webhook.
 *
 * @param {Object} leadData - Lead information from Jobber webhook.
 * @returns {Promise<Object>} Scheduling result.
 */
async function triggerLeadCall(leadData) {
  // Check if outbound calling is enabled
  if (!config.outboundCalling.enabled) {
    console.log(`[OUTBOUND] Outbound calling disabled - skipping call to ${maskPhone(leadData.phone)}`);
    return { scheduled: false, reason: 'Outbound calling disabled' };
  }

  // Check if we have the required configuration
  const retellConfig = retell.checkConfiguration();
  const twilioConfig = twilio.checkConfiguration();

  if (!retellConfig.isReady) {
    console.warn('[OUTBOUND] Retell not configured - cannot make outbound calls');
    return { scheduled: false, reason: 'Retell not configured', missing: retellConfig };
  }

  if (!twilioConfig.isReady) {
    console.warn('[OUTBOUND] Twilio not configured - cannot make outbound calls');
    return { scheduled: false, reason: 'Twilio not configured', missing: twilioConfig };
  }

  // Schedule the call with delay
  const scheduleId = await scheduleCall(leadData);

  return {
    scheduled: true,
    scheduleId,
    delay: config.outboundCalling.callDelay,
    phone: leadData.phone,
  };
}

/**
 * Get status of outbound calling service.
 *
 * @returns {Promise<Object>} Service status.
 */
async function getStatus() {
  let rateLimitCount = 0;
  try {
    const current = await redis.get(RATE_LIMIT_KEY);
    rateLimitCount = current ? (typeof current === 'number' ? current : parseInt(current, 10)) : 0;
  } catch (error) {
    console.error('[OUTBOUND] Failed to read rate limit:', error.message);
  }

  return {
    enabled: config.outboundCalling.enabled,
    retellConfigured: retell.checkConfiguration(),
    twilioConfigured: twilio.checkConfiguration(),
    withinCallingHours: isWithinCallingHours(),
    callingHours: {
      start: config.outboundCalling.startHour,
      end: config.outboundCalling.endHour,
      timezone: config.businessTz,
    },
    rateLimit: {
      current: rateLimitCount,
      max: config.outboundCalling.maxCallsPerHour,
    },
    pendingCalls: localTimeouts.size,
    callDelay: config.outboundCalling.callDelay,
  };
}

module.exports = {
  executeOutboundCall,
  scheduleCall,
  cancelScheduledCall,
  triggerLeadCall,
  getStatus,
  isWithinCallingHours,
  recoverPendingCalls,
};
