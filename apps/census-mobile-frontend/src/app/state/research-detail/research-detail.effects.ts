import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryDatasetsApi,
} from 'repository-api-client';
import { MobileResearchDetailActions } from './research-detail.actions';

@Injectable()
export class MobileResearchDetailEffects {
  private readonly actions$ = inject(Actions);
  private readonly datasetsApi = inject(RepositoryDatasetsApi);

  readonly loadDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MobileResearchDetailActions.detailOpened),
      switchMap(({ researchId }) =>
        this.datasetsApi.getResearchObject(researchId).pipe(
          map((detail) => MobileResearchDetailActions.detailLoaded({ detail })),
          catchError((error: unknown) =>
            of(
              MobileResearchDetailActions.detailFailed({
                message: parseRepositoryError(
                  error,
                  'Research object detail failed to load.',
                ).message,
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
