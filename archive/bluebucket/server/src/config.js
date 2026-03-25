/**
 * Blue Bucket Server - Configuration Module
 *
 * Centralized configuration management with environment variable validation.
 * Supports development fallbacks while enforcing production requirements.
 */

require('dotenv').config();

/**
 * Required environment variables by category.
 * Missing required vars will warn in dev, exit in prod.
 */
const REQUIRED_VARS = {
  core: ['JOBBER_CLIENT_ID', 'JOBBER_CLIENT_SECRET'],
  redis: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  security: ['RETELL_WEBHOOK_SECRET'],
};

/**
 * Optional but recommended environment variables.
 * Missing vars log warnings but never block startup.
 */
const RECOMMENDED_VARS = {
  outbound: ['RETELL_API_KEY', 'RETELL_AGENT_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
};

/**
 * Parse work days string into array of day numbers.
 * Default: Monday-Friday (1-5)
 * Format: comma-separated day numbers (0=Sunday, 6=Saturday)
 */
function parseWorkDays(envValue) {
  if (!envValue) {
    return [1, 2, 3, 4, 5]; // Mon-Fri
  }
  return envValue.split(',').map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
}

/**
 * Parse slot times from environment or use defaults.
 * Format: comma-separated 24-hour times
 */
function parseSlotTimes(envValue) {
  if (!envValue) {
    return ['08:00', '10:00', '13:00', '15:00'];
  }
  return envValue.split(',').map((t) => t.trim());
}

/**
 * Configuration object with all application settings.
 */
const config = {
  // Server settings
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // Timezone for business operations
  businessTz: process.env.BUSINESS_TZ || 'America/Denver',

  // Jobber OAuth and API configuration
  jobber: {
    clientId: process.env.JOBBER_CLIENT_ID || '',
    clientSecret: process.env.JOBBER_CLIENT_SECRET || '',
    redirectUri: process.env.JOBBER_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
    apiUrl: process.env.JOBBER_API_URL || 'https://api.getjobber.com/api/graphql',
    tokenUrl: 'https://api.getjobber.com/api/oauth/token',
    authUrl: 'https://api.getjobber.com/api/oauth/authorize',
    apiVersion: '2025-04-16',
  },

  // Upstash Redis configuration
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },

  // Retell configuration
  retell: {
    webhookSecret: process.env.RETELL_WEBHOOK_SECRET || '',
    apiKey: process.env.RETELL_API_KEY || '',
    agentId: process.env.RETELL_AGENT_ID || '',
    sipDomain: process.env.RETELL_SIP_DOMAIN || '5t4n6j0wnrl.sip.livekit.cloud',
  },

  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // Webhook URL for callbacks (ngrok in dev, production URL in prod)
  webhookUrl: process.env.WEBHOOK_URL || '',

  // Outbound calling configuration
  outboundCalling: {
    enabled: process.env.OUTBOUND_CALLING_ENABLED !== 'false',
    // Delay before calling (in seconds) - gives lead time to settle in
    callDelay: parseInt(process.env.OUTBOUND_CALL_DELAY, 10) || 30,
    // Maximum calls per hour to prevent abuse
    maxCallsPerHour: parseInt(process.env.MAX_CALLS_PER_HOUR, 10) || 50,
    // Retry configuration
    maxRetries: parseInt(process.env.OUTBOUND_MAX_RETRIES, 10) || 2,
    retryDelay: parseInt(process.env.OUTBOUND_RETRY_DELAY, 10) || 300, // 5 minutes
    // Working hours for outbound calls (don't call too early/late)
    startHour: parseInt(process.env.OUTBOUND_START_HOUR, 10) || 9, // 9 AM
    endHour: parseInt(process.env.OUTBOUND_END_HOUR, 10) || 20, // 8 PM
  },

  // Business operations configuration
  business: {
    ceoPhone: process.env.CEO_PHONE || '',
    teamCapacity: parseInt(process.env.TEAM_CAPACITY, 10) || 2,
    hoursStart: process.env.BUSINESS_HOURS_START || '08:00',
    hoursEnd: process.env.BUSINESS_HOURS_END || '18:00',
    workDays: parseWorkDays(process.env.WORK_DAYS),
    slotTimes: parseSlotTimes(process.env.SLOT_TIMES),
  },

  // Pricing configuration for cleaning services
  pricing: {
    basePerBedroom: parseFloat(process.env.PRICE_PER_BEDROOM) || 35,
    basePerBathroom: parseFloat(process.env.PRICE_PER_BATHROOM) || 25,
    baseSqftRate: parseFloat(process.env.PRICE_SQFT_RATE) || 0.05,
    minimumPrice: parseFloat(process.env.PRICE_MINIMUM) || 100,
    recurringDiscount: parseFloat(process.env.RECURRING_DISCOUNT) || 0.10,
    addOns: {
      deepClean: parseFloat(process.env.ADDON_DEEP_CLEAN) || 75,
      insideOven: parseFloat(process.env.ADDON_INSIDE_OVEN) || 35,
      insideFridge: parseFloat(process.env.ADDON_INSIDE_FRIDGE) || 25,
      insideCabinets: parseFloat(process.env.ADDON_INSIDE_CABINETS) || 50,
      windows: parseFloat(process.env.ADDON_WINDOWS) || 5, // per window
      laundry: parseFloat(process.env.ADDON_LAUNDRY) || 25,
      garage: parseFloat(process.env.ADDON_GARAGE) || 40,
      patio: parseFloat(process.env.ADDON_PATIO) || 30,
      moveInOut: parseFloat(process.env.ADDON_MOVE_IN_OUT) || 100,
    },
    conditionMultipliers: {
      standard: 1.0,
      dirty: 1.25,
      veryDirty: 1.5,
      extreme: 2.0,
    },
  },

  // Phone mapping TTL (90 days in seconds)
  phoneMappingTtl: parseInt(process.env.PHONE_MAPPING_TTL, 10) || 90 * 24 * 60 * 60,

  // Token storage TTL (slightly less than actual expiry for safety)
  tokenTtl: parseInt(process.env.TOKEN_TTL, 10) || 3500, // ~58 minutes for hourly tokens
};

