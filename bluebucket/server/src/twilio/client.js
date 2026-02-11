/**
 * Blue Bucket Server - Twilio Client
 *
 * Handles outbound call dialing via Twilio and SIP connection to Retell.
 * Manages the bridge between the phone network and Retell AI agent.
 */

const twilio = require('twilio');
const config = require('../config');

// Initialize Twilio client (lazy initialization)
let twilioClient = null;

/**
 * Get or create the Twilio client instance.
 * Uses lazy initialization to avoid errors when credentials are not configured.
 *
 * @returns {twilio.Twilio|null} Twilio client or null if not configured.
 */
function getTwilioClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    console.warn('[TWILIO] Credentials not configured - outbound calls disabled');
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    console.log('[TWILIO] Client initialized');
  }

  return twilioClient;
}

/**
 * Initiate an outbound call via Twilio that connects to Retell via SIP.
 *
 * Flow:
 * 1. Twilio dials the customer's phone
 * 2. When answered, Twilio hits the webhook URL
 * 3. Webhook returns TwiML to connect to Retell via SIP
 * 4. Customer talks to Retell AI agent
 *
 * @param {Object} params - Call parameters.
 * @param {string} params.toNumber - Phone number to call (E.164 format).
 * @param {string} params.retellCallId - Retell call ID for SIP connection.
 * @param {string} [params.fromNumber] - Caller ID (defaults to config).
 * @param {Object} [params.metadata] - Additional metadata for tracking.
 * @returns {Promise<Object>} Twilio call response.
 */
async function initiateOutboundCall({ toNumber, retellCallId, fromNumber, metadata = {} }) {
  const client = getTwilioClient();

  if (!client) {
    throw new Error('Twilio client not configured');
  }

  if (!config.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const callerIdToUse = fromNumber || config.twilio.phoneNumber;

  if (!callerIdToUse) {
    throw new Error('No caller ID configured');
  }

  console.log(`[TWILIO] Initiating call to ${toNumber} with Retell ID ${retellCallId}`);

  try {
    // Build callback URL with query parameters
    const connectUrl = new URL('/webhook/twilio-connect-retell', config.webhookUrl);
    connectUrl.searchParams.set('retell_call_id', retellCallId);
    connectUrl.searchParams.set('context', metadata.context || 'outbound');

    const statusCallbackUrl = new URL('/webhook/call-status', config.webhookUrl);

    const call = await client.calls.create({
      to: toNumber,
      from: callerIdToUse,
      url: connectUrl.toString(),
      statusCallback: statusCallbackUrl.toString(),
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      // Set a reasonable timeout
      timeout: 30, // Ring for 30 seconds before giving up
      // Machine detection can help avoid voicemails (optional)
      // machineDetection: 'Enable',
      // machineDetectionTimeout: 5,
    });

    console.log(`[TWILIO] Call created: ${call.sid} (status: ${call.status})`);

    return {
      callSid: call.sid,
      status: call.status,
      toNumber: call.to,
      fromNumber: call.from,
    };
  } catch (error) {
    console.error('[TWILIO] Failed to initiate call:', error.message);
    throw error;
  }
}

/**
 * Get call details from Twilio.
 *
 * @param {string} callSid - Twilio call SID.
 * @returns {Promise<Object>} Call details.
 */
async function getCallDetails(callSid) {
  const client = getTwilioClient();

  if (!client) {
    throw new Error('Twilio client not configured');
  }

  try {
    const call = await client.calls(callSid).fetch();
    return {
      callSid: call.sid,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      toNumber: call.to,
      fromNumber: call.from,
    };
  } catch (error) {
    console.error(`[TWILIO] Failed to get call details for ${callSid}:`, error.message);
    throw error;
  }
}

/**
 * Cancel/end a call via Twilio.
 *
 * @param {string} callSid - Twilio call SID.
 * @returns {Promise<void>}
 */
async function cancelCall(callSid) {
  const client = getTwilioClient();

  if (!client) {
    throw new Error('Twilio client not configured');
  }

  try {
    await client.calls(callSid).update({ status: 'canceled' });
    console.log(`[TWILIO] Call canceled: ${callSid}`);
  } catch (error) {
    console.error(`[TWILIO] Failed to cancel call ${callSid}:`, error.message);
    throw error;
  }
}

/**
 * Generate TwiML for connecting a call to Retell via SIP.
 *
 * @param {string} retellCallId - Retell call ID.
 * @returns {string} TwiML XML string.
 */
function generateRetellConnectTwiML(retellCallId) {
  const sipEndpoint = `sip:${retellCallId}@${config.retell.sipDomain}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>${sipEndpoint}</Sip>
  </Dial>
</Response>`;
}

/**
 * Check if Twilio is properly configured.
 *
 * @returns {Object} Configuration status.
 */
function checkConfiguration() {
  return {
    accountSid: !!config.twilio.accountSid,
    authToken: !!config.twilio.authToken,
    phoneNumber: !!config.twilio.phoneNumber,
    webhookUrl: !!config.webhookUrl,
    isReady: !!(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber &&
      config.webhookUrl
    ),
  };
}

module.exports = {
  getTwilioClient,
  initiateOutboundCall,
  getCallDetails,
  cancelCall,
  generateRetellConnectTwiML,
  checkConfiguration,
};
