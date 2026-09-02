import type { SearchResponse } from 'repository-api-client';
import { initialSearchState, type SearchState } from './search.reducer';
import { selectSearchPagination } from './search.selectors';

const response = (page: number, totalResults = 80): SearchResponse => ({
  resultSource: 'REPOSITORY',
  query: 'tracts',
  page,
  pageSize: 25,
  totalResults,
  results: [],
  facets: [],
});

describe('selectSearchPagination cursor semantics', () => {
  it('does not invent a next page after cursor traversal is exhausted', () => {
    const state: SearchState = {
      ...initialSearchState,
      response: response(0),
      cursorMode: true,
      cursorByPage: [null],
      nextCursor: null,
    };

    const pagination = selectSearchPagination.projector(state);

    expect(pagination.pageCount).toBe(4);
    expect(pagination.hasNext).toBe(false);
  });

  it('uses the backend continuation when cursor traversal can advance', () => {
    const state: SearchState = {
      ...initialSearchState,
      response: response(0),
      cursorMode: true,
      cursorByPage: [null],
      nextCursor: 'page-1',
    };

    expect(selectSearchPagination.projector(state).hasNext).toBe(true);
  });

  it('keeps page-count arithmetic for offset-compatible traversal', () => {
    const state: SearchState = {
      ...initialSearchState,
      response: response(1),
      cursorMode: false,
      nextCursor: null,
    };

    const pagination = selectSearchPagination.projector(state);

    expect(pagination.pageCount).toBe(4);
    expect(pagination.hasPrevious).toBe(true);
    expect(pagination.hasNext).toBe(true);
  });
});
