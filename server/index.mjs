import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {createProxyHandler} from './proxy.mjs';
import {createAuthHandler} from './auth.mjs';
import {resolveStaticFile} from './static-files.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const root = resolve(process.env.STATIC_DIR || 'src-next/out');
const maxRequestBytes = Number(process.env.MAX_REQUEST_BYTES || 1_048_576);
const allowedOrigins = (process.env.SCREEPS_ALLOWED_ORIGINS || 'https://screeps.com')
  .split(',').map(value => value.trim()).filter(Boolean);
const proxy = createProxyHandler({allowedOrigins, maxRequestBytes});
const auth = createAuthHandler({
  adminPassword: process.env.DASHBOARD_ADMIN_PASSWORD || '',
  secureCookie: process.env.DASHBOARD_COOKIE_SECURE === '1',
});
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/x-component; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function writeResponseHead(response, status, headers = {}) {
  response.writeHead(status, {...securityHeaders, ...headers});
}

async function readRequestBody(request) {
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    request.resume();
    throw new HttpError(413, 'Request body is too large');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) {
      request.resume();
      throw new HttpError(413, 'Request body is too large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function nodeRequestToWeb(request) {
  const url = `http://${request.headers.host || 'localhost'}${request.url || '/'}`;
  const init = {method: request.method, headers: request.headers};
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    init.body = await readRequestBody(request);
  }
  return new Request(url, init);
}

async function sendWebResponse(response, webResponse) {
  writeResponseHead(response, webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      writeResponseHead(response, 200, {'content-type': 'application/json', 'cache-control': 'no-store'});
      response.end('{"ok":true}');
      return;
    }
    if (url.pathname.startsWith('/api/auth/')) {
      await sendWebResponse(response, await auth.handle(await nodeRequestToWeb(request)));
      return;
    }
    if (url.pathname === '/api/screeps-proxy') {
      const webRequest = await nodeRequestToWeb(request);
      if (!auth.requireSession(webRequest)) {
        await sendWebResponse(response, new Response(JSON.stringify({error: 'Authentication required'}), {
          status: 401,
          headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'},
        }));
        return;
      }
      await sendWebResponse(response, await proxy(webRequest));
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      writeResponseHead(response, 405, {'content-type': 'application/json'});
      response.end('{"error":"Method not allowed"}');
      return;
    }
    const isRscRequest = url.searchParams.has('_rsc') || request.headers.rsc === '1';
    const file = await resolveStaticFile(root, url.pathname, isRscRequest);
    if (!file) {
      writeResponseHead(response, 404, {'content-type': 'text/plain; charset=utf-8'});
      response.end('Not found');
      return;
    }
    const content = await readFile(file);
    const extension = extname(file);
    const cacheControl = extension === '.html' || extension === '.txt'
      ? 'no-cache'
      : 'public, max-age=31536000, immutable';
    writeResponseHead(response, 200, {
      'content-type': contentTypes[extension] || 'application/octet-stream',
      'cache-control': cacheControl,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    writeResponseHead(response, status, {'content-type': 'application/json', 'cache-control': 'no-store'});
    response.end(JSON.stringify({error: error instanceof Error ? error.message : 'Internal error'}));
  }
});

server.listen(port, host, () => console.log(`Screeps Dashboard Web listening on http://${host}:${port}`));
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
