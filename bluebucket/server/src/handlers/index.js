/**
 * Blue Bucket Server - Function Handlers Index
 *
 * Central export for all Retell AI function handlers.
 * These handlers are called via webhooks during voice conversations.
 *
 * Handler Responsibilities:
 * - calculateQuote: Generate pricing estimates based on property details
 * - lookupCustomer: Find customer info by phone number from Redis/Jobber
 * - checkAvailability: Query Jobber for open scheduling slots
 * - bookAppointment: Create Jobs in Jobber with scheduled visits
 * - transferToCeo: Initiate warm transfer to CEO for escalations
 *
 * This file re-exports handlers from individual modules AND maintains
 * backward compatibility with the original inline handlers.
 */

const crypto = require('crypto');
const config = require('../config');
const redis = require('../redis');
const { format, addDays, isWeekend, parseISO, isBefore, isAfter } = require('date-fns');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

// Import new modular handlers
const { handleCalculateQuote } = require('./calculateQuote');
const { handleLookupCustomer } = require('./lookupCustomer');
const { handleCheckAvailability } = require('./checkAvailability');
const { handleBookAppointment } = require('./bookAppointment');
const { handleTransferToCeo, TRANSFER_REASONS } = require('./transferToCeo');

// ============================================
// Customer Lookup Handler (Legacy wrapper)
// ============================================

/**
 * Look up customer information from Redis cache or Jobber API.
 * Used when the AI agent needs to identify a caller.
 *
 * @param {Object} args - Function arguments from Retell.
 * @param {string} args.phone - The caller's phone number.
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Promise<Object>} Result object with customer info or not-found message.
 */
async function lookupCustomer(args, metadata = {}) {
  // Use new handler with phone_number mapping
  const result = await handleLookupCustomer({
    phone_number: args.phone || args.phone_number,
  }, metadata);

  // Format for legacy response format
  if (result.found && result.customer) {
    const { customer, requestDetails } = result;
    let response = `I found your information. `;

    if (customer.name) {
      response += `You're ${customer.name}. `;
    }

    if (customer.address) {
      response += `Your address is ${customer.address}. `;
    }

    return {
      result: response.trim(),
      ...result, // Include full result for new consumers
    };
  }

  // No data found
  return {
    result: result.message || "I don't have your information on file yet. Can you tell me your name and the address you'd like cleaned?",
    ...result,
  };
}

// ============================================
// Quote Calculation Handler
// ============================================

/**
 * Calculate a cleaning service quote based on property details.
 *
 * @param {Object} args - Function arguments from Retell.
 * @param {string} args.serviceType - Type of cleaning service.
 * @param {number} args.bedrooms - Number of bedrooms.
 * @param {number} args.bathrooms - Number of bathrooms.
 * @param {number} args.sqft - Square footage.
 * @param {string} [args.frequency] - Service frequency (one-time, weekly, bi-weekly).
 * @param {Array<string>} [args.addOns] - Additional services.
 * @param {string} [args.condition] - Property condition (standard, dirty, veryDirty, extreme).
 * @returns {Object} Result object with price breakdown.
 */
