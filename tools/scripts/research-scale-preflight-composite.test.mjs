import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPreflight,
  estimateStorageAtTarget,
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
  retainedFederatedCount: 100100,
  projectionId: '1'.repeat(64),
  activeProjectionCount: 100181,
  totalMeasuredLocalBytes: 1555039056,
  applicationPostgresBytes: 391091891,
  dspaceStoredBytes: 1073739747,
  solrIndexBytes: 46972408,
  openSearchIndexBytes: 43235010,
};

function storageEstimate() {
  return estimateStorageAtTarget({
    lowerMeasurement: MEASURE_10K,
    upperMeasurement: MEASURE_100K,
    targetRetained: 1000000,
  });
}

function harvest(sourceSystem, retained, runId) {
  return {
    sourceSystem,
    retainedRecordCount: retained,
    resumableRun: {
      runId,
      status: 'PAUSED',
    },
    latestRun: {
      runId,
      status: 'PAUSED',
    },
  };
}

const compositionSha = 'a'.repeat(64);
const projectionId = 'b'.repeat(64);

const composition = {
  corpusProfile: 'FEDERATED_1M',
  federatedRecordCount: 1000000,
  compositionSha256: compositionSha,
  sources: [
    {
      sourceSystem: 'DATA_GOV',
      requestedRecordCount: 500000,
    },
    {
      sourceSystem: 'DOE_OSTI',
      requestedRecordCount: 500000,
    },
  ],
};

const projectionEvidence = {
  compositionSha256: compositionSha,
  corpusProfile: 'FEDERATED_1M',
  federatedRecordCount: 1000000,
  projectionId,
  projectionObjectCount: 1000181,
};

test('composite preflight reports current C2 progress without counting unrelated source samples', () => {
  const estimate = storageEstimate();
  const result = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate: estimate,
    freeDiskBytes: estimate.recommendedFreeBytes * 2,
    baselineMeasurement: MEASURE_100K,
    sourceStatuses: {
      DATA_GOV: harvest('DATA_GOV', 100000, 'data-run'),
      DOE_OSTI: harvest('DOE_OSTI', 25, 'osti-run'),
      NASA_CMR: harvest('NASA_CMR', 25, 'nasa-run'),
    },
    compositions: [],
    projectionEvidence: [],
    currentProjection: {
      objectCount: 181,
      projectionId: 'c'.repeat(64),
    },
    activeProfile: 'CURATED_DEMO',
  });

  assert.equal(result.overallStatus, 'READY_TO_GROW');
  assert.equal(result.retainedRecordCount, 100025);
  assert.equal(result.remainingRecordCount, 899975);
  assert.equal(
    result.checks.find((entry) => entry.id === 'historical-100k-baseline')
      .status,
    'READY',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'composite-manifest').status,
    'PENDING',
  );
});

test('composite preflight requires exact per-source quotas', () => {
  const estimate = storageEstimate();
  const result = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate: estimate,
    freeDiskBytes: estimate.recommendedFreeBytes * 2,
    baselineMeasurement: MEASURE_100K,
    sourceStatuses: {
      DATA_GOV: harvest('DATA_GOV', 700000, 'data-run'),
      DOE_OSTI: harvest('DOE_OSTI', 300000, 'osti-run'),
    },
    compositions: [],
    projectionEvidence: [],
    currentProjection: null,
    activeProfile: 'CURATED_DEMO',
  });

  assert.equal(result.retainedRecordCount, 800000);
  assert.equal(result.remainingRecordCount, 200000);
  assert.equal(
    result.checks.find((entry) => entry.id === 'source-data_gov-quota')
      .status,
    'READY',
  );
  assert.equal(
    result.checks.find((entry) => entry.id === 'source-doe_osti-quota')
      .status,
    'PENDING',
  );
});

test('composite preflight becomes ready only when the exact linked projection is currently active', () => {
  const estimate = storageEstimate();
  const common = {
    profile: 'FEDERATED_1M',
    storageEstimate: estimate,
    freeDiskBytes: estimate.recommendedFreeBytes * 2,
    baselineMeasurement: MEASURE_100K,
    sourceStatuses: {
      DATA_GOV: harvest('DATA_GOV', 500000, 'data-run'),
      DOE_OSTI: harvest('DOE_OSTI', 500000, 'osti-run'),
    },
    compositions: [composition],
    projectionEvidence: [projectionEvidence],
  };

  const inactive = classifyPreflight({
    ...common,
    currentProjection: {
      objectCount: 181,
      projectionId: 'c'.repeat(64),
    },
    activeProfile: 'CURATED_DEMO',
  });
  assert.equal(inactive.overallStatus, 'READY_TO_GROW');

  const active = classifyPreflight({
    ...common,
    currentProjection: {
      objectCount: 1000181,
      projectionId,
    },
    activeProfile: 'FEDERATED_1M',
  });
  assert.equal(active.overallStatus, 'READY_TO_MEASURE');
  assert.equal(active.remainingRecordCount, 0);
  assert.equal(active.compositionSha256, compositionSha);
  assert.equal(active.projectionId, projectionId);
});

test('composite markdown shows the two-source C2 recipe', () => {
  const estimate = storageEstimate();
  const readiness = classifyPreflight({
    profile: 'FEDERATED_1M',
    storageEstimate: estimate,
    freeDiskBytes: estimate.recommendedFreeBytes * 2,
    baselineMeasurement: MEASURE_100K,
    sourceStatuses: {
      DATA_GOV: harvest('DATA_GOV', 100000, 'data-run'),
      DOE_OSTI: harvest('DOE_OSTI', 25, 'osti-run'),
    },
    compositions: [],
    projectionEvidence: [],
    currentProjection: null,
    activeProfile: 'CURATED_DEMO',
  });
  const markdown = renderPreflightMarkdown({
    profile: 'FEDERATED_1M',
    capturedAt: '2026-08-31T22:58:00Z',
    freeDiskBytes: estimate.recommendedFreeBytes * 2,
    storageEstimate: estimate,
    readiness,
  });

  assert.match(markdown, /100,025 \/ 1,000,000/);
  assert.match(markdown, /DATA_GOV \| 100,000 \| 500,000/);
  assert.match(markdown, /DOE_OSTI \| 25 \| 500,000/);
  assert.match(markdown, /899,975/);
});
