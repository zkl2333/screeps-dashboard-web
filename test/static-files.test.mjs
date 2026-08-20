import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveStaticFile} from '../server/static-files.mjs';

test('serves HTML for document routes and RSC text for Next navigation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'screeps-static-'));
  await writeFile(join(root, 'user.html'), '<html>user</html>');
  await writeFile(join(root, 'user.txt'), 'RSC USER');

  assert.equal(await resolveStaticFile(root, '/user', false), join(root, 'user.html'));
  assert.equal(await resolveStaticFile(root, '/user', true), join(root, 'user.txt'));
});

test('resolves index routes and rejects traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'screeps-static-'));
  await writeFile(join(root, 'index.html'), '<html>index</html>');
  await writeFile(join(root, 'index.txt'), 'RSC INDEX');

  assert.equal(await resolveStaticFile(root, '/', false), join(root, 'index.html'));
  assert.equal(await resolveStaticFile(root, '/', true), join(root, 'index.txt'));
  assert.equal(await resolveStaticFile(root, '/../secret', false), null);
});
