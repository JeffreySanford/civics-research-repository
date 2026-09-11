import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { MobileResearchDetailState } from './research-detail.reducer';

export const mobileResearchDetailFeatureKey = 'researchDetail';

export const selectMobileResearchDetailState =
  createFeatureSelector<MobileResearchDetailState>(
    mobileResearchDetailFeatureKey,
  );

export const selectMobileResearchDetail = createSelector(
  selectMobileResearchDetailState,
  (state) => state.detail,
);

export const selectMobileResearchDetailLoading = createSelector(
  selectMobileResearchDetailState,
  (state) => state.loading,
);

export const selectMobileResearchDetailError = createSelector(
  selectMobileResearchDetailState,
  (state) => state.error,
);
