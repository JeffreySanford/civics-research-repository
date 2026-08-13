import { createReducer, on } from '@ngrx/store';
import type {
  DiscoveryProjectionState,
  SyncJob,
  SyncSource,
} from 'repository-api-client';
import { SyncActions } from './sync.actions';

export const syncFeatureKey = 'sync';

export interface SyncState {
  readonly jobs: readonly SyncJob[];
  readonly selectedJobId: string | null;
  readonly selectedSource: SyncSource;
  readonly loading: boolean;
  readonly reindexing: boolean;
  readonly projection: DiscoveryProjectionState | null;
  readonly error: string | null;
}

export const initialSyncState: SyncState = {
  jobs: [],
  selectedJobId: null,
  selectedSource: 'TIGER_LINE',
  loading: false,
  reindexing: false,
  projection: null,
  error: null,
};

export const syncReducer = createReducer(
  initialSyncState,
  on(
    SyncActions.dryRunRequested,
    SyncActions.applyRequested,
    SyncActions.diffRequested,
    (state) => ({
      ...state,
      loading: true,
      error: null,
    }),
  ),
  on(SyncActions.historyRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(SyncActions.historyLoaded, (state, { jobs }) => ({
    ...state,
    jobs,
    selectedJobId: state.selectedJobId ?? jobs[0]?.id ?? null,
    loading: false,
    error: null,
  })),
  on(SyncActions.syncRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(SyncActions.syncSucceeded, (state, { job }) => ({
    ...state,
    jobs: [job, ...state.jobs.filter((existing) => existing.id !== job.id)],
    selectedJobId: job.id,
    loading: false,
    error: null,
  })),
  on(SyncActions.syncFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
  on(SyncActions.reindexRequested, (state) => ({
    ...state,
    reindexing: true,
    error: null,
  })),
  on(SyncActions.reindexSucceeded, (state, { projection }) => ({
    ...state,
    reindexing: false,
    projection,
    error: null,
  })),
  on(SyncActions.reindexFailed, (state, { error }) => ({
    ...state,
    reindexing: false,
    error: error.message,
  })),
  on(SyncActions.jobSelected, (state, { jobId }) => ({
    ...state,
    selectedJobId: jobId,
  })),
  on(SyncActions.sourceSelected, (state, { source }) => ({
    ...state,
    selectedSource: source,
  })),
);
