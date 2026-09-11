import type { SearchCursorPage, SearchResponse } from 'repository-api-client';
import { MobileSearchActions } from './search.actions';
import {
  initialMobileSearchState,
  mobileSearchReducer,
} from './search.reducer';

const response = (page: number): SearchResponse => ({
  resultSource: 'REPOSITORY',
  query: 'North Dakota migration',
  page,
  pageSize: 10,
  totalResults: 5881,
  results: [],
  facets: [],
});

describe('mobileSearchReducer cursor paging', () => {
  it('retains the cursor used to enter a loaded logical page', () => {
    const firstPage: SearchCursorPage = {
      search: response(0),
      nextCursor: 'cursor-page-1',
    };
    const firstState = mobileSearchReducer(
      initialMobileSearchState,
      MobileSearchActions.cursorSearchLoaded({
        cursorPage: firstPage,
        cursorUsed: null,
      }),
    );

    const requestingNext = mobileSearchReducer(
      firstState,
      MobileSearchActions.pageRequested({ page: 1 }),
    );

    const secondPage: SearchCursorPage = {
      search: response(1),
      nextCursor: 'cursor-page-2',
    };
    const secondState = mobileSearchReducer(
      requestingNext,
      MobileSearchActions.cursorSearchLoaded({
        cursorPage: secondPage,
        cursorUsed: 'cursor-page-1',
      }),
    );

    expect(secondState.cursorMode).toBe(true);
    expect(secondState.cursorByPage[0]).toBeNull();
    expect(secondState.cursorByPage[1]).toBe('cursor-page-1');
    expect(secondState.nextCursor).toBe('cursor-page-2');
    expect(secondState.response?.page).toBe(1);
  });
});
