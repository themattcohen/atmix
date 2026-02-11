/**
 * Blue Bucket Server - Phone Utilities
 *
 * Phone number normalization and validation utilities.
 * Converts various formats to E.164 standard (+1XXXXXXXXXX for US/Canada).
 */

/**
 * Regular expressions for phone number patterns.
 */
const PATTERNS = {
  // E.164 format: +1 followed by 10 digits
  E164: /^\+1[2-9]\d{9}$/,

  // 10 digits starting with valid area code (2-9)
  TEN_DIGIT: /^[2-9]\d{9}$/,

  // 11 digits starting with 1 (US country code)
  ELEVEN_DIGIT: /^1[2-9]\d{9}$/,

  // Strip non-digit characters
  NON_DIGIT: /\D/g,
};

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX).
 *
 * Handles common formats:
 * - (303) 555-1234
 * - 303-555-1234
 * - 303.555.1234
 * - 3035551234
 * - 13035551234
 * - +13035551234
 *
 * @param {string} phone - Phone number in any common format.
 * @returns {string|null} E.164 formatted phone number or null if invalid.
 *
 * @example
 * normalizePhone('(303) 555-1234')  // '+13035551234'
 * normalizePhone('303-555-1234')    // '+13035551234'
 * normalizePhone('+13035551234')    // '+13035551234'
 * normalizePhone('123')             // null
 */
function normalizePhone(phone) {
  // Handle null/undefined/empty
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  // Already in E.164 format
  if (PATTERNS.E164.test(trimmed)) {
    return trimmed;
  }

  // Strip all non-digit characters
  const digits = trimmed.replace(PATTERNS.NON_DIGIT, '');

  // Validate digit count and format
  if (digits.length === 10 && PATTERNS.TEN_DIGIT.test(digits)) {
    // 10 digits: add +1 prefix
    return `+1${digits}`;
  }

  if (digits.length === 11 && PATTERNS.ELEVEN_DIGIT.test(digits)) {
    // 11 digits starting with 1: add + prefix
    return `+${digits}`;
  }

  // Invalid phone number
  return null;
}

/**
 * Check if a phone number is valid.
 *
 * @param {string} phone - Phone number to validate.
 * @returns {boolean} True if phone number is valid.
 */
function isValidPhone(phone) {
  return normalizePhone(phone) !== null;
}

/**
 * Format a phone number for display.
 * Converts E.164 to human-readable format.
 *
 * @param {string} phone - Phone number (any format).
 * @returns {string|null} Formatted phone number or null if invalid.
 *
 * @example
 * formatPhoneDisplay('+13035551234')  // '(303) 555-1234'
 * formatPhoneDisplay('3035551234')    // '(303) 555-1234'
 */
function formatPhoneDisplay(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return null;
  }

  // Extract the 10-digit portion (skip +1)
  const digits = normalized.slice(2);

  // Format as (XXX) XXX-XXXX
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Mask a phone number for logging/display.
 * Shows only last 4 digits for privacy.
 *
 * @param {string} phone - Phone number to mask.
 * @returns {string} Masked phone number.
 *
 * @example
 * maskPhone('+13035551234')  // '+1******1234'
 */
function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return '******';
  }

  // Show +1 prefix and last 4 digits, mask middle
  return `${normalized.slice(0, 2)}******${normalized.slice(-4)}`;
}

/**
 * Extract area code from phone number.
 *
 * @param {string} phone - Phone number (any format).
 * @returns {string|null} Three-digit area code or null if invalid.
 *
 * @example
 * getAreaCode('+13035551234')  // '303'
 */
function getAreaCode(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return null;
  }

  // Area code is digits 3-5 (after +1)
  return normalized.slice(2, 5);
}

/**
 * Check if two phone numbers are the same.
 * Normalizes both before comparison.
 *
 * @param {string} phone1 - First phone number.
 * @param {string} phone2 - Second phone number.
 * @returns {boolean} True if phones match after normalization.
 *
 * @example
 * phonesMatch('(303) 555-1234', '+13035551234')  // true
 */
function phonesMatch(phone1, phone2) {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);

  if (!norm1 || !norm2) {
    return false;
  }

  return norm1 === norm2;
}

module.exports = {
  normalizePhone,
  isValidPhone,
  formatPhoneDisplay,
  maskPhone,
  getAreaCode,
  phonesMatch,
};
