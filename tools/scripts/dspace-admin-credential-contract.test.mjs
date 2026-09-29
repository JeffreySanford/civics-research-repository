import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const sampleText = read('.env.sample');
const sample = parseEnv(sampleText);
const local = existsSync(new URL('.env', root)) ? parseEnv(read('.env')) : null;
const compose = read('docker-compose.yml');
const seed = read('tools/dspace/seed-structure.sh');
const lineage = read('tools/scripts/dspace-version-lineage.mjs');
const application = read(
  'apps/repository-api/src/main/resources/application.yml',
);

test('bind-mounted seed script has a Linux-compatible shebang and line endings', () => {
  assert.ok(seed.startsWith('#!/bin/sh\n'), 'Seed shebang must use LF');
  assert.ok(!seed.includes('\r'), 'Seed script must use LF line endings');
});

// Compare secrets as booleans: assertion diagnostics must never include their values.
function checkCredentials(values, label) {
  for (const [suffix, expected] of [
    ['EMAIL', 'admin@civics.local'],
    ['PASSWORD', 'civics-admin'],
  ]) {
    const app = values[`CIVICS_DSPACE_ADMIN_${suffix}`];
    assert.ok(app === expected, `${label}: noncanonical development ${suffix}`);
  }
}

function missingProperties(overrides, template) {
  return Object.keys(overrides).filter(
    (name) => !Object.hasOwn(template, name),
  );
}

test('sample documents the complete explicit Compose, application and tooling environment surface', () => {
  const required = new Set([
    'COMPOSE_PROJECT_NAME',
    'CIVICS_SYNC_STARTUP_ENABLED',
    'CIVICS_SYNC_MODE',
    'CIVICS_SYNC_SOURCE',
    'CIVICS_DB_NAME',
    'CIVICS_DB_USER',
    'CIVICS_DB_PASSWORD',
    'CIVICS_SEARCH_CURSOR_SECRET',
    'CIVICS_DSPACE_BASE_URL',
    'CIVICS_DSPACE_ADMIN_EMAIL',
    'CIVICS_DSPACE_ADMIN_PASSWORD',
    'CIVICS_FEDERATION_DATA_GOV_API_KEY',
    'CIVICS_FEDERATION_NASA_CMR_CLIENT_ID',
    'CIVICS_FEDERATION_NASA_CMR_BEARER_TOKEN',
    'CIVICS_FEDERATION_PUBMED_API_KEY',
    'CIVICS_FEDERATION_PUBMED_EMAIL',
    'CIVICS_FEDERATION_OPENALEX_API_KEY',
  ]);
  for (const source of [compose, seed, application]) {
    for (const match of source.matchAll(
      /(?<!\$)\$\{((?:CIVICS_|DSPACE_SEED_)[A-Z0-9_]+)/gu,
    )) {
      required.add(match[1]);
    }
  }
  for (const file of readdirSync(new URL('tools/scripts/', root))) {
    if (!file.endsWith('.mjs') || file.endsWith('.test.mjs')) continue;
    for (const match of read(`tools/scripts/${file}`).matchAll(
      /\benv\.((?:CIVICS_|DSPACE_)[A-Z0-9_]+)/gu,
    )) {
      required.add(match[1]);
    }
  }
  assert.deepEqual(
    [...required].filter((name) => !Object.hasOwn(sample, name)),
    [],
  );
});

test(
  'local overrides are a subset of the sample',
  { skip: !local && 'No local .env in this checkout' },
  () => {
    assert.deepEqual(missingProperties(local, sample), []);
  },
);

test('sample may contain optional properties absent from local overrides', () => {
  assert.deepEqual(
    missingProperties(
      { REQUIRED: 'override' },
      { REQUIRED: 'default', OPTIONAL: '' },
    ),
    [],
  );
  assert.deepEqual(missingProperties({ UNDOCUMENTED: '' }, { OPTIONAL: '' }), [
    'UNDOCUMENTED',
  ]);
});

test(
  'local configuration uses one canonical DSpace administrator account',
  { skip: !local && 'No local .env in this checkout' },
  () => {
    checkCredentials(local, 'local');
  },
);

test('sample uses one canonical DSpace administrator account', () => {
  checkCredentials(sample, 'sample');
});

test('sample uses safe federation placeholders', () => {
  assert.ok(
    sample.CIVICS_FEDERATION_DATA_GOV_API_KEY === 'DEMO_KEY',
    'Data.gov placeholder must be DEMO_KEY',
  );
  for (const name of [
    'CIVICS_FEDERATION_NASA_CMR_BEARER_TOKEN',
    'CIVICS_FEDERATION_PUBMED_API_KEY',
    'CIVICS_FEDERATION_OPENALEX_API_KEY',
  ]) {
    assert.ok(sample[name] === '', `${name} must be blank in sample`);
  }
  const personalKey = local?.CIVICS_FEDERATION_DATA_GOV_API_KEY;
  if (
    personalKey &&
    personalKey !== 'DEMO_KEY' &&
    personalKey !== 'YOUR_API_DATA_GOV_KEY_HERE'
  ) {
    assert.ok(
      !sampleText.includes(personalKey),
      'Personal Data.gov key must not appear in sample',
    );
  }
});

test('seed and lineage use the canonical application credential names', () => {
  assert.ok(
    seed.includes(
      'admin_email="${CIVICS_DSPACE_ADMIN_EMAIL:-admin@civics.local}"',
    ),
  );
  assert.ok(
    seed.includes(
      'admin_password="${CIVICS_DSPACE_ADMIN_PASSWORD:-civics-admin}"',
    ),
  );
  assert.ok(
    /process\.env\.CIVICS_DSPACE_ADMIN_PASSWORD\s*\?\?\s*'civics-admin'/u.test(
      lineage,
    ),
  );
  assert.ok(
    /process\.env\.CIVICS_DSPACE_ADMIN_EMAIL\s*\?\?\s*'admin@civics\.local'/u.test(
      lineage,
    ),
  );
  for (const source of [sampleText, compose, seed, lineage]) {
    assert.ok(
      !source.includes('local-demo-not-a-secret'),
      'Conflicting DSpace fallback remains',
    );
  }
  for (const source of [sampleText, compose, seed, lineage]) {
    assert.ok(!source.includes('DSPACE_SEED_ADMIN_EMAIL'));
    assert.ok(!source.includes('DSPACE_SEED_ADMIN_PASSWORD'));
  }
});

test('Compose maps credentials to the intended services and Java properties', () => {
  const apiBlock = compose
    .split('  repository-api:')[1]
    .split('  discovery-ui:')[0];
  const seedBlock = compose
    .split('  dspace-seed:')[1]
    .split('  dspace-postgres:')[0];
  for (const suffix of ['EMAIL', 'PASSWORD']) {
    const name = `CIVICS_DSPACE_ADMIN_${suffix}`;
    assert.ok(
      apiBlock.includes(`${name}: '\${${name}:-}'`),
      `${name} mapping missing`,
    );
    assert.ok(
      application.includes(`\${${name}:}`),
      `${name} Java binding missing`,
    );
    const fallback = suffix === 'EMAIL' ? 'admin@civics.local' : 'civics-admin';
    assert.ok(
      seedBlock.includes(`${name}: '\${${name}:-${fallback}}'`),
      `${name} seed mapping/fallback missing`,
    );
  }
});
