/**
 * Blue Bucket Server - Function Handlers Index
 *
 * Central export for all Retell AI function handlers.
 * Routes to modular handlers with legacy-compatible wrappers.
 *
 * Handler Responsibilities:
 * - calculateQuote: Generate pricing estimates based on property details
 * - lookupCustomer: Find customer info by phone number from Redis/Jobber
 * - checkAvailability: Query Jobber for open scheduling slots
 * - bookAppointment: Create Jobs in Jobber with scheduled visits
 * - transferToCeo: Initiate warm transfer to CEO for escalations
 */

const crypto = require('crypto');

// Import modular handlers
const { handleCalculateQuote } = require('./calculateQuote');
const { handleLookupCustomer } = require('./lookupCustomer');
const { handleCheckAvailability } = require('./checkAvailability');
const { handleBookAppointment } = require('./bookAppointment');
const { handleTransferToCeo, TRANSFER_REASONS } = require('./transferToCeo');

// ============================================
// Legacy Wrappers (backward-compatible)
// ============================================

/**
 * Look up customer information. Maps legacy args to modular handler.
 * @param {Object} args - { phone, phone_number }
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Promise<Object>} Result with `result` field for Retell.
 */
async function lookupCustomer(args, metadata = {}) {
  const result = await handleLookupCustomer({
    phone_number: args.phone || args.phone_number,
  }, metadata);

  if (result.found && result.customer) {
    const { customer } = result;
    let response = `I found your information. `;
    if (customer.name) {
      response += `You're ${customer.name}. `;
    }
    if (customer.address) {
      response += `Your address is ${customer.address}. `;
    }
    return { result: response.trim(), ...result };
  }

  return {
    result: result.message || "I don't have your information on file yet. Can you tell me your name and the address you'd like cleaned?",
    ...result,
  };
}

/**
 * Calculate a quote. Maps legacy args to modular handler.
 * @param {Object} args - { bedrooms, bathrooms, sqft, frequency, addOns, condition, serviceType }
 * @returns {Promise<Object>} Result with `result` field for Retell.
 */
async function calculateQuote(args) {
  const result = await handleCalculateQuote({
    bedrooms: args.bedrooms,
    bathrooms: args.bathrooms,
    square_feet: args.sqft || args.square_feet,
    frequency: args.frequency,
    add_ons: args.addOns || args.add_ons || [],
    condition: args.condition,
  });
  return { result: result.message, ...result };
}

/**
 * Check availability. Maps legacy args to modular handler.
 * @param {Object} args - { preferredDate, preferred_date, preferredTime, preferred_time }
 * @returns {Promise<Object>} Result with `result` field for Retell.
 */
async function checkAvailability(args) {
  const result = await handleCheckAvailability({
    preferred_date: args.preferredDate || args.preferred_date,
    preferred_time: args.preferredTime || args.preferred_time,
  });
  return { result: result.message, ...result };
}

/**
 * Book an appointment. Maps legacy args to modular handler.
 * @param {Object} args - Booking details.
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Promise<Object>} Result with `result` field for Retell.
 */
async function bookAppointment(args, metadata = {}) {
  const result = await handleBookAppointment({
    property_id: args.property_id || args.propertyId,
    request_id: args.request_id || args.requestId,
    customer_name: args.customerName || args.customer_name,
    customer_phone: args.customerPhone || args.customer_phone,
    appointment_date: args.date || args.appointment_date,
    appointment_time: args.time || args.appointment_time,
    service_type: args.serviceType || args.service_type || 'House Cleaning',
    quoted_price: args.estimatedPrice || args.quoted_price,
    estimated_hours: args.estimated_hours,
    special_instructions: args.special_instructions || args.specialInstructions,
  });
  return { result: result.message, ...result };
}

/**
 * Transfer to CEO. Maps legacy args to modular handler.
 * @param {Object} args - { reason }
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Promise<Object>} Result with `result` field for Retell.
 */
