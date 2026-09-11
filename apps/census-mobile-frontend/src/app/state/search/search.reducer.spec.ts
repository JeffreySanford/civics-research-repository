import type { SearchResponse } from 'repository-api-client';
import { SearchActions } from './search.actions';
import { initialSearchState, searchReducer } from './search.reducer';

const response: SearchResponse = {
  resultSource: 'REPOSITORY',
  query: 'housing',
  page: 0,
  pageSize: 20,
  totalResults: 0,
  results: [],
  facets: [],
};

describe('searchReducer', () => {
  it('starts a submitted search with the requested criteria', () => {
    const state = searchReducer(
      initialSearchState,
      SearchActions.searchSubmitted({
        query: {
          q: 'housing',
          geography: 'North Dakota',
          page: 0,
          pageSize: 20,
        },
      }),
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.query).toEqual({
      q: 'housing',
      geography: 'North Dakota',
      page: 0,
      pageSize: 20,
    });
  });

  it('stores the typed response and clears loading', () => {
    const state = searchReducer(
      { ...initialSearchState, loading: true },
      SearchActions.searchLoaded({ response }),
    );

    expect(state.loading).toBe(false);
    expect(state.response).toEqual(response);
  });

  it('keeps the previous response visible when a later request fails', () => {
    const state = searchReducer(
      { ...initialSearchState, response, loading: true },
      SearchActions.searchFailed({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Search unavailable.' },
      }),
    );

    expect(state.loading).toBe(false);
    expect(state.response).toEqual(response);
    expect(state.error).toBe('Search unavailable.');
  });
});
