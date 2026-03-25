/**
 * Blue Bucket Server - Handler Tests
 * Tests for function handlers without external dependencies.
 */

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

describe('Phone Utilities', () => {
  describe('normalizePhone', () => {
    const cases = [
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

    test.each(cases)('$desc: normalizePhone($input) = $expected', ({ input, expected }) => {
      expect(normalizePhone(input)).toBe(expected);
    });
  });

  describe('isValidPhone', () => {
    const cases = [
      { input: '+13035551234', expected: true },
      { input: '3035551234', expected: true },
      { input: '123', expected: false },
      { input: '', expected: false },
    ];

    test.each(cases)('isValidPhone(%s) = %s', ({ input, expected }) => {
      expect(isValidPhone(input)).toBe(expected);
    });
  });
});

// ============================================
// Calculate Quote Tests
// ============================================

describe('Calculate Quote', () => {
  test('basic quote returns a positive total', async () => {
    const result = await handleCalculateQuote({
      bedrooms: 3,
      bathrooms: 2,
      square_feet: 1800,
      frequency: 'one-time',
    });

    expect(result.quote).toBeDefined();
    expect(result.quote.total).toBeGreaterThan(0);
  });

  test('recurring frequency applies a discount', async () => {
    const result = await handleCalculateQuote({
      bedrooms: 3,
      bathrooms: 2,
      square_feet: 1800,
      frequency: 'bi-weekly',
    });

    expect(result.quote).toBeDefined();
    expect(result.quote.discount).toBeGreaterThan(0);
  });

  test('add-ons are calculated', async () => {
    const result = await handleCalculateQuote({
      bedrooms: 2,
      bathrooms: 1,
      square_feet: 1200,
      frequency: 'one-time',
      add_ons: ['deep_clean', 'inside_fridge'],
    });

    expect(result.quote).toBeDefined();
    expect(result.quote.add_on_total).toBeGreaterThan(0);
  });

  test('minimum price is enforced', async () => {
    const result = await handleCalculateQuote({
      bedrooms: 1,
      bathrooms: 1,
      square_feet: 500,
      frequency: 'one-time',
    });

    expect(result.quote).toBeDefined();
    expect(result.quote.total).toBeGreaterThanOrEqual(100);
  });
});
