/**
 * Acuity Scheduling Availability Proxy — Cloudflare Worker
 *
 * Two read-only endpoints that forward availability requests to Acuity's API.
 * API credentials are stored as Worker secrets (ACUITY_USER_ID, ACUITY_API_KEY).
 */

const ACUITY_BASE = 'https://acuityscheduling.com/api/v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (allowed.includes(origin)) return origin;
  return '';
}

function json(data, status, request, env) {
  const origin = corsOrigin(request, env);
  const headers = {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

function error(msg, status, request, env) {
  return json({ error: msg }, status, request, env);
}

async function acuityGet(path, params, env) {
  const url = new URL(ACUITY_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const auth = btoa(env.ACUITY_USER_ID + ':' + env.ACUITY_API_KEY);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: 'Basic ' + auth },
  });

  if (!resp.ok) {
    throw new Error('Acuity returned ' + resp.status);
  }
  return resp.json();
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = corsOrigin(request, env);
      const headers = { ...CORS_HEADERS };
      if (origin) headers['Access-Control-Allow-Origin'] = origin;
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET') {
      return error('method_not_allowed', 405, request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /api/acuity/availability/dates?appointmentTypeID=X&month=YYYY-MM
      if (path === '/api/acuity/availability/dates') {
        const typeId = url.searchParams.get('appointmentTypeID');
        const month = url.searchParams.get('month');

        if (!typeId || !/^\d+$/.test(typeId)) return error('invalid appointmentTypeID', 400, request, env);
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return error('invalid month (YYYY-MM)', 400, request, env);

        const data = await acuityGet('/availability/dates', { appointmentTypeID: typeId, month }, env);
        const stripped = data.map(d => ({ date: d.date }));
        return json(stripped, 200, request, env);
      }

      // GET /api/acuity/availability/times?appointmentTypeID=X&date=YYYY-MM-DD
      if (path === '/api/acuity/availability/times') {
        const typeId = url.searchParams.get('appointmentTypeID');
        const date = url.searchParams.get('date');

        if (!typeId || !/^\d+$/.test(typeId)) return error('invalid appointmentTypeID', 400, request, env);
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date (YYYY-MM-DD)', 400, request, env);

        const data = await acuityGet('/availability/times', { appointmentTypeID: typeId, date }, env);
        const stripped = data.map(t => ({ time: t.time, slotsAvailable: t.slotsAvailable || 1 }));
        return json(stripped, 200, request, env);
      }

      return error('not_found', 404, request, env);

    } catch (err) {
      return json({ error: 'upstream_error', message: err.message }, 502, request, env);
    }
  },
};
