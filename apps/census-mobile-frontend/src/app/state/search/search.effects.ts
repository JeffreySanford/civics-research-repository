import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  parseRepositoryError,
  RepositorySearchApi,
} from 'repository-api-client';
import { MobileSearchActions } from './search.actions';

@Injectable()
export class MobileSearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly searchApi = inject(RepositorySearchApi);

  readonly submitSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileSearchActions.searchSubmitted),
      switchMap(({ query }) =>
        this.searchApi.searchResearchObjects(query).pipe(
          map((response) => MobileSearchActions.searchLoaded({ response })),
          catchError((error: unknown) => {
            const repositoryError = parseRepositoryError(
              error,
              'Search results failed to load.',
            );
            return of(
              MobileSearchActions.searchFailed({
                message: repositoryError.message,
              }),
            );
          }),
        ),
      ),
    ),
  );
}
