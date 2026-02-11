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
// Exports
// ============================================

module.exports = {
  // Schemas
  retellWebhookSchema,
  jobberWebhookSchema,
  jobberWebhookEventSchema,

  // Validation functions
  validatePayload,
  validateRetellPayload,
  validateJobberPayload,

  // Middleware
  validateRetellMiddleware,
  validateJobberMiddleware,
  createValidationMiddleware,
};
