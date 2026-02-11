/**
 * Blue Bucket Server - Retell Webhook Handler
 *
 * Handles incoming function calls from Retell AI voice agent.
 * Routes function requests to appropriate handlers and returns
 * responses in Retell's expected format.
 */

const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const handlers = require('../handlers');
const { validateRetellMiddleware } = require('../utils/validators');

const router = express.Router();

// ============================================
// Signature Verification Middleware
// ============================================

/**
 * Verify Retell webhook signature (optional).
 * Uses HMAC-SHA256 to validate the request came from Retell.
 *
 * If RETELL_WEBHOOK_SECRET is not configured, verification is skipped.
 */
function verifyRetellSignature(req, res, next) {
  const secret = config.retell.webhookSecret;

  // Skip verification if no secret configured
  if (!secret) {
    console.log('[RETELL] Signature verification skipped - no secret configured');
    return next();
  }

  const signature = req.headers['x-retell-signature'];

  if (!signature) {
    console.warn('[RETELL] Missing X-Retell-Signature header');
    // Continue anyway in development, reject in production
    if (config.isProduction) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    return next();
  }

  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[RETELL] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('[RETELL] Signature verified successfully');
    next();
  } catch (error) {
    console.error('[RETELL] Signature verification error:', error.message);
    // Continue in development, reject in production
    if (config.isProduction) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }
    next();
  }
}

// ============================================
// Function Handler Mapping
// ============================================

/**
 * Map of Retell function names to handler functions.
 * Add new functions here as they are defined in Retell dashboard.
 */
const FUNCTION_HANDLERS = {
  lookup_customer: handlers.lookupCustomer,
  calculate_quote: handlers.calculateQuote,
  check_availability: handlers.checkAvailability,
  book_appointment: handlers.bookAppointment,
  transfer_to_ceo: handlers.transferToCeo,
};

// ============================================
// Webhook Endpoint
// ============================================

/**
 * POST /webhook/retell
 *
 * Main webhook endpoint for Retell AI function calls.
 *
 * Request body format:
 * {
 *   "call_id": "call_abc123",
 *   "function_name": "calculate_quote",
 *   "arguments": { ... },
 *   "call_metadata": { ... }
 * }
 *
 * Response format (success):
 * { "result": "..." }
 *
 * Response format (error):
 * { "result": "I'm having trouble with that right now." }
 */
router.post('/webhook/retell', verifyRetellSignature, validateRetellMiddleware, async (req, res) => {
  const startTime = Date.now();
  const { call_id, function_name, arguments: args, call_metadata } = req.body;

  console.log(`[RETELL] Function call received:`, {
    call_id,
    function_name,
    arguments: args,
  });

  // Validate required fields
  if (!function_name) {
    console.error('[RETELL] Missing function_name in request');
    return res.status(400).json({
      result: "I'm sorry, something went wrong. Can you repeat that?",
    });
  }

  // Find the appropriate handler
  const handler = FUNCTION_HANDLERS[function_name];

  if (!handler) {
    console.error(`[RETELL] Unknown function: ${function_name}`);
    return res.status(400).json({
      result: "I'm not sure how to help with that. Is there something else I can assist you with?",
    });
  }

  try {
    // Build metadata object for handlers that need it
    const metadata = {
      callId: call_id,
      ...call_metadata,
    };

    // Execute the handler
    const result = await handler(args || {}, metadata);

    const duration = Date.now() - startTime;
    console.log(`[RETELL] Function ${function_name} completed in ${duration}ms:`, {
      call_id,
      result_preview: typeof result.result === 'string'
        ? result.result.substring(0, 100) + '...'
        : result,
    });

    // Return result in Retell's expected format
    return res.json(result);
  } catch (error) {
    console.error(`[RETELL] Error executing ${function_name}:`, {
      call_id,
      error: error.message,
      stack: config.isDevelopment ? error.stack : undefined,
    });

    // Return graceful error message to agent
    return res.status(500).json({
      result: "I'm having a technical issue right now. Let me try something else. Can you tell me more about what you need?",
    });
  }
});

// ============================================
// Health Check Endpoint
// ============================================

/**
 * GET /webhook/retell/health
 *
 * Health check endpoint for monitoring webhook availability.
 */
router.get('/webhook/retell/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: Object.keys(FUNCTION_HANDLERS),
  });
});

module.exports = router;
