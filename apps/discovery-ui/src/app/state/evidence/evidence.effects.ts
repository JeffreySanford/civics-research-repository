import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';
import { parseRepositoryError, RepositoryEvidenceApi } from 'repository-api-client';
import { EvidenceActions } from './evidence.actions';

@Injectable()
export class EvidenceEffects {
  private readonly actions$ = inject(Actions);
  private readonly evidenceApi = inject(RepositoryEvidenceApi);

  readonly loadEvidence$ = createEffect(() =>
    this.actions$.pipe(
      ofType(EvidenceActions.loadRequested),
      mergeMap(() =>
        this.evidenceApi.listAccessibilityEvidence().pipe(
          map((entries) => EvidenceActions.loadSucceeded({ entries })),
          catchError((error: unknown) =>
            of(
              EvidenceActions.loadFailed({
                error: parseRepositoryError(
                  error,
                  'Accessibility evidence failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
