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

export const selectSearchResultSource = createSelector(
  selectSearchResponse,
  (response) => response?.resultSource ?? null,
);

export const selectSearchPagination = createSelector(
  selectSearchResponse,
  (response) => {
    const totalResults = response?.totalResults ?? 0;
    const pageSize = Math.max(1, response?.pageSize ?? 20);
    const page = Math.max(0, response?.page ?? 0);
    const pageCount = Math.max(1, Math.ceil(totalResults / pageSize));
    const shown = response?.results.length ?? 0;

    return {
      page,
      pageSize,
      pageCount,
      totalResults,
      firstResult: totalResults === 0 ? 0 : page * pageSize + 1,
      lastResult: totalResults === 0 ? 0 : page * pageSize + shown,
      hasPrevious: page > 0,
      hasNext: page + 1 < pageCount,
      visible: totalResults > pageSize,
    };
  },
);