async function transferToCeo(args, metadata = {}) {
  const result = await handleTransferToCeo({
    reason: args.reason,
    context_summary: args.context_summary || args.contextSummary,
    customer_name: args.customer_name || args.customerName,
    customer_phone: args.customer_phone || args.customerPhone,
  });

  // Preserve legacy transfer_number field for Retell transfer handling
  if (result.transfer_initiated) {
    return { result: 'transfer_initiated', transfer_number: result.transfer_to, ...result };
  }
  return { result: result.message, ...result };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique confirmation number.
 * Format: BBK-XXXXXXXX (alphanumeric, crypto-secure)
 * @returns {string} Confirmation number.
 */
function generateConfirmationNumber() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BBK-${code}`;
}

// ============================================
// Function Router
// ============================================

/**
 * Route a function call to the appropriate modular handler.
 *
 * @param {string} functionName - Name of the function to call
 * @param {Object} args - Function arguments
 * @param {Object} [metadata] - Call metadata (call_id, from_number, etc.)
 * @returns {Promise<Object>} Handler result (standardized format)
 */
async function routeFunctionCall(functionName, args, metadata = {}) {
  console.log(`[Handlers] Routing function call: ${functionName}`);

  // Normalize function name (handle both snake_case and camelCase)
  const normalized = functionName.toLowerCase().replace(/_/g, '');

  switch (normalized) {
    case 'calculatequote':
    case 'calculate':
    case 'getquote':
    case 'quote':
      return handleCalculateQuote({
        bedrooms: args.bedrooms,
        bathrooms: args.bathrooms,
        square_feet: args.sqft || args.square_feet,
        frequency: args.frequency,
        add_ons: args.addOns || args.add_ons || [],
        condition: args.condition,
      });

    case 'lookupcustomer':
    case 'lookup':
    case 'getcustomer':
    case 'findcustomer':
    case 'lookupproperty':
      return handleLookupCustomer({
        phone_number: args.phone || args.phone_number,
      }, metadata);

    case 'checkavailability':
    case 'availability':
    case 'getavailability':
    case 'schedule':
      return handleCheckAvailability({
        preferred_date: args.preferredDate || args.preferred_date,
        preferred_time: args.preferredTime || args.preferred_time,
        service_duration_hours: args.service_duration_hours,
      });

    case 'bookappointment':
    case 'book':
    case 'createappointment':
    case 'createbooking':
      return handleBookAppointment({
        property_id: args.property_id || args.propertyId,
        request_id: args.request_id || args.requestId,
        customer_name: args.customerName || args.customer_name,
        customer_phone: args.customerPhone || args.customer_phone,
        appointment_date: args.date || args.appointment_date,
        appointment_time: args.time || args.appointment_time,
        service_type: args.serviceType || args.service_type || 'House Cleaning',
        quoted_price: args.estimatedPrice || args.quoted_price,
        estimated_hours: args.estimated_hours,
        special_instructions: args.special_instructions || args.specialInstructions,
      });

    case 'transfertoceo':
    case 'transfer':
    case 'escalate':
    case 'connectowner':
      return handleTransferToCeo({
        reason: args.reason,
        context_summary: args.context_summary || args.contextSummary,
        customer_name: args.customer_name || args.customerName,
        customer_phone: args.customer_phone || args.customerPhone,
        property_details: args.property_details,
        quoted_price: args.quoted_price,
        urgency: args.urgency,
      });

    default:
      console.warn(`[Handlers] Unknown function: ${functionName}`);
      return {
        success: false,
        message: `I'm not sure how to help with that. Let me connect you with our team.`,
        error: `Unknown function: ${functionName}`,
        available_functions: [
          'calculate_quote',
          'lookup_customer',
          'check_availability',
          'book_appointment',
          'transfer_to_ceo',
        ],
      };
  }
}

// ============================================
// Module Exports
// ============================================

module.exports = {
  // Legacy wrappers (backward compatible, include `result` field)
  lookupCustomer,
  calculateQuote,
  checkAvailability,
  bookAppointment,
  transferToCeo,

  // Modular handlers (standardized response format)
  handleCalculateQuote,
  handleLookupCustomer,
  handleCheckAvailability,
  handleBookAppointment,
  handleTransferToCeo,

  // Function router (routes to modular handlers)
  routeFunctionCall,

  // Utilities
  generateConfirmationNumber,

  // Constants
  TRANSFER_REASONS,
};
