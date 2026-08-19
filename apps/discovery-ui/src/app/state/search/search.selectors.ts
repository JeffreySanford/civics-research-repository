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

/**
 * Whether the current results came from DSpace or from the fixture catalog.
 *
 * <p>Surfaced in the UI so generated placeholder content is never presented as repository content.
 */
export const selectSearchResultSource = createSelector(
  selectSearchResponse,
  (response) => response?.resultSource ?? null,
);

/**
 * Everything the pager needs, derived once.
 *
 * Computed from the response rather than from the submitted query, because those two disagree
 * while a request is in flight and briefly again if the API clamps a page beyond the end. The
 * response is what the reader is actually looking at.
 *
 * `firstResult` and `lastResult` are 1-indexed for display. Humans do not read "showing 0-24".
 */
export const selectSearchPagination = createSelector(
  selectSearchResponse,
  (response) => {
    const totalResults = response?.totalResults ?? 0;
    const pageSize = Math.max(1, response?.pageSize ?? 25);
    const page = Math.max(0, response?.page ?? 0);
    const pageCount = Math.max(1, Math.ceil(totalResults / pageSize));
    const shown = response?.results?.length ?? 0;

    return {
      page,
      pageSize,
      pageCount,
      totalResults,
      // Derived from what came back, not from page * pageSize: a short final page would
      // otherwise claim to end past the last result.
      firstResult: totalResults === 0 ? 0 : page * pageSize + 1,
      lastResult: totalResults === 0 ? 0 : page * pageSize + shown,
      hasPrevious: page > 0,
      hasNext: page + 1 < pageCount,
      // One page of results is not a pager, it is a decoration.
      visible: totalResults > pageSize,
    };
  },
);
