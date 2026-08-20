import {stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';

export async function resolveStaticFile(root, pathname, isRscRequest = false) {
  let relative;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (relative.split('/').includes('..')) return null;

  const candidate = resolve(root, relative || 'index');
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;

  const attempts = [];
  if (isRscRequest && !extname(candidate)) attempts.push(`${candidate}.txt`);
  if (!extname(candidate)) attempts.push(`${candidate}.html`, resolve(candidate, 'index.html'));
  else attempts.push(candidate);

  for (const file of attempts) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}
