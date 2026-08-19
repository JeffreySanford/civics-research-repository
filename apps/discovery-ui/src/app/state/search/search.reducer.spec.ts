import { SearchActions } from './search.actions';
import { initialSearchState, searchReducer } from './search.reducer';
import {
  selectSearchPagination,
  selectSearchResults,
} from './search.selectors';

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

/**
 * Pagination arithmetic, which is where pagers usually go wrong: an off-by-one in the displayed
 * range, or a last page that claims to end past the last result.
 */
describe('selectSearchPagination', () => {
  const response = (
    page: number,
    resultCount: number,
    totalResults: number,
    pageSize = 25,
  ) =>
    ({
      page,
      pageSize,
      totalResults,
      results: Array.from({ length: resultCount }, (_, index) => ({
        id: `item-${index}`,
      })),
      facets: [],
    }) as unknown as Parameters<typeof selectSearchPagination.projector>[0];

  it('reports a one-based range on the first page', () => {
    const pagination = selectSearchPagination.projector(response(0, 25, 181));

    expect(pagination.firstResult).toBe(1);
    expect(pagination.lastResult).toBe(25);
    expect(pagination.pageCount).toBe(8);
    expect(pagination.hasPrevious).toBe(false);
    expect(pagination.hasNext).toBe(true);
  });

  it('ends the last page at the last result, not at a full page boundary', () => {
    // 181 items, 25 per page: the eighth page holds six.
    const pagination = selectSearchPagination.projector(response(7, 6, 181));

    expect(pagination.firstResult).toBe(176);
    expect(pagination.lastResult).toBe(181);
    expect(pagination.hasNext).toBe(false);
    expect(pagination.hasPrevious).toBe(true);
  });

  /** A pager over a single page is a decoration that invites a click that does nothing. */
  it('hides itself when everything fits on one page', () => {
    expect(selectSearchPagination.projector(response(0, 12, 12)).visible).toBe(
      false,
    );
    expect(selectSearchPagination.projector(response(0, 25, 26)).visible).toBe(
      true,
    );
  });

  it('reports an empty range rather than "1-0 of 0"', () => {
    const pagination = selectSearchPagination.projector(response(0, 0, 0));

    expect(pagination.firstResult).toBe(0);
    expect(pagination.lastResult).toBe(0);
    expect(pagination.pageCount).toBe(1);
    expect(pagination.visible).toBe(false);
  });

  it('falls back to one page before anything has loaded', () => {
    const pagination = selectSearchPagination.projector(null);

    expect(pagination.page).toBe(0);
    expect(pagination.pageCount).toBe(1);
    expect(pagination.totalResults).toBe(0);
    expect(pagination.visible).toBe(false);
  });
});
