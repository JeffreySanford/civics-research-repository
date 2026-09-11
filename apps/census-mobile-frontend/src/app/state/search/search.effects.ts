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

@Injectable()
export class SearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly searchApi = inject(RepositorySearchApi);

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

  readonly requestPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchPageRequested),
      withLatestFrom(this.store.select(selectSearchState)),
      switchMap(([{ page }, state]) => {
        const query: SearchQuery = {
          ...state.query,
          page: Math.max(0, page),
        };

        return this.searchApi.searchResearchObjects(query).pipe(
          map((response) => SearchActions.searchLoaded({ response })),
          catchError((error: unknown) =>
            of(SearchActions.searchFailed({ error: this.searchError(error) })),
          ),
        );
      }),
    ),
  );

  private searchError(error: unknown): RepositoryError {
    return parseRepositoryError(error, 'Search results failed to load.');
  }
}