function calculateQuote(args) {
  const {
    serviceType = 'House Cleaning',
    bedrooms = 0,
    bathrooms = 0,
    sqft = 0,
    frequency = 'one-time',
    addOns = [],
    condition = 'standard',
  } = args;

  console.log(`[HANDLERS] Calculating quote:`, { serviceType, bedrooms, bathrooms, sqft, frequency, addOns, condition });

  // Handle non-residential services
  if (serviceType !== 'House Cleaning') {
    return {
      result: `For ${serviceType}, I'd need to know more about the space. Can you describe the area that needs cleaning?`,
    };
  }

  const { pricing } = config;

  // Calculate base price
  let basePrice = pricing.minimumPrice;
  basePrice += bedrooms * pricing.basePerBedroom;
  basePrice += bathrooms * pricing.basePerBathroom;
  basePrice += sqft * pricing.baseSqftRate;

  // Apply condition multiplier
  const conditionMultiplier = pricing.conditionMultipliers[condition] || 1.0;
  basePrice *= conditionMultiplier;

  // Calculate add-ons
  let addOnTotal = 0;
  const addOnDetails = [];

  if (Array.isArray(addOns)) {
    for (const addOn of addOns) {
      const normalizedAddOn = addOn.toLowerCase().replace(/[^a-z]/g, '');

      if (normalizedAddOn.includes('deep') || normalizedAddOn.includes('first')) {
        addOnTotal += pricing.addOns.deepClean;
        addOnDetails.push(`deep clean for $${pricing.addOns.deepClean}`);
      }
      if (normalizedAddOn.includes('oven')) {
        addOnTotal += pricing.addOns.insideOven;
        addOnDetails.push(`inside oven for $${pricing.addOns.insideOven}`);
      }
      if (normalizedAddOn.includes('fridge') || normalizedAddOn.includes('refrigerator')) {
        addOnTotal += pricing.addOns.insideFridge;
        addOnDetails.push(`inside fridge for $${pricing.addOns.insideFridge}`);
      }
      if (normalizedAddOn.includes('cabinet')) {
        addOnTotal += pricing.addOns.insideCabinets;
        addOnDetails.push(`inside cabinets for $${pricing.addOns.insideCabinets}`);
      }
      if (normalizedAddOn.includes('laundry')) {
        addOnTotal += pricing.addOns.laundry;
        addOnDetails.push(`laundry for $${pricing.addOns.laundry}`);
      }
      if (normalizedAddOn.includes('garage')) {
        addOnTotal += pricing.addOns.garage;
        addOnDetails.push(`garage for $${pricing.addOns.garage}`);
      }
      if (normalizedAddOn.includes('patio')) {
        addOnTotal += pricing.addOns.patio;
        addOnDetails.push(`patio for $${pricing.addOns.patio}`);
      }
      if (normalizedAddOn.includes('move')) {
        addOnTotal += pricing.addOns.moveInOut;
        addOnDetails.push(`move-in/move-out service for $${pricing.addOns.moveInOut}`);
      }
    }
  }

  // First-time visit total
  const firstTimeTotal = Math.round(basePrice + addOnTotal);

  // Calculate recurring rate (without add-ons, with discount)
  let recurringRate = basePrice;
  const normalizedFrequency = frequency.toLowerCase();

  if (normalizedFrequency.includes('weekly') && !normalizedFrequency.includes('bi')) {
    recurringRate *= (1 - pricing.recurringDiscount * 1.5); // 15% for weekly
  } else if (normalizedFrequency.includes('bi') || normalizedFrequency.includes('every two')) {
    recurringRate *= (1 - pricing.recurringDiscount); // 10% for bi-weekly
  }

  recurringRate = Math.round(recurringRate);

  // Build response
  let response = `For a ${bedrooms}-bedroom, ${bathrooms}-bathroom home`;
  if (sqft > 0) {
    response += ` at ${sqft.toLocaleString()} square feet`;
  }

  if (normalizedFrequency !== 'one-time' && normalizedFrequency !== 'once') {
    response += ` with ${frequency} service, your first visit would be $${firstTimeTotal}`;
    if (addOnDetails.length > 0) {
      response += `, including ${addOnDetails.join(' and ')}`;
    }
    response += `. After that, your ${frequency} rate would be around $${recurringRate} per visit with our recurring discount`;
  } else {
    response += `, the total would be $${firstTimeTotal}`;
    if (addOnDetails.length > 0) {
      response += `, including ${addOnDetails.join(' and ')}`;
    }
  }

  response += `. This is an estimate based on standard conditions - the final price may adjust if the property needs extra attention.`;

  return { result: response };
}

// ============================================
// Availability Check Handler
// ============================================

/**
 * Check available appointment slots.
 *
 * @param {Object} args - Function arguments from Retell.
 * @param {string} [args.preferredDate] - Customer's preferred date/timeframe.
 * @returns {Object} Result object with available time slots.
 */
function checkAvailability(args) {
  const { preferredDate } = args;

  const { business, businessTz } = config;

  // Get current time in business timezone
  const now = toZonedTime(new Date(), businessTz);
  const availableSlots = [];

  // Generate slots for next 14 days
  for (let dayOffset = 1; dayOffset <= 14 && availableSlots.length < 4; dayOffset++) {
    const checkDate = addDays(now, dayOffset);
    const dayOfWeek = checkDate.getDay();

    // Skip non-work days
    if (!business.workDays.includes(dayOfWeek)) {
      continue;
    }

    // Add slot times for this day
    for (const slotTime of business.slotTimes) {
      if (availableSlots.length >= 4) break;

      const dayName = format(checkDate, 'EEEE');
      const dateFormatted = format(checkDate, 'MMMM do');

      availableSlots.push({
        day: dayName,
        date: dateFormatted,
        time: formatTimeForSpeech(slotTime),
        iso: format(checkDate, 'yyyy-MM-dd') + 'T' + slotTime,
      });
    }
  }

  // Build response
  let response;
  if (preferredDate) {
    response = `For ${preferredDate}, `;
  } else {
    response = `Looking at our schedule, `;
  }

  if (availableSlots.length === 0) {
    response += `I don't have any available slots in the next two weeks. Would you like me to check further out?`;
  } else if (availableSlots.length === 1) {
    const slot = availableSlots[0];
    response += `I have ${slot.day}, ${slot.date} at ${slot.time} available.`;
  } else {
    const firstSlot = availableSlots[0];
    const otherSlots = availableSlots.slice(1, 3);

    response += `I have ${firstSlot.day}, ${firstSlot.date} at ${firstSlot.time}`;

    for (let i = 0; i < otherSlots.length; i++) {
      const slot = otherSlots[i];
      if (i === otherSlots.length - 1) {
        response += `, or ${slot.day} at ${slot.time}`;
      } else {
        response += `, ${slot.day} at ${slot.time}`;
      }
    }

    response += `. Which works better for you?`;
  }

  return { result: response };
}

