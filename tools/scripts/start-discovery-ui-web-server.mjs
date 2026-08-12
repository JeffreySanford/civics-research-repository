import { spawn } from 'node:child_process';

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

const stop = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
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
