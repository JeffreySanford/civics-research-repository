import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildProbeSql,
  formatMarkdown,
  loadScaleCertification,
  normalizeProbe,
  normalizeScaleCertification,
  parseArgs,
  parsePsqlJson,
} from './data-gov-spatial-availability.mjs';

const REQUIRED_SCALE_CHECKS = [
  'preflight-ready-to-measure',
  'exact-source-recipe',
  'scale-evidence-valid',
  'active-profile',
  'persisted-activation-runtime-identity',
  'search-target-parity',
  'storage-evidence',
  'composition-projection-linkage',
  'public-search-data_gov-provenance',
  'public-search-doe_osti-provenance',
];

function passingScaleEvidence(overrides = {}) {
  return {
    kind: 'civics-scale-evidence-check',
    profile: 'FEDERATED_1M',
    status: 'PASS',
    targetFederatedRecordCount: 1_000_000,
    retainedFederatedRecordCount: 1_000_000,
    compositionSha256: 'a'.repeat(64),
    projectionId: 'b'.repeat(64),
    projectionObjectCount: 1_000_181,
    capturedAt: '2026-09-02T16:00:00.000Z',
    checks: REQUIRED_SCALE_CHECKS.map((id) => ({ id, status: 'PASS' })),
    ...overrides,
  };
}

function probeCounts() {
  return {
    totalRecords: 500000,
    harvestRecordPresent: 499900,
    harvestRecordRawPresent: 499000,
    explicitSpatialTokenRecords: 125000,
    spatialTextRecords: 100000,
    spatialObjectRecords: 20000,
    spatialArrayRecords: 4000,
  };
}

async function tempDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'civics-spatial-scale-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('probe SQL is read-only and scopes the retained Data.gov corpus', () => {
  const sql = buildProbeSql();

  assert.match(sql, /from federated_research_objects/u);
  assert.match(sql, /source_system = 'DATA_GOV'/u);
  assert.match(sql, /harvestRecordRaw/u);
  assert.match(sql, /"spatial"/u);
  assert.doesNotMatch(sql, /\b(update|delete|insert|truncate)\b/iu);
});

test('normalizes counts and makes the unmapped/raw gap explicit', () => {
  const report = normalizeProbe(probeCounts(), '2026-09-02T16:00:00.000Z');

  assert.equal(report.totalRecords, 500000);
  assert.equal(report.rawHarvestUnavailable, 1000);
  assert.equal(report.explicitSpatialTokenRecords, 125000);
  assert.equal(report.explicitSpatialTokenPercent, 25);
  assert.deepEqual(report.spatialRepresentations, {
    text: 100000,
    object: 20000,
    array: 4000,
    other: 1000,
  });
});

test('binds a passing canonical C2 scale artifact to spatial evidence', () => {
  const certification = normalizeScaleCertification(passingScaleEvidence());
  const report = normalizeProbe(
    probeCounts(),
    '2026-09-02T16:05:00.000Z',
    certification,
  );

  assert.deepEqual(certification, {
    kind: 'c2-scale-certification',
    profile: 'FEDERATED_1M',
    capturedAt: '2026-09-02T16:00:00.000Z',
    compositionSha256: 'a'.repeat(64),
    projectionId: 'b'.repeat(64),
    projectionObjectCount: 1_000_181,
    retainedFederatedRecordCount: 1_000_000,
  });
  assert.deepEqual(report.scaleCertification, certification);

  const markdown = formatMarkdown(report, 500000);
  assert.match(markdown, /Certified C2 binding/u);
  assert.ok(markdown.includes(`Composition SHA-256: \`${'a'.repeat(64)}\``));
  assert.ok(markdown.includes(`Projection ID: \`${'b'.repeat(64)}\``));
});

test('loads and normalizes canonical scale evidence from disk', async (t) => {
  const directory = await tempDirectory(t);
  const evidencePath = path.join(directory, 'scale.json');
  await writeFile(
    evidencePath,
    `${JSON.stringify(passingScaleEvidence(), null, 2)}\n`,
    'utf8',
  );

  assert.deepEqual(await loadScaleCertification(evidencePath), {
    kind: 'c2-scale-certification',
    profile: 'FEDERATED_1M',
    capturedAt: '2026-09-02T16:00:00.000Z',
    compositionSha256: 'a'.repeat(64),
    projectionId: 'b'.repeat(64),
    projectionObjectCount: 1_000_181,
    retainedFederatedRecordCount: 1_000_000,
  });
});

