import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPreflight,
  estimateStorageAtTarget,
  parseArguments,
  renderPreflightMarkdown,
} from './research-scale-preflight.mjs';

const MEASURE_10K = {
  profile: 'FEDERATED_10K',
  retainedFederatedCount: 10000,
  totalMeasuredLocalBytes: 1131523306,
  applicationPostgresBytes: 47371955,
  dspaceStoredBytes: 1073739747,
  solrIndexBytes: 5231724,
  openSearchIndexBytes: 5179880,
};

const MEASURE_100K = {
  profile: 'FEDERATED_100K',
  retainedFederatedCount: 100000,
  totalMeasuredLocalBytes: 1555039056,
  applicationPostgresBytes: 391091891,
  dspaceStoredBytes: 1073739747,
  solrIndexBytes: 46972408,
  openSearchIndexBytes: 43235010,
};

function evidence(profile, valid) {
  return {
    profile,
    valid,
    activeProfile: valid ? profile : 'FEDERATED_100K',
    targetParity: valid,
    retainedFederatedRecordCount: valid ? 1000000 : 100000,
    violations: valid ? [] : ['retained count below target'],
  };
}

function harvest(retained = 100000) {
  return {
    sourceSystem: 'DATA_GOV',
    retainedRecordCount: retained,
    resumableRun: {
      runId: 'run-100k',
      status: 'PAUSED',
    },
    latestRun: {
      runId: 'run-100k',
      status: 'PAUSED',
    },
  };
}

test('1M storage estimate uses measured slope and keeps DSpace fixed', () => {
  const estimate = estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });

  assert.equal(
    estimate.components.dspaceStoredBytes.bytes,
    MEASURE_100K.dspaceStoredBytes,
  );
  assert.equal(
    estimate.components.dspaceStoredBytes.method,
    'fixed-authority-footprint',
  );
  assert.equal(
    estimate.components.applicationPostgresBytes.method,
    '10k-to-100k-linear-slope',
  );
  assert.ok(
    estimate.components.applicationPostgresBytes.bytes >
      MEASURE_100K.applicationPostgresBytes,
  );
  assert.ok(
    estimate.estimatedSteadyBytes > MEASURE_100K.totalMeasuredLocalBytes,
  );
  assert.ok(
    estimate.recommendedFreeBytes > estimate.minimumAdditionalFreeBytes,
  );
});

test('preflight reports ready to grow before the 1M retained target exists', () => {
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });
  const result = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate,
    freeDiskBytes: storageEstimate.recommendedFreeBytes * 2,
    baselineEvidence: {
      valid: true,
      activeProfile: 'FEDERATED_100K',
      targetParity: true,
    },
    targetEvidence: evidence('FEDERATED_1M', false),
    harvestStatus: harvest(),
  });

  assert.equal(result.overallStatus, 'READY_TO_GROW');
  assert.equal(result.remainingRecordCount, 900000);
  assert.equal(
    result.checks.find((entry) => entry.id === 'retained-target').status,
    'PENDING',
  );
});

test('preflight blocks growth when measured disk headroom is insufficient', () => {
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });
  const result = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate,
    freeDiskBytes: Math.max(0, storageEstimate.recommendedFreeBytes - 1),
    baselineEvidence: { valid: true, targetParity: true },
    targetEvidence: evidence('FEDERATED_1M', false),
    harvestStatus: harvest(),
  });

  assert.equal(result.overallStatus, 'BLOCKED');
  assert.equal(
    result.checks.find((entry) => entry.id === 'disk-headroom').status,
    'BLOCKED',
  );
});

test('preflight reports ready to measure when valid 1M evidence supersedes active 100K evidence', () => {
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });
  const result = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate,
    freeDiskBytes: storageEstimate.recommendedFreeBytes * 2,
    baselineEvidence: {
      valid: false,
      activeProfile: 'FEDERATED_1M',
      targetParity: false,
    },
    targetEvidence: evidence('FEDERATED_1M', true),
    harvestStatus: harvest(1000000),
  });

  assert.equal(result.overallStatus, 'READY_TO_MEASURE');
  assert.equal(result.remainingRecordCount, 0);
  assert.equal(
    result.checks.find((entry) => entry.id === 'baseline-evidence').status,
    'READY',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'active-target-evidence').status,
    'READY',
  );
});

test('preflight report exposes storage assumptions and non-mutating next action', () => {
  const storageEstimate = estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });
  const readiness = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate,
    freeDiskBytes: storageEstimate.recommendedFreeBytes * 2,
    baselineEvidence: { valid: true, targetParity: true },
    targetEvidence: evidence('FEDERATED_1M', false),
    harvestStatus: harvest(),
  });
  const markdown = renderPreflightMarkdown({
    profile: 'FEDERATED_1M',
    capturedAt: '2026-08-31T16:00:00Z',
    freeDiskBytes: storageEstimate.recommendedFreeBytes * 2,
    storageEstimate,
    readiness,
  });

  assert.match(markdown, /READY_TO_GROW/);
  assert.match(markdown, /fixed-authority-footprint/);
  assert.match(markdown, /25% research margin/);
  assert.match(markdown, /never mutates corpus state/);
});

test('preflight CLI supports an explicit ready-to-measure gate', () => {
  const options = parseArguments([
    '--profile',
    'FEDERATED_1M',
    '--require-ready-to-measure',
    '--output',
    'evidence/preflight.json',
  ]);

  assert.equal(options.profile, 'FEDERATED_1M');
  assert.equal(options.requireReadyToMeasure, true);
  assert.equal(options.output, 'evidence/preflight.json');
  assert.throws(
    () => parseArguments(['--profile', 'FULL']),
    /profile must be one of/,
  );
});
