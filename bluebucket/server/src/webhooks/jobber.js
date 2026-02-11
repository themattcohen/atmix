/**
 * Blue Bucket Server - Jobber Webhook Handler
 *
 * Handles incoming webhooks from Jobber for REQUEST_CREATE events.
 * Stores phone-to-client mappings for customer identification during calls.
 */

const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const redis = require('../redis');
const outboundCaller = require('../services/outboundCaller');
const { validateJobberMiddleware } = require('../utils/validators');

const router = express.Router();

// ============================================
// Signature Verification Middleware
// ============================================

/**
 * Verify Jobber webhook signature.
 * Uses HMAC-SHA256 with the webhook secret to validate authenticity.
 *
 * Jobber sends the signature in the X-Jobber-Hmac-SHA256 header.
 */
function verifyJobberSignature(req, res, next) {
  const secret = config.jobber.clientSecret;

  if (!secret) {
    console.warn('[JOBBER] No client secret configured - skipping verification');
    return next();
  }

  const signature = req.headers['x-jobber-hmac-sha256'];

  if (!signature) {
    console.warn('[JOBBER] Missing X-Jobber-Hmac-SHA256 header');
    // Continue in development, reject in production
    if (config.isProduction) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    return next();
  }

  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Compute expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[JOBBER] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('[JOBBER] Signature verified successfully');
    next();
  } catch (error) {
    console.error('[JOBBER] Signature verification error:', error.message);
    // Continue in development, reject in production
    if (config.isProduction) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }
    next();
  }
}

// ============================================
// Phone Number Normalization
// ============================================

/**
 * Normalize phone number to E.164 format.
 * Handles common US phone number formats.
 *
 * @param {string} phone - Raw phone number string.
 * @returns {string|null} Normalized phone number or null if invalid.
 */
function normalizePhoneNumber(phone) {
  if (!phone) {
    return null;
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length > 10) {
    // Assume already has country code
    return `+${digits}`;
  }

  // Invalid phone number
  console.warn(`[JOBBER] Invalid phone number format: ${phone}`);
  return null;
}

// ============================================
// Request Data Extraction
// ============================================

/**
 * Extract relevant data from Jobber REQUEST_CREATE payload.
 *
 * @param {Object} payload - Webhook payload from Jobber.
 * @returns {Object} Extracted data with phone, requestId, clientName, propertyId.
 */
