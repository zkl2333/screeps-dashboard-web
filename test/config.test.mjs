import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.mjs';

test('loads fixed account config without exposing token in public config', async () => {
  const config = await loadConfig({env: {
    SCREEPS_BASE_URL: 'https://screeps.com',
    SCREEPS_USERNAME: 'player',
    SCREEPS_TOKEN: 'secret-token',
    SCREEPS_ALLOWED_ORIGINS: 'https://screeps.com',
  }});
  assert.equal(config.baseUrl, 'https://screeps.com');
  assert.equal(config.username, 'player');
  assert.equal(config.token, 'secret-token');
  assert.equal(config.ready, true);
  assert.deepEqual(config.public, {
    baseUrl: 'https://screeps.com',
    username: 'player',
    configured: true,
    realtimePath: '/socket/websocket',
  });
  assert.equal('token' in config.public, false);
});

test('reads token from a Docker secret file', async () => {
  const config = await loadConfig({
    env: {SCREEPS_CONFIG_FILE: '/config/dashboard.json'},
    readFileImpl: async (path) => {
      if (path === '/config/dashboard.json') return JSON.stringify({baseUrl: 'https://screeps.com', username: 'player', tokenFile: '/run/secrets/token'});
      if (path === '/run/secrets/token') return 'file-token\n';
      throw new Error(`unexpected file: ${path}`);
    },
  });
  assert.equal(config.ready, true);
  assert.equal(config.token, 'file-token');
});

test('rejects a base URL outside the allowlist', async () => {
  await assert.rejects(
    loadConfig({env: {SCREEPS_BASE_URL: 'https://private.example', SCREEPS_ALLOWED_ORIGINS: 'https://screeps.com'}}),
    /SCREEPS_BASE_URL must be present/
  );
});
