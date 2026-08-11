import { createFeatureSelector, createSelector } from '@ngrx/store';
import { syncFeatureKey, type SyncState } from './sync.reducer';

export const selectSyncState = createFeatureSelector<SyncState>(syncFeatureKey);

export const selectSyncJobs = createSelector(
  selectSyncState,
  (state) => state.jobs,
);

export const selectSyncLoading = createSelector(
  selectSyncState,
  (state) => state.loading,
);

export const selectSyncError = createSelector(
  selectSyncState,
  (state) => state.error,
);

export const selectSelectedSyncJob = createSelector(
  selectSyncState,
  (state) =>
    state.jobs.find((job) => job.id === state.selectedJobId) ??
    state.jobs[0] ??
    null,
);
