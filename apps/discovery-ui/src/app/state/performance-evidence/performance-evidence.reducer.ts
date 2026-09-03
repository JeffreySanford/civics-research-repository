import { createReducer, on } from '@ngrx/store';
import type { SearchPerformanceEvidence } from 'repository-api-client';
import { PerformanceEvidenceActions } from './performance-evidence.actions';

export const performanceEvidenceFeatureKey = 'performanceEvidence';

export interface PerformanceEvidenceState {
  readonly evidence: SearchPerformanceEvidence | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialPerformanceEvidenceState: PerformanceEvidenceState = {
  evidence: null,
  loading: false,
  error: null,
};

export const performanceEvidenceReducer = createReducer(
  initialPerformanceEvidenceState,
  on(PerformanceEvidenceActions.loadRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(PerformanceEvidenceActions.loadSucceeded, (state, { evidence }) => ({
    ...state,
    evidence,
    loading: false,
    error: null,
  })),
  on(PerformanceEvidenceActions.loadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
);
