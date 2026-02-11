/**
 * Blue Bucket Server - API Integration Tests
 * Tests endpoints with a running server.
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3099';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('\n=== API Integration Tests ===\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // Test 1: Health Check
  try {
    const res = await request('GET', '/health');
    if (res.status === 200 && res.body.status) {
      console.log(`  ✓ GET /health - Status: ${res.body.status}`);
      passed++;
    } else {
      console.log(`  ✗ GET /health - Unexpected response:`, res);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ GET /health - Error: ${err.message}`);
    failed++;
  }

  // Test 2: 404 for unknown route
  try {
    const res = await request('GET', '/unknown/route');
    if (res.status === 404) {
      console.log(`  ✓ GET /unknown/route - Returns 404`);
      passed++;
    } else {
      console.log(`  ✗ GET /unknown/route - Expected 404, got ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ GET /unknown/route - Error: ${err.message}`);
    failed++;
  }

  // Test 3: Retell webhook - calculate_quote
  try {
    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_123',
      function_name: 'calculate_quote',
      arguments: {
        bedrooms: 3,
        bathrooms: 2,
        square_feet: 1800,
        frequency: 'one-time',
      },
      call_metadata: {
        from_number: '+13035551234',
      },
    }, {
      'X-Retell-Signature': 'test_signature',
    });

    if (res.status === 200 && res.body.result) {
      // Result can be either object with quote or string message
      const quote = res.body.result.quote?.total || 'speech response';
      console.log(`  ✓ POST /webhook/retell (calculate_quote) - Response received: ${quote}`);
      passed++;
    } else {
      console.log(`  ✗ POST /webhook/retell (calculate_quote) - Unexpected:`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ POST /webhook/retell (calculate_quote) - Error: ${err.message}`);
    failed++;
  }

  // Test 4: Retell webhook - lookup_customer (will fail gracefully without Redis)
  try {
    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_456',
      function_name: 'lookup_customer',
      arguments: {
        phone_number: '+13035559999',
      },
      call_metadata: {},
    });

    if (res.status === 200 && res.body.result) {
      console.log(`  ✓ POST /webhook/retell (lookup_customer) - Found: ${res.body.result.found}`);
      passed++;
    } else {
      console.log(`  ✗ POST /webhook/retell (lookup_customer) - Unexpected:`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ POST /webhook/retell (lookup_customer) - Error: ${err.message}`);
    failed++;
  }

  // Test 5: Retell webhook - transfer_to_ceo
  try {
    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_789',
      function_name: 'transfer_to_ceo',
      arguments: {
        reason: 'customer_requested_human',
        context_summary: 'Customer wants to speak with owner',
      },
      call_metadata: {},
    });

    if (res.status === 200 && res.body.result) {
      // Can be {transfer_to} or {transfer_number} depending on handler
      const phone = res.body.result.transfer_to || res.body.transfer_number || res.body.result;
      console.log(`  ✓ POST /webhook/retell (transfer_to_ceo) - Transfer initiated`);
      passed++;
    } else {
      console.log(`  ✗ POST /webhook/retell (transfer_to_ceo) - Unexpected:`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ POST /webhook/retell (transfer_to_ceo) - Error: ${err.message}`);
    failed++;
  }

  // Test 6: Retell webhook - unknown function
  try {
    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_000',
      function_name: 'unknown_function',
      arguments: {},
    });

    if (res.status === 400 || (res.body.result && res.body.result.error)) {
      console.log(`  ✓ POST /webhook/retell (unknown) - Properly rejected`);
      passed++;
    } else {
      console.log(`  ✗ POST /webhook/retell (unknown) - Should reject unknown functions`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ POST /webhook/retell (unknown) - Error: ${err.message}`);
    failed++;
  }

  // Summary
  console.log('\n=== Test Results ===\n');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
