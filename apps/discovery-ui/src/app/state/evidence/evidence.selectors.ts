import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  countAutomatedChecks,
  isAutomatedEvidence,
} from '../../pages/evidence-page.utils';
import { evidenceFeatureKey, type EvidenceState } from './evidence.reducer';

export const selectEvidenceState =
  createFeatureSelector<EvidenceState>(evidenceFeatureKey);

export const selectEvidenceEntries = createSelector(
  selectEvidenceState,
  (state) => state.entries,
);

export const selectEvidenceLoading = createSelector(
  selectEvidenceState,
  (state) => state.loading,
);

export const selectEvidenceError = createSelector(
  selectEvidenceState,
  (state) => state.error,
);

export const selectAutomatedEvidence = createSelector(
  selectEvidenceEntries,
  (entries) => entries.filter((entry) => isAutomatedEvidence(entry.status)),
);

export const selectManualEvidence = createSelector(
  selectEvidenceEntries,
  (entries) => entries.filter((entry) => !isAutomatedEvidence(entry.status)),
);

export const selectAutomatedCheckCounts = createSelector(
  selectAutomatedEvidence,
  (entries) => countAutomatedChecks(entries),
);

export const selectLatestCapturedAt = createSelector(
  selectEvidenceEntries,
  (entries) =>
    entries.reduce<string | null>((latest, entry) => {
      if (!latest || entry.capturedAt > latest) {
        return entry.capturedAt;
      }

      return latest;
    }, null),
);

export const selectOverallAutomatedStatus = createSelector(
  selectAutomatedEvidence,
  (entries) => {
    if (entries.length === 0) {
      return 'NOT_STARTED' as const;
    }

    if (entries.some((entry) => entry.status === 'AUTOMATED_FAIL')) {
      return 'AUTOMATED_FAIL' as const;
    }

    return 'AUTOMATED_PASS' as const;
  },
);
