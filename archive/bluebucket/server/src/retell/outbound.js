/**
 * Blue Bucket Server - Retell Outbound Calling Client
 *
 * Handles outbound call initiation via Retell AI.
 * Registers calls with Retell and coordinates with Twilio for dialing.
 */

const Retell = require('retell-sdk').default;
const config = require('../config');

// Initialize Retell client (lazy initialization)
let retellClient = null;

/**
 * Get or create the Retell client instance.
 * Uses lazy initialization to avoid errors when API key is not configured.
 *
 * @returns {Retell|null} Retell client or null if not configured.
 */
function getRetellClient() {
  if (!config.retell.apiKey) {
    console.warn('[RETELL] API key not configured - outbound calls disabled');
    return null;
  }

  if (!retellClient) {
    retellClient = new Retell({
      apiKey: config.retell.apiKey,
    });
    console.log('[RETELL] Client initialized');
  }

  return retellClient;
}

/**
 * Register an outbound call with Retell AI.
 *
 * This creates a call session in Retell that can be connected via SIP.
 * The returned call_id is used by Twilio to connect the call to Retell.
 *
 * @param {Object} params - Call parameters.
 * @param {string} params.toNumber - Phone number to call (E.164 format).
 * @param {string} params.fromNumber - Caller ID (E.164 format).
 * @param {Object} [params.dynamicVariables] - Variables for the agent prompt.
 * @param {Object} [params.metadata] - Additional metadata for the call.
 * @returns {Promise<Object>} Retell call registration response.
 */
async function registerOutboundCall({ toNumber, fromNumber, dynamicVariables = {}, metadata = {} }) {
  const client = getRetellClient();

  if (!client) {
    throw new Error('Retell client not configured');
  }

  if (!config.retell.agentId) {
    throw new Error('Retell agent ID not configured');
  }

  console.log(`[RETELL] Registering outbound call to ${toNumber}`);

  try {
    const response = await client.call.registerPhoneCall({
      agent_id: config.retell.agentId,
      from_number: fromNumber || config.twilio.phoneNumber,
      to_number: toNumber,
      retell_llm_dynamic_variables: {
        customer_phone: toNumber,
        lead_source: metadata.source || 'Angi',
        customer_name: metadata.customerName || '',
        customer_context: metadata.context || 'New lead qualification call from Angi inquiry',
        availability_map: dynamicVariables.availability_map || '',
        availability_start: dynamicVariables.availability_start || '',
        ...dynamicVariables,
      },
      metadata: {
        requestId: metadata.requestId || '',
        propertyId: metadata.propertyId || '',
        source: metadata.source || 'webhook',
        ...metadata,
      },
    });

    console.log(`[RETELL] Call registered: ${response.call_id}`);

    return {
      callId: response.call_id,
      agentId: response.agent_id,
      sipEndpoint: `sip:${response.call_id}@${config.retell.sipDomain}`,
    };
  } catch (error) {
    console.error('[RETELL] Failed to register call:', error.message);
    throw error;
  }
}

/**
 * Get call status from Retell.
 *
 * @param {string} callId - Retell call ID.
 * @returns {Promise<Object>} Call status information.
 */
async function getCallStatus(callId) {
  const client = getRetellClient();

  if (!client) {
    throw new Error('Retell client not configured');
  }

  try {
    const response = await client.call.retrieve(callId);
    return response;
  } catch (error) {
    console.error(`[RETELL] Failed to get call status for ${callId}:`, error.message);
    throw error;
  }
}

/**
 * End a call via Retell.
 *
 * @param {string} callId - Retell call ID.
 * @returns {Promise<void>}
 */
async function endCall(callId) {
  const client = getRetellClient();

  if (!client) {
    throw new Error('Retell client not configured');
  }

  try {
    await client.call.end(callId);
    console.log(`[RETELL] Call ended: ${callId}`);
  } catch (error) {
    console.error(`[RETELL] Failed to end call ${callId}:`, error.message);
    throw error;
  }
}

/**
 * Check if outbound calling is properly configured.
 *
 * @returns {Object} Configuration status.
 */
function checkConfiguration() {
  return {
    retellApiKey: !!config.retell.apiKey,
    retellAgentId: !!config.retell.agentId,
    twilioConfigured: !!(config.twilio.accountSid && config.twilio.authToken),
    twilioPhoneNumber: !!config.twilio.phoneNumber,
    webhookUrl: !!config.webhookUrl,
    isReady: !!(
      config.retell.apiKey &&
      config.retell.agentId &&
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber
    ),
  };
}

module.exports = {
  getRetellClient,
  registerOutboundCall,
  getCallStatus,
  endCall,
  checkConfiguration,
};
