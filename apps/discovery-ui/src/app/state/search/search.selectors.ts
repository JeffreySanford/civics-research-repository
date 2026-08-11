import { createFeatureSelector, createSelector } from '@ngrx/store';
import { searchFeatureKey, type SearchState } from './search.reducer';

export const selectSearchState =
  createFeatureSelector<SearchState>(searchFeatureKey);

export const selectSearchQuery = createSelector(
  selectSearchState,
  (state) => state.query,
);

export const selectSearchResponse = createSelector(
  selectSearchState,
  (state) => state.response,
);

export const selectSearchResults = createSelector(
  selectSearchResponse,
  (response) => response?.results ?? [],
);

export const selectSearchFacets = createSelector(
  selectSearchResponse,
  (response) => response?.facets ?? [],
);

export const selectSearchTotalResults = createSelector(
  selectSearchResponse,
  (response) => response?.totalResults ?? 0,
);

export const selectSearchLoading = createSelector(
  selectSearchState,
  (state) => state.loading,
);

export const selectSearchError = createSelector(
  selectSearchState,
  (state) => state.error,
);
