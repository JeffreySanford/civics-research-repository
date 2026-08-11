import { createReducer, on } from '@ngrx/store';
import type { SyncJob } from 'repository-api-client';
import { SyncActions } from './sync.actions';

export const syncFeatureKey = 'sync';

export interface SyncState {
  readonly jobs: readonly SyncJob[];
  readonly selectedJobId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialSyncState: SyncState = {
  jobs: [],
  selectedJobId: null,
  loading: false,
  error: null,
};

export const syncReducer = createReducer(
  initialSyncState,
  on(SyncActions.dryRunRequested, SyncActions.applyRequested, (state) => ({
    ...state,
    loading: true,
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
    error,
  })),
  on(SyncActions.jobSelected, (state, { jobId }) => ({
    ...state,
    selectedJobId: jobId,
  })),
);
