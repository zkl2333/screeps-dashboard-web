const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
  });
}

function normalizeOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
  return url.origin;
}

export function createProxyHandler({
  fetch: fetchImpl = globalThis.fetch,
  baseUrl,
  username = '',
  token = '',
  allowedOrigins = ['https://screeps.com'],
  maxRequestBytes = 1_048_576,
} = {}) {
  const configuredBaseUrl = String(baseUrl || allowedOrigins[0] || '').replace(/\/+$/, '');
  const configuredOrigin = normalizeOrigin(configuredBaseUrl);
  const allowlist = new Set(allowedOrigins.map(normalizeOrigin));
  if (!allowlist.has(configuredOrigin)) {
    throw new Error('SCREEPS_BASE_URL must be present in SCREEPS_ALLOWED_ORIGINS');
  }

  return async function handle(request) {
    if (request.method !== 'POST') return json(405, {error: 'Method not allowed'});

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
      return json(413, {error: 'Request body is too large'});
    }

    let input;
    try {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > maxRequestBytes) return json(413, {error: 'Request body is too large'});
      input = JSON.parse(raw);
    } catch {
      return json(400, {error: 'Invalid JSON'});
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return json(400, {error: 'Invalid request payload'});
    }

    const method = String(input.method || 'GET').toUpperCase();
    if (!METHODS.has(method)) return json(400, {error: 'Unsupported method'});
    if (typeof input.endpoint !== 'string' || !input.endpoint.startsWith('/') || input.endpoint.startsWith('//')) {
      return json(400, {error: 'Invalid endpoint'});
    }

    const url = new URL(`${configuredBaseUrl}${input.endpoint}`);
    for (const [key, value] of Object.entries(input.query || {})) {
      if (['string', 'number', 'boolean'].includes(typeof value)) url.searchParams.set(key, String(value));
    }

    const headers = {Accept: 'application/json'};
    if (token) headers['X-Token'] = token;
    if (username) headers['X-Username'] = username;
    if (method !== 'GET') headers['Content-Type'] = 'application/json';

    try {
      const upstream = await fetchImpl(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(input.body ?? {}),
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await upstream.text();
      let data = {};
      if (raw) {
        try { data = JSON.parse(raw); }
        catch { data = {text: raw}; }
      }
      return json(200, {status: upstream.status, ok: upstream.ok, data, url: url.toString()});
    } catch {
      return json(502, {error: 'Upstream request failed'});
    }
  };
}
