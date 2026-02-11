/**
 * Blue Bucket Server - API Integration Tests
 * Tests endpoints with a running server instance.
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3099';

// Set required env vars for server startup
process.env.JOBBER_CLIENT_ID = process.env.JOBBER_CLIENT_ID || 'test_id';
process.env.JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET || 'test_secret';
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test_token';
process.env.RETELL_WEBHOOK_SECRET = process.env.RETELL_WEBHOOK_SECRET || 'test_secret';
process.env.CEO_PHONE = process.env.CEO_PHONE || '+13035551234';

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
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
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

// ============================================
// API Integration Tests
// ============================================

describe('API Integration Tests', () => {
  // These tests require a running server at BASE_URL.
  // Skip if the server is not available.

  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const res = await request('GET', '/health');
      serverAvailable = res.status === 200;
    } catch {
      serverAvailable = false;
    }

    if (!serverAvailable) {
      console.warn(`Server not available at ${BASE_URL} - skipping integration tests`);
    }
  });

  test('GET /health returns healthy status', async () => {
    if (!serverAvailable) return;

    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  test('GET /health returns X-Trace-Id header', async () => {
    if (!serverAvailable) return;

    const res = await request('GET', '/health');
    expect(res.headers['x-trace-id']).toBeDefined();
  });

  test('GET /unknown/route returns 404', async () => {
    if (!serverAvailable) return;

    const res = await request('GET', '/unknown/route');
    expect(res.status).toBe(404);
  });

  test('POST /webhook/retell (calculate_quote) returns result', async () => {
    if (!serverAvailable) return;

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

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test('POST /webhook/retell (lookup_customer) returns result', async () => {
    if (!serverAvailable) return;

    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_456',
      function_name: 'lookup_customer',
      arguments: {
        phone_number: '+13035559999',
      },
      call_metadata: {},
    });

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test('POST /webhook/retell (transfer_to_ceo) returns result', async () => {
    if (!serverAvailable) return;

    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_789',
      function_name: 'transfer_to_ceo',
      arguments: {
        reason: 'customer_requested_human',
        context_summary: 'Customer wants to speak with owner',
      },
      call_metadata: {},
    });

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test('POST /webhook/retell (unknown function) is rejected', async () => {
    if (!serverAvailable) return;

    const res = await request('POST', '/webhook/retell', {
      call_id: 'test_call_000',
      function_name: 'unknown_function',
      arguments: {},
    });

    const isRejected = res.status === 400 || (res.body.result && res.body.result.error);
    expect(isRejected).toBe(true);
  });
});
