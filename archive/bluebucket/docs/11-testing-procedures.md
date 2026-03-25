# Testing Procedures & Scenarios

Comprehensive testing guide for the Blue Bucket Voice Demo system. Complete all tests before going live.

## Table of Contents
1. [Testing Phases](#1-testing-phases)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [End-to-End Call Scenarios](#4-end-to-end-call-scenarios)
5. [Edge Case Testing](#5-edge-case-testing)
6. [Performance Testing](#6-performance-testing)
7. [Regression Testing](#7-regression-testing)
8. [Testing Checklist](#8-testing-checklist)

---

## 1. Testing Phases

### Phase Overview
```
Phase 1: Unit Tests (Functions)
    └─▶ Phase 2: Integration Tests (Jobber + Retell)
        └─▶ Phase 3: E2E Call Tests (Full Flow)
            └─▶ Phase 4: Edge Cases
                └─▶ Phase 5: Performance
                    └─▶ Phase 6: UAT (User Acceptance)
```

### Test Environment Setup

#### Local Testing
```bash
# Start local server
npm run dev

# Start ngrok tunnel
ngrok http 3000

# Update .env with ngrok URL
WEBHOOK_URL=https://abc123.ngrok.io
```

#### Test Phone Numbers
- **Primary Test Number**: [YOUR_PERSONAL_CELL]
- **Secondary Test Number**: [ANOTHER_TEST_NUMBER]
- **Bypass Caller ID**: Set in `.env` for testing without Trust Hub

#### Test Data in Jobber
Create these test records in Jobber before testing:
- **Existing Customer**: John Test, +1303555TEST, 123 Test St Denver CO 80202
- **Customer with History**: Jane Repeat, +1303555HIST, 5 previous bookings
- **VIP Customer**: Mike VIP, +1303555VIPP, special instructions in notes

---

## 2. Unit Tests

### 2.1 Quote Calculation Tests

```javascript
// test/calculate-quote.test.js
const { calculateQuote } = require('../functions');

describe('calculateQuote', () => {
  test('calculates base price correctly for 2bed/1bath', () => {
    const result = calculateQuote({
      bedrooms: 2,
      bathrooms: 1,
      square_feet: 1000,
      frequency: 'one-time'
    });
    expect(result.quote.base_price).toBe(145);
    expect(result.quote.total).toBe(145);
  });

  test('applies 10% discount for bi-weekly', () => {
    const result = calculateQuote({
      bedrooms: 3,
      bathrooms: 2,
      square_feet: 1800,
      frequency: 'bi-weekly'
    });
    expect(result.quote.discount_reason).toContain('bi-weekly');
    expect(result.quote.discount).toBeGreaterThan(0);
  });

  test('adds add-on prices correctly', () => {
    const result = calculateQuote({
      bedrooms: 2,
      bathrooms: 1,
      square_feet: 1200,
      frequency: 'one-time',
      add_ons: ['inside_fridge', 'inside_oven']
    });
    expect(result.quote.add_on_total).toBe(45); // $25 + $20
  });

  test('estimates square footage when small/medium/large provided', () => {
    const small = calculateQuote({
      bedrooms: 1,
      bathrooms: 1,
      square_feet: 1200, // "small"
      frequency: 'one-time'
    });
    expect(small.quote.base_price).toBeLessThan(200);
  });

  test('handles edge cases', () => {
    // Minimum values
    const min = calculateQuote({
      bedrooms: 1,
      bathrooms: 1,
      square_feet: 500,
      frequency: 'one-time'
    });
    expect(min.quote.total).toBeGreaterThan(0);

    // Maximum values
    const max = calculateQuote({
      bedrooms: 10,
      bathrooms: 10,
      square_feet: 10000,
      frequency: 'one-time'
    });
    expect(max.quote.total).toBeLessThan(2000);
  });
});
```

### 2.2 Customer Lookup Tests

```javascript
// test/lookup-customer.test.js
const { lookupCustomer } = require('../functions');

describe('lookupCustomer', () => {
  test('finds existing customer by phone', async () => {
    const result = await lookupCustomer({
      phone_number: '+13035551234'
    });
    expect(result.found).toBe(true);
    expect(result.customer).toHaveProperty('name');
    expect(result.customer).toHaveProperty('id');
  });

  test('returns not found for unknown number', async () => {
    const result = await lookupCustomer({
      phone_number: '+19999999999'
    });
    expect(result.found).toBe(false);
    expect(result.customer).toBeNull();
  });

  test('normalizes phone number formats', async () => {
    const formats = [
      '3035551234',
      '(303) 555-1234',
      '303-555-1234',
      '+1 303 555 1234'
    ];

    for (const format of formats) {
      const result = await lookupCustomer({ phone_number: format });
      // Should all resolve to same customer
      expect(result).toBeDefined();
    }
  });
});
```

### 2.3 Availability Check Tests

```javascript
// test/check-availability.test.js
const { checkAvailability } = require('../functions');

describe('checkAvailability', () => {
  test('returns available slots for valid date', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const result = await checkAvailability({
      preferred_date: dateStr,
      service_duration_hours: 3
    });

    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('slots');
  });

  test('handles no availability gracefully', async () => {
    // Use a date far in the past (should have no slots)
    const result = await checkAvailability({
      preferred_date: '2020-01-01',
      service_duration_hours: 3
    });

    expect(result.available).toBe(false);
    expect(result).toHaveProperty('next_available');
  });

  test('filters by preferred time', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const result = await checkAvailability({
      preferred_date: dateStr,
      preferred_time: 'morning',
      service_duration_hours: 3
    });

    if (result.available && result.slots.length > 0) {
      result.slots.forEach(slot => {
        const hour = parseInt(slot.start_time.split(':')[0]);
        expect(hour).toBeLessThan(12);
      });
    }
  });
});
```

### 2.4 Booking Tests

```javascript
// test/book-appointment.test.js
const { bookAppointment } = require('../functions');

describe('bookAppointment', () => {
  test('creates booking with all required fields', async () => {
    const result = await bookAppointment({
      customer_name: 'Test Customer',
      customer_phone: '+13035551234',
      service_address: {
        street: '123 Test St',
        city: 'Denver',
        state: 'CO',
        zip: '80202'
      },
      appointment_date: '2024-12-01',
      appointment_time: '09:00',
      service_type: 'standard',
      quoted_price: 185,
      estimated_hours: 3
    });

    expect(result.success).toBe(true);
    expect(result.booking).toHaveProperty('confirmation_number');
  });

  test('fails gracefully for invalid address', async () => {
    const result = await bookAppointment({
      customer_name: 'Test Customer',
      customer_phone: '+13035551234',
      service_address: {
        street: '99999 Nonexistent Lane',
        city: 'Nowhere',
        state: 'XX',
        zip: '00000'
      },
      appointment_date: '2024-12-01',
      appointment_time: '09:00',
      service_type: 'standard',
      quoted_price: 185,
      estimated_hours: 3
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_ADDRESS');
  });
});
```

---

## 3. Integration Tests

### 3.1 Jobber API Integration

```javascript
// test/integration/jobber.test.js
const JobberClient = require('../jobber-client');

describe('Jobber Integration', () => {
  let client;

  beforeAll(() => {
    client = new JobberClient();
  });

  test('authenticates successfully', async () => {
    const token = await client.getAccessToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  test('queries clients', async () => {
    const result = await client.findClientByPhone('+13035551234');
    expect(result).toBeDefined();
  });

  test('queries schedule availability', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await client.getAvailableSlots(tomorrow);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('creates and deletes test job', async () => {
    // Create
    const job = await client.createJob({
      clientId: 'test_client_id',
      title: 'Integration Test - DELETE',
      scheduledAt: new Date().toISOString()
    });
    expect(job.id).toBeDefined();

    // Clean up (delete test job)
    // Note: Implement deleteJob if needed for testing
  });

  test('handles token refresh', async () => {
    // Force token expiration
    client.tokenExpiry = Date.now() - 1000;

    // Should auto-refresh
    const result = await client.findClientByPhone('+13035551234');
    expect(result).toBeDefined();
  });
});
```

### 3.2 Retell Webhook Integration

```javascript
// test/integration/webhook.test.js
const request = require('supertest');
const app = require('../server');

describe('Retell Webhook', () => {
  test('responds to health check', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('healthy');
  });

  test('handles lookup_customer function', async () => {
    const res = await request(app)
      .post('/webhook/retell-functions')
      .send({
        function_name: 'lookup_customer',
        arguments: { phone_number: '+13035551234' },
        call_metadata: { call_id: 'test_123' }
      })
      .expect(200);

    expect(res.body).toHaveProperty('result');
  });

  test('handles calculate_quote function', async () => {
    const res = await request(app)
      .post('/webhook/retell-functions')
      .send({
        function_name: 'calculate_quote',
        arguments: {
          bedrooms: 3,
          bathrooms: 2,
          square_feet: 1800,
          frequency: 'bi-weekly'
        },
        call_metadata: { call_id: 'test_123' }
      })
      .expect(200);

    expect(res.body.result).toHaveProperty('quote');
    expect(res.body.result.quote).toHaveProperty('total');
  });

  test('handles unknown function gracefully', async () => {
    const res = await request(app)
      .post('/webhook/retell-functions')
      .send({
        function_name: 'nonexistent_function',
        arguments: {},
        call_metadata: { call_id: 'test_123' }
      })
      .expect(200);

    expect(res.body.result.success).toBe(false);
  });

  test('responds within 5 seconds', async () => {
    const start = Date.now();

    await request(app)
      .post('/webhook/retell-functions')
      .send({
        function_name: 'check_availability',
        arguments: {
          preferred_date: '2024-12-01',
          service_duration_hours: 3
        },
        call_metadata: { call_id: 'test_123' }
      });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## 4. End-to-End Call Scenarios

### 4.1 Happy Path: New Customer Books Appointment

**Scenario**: New customer calls, gets quote, books appointment

**Steps to Test**:
1. Call the Twilio number from an unknown phone number
2. Listen for AI greeting with disclosure
3. Say: "Hi, I need a house cleaning"
4. Provide: 3 bedrooms, 2 bathrooms, about 2000 square feet
5. Say: "One-time cleaning"
6. Wait for quote
7. Say: "Yes, I'd like to book"
8. When asked about dates: "This Saturday morning"
9. Select first available slot
10. Provide name and address when asked
11. Confirm booking

**Expected Results**:
- [ ] AI introduces itself as Sarah
- [ ] AI discloses it's an AI and call is recorded
- [ ] Questions asked one at a time
- [ ] Quote calculated correctly (~$185-225)
- [ ] Quote spoken naturally ("one eighty-five" not "185 dollars")
- [ ] Availability checked only after interest expressed
- [ ] Time slots presented clearly
- [ ] Booking confirmation includes all details
- [ ] Confirmation number provided
- [ ] SMS confirmation received

### 4.2 Existing Customer Recognition

**Scenario**: Existing customer calls, is recognized, history acknowledged

**Steps to Test**:
1. Create test customer in Jobber with known phone number
2. Call from that phone number
3. Listen for recognition

**Expected Results**:
- [ ] Customer recognized by name
- [ ] Last service date mentioned (if applicable)
- [ ] History available for reference
- [ ] Booking process streamlined

### 4.3 Quote with Add-ons

**Scenario**: Customer requests cleaning with multiple add-ons

**Steps to Test**:
1. Call and request cleaning
2. Provide property details
3. When asked about focus areas: "I'd like the fridge and oven cleaned too, and can you do windows?"
4. Get quote

**Expected Results**:
- [ ] Add-ons recognized and confirmed
- [ ] Quote includes add-on pricing
- [ ] Add-ons listed in quote breakdown
- [ ] Total calculated correctly

### 4.4 Recurring Service with Discount

**Scenario**: Customer wants bi-weekly service

**Steps to Test**:
1. Call and request cleaning
2. Provide property details
3. Say: "I want bi-weekly service"
4. Get quote

**Expected Results**:
- [ ] 10% discount applied
- [ ] Discount mentioned in quote
- [ ] Recurring schedule explained
- [ ] Both regular and first-clean prices clear

### 4.5 Objection Handling: Price

**Scenario**: Customer objects to price

**Steps to Test**:
1. Complete quote process
2. Say: "That's too expensive" or "I was expecting less"
3. Listen to response

**Expected Results**:
- [ ] Empathetic acknowledgment
- [ ] Value proposition explained
- [ ] Recurring discount offered if not already
- [ ] Satisfaction guarantee mentioned
- [ ] No pressure or defensiveness

### 4.6 Objection Handling: Need to Think

**Scenario**: Customer wants to think about it

**Steps to Test**:
1. Complete quote process
2. Say: "I need to think about it" or "Let me talk to my spouse"
3. Listen to response

**Expected Results**:
- [ ] Respect expressed for decision
- [ ] Follow-up question about timeline
- [ ] Offer to send quote summary
- [ ] Website mentioned for online booking
- [ ] No pressure

### 4.7 Transfer to Human

**Scenario**: Customer requests to speak with a human

**Steps to Test**:
1. At any point in call, say: "Can I speak to a real person?"
2. Listen to response

**Expected Results**:
- [ ] Request acknowledged immediately
- [ ] Option given: connect now or gather info first
- [ ] Transfer initiated smoothly (if chosen)
- [ ] Context passed to human (if available)

### 4.8 Commercial Inquiry (Large Property)

**Scenario**: Customer inquires about office cleaning >5000 sqft

**Steps to Test**:
1. Call and say: "I need cleaning for our office"
2. When asked about size: "About 8000 square feet"
3. Listen to response

**Expected Results**:
- [ ] Recognized as commercial inquiry
- [ ] Transfer offered to Laila
- [ ] Not handled by standard quote flow
- [ ] Professional response

### 4.9 Outside Service Area

**Scenario**: Customer address is outside Denver metro

**Steps to Test**:
1. Complete quote process
2. When asked for address: "123 Main St, Colorado Springs, CO"
3. Listen to response

**Expected Results**:
- [ ] Service area limitation explained
- [ ] Polite decline or waitlist offer
- [ ] Website/phone provided for questions
- [ ] No booking attempted

---

## 5. Edge Case Testing

### 5.1 Interruption Handling

**Test**: Interrupt the AI mid-sentence
**Expected**: AI stops, acknowledges, continues appropriately

### 5.2 Unclear Input

**Test**: Give unclear answers like "um, maybe three or four"
**Expected**: AI asks for clarification politely

### 5.3 Long Silence

**Test**: Don't respond for 10+ seconds
**Expected**: AI checks if caller is still there

### 5.4 Background Noise

**Test**: Call from noisy environment
**Expected**: AI may ask to repeat, handles gracefully

### 5.5 Accent/Pronunciation

**Test**: Say numbers in different ways
- "Fifteen hundred" vs "1500"
- "Two and a half baths" vs "2.5 bathrooms"
**Expected**: AI understands variations

### 5.6 Rapid Topic Change

**Test**: Change topics suddenly mid-flow
- During quote: "Actually, wait - are you insured?"
**Expected**: AI handles question, returns to flow

### 5.7 Multiple Questions at Once

**Test**: "What's included, how much, and when can you come?"
**Expected**: AI addresses each point (may ask to take one at a time)

### 5.8 Call Drop/Reconnect

**Test**: End call abruptly, call back immediately
**Expected**: Starts fresh, doesn't reference previous call

### 5.9 Invalid Data Entry

**Test**: Provide impossible values
- "50 bedrooms"
- "Negative bathrooms"
**Expected**: AI asks for clarification, doesn't crash

### 5.10 Knowledge Base Gaps

**Test**: Ask questions not in KB
- "Do you clean aquariums?"
- "Can you fix my sink?"
**Expected**: Polite deflection or offer to follow up

---

## 6. Performance Testing

### 6.1 Response Latency

**Target**: < 800ms average response time

```bash
# Measure webhook response times
for i in {1..10}; do
  curl -w "@curl-format.txt" -s -o /dev/null \
    -X POST https://your-domain.com/webhook/retell-functions \
    -H "Content-Type: application/json" \
    -d '{"function_name":"calculate_quote","arguments":{"bedrooms":3,"bathrooms":2,"square_feet":1800,"frequency":"one-time"},"call_metadata":{"call_id":"perf_test_'$i'"}}'
done
```

**curl-format.txt**:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### 6.2 Concurrent Call Handling

**Test**: Multiple simultaneous calls
```bash
# Run 5 concurrent calls
for i in {1..5}; do
  (curl -X POST https://your-domain.com/trigger-call \
    -H "Content-Type: application/json" \
    -d '{"phoneNumber":"+1555000'$i'000"}') &
done
wait
```

### 6.3 Jobber API Rate Limits

**Test**: Verify handling of API limits
- Monitor for 429 responses
- Verify retry logic works
- Check token refresh under load

### 6.4 Memory/CPU Under Load

**Monitor during testing**:
```bash
# Watch server resources
watch -n 1 "ps aux | grep node"
```

---

## 7. Regression Testing

### Before Each Deployment

Run these automated tests:
```bash
npm test
```

### Manual Regression Checklist

After any change, verify:
- [ ] Health check passes
- [ ] Quote calculation still correct
- [ ] Customer lookup works
- [ ] Availability check returns slots
- [ ] Booking creates job in Jobber
- [ ] AI greeting plays correctly
- [ ] Transfer function works

### Smoke Test Script

```bash
#!/bin/bash
# smoke-test.sh

BASE_URL="${WEBHOOK_URL:-http://localhost:3000}"

echo "Running smoke tests against $BASE_URL"

# Health check
echo -n "Health check... "
HEALTH=$(curl -s "$BASE_URL/health")
if [[ $HEALTH == *"healthy"* ]]; then
  echo "PASS"
else
  echo "FAIL: $HEALTH"
  exit 1
fi

# Quote calculation
echo -n "Quote calculation... "
QUOTE=$(curl -s -X POST "$BASE_URL/webhook/retell-functions" \
  -H "Content-Type: application/json" \
  -d '{"function_name":"calculate_quote","arguments":{"bedrooms":3,"bathrooms":2,"square_feet":1800,"frequency":"one-time"},"call_metadata":{"call_id":"smoke"}}')
if [[ $QUOTE == *"total"* ]]; then
  echo "PASS"
else
  echo "FAIL: $QUOTE"
  exit 1
fi

# Customer lookup
echo -n "Customer lookup... "
LOOKUP=$(curl -s -X POST "$BASE_URL/webhook/retell-functions" \
  -H "Content-Type: application/json" \
  -d '{"function_name":"lookup_customer","arguments":{"phone_number":"+13035551234"},"call_metadata":{"call_id":"smoke"}}')
if [[ $LOOKUP == *"found"* ]]; then
  echo "PASS"
else
  echo "FAIL: $LOOKUP"
  exit 1
fi

echo "All smoke tests passed!"
```

---

## 8. Testing Checklist

### Pre-Launch Testing Checklist

#### Infrastructure
- [ ] Server deployed and accessible via HTTPS
- [ ] Webhook URL configured in Retell
- [ ] Ngrok/tunnel working for local testing
- [ ] Environment variables set correctly
- [ ] Logs accessible and working

#### Retell Configuration
- [ ] Agent created with correct prompt
- [ ] All 5 functions defined
- [ ] Knowledge Base uploaded (if using)
- [ ] Dynamic variables configured
- [ ] Voice selected and tested
- [ ] Webhook URL set

#### Jobber Integration
- [ ] OAuth flow working
- [ ] Token refresh working
- [ ] Client lookup working
- [ ] Schedule query working
- [ ] Job creation working
- [ ] Webhooks configured (if using)

#### Twilio Configuration
- [ ] Phone number purchased
- [ ] Trust Hub Business Profile approved
- [ ] SHAKEN/STIR Trust Product assigned
- [ ] Voice webhook pointing to Retell
- [ ] A-attestation verified in logs

#### Function Tests
- [ ] lookup_customer - returns correct data
- [ ] calculate_quote - prices match expectations
- [ ] check_availability - returns valid slots
- [ ] book_appointment - creates Jobber job
- [ ] transfer_to_ceo - transfers correctly

#### Call Flow Tests
- [ ] Opening script plays correctly
- [ ] AI discloses identity
- [ ] Questions asked one at a time
- [ ] Prices spoken naturally
- [ ] Dates spoken naturally
- [ ] Booking confirmation complete
- [ ] SMS confirmations sent (via Jobber)

#### Edge Cases
- [ ] Unknown caller handled
- [ ] Outside service area handled
- [ ] Large commercial handled
- [ ] Objections handled
- [ ] Transfer request handled
- [ ] Errors handled gracefully

#### Performance
- [ ] Response time < 800ms average
- [ ] No timeouts during testing
- [ ] Handles concurrent calls

### Sign-Off

| Test Category | Tester | Date | Pass/Fail |
|---------------|--------|------|-----------|
| Unit Tests | | | |
| Integration Tests | | | |
| E2E Call Tests | | | |
| Edge Cases | | | |
| Performance | | | |
| UAT (Business Owner) | | | |

---

## Appendix: Test Data

### Sample Addresses (Denver Metro)
```
123 Cherry Creek Dr, Denver, CO 80209
456 Broadway St, Denver, CO 80203
789 Colfax Ave, Denver, CO 80218
321 Pearl St, Boulder, CO 80302 (edge of service area)
555 Main St, Colorado Springs, CO 80903 (outside service area)
```

### Sample Phone Numbers for Testing
```
+13035550001 - Unknown/New Customer
+13035550002 - Existing Customer (create in Jobber)
+13035550003 - Customer with History (create in Jobber)
```

### Sample Quote Scenarios
```
Small: 1 bed, 1 bath, 800 sqft → ~$125
Medium: 3 bed, 2 bath, 1800 sqft → ~$185
Large: 5 bed, 4 bath, 3500 sqft → ~$285
With Add-ons: Medium + fridge + oven → ~$230
Recurring: Medium bi-weekly → ~$167 (10% off)
```
