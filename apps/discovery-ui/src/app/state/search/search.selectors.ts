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

/**
 * The Census area a workforce map would open on, or null when the search does not name one.
 *
 * Derived from the search response's own geography facet rather than from whatever result cards
 * happen to be rendered. Discovery decides what the query is about; the map is then told, and
 * fetches its own authoritative overlay data. A map that read its focus out of the visible list
 * would change meaning when the reader paged.
 *
 * A selected geography wins outright, because the reader said it. Otherwise the largest facet
 * value is used, which is how "North Dakota workforce" resolves to North Dakota without anyone
 * having touched a filter. "United States" is excluded: national objects are not a map extent, and
 * opening the workspace zoomed to the whole country teaches the reader nothing.
 */
export const selectMapExploreGeography = createSelector(
  selectSearchFacets,
  (facets) => {
    const geography = facets.find((facet) => facet.field === 'geography');
    if (!geography || geography.values.length === 0) {
      return null;
    }

    const selected = geography.values.find((value) => value.selected);
    if (selected) {
      return selected.value === 'United States' ? null : selected.value;
    }

    const largest = [...geography.values]
      .filter((value) => value.value !== 'United States')
      .sort((left, right) => right.count - left.count)[0];

    return largest?.value ?? null;
  },
);
