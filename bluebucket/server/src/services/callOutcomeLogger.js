/**
 * Blue Bucket Server - Call Outcome Logger
 *
 * Logs call outcomes to Jobber CRM after outbound calls complete.
 * Tracks outcomes that a normal SDR/appointment setter would track:
 * - Booked appointments
 * - Callback requests
 * - Not interested
 * - Voicemail
 * - No answer / Busy / Failed
 *
 * Flow:
 * 1. Twilio call-status webhook triggers logOutcome()
 * 2. Get call context from callContextStore
 * 3. Determine outcome from Twilio data + Retell data
 * 4. Build note content
 * 5. Create note in Jobber on the Request
 * 6. Update Request status if appropriate
 */

const callContextStore = require('./callContextStore');
const { query } = require('../jobber/client');
const queries = require('../jobber/queries');
const { formatInTimeZone } = require('date-fns-tz');
const config = require('../config');

/**
 * Outcome type definitions with corresponding Jobber status actions.
 */
const OUTCOME_STATUS_MAP = {
  booked: 'CONVERTED',
  not_interested: 'ARCHIVED',
  callback_requested: null, // Keep as LEAD
  voicemail: null, // Keep as LEAD
  no_answer: null, // Keep as LEAD
  busy: null, // Keep as LEAD
  failed: null, // Keep as LEAD
  completed: null, // Keep as LEAD (default for unclear outcomes)
};

/**
 * Determine call outcome based on available data.
 *
 * Priority order:
 * 1. Twilio status (busy, no-answer, failed)
 * 2. Machine detection (voicemail)
 * 3. Retell function results (booked, callback_requested)
 * 4. Conversation analysis (not_interested)
 *
 * @param {Object} twilioData - Twilio call status webhook data
 * @param {Object} retellData - Retell call completion data (optional)
 * @returns {Object} Outcome determination with type and details
 */
function determineOutcome(twilioData, retellData = null) {
  const { CallStatus, AnsweredBy, CallDuration } = twilioData;

  // Priority 1: Non-connected call statuses
  if (CallStatus === 'busy') {
    return { type: 'busy', source: 'twilio' };
  }

  if (CallStatus === 'no-answer' || CallStatus === 'canceled') {
    return { type: 'no_answer', source: 'twilio' };
  }

  if (CallStatus === 'failed') {
    return { type: 'failed', source: 'twilio' };
  }

  // Priority 2: Machine/voicemail detection
  if (AnsweredBy && AnsweredBy.startsWith('machine')) {
    return { type: 'voicemail', source: 'twilio_machine_detection' };
  }

  // Priority 3: Check Retell function call results
  if (retellData && retellData.functionCalls) {
    // Check if book_appointment was called successfully
    const bookingCall = retellData.functionCalls.find(
      fc => fc.name === 'book_appointment' && fc.result?.success === true
    );
    if (bookingCall) {
      return {
        type: 'booked',
        source: 'retell_function',
        details: {
          jobNumber: bookingCall.result.jobNumber,
          jobId: bookingCall.result.jobId,
        },
      };
    }
  }

  // Priority 4: Analyze conversation for callback request or not interested
  if (retellData && retellData.transcript) {
    const outcome = analyzeTranscript(retellData.transcript);
    if (outcome) {
      return { type: outcome, source: 'transcript_analysis' };
    }
  }

  // Priority 5: Very short completed calls likely not interested
  const duration = parseInt(CallDuration || '0', 10);
  if (CallStatus === 'completed' && duration < 30) {
    return { type: 'not_interested', source: 'short_call_duration' };
  }

  // Default for completed calls without clear outcome
  return { type: 'completed', source: 'default' };
}

/**
 * Analyze transcript for outcome indicators.
 *
 * @param {string} transcript - Call transcript text
 * @returns {string|null} Detected outcome type or null
 */
