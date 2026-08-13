import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  parseRepositoryError,
  RepositorySearchApi,
} from 'repository-api-client';
import { SearchActions } from './search.actions';

@Injectable()
export class SearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly searchApi = inject(RepositorySearchApi);

  readonly submitSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchSubmitted),
      switchMap(({ query }) =>
        this.searchApi.searchResearchObjects(query).pipe(
          map((response) => SearchActions.searchLoaded({ response })),
          catchError((error: unknown) =>
            of(
              SearchActions.searchFailed({
                error: parseRepositoryError(
                  error,
                  'Search results failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
