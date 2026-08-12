import { SearchActions } from './search.actions';
import { initialSearchState, searchReducer } from './search.reducer';
import { selectSearchResults } from './search.selectors';

describe('searchReducer', () => {
  it('tracks submitted searches as loading state', () => {
    const query = {
      q: 'USGS',
      program: 'USGS' as const,
      geography: 'United States',
      page: 0,
      pageSize: 25,
    };

    const state = searchReducer(
      initialSearchState,
      SearchActions.searchSubmitted({ query }),
    );

    expect(state.query).toEqual(query);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('stores typed search results', () => {
    const result = {
      id: 'usgs-earthquakes-overlay',
      title: 'USGS Earthquake Overlay',
      contentType: 'DATASET' as const,
      program: 'USGS' as const,
      publisher: 'U.S. Geological Survey',
      summary: 'Earthquake overlay metadata.',
      geography: 'United States',
      vintageYear: 2026,
      sourceUrl: 'https://example.test/usgs',
    };
    const response = {
      query: 'USGS',
      page: 0,
      pageSize: 25,
      resultSource: 'REPOSITORY' as const,
      totalResults: 1,
      results: [result],
      facets: [],
    };

    const state = searchReducer(
      initialSearchState,
      SearchActions.searchLoaded({ response }),
    );

    expect(state.response).toEqual(response);
    expect(state.loading).toBe(false);
  });

  it('selects result lists from a response', () => {
    const result = {
      id: 'acs-pums-nd-2024',
      title: '2024 ACS 1-Year PUMS - North Dakota',
      contentType: 'DATASET' as const,
      program: 'ACS' as const,
      publisher: 'U.S. Census Bureau',
      summary: 'ACS metadata.',
      geography: 'North Dakota',
      vintageYear: 2024,
      sourceUrl: 'https://example.test/acs',
    };

    const selected = selectSearchResults.projector({
      query: 'ACS',
      page: 0,
      pageSize: 25,
      resultSource: 'REPOSITORY' as const,
      totalResults: 1,
      results: [result],
      facets: [],
    });

    expect(selected).toEqual([result]);
  });
});