function analyzeTranscript(transcript) {
  const lower = transcript.toLowerCase();

  // Callback requested indicators
  const callbackPhrases = [
    'call me back',
    'call back later',
    'not a good time',
    'bad time',
    'busy right now',
    "can't talk",
    "can't talk right now",
    'in a meeting',
    'driving',
    'at work',
  ];

  for (const phrase of callbackPhrases) {
    if (lower.includes(phrase)) {
      return 'callback_requested';
    }
  }

  // Not interested indicators
  const notInterestedPhrases = [
    'not interested',
    'no thanks',
    "don't need",
    "don't want",
    'remove me',
    'stop calling',
    "don't call",
    'do not call',
    'wrong number',
    'already have',
    'already hired',
    'found someone',
  ];

  for (const phrase of notInterestedPhrases) {
    if (lower.includes(phrase)) {
      return 'not_interested';
    }
  }

  return null;
}

/**
 * Format duration in seconds to human-readable string.
 *
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "3m 45s")
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Build note content for logging to Jobber.
 *
 * @param {Object} outcome - Outcome determination object
 * @param {Object} callData - Call data from webhook
 * @param {Object} context - Call context from store
 * @returns {string} Formatted note content
 */
function buildNoteContent(outcome, callData, context) {
  const now = new Date();
  const formattedDate = formatInTimeZone(now, config.businessTz, 'yyyy-MM-dd h:mm a zzz');
  const duration = parseInt(callData.duration || '0', 10);

  const outcomeLabels = {
    booked: 'Booked',
    callback_requested: 'Callback Requested',
    not_interested: 'Not Interested',
    voicemail: 'Voicemail',
    no_answer: 'No Answer',
    busy: 'Line Busy',
    failed: 'Failed',
    completed: 'Completed',
  };

  const label = outcomeLabels[outcome.type] || 'Unknown';

  const lines = [];
  lines.push(`[AI Call - ${label}]`);
  lines.push(`Date: ${formattedDate}`);
  lines.push(`Duration: ${formatDuration(duration)}`);

  switch (outcome.type) {
    case 'booked':
      lines.push('Outcome: Appointment scheduled');
      lines.push('');
      if (outcome.details) {
        lines.push('Booking Details:');
        if (outcome.details.jobNumber) {
          lines.push(`- Confirmation #${outcome.details.jobNumber}`);
        }
      }
      break;

    case 'callback_requested':
      lines.push('Outcome: Customer requested callback');
      lines.push('');
      lines.push('Action Required:');
      lines.push('- Schedule follow-up call');
      break;

    case 'not_interested':
      lines.push('Outcome: Customer declined service');
      lines.push('');
      lines.push('Notes:');
      if (outcome.source === 'short_call_duration') {
        lines.push('- Short call duration indicates disinterest');
      } else {
        lines.push('- Customer was not interested in service');
      }
      lines.push('- Request archived - no follow-up needed');
      break;

    case 'voicemail':
      lines.push('Outcome: Left voicemail');
      lines.push('');
      lines.push('Action Required:');
      lines.push('- Retry in 24 hours if no callback received');
      break;

    case 'no_answer':
      lines.push('Outcome: No answer (rang but not answered)');
      lines.push('');
      lines.push('Action Required:');
      lines.push('- Retry in 4 hours');
      break;

    case 'busy':
      lines.push('Outcome: Line busy');
      lines.push('');
      lines.push('Action Required:');
      lines.push('- Retry in 1 hour');
      break;

    case 'failed':
      lines.push('Outcome: Call failed to connect');
      lines.push('');
      lines.push('Action Required:');
      lines.push('- Verify phone number is valid');
      lines.push('- Retry in 30 minutes');
      break;

    case 'completed':
      lines.push('Outcome: Call completed');
      lines.push('');
      lines.push('Notes:');
      lines.push('- Call outcome could not be determined automatically');
      lines.push('- Review may be needed');
      break;
  }

  lines.push('');
  lines.push('---');
  lines.push('Logged automatically by Blue Bucket AI Voice Agent');

  return lines.join('\n');
}

/**
 * Create a note in Jobber attached to the Request.
 *
 * @param {string} requestId - Jobber Request ID
 * @param {string} message - Note content
 * @returns {Promise<Object>} Created note object
 */
