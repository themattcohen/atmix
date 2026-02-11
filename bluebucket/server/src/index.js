/**
 * Blue Bucket Server - Main Entry Point
 *
 * Express server handling:
 * - Retell AI voice agent webhook functions
 * - Jobber webhook for REQUEST_CREATE events
 * - Jobber OAuth authorization flow
 * - Health check endpoint
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const redis = require('./redis');
const oauth = require('./jobber/oauth');
const { retellRouter, jobberRouter } = require('./webhooks');
const twilioRouter = require('./webhooks/twilio');
const outboundCaller = require('./services/outboundCaller');

// ============================================
// Initialize Express Application
// ============================================

const app = express();

// ============================================
// Security Middleware
// ============================================

// Helmet for secure HTTP headers
app.use(helmet({
  // Allow webhooks to receive requests from external services
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: config.isDevelopment ? '*' : [
    'https://retellai.com',
    'https://api.retellai.com',
    'https://api.getjobber.com',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: [
    'Content-Type',
    'X-Retell-Signature',
    'X-Jobber-Hmac-SHA256',
    'X-Jobber-Topic',
  ],
}));

// ============================================
// Request Parsing Middleware
// ============================================

// Parse JSON bodies
app.use(express.json({
  limit: '1mb',
  // Store raw body for signature verification
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// Parse URL-encoded bodies (for OAuth)
app.use(express.urlencoded({ extended: true }));

// ============================================
// Logging Middleware
// ============================================

// Morgan request logging
const logFormat = config.isDevelopment
  ? 'dev'
  : ':remote-addr - :method :url :status :response-time ms';

app.use(morgan(logFormat, {
  // Skip health check logging to reduce noise
  skip: (req) => req.url === '/health',
}));

// ============================================
// Rate Limiting for Webhook Endpoints
// ============================================

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res, next, options) => {
    console.warn('[RATE-LIMIT] Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json(options.message);
  },
});

// Apply rate limiting to all webhook routes
app.use('/webhook', webhookLimiter);

// ============================================
// Mount Webhook Routers
// ============================================

app.use(retellRouter);
app.use(jobberRouter);
app.use(twilioRouter);

// ============================================
// OAuth Routes
// ============================================

/**
 * GET /oauth/authorize
 *
 * Initiates Jobber OAuth flow by redirecting to Jobber's authorization page.
 * After user approves, Jobber redirects back to /oauth/callback.
 */
app.get('/oauth/authorize', (req, res) => {
  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);

  // Store state in session/cookie if needed for validation
  // For simplicity, we skip state validation in this demo

  const authUrl = oauth.getAuthorizationUrl(state);

  console.log('[OAUTH] Redirecting to Jobber authorization');
  res.redirect(authUrl);
});

/**
 * GET /oauth/callback
 *
 * OAuth callback endpoint. Exchanges authorization code for tokens
 * and stores them in Redis.
 *
 * Query parameters:
 * - code: Authorization code from Jobber
 * - state: State parameter for CSRF validation
 * - error: Error code if authorization was denied
 */
app.get('/oauth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  // Handle authorization denied
  if (error) {
    console.error('[OAUTH] Authorization denied:', error, error_description);
    return res.status(400).json({
      success: false,
      error: error,
      description: error_description || 'Authorization was denied',
    });
  }

  // Validate code is present
  if (!code) {
    console.error('[OAUTH] No authorization code provided');
    return res.status(400).json({
      success: false,
      error: 'missing_code',
      description: 'No authorization code provided',
    });
  }

  try {
    // Exchange code for tokens
    const tokens = await oauth.exchangeCodeForTokens(code);

    console.log('[OAUTH] Authorization successful');

    // Return success response
    // In production, you might redirect to a dashboard instead
    res.json({
      success: true,
      message: 'Jobber authorization successful',
      expiresIn: tokens.expires_in,
    });
  } catch (error) {
    console.error('[OAUTH] Token exchange failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'token_exchange_failed',
      description: error.message,
    });
  }
});

/**
 * GET /oauth/status
 *
 * Check current OAuth authorization status.
 */
app.get('/oauth/status', async (req, res) => {
  try {
    const status = await oauth.checkAuthorizationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      authorized: false,
      error: error.message,
    });
  }
});

