/**
 * Blue Bucket Server - Handler Tests
 * Tests for function handlers without external dependencies.
 */

const assert = require('assert');

// Mock config before importing handlers
process.env.JOBBER_CLIENT_ID = 'test_id';
process.env.JOBBER_CLIENT_SECRET = 'test_secret';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test_token';
process.env.RETELL_WEBHOOK_SECRET = 'test_secret';
process.env.CEO_PHONE = '+13035551234';

const { handleCalculateQuote } = require('../src/handlers/calculateQuote');
const { normalizePhone, isValidPhone, formatPhoneDisplay } = require('../src/utils/phone');

// ============================================
// Phone Utility Tests
// ============================================

console.log('\n=== Phone Utility Tests ===\n');

// Test normalizePhone
const phoneTests = [
  { input: '3035551234', expected: '+13035551234', desc: '10-digit' },
  { input: '13035551234', expected: '+13035551234', desc: '11-digit with 1' },
  { input: '+13035551234', expected: '+13035551234', desc: 'already E.164' },
  { input: '(303) 555-1234', expected: '+13035551234', desc: 'formatted US' },
  { input: '303-555-1234', expected: '+13035551234', desc: 'dashed' },
  { input: '303.555.1234', expected: '+13035551234', desc: 'dotted' },
  { input: '', expected: null, desc: 'empty string' },
  { input: null, expected: null, desc: 'null' },
  { input: '123', expected: null, desc: 'too short' },
];

let passed = 0;
let failed = 0;

phoneTests.forEach(({ input, expected, desc }) => {
  const result = normalizePhone(input);
  if (result === expected) {
    console.log(`  ✓ normalizePhone(${JSON.stringify(input)}) = ${JSON.stringify(result)}`);
    passed++;
  } else {
    console.log(`  ✗ normalizePhone(${JSON.stringify(input)}): expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
    failed++;
  }
});

// Test isValidPhone
const validPhoneTests = [
  { input: '+13035551234', expected: true },
  { input: '3035551234', expected: true },
  { input: '123', expected: false },
  { input: '', expected: false },
];

validPhoneTests.forEach(({ input, expected }) => {
  const result = isValidPhone(input);
  if (result === expected) {
    console.log(`  ✓ isValidPhone(${JSON.stringify(input)}) = ${result}`);
    passed++;
  } else {
    console.log(`  ✗ isValidPhone(${JSON.stringify(input)}): expected ${expected}, got ${result}`);
    failed++;
  }
});

// ============================================
// Calculate Quote Tests
// ============================================

console.log('\n=== Calculate Quote Tests ===\n');

async function testCalculateQuote() {
  // Test 1: Basic quote
  const quote1 = await handleCalculateQuote({
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1800,
    frequency: 'one-time',
  });

  if (quote1.quote && quote1.quote.total > 0) {
    console.log(`  ✓ Basic quote: $${quote1.quote.total}`);
    passed++;
  } else {
    console.log(`  ✗ Basic quote failed:`, quote1);
    failed++;
  }

  // Test 2: Quote with discount
  const quote2 = await handleCalculateQuote({
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1800,
    frequency: 'bi-weekly',
  });

  if (quote2.quote && quote2.quote.discount > 0) {
    console.log(`  ✓ Recurring discount applied: -$${quote2.quote.discount.toFixed(2)}`);
    passed++;
  } else {
    console.log(`  ✗ Recurring discount not applied:`, quote2);
    failed++;
  }

  // Test 3: Quote with add-ons
  const quote3 = await handleCalculateQuote({
    bedrooms: 2,
    bathrooms: 1,
    square_feet: 1200,
    frequency: 'one-time',
    add_ons: ['deep_clean', 'inside_fridge'],
  });

  if (quote3.quote && quote3.quote.add_on_total > 0) {
    console.log(`  ✓ Add-ons calculated: +$${quote3.quote.add_on_total}`);
    passed++;
  } else {
    console.log(`  ✗ Add-ons not calculated:`, quote3);
    failed++;
  }

  // Test 4: Minimum price enforced
  const quote4 = await handleCalculateQuote({
    bedrooms: 1,
    bathrooms: 1,
    square_feet: 500,
    frequency: 'one-time',
  });

  if (quote4.quote && quote4.quote.total >= 100) {
    console.log(`  ✓ Minimum price enforced: $${quote4.quote.total}`);
    passed++;
  } else {
    console.log(`  ✗ Minimum price not enforced:`, quote4);
    failed++;
  }
}

// ============================================
// Run Tests
// ============================================

testCalculateQuote().then(() => {
  console.log('\n=== Test Results ===\n');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