/**
 * Format 24-hour time to speech-friendly format.
 * @param {string} time24 - Time in 24-hour format (e.g., "08:00").
 * @returns {string} Speech-friendly time (e.g., "8 AM").
 */
function formatTimeForSpeech(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

  if (minutes === 0) {
    return `${hours12} ${period}`;
  }
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// ============================================
// Appointment Booking Handler
// ============================================

/**
 * Book an appointment and generate confirmation.
 *
 * @param {Object} args - Function arguments from Retell.
 * @param {string} args.date - Appointment date.
 * @param {string} args.time - Appointment time.
 * @param {string} args.customerName - Customer's full name.
 * @param {string} args.address - Service address.
 * @param {string} [args.serviceType] - Type of service.
 * @param {string} [args.estimatedPrice] - Quoted price.
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Object} Result object with confirmation details.
 */
async function bookAppointment(args, metadata = {}) {
  const {
    date,
    time,
    customerName,
    address,
    serviceType = 'House Cleaning',
    estimatedPrice,
  } = args;

  // Generate confirmation number
  const confirmationNumber = generateConfirmationNumber();

  console.log(`[HANDLERS] Booking appointment:`, {
    confirmationNumber,
    date,
    time,
    customerName,
    address,
    serviceType,
  });

  // Store booking in call state if we have a call ID
  if (metadata.callId) {
    try {
      await redis.storeCallState(metadata.callId, {
        booking: {
          confirmationNumber,
          date,
          time,
          customerName,
          address,
          serviceType,
          estimatedPrice,
          bookedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[HANDLERS] Failed to store booking state:', error.message);
    }
  }

  let response = `Perfect! I've booked your ${serviceType.toLowerCase()} appointment for ${date} at ${time}. `;
  response += `Your confirmation number is ${confirmationNumber}. `;
  response += `You'll receive an email confirmation shortly with all the details. `;
  response += `Our team will bring all supplies, and we use eco-friendly products. `;
  response += `Is there anything else I can help you with?`;

  return {
    result: response,
    confirmation_number: confirmationNumber,
  };
}

/**
 * Generate a unique confirmation number.
 * Format: BBK-XXXXXXXX (alphanumeric)
 * @returns {string} Confirmation number.
 */
function generateConfirmationNumber() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BBK-${code}`;
}

// ============================================
// CEO Transfer Handler
// ============================================

/**
 * Initiate transfer to CEO.
 *
 * @param {Object} args - Function arguments from Retell.
 * @param {string} args.reason - Reason for transfer.
 * @param {Object} [metadata] - Call metadata from Retell.
 * @returns {Object} Result object with transfer instructions.
 */
async function transferToCeo(args, metadata = {}) {
  const { reason } = args;

  console.log(`[HANDLERS] Transfer to CEO requested:`, { reason, callId: metadata.callId });

  const ceoPhone = config.business.ceoPhone;

  if (!ceoPhone) {
    return {
      result: "I'm sorry, but the owner isn't available right now. Can I take a message or help you with something else?",
    };
  }

  // Store transfer context
  if (metadata.callId) {
    try {
      await redis.storeCallState(metadata.callId, {
        transferRequested: true,
        transferReason: reason,
        transferRequestedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[HANDLERS] Failed to store transfer state:', error.message);
    }
  }

  return {
    result: 'transfer_initiated',
    transfer_number: ceoPhone,
  };
}

// ============================================
// Function Router
// ============================================

/**
 * Route a function call to the appropriate handler.
 * Supports both legacy inline handlers and new modular handlers.
 *
 * @param {string} functionName - Name of the function to call
 * @param {Object} args - Function arguments
 * @param {Object} [metadata] - Call metadata (call_id, from_number, etc.)
 * @returns {Promise<Object>} Handler result
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
      return calculateQuote(args);

    case 'lookupcustomer':
    case 'lookup':
    case 'getcustomer':
    case 'findcustomer':
    case 'lookupproperty':
      return lookupCustomer(args, metadata);

    case 'checkavailability':
    case 'availability':
    case 'getavailability':
    case 'schedule':
      return checkAvailability(args);

    case 'bookappointment':
    case 'book':
    case 'createappointment':
    case 'createbooking':
      return bookAppointment(args, metadata);

    case 'transfertoceo':
    case 'transfer':
    case 'escalate':
    case 'connectowner':
      return transferToCeo(args, metadata);

    default:
      console.warn(`[Handlers] Unknown function: ${functionName}`);
      return {
        result: `I'm not sure how to help with that. Let me connect you with our team.`,
        success: false,
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
  // Legacy handlers (backward compatible)
  lookupCustomer,
  calculateQuote,
  checkAvailability,
  bookAppointment,
  transferToCeo,

  // New modular handlers (enhanced functionality)
  handleCalculateQuote,
  handleLookupCustomer,
  handleCheckAvailability,
  handleBookAppointment,
  handleTransferToCeo,

  // Function router
  routeFunctionCall,

  // Constants
  TRANSFER_REASONS,
};
