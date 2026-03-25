/**
 * Blue Bucket Server - Payload Validation Utilities
 *
 * JSON schema validation for webhook payloads using Joi.
 * Provides schemas and middleware for validating incoming requests.
 */

const Joi = require('joi');

// ============================================
// Retell Webhook Schemas
// ============================================

/**
 * Schema for Retell webhook payloads.
 *
 * Retell sends function call requests with:
 * - call_id: Unique identifier for the call
 * - function_name: Name of the function to execute
 * - arguments: Object containing function parameters
 * - call_metadata: Optional metadata about the call
 */
const retellWebhookSchema = Joi.object({
  call_id: Joi.string().allow('', null),
  function_name: Joi.string().required().messages({
    'any.required': 'function_name is required',
    'string.empty': 'function_name cannot be empty',
  }),
  arguments: Joi.object().default({}),
  call_metadata: Joi.object().default({}),
}).unknown(true); // Allow additional fields from Retell

// ============================================
// Jobber Webhook Schemas
// ============================================

/**
 * Schema for Jobber webhook payloads.
 *
 * Jobber sends webhook events with:
 * - webHookEvent: Object containing topic and itemId
 * - appId: App identifier (optional)
 * - Additional data varies by event type
 */
const jobberWebhookEventSchema = Joi.object({
  topic: Joi.string().required().messages({
    'any.required': 'webHookEvent.topic is required',
  }),
  itemId: Joi.string().required().messages({
    'any.required': 'webHookEvent.itemId is required',
  }),
  accountId: Joi.string().required().messages({
    'any.required': 'webHookEvent.accountId is required',
  }),
}).unknown(true);

const jobberWebhookSchema = Joi.object({
  webHookEvent: jobberWebhookEventSchema.required().messages({
    'any.required': 'webHookEvent is required',
  }),
  appId: Joi.string().allow('', null),
}).unknown(true); // Allow additional fields for request data

// ============================================
// Validation Functions
// ============================================

/**
 * Validate a payload against a schema.
 *
 * @param {Object} payload - The payload to validate.
 * @param {Joi.Schema} schema - The Joi schema to validate against.
 * @returns {Object} Result with { valid: boolean, error?: string, value?: Object }
 */
function validatePayload(payload, schema) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false, // Report all errors, not just the first
    stripUnknown: false, // Keep unknown fields
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join('; ');
    return {
      valid: false,
      error: errorMessages,
      details: error.details,
    };
  }

  return {
    valid: true,
    value,
  };
}

/**
 * Validate Retell webhook payload.
 *
 * @param {Object} payload - The Retell webhook payload.
 * @returns {Object} Validation result.
 */
function validateRetellPayload(payload) {
  return validatePayload(payload, retellWebhookSchema);
}

/**
 * Validate Jobber webhook payload.
 *
 * @param {Object} payload - The Jobber webhook payload.
 * @returns {Object} Validation result.
 */
function validateJobberPayload(payload) {
  return validatePayload(payload, jobberWebhookSchema);
}

// ============================================
// Express Middleware
// ============================================

/**
 * Create validation middleware for a given schema.
 *
 * @param {Joi.Schema} schema - The Joi schema to validate against.
 * @param {string} source - Source identifier for logging (e.g., 'RETELL', 'JOBBER').
 * @returns {Function} Express middleware function.
 */
function createValidationMiddleware(schema, source) {
  return (req, res, next) => {
    const validation = validatePayload(req.body, schema);

    if (!validation.valid) {
      console.warn(`[${source}] Payload validation failed:`, {
        error: validation.error,
        body: JSON.stringify(req.body).substring(0, 500),
      });

      return res.status(400).json({
        error: 'Invalid payload',
        message: validation.error,
        details: validation.details,
      });
    }

    // Attach validated payload to request
    req.validatedBody = validation.value;
    next();
  };
}

/**
 * Middleware to validate Retell webhook payloads.
 */
const validateRetellMiddleware = createValidationMiddleware(
  retellWebhookSchema,
  'RETELL'
);

/**
 * Middleware to validate Jobber webhook payloads.
 */
