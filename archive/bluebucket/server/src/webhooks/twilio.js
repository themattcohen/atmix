/**
 * Blue Bucket Server - Twilio Webhook Handler
 *
 * Handles Twilio webhooks for:
 * 1. Connecting outbound calls to Retell via SIP
 * 2. Call status updates (initiated, ringing, answered, completed)
 */

const express = require('express');
const twilio = require('twilio');
const config = require('../config');
const twilioClient = require('../twilio/client');
const callOutcomeLogger = require('../services/callOutcomeLogger');

const router = express.Router();

/**
 * Middleware to validate Twilio webhook signatures.
 * Rejects requests that don't have a valid X-Twilio-Signature header.
 */
function validateTwilioSignature(req, res, next) {
  const authToken = config.twilio.authToken;
  if (!authToken) {
    console.error('[TWILIO] Auth token not configured - cannot validate webhook signature');
    return res.sendStatus(500);
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    console.warn('[TWILIO] Missing X-Twilio-Signature header');
    return res.sendStatus(403);
  }

  // Build the full URL Twilio used to sign the request
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${protocol}://${req.get('host')}${req.originalUrl}`;

  // For POST requests, params are the body; for GET, params are query string
  const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});

  const isValid = twilio.validateRequest(authToken, signature, url, params);

  if (!isValid) {
    console.warn(`[TWILIO] Invalid webhook signature for ${req.originalUrl}`);
    return res.sendStatus(403);
  }

  next();
}

// ============================================
// Twilio Connect to Retell Webhook
// ============================================

/**
 * ALL /webhook/twilio-connect-retell
 *
 * Called by Twilio when an outbound call is answered.
 * Returns TwiML that connects the call to Retell via SIP.
 *
 * This endpoint bridges Twilio's phone network to Retell's AI agent.
 *
 * Query Parameters:
 * - retell_call_id: The Retell call ID to connect to
 * - context: Optional context string for logging
 */
router.all('/webhook/twilio-connect-retell', validateTwilioSignature, (req, res) => {
  const retellCallId = req.query.retell_call_id;
  const context = req.query.context || 'inbound';

  console.log(`[TWILIO] Connect webhook called - Retell ID: ${retellCallId}, Context: ${context}`);

  if (!retellCallId) {
    console.error('[TWILIO] Missing retell_call_id parameter');
    // Return TwiML that says sorry and hangs up
    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, there was an error connecting your call. Please try again later.</Say>
  <Hangup/>
</Response>`);
  }

  // Generate TwiML to connect to Retell via SIP
  const twiml = twilioClient.generateRetellConnectTwiML(retellCallId);

  console.log(`[TWILIO] Connecting to SIP: ${retellCallId}@${config.retell.sipDomain}`);

  res.type('text/xml');
  res.send(twiml);
});

// ============================================
// Call Status Webhook
// ============================================

/**
 * POST /webhook/call-status
 *
 * Receives call status updates from Twilio.
 * Used for logging and tracking call outcomes.
 *
 * Status values:
 * - initiated: Call is being placed
 * - ringing: Phone is ringing
 * - answered: Call was answered
 * - completed: Call ended normally
 * - busy: Line was busy
 * - no-answer: No one answered
 * - failed: Call failed
 * - canceled: Call was canceled
 */
router.post('/webhook/call-status', validateTwilioSignature, async (req, res) => {
  const {
    CallSid,
    CallStatus,
    To,
    From,
    Duration,
    AnsweredBy,
    CallDuration,
  } = req.body;

  const timestamp = new Date().toISOString();

  // Log call status for debugging and analytics
  console.log(`[CALL_STATUS] ${timestamp} | ${CallSid} | ${CallStatus} | ${From} → ${To}${Duration ? ` | ${Duration}s` : ''}`);

  // Track specific outcomes
  switch (CallStatus) {
    case 'initiated':
      console.log(`[CALL_STATUS] Call initiated to ${To}`);
      break;

    case 'ringing':
      console.log(`[CALL_STATUS] Phone ringing at ${To}`);
      break;

    case 'answered':
      console.log(`[CALL_STATUS] Call answered${AnsweredBy ? ` by ${AnsweredBy}` : ''}`);
      break;

    case 'completed':
      console.log(`[CALL_STATUS] Call completed - Duration: ${CallDuration || Duration}s`);

      // Log outcome to Jobber
      try {
        await callOutcomeLogger.logOutcome({
          callSid: CallSid,
          status: CallStatus,
          duration: CallDuration || Duration,
          answeredBy: AnsweredBy,
          toNumber: To,
        });
      } catch (error) {
        console.error(`[CALL_STATUS] Failed to log outcome:`, error.message);
      }
      break;

    case 'busy':
    case 'no-answer':
    case 'failed':
      console.warn(`[CALL_STATUS] Call ${CallStatus} to ${To} - may need retry`);

      // Log non-connected outcome
      try {
        await callOutcomeLogger.logOutcome({
          callSid: CallSid,
          status: CallStatus,
          toNumber: To,
        });
      } catch (error) {
        console.error(`[CALL_STATUS] Failed to log outcome:`, error.message);
      }
      break;

    case 'canceled':
      console.log(`[CALL_STATUS] Call canceled to ${To}`);
      break;
  }

  // Always respond 200 to acknowledge receipt
  res.sendStatus(200);
});

// ============================================
// Machine Detection Webhook (Optional)
// ============================================

/**
 * POST /webhook/machine-detection
 *
 * Receives machine detection results from Twilio.
 * Can be used to handle voicemail differently.
 *
 * AnsweredBy values:
 * - human
 * - machine_start
 * - machine_end_beep
 * - machine_end_silence
 * - machine_end_other
 * - fax
 * - unknown
 */
router.post('/webhook/machine-detection', validateTwilioSignature, (req, res) => {
  const { CallSid, AnsweredBy, To } = req.body;

  console.log(`[MACHINE] Call ${CallSid} to ${To} answered by: ${AnsweredBy}`);

  if (AnsweredBy && AnsweredBy.startsWith('machine')) {
    console.log(`[MACHINE] Voicemail detected for ${To} - consider leaving message or retry later`);
    // TODO: Could implement voicemail handling here
    // For now, the Retell agent will handle it as a normal call
  }

  res.sendStatus(200);
});

// ============================================
// Health Check
// ============================================

/**
 * GET /webhook/twilio/health
 *
 * Health check for Twilio webhooks.
 */
router.get('/webhook/twilio/health', (req, res) => {
  const twilioConfig = twilioClient.checkConfiguration();

  res.json({
    status: twilioConfig.isReady ? 'healthy' : 'not_configured',
    timestamp: new Date().toISOString(),
    configuration: twilioConfig,
    endpoints: [
      'POST /webhook/twilio-connect-retell',
      'POST /webhook/call-status',
      'POST /webhook/machine-detection',
    ],
  });
});

module.exports = router;
