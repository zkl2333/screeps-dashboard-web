import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {createProxyHandler} from './proxy.mjs';
import {resolveStaticFile} from './static-files.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const root = resolve(process.env.STATIC_DIR || 'src-next/out');
const allowedOrigins = (process.env.SCREEPS_ALLOWED_ORIGINS || 'https://screeps.com')
  .split(',').map(value => value.trim()).filter(Boolean);
const proxy = createProxyHandler({allowedOrigins});
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/x-component; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function nodeRequestToWeb(request) {
  const url = `http://${request.headers.host || 'localhost'}${request.url || '/'}`;
  const init = {method: request.method, headers: request.headers};
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    init.body = new ReadableStream({start(controller) {
      request.on('data', chunk => controller.enqueue(chunk));
      request.on('end', () => controller.close());
      request.on('error', error => controller.error(error));
    }});
    init.duplex = 'half';
  }
  return new Request(url, init);
}

async function sendWebResponse(response, webResponse) {
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      response.writeHead(200, {'content-type': 'application/json'}).end('{"ok":true}');
      return;
    }
    if (url.pathname === '/api/screeps-proxy') {
      await sendWebResponse(response, await proxy(nodeRequestToWeb(request)));
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      response.writeHead(405, {'content-type': 'application/json'}).end('{"error":"Method not allowed"}');
      return;
    }
    const isRscRequest = url.searchParams.has('_rsc') || request.headers.rsc === '1';
    const file = await resolveStaticFile(root, url.pathname, isRscRequest);
    if (!file) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'}).end('Not found');
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {'content-type': contentTypes[extname(file)] || 'application/octet-stream'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(500, {'content-type': 'application/json'}).end(JSON.stringify({error: error instanceof Error ? error.message : 'Internal error'}));
  }
});

server.listen(port, host, () => console.log(`Screeps Dashboard Web listening on http://${host}:${port}`));
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
