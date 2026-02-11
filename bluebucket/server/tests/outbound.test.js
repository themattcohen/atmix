/**
 * Blue Bucket Server - Outbound Calling Tests
 * Tests for the outbound calling service and related components.
 */

// Mock config before importing modules
process.env.JOBBER_CLIENT_ID = 'test_id';
process.env.JOBBER_CLIENT_SECRET = 'test_secret';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test_token';
process.env.RETELL_WEBHOOK_SECRET = 'test_secret';
process.env.RETELL_API_KEY = 'test_retell_api_key';
process.env.RETELL_AGENT_ID = 'test_agent_id';
process.env.TWILIO_ACCOUNT_SID = 'test_twilio_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_twilio_token';
process.env.TWILIO_PHONE_NUMBER = '+17201234567';
process.env.WEBHOOK_URL = 'https://test.example.com';
process.env.CEO_PHONE = '+13035551234';
process.env.BUSINESS_TZ = 'America/Denver';
process.env.OUTBOUND_CALLING_ENABLED = 'true';
process.env.OUTBOUND_CALL_DELAY = '5'; // Short delay for testing

// Mock date-fns-tz to handle v2/v3 API differences
jest.mock('date-fns-tz', () => ({
  toZonedTime: jest.fn((date) => date),
  fromZonedTime: jest.fn((date) => date),
  formatInTimeZone: jest.fn(() => '2026-02-11 10:00 AM MST'),
}));

// Mock Redis to avoid real connections
jest.mock('../src/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(false),
  ping: jest.fn().mockResolvedValue(true),
  storePhoneMapping: jest.fn().mockResolvedValue('OK'),
  getPhoneMapping: jest.fn().mockResolvedValue(null),
  deletePhoneMapping: jest.fn().mockResolvedValue(1),
  storeTokens: jest.fn().mockResolvedValue('OK'),
  getTokens: jest.fn().mockResolvedValue(null),
  deleteTokens: jest.fn().mockResolvedValue(1),
  storeCallState: jest.fn().mockResolvedValue('OK'),
  getCallState: jest.fn().mockResolvedValue(null),
  deleteCallState: jest.fn().mockResolvedValue(1),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  KEYS: { PHONE_MAPPING: 'phone:', TOKENS: 'jobber:tokens', CALL_STATE: 'call:' },
}));

const config = require('../src/config');
const twilioClient = require('../src/twilio/client');

// ============================================
// Configuration Tests
// ============================================

describe('Configuration', () => {
  test('Retell API key loaded correctly', () => {
    expect(config.retell.apiKey).toBe('test_retell_api_key');
  });

  test('Retell agent ID loaded correctly', () => {
    expect(config.retell.agentId).toBe('test_agent_id');
  });

  test('Twilio account SID loaded correctly', () => {
    expect(config.twilio.accountSid).toBe('test_twilio_sid');
  });

  test('Twilio phone number loaded correctly', () => {
    expect(config.twilio.phoneNumber).toBe('+17201234567');
  });

  test('Webhook URL loaded correctly', () => {
    expect(config.webhookUrl).toBe('https://test.example.com');
  });

  test('Outbound calling enabled', () => {
    expect(config.outboundCalling.enabled).toBe(true);
  });

  test('Call delay configured (5s)', () => {
    expect(config.outboundCalling.callDelay).toBe(5);
  });

  test('SIP domain configured correctly', () => {
    expect(config.retell.sipDomain).toBe('5t4n6j0wnrl.sip.livekit.cloud');
  });
});

// ============================================
// TwiML Generation Tests
// ============================================

describe('TwiML Generation', () => {
  const testCallId = 'call_test_12345';
  let twiml;

  beforeAll(() => {
    twiml = twilioClient.generateRetellConnectTwiML(testCallId);
  });

  test('has XML declaration', () => {
    expect(twiml).toContain('<?xml version="1.0"');
  });

  test('has Response element', () => {
    expect(twiml).toContain('<Response>');
    expect(twiml).toContain('</Response>');
  });

  test('has Dial element', () => {
    expect(twiml).toContain('<Dial>');
    expect(twiml).toContain('</Dial>');
  });

  test('has correct SIP endpoint', () => {
    const expectedSip = `sip:${testCallId}@${config.retell.sipDomain}`;
    expect(twiml).toContain(expectedSip);
  });
});

// ============================================
// Configuration Check Tests
// ============================================

describe('Configuration Checks', () => {
  test('Twilio configuration check passes', () => {
    const twilioConfig = twilioClient.checkConfiguration();
    expect(twilioConfig.accountSid).toBe(true);
    expect(twilioConfig.authToken).toBe(true);
    expect(twilioConfig.phoneNumber).toBe(true);
  });

  test('Twilio is ready', () => {
    const twilioConfig = twilioClient.checkConfiguration();
    expect(twilioConfig.isReady).toBe(true);
  });
});

// ============================================
// Outbound Caller Service Tests
// ============================================

describe('Outbound Caller Service', () => {
  const outboundCaller = require('../src/services/outboundCaller');

  test('reports enabled', async () => {
    const status = await outboundCaller.getStatus();
    expect(status.enabled).toBe(true);
  });

  test('has calling hours configured', async () => {
    const status = await outboundCaller.getStatus();
    expect(status.callingHours).toBeDefined();
    expect(status.callingHours.start).toBeDefined();
    expect(status.callingHours.end).toBeDefined();
  });

  test('has rate limit configured', async () => {
    const status = await outboundCaller.getStatus();
    expect(status.rateLimit).toBeDefined();
    expect(typeof status.rateLimit.max).toBe('number');
  });

  test('isWithinCallingHours function exists', () => {
    expect(typeof outboundCaller.isWithinCallingHours).toBe('function');
  });

  test('triggerLeadCall function exists', () => {
    expect(typeof outboundCaller.triggerLeadCall).toBe('function');
  });

  test('scheduleCall function exists', () => {
    expect(typeof outboundCaller.scheduleCall).toBe('function');
  });
});
