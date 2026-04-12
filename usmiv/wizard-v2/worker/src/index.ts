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

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
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
  if (!Array.isArray(obj.questions)) {
    return { valid: false, reason: 'questions must be an array' };
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
      ...CORS_HEADERS,
    },
  });
}

async function handlePut(request: Request, env: Env): Promise<Response> {
  // Authenticate
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== env.API_KEY) {
    return errorResponse('unauthorized', 401);
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }

  // Validate shape
  const { valid, reason } = validateConfigShape(body);
  if (!valid) {
    return jsonResponse({ error: 'invalid_config_shape', reason }, 400);
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

  return jsonResponse({ ok: true, updatedAt: new Date().toISOString() }, 200);
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
      return new Response(null, { status: 204, headers: CORS_HEADERS });
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
