import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const children = [
  spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', '-p', '3001'], {
    cwd: resolve('src-next'),
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit',
    env: {...process.env, PORT: '3000', STATIC_DIR: 'src-next/out'},
  }),
];

let shuttingDown = false;
function shutdown(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const child of children) {
  child.on('error', error => {
    console.error(`[dev] failed to start process: ${error.message}`);
    shutdown();
    process.exitCode = 1;
  });
  child.on('exit', code => {
    if (!shuttingDown && code !== 0) {
      process.exitCode = code ?? 1;
      shutdown();
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
