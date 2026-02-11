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

const config = require('../src/config');
const twilioClient = require('../src/twilio/client');

// ============================================
// Configuration Tests
// ============================================

console.log('\n=== Configuration Tests ===\n');

let passed = 0;
let failed = 0;

// Test 1: Retell config loaded
if (config.retell.apiKey === 'test_retell_api_key') {
  console.log('  ✓ Retell API key loaded correctly');
  passed++;
} else {
  console.log('  ✗ Retell API key not loaded');
  failed++;
}

// Test 2: Retell agent ID loaded
if (config.retell.agentId === 'test_agent_id') {
  console.log('  ✓ Retell agent ID loaded correctly');
  passed++;
} else {
  console.log('  ✗ Retell agent ID not loaded');
  failed++;
}

// Test 3: Twilio config loaded
if (config.twilio.accountSid === 'test_twilio_sid') {
  console.log('  ✓ Twilio account SID loaded correctly');
  passed++;
} else {
  console.log('  ✗ Twilio account SID not loaded');
  failed++;
}

// Test 4: Twilio phone number loaded
if (config.twilio.phoneNumber === '+17201234567') {
  console.log('  ✓ Twilio phone number loaded correctly');
  passed++;
} else {
  console.log('  ✗ Twilio phone number not loaded');
  failed++;
}

// Test 5: Webhook URL loaded
if (config.webhookUrl === 'https://test.example.com') {
  console.log('  ✓ Webhook URL loaded correctly');
  passed++;
} else {
  console.log('  ✗ Webhook URL not loaded');
  failed++;
}

// Test 6: Outbound calling enabled
if (config.outboundCalling.enabled === true) {
  console.log('  ✓ Outbound calling enabled');
  passed++;
} else {
  console.log('  ✗ Outbound calling not enabled');
  failed++;
}

// Test 7: Call delay configured
if (config.outboundCalling.callDelay === 5) {
  console.log('  ✓ Call delay configured (5s)');
  passed++;
} else {
  console.log(`  ✗ Call delay unexpected: ${config.outboundCalling.callDelay}`);
  failed++;
}

// Test 8: SIP domain configured
if (config.retell.sipDomain === '5t4n6j0wnrl.sip.livekit.cloud') {
  console.log('  ✓ SIP domain configured correctly');
  passed++;
} else {
  console.log('  ✗ SIP domain not configured');
  failed++;
}

// ============================================
// TwiML Generation Tests
// ============================================

console.log('\n=== TwiML Generation Tests ===\n');

// Test 9: TwiML generation
const testCallId = 'call_test_12345';
const twiml = twilioClient.generateRetellConnectTwiML(testCallId);

if (twiml.includes('<?xml version="1.0"')) {
  console.log('  ✓ TwiML has XML declaration');
  passed++;
} else {
  console.log('  ✗ TwiML missing XML declaration');
  failed++;
}

// Test 10: TwiML has Response element
if (twiml.includes('<Response>') && twiml.includes('</Response>')) {
  console.log('  ✓ TwiML has Response element');
  passed++;
} else {
  console.log('  ✗ TwiML missing Response element');
  failed++;
}

// Test 11: TwiML has Dial element
if (twiml.includes('<Dial>') && twiml.includes('</Dial>')) {
  console.log('  ✓ TwiML has Dial element');
  passed++;
} else {
  console.log('  ✗ TwiML missing Dial element');
  failed++;
}

// Test 12: TwiML has correct SIP endpoint
const expectedSip = `sip:${testCallId}@${config.retell.sipDomain}`;
if (twiml.includes(expectedSip)) {
  console.log('  ✓ TwiML has correct SIP endpoint');
  passed++;
} else {
  console.log('  ✗ TwiML has incorrect SIP endpoint');
  console.log(`    Expected: ${expectedSip}`);
  failed++;
}

// ============================================
// Configuration Check Tests
// ============================================

console.log('\n=== Configuration Check Tests ===\n');

// Test 13: Twilio configuration check
const twilioConfig = twilioClient.checkConfiguration();
if (twilioConfig.accountSid === true && twilioConfig.authToken === true && twilioConfig.phoneNumber === true) {
  console.log('  ✓ Twilio configuration check passes');
  passed++;
} else {
  console.log('  ✗ Twilio configuration check failed:', twilioConfig);
  failed++;
}

// Test 14: Twilio ready status
if (twilioConfig.isReady === true) {
  console.log('  ✓ Twilio is ready');
  passed++;
} else {
  console.log('  ✗ Twilio not ready');
  failed++;
}

// ============================================
// Outbound Caller Service Tests
// ============================================

console.log('\n=== Outbound Caller Service Tests ===\n');

// Import after config is set
const outboundCaller = require('../src/services/outboundCaller');

// Test 15: Get status
const status = outboundCaller.getStatus();
if (status.enabled === true) {
  console.log('  ✓ Outbound caller reports enabled');
  passed++;
} else {
  console.log('  ✗ Outbound caller reports disabled');
  failed++;
}

// Test 16: Status has calling hours
if (status.callingHours && status.callingHours.start && status.callingHours.end) {
  console.log(`  ✓ Calling hours configured (${status.callingHours.start}:00 - ${status.callingHours.end}:00)`);
  passed++;
} else {
  console.log('  ✗ Calling hours not configured');
  failed++;
}

// Test 17: Status has rate limit
if (status.rateLimit && typeof status.rateLimit.max === 'number') {
  console.log(`  ✓ Rate limit configured (${status.rateLimit.max} calls/hour)`);
  passed++;
} else {
  console.log('  ✗ Rate limit not configured');
  failed++;
}

// Test 18: isWithinCallingHours function exists
if (typeof outboundCaller.isWithinCallingHours === 'function') {
  console.log('  ✓ isWithinCallingHours function exists');
  passed++;
} else {
  console.log('  ✗ isWithinCallingHours function missing');
  failed++;
}

// Test 19: triggerLeadCall function exists
if (typeof outboundCaller.triggerLeadCall === 'function') {
  console.log('  ✓ triggerLeadCall function exists');
  passed++;
} else {
  console.log('  ✗ triggerLeadCall function missing');
  failed++;
}

// Test 20: scheduleCall function exists
if (typeof outboundCaller.scheduleCall === 'function') {
  console.log('  ✓ scheduleCall function exists');
  passed++;
} else {
  console.log('  ✗ scheduleCall function missing');
  failed++;
}

// ============================================
// Summary
// ============================================

console.log('\n=== Test Results ===\n');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log('');

if (failed > 0) {
  process.exit(1);
}
