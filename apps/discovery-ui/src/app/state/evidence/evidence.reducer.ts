import { createReducer, on } from '@ngrx/store';
import type { AccessibilityEvidence } from 'repository-api-client';
import { EvidenceActions } from './evidence.actions';

export const evidenceFeatureKey = 'evidence';

export interface EvidenceState {
  readonly entries: readonly AccessibilityEvidence[];
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialEvidenceState: EvidenceState = {
  entries: [],
  loading: false,
  error: null,
};

export const evidenceReducer = createReducer(
  initialEvidenceState,
  on(EvidenceActions.loadRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(EvidenceActions.loadSucceeded, (state, { entries }) => ({
    ...state,
    entries,
    loading: false,
    error: null,
  })),
  on(EvidenceActions.loadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
);
