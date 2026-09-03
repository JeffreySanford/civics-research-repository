import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryEvidenceApi,
} from 'repository-api-client';
import { PerformanceEvidenceActions } from './performance-evidence.actions';

@Injectable()
export class PerformanceEvidenceEffects {
  private readonly actions$ = inject(Actions);
  private readonly evidenceApi = inject(RepositoryEvidenceApi);

  readonly loadEvidence$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PerformanceEvidenceActions.loadRequested),
      mergeMap(() =>
        this.evidenceApi.getSearchPerformanceEvidence().pipe(
          map((evidence) =>
            PerformanceEvidenceActions.loadSucceeded({ evidence }),
          ),
          catchError((error: unknown) =>
            of(
              PerformanceEvidenceActions.loadFailed({
                error: parseRepositoryError(
                  error,
                  'Certified C2 search performance evidence is not available on this runtime.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
