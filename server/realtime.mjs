import {WebSocket, WebSocketServer} from 'ws';

function toWebSocketUrl(baseUrl, token) {
  const url = new URL(baseUrl);
  const host = url.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  url.protocol = loopback ? 'ws:' : 'wss:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/socket/websocket`.replace(/\/{2,}/g, '/');
  if (token) url.searchParams.set('_token', token);
  return url.toString();
}

function closeCode(code) {
  return [1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014].includes(code)
    ? code
    : 1011;
}

function closeQuietly(socket, code = 1000, reason = '') {
  if (!socket || (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING)) return;
  try { socket.close(closeCode(code), reason); } catch { /* socket may already be closing */ }
}

export function createRealtimeGateway({server, baseUrl, token, allowedOrigins = [], maxPayload = 1_048_576} = {}) {
  if (!server) throw new Error('HTTP server is required');
  if (!baseUrl || !token) throw new Error('Realtime gateway requires Screeps configuration');

  const clients = new Set();
  const websocketServer = new WebSocketServer({noServer: true, maxPayload});

  function handleConnection(client) {
    clients.add(client);
    const pending = [];
    let upstream;
    let authenticated = false;
    let authenticationTimer;
    let closed = false;

    const finish = (code = 1000, reason = '') => {
      if (closed) return;
      closed = true;
      clients.delete(client);
      clearTimeout(authenticationTimer);
      closeQuietly(upstream, code, reason);
      closeQuietly(client, code, reason);
    };

    try {
      upstream = new WebSocket(toWebSocketUrl(baseUrl, token), {maxPayload});
    } catch {
      finish(1011, 'upstream_connect_failed');
      return;
    }

    upstream.on('open', () => {
      if (upstream.readyState !== WebSocket.OPEN) return;
      upstream.send(`auth ${token}`);
      authenticationTimer = setTimeout(() => finish(1011, 'upstream_auth_timeout'), 10_000);
    });
    upstream.on('message', (data, isBinary) => {
      if (!isBinary && /^auth\s+(?:ok|success)\b/i.test(data.toString().trim())) {
        authenticated = true;
        clearTimeout(authenticationTimer);
        for (const {data: pendingData, isBinary: pendingBinary} of pending.splice(0)) {
          if (upstream.readyState === WebSocket.OPEN) upstream.send(pendingData, {binary: pendingBinary});
        }
      }
      if (client.readyState === WebSocket.OPEN) client.send(data, {binary: isBinary});
    });
    upstream.on('error', () => finish(1011, 'upstream_error'));
    upstream.on('close', (code, reason) => finish(code || 1000, reason?.toString() || ''));

    client.on('message', (data, isBinary) => {
      if (closed) return;
      const message = isBinary ? Buffer.from(data) : data.toString();
      if (upstream.readyState === WebSocket.OPEN && authenticated) {
        upstream.send(message, {binary: isBinary});
      } else if ((upstream.readyState === WebSocket.CONNECTING || upstream.readyState === WebSocket.OPEN) && pending.length < 100) {
        pending.push({data: message, isBinary});
      }
    });
    client.on('error', () => finish(1011, 'client_error'));
    client.on('close', () => finish());
  }

  function handleUpgrade(request, socket, head) {
    const url = new URL(request.url || '/', 'http://localhost');
    const origin = request.headers.origin;
    if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (url.pathname !== '/socket/websocket') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, handleConnection);
  }

  server.on('upgrade', handleUpgrade);

  return {
    close() {
      for (const client of [...clients]) closeQuietly(client, 1001, 'server_shutdown');
      websocketServer.close();
      server.off('upgrade', handleUpgrade);
    },
    clients,
  };
}

export {toWebSocketUrl};
