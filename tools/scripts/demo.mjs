import { spawnSync } from 'node:child_process';

/**
 * Brings up the entire demo with one command, in the order the demo actually requires.
 *
 * `start:all` deliberately excludes DSpace so routine development does not pay its startup cost.
 * That is the right default for development and the wrong one for a demonstration, where the
 * sequence matters: DSpace must be migrated and seeded *before* the API starts, or the API's
 * startup sync runs against an empty repository and reports a failure that looks like a bug.
 *
 * Usage:
 *   node tools/scripts/demo.mjs            start everything, seed, sync, reindex, print URLs
 *   node tools/scripts/demo.mjs --down     stop everything, keeping all volumes
 */
const args = new Set(process.argv.slice(2));
const shuttingDown = args.has('--down');

const DSPACE_URL =
  process.env.DSPACE_BASE_URL ?? 'http://localhost:8081/server';
const API_URL = process.env.CIVICS_API_URL ?? 'http://localhost:8080/api';
const UI_URL = process.env.CIVICS_UI_URL ?? 'http://localhost:4200';

const STACK_SERVICES = ['postgres', 'solr', 'repository-api', 'discovery-ui'];
const DSPACE_SERVICES = [
  'dspace-rest',
  'dspace-db-init',
  'dspace-seed',
  'dspace-postgres',
  'dspace-solr',
  'dspace-solr-init',
];

let step = 0;

function announce(message) {
  step += 1;
  console.log(`\n[${step}] ${message}`);
}

function docker(commandArgs, { allowFailure = false } = {}) {
  const result = spawnSync('docker', commandArgs, {
    stdio: 'inherit',
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
  return result.status ?? 0;
}

async function waitFor(
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

if (shuttingDown) {
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
      ...DSPACE_SERVICES,
    ],
    {
      allowFailure: true,
    },
  );
  console.log(
    '\nDemo stopped. Data is preserved; run `pnpm run demo:up` to bring it back, or ' +
      '`pnpm run docker:reset:everything` to erase all volumes.',
  );
  process.exit(0);
}

announce('Starting DSpace (PostgreSQL, Solr, database migration, REST)');
console.log(
  '    First run performs the DSpace database migration and can take several minutes.',
);
docker(['compose', '--profile', 'dspace', 'up', '-d', 'dspace-rest']);

announce('Waiting for the DSpace REST API');
await waitFor('DSpace REST', `${DSPACE_URL}/api`);

announce(
  'Seeding the repository (community, collection, crr schema, research objects)',
);
docker(['compose', '--profile', 'dspace', 'run', '--rm', 'dspace-seed']);

announce(
  'Starting the application stack (PostgreSQL, Solr, Java API, Angular UI)',
);
docker(['compose', 'up', '-d', ...STACK_SERVICES]);

announce('Waiting for the repository API');
await waitFor('Repository API', `${API_URL}/health`);

// The API projects DSpace into the discovery core at startup. If it happened to boot before the
// seed finished, this makes the demo correct anyway rather than leaving a stale projection.
announce('Rebuilding the discovery projection from DSpace');
const reindex = await fetch(`${API_URL}/admin/reindex`, { method: 'POST' });
const projection = await reindex.json();
console.log(
  `    Indexed ${projection.objectCount} research objects (source: ${projection.source}).`,
);

if (projection.source !== 'REPOSITORY') {
  console.warn(
    '    WARNING: the discovery projection is serving FIXTURE data, which means the repository\n' +
      '    returned no items. The UI will show a placeholder-data notice. Check: pnpm run dspace:verify:seed',
  );
}

announce(
  'Waiting for the Angular UI (first run installs dependencies and builds)',
);
await waitFor('Discovery UI', UI_URL, { timeoutMs: 300000 });

console.log(`
The demo is running.

  Discovery UI      ${UI_URL}
  Repository API    ${API_URL}
  DSpace REST       ${DSPACE_URL}/api
  Discovery Solr    http://localhost:8983/solr
  DSpace Solr       http://localhost:8984/solr

Worth showing, in order:

  1. ${UI_URL}/discovery          search and facets, served from DSpace
  2. ${UI_URL}/datasets/tiger-line-north-dakota-2025
                                             repository metadata, files, citation, related research
  3. ${UI_URL}/maps               MapLibre with live USGS overlay and an accessible feature list
  4. ${UI_URL}/admin/sync         dry-run, diff, and apply against the live repository
  5. ${UI_URL}/evidence           WCAG and Section 508 status

Stop with: pnpm run demo:down
`);
