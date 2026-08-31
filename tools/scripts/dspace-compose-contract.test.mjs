import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveStackOptions } from './stack-options.mjs';

const COMPOSE_PATH = new URL('../../docker-compose.yml', import.meta.url);

function serviceBlock(source, serviceName, nextServiceName) {
  const start = source.indexOf(`  ${serviceName}:`);
  assert.notEqual(start, -1, `docker-compose.yml is missing ${serviceName}`);
  const end = nextServiceName
    ? source.indexOf(`\n  ${nextServiceName}:`, start)
    : source.indexOf('\nvolumes:', start);
  assert.notEqual(end, -1, `unable to bound ${serviceName} service block`);
  return source.slice(start, end);
}

test('DSpace datastores remain release-matched and separate from application datastores', async () => {
  const compose = await readFile(COMPOSE_PATH, 'utf8');
  const appPostgres = serviceBlock(compose, 'postgres', 'solr');
  const dspacePostgres = serviceBlock(
    compose,
    'dspace-postgres',
    'dspace-solr',
  );
  const dspaceSolr = serviceBlock(compose, 'dspace-solr', 'dspace-solr-init');

  assert.match(appPostgres, /image: postgres:17-alpine/);
  assert.match(
    dspacePostgres,
    /image: dspace\/dspace-postgres-pgcrypto:dspace-9\.0/,
  );
  assert.doesNotMatch(dspacePostgres, /image: postgres:17/);
  assert.match(
    dspacePostgres,
    /dspace-postgres-data:\/var\/lib\/postgresql\/data/,
  );
  assert.match(dspaceSolr, /image: dspace\/dspace-solr:dspace-9\.0/);
  assert.match(dspaceSolr, /dspace-solr-data:\/var\/solr/);
});

test('DSpace seed keeps the path contract expected by seed-structure.sh', async () => {
  const compose = await readFile(COMPOSE_PATH, 'utf8');
  const dspaceSeed = serviceBlock(compose, 'dspace-seed', 'dspace-postgres');

  assert.match(dspaceSeed, /- \/seed\/seed-structure\.sh/);
  assert.match(dspaceSeed, /\.\/tools\/dspace:\/seed:ro/);
  assert.match(dspaceSeed, /dspace-assetstore:\/dspace\/assetstore/);
  assert.doesNotMatch(dspaceSeed, /DSPACE_SEED_SAF_ROOT/);
});

test('rebuild updates local images without force-recreating healthy datastores', () => {
  assert.deepEqual(resolveStackOptions(['--rebuild']), {
    forceRecreate: false,
    rebuildImages: true,
    detach: true,
    stopOnly: false,
    resetOnly: false,
  });
  assert.deepEqual(resolveStackOptions(['--recreate']), {
    forceRecreate: true,
    rebuildImages: false,
    detach: true,
    stopOnly: false,
    resetOnly: false,
  });
});