/**
 * POST /oauth/revoke
 *
 * Revoke current OAuth tokens.
 */
app.post('/oauth/revoke', async (req, res) => {
  try {
    await oauth.revokeTokens();
    res.json({
      success: true,
      message: 'Tokens revoked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// Health Check Endpoint
// ============================================

/**
 * GET /health
 *
 * Health check endpoint for load balancers and monitoring.
 * Returns status of server and connected services.
 */
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      redis: 'unknown',
      jobber_token: 'unknown',
      outbound_calling: 'unknown',
    },
  };

  try {
    // Check Redis connectivity
    const isRedisHealthy = await redis.ping();
    health.services.redis = isRedisHealthy ? 'connected' : 'error';

    // Check Jobber token status
    const tokenStatus = await oauth.checkAuthorizationStatus();
    health.services.jobber_token = tokenStatus.authorized ? 'valid' : 'missing';

    // Check outbound calling status
    const outboundStatus = outboundCaller.getStatus();
    health.services.outbound_calling = outboundStatus.enabled && outboundStatus.retellConfigured.isReady && outboundStatus.twilioConfigured.isReady
      ? 'ready'
      : outboundStatus.enabled
        ? 'not_configured'
        : 'disabled';

    // If Redis is down, mark as degraded
    if (!isRedisHealthy) {
      health.status = 'degraded';
    }
  } catch (error) {
    console.error('[HEALTH] Health check error:', error.message);
    health.status = 'degraded';
    health.error = error.message;
  }

  // Return 200 even for degraded status (for load balancer compatibility)
  res.json(health);
});

// ============================================
// Error Handling Middleware
// ============================================

/**
 * 404 Not Found handler.
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Global error handler.
 */
app.use((error, req, res, next) => {
  console.error('[ERROR] Unhandled error:', {
    message: error.message,
    stack: config.isDevelopment ? error.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: config.isDevelopment ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Server Startup
// ============================================

/**
 * Start the HTTP server.
 */
function startServer() {
  // Validate configuration
  config.validateConfig();

  const port = config.port;

  app.listen(port, () => {
    const outboundStatus = outboundCaller.getStatus();

    console.log('');
    console.log('='.repeat(50));
    console.log('  Blue Bucket Voice Agent Server');
    console.log('='.repeat(50));
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Port:        ${port}`);
    console.log(`  Timezone:    ${config.businessTz}`);
    console.log('');
    console.log('  Endpoints:');
    console.log(`    POST /webhook/retell             - Retell AI functions`);
    console.log(`    POST /webhook/jobber             - Jobber webhooks`);
    console.log(`    ALL  /webhook/twilio-connect-retell - Twilio-Retell SIP bridge`);
    console.log(`    POST /webhook/call-status        - Call status updates`);
    console.log(`    GET  /oauth/authorize            - Start OAuth flow`);
    console.log(`    GET  /oauth/callback             - OAuth callback`);
    console.log(`    GET  /oauth/status               - Check OAuth status`);
    console.log(`    GET  /health                     - Health check`);
    console.log('');
    console.log('  Configuration:');
    console.log(`    Jobber Client ID: ${config.jobber.clientId ? 'configured' : 'NOT SET'}`);
    console.log(`    Redis URL:        ${config.redis.url ? 'configured' : 'NOT SET'}`);
    console.log(`    Retell Secret:    ${config.retell.webhookSecret ? 'configured' : 'NOT SET'}`);
    console.log('');
    console.log('  Outbound Calling:');
    console.log(`    Enabled:     ${outboundStatus.enabled ? 'YES' : 'NO'}`);
    console.log(`    Retell API:  ${outboundStatus.retellConfigured.isReady ? 'configured' : 'NOT SET'}`);
    console.log(`    Twilio:      ${outboundStatus.twilioConfigured.isReady ? 'configured' : 'NOT SET'}`);
    console.log(`    Call Delay:  ${outboundStatus.callDelay}s`);
    console.log(`    Call Hours:  ${outboundStatus.callingHours.start}:00 - ${outboundStatus.callingHours.end}:00 ${outboundStatus.callingHours.timezone}`);
    console.log('='.repeat(50));
    console.log('');
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, startServer };
