import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthHandler} from '../server/auth.mjs';
import {createProxyHandler} from '../server/proxy.mjs';

function request(url, {method = 'GET', body, headers = {}} = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {'content-type': 'application/json', ...headers},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(response) {
  return response.headers.get('set-cookie') ?? '';
}

test('rejects login without a configured administrator password', async () => {
  const auth = createAuthHandler({adminPassword: ''});
  const response = await auth.handle(request('/api/auth/login', {method: 'POST', body: {password: 'secret'}}));
  assert.equal(response.status, 503);
});

test('issues a session cookie for a valid administrator password', async () => {
  const auth = createAuthHandler({adminPassword: 'correct-password'});
  const failed = await auth.handle(request('/api/auth/login', {method: 'POST', body: {password: 'wrong'}}));
  assert.equal(failed.status, 401);

  const success = await auth.handle(request('/api/auth/login', {method: 'POST', body: {password: 'correct-password'}}));
  assert.equal(success.status, 200);
  const cookie = cookieFrom(success);
  assert.match(cookie, /dashboard_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);

  const sessionCookie = cookie.split(';')[0];
  const session = await auth.handle(request('/api/auth/session', {headers: {cookie: sessionCookie}}));
  assert.equal(session.status, 200);
  const sessionPayload = await session.json();
  assert.equal(sessionPayload.authenticated, true);
  assert.equal(typeof sessionPayload.expiresAt, 'number');
});

test('logout clears the session cookie', async () => {
  const auth = createAuthHandler({adminPassword: 'secret'});
  const login = await auth.handle(request('/api/auth/login', {method: 'POST', body: {password: 'secret'}}));
  const sessionCookie = cookieFrom(login).split(';')[0];

  const logout = await auth.handle(request('/api/auth/logout', {method: 'POST', headers: {cookie: sessionCookie}}));
  assert.equal(logout.status, 200);
  assert.match(cookieFrom(logout), /Max-Age=0/);

  const session = await auth.handle(request('/api/auth/session', {headers: {cookie: sessionCookie}}));
  assert.equal(session.status, 401);
});

test('protects the Screeps proxy behind an administrator session', async () => {
  const auth = createAuthHandler({adminPassword: 'secret'});
  const proxy = createProxyHandler({
    fetch: async () => new Response(JSON.stringify({ok: 1}), {status: 200, headers: {'content-type': 'application/json'}}),
  });

  const unauthenticated = await proxy(request('/api/screeps-proxy', {
    method: 'POST',
    body: {baseUrl: 'https://screeps.com', endpoint: '/api/auth/me', method: 'GET'},
  }));
  assert.equal(unauthenticated.status, 200);

  const login = await auth.handle(request('/api/auth/login', {method: 'POST', body: {password: 'secret'}}));
  const sessionCookie = cookieFrom(login).split(';')[0];
  assert.equal(auth.requireSession(request('/api/screeps-proxy', {method: 'POST', headers: {cookie: sessionCookie}})), true);
  assert.equal(auth.requireSession(request('/api/screeps-proxy', {method: 'POST'})), false);
});