test('wraps a missing scale evidence file with operator context', async (t) => {
  const directory = await tempDirectory(t);
  const evidencePath = path.join(directory, 'missing-scale.json');

  await assert.rejects(
    loadScaleCertification(evidencePath),
    /Unable to read valid scale evidence JSON/u,
  );
});

test('wraps malformed scale evidence JSON with operator context', async (t) => {
  const directory = await tempDirectory(t);
  const evidencePath = path.join(directory, 'malformed-scale.json');
  await writeFile(evidencePath, '{not-json}\n', 'utf8');

  await assert.rejects(
    loadScaleCertification(evidencePath),
    /Unable to read valid scale evidence JSON/u,
  );
});

test('rejects a parsed scale evidence file that violates the C2 contract', async (t) => {
  const directory = await tempDirectory(t);
  const evidencePath = path.join(directory, 'wrong-profile.json');
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      passingScaleEvidence({ profile: 'FEDERATED_100K' }),
      null,
      2,
    )}\n`,
    'utf8',
  );

  await assert.rejects(
    loadScaleCertification(evidencePath),
    /profile must be FEDERATED_1M/u,
  );
});

test('rejects scale evidence that is not the certified C2 contract', () => {
  assert.throws(
    () => normalizeScaleCertification(passingScaleEvidence({ status: 'FAIL' })),
    /must be PASS/u,
  );
  assert.throws(
    () =>
      normalizeScaleCertification(
        passingScaleEvidence({ profile: 'FEDERATED_100K' }),
      ),
    /profile must be FEDERATED_1M/u,
  );
  assert.throws(
    () =>
      normalizeScaleCertification(
        passingScaleEvidence({ compositionSha256: 'not-a-sha' }),
      ),
    /compositionSha256 must be a lowercase SHA-256/u,
  );
  assert.throws(
    () =>
      normalizeScaleCertification(
        passingScaleEvidence({
          checks: REQUIRED_SCALE_CHECKS.filter(
            (id) => id !== 'composition-projection-linkage',
          ).map((id) => ({ id, status: 'PASS' })),
        }),
      ),
    /composition-projection-linkage/u,
  );
});

test('rejects impossible spatial counts', () => {
  assert.throws(
    () =>
      normalizeProbe({
        totalRecords: 10,
        harvestRecordPresent: 10,
        harvestRecordRawPresent: 5,
        explicitSpatialTokenRecords: 6,
        spatialTextRecords: 6,
        spatialObjectRecords: 0,
        spatialArrayRecords: 0,
      }),
    /cannot exceed/u,
  );
});

test('parses quiet psql output by taking the final nonblank JSON line', () => {
  assert.deepEqual(parsePsqlJson('\nNOTICE\n{"totalRecords":12}\n'), {
    totalRecords: 12,
  });
});

test('markdown distinguishes token availability from validated geometry', () => {
  const report = normalizeProbe(
    {
      totalRecords: 10,
      harvestRecordPresent: 10,
      harvestRecordRawPresent: 10,
      explicitSpatialTokenRecords: 4,
      spatialTextRecords: 3,
      spatialObjectRecords: 1,
      spatialArrayRecords: 0,
    },
    '2026-09-02T16:00:00.000Z',
  );
  const markdown = formatMarkdown(report, 10);

  assert.match(markdown, /Explicit `spatial` token present/u);
  assert.match(markdown, /not proof that the value is valid geometry/u);
  assert.match(markdown, /\(MATCH\)/u);
});

test('argument parser supports exact C2 count, output and scale evidence', () => {
  assert.deepEqual(
    parseArgs([
      '--expect',
      '500000',
      '--output-dir',
      'tmp/spatial',
      '--scale-evidence',
      'tmp/scale.json',
    ]),
    {
      expectedCount: 500000,
      outputDir: 'tmp/spatial',
      scaleEvidencePath: 'tmp/scale.json',
    },
  );
});

test('argument parser ignores pnpm standalone separator before forwarded options', () => {
  assert.deepEqual(
    parseArgs([
      '--expect',
      '500000',
      '--',
      '--scale-evidence',
      'tmp/scale.json',
    ]),
    {
      expectedCount: 500000,
      outputDir: 'browser-evidence-artifacts/spatial-availability',
      scaleEvidencePath: 'tmp/scale.json',
    },
  );
});
