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

@Injectable()
export class MobileSearchEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly searchApi = inject(RepositorySearchApi);

  readonly submitSearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileSearchActions.searchSubmitted),
      switchMap(({ query }) => this.load(query)),
    ),
  );

  readonly requestPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileSearchActions.pageRequested),
      withLatestFrom(this.store.select(selectMobileSearchState)),
      switchMap(([, state]) => this.load(state.query)),
    ),
  );

  private load(query: SearchQuery) {
    return this.searchApi.searchResearchObjects(query).pipe(
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
    );
  }
}