async function createNote(requestId, message) {
  const result = await query(queries.NOTE_CREATE, {
    input: {
      linkedToId: requestId,
      message,
      isVisibleToClient: false,
    },
  });

  if (result.noteCreate.userErrors?.length > 0) {
    throw new Error(result.noteCreate.userErrors[0].message);
  }

  return result.noteCreate.note;
}

/**
 * Update a Request's status in Jobber.
 *
 * @param {string} requestId - Jobber Request ID
 * @param {string} status - New status (LEAD, CONVERTED, ARCHIVED, etc.)
 * @returns {Promise<Object>} Updated request object
 */
async function updateRequestStatus(requestId, status) {
  const result = await query(queries.REQUEST_UPDATE_STATUS, {
    requestId,
    status,
  });

  if (result.requestUpdate.userErrors?.length > 0) {
    throw new Error(result.requestUpdate.userErrors[0].message);
  }

  return result.requestUpdate.request;
}

/**
 * Log call outcome to Jobber.
 *
 * Main function called by the Twilio call-status webhook.
 *
 * @param {Object} callData - Call data from Twilio webhook
 * @param {string} callData.callSid - Twilio CallSid
 * @param {string} callData.status - Call status (completed, busy, etc.)
 * @param {string} [callData.duration] - Call duration in seconds
 * @param {string} [callData.answeredBy] - Machine detection result
 * @param {string} [callData.toNumber] - Called phone number
 * @param {Object} [retellData] - Optional Retell call completion data
 * @returns {Promise<Object>} Result with outcome and logging status
 */
async function logOutcome(callData, retellData = null) {
  const { callSid, status, duration, answeredBy, toNumber } = callData;

  console.log(`[OUTCOME_LOGGER] Processing outcome for ${callSid} (status: ${status})`);

  // Get call context from store (async - Redis-backed)
  const context = await callContextStore.get(callSid);

  if (!context) {
    console.warn(`[OUTCOME_LOGGER] No context found for ${callSid} - cannot log to Jobber`);
    return {
      success: false,
      error: 'No call context found',
      callSid,
    };
  }

  // Determine outcome
  const twilioData = {
    CallStatus: status,
    AnsweredBy: answeredBy,
    CallDuration: duration,
  };

  const outcome = determineOutcome(twilioData, retellData);

  console.log(`[OUTCOME_LOGGER] Determined outcome: ${outcome.type} (source: ${outcome.source})`);

  // Build note content
  const noteContent = buildNoteContent(outcome, callData, context);

  try {
    // Create note in Jobber
    const note = await createNote(context.requestId, noteContent);
    console.log(`[OUTCOME_LOGGER] Created note ${note.id} for request ${context.requestId}`);

    // Update request status if appropriate
    const newStatus = OUTCOME_STATUS_MAP[outcome.type];
    let statusUpdateSuccess = false;
    let statusUpdateErr = null;

    if (newStatus) {
      try {
        await updateRequestStatus(context.requestId, newStatus);
        statusUpdateSuccess = true;
        console.log(`[OUTCOME_LOGGER] Updated request status to ${newStatus}`);
      } catch (statusError) {
        statusUpdateErr = statusError;
        console.error(`[OUTCOME_LOGGER] Failed to update status:`, statusError.message);
        // Don't fail the whole operation if status update fails
      }
    }

    // Remove context from store (call is complete, async Redis)
    await callContextStore.remove(callSid);

    return {
      success: true,
      outcome: outcome.type,
      noteId: note.id,
      requestId: context.requestId,
      statusUpdated: newStatus ? statusUpdateSuccess : false,
      newStatus,
      statusUpdateError: statusUpdateErr?.message,
    };
  } catch (error) {
    console.error(`[OUTCOME_LOGGER] Failed to log outcome:`, error.message);

    return {
      success: false,
      error: error.message,
      outcome: outcome.type,
      requestId: context.requestId,
    };
  }
}

module.exports = {
  logOutcome,
  determineOutcome,
  analyzeTranscript,
  buildNoteContent,
  // Exported for direct use by client.js pattern
  createNote,
  updateRequestStatus,
};