/**
 * Validates required configuration variables and config values.
 * In development: logs warnings for missing vars.
 * In production: exits process if required vars are missing.
 *
 * @returns {boolean} True if all required vars are present and values are valid.
 */
function validateConfig() {
  const missing = [];
  const invalid = [];

  // Check required environment variables
  for (const [category, vars] of Object.entries(REQUIRED_VARS)) {
    for (const varName of vars) {
      if (!process.env[varName]) {
        missing.push({ category, varName });
      }
    }
  }

  // Check recommended (optional) environment variables
  const missingRecommended = [];
  for (const [category, vars] of Object.entries(RECOMMENDED_VARS)) {
    for (const varName of vars) {
      if (!process.env[varName]) {
        missingRecommended.push({ category, varName });
      }
    }
  }

  if (missingRecommended.length > 0) {
    const recMessage = missingRecommended
      .map(({ category, varName }) => `  - ${varName} (${category})`)
      .join('\n');
    console.warn('[CONFIG] Recommended environment variables not set (some features may be limited):\n' + recMessage);
  }

  // Validate config values
  if (config.port < 1 || config.port > 65535 || isNaN(config.port)) {
    invalid.push('PORT must be a number between 1 and 65535');
  }

  // Validate timezone by attempting to use it
  try {
    Intl.DateTimeFormat(undefined, { timeZone: config.businessTz });
  } catch {
    invalid.push(`BUSINESS_TZ "${config.businessTz}" is not a valid timezone`);
  }

  // Validate outbound calling hours
  const { startHour, endHour } = config.outboundCalling;
  if (startHour < 0 || startHour > 23 || isNaN(startHour)) {
    invalid.push('OUTBOUND_START_HOUR must be between 0 and 23');
  }
  if (endHour < 0 || endHour > 23 || isNaN(endHour)) {
    invalid.push('OUTBOUND_END_HOUR must be between 0 and 23');
  }
  if (startHour >= endHour) {
    invalid.push(`OUTBOUND_START_HOUR (${startHour}) must be less than OUTBOUND_END_HOUR (${endHour})`);
  }

  // Validate team capacity
  if (config.business.teamCapacity <= 0 || isNaN(config.business.teamCapacity)) {
    invalid.push('TEAM_CAPACITY must be greater than 0');
  }

  // Validate pricing values
  if (config.pricing.basePerBedroom <= 0) {
    invalid.push('PRICE_PER_BEDROOM must be greater than 0');
  }
  if (config.pricing.basePerBathroom <= 0) {
    invalid.push('PRICE_PER_BATHROOM must be greater than 0');
  }
  if (config.pricing.baseSqftRate <= 0) {
    invalid.push('PRICE_SQFT_RATE must be greater than 0');
  }
  if (config.pricing.minimumPrice <= 0) {
    invalid.push('PRICE_MINIMUM must be greater than 0');
  }

  // Report invalid values
  if (invalid.length > 0) {
    const invalidMessage = invalid.map(msg => `  - ${msg}`).join('\n');
    if (config.isProduction) {
      console.error('[CONFIG] FATAL: Invalid configuration values:\n' + invalidMessage);
      process.exit(1);
    } else {
      console.warn('[CONFIG] WARNING: Invalid configuration values:\n' + invalidMessage);
    }
  }

  // Report missing required vars
  if (missing.length > 0) {
    const message = missing
      .map(({ category, varName }) => `  - ${varName} (${category})`)
      .join('\n');

    if (config.isProduction) {
      console.error('[CONFIG] FATAL: Missing required environment variables:\n' + message);
      console.error('[CONFIG] Server cannot start in production without these variables.');
      process.exit(1);
    } else {
      console.warn('[CONFIG] WARNING: Missing environment variables (not enforced in development):\n' + message);
      console.warn('[CONFIG] Some features may not work correctly.');
    }

    return false;
  }

  return invalid.length === 0;
}

