import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {WebSocket, WebSocketServer} from 'ws';
import {createRealtimeGateway, toWebSocketUrl} from '../server/realtime.mjs';

function waitForEvent(emitter, event) {
  return new Promise((resolve, reject) => {
    const onEvent = (...args) => {
      cleanup();
      resolve(args);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      emitter.off(event, onEvent);
      emitter.off('error', onError);
    };
    emitter.once(event, onEvent);
    emitter.once('error', onError);
  });
}

test('builds an upstream websocket URL with server-side token', () => {
  assert.equal(
    toWebSocketUrl('https://screeps.com', 'token value'),
    'wss://screeps.com/socket/websocket?_token=token+value'
  );
  assert.equal(
    toWebSocketUrl('http://localhost:21025/screeps', 'token'),
    'ws://localhost:21025/screeps/socket/websocket?_token=token'
  );
});

test('rejects websocket connections from disallowed origins', async () => {
  const server = createServer();
  const gateway = createRealtimeGateway({server, baseUrl: 'http://127.0.0.1:1', token: 'token', allowedOrigins: ['http://allowed.test']});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}/socket/websocket`, {
    headers: {Origin: 'http://blocked.test'},
  });
  const [error] = await waitForEvent(client, 'error');
  assert.ok(error);
  gateway.close();
  client.close();
  await new Promise((resolve) => server.close(resolve));
});

test('relays authenticated websocket traffic in both directions', async () => {
  const upstreamServer = createServer();
  const upstreamWss = new WebSocketServer({server: upstreamServer});
  const upstreamMessages = [];
  let upstreamClient;
  upstreamWss.on('connection', (client, request) => {
    upstreamClient = client;
    assert.equal(new URL(request.url, 'http://localhost').searchParams.get('_token'), 'server-token');
    client.on('message', (data) => {
      upstreamMessages.push(data.toString());
      if (data.toString() === 'auth server-token') client.send('auth ok');
    });
  });
  await new Promise((resolve) => upstreamServer.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstreamServer.address().port;

  const dashboardServer = createServer();
  const gateway = createRealtimeGateway({
    server: dashboardServer,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    token: 'server-token',
    allowedOrigins: ['http://dashboard.test'],
  });
  await new Promise((resolve) => dashboardServer.listen(0, '127.0.0.1', resolve));
  const dashboardPort = dashboardServer.address().port;

  const client = new WebSocket(`ws://127.0.0.1:${dashboardPort}/socket/websocket`, {
    headers: {Origin: 'http://dashboard.test'},
  });
  const received = waitForEvent(client, 'message');
  await waitForEvent(client, 'open');
  client.send('subscribe cpu');
  const [message] = await received;
  assert.equal(message.toString(), 'auth ok');
  assert.deepEqual(upstreamMessages, ['auth server-token', 'subscribe cpu']);

  gateway.close();
  client.close();
  upstreamWss.close();
  await new Promise((resolve) => dashboardServer.close(resolve));
  await new Promise((resolve) => upstreamServer.close(resolve));
});
