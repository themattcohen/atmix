/**
 * Blue Bucket Server - Calculate Quote Handler
 *
 * Handles quote calculations for cleaning services based on property details.
 * Uses pricing configuration for accurate estimates with add-ons and discounts.
 */

const config = require('../config');

/**
 * Calculate a cleaning service quote based on property details.
 *
 * Pricing formula:
 * base = basePerBedroom * bedrooms + basePerBathroom * bathrooms + sqft * baseSqftRate
 * total = max(base, minimumPrice) * conditionMultiplier + addOns
 * discount = total * recurringDiscount (for weekly/bi-weekly)
 *
 * @param {Object} params - Quote calculation parameters
 * @param {number} params.bedrooms - Number of bedrooms
 * @param {number} params.bathrooms - Number of bathrooms
 * @param {number} params.square_feet - Property square footage
 * @param {string} [params.frequency='one-time'] - Service frequency: one-time, weekly, bi-weekly, monthly
 * @param {string[]} [params.add_ons=[]] - Array of add-on service codes
 * @param {string} [params.condition='standard'] - Property condition: standard, dirty, veryDirty, extreme
 * @returns {Object} Quote details with breakdown and totals
 *
 * @example
 * const result = await handleCalculateQuote({
 *   bedrooms: 3,
 *   bathrooms: 2,
 *   square_feet: 1800,
 *   frequency: 'bi-weekly',
 *   add_ons: ['deepClean', 'insideFridge'],
 *   condition: 'standard'
 * });
 */
async function handleCalculateQuote({
  bedrooms,
  bathrooms,
  square_feet,
  frequency = 'one-time',
  add_ons = [],
  condition = 'standard',
}) {
  console.log('[CalculateQuote] Calculating quote:', {
    bedrooms,
    bathrooms,
    square_feet,
    frequency,
    add_ons,
    condition,
  });

  try {
    const pricing = config.pricing;

    // Validate inputs
    const beds = Math.max(0, parseInt(bedrooms, 10) || 0);
    const baths = Math.max(0, parseFloat(bathrooms) || 0);
    const sqft = Math.max(0, parseInt(square_feet, 10) || 0);

    if (beds === 0 && baths === 0 && sqft === 0) {
      return {
        success: false,
        error: 'Please provide valid property details (bedrooms, bathrooms, or square footage)',
        message: 'I need some details about the property to calculate a quote. How many bedrooms and bathrooms does it have?',
      };
    }

    // Calculate base price
    const bedroomCost = beds * pricing.basePerBedroom;
    const bathroomCost = baths * pricing.basePerBathroom;
    const sqftCost = sqft * pricing.baseSqftRate;
    let basePrice = bedroomCost + bathroomCost + sqftCost;

    // Apply condition multiplier before minimum price
    const conditionKey = condition.toLowerCase().replace(/[^a-z]/g, '');
    const conditionMultiplier = pricing.conditionMultipliers[conditionKey] || pricing.conditionMultipliers.standard;
    const adjustedBase = Math.max(basePrice * conditionMultiplier, pricing.minimumPrice);

    // Calculate add-ons
    const addOnDetails = [];
    let addOnTotal = 0;

    if (Array.isArray(add_ons)) {
      for (const addOn of add_ons) {
        // Normalize add-on name (handle both camelCase and kebab-case)
        const normalizedAddOn = addOn
          .replace(/-/g, '')
          .replace(/_/g, '')
          .toLowerCase();

        // Find matching add-on in config
        const addOnKey = Object.keys(pricing.addOns).find(
          (key) => key.toLowerCase() === normalizedAddOn
        );

        if (addOnKey && pricing.addOns[addOnKey]) {
          const addOnPrice = pricing.addOns[addOnKey];
          addOnTotal += addOnPrice;
          addOnDetails.push({
            code: addOnKey,
            name: formatAddOnName(addOnKey),
            price: addOnPrice,
          });
        } else {
          console.log(`[CalculateQuote] Unknown add-on: ${addOn}`);
        }
      }
    }

    // Calculate subtotal before discount
    const subtotal = adjustedBase + addOnTotal;

    // Apply frequency discount
    const normalizedFrequency = frequency.toLowerCase().replace(/[^a-z]/g, '');
    let discountPercent = 0;
    let discountReason = null;

    // Weekly and bi-weekly get 10% discount
    if (normalizedFrequency === 'weekly' || normalizedFrequency === 'biweekly') {
      discountPercent = pricing.recurringDiscount;
      discountReason = normalizedFrequency === 'weekly'
        ? 'Weekly service discount'
        : 'Bi-weekly service discount';
    } else if (normalizedFrequency === 'monthly') {
      discountPercent = pricing.recurringDiscount * 0.5; // Half the discount for monthly
      discountReason = 'Monthly service discount';
    }

    const discountAmount = subtotal * discountPercent;
    const total = subtotal - discountAmount;

    // Estimate hours and team size
    // Rough calculation: ~$60/hour, minimum 2 hours
    const estimatedHours = Math.max(2, Math.ceil(total / 60));
    const teamSize = config.business.teamCapacity;

    // Build response
    const quote = {
      base_price: roundToTwo(adjustedBase),
      add_on_total: roundToTwo(addOnTotal),
      discount: roundToTwo(discountAmount),
      discount_reason: discountReason,
      total: roundToTwo(total),
      frequency: formatFrequency(frequency),
      estimated_hours: estimatedHours,
      team_size: teamSize,
    };

    const breakdown = {
      bedroom_cost: roundToTwo(bedroomCost),
      bathroom_cost: roundToTwo(bathroomCost),
      sqft_cost: roundToTwo(sqftCost),
      raw_base: roundToTwo(basePrice),
      condition_multiplier: conditionMultiplier,
      adjusted_base: roundToTwo(adjustedBase),
      add_ons: addOnDetails,
      subtotal: roundToTwo(subtotal),
      discount_percent: discountPercent * 100,
    };

    const notes = buildQuoteNotes(condition, frequency, addOnDetails);

    console.log('[CalculateQuote] Quote calculated:', { total: quote.total, frequency: quote.frequency });

    // Build spoken message for AI agent
    let message = `For a ${beds}-bedroom, ${baths}-bathroom home`;
    if (sqft > 0) {
      message += ` at ${sqft.toLocaleString()} square feet`;
    }
    if (discountReason) {
      message += ` with ${formatFrequency(frequency).toLowerCase()} service, the total would be $${roundToTwo(total)} per visit with our recurring discount`;
    } else {
      message += `, the total would be $${roundToTwo(total)}`;
    }
    if (addOnDetails.length > 0) {
      const addOnNames = addOnDetails.map((a) => a.name.toLowerCase());
      message += `, including ${addOnNames.join(' and ')}`;
    }
    message += `. This is an estimate - the final price may adjust based on property condition.`;

    return {
      success: true,
      data: { quote, breakdown, notes },
      quote,
      breakdown,
      notes,
      message,
    };
  } catch (error) {
    console.error('[CalculateQuote] Error calculating quote:', error.message);
    return {
      success: false,
      error: 'Unable to calculate quote at this time',
      message: 'I\'m having trouble calculating your quote right now. Can you tell me more about the property?',
      details: error.message,
    };
  }
}

