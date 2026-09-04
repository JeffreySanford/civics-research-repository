import { PerformanceEvidenceActions } from './performance-evidence.actions';
import {
  initialPerformanceEvidenceState,
  performanceEvidenceReducer,
} from './performance-evidence.reducer';
import type { SearchPerformanceEvidence } from 'repository-api-client';

const evidence = {
  profile: 'FEDERATED_1M',
  capturedAt: '2026-09-03T19:06:00Z',
  scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
  comparativeClaimAllowed: false,
  projectionId: 'a'.repeat(64),
  projectionObjectCount: 1_000_181,
  retainedFederatedRecords: 1_000_000,
  targetParity: true,
  claimGuardrail: 'Scoped.',
  executionControls: null,
  standaloneBatchEvidence: null,
  orderRobustness: null,
  pairedWorkloads: [],
  concurrency: [],
  c21Adversarial: null,
  resources: {
    captured: true,
    interpretation: null,
    counterResetDetected: false,
    counterResetFields: [],
  },
} satisfies SearchPerformanceEvidence;

describe('performanceEvidenceReducer', () => {
  it('tracks loading, success and failure', () => {
    const loading = performanceEvidenceReducer(
      initialPerformanceEvidenceState,
      PerformanceEvidenceActions.loadRequested(),
    );
    expect(loading.loading).toBe(true);

    const loaded = performanceEvidenceReducer(
      loading,
      PerformanceEvidenceActions.loadSucceeded({ evidence }),
    );
    expect(loaded.evidence).toEqual(evidence);
    expect(loaded.loading).toBe(false);

    const failed = performanceEvidenceReducer(
      loaded,
      PerformanceEvidenceActions.loadFailed({
        error: { code: 'HTTP_404', message: 'not found' },
      }),
    );
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe('not found');
  });
});
