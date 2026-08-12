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

const upArgs = ['compose', 'up'];
if (forceRecreate) {
  upArgs.push('--force-recreate');
}
if (detach) {
  upArgs.push('--detach');
}
upArgs.push(...services);

console.log(`\n> docker ${upArgs.join(' ')}\n`);
const up = docker(upArgs);
process.exit(up.status ?? 0);