function extractRequestData(payload) {
  const data = {
    requestId: null,
    phone: null,
    clientName: null,
    propertyId: null,
    address: null,
    source: null,
  };

  // The payload structure varies based on Jobber's webhook format
  // Handle both nested and flat structures

  // Extract request ID
  data.requestId = payload.webHookEvent?.itemId ||
    payload.data?.request?.id ||
    payload.request?.id ||
    payload.id;

  // Extract client information
  const client = payload.data?.request?.client ||
    payload.request?.client ||
    payload.client;

  if (client) {
    // Get primary phone or first available phone
    if (client.phones && Array.isArray(client.phones)) {
      const primaryPhone = client.phones.find(p => p.primary);
      const phone = primaryPhone || client.phones[0];
      if (phone) {
        data.phone = normalizePhoneNumber(phone.number);
      }
    } else if (client.phone) {
      data.phone = normalizePhoneNumber(client.phone);
    }

    // Build client name
    if (client.firstName || client.lastName) {
      data.clientName = [client.firstName, client.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
    } else if (client.companyName) {
      data.clientName = client.companyName;
    } else if (client.name) {
      data.clientName = client.name;
    }

    data.jobberId = client.id;
  }

  // Extract property information
  const property = payload.data?.request?.property ||
    payload.request?.property ||
    payload.property;

  if (property) {
    data.propertyId = property.id;

    // Build address object
    const addr = property.address;
    if (addr) {
      data.address = {
        street: [addr.street1, addr.street2].filter(Boolean).join(' '),
        city: addr.city,
        state: addr.province,
        postalCode: addr.postalCode,
        country: addr.country,
      };
    }
  }

  // Extract source (e.g., "Angi", "Website")
  data.source = payload.data?.request?.source ||
    payload.request?.source ||
    payload.source;

  return data;
}

// ============================================
// Webhook Endpoint
// ============================================

/**
 * POST /webhook/jobber
 *
 * Handles Jobber webhook events, primarily REQUEST_CREATE.
 *
 * When a new request is created in Jobber (e.g., from Angi lead),
 * this endpoint stores the phone-to-client mapping so the voice
 * agent can identify the caller.
 *
 * Response format:
 * { "received": true, "processed": true/false }
 */
router.post('/webhook/jobber', verifyJobberSignature, validateJobberMiddleware, async (req, res) => {
  const startTime = Date.now();

  // Extract topic/event type
  const topic = req.body.webHookEvent?.topic ||
    req.body.topic ||
    req.headers['x-jobber-topic'];

  console.log(`[JOBBER] Webhook received:`, {
    topic,
    itemId: req.body.webHookEvent?.itemId,
  });

  // Only process REQUEST_CREATE events
  if (topic !== 'REQUEST_CREATE') {
    console.log(`[JOBBER] Ignoring event type: ${topic}`);
    return res.json({
      received: true,
      processed: false,
      reason: `Unhandled topic: ${topic}`,
    });
  }

  try {
    // Extract data from payload
    const data = extractRequestData(req.body);

    console.log(`[JOBBER] Extracted request data:`, {
      requestId: data.requestId,
      phone: data.phone ? `${data.phone.substring(0, 6)}...` : null,
      clientName: data.clientName,
      source: data.source,
    });

    // Store phone mapping if we have a valid phone number
    if (data.phone) {
      await redis.storePhoneMapping(data.phone, {
        jobberId: data.jobberId,
        requestId: data.requestId,
        name: data.clientName,
        address: data.address,
        propertyId: data.propertyId,
        source: data.source,
        lastCall: null,
      });

      const duration = Date.now() - startTime;
      console.log(`[JOBBER] Phone mapping stored for ${data.phone} in ${duration}ms`);

      // ============================================
      // TRIGGER OUTBOUND CALL TO THE LEAD
      // ============================================
      // This is the core feature - when an Angi lead comes in,
      // automatically call them to qualify and book appointments.

      let callResult = { scheduled: false };

      try {
        callResult = outboundCaller.triggerLeadCall({
          phone: data.phone,
          requestId: data.requestId,
          propertyId: data.propertyId,
          customerName: data.clientName,
          source: data.source || 'Angi',
          address: data.address,
        });

        if (callResult.scheduled) {
          console.log(`[JOBBER] Outbound call scheduled for ${data.phone} in ${callResult.delay}s`);
        } else {
          console.log(`[JOBBER] Outbound call not scheduled: ${callResult.reason}`);
        }
      } catch (callError) {
        // Don't fail the webhook if outbound calling fails
        // The phone mapping is still stored, call can be made manually
        console.error(`[JOBBER] Outbound call scheduling failed:`, callError.message);
        callResult = { scheduled: false, error: callError.message };
      }

      return res.json({
        received: true,
        processed: true,
        requestId: data.requestId,
        phone: data.phone,
        outboundCall: callResult,
      });
    }

    // No phone number found
    console.warn(`[JOBBER] No phone number found in REQUEST_CREATE payload`);
    return res.json({
      received: true,
      processed: false,
      reason: 'No phone number in payload',
      requestId: data.requestId,
    });
  } catch (error) {
    console.error('[JOBBER] Error processing webhook:', error.message);

    // Return 200 to prevent Jobber from retrying
    // Log error for debugging but don't fail the webhook
    return res.json({
      received: true,
      processed: false,
      error: error.message,
    });
  }
});

// ============================================
// Health Check Endpoint
// ============================================

/**
 * GET /webhook/jobber/health
 *
 * Health check endpoint for monitoring webhook availability.
 */
router.get('/webhook/jobber/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    supportedTopics: ['REQUEST_CREATE'],
  });
});

module.exports = router;
