import { spawnSync } from 'node:child_process';

/**
 * Manages the application stack, scoped to the services in the active Compose profile.
 *
 * `docker compose down --remove-orphans` was previously used to get a clean start, but `down` is
 * not profile-scoped: it removes every container in the project, including a running DSpace
 * profile. `down --volumes` would go further and destroy the DSpace assetstore and databases. This
 * script inspects each service instead and touches only the containers that need it, leaving
 * everything else — DSpace above all — alone.
 *
 * Usage:
 *   node tools/scripts/stack.mjs                 reconcile, then start and attach
 *   node tools/scripts/stack.mjs --detach        start detached
 *   node tools/scripts/stack.mjs --recreate      force-recreate every stack container
 *   node tools/scripts/stack.mjs --rebuild       rebuild images, then force-recreate
 *   node tools/scripts/stack.mjs --stop          stop the stack, keep containers
 *   node tools/scripts/stack.mjs --reset         stop and remove stack containers, keep volumes
 */
const args = new Set(process.argv.slice(2));
const forceRecreate = args.has('--recreate') || args.has('--rebuild');
const rebuildImages = args.has('--rebuild');
const detach = args.has('--detach') || args.has('-d');
const stopOnly = args.has('--stop');
const resetOnly = args.has('--reset');

function docker(commandArgs, { capture = false } = {}) {
  const result = spawnSync('docker', commandArgs, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(`Unable to run docker: ${result.error.message}`);
  }

  return result;
}

/**
 * Services in the active profile only. Compose scopes `config --services` by profile, so the
 * DSpace services are absent unless COMPOSE_PROFILES asks for them — which is exactly the
 * boundary this script must not cross.
 */
function stackServices() {
  const result = docker(['compose', 'config', '--services'], { capture: true });
  if (result.status !== 0) {
    throw new Error(
      `Unable to read Compose services: ${result.stderr?.trim() || `exit ${result.status}`}`,
    );
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function containersByService() {
  const result = docker(['compose', 'ps', '--all', '--format', 'json'], {
    capture: true,
  });
  if (result.status !== 0) {
    return new Map();
  }

  const containers = new Map();
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const container = JSON.parse(trimmed);
      if (container.Service) {
        containers.set(container.Service, container);
      }
    } catch {
      // A malformed line means we simply have no state for that service, and it gets recreated.
    }
  }
  return containers;
}

/**
 * Decides what to do with one service.
 *
 * Only broken containers are removed. A healthy container is left alone so that restarting the UI
 * does not throw away a warm database, and Compose's own change detection still handles config or
 * image drift on `up`.
 */
function planFor(container) {
  if (!container) {
    return { action: 'create', reason: 'no container yet' };
  }

  const state = (container.State ?? '').toLowerCase();
  const health = (container.Health ?? '').toLowerCase();

  if (health === 'unhealthy') {
    return { action: 'recreate', reason: 'container is unhealthy' };
  }

  if (state === 'running') {
    return {
      action: 'keep',
      reason: health ? `running (${health})` : 'running',
    };
  }

  if (state === 'restarting') {
    return { action: 'recreate', reason: 'stuck restarting' };
  }

  if (state === 'dead' || state === 'removing') {
    return { action: 'recreate', reason: `container is ${state}` };
  }

  if (state === 'exited') {
    const exitCode = Number(container.ExitCode ?? 0);
    return exitCode === 0
      ? { action: 'start', reason: 'exited cleanly' }
      : { action: 'recreate', reason: `exited with code ${exitCode}` };
  }

  return {
    action: 'recreate',
    reason: state ? `unexpected state ${state}` : 'unknown state',
  };
}

const services = stackServices();
if (services.length === 0) {
  throw new Error('No Compose services found in the active profile.');
}

const containers = containersByService();

function reportUntouched() {
  const untouched = [...containers.keys()].filter(
    (service) => !services.includes(service),
  );
  if (untouched.length > 0) {
    console.log(
      `Leaving other project containers alone: ${untouched.join(', ')}`,
    );
  }
}

if (stopOnly || resetOnly) {
  const verb = resetOnly ? 'Removing' : 'Stopping';
  console.log(`${verb} stack services: ${services.join(', ')}`);
  reportUntouched();

  const result = resetOnly
    ? docker(['compose', 'rm', '--stop', '--force', ...services])
    : docker(['compose', 'stop', ...services]);
  process.exit(result.status ?? 0);
}

if (!checkLockfile()) {
  process.exit(1);
}

const plans = services.map((service) => ({
  service,
  ...planFor(containers.get(service)),
}));

console.log('Stack services in the active Compose profile:\n');
for (const plan of plans) {
  const label = forceRecreate ? 'recreate' : plan.action;
  console.log(`  ${plan.service.padEnd(16)} ${label.padEnd(9)} ${plan.reason}`);
}

console.log();
reportUntouched();

