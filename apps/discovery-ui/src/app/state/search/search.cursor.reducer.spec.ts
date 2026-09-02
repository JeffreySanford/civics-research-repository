import type { SearchCursorPage, SearchResponse } from 'repository-api-client';
import { SearchActions } from './search.actions';
import { initialSearchState, searchReducer } from './search.reducer';

const response = (page: number): SearchResponse => ({
  resultSource: 'REPOSITORY',
  query: 'tracts',
  page,
  pageSize: 25,
  totalResults: 80,
  results: [],
  facets: [],
});

const cursorPage = (
  page: number,
  nextCursor: string | null,
): SearchCursorPage => ({
  search: response(page),
  nextCursor,
});

describe('searchReducer cursor traversal', () => {
  it('starts cursor traversal from page zero with no retained history', () => {
    const state = searchReducer(
      {
        ...initialSearchState,
        cursorMode: true,
        cursorByPage: [null, 'old-page-1'],
        nextCursor: 'old-next',
        paginationNotice: 'old notice',
      },
      SearchActions.cursorSearchSubmitted({
        query: { q: 'tracts', page: 7, pageSize: 25 },
      }),
    );

    expect(state.query.page).toBe(0);
    expect(state.cursorMode).toBe(false);
    expect(state.cursorByPage).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.paginationNotice).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('retains the cursor used to enter each successfully loaded page', () => {
    const first = searchReducer(
      initialSearchState,
      SearchActions.cursorSearchLoaded({
        cursorPage: cursorPage(0, 'page-1'),
        cursorUsed: null,
      }),
    );

    expect(first.cursorMode).toBe(true);
    expect(first.cursorByPage).toEqual([null]);
    expect(first.nextCursor).toBe('page-1');

    const requested = searchReducer(
      first,
      SearchActions.searchPageRequested({ page: 1 }),
    );
    const second = searchReducer(
      requested,
      SearchActions.cursorSearchLoaded({
        cursorPage: cursorPage(1, 'page-2'),
        cursorUsed: 'page-1',
      }),
    );

    expect(second.response?.page).toBe(1);
    expect(second.query.page).toBe(1);
    expect(second.cursorByPage).toEqual([null, 'page-1']);
    expect(second.nextCursor).toBe('page-2');
  });

  it('records the explicit offset-compatible fallback notice', () => {
    const state = searchReducer(
      initialSearchState,
      SearchActions.cursorCompatibilityLoaded({
        response: response(0),
        notice: 'Using offset-compatible paging.',
      }),
    );

    expect(state.response).toEqual(response(0));
    expect(state.cursorMode).toBe(false);
    expect(state.cursorByPage).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.paginationNotice).toBe('Using offset-compatible paging.');
  });

  it('clears cursor history while preserving an announced offset-compatible traversal', () => {
    const state = searchReducer(
      {
        ...initialSearchState,
        cursorMode: true,
        cursorByPage: [null, 'page-1'],
        nextCursor: 'page-2',
        paginationNotice: 'Using offset-compatible paging.',
      },
      SearchActions.searchLoaded({ response: response(4) }),
    );

    expect(state.cursorMode).toBe(false);
    expect(state.cursorByPage).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.paginationNotice).toBe('Using offset-compatible paging.');
    expect(state.query.page).toBe(4);
  });
});
