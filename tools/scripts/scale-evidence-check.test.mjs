import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyScaleEvidence,
  parseArguments,
} from './scale-evidence-check.mjs';

const COMPOSITION =
  'e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b';
const PROJECTION =
  '3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d';

function preflight() {
  return {
    readiness: {
      overallStatus: 'READY_TO_MEASURE',
      targetRetainedRecords: 1_000_000,
      retainedRecordCount: 1_000_000,
      sourceProgress: [
        {
          sourceSystem: 'DATA_GOV',
          requestedRecordCount: 500_000,
          retainedRecordCount: 500_000,
        },
        {
          sourceSystem: 'DOE_OSTI',
          requestedRecordCount: 500_000,
          retainedRecordCount: 500_000,
        },
      ],
      compositionSha256: COMPOSITION,
      projectionId: PROJECTION,
    },
  };
}

function scaleEvidence() {
  return {
    profile: 'FEDERATED_1M',
    valid: true,
    targetFederatedRecordCount: 1_000_000,
    retainedFederatedRecordCount: 1_000_000,
    activeProfile: 'FEDERATED_1M',
    activationProjectionObjectCount: 1_000_181,
    activationProjectionId: PROJECTION,
    currentProjectionObjectCount: 1_000_181,
    currentProjectionId: PROJECTION,
    targetParity: true,
    storageEvidencePresent: true,
    storageProjectionObjectCount: 1_000_181,
    storageRetainedFederatedCount: 1_000_000,
    storageProjectionId: PROJECTION,
    storageCapturedAt: '2026-09-01T14:28:56.09655Z',
    violations: [],
  };
}

function publicSearch(sourceSystem, totalResults) {
  return {
    totalResults,
    results: [
      {
        id: `${sourceSystem.toLowerCase()}:sample`,
        title: 'Sample',
        contentType: 'DATASET',
        program: 'OTHER',
        publisher: sourceSystem,
        summary: 'Sample result',
        sourceUrl: 'https://example.gov/record',
        origin: 'FEDERATED',
        sourceSystem,
      },
    ],
    facets: [],
  };
}

function inputs() {
  return {
    profile: 'FEDERATED_1M',
    preflight: preflight(),
    scaleEvidence: scaleEvidence(),
    publicSearchBySource: {
      DATA_GOV: publicSearch('DATA_GOV', 500_000),
      DOE_OSTI: publicSearch('DOE_OSTI', 500_000),
    },
  };
}

test('passes the exact C2 live evidence contract', () => {
  const result = classifyScaleEvidence(inputs());

  assert.equal(result.status, 'PASS');
  assert.equal(result.compositionSha256, COMPOSITION);
  assert.equal(result.projectionId, PROJECTION);
  assert.equal(result.projectionObjectCount, 1_000_181);
  assert.ok(result.checks.every((entry) => entry.status === 'PASS'));
});

test('rejects a million-record recipe that is not exact 500k plus 500k', () => {
  const value = inputs();
  value.preflight.readiness.sourceProgress = [
    {
      sourceSystem: 'DATA_GOV',
      requestedRecordCount: 600_000,
      retainedRecordCount: 600_000,
    },
    {
      sourceSystem: 'DOE_OSTI',
      requestedRecordCount: 400_000,
      retainedRecordCount: 400_000,
    },
  ];

  const result = classifyScaleEvidence(value);

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find((entry) => entry.id === 'exact-source-recipe')?.status,
    'FAIL',
  );
});

test('rejects persisted activation and runtime projection drift', () => {
  const value = inputs();
  value.scaleEvidence.currentProjectionId = 'a'.repeat(64);

  const result = classifyScaleEvidence(value);

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find(
      (entry) => entry.id === 'persisted-activation-runtime-identity',
    )?.status,
    'FAIL',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'composition-projection-linkage')
      ?.status,
    'FAIL',
  );
});

test('rejects stale storage evidence', () => {
  const value = inputs();
  value.scaleEvidence.storageProjectionObjectCount = 100_181;

  const result = classifyScaleEvidence(value);

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find((entry) => entry.id === 'storage-evidence')?.status,
    'FAIL',
  );
});

test('rejects public search results with incorrect provenance', () => {
  const value = inputs();
  value.publicSearchBySource.DOE_OSTI.results[0].origin = 'REPOSITORY';

  const result = classifyScaleEvidence(value);

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find(
      (entry) => entry.id === 'public-search-doe_osti-provenance',
    )?.status,
    'FAIL',
  );
});

test('rejects public source totals that do not match the exact projected recipe', () => {
  const value = inputs();
  value.publicSearchBySource.DATA_GOV.totalResults = 499_999;

  const result = classifyScaleEvidence(value);

  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find(
      (entry) => entry.id === 'public-search-data_gov-provenance',
    )?.status,
    'FAIL',
  );
});

test('CLI derives a profile-specific output path and accepts a leading package-manager separator', () => {
  assert.deepEqual(parseArguments(['--', '--profile', 'FEDERATED_100K']), {
    baseUrl: 'http://localhost:8080/api',
    profile: 'FEDERATED_100K',
    output:
      'browser-evidence-artifacts/scale-evidence/federated-100k-check.json',
  });
});

test('CLI stops parsing at an in-band end-of-options marker', () => {
  assert.deepEqual(parseArguments(['--profile', 'FEDERATED_100K', '--', 'ignored']), {
    baseUrl: 'http://localhost:8080/api',
    profile: 'FEDERATED_100K',
    output:
      'browser-evidence-artifacts/scale-evidence/federated-100k-check.json',
  });
});
