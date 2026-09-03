import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  performanceEvidenceFeatureKey,
  type PerformanceEvidenceState,
} from './performance-evidence.reducer';

export const selectPerformanceEvidenceState =
  createFeatureSelector<PerformanceEvidenceState>(
    performanceEvidenceFeatureKey,
  );

export const selectPerformanceEvidence = createSelector(
  selectPerformanceEvidenceState,
  (state) => state.evidence,
);

export const selectPerformanceEvidenceLoading = createSelector(
  selectPerformanceEvidenceState,
  (state) => state.loading,
);

export const selectPerformanceEvidenceError = createSelector(
  selectPerformanceEvidenceState,
  (state) => state.error,
);
