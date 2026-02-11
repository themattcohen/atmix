/**
 * Blue Bucket Server - Transfer to CEO Handler
 *
 * Handles warm transfer requests to the CEO (Laila Kaudio).
 * Used for complex inquiries, complaints, or explicit owner requests.
 */

const config = require('../config');

/**
 * Transfer scenarios that trigger CEO escalation.
 */
const TRANSFER_REASONS = {
  EXPLICIT_REQUEST: 'customer_requested_owner',
  COMPLEX_COMMERCIAL: 'complex_commercial_inquiry',
  PRICING_NEGOTIATION: 'pricing_negotiation',
  COMPLAINT: 'customer_complaint',
  ANGRY_CUSTOMER: 'escalated_frustration',
  SPECIAL_REQUIREMENTS: 'special_requirements',
  PARTNERSHIP: 'partnership_inquiry',
  MEDIA: 'media_inquiry',
  OTHER: 'other',
};

/**
 * Initiate a transfer to the CEO.
 *
 * This handler prepares the transfer context and returns the transfer configuration.
 * The actual call transfer is handled by Retell's transfer functionality.
 *
 * @param {Object} params - Transfer parameters
 * @param {string} params.reason - Reason for transfer (see TRANSFER_REASONS)
 * @param {string} [params.context_summary] - Summary of conversation for CEO
 * @param {string} [params.customer_name] - Customer's name
 * @param {string} [params.customer_phone] - Customer's phone number
 * @param {string} [params.property_details] - Brief property information
 * @param {string} [params.quoted_price] - Any quote given during call
 * @param {string} [params.urgency] - Urgency level (low, medium, high)
 * @returns {Object} Transfer configuration for Retell
 *
 * @example
 * const result = await handleTransferToCeo({
 *   reason: 'customer_requested_owner',
 *   context_summary: 'Customer interested in multi-property Airbnb cleaning contract',
 *   customer_name: 'John Doe',
 *   customer_phone: '+13035551234'
 * });
 */
async function handleTransferToCeo({
  reason,
  context_summary,
  customer_name,
  customer_phone,
  property_details,
  quoted_price,
  urgency = 'medium',
}) {
  console.log('[TransferToCeo] Initiating transfer:', {
    reason,
    customer_name,
    urgency,
  });

  try {
    // Get CEO phone number from config
    const ceoPhone = config.business.ceoPhone;

    if (!ceoPhone) {
      console.error('[TransferToCeo] CEO phone number not configured');
      return {
        success: false,
        transfer_initiated: false,
        error: 'Transfer configuration error',
        message: 'I apologize, but I\'m unable to transfer you right now. ' +
          'Can I take your information and have Laila call you back directly?',
        fallback_action: 'callback_request',
      };
    }

    // Validate reason
    const normalizedReason = normalizeReason(reason);

    // Build transfer context for CEO (whisper message)
    const transferContext = buildTransferContext({
      reason: normalizedReason,
      context_summary,
      customer_name,
      customer_phone,
      property_details,
      quoted_price,
      urgency,
    });

    // Build spoken message for customer
    const customerMessage = buildCustomerMessage(normalizedReason);

    console.log('[TransferToCeo] Transfer prepared:', {
      transfer_to: maskPhoneNumber(ceoPhone),
      reason: normalizedReason,
      context_length: transferContext.length,
    });

    return {
      success: true,
      transfer_initiated: true,
      transfer_to: ceoPhone,
      transfer_type: 'warm',
      reason: normalizedReason,
      urgency,
      whisper_message: transferContext,
      customer_message: customerMessage,
      message: customerMessage,
      metadata: {
        customer_name: customer_name || 'Unknown',
        customer_phone: customer_phone || 'Unknown',
        timestamp: new Date().toISOString(),
        source: 'ai_voice_agent',
      },
    };
  } catch (error) {
    console.error('[TransferToCeo] Error preparing transfer:', error.message);

    return {
      success: false,
      transfer_initiated: false,
      error: 'Transfer preparation failed',
      message: 'I\'m having trouble connecting you with our owner. ' +
        'Can I take your number and have her call you back shortly?',
      fallback_action: 'callback_request',
    };
  }
}

/**
 * Normalize transfer reason to standard enum value.
 *
 * @param {string} reason - Raw reason string
 * @returns {string} Normalized reason
 */