const toRecreate = forceRecreate
  ? services
  : plans
      .filter((plan) => plan.action === 'recreate')
      .map((plan) => plan.service);

if (toRecreate.length > 0 && !forceRecreate) {
  console.log(`\nRemoving broken containers: ${toRecreate.join(', ')}`);
  const removed = docker(['compose', 'rm', '--stop', '--force', ...toRecreate]);
  if (removed.status !== 0) {
    throw new Error(`Unable to remove containers: exit ${removed.status}`);
  }
}

if (rebuildImages) {
  console.log('\nRebuilding images...');
  const built = docker(['compose', 'build', ...services]);
  if (built.status !== 0) {
    process.exit(built.status ?? 1);
  }
}

/**
 * A lockfile that disagrees with package.json is the most likely reason the UI container dies,
 * and the least obvious from the logs: the container installs with `--frozen-lockfile`, so it
 * exits immediately with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH while every other service keeps running
 * and printing healthy output. Checking it here turns a confusing hang into a sentence.
 */
function checkLockfile() {
  const check = spawnSync(
    'pnpm',
    ['install', '--lockfile-only', '--frozen-lockfile', '--ignore-scripts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true },
  );

  // If pnpm cannot be run at all, let Compose proceed rather than blocking on a check.
  if (check.error || check.status === 0) {
    return true;
  }

  const output = `${check.stdout ?? ''}${check.stderr ?? ''}`;
  console.error(
    '\n  Stack startup aborted: the pnpm lockfile does not match package.json.\n\n' +
      '  The discovery-ui container installs with --frozen-lockfile and would exit\n' +
      '  immediately with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.\n\n' +
      '  Fix:\n' +
      '    pnpm install --no-frozen-lockfile\n\n' +
      '  Then commit the regenerated pnpm-lock.yaml alongside the package.json change,\n' +
      '  and retry:\n' +
      '    pnpm start:all\n',
  );
  if (output.trim()) {
    console.error('  pnpm reported:\n');
    process.stderr.write(
      output
        .trim()
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n') + '\n',
    );
  }
  return false;
}

const upArgs = ['compose', 'up'];
if (forceRecreate) {
  upArgs.push('--force-recreate');
}
if (detach) {
  upArgs.push('--detach');
} else {
  // Attached runs stop when any stack service exits. Without this, a dead UI leaves Postgres,
  // Solr, and the API happily logging, so a failed startup looks like a slow one.
  upArgs.push('--abort-on-container-exit');
}
upArgs.push(...services);

console.log(`\n> docker ${upArgs.join(' ')}\n`);
const up = docker(upArgs);

if ((up.status ?? 0) !== 0) {
  reportFailure(up.status ?? 1);
}

process.exit(up.status ?? 0);

/** Container exit time, used to tell the cause apart from services the abort stopped afterwards. */
function finishedAt(containerName) {
  if (!containerName) {
    return '';
  }

  const result = docker(
    ['inspect', '--format', '{{.State.FinishedAt}}', containerName],
    { capture: true },
  );
  return result.status === 0 ? result.stdout.trim() : '';
}

/**
 * Names the service that actually failed and shows its last output.
 *
 * `--abort-on-container-exit` stops every other service once one dies, so they all end up exited
 * with 143 (SIGTERM). Reporting whichever appears first would blame collateral damage — a killed
 * UI would be reported as a Solr failure. The cause is the container that finished *earliest*, so
 * exit times are read from Docker and the earliest exiter is the one whose logs are shown.
 */
function reportFailure(exitStatus) {
  const containers = containersByService();
  const failed = services
    .map((service) => ({ service, container: containers.get(service) }))
    .filter(({ container }) => {
      const state = (container?.State ?? '').toLowerCase();
      return state === 'exited' && Number(container?.ExitCode ?? 0) !== 0;
    })
    .map((entry) => ({
      ...entry,
      finishedAt: finishedAt(entry.container?.Name),
    }))
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt));

  console.error(`\n  Stack startup failed (exit code ${exitStatus}).\n`);

  if (failed.length === 0) {
    console.error(
      '  No stack service reported a non-zero exit. Inspect the current state with:\n' +
        '    pnpm run docker:ps\n',
    );
    return;
  }

  const [cause, ...stoppedByAbort] = failed;
  console.error(
    `  ${cause.service} exited first, with code ${cause.container.ExitCode}. Last log lines:\n`,
  );
  docker(['compose', 'logs', '--tail=40', cause.service]);

  if (stoppedByAbort.length > 0) {
    console.error(
      `\n  Stopped by the abort, not the cause: ${stoppedByAbort
        .map((entry) => `${entry.service} (${entry.container.ExitCode})`)
        .join(', ')}`,
    );
  }

  console.error(
    '\n  Full logs:\n' +
      '    pnpm run docker:logs\n\n' +
      '  If discovery-ui reported ERR_PNPM_LOCKFILE_CONFIG_MISMATCH:\n' +
      '    pnpm install --no-frozen-lockfile\n',
  );
}
