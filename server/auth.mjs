import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

const COOKIE_NAME = 'dashboard_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PASSWORD_LENGTH = 1024;

function json(status, value, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function parseCookies(headerValue) {
  const cookies = new Map();
  if (!headerValue) {
    return cookies;
  }

  for (const part of String(headerValue).split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      cookies.set(name, decodeURIComponent(value));
    }
  }
  return cookies;
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function cookieHeader(token, {secure, maxAgeSeconds}) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function clearCookieHeader(secure) {
  return cookieHeader('', {secure, maxAgeSeconds: 0});
}

export function createAuthHandler({
  adminPassword = process.env.DASHBOARD_ADMIN_PASSWORD || '',
  now = () => Date.now(),
  secureCookie = false,
} = {}) {
  const sessions = new Map();

  function pruneExpired(currentTime) {
    for (const [hash, session] of sessions) {
      if (session.expiresAt <= currentTime) {
        sessions.delete(hash);
      }
    }
  }

  function getSessionFromRequest(request) {
    const currentTime = now();
    pruneExpired(currentTime);
    const cookies = parseCookies(request.headers.get('cookie'));
    const token = cookies.get(COOKIE_NAME);
    if (!token) {
      return null;
    }
    const hash = hashSessionToken(token);
    const session = sessions.get(hash);
    if (!session || session.expiresAt <= currentTime) {
      sessions.delete(hash);
      return null;
    }
    session.lastSeenAt = currentTime;
    return session;
  }

  async function handle(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/api/auth/session' && request.method === 'GET') {
      const session = getSessionFromRequest(request);
      if (!session) {
        return json(401, {authenticated: false});
      }
      return json(200, {authenticated: true, expiresAt: session.expiresAt});
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      const cookies = parseCookies(request.headers.get('cookie'));
      const token = cookies.get(COOKIE_NAME);
      if (token) {
        sessions.delete(hashSessionToken(token));
      }
      return json(200, {ok: true}, {
        'set-cookie': clearCookieHeader(secureCookie),
      });
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      if (!adminPassword) {
        return json(503, {error: 'Administrator password is not configured'});
      }

      let input;
      try {
        input = await request.json();
      } catch {
        return json(400, {error: 'Invalid JSON'});
      }

      const password = typeof input?.password === 'string' ? input.password : '';
      if (!password || password.length > MAX_PASSWORD_LENGTH || !safeEqualText(password, adminPassword)) {
        return json(401, {error: 'Invalid password'});
      }

      const token = randomBytes(32).toString('base64url');
      const currentTime = now();
      sessions.set(hashSessionToken(token), {
        createdAt: currentTime,
        expiresAt: currentTime + SESSION_TTL_MS,
        lastSeenAt: currentTime,
      });

      return json(200, {authenticated: true}, {
        'set-cookie': cookieHeader(token, {
          secure: secureCookie,
          maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
        }),
      });
    }

    return json(404, {error: 'Not found'});
  }

  function requireSession(request) {
    return Boolean(getSessionFromRequest(request));
  }

  return {handle, requireSession};
}
