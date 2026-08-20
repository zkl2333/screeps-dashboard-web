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

export function createProxyHandler({fetch: fetchImpl = globalThis.fetch}) {

  return async function handle(request) {
    if (request.method !== 'POST') return json(405, {error: 'Method not allowed'});

    let input;
    try {
      input = await request.json();
    } catch {
      return json(400, {error: 'Invalid JSON'});
    }

    const method = String(input.method || 'GET').toUpperCase();
    if (!METHODS.has(method)) return json(400, {error: 'Unsupported method'});
    if (typeof input.endpoint !== 'string' || !input.endpoint.startsWith('/') || input.endpoint.startsWith('//')) {
      return json(400, {error: 'Invalid endpoint'});
    }

    let origin;
    try {
      origin = normalizeOrigin(String(input.baseUrl || ''));
    } catch {
      return json(400, {error: 'Invalid base URL'});
    }
    if (!allowlist.has(origin)) return json(403, {error: 'Target origin is not allowed'});

    const url = new URL(input.endpoint, `${origin}/`);
    for (const [key, value] of Object.entries(input.query || {})) {
      if (['string', 'number', 'boolean'].includes(typeof value)) url.searchParams.set(key, String(value));
    }

    const headers = {Accept: 'application/json'};
    if (typeof input.token === 'string' && input.token.trim()) headers['X-Token'] = input.token.trim();
    if (typeof input.username === 'string' && input.username.trim()) headers['X-Username'] = input.username.trim();
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
      return json(200, {status: upstream.status, ok: upstream.ok, data, url: upstream.url || url.toString()});
    } catch (error) {
      return json(502, {error: error instanceof Error ? error.message : 'Upstream request failed'});
    }
  };
}
