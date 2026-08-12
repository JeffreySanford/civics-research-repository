import { spawn, spawnSync } from 'node:child_process';

/**
 * Runs the three Playwright evidence suites against one dev server.
 *
 * `quality:all` used to run `storyboard`, `wcag:report`, and `section508:report` as three separate
 * Playwright invocations, and each one started and stopped its own dev server. That is three
 * start/stop cycles on the same port, back to back, and it flaked: a run would begin while the
 * previous server was still shutting down. Both outcomes were seen. If the dying server still
 * answers the probe, `reuseExistingServer` attaches to it and the tests fail with connection
 * refused when it finishes exiting. If it has stopped answering but has not released the port, the
 * new server cannot bind and Playwright reports "webServer was not able to start".
 *
 * One server for all three suites removes the race rather than widening the window it happens in.
 * Each Playwright run then finds a healthy server and reuses it, which is what
 * `reuseExistingServer: true` in the config is for.
 *
 * An already-running server is reused and deliberately left running: a developer who has
 * `pnpm start` up should not have it killed by running the reports.
 */
const PORT = 4300;
const BASE_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 180_000;
const PROBE_INTERVAL_MS = 500;

const suites = [
  { name: 'storyboard', grep: '@storyboard', reporter: 'line' },
  { name: 'wcag', grep: '@wcag', reporter: 'list' },
  { name: 'section508', grep: '@section508', reporter: 'list' },
];

async function isServing() {
  try {
    const response = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function waitUntilServing(deadline, child) {
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      return false;
    }

    if (await isServing()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, PROBE_INTERVAL_MS));
  }

  return false;
}

/**
 * Windows `child.kill()` terminates only the named process, so killing the launcher would leave
 * pnpm, Nx, and Vite behind still holding the port — the orphan that made the next run flake.
 */
function killTree(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  child.kill('SIGTERM');
}

function runSuite(suite) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config=apps/discovery-ui-e2e/playwright.config.mts',
      `--grep=${suite.grep}`,
      `--reporter=${suite.reporter}`,
    ],
    { stdio: 'inherit', shell: true },
  );

  return result.status ?? 1;
}

const alreadyServing = await isServing();
let server = null;

if (alreadyServing) {
  console.log(`Reusing the dev server already answering on ${BASE_URL}.\n`);
} else {
  console.log(
    `Starting one dev server on ${BASE_URL} for all report suites.\n`,
  );
  server = spawn('node', ['tools/scripts/start-discovery-ui-web-server.mjs'], {
    stdio: 'inherit',
    shell: false,
  });

  const ready = await waitUntilServing(Date.now() + READY_TIMEOUT_MS, server);
  if (!ready) {
    killTree(server);
    console.error(
      `\n  The dev server did not answer on ${BASE_URL} within ` +
        `${READY_TIMEOUT_MS / 1000}s.\n\n` +
        '  Check for a stale process still holding the port, then retry:\n' +
        '    pnpm run e2e:reports\n',
    );
    process.exit(1);
  }
}

let exitCode = 0;

try {
  for (const suite of suites) {
    console.log(`\n> Playwright suite: ${suite.name} (${suite.grep})\n`);
    const status = runSuite(suite);

    if (status !== 0) {
      console.error(`\n  The ${suite.name} suite failed (exit ${status}).\n`);
      exitCode = status;
      break;
    }
  }
} finally {
  // Only a server this script started is ours to stop.
  if (server) {
    killTree(server);
  }
}

process.exit(exitCode);