function normalizeReason(reason) {
  if (!reason) return TRANSFER_REASONS.OTHER;

  const normalized = reason.toLowerCase();

  // Map common phrases to standard reasons
  if (normalized.includes('owner') || normalized.includes('manager') || normalized.includes('speak')) {
    return TRANSFER_REASONS.EXPLICIT_REQUEST;
  }
  if (normalized.includes('commercial') || normalized.includes('business') || normalized.includes('contract')) {
    return TRANSFER_REASONS.COMPLEX_COMMERCIAL;
  }
  if (normalized.includes('price') || normalized.includes('negotiate') || normalized.includes('discount')) {
    return TRANSFER_REASONS.PRICING_NEGOTIATION;
  }
  if (normalized.includes('complaint') || normalized.includes('unhappy') || normalized.includes('problem')) {
    return TRANSFER_REASONS.COMPLAINT;
  }
  if (normalized.includes('angry') || normalized.includes('upset') || normalized.includes('frustrat')) {
    return TRANSFER_REASONS.ANGRY_CUSTOMER;
  }
  if (normalized.includes('special') || normalized.includes('custom') || normalized.includes('unique')) {
    return TRANSFER_REASONS.SPECIAL_REQUIREMENTS;
  }
  if (normalized.includes('partner') || normalized.includes('vendor') || normalized.includes('collaborate')) {
    return TRANSFER_REASONS.PARTNERSHIP;
  }
  if (normalized.includes('media') || normalized.includes('press') || normalized.includes('interview')) {
    return TRANSFER_REASONS.MEDIA;
  }

  // Check for exact matches
  if (Object.values(TRANSFER_REASONS).includes(reason)) {
    return reason;
  }

  return TRANSFER_REASONS.OTHER;
}

/**
 * Build context message for CEO (whisper).
 *
 * @param {Object} params - Context parameters
 * @returns {string} Formatted context message
 */
function buildTransferContext({
  reason,
  context_summary,
  customer_name,
  customer_phone,
  property_details,
  quoted_price,
  urgency,
}) {
  const lines = [];

  lines.push('=== AI Agent Transfer ===');
  lines.push(`Customer: ${customer_name || 'Unknown'}`);
  if (customer_phone) {
    lines.push(`Phone: ${maskPhoneNumber(customer_phone)}`);
  }
  lines.push(`Reason: ${formatReason(reason)}`);
  lines.push(`Urgency: ${urgency}`);

  if (property_details) {
    lines.push(`Property: ${property_details}`);
  }

  if (quoted_price) {
    lines.push(`Quote given: $${quoted_price}`);
  }

  if (context_summary) {
    lines.push('');
    lines.push('Context:');
    lines.push(context_summary);
  }

  return lines.join('\n');
}

/**
 * Build message for customer during transfer.
 *
 * @param {string} reason - Transfer reason
 * @returns {string} Customer-facing message
 */
function buildCustomerMessage(reason) {
  const messages = {
    [TRANSFER_REASONS.EXPLICIT_REQUEST]:
      'Absolutely, let me connect you with Laila, our owner, right now. One moment please.',
    [TRANSFER_REASONS.COMPLEX_COMMERCIAL]:
      'For custom commercial arrangements like this, Laila our owner is the best person to help. Let me transfer you to her now.',
    [TRANSFER_REASONS.PRICING_NEGOTIATION]:
      'I understand you\'d like to discuss pricing options. Let me connect you with Laila who can work with you on that.',
    [TRANSFER_REASONS.COMPLAINT]:
      'I\'m sorry to hear about this concern. Let me connect you with Laila, our owner, who can help resolve this for you right away.',
    [TRANSFER_REASONS.ANGRY_CUSTOMER]:
      'I completely understand your frustration. Let me get Laila on the line right now to help you directly.',
    [TRANSFER_REASONS.SPECIAL_REQUIREMENTS]:
      'Those special requirements are something Laila would love to discuss with you personally. Let me transfer you now.',
    [TRANSFER_REASONS.PARTNERSHIP]:
      'Partnership inquiries are handled directly by Laila, our owner. Let me connect you with her.',
    [TRANSFER_REASONS.MEDIA]:
      'For media inquiries, I\'ll connect you with Laila directly. One moment please.',
    [TRANSFER_REASONS.OTHER]:
      'Let me connect you with Laila, our owner, who can better assist you with this. One moment.',
  };

  return messages[reason] || messages[TRANSFER_REASONS.OTHER];
}

/**
 * Format reason for display.
 *
 * @param {string} reason - Reason enum value
 * @returns {string} Human-readable reason
 */
function formatReason(reason) {
  const formats = {
    [TRANSFER_REASONS.EXPLICIT_REQUEST]: 'Customer requested to speak with owner',
    [TRANSFER_REASONS.COMPLEX_COMMERCIAL]: 'Complex commercial/multi-property inquiry',
    [TRANSFER_REASONS.PRICING_NEGOTIATION]: 'Pricing negotiation request',
    [TRANSFER_REASONS.COMPLAINT]: 'Customer complaint',
    [TRANSFER_REASONS.ANGRY_CUSTOMER]: 'Escalated - customer frustrated',
    [TRANSFER_REASONS.SPECIAL_REQUIREMENTS]: 'Special service requirements',
    [TRANSFER_REASONS.PARTNERSHIP]: 'Partnership/vendor inquiry',
    [TRANSFER_REASONS.MEDIA]: 'Media/press inquiry',
    [TRANSFER_REASONS.OTHER]: 'Other reason',
  };

  return formats[reason] || reason;
}

/**
 * Mask phone number for logging.
 *
 * @param {string} phone - Phone number
 * @returns {string} Masked phone number
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 8) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

module.exports = {
  handleTransferToCeo,
  TRANSFER_REASONS,
};
