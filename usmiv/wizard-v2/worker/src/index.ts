/**
 * Wizard of IV Config CMS -- Cloudflare Worker
 *
 * GET  /config         -- returns current wizard config JSON (public, edge-cached 60s)
 * PUT  /config         -- updates config (requires X-API-Key header)
 * OPTIONS              -- CORS preflight
 */

export interface Env {
  WIZARD_CONFIG: KVNamespace;
  API_KEY: string;
}

const CONFIG_KEY = 'wizard-config';
const BACKUP_KEY_PREFIX = 'wizard-config-backup-';
const BACKUP_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const CACHE_MAX_AGE = 60; // seconds

// CORS headers for public GET responses (wildcard is safe for read-only data).
const CORS_HEADERS_PUBLIC: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

// For write (PUT) responses, reflect the request's Origin instead of wildcard
// so that CORS provides origin-level defense-in-depth alongside the API key.
function corsHeadersForOrigin(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}

async function timeSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aKey = await crypto.subtle.importKey(
    'raw', enc.encode(a), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const aSig = await crypto.subtle.sign('HMAC', aKey, enc.encode('verify'));
  const bKey = await crypto.subtle.importKey(
    'raw', enc.encode(b), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const bSig = await crypto.subtle.sign('HMAC', bKey, enc.encode('verify'));
  const aArr = new Uint8Array(aSig);
  const bArr = new Uint8Array(bSig);
  if (aArr.length !== bArr.length) return false;
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i] ^ bArr[i];
  return diff === 0;
}

function jsonResponse(data: unknown, status: number, corsHeaders: Record<string, string> = CORS_HEADERS_PUBLIC): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string> = CORS_HEADERS_PUBLIC): Response {
  return jsonResponse({ error: message }, status, corsHeaders);
}

/**
 * Validates that the incoming body has the expected top-level shape of a wizard config.
 * We check for required top-level keys without deeply validating every nested field --
 * the wizard itself handles missing fields gracefully.
 */
function validateConfigShape(config: unknown): { valid: boolean; reason?: string } {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { valid: false, reason: 'config must be a JSON object' };
  }

  const obj = config as Record<string, unknown>;

  const requiredKeys = ['treatments', 'bundles', 'questions'];
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      return { valid: false, reason: `missing required key: ${key}` };
    }
  }

  if (typeof obj.treatments !== 'object' || obj.treatments === null) {
    return { valid: false, reason: 'treatments must be an object' };
  }
  if (typeof obj.bundles !== 'object' || obj.bundles === null) {
    return { valid: false, reason: 'bundles must be an object' };
  }
  if (typeof obj.questions !== 'object' || obj.questions === null || Array.isArray(obj.questions)) {
    return { valid: false, reason: 'questions must be an object' };
  }

  return { valid: true };
}

async function handleGet(env: Env): Promise<Response> {
  const value = await env.WIZARD_CONFIG.get(CONFIG_KEY, { type: 'text' });

  if (value === null) {
    return errorResponse('config_not_found', 404);
  }

  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`,
      ...CORS_HEADERS_PUBLIC,
    },
  });
}

async function handlePut(request: Request, env: Env): Promise<Response> {
  // Reflect the request's Origin for PUT responses so CORS provides
  // origin-level defense-in-depth alongside the API key (H3).
  const putCors = corsHeadersForOrigin(request.headers.get('Origin'));

  // Authenticate
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || !(await timeSafeEqual(apiKey, env.API_KEY))) {
    return errorResponse('unauthorized', 401, putCors);
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, putCors);
  }

  // Validate shape
  const { valid, reason } = validateConfigShape(body);
  if (!valid) {
    return jsonResponse({ error: 'invalid_config_shape', reason }, 400, putCors);
  }

  // Back up existing config before overwriting
  const existing = await env.WIZARD_CONFIG.get(CONFIG_KEY, { type: 'text' });
  if (existing !== null) {
    const backupKey = `${BACKUP_KEY_PREFIX}${Date.now()}`;
    await env.WIZARD_CONFIG.put(backupKey, existing, { expirationTtl: BACKUP_TTL_SECONDS });
  }

  // Write new config
  const payload = JSON.stringify(body);
  await env.WIZARD_CONFIG.put(CONFIG_KEY, payload);

  return jsonResponse({ ok: true, updatedAt: new Date().toISOString() }, 200, putCors);
}

async function handleGetHistory(env: Env): Promise<Response> {
  const list = await env.WIZARD_CONFIG.list({ prefix: BACKUP_KEY_PREFIX });

  const timestamps = list.keys
    .map((k) => {
      const ts = parseInt(k.name.replace(BACKUP_KEY_PREFIX, ''), 10);
      return isNaN(ts) ? null : new Date(ts).toISOString();
    })
    .filter((ts): ts is string => ts !== null)
    .sort()
    .reverse()
    .slice(0, 10);

  return jsonResponse({ versions: timestamps }, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS_PUBLIC });
    }

    if (path === '/config') {
      if (method === 'GET') {
        return handleGet(env);
      }
      if (method === 'PUT') {
        return handlePut(request, env);
      }
      return errorResponse('method_not_allowed', 405);
    }

    if (path === '/config/history') {
      if (method === 'GET') {
        return handleGetHistory(env);
      }
      return errorResponse('method_not_allowed', 405);
    }

    return errorResponse('not_found', 404);
  },
};
