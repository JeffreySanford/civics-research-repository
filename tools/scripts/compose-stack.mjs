import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DSPACE_URL =
  process.env.DSPACE_BASE_URL ?? 'http://localhost:8081/server';
export const API_URL =
  process.env.CIVICS_API_URL ?? 'http://localhost:8080/api';
export const UI_URL = process.env.CIVICS_UI_URL ?? 'http://localhost:4200';

export const STACK_SERVICES = [
  'postgres',
  'solr',
  'opensearch',
  'repository-api',
  'discovery-ui',
];
export const DSPACE_UP_SERVICES = ['dspace-rest'];
export const DSPACE_SHUTDOWN_SERVICES = [
  'dspace-rest',
  'dspace-db-init',
  'dspace-seed',
  'dspace-postgres',
  'dspace-solr',
  'dspace-solr-init',
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..', '..');
const catalogPath = join(repoRoot, 'tools', 'dspace', 'catalog.json');
const safRoot = join(repoRoot, 'tools', 'dspace', 'saf');
const safStampPath = join(safRoot, '.generated-from-catalog');

export function docker(
  commandArgs,
  { capture = false, allowFailure = false } = {},
) {
  const result = spawnSync('docker', commandArgs, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(`Unable to run docker: ${result.error.message}`);
  }

  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `docker ${commandArgs.join(' ')} failed with exit code ${result.status}.`,
    );
  }

  return result;
}

function composePrefix(profile) {
  const prefix = ['compose'];
  if (profile) {
    prefix.push('--profile', profile);
  }
  return prefix;
}

/**
 * Services in the active profile only. Compose scopes `config --services` by profile.
 */
