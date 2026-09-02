import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositorySearchApi,
  type SearchCursorPage,
  type SearchResponse,
} from 'repository-api-client';
import { SearchActions } from './search.actions';
import { SearchEffects } from './search.effects';
import { initialSearchState, type SearchState } from './search.reducer';

const response = (page: number): SearchResponse => ({
  resultSource: 'REPOSITORY',
  query: 'tracts',
  page,
  pageSize: 25,
  totalResults: 80,
  results: [],
  facets: [],
});

function setup(
  searchApi: Partial<RepositorySearchApi>,
  actions$: Observable<unknown>,
  state: SearchState = initialSearchState,
) {
  TestBed.configureTestingModule({
    providers: [
      SearchEffects,
      provideMockActions(() => actions$),
      provideMockStore({ initialState: { search: state } }),
      { provide: RepositorySearchApi, useValue: searchApi },
    ],
  });

  return TestBed.inject(SearchEffects);
}

describe('SearchEffects cursor traversal', () => {
  it('starts cursor traversal without a cursor', async () => {
    const cursorPage: SearchCursorPage = {
      search: response(0),
      nextCursor: 'page-1',
    };
    const searchResearchObjectsWithCursor = vi
      .fn()
      .mockReturnValue(of(cursorPage));
    const effects = setup(
      { searchResearchObjectsWithCursor } as unknown as RepositorySearchApi,
      of(
        SearchActions.cursorSearchSubmitted({
          query: { q: 'tracts', page: 9, pageSize: 25 },
        }),
      ),
    );

    const emitted = await firstValueFrom(effects.submitCursorSearch$);

    expect(searchResearchObjectsWithCursor).toHaveBeenCalledWith(
      { q: 'tracts', page: 0, pageSize: 25 },
      null,
    );
    expect(emitted).toEqual(
      SearchActions.cursorSearchLoaded({ cursorPage, cursorUsed: null }),
    );
  });

  it('announces an offset-compatible fallback when cursor startup cannot verify a projection', async () => {
    const searchResearchObjectsWithCursor = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 503,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message:
            'No active discovery projection is available for cursor search.',
        },
      })),
    );
    const searchResearchObjects = vi.fn().mockReturnValue(of(response(0)));
    const effects = setup(
      {
        searchResearchObjectsWithCursor,
        searchResearchObjects,
      } as unknown as RepositorySearchApi,
      of(
        SearchActions.cursorSearchSubmitted({
          query: { q: 'tracts', page: 0, pageSize: 25 },
        }),
      ),
    );

    const emitted = await firstValueFrom(effects.submitCursorSearch$);

    expect(searchResearchObjects).toHaveBeenCalledWith({
      q: 'tracts',
      page: 0,
      pageSize: 25,
    });
    expect(emitted.type).toBe(SearchActions.cursorCompatibilityLoaded.type);
    if (SearchActions.cursorCompatibilityLoaded.match(emitted)) {
      expect(emitted.response).toEqual(response(0));
      expect(emitted.notice).toContain('offset-compatible paging');
    }
  });

  it('does not fall back when cursor startup rejects an invalid cursor request', async () => {
    const searchResearchObjectsWithCursor = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 400,
        error: {
          code: 'BAD_REQUEST',
          message: 'Search cursor signature is not valid.',
        },
      })),
    );
    const searchResearchObjects = vi.fn();
    const effects = setup(
      {
        searchResearchObjectsWithCursor,
        searchResearchObjects,
      } as unknown as RepositorySearchApi,
      of(
        SearchActions.cursorSearchSubmitted({
          query: { q: 'tracts', page: 0, pageSize: 25 },
        }),
      ),
    );

    const emitted = await firstValueFrom(effects.submitCursorSearch$);

    expect(searchResearchObjects).not.toHaveBeenCalled();
    expect(emitted).toEqual(
      SearchActions.searchFailed({
        error: {
          code: 'BAD_REQUEST',
          message: 'Search cursor signature is not valid.',
          details: undefined,
          traceId: undefined,
        },
      }),
    );
  });

  it('uses only the current next cursor for the immediate next page', async () => {
    const cursorPage: SearchCursorPage = {
      search: response(1),
      nextCursor: 'page-2',
    };
    const searchResearchObjectsWithCursor = vi
      .fn()
      .mockReturnValue(of(cursorPage));
    const state: SearchState = {
      ...initialSearchState,
      query: { q: 'tracts', page: 0, pageSize: 25 },
      response: response(0),
      cursorMode: true,
      cursorByPage: [null],
      nextCursor: 'page-1',
    };
    const effects = setup(
      { searchResearchObjectsWithCursor } as unknown as RepositorySearchApi,
      of(SearchActions.searchPageRequested({ page: 1 })),
      state,
    );

    const emitted = await firstValueFrom(effects.requestPage$);

    expect(searchResearchObjectsWithCursor).toHaveBeenCalledWith(
      { q: 'tracts', page: 1, pageSize: 25 },
      'page-1',
    );
    expect(emitted).toEqual(
      SearchActions.cursorSearchLoaded({
        cursorPage,
        cursorUsed: 'page-1',
      }),
    );
  });

  it('replays a retained cursor when navigating to a previous page', async () => {
    const cursorPage: SearchCursorPage = {
      search: response(1),
      nextCursor: 'page-2',
    };
    const searchResearchObjectsWithCursor = vi
      .fn()
      .mockReturnValue(of(cursorPage));
    const state: SearchState = {
      ...initialSearchState,
      query: { q: 'tracts', page: 2, pageSize: 25 },
      response: response(2),
      cursorMode: true,
      cursorByPage: [null, 'page-1', 'page-2'],
      nextCursor: 'page-3',
    };
    const effects = setup(
      { searchResearchObjectsWithCursor } as unknown as RepositorySearchApi,
      of(SearchActions.searchPageRequested({ page: 1 })),
      state,
    );

    await firstValueFrom(effects.requestPage$);

    expect(searchResearchObjectsWithCursor).toHaveBeenCalledWith(
      { q: 'tracts', page: 1, pageSize: 25 },
      'page-1',
    );
  });

  it('refuses to synthesize an offset fallback outside known cursor history', async () => {
    const searchResearchObjects = vi.fn();
    const searchResearchObjectsWithCursor = vi.fn();
    const state: SearchState = {
      ...initialSearchState,
      query: { q: 'tracts', page: 2, pageSize: 25 },
      response: response(2),
      cursorMode: true,
      cursorByPage: [null, 'page-1', 'page-2'],
      nextCursor: 'page-3',
    };
    const effects = setup(
      {
        searchResearchObjects,
        searchResearchObjectsWithCursor,
      } as unknown as RepositorySearchApi,
      of(SearchActions.searchPageRequested({ page: 7 })),
      state,
    );

    const emitted = await firstValueFrom(effects.requestPage$);

    expect(searchResearchObjects).not.toHaveBeenCalled();
    expect(searchResearchObjectsWithCursor).not.toHaveBeenCalled();
    expect(emitted.type).toBe(SearchActions.searchFailed.type);
  });
});
