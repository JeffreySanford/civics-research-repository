import { spawn, spawnSync } from 'node:child_process';

const env = { ...process.env };

for (const key of Object.keys(env)) {
  if (key.startsWith('NX_TASK_')) {
    delete env[key];
  }
}

const child =
  process.platform === 'win32'
    ? spawn(
        'cmd.exe',
        ['/d', '/s', '/c', 'pnpm exec nx run discovery-ui:serve --port=4300'],
        {
          env,
          stdio: 'inherit',
        },
      )
    : spawn(
        'pnpm',
        ['exec', 'nx', 'run', 'discovery-ui:serve', '--port=4300'],
        {
          env,
          stdio: 'inherit',
        },
      );

/**
 * Windows `child.kill()` terminates only the named process. Here that is `cmd.exe`, so pnpm, Nx,
 * and Vite would survive it and keep holding port 4300 — an orphan that makes the next Playwright
 * run either attach to a server that is about to die or fail to bind the port. Kill the tree.
 */
const stop = (signal) => {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  child.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
