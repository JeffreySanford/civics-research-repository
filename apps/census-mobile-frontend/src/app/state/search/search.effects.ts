import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import {
  parseRepositoryError,
  RepositorySearchApi,
  type SearchQuery,
} from 'repository-api-client';
import { MobileSearchActions } from './search.actions';
import { selectMobileSearchState } from './search.selectors';

const CURSOR_COMPATIBILITY_NOTICE =
  'Deep-result traversal is temporarily using offset-compatible paging because cursor search is unavailable.';

@Injectable()
export class MobileSearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly searchApi = inject(RepositorySearchApi);

  readonly submitSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileSearchActions.searchSubmitted),
      switchMap(({ query }) =>
        this.searchApi
          .searchResearchObjectsWithCursor({ ...query, page: 0 }, null)
          .pipe(
            map((cursorPage) =>
              MobileSearchActions.cursorSearchLoaded({
                cursorPage,
                cursorUsed: null,
              }),
            ),
            catchError((error: unknown) => {
              const repositoryError = parseRepositoryError(
                error,
                'Search results failed to load.',
              );

              if (repositoryError.code !== 'SERVICE_UNAVAILABLE') {
                return of(
                  MobileSearchActions.searchFailed({
                    message: repositoryError.message,
                  }),
                );
              }

              return this.searchApi
                .searchResearchObjects({ ...query, page: 0 })
                .pipe(
                  map((response) =>
                    MobileSearchActions.cursorCompatibilityLoaded({
                      response,
                      notice: CURSOR_COMPATIBILITY_NOTICE,
                    }),
                  ),
                  catchError((fallbackError: unknown) =>
                    of(
                      MobileSearchActions.searchFailed({
                        message: parseRepositoryError(
                          fallbackError,
                          'Search results failed to load.',
                        ).message,
                      }),
                    ),
                  ),
                );
            }),
          ),
      ),
    ),
  );

  readonly requestPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileSearchActions.pageRequested),
      withLatestFrom(this.store.select(selectMobileSearchState)),
      switchMap(([, state]) => {
        const targetPage = Math.max(0, state.query.page ?? 0);
        const query: SearchQuery = { ...state.query, page: targetPage };

        if (!state.cursorMode) {
          return this.searchApi.searchResearchObjects(query).pipe(
            map((response) => MobileSearchActions.searchLoaded({ response })),
            catchError((error: unknown) =>
              of(
                MobileSearchActions.searchFailed({
                  message: parseRepositoryError(
                    error,
                    'Search results failed to load.',
                  ).message,
                }),
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
            MobileSearchActions.searchFailed({
              message:
                'That result page is outside the retained search path. Start the search again before continuing.',
            }),
          );
        }

        return this.searchApi
          .searchResearchObjectsWithCursor(query, cursor)
          .pipe(
            map((cursorPage) =>
              MobileSearchActions.cursorSearchLoaded({
                cursorPage,
                cursorUsed: cursor,
              }),
            ),
            catchError((error: unknown) =>
              of(
                MobileSearchActions.searchFailed({
                  message: parseRepositoryError(
                    error,
                    'Search results failed to load.',
                  ).message,
                }),
              ),
            ),
          );
      }),
    ),
  );
}