const validateJobberMiddleware = createValidationMiddleware(
  jobberWebhookSchema,
  'JOBBER'
);

// ============================================
// Handler Input Schemas
// ============================================

/**
 * Schema for calculateQuote handler input.
 */
const calculateQuoteSchema = Joi.object({
  bedrooms: Joi.number().integer().min(0).max(20).default(0),
  bathrooms: Joi.number().min(0).max(20).default(0),
  square_feet: Joi.number().integer().min(0).max(50000).default(0),
  sqft: Joi.number().integer().min(0).max(50000),
  frequency: Joi.string().valid('one-time', 'weekly', 'bi-weekly', 'biweekly', 'monthly').default('one-time').insensitive(),
  add_ons: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  addOns: Joi.array().items(Joi.string().max(50)).max(10),
  condition: Joi.string().valid('standard', 'dirty', 'veryDirty', 'extreme').default('standard'),
  serviceType: Joi.string().max(100),
  service_type: Joi.string().max(100),
}).unknown(true);

/**
 * Schema for bookAppointment handler input.
 */
const bookAppointmentSchema = Joi.object({
  property_id: Joi.string().required(),
  request_id: Joi.string().allow('', null),
  customer_name: Joi.string().max(200).required(),
  customer_phone: Joi.string().max(30),
  appointment_date: Joi.string().required(),
  appointment_time: Joi.string().required(),
  service_type: Joi.string().max(100).default('House Cleaning'),
  quoted_price: Joi.number().min(0).max(100000),
  estimated_hours: Joi.number().min(1).max(24).default(3),
  special_instructions: Joi.string().max(1000).allow('', null),
  date: Joi.string(),
  time: Joi.string(),
  customerName: Joi.string().max(200),
  address: Joi.string().max(500),
  estimatedPrice: Joi.number(),
}).unknown(true);

/**
 * Schema for checkAvailability handler input.
 */
const checkAvailabilitySchema = Joi.object({
  preferred_date: Joi.string().max(100).allow('', null),
  preferred_time: Joi.string().max(50).allow('', null),
  service_duration_hours: Joi.number().min(1).max(24).default(3),
  preferredDate: Joi.string().max(100),
}).unknown(true);

/**
 * Schema for transferToCeo handler input.
 */
const transferToCeoSchema = Joi.object({
  reason: Joi.string().max(200).required(),
  context_summary: Joi.string().max(2000).allow('', null),
  customer_name: Joi.string().max(200).allow('', null),
  customer_phone: Joi.string().max(30).allow('', null),
  property_details: Joi.string().max(500).allow('', null),
  quoted_price: Joi.number().min(0).max(100000).allow(null),
  urgency: Joi.string().valid('low', 'medium', 'high').default('medium'),
}).unknown(true);

/**
 * Schema for lookupCustomer handler input.
 */
const lookupCustomerSchema = Joi.object({
  phone_number: Joi.string().max(30),
  phone: Joi.string().max(30),
}).unknown(true);

/**
 * Validate handler input against a schema.
 *
 * @param {Object} args - The handler arguments to validate.
 * @param {Joi.Schema} schema - The Joi schema to validate against.
 * @returns {Object} Result with { valid: boolean, value?: Object, error?: string }
 */
function validateHandlerInput(args, schema) {
  const { error, value } = schema.validate(args || {}, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join('; ');
    return {
      valid: false,
      error: errorMessages,
    };
  }

  return {
    valid: true,
    value,
  };
}

// ============================================
// Exports
// ============================================

module.exports = {
  // Webhook schemas
  retellWebhookSchema,
  jobberWebhookSchema,
  jobberWebhookEventSchema,

  // Handler input schemas
  calculateQuoteSchema,
  bookAppointmentSchema,
  checkAvailabilitySchema,
  transferToCeoSchema,
  lookupCustomerSchema,

  // Validation functions
  validatePayload,
  validateRetellPayload,
  validateJobberPayload,
  validateHandlerInput,

  // Middleware
  validateRetellMiddleware,
  validateJobberMiddleware,
  createValidationMiddleware,
};
