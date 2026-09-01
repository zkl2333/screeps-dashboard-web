import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServerApp} from '../server/index.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function get(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return {status: response.status, body: await response.json()};
}

test('serves redacted config and readiness status', async () => {
  const root = await mkdtemp(join(tmpdir(), 'screeps-dashboard-integration-'));
  await writeFile(join(root, 'index.html'), '<html>dashboard</html>');
  const server = createServerApp({
    staticDir: root,
    baseUrl: 'https://screeps.com',
    username: 'player',
    token: 'server-token',
    allowedOrigins: ['https://screeps.com'],
    maxRequestBytes: 1024,
    ready: true,
  });
  const port = await listen(server);
  const config = await get(port, '/api/config');
  assert.equal(config.status, 200);
  assert.deepEqual(config.body, {
    baseUrl: 'https://screeps.com',
    username: 'player',
    configured: true,
    realtimePath: '/socket/websocket',
  });
  assert.equal(JSON.stringify(config.body).includes('server-token'), false);
  const ready = await get(port, '/readyz');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.ok, true);
  await new Promise((resolve) => server.close(resolve));
});