/**
 * Round a number to two decimal places.
 * @param {number} num - Number to round
 * @returns {number} Rounded number
 */
function roundToTwo(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Format add-on code to display name.
 * @param {string} code - Add-on code in camelCase
 * @returns {string} Formatted display name
 */
function formatAddOnName(code) {
  const names = {
    deepClean: 'Deep Clean',
    insideOven: 'Inside Oven',
    insideFridge: 'Inside Fridge',
    insideCabinets: 'Inside Cabinets',
    windows: 'Window Cleaning',
    laundry: 'Laundry Service',
    garage: 'Garage Cleaning',
    patio: 'Patio Cleaning',
    moveInOut: 'Move In/Out Clean',
  };
  return names[code] || code.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Format frequency string for display.
 * @param {string} frequency - Raw frequency value
 * @returns {string} Formatted frequency
 */
function formatFrequency(frequency) {
  const formats = {
    'one-time': 'One-Time',
    'onetime': 'One-Time',
    'weekly': 'Weekly',
    'bi-weekly': 'Bi-Weekly',
    'biweekly': 'Bi-Weekly',
    'monthly': 'Monthly',
  };
  const normalized = frequency.toLowerCase().replace(/[^a-z-]/g, '');
  return formats[normalized] || 'One-Time';
}

/**
 * Build quote notes based on conditions and add-ons.
 * @param {string} condition - Property condition
 * @param {string} frequency - Service frequency
 * @param {Array} addOns - Selected add-ons
 * @returns {string[]} Array of note strings
 */
function buildQuoteNotes(condition, frequency, addOns) {
  const notes = [];

  // Standard disclaimer
  notes.push('This is an estimate based on standard conditions.');
  notes.push('Final price may adjust if property needs extra attention.');

  // Condition-specific notes
  if (condition !== 'standard') {
    notes.push(`Quote includes adjustment for ${condition} condition.`);
  }

  // First-time deep clean recommendation
  const hasDeepClean = addOns.some((a) => a.code === 'deepClean');
  if (!hasDeepClean && frequency !== 'one-time') {
    notes.push('We recommend a deep clean for your first visit.');
  }

  // Recurring service note
  if (frequency !== 'one-time' && frequency !== 'onetime') {
    notes.push('Recurring service includes priority scheduling.');
  }

  return notes;
}

module.exports = {
  handleCalculateQuote,
};