export function stackServices(profile) {
  const result = docker([...composePrefix(profile), 'config', '--services'], {
    capture: true,
  });
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

export function containersByService(profile) {
  const result = docker(
    [...composePrefix(profile), 'ps', '--all', '--format', 'json'],
    { capture: true, allowFailure: true },
  );
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
      // A malformed line means we simply have no state for that service.
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
export function planFor(container) {
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

  if (state === 'created' || state === 'paused') {
    return { action: 'start', reason: `container is ${state}` };
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

function reportUntouched(activeServices, profile) {
  const containers = containersByService(profile);
  const untouched = [...containers.keys()].filter(
    (service) => !activeServices.includes(service),
  );
  if (untouched.length > 0) {
    console.log(
      `Leaving other project containers alone: ${untouched.join(', ')}`,
    );
  }
}

/**
 * A lockfile that disagrees with package.json is the most likely reason the UI container dies,
 * and the least obvious from the logs: the container installs with `--frozen-lockfile`, so it
 * exits immediately with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH while every other service keeps running
 * and printing healthy output. Checking it here turns a confusing hang into a sentence.
 */
export function checkLockfile() {
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

function finishedAt(containerName) {
  if (!containerName) {
    return '';
  }

  const result = docker(
    ['inspect', '--format', '{{.State.FinishedAt}}', containerName],
    { capture: true, allowFailure: true },
  );
  return result.status === 0 ? result.stdout.trim() : '';
}

/**
 * Names the service that actually failed and shows its last output.
 *
 * `--abort-on-container-exit` stops every other service once one dies, so they all end up exited
 * with 143 (SIGTERM). Reporting whichever appears first would blame collateral damage — a killed
 * UI would be reported as a Solr failure. The cause is the container that finished *earliest*.
 */
export function reportFailure(services, exitStatus, profile) {
  const containers = containersByService(profile);
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
  docker([...composePrefix(profile), 'logs', '--tail=40', cause.service], {
    allowFailure: true,
  });

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

/**
 * Inspects each service, removes only broken containers, optionally rebuilds images, then starts.
 */
export function reconcileAndUp(services, options = {}) {
  const {
    profile,
    forceRecreate = false,
    rebuildImages = false,
    detach = false,
    label = 'stack',
  } = options;

  if (services.length === 0) {
    throw new Error(`No Compose services found for ${label}.`);
  }

  const containers = containersByService(profile);
  const plans = services.map((service) => ({
    service,
    ...planFor(containers.get(service)),
  }));

  console.log(`${label} services:\n`);
  for (const plan of plans) {
    const actionLabel = forceRecreate ? 'recreate' : plan.action;
    console.log(
      `  ${plan.service.padEnd(16)} ${actionLabel.padEnd(9)} ${plan.reason}`,
    );
  }

  console.log();
  reportUntouched(services, profile);

  const toRecreate = forceRecreate
    ? services
    : plans
        .filter((plan) => plan.action === 'recreate')
        .map((plan) => plan.service);

  if (toRecreate.length > 0 && !forceRecreate) {
    console.log(`\nRemoving broken containers: ${toRecreate.join(', ')}`);
    docker([
      ...composePrefix(profile),
      'rm',
      '--stop',
      '--force',
      ...toRecreate,
    ]);
  }

  if (rebuildImages) {
    console.log('\nRebuilding images...');
    docker([...composePrefix(profile), 'build', ...services]);
  }

  const upArgs = [...composePrefix(profile), 'up'];
  if (forceRecreate) {
    upArgs.push('--force-recreate');
  }
  if (detach) {
    upArgs.push('-d');
  } else {
    // Attached runs stop when any stack service exits. Without this, a dead UI leaves Postgres,
    // Solr, and the API happily logging, so a failed startup looks like a slow one.
    upArgs.push('--abort-on-container-exit');
  }
  upArgs.push(...services);

  console.log(`\n> docker ${upArgs.join(' ')}\n`);
  const up = docker(upArgs, { allowFailure: !detach });

  if ((up.status ?? 0) !== 0) {
    reportFailure(services, up.status ?? 1, profile);
  }

  return up.status ?? 0;
}

export async function waitFor(
  label,
  url,
  { timeoutMs = 240000, intervalMs = 3000, check } = {},
) {
  const startedAt = Date.now();
  let lastError = 'no response yet';

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok && (!check || (await check(response)))) {
        console.log(`    ${label} is ready.`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `${label} was not ready within ${Math.round(timeoutMs / 1000)}s (${lastError}). ` +
      `Check the logs with: pnpm run docker:logs`,
  );
}

function catalogStamp() {
  const stat = statSync(catalogPath);
  return `${stat.mtimeMs}:${stat.size}`;
}

function safPackagesPresent() {
  if (!existsSync(safRoot)) {
    return false;
  }

  return readdirSync(safRoot, { withFileTypes: true }).some(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
  );
}

export function needsSafGeneration() {
  if (!safPackagesPresent()) {
    return true;
  }

  if (!existsSync(safStampPath)) {
    return true;
  }

  return readFileSync(safStampPath, 'utf8').trim() !== catalogStamp();
}

export function generateSafIfNeeded({ force = false } = {}) {
  if (!force && !needsSafGeneration()) {
    console.log('    SAF packages are up to date; skipping generation.');
    return 0;
  }

  const generated = spawnSync(
    process.execPath,
    ['tools/scripts/generate-saf.mjs'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );
  if (generated.status !== 0) {
    throw new Error('SAF generation failed.');
  }
  return generated.status ?? 0;
}

export async function runReindex(profile) {
  const profileQuery = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  const reindex = await fetch(`${API_URL}/admin/reindex${profileQuery}`, {
    method: 'POST',
  });
  if (!reindex.ok) {
    const body = await reindex.text();
    throw new Error(
      `Reindex failed with HTTP ${reindex.status}${body ? `: ${body}` : '.'}`,
    );
  }

  const projection = await reindex.json();
  const profileLabel = profile ? ` for ${profile}` : '';
  console.log(
    `    Indexed ${projection.objectCount} research objects${profileLabel} (source: ${projection.source}).`,
  );

  if (projection.source !== 'REPOSITORY') {
    console.warn(
      '    WARNING: the discovery projection is serving FIXTURE data, which means the selected profile\n' +
        '    returned no authoritative items. Check: pnpm run dspace:verify:seed',
    );
  }

  return projection;
}

/**
 * Waits for Java startup search initialization. A fresh install activates the requested quick-start
 * profile. Ordinary restarts intentionally preserve a durably activated operator profile instead;
 * in that case Java rehydrates the existing projection identity without rebuilding either index.
 */
export async function verifyStartupProfile(profile = 'CURATED_DEMO') {
  let terminalProgress;
  let preservedProfile = null;

  await waitFor(
    'startup search projection',
    `${API_URL}/admin/reindex/progress`,
    {
      intervalMs: 500,
      check: async (response) => {
        const progress = await response.json();
        if (progress.profile === profile) {
          if (progress.phase === 'FAILED') {
            throw new Error(progress.message || `${profile} activation failed.`);
          }
          if (progress.phase === 'COMPLETED') {
            terminalProgress = progress;
            return true;
          }
          return false;
        }

        // A durable non-demo activation is deliberately preserved by SearchIndexStartupRunner.
        // Verify the persisted active profile and the rehydrated non-empty repository projection
        // instead of waiting forever for a CURATED_DEMO activation Java correctly never started.
        const [storageResponse, projectionResponse] = await Promise.all([
          fetch(`${API_URL}/admin/corpus/storage`),
          fetch(`${API_URL}/admin/reindex`),
        ]);
        if (!storageResponse.ok || !projectionResponse.ok) {
          return false;
        }

        const storage = await storageResponse.json();
        const projection = await projectionResponse.json();
        const activeProfile = storage?.activeProfile;
        const projectionReady =
          projection?.source === 'REPOSITORY' &&
          Number.isInteger(projection?.objectCount) &&
          projection.objectCount > 0 &&
          typeof projection?.projectionId === 'string' &&
          /^[0-9a-f]{64}$/u.test(projection.projectionId);

        if (activeProfile && activeProfile !== profile && projectionReady) {
          preservedProfile = activeProfile;
          return true;
        }
        return false;
      },
    },
  );

  const projectionResponse = await fetch(`${API_URL}/admin/reindex`);
  if (!projectionResponse.ok) {
    const body = await projectionResponse.text();
    throw new Error(
      `Unable to read startup projection with HTTP ${projectionResponse.status}${
        body ? `: ${body}` : '.'
      }`,
    );
  }

  const projection = await projectionResponse.json();
  const verifiedProfile = preservedProfile ?? profile;
  console.log(
    `    Verified ${verifiedProfile}: ${projection.objectCount} searchable research objects (source: ${projection.source}).`,
  );
  if (preservedProfile) {
    console.log(
      `    Preserved durable ${preservedProfile} activation; startup did not replace it with ${profile}.`,
    );
  }
  if (terminalProgress?.elapsedMs !== undefined) {
    console.log(
      `    Startup projection completed in ${terminalProgress.elapsedMs} ms.`,
    );
  }

  if (projection.source !== 'REPOSITORY') {
    console.warn(
      '    WARNING: the discovery projection is serving FIXTURE data, which means the selected profile\n' +
        '    returned no authoritative items. Check: pnpm run dspace:verify:seed',
    );
  }

  return projection;
}

export function printStartupUrls({ stopCommand = 'pnpm run demo:down' } = {}) {
  console.log(`
The stack is running.

  Discovery UI      ${UI_URL}
  Repository API    ${API_URL}
  DSpace REST       ${DSPACE_URL}/api
  Discovery Solr    http://localhost:8983/solr
  OpenSearch        http://localhost:9200
  DSpace Solr       http://localhost:8984/solr

Fresh-install search profile: CURATED_DEMO (fast curated repository projection).
A durably activated operator profile is preserved across ordinary application restarts.
Retained federated metadata remains preserved independently in application PostgreSQL.

Worth showing, in order:

  1. ${UI_URL}/discovery          search and facets, served from the active corpus profile
  2. ${UI_URL}/datasets/tiger-line-north-dakota-2025
                                             repository metadata, files, citation, related research
  3. ${UI_URL}/maps               MapLibre with live USGS overlay and an accessible feature list
  4. ${UI_URL}/admin/sync         sync plus corpus-profile/storage administration
  5. ${UI_URL}/evidence           WCAG and Section 508 status
  6. ${UI_URL}/search-lab         Solr/OpenSearch comparison on the active projection

Stop with: ${stopCommand}
`);
}

let step = 0;

export function announce(message) {
  step += 1;
  console.log(`\n[${step}] ${message}`);
}

export function resetAnnouncements() {
  step = 0;
}

/**
 * Brings up DSpace, seeds, starts the application stack, verifies Java's startup search state, and
 * waits for the UI. Fresh installs use CURATED_DEMO; ordinary restarts preserve a durable operator
 * activation such as FEDERATED_1M without rebuilding its derived indexes.
 */
export async function runFullStartup({
  forceRecreate = false,
  rebuildImages = false,
  detach = true,
} = {}) {
  resetAnnouncements();

  if (!checkLockfile()) {
    return 1;
  }

  announce('Starting DSpace (PostgreSQL, Solr, database migration, REST)');
  console.log(
    '    First run performs the DSpace database migration and can take several minutes.',
  );
  reconcileAndUp(DSPACE_UP_SERVICES, {
    profile: 'dspace',
    forceRecreate,
    rebuildImages,
    detach: true,
    label: 'DSpace',
  });

  announce('Waiting for the DSpace REST API');
  await waitFor('DSpace REST', `${DSPACE_URL}/api`);

  announce('Generating SAF packages from tools/dspace/catalog.json');
  generateSafIfNeeded();

  announce(
    'Seeding the repository (community, collection, crr schema, research objects)',
  );
  docker(['compose', '--profile', 'dspace', 'run', '--rm', 'dspace-seed']);

  announce(
    'Starting the application stack (PostgreSQL, Solr, OpenSearch, Java API, Angular UI)',
  );
  const exitStatus = reconcileAndUp(STACK_SERVICES, {
    forceRecreate,
    rebuildImages,
    detach,
    label: 'Application',
  });

  if (detach) {
    if (exitStatus !== 0) {
      process.exit(exitStatus);
    }

    announce('Waiting for the repository API');
    await waitFor('Repository API', `${API_URL}/health`);

    announce('Verifying the startup search profile');
    await verifyStartupProfile('CURATED_DEMO');

    announce(
      'Waiting for the Angular UI (first run installs dependencies and builds)',
    );
    await waitFor('Discovery UI', UI_URL, { timeoutMs: 300000 });

    printStartupUrls();
    return 0;
  }

  // Attached mode: reconcileAndUp blocks until a service exits. Success means the user stopped
  // the session; detached mode is better for daily use with the full stack.
  return exitStatus;
}

export function runShutdown() {
  resetAnnouncements();
  announce(
    'Stopping the application stack and the DSpace profile (volumes are kept)',
  );
  docker(
    [
      'compose',
      '--profile',
      'dspace',
      'stop',
      ...STACK_SERVICES,
      ...DSPACE_SHUTDOWN_SERVICES,
    ],
    { allowFailure: true },
  );
  console.log(
    '\nStack stopped. Data is preserved; run `pnpm run start:all` to bring it back, or ' +
      '`pnpm run docker:reset:everything` to erase all volumes.',
  );
}

export function stopStackServices(services, { reset = false, profile } = {}) {
  const verb = reset ? 'Removing' : 'Stopping';
  console.log(`${verb} stack services: ${services.join(', ')}`);
  reportUntouched(services, profile);

  const result = reset
    ? docker(
        [...composePrefix(profile), 'rm', '--stop', '--force', ...services],
        {
          allowFailure: true,
        },
      )
    : docker([...composePrefix(profile), 'stop', ...services], {
        allowFailure: true,
      });
  return result.status ?? 0;
}