/**
 * Returns a sanitized config object safe for logging.
 * Redacts sensitive values like secrets and tokens.
 *
 * @returns {Object} Config object with sensitive values redacted.
 */
function getSafeConfig() {
  return {
    port: config.port,
    nodeEnv: config.nodeEnv,
    businessTz: config.businessTz,
    jobber: {
      clientId: config.jobber.clientId ? '[SET]' : '[NOT SET]',
      clientSecret: config.jobber.clientSecret ? '[REDACTED]' : '[NOT SET]',
      redirectUri: config.jobber.redirectUri,
      apiUrl: config.jobber.apiUrl,
      apiVersion: config.jobber.apiVersion,
    },
    redis: {
      url: config.redis.url ? '[SET]' : '[NOT SET]',
      token: config.redis.token ? '[REDACTED]' : '[NOT SET]',
    },
    retell: {
      webhookSecret: config.retell.webhookSecret ? '[REDACTED]' : '[NOT SET]',
      apiKey: config.retell.apiKey ? '[SET]' : '[NOT SET]',
      agentId: config.retell.agentId ? '[SET]' : '[NOT SET]',
      sipDomain: config.retell.sipDomain,
    },
    twilio: {
      accountSid: config.twilio.accountSid ? '[SET]' : '[NOT SET]',
      authToken: config.twilio.authToken ? '[REDACTED]' : '[NOT SET]',
      phoneNumber: config.twilio.phoneNumber ? '[SET]' : '[NOT SET]',
    },
    webhookUrl: config.webhookUrl || '[NOT SET]',
    outboundCalling: config.outboundCalling,
    business: config.business,
    pricing: config.pricing,
    phoneMappingTtl: config.phoneMappingTtl,
  };
}

module.exports = {
  ...config,
  validateConfig,
  getSafeConfig,
};
