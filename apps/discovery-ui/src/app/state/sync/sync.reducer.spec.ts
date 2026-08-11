import { SyncActions } from './sync.actions';
import { initialSyncState, syncReducer } from './sync.reducer';
import { selectSelectedSyncJob } from './sync.selectors';

describe('syncReducer', () => {
  it('stores completed sync jobs', () => {
    const job = {
      id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
      mode: 'DRY_RUN' as const,
      source: 'TIGER_LINE' as const,
      status: 'DRY_RUN_COMPLETE' as const,
      startedAt: '2026-08-11T19:00:00Z',
      actions: [],
    };

    const state = syncReducer(
      initialSyncState,
      SyncActions.syncSucceeded({ job }),
    );

    expect(state.jobs).toEqual([job]);
    expect(state.selectedJobId).toBe(job.id);
    expect(state.loading).toBe(false);
  });

  it('selects the current sync job', () => {
    const job = {
      id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
      mode: 'DRY_RUN' as const,
      source: 'TIGER_LINE' as const,
      status: 'DRY_RUN_COMPLETE' as const,
      startedAt: '2026-08-11T19:00:00Z',
      actions: [],
    };

    const selected = selectSelectedSyncJob.projector({
      ...initialSyncState,
      jobs: [job],
      selectedJobId: job.id,
    });

    expect(selected).toBe(job);
  });

  it('loads persisted sync history', () => {
    const job = {
      id: '92e0cc30-1f7f-49dd-babf-c3d13ce66b46',
      mode: 'DRY_RUN' as const,
      source: 'TIGER_LINE' as const,
      status: 'DRY_RUN_COMPLETE' as const,
      startedAt: '2026-08-11T19:00:00Z',
      actions: [],
    };

    const state = syncReducer(
      initialSyncState,
      SyncActions.historyLoaded({ jobs: [job] }),
    );

    expect(state.jobs).toEqual([job]);
    expect(state.selectedJobId).toBe(job.id);
    expect(state.loading).toBe(false);
  });
});
