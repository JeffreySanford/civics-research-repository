import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { MobileSearchState } from './search.reducer';

export const selectMobileSearchState =
  createFeatureSelector<MobileSearchState>('mobileSearch');

export const selectMobileSearchQuery = createSelector(
  selectMobileSearchState,
  (state) => state.query,
);

export const selectMobileSearchResponse = createSelector(
  selectMobileSearchState,
  (state) => state.response,
);

export const selectMobileSearchLoading = createSelector(
  selectMobileSearchState,
  (state) => state.loading,
);

export const selectMobileSearchError = createSelector(
  selectMobileSearchState,
  (state) => state.error,
);
