const API_KEY_STORAGE_KEY = 'wde_config_api_key';

export function getStoredApiKey(): string | null {
  try { return localStorage.getItem(API_KEY_STORAGE_KEY); } catch { return null; }
}

export function setStoredApiKey(key: string): void {
  try { localStorage.setItem(API_KEY_STORAGE_KEY, key); } catch { /* ignore */ }
}

export function clearStoredApiKey(): void {
  try { localStorage.removeItem(API_KEY_STORAGE_KEY); } catch { /* ignore */ }
}

export async function saveConfigToWorker(
  workerUrl: string,
  config: { treatments: Record<string, unknown>; bundles: Record<string, unknown>; questions: Record<string, unknown> },
  apiKey: string
): Promise<{ ok: true; timestamp: string } | { ok: false; message: string }> {
  try {
    const resp = await fetch(workerUrl + '/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(config),
    });
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { ok: false, message: 'Worker not reachable. Check the URL.' };
    }
    const json = await resp.json() as Record<string, unknown>;
    if (resp.ok && json.ok) {
      return { ok: true, timestamp: String(json.timestamp || new Date().toISOString()) };
    }
    if (resp.status === 401) {
      return { ok: false, message: 'unauthorized' };
    }
    return { ok: false, message: String(json.error || 'HTTP ' + resp.status) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
  }
}
