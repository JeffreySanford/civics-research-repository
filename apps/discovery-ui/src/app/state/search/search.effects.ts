import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import {
  parseRepositoryError,
  RepositorySearchApi,
  type RepositoryError,
  type SearchQuery,
} from 'repository-api-client';
import { SearchActions } from './search.actions';
import { selectSearchState } from './search.selectors';

const CURSOR_COMPATIBILITY_NOTICE =
  'Deep pagination is temporarily unavailable because the active search projection could not be verified. Results are using offset-compatible paging for this search.';

@Injectable()
export class SearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly searchApi = inject(RepositorySearchApi);

  /** Existing offset-compatible path used by shared/deep-linked page URLs. */
  readonly submitSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchSubmitted),
      switchMap(({ query }) =>
        this.searchApi.searchResearchObjects(query).pipe(
          map((response) => SearchActions.searchLoaded({ response })),
          catchError((error: unknown) =>
            of(SearchActions.searchFailed({ error: this.searchError(error) })),
          ),
        ),
      ),
    ),
  );

  /**
   * Starts a new forward cursor traversal without carrying offset page state.
   *
   * A page-zero start may explicitly use the compatibility search if the runtime cannot establish a
   * trustworthy active projection. This is intentionally different from continuation: once cursor
   * mode exists, it never degrades to offsets.
   */
  readonly submitCursorSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.cursorSearchSubmitted),
      switchMap(({ query }) =>
        this.searchApi
          .searchResearchObjectsWithCursor({ ...query, page: 0 }, null)
          .pipe(
            map((cursorPage) =>
              SearchActions.cursorSearchLoaded({
                cursorPage,
                cursorUsed: null,
              }),
            ),
            catchError((error: unknown) => {
              const cursorError = this.searchError(error);
              if (cursorError.code !== 'SERVICE_UNAVAILABLE') {
                return of(SearchActions.searchFailed({ error: cursorError }));
              }

              const compatibilityQuery: SearchQuery = { ...query, page: 0 };
              return this.searchApi.searchResearchObjects(compatibilityQuery).pipe(
                map((response) =>
                  SearchActions.cursorCompatibilityLoaded({
                    response,
                    notice: CURSOR_COMPATIBILITY_NOTICE,
                  }),
                ),
                catchError((fallbackError: unknown) =>
                  of(
                    SearchActions.searchFailed({
                      error: this.searchError(fallbackError),
                    }),
                  ),
                ),
              );
            }),
          ),
      ),
    ),
  );

  /**
   * Moves within whichever traversal mode produced the current page.
   *
   * Cursor mode never synthesizes an offset fallback. A previous page replays the cursor retained
   * for that logical page; the immediate next page uses only the continuation returned by the
   * currently displayed page. Requests outside that known history fail explicitly.
   */
  readonly requestPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchPageRequested),
      withLatestFrom(this.store.select(selectSearchState)),
      switchMap(([{ page }, state]) => {
        const targetPage = Math.max(0, page);
        const query: SearchQuery = { ...state.query, page: targetPage };

        if (!state.cursorMode) {
          return this.searchApi.searchResearchObjects(query).pipe(
            map((response) => SearchActions.searchLoaded({ response })),
            catchError((error: unknown) =>
              of(
                SearchActions.searchFailed({ error: this.searchError(error) }),
              ),
            ),
          );
        }

        const currentPage = Math.max(0, state.response?.page ?? 0);
        const visitedCursor = state.cursorByPage[targetPage];
        const cursor =
          targetPage === 0
            ? null
            : visitedCursor !== undefined
              ? visitedCursor
              : targetPage === currentPage + 1
                ? state.nextCursor
                : undefined;

        if (cursor === undefined || (targetPage > 0 && cursor === null)) {
          return of(
            SearchActions.searchFailed({
              error: {
                code: 'BAD_REQUEST',
                message:
                  'That result page is outside the retained cursor traversal. Start the search again before continuing.',
              },
            }),
          );
        }

        return this.searchApi
          .searchResearchObjectsWithCursor(query, cursor)
          .pipe(
            map((cursorPage) =>
              SearchActions.cursorSearchLoaded({
                cursorPage,
                cursorUsed: cursor,
              }),
            ),
            catchError((error: unknown) =>
              of(
                SearchActions.searchFailed({ error: this.searchError(error) }),
              ),
            ),
          );
      }),
    ),
  );

  private searchError(error: unknown): RepositoryError {
    return parseRepositoryError(error, 'Search results failed to load.');
  }
}
