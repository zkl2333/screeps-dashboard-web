import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {loadConfig} from './config.mjs';
import {createProxyHandler} from './proxy.mjs';
import {createRealtimeGateway} from './realtime.mjs';
import {resolveStaticFile} from './static-files.mjs';

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

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'},
  });
}

function createServerApp(config) {
  const root = resolve(config.staticDir);
  const proxy = createProxyHandler(config);

  async function readRequestBody(request) {
    const declaredLength = Number(request.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > config.maxRequestBytes) {
      request.resume();
      throw new HttpError(413, 'Request body is too large');
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > config.maxRequestBytes) {
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

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname === '/healthz') {
        writeResponseHead(response, 200, {'content-type': 'application/json', 'cache-control': 'no-store'});
        response.end(JSON.stringify({ok: true, configured: config.ready}));
        return;
      }
      if (url.pathname === '/readyz') {
        writeResponseHead(response, config.ready ? 200 : 503, {'content-type': 'application/json', 'cache-control': 'no-store'});
        response.end(JSON.stringify({ok: config.ready, configured: config.ready}));
        return;
      }
      if (url.pathname === '/api/config' && request.method === 'GET') {
        await sendWebResponse(response, jsonResponse(200, config.public));
        return;
      }
      if (url.pathname === '/api/screeps-proxy') {
        if (!config.ready) {
          await sendWebResponse(response, jsonResponse(503, {error: 'Screeps token is not configured'}));
          return;
        }
        await sendWebResponse(response, await proxy(await nodeRequestToWeb(request)));
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
}

async function main() {
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    console.error(`[config] ${error instanceof Error ? error.message : 'Invalid configuration'}`);
    process.exitCode = 1;
    return;
  }

  const server = createServerApp(config);
  const realtime = config.ready
    ? createRealtimeGateway({server, baseUrl: config.baseUrl, token: config.token, allowedOrigins: config.dashboardAllowedOrigins, maxPayload: config.maxWsPayloadBytes})
    : null;

  server.listen(config.port, config.host, () => console.log(`Screeps Dashboard Web listening on http://${config.host}:${config.port}`));
  function shutdown() {
    realtime?.close();
    server.close(() => process.exit(0));
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  void main();
}

export {createServerApp};
