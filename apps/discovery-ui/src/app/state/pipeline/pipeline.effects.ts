import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, forkJoin, map, mergeMap, of } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryAdminApi,
} from 'repository-api-client';
import { PipelineActions } from './pipeline.actions';

@Injectable()
export class PipelineEffects {
  private readonly actions$ = inject(Actions);
  private readonly adminApi = inject(RepositoryAdminApi);

  /**
   * All three stages in one request set.
   *
   * forkJoin, so the panel renders once with a consistent picture rather than three times as the
   * numbers trickle in and appear to disagree with each other.
   */
  readonly loadPipeline$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PipelineActions.loadRequested),
      mergeMap(() =>
        forkJoin({
          inventory: this.adminApi.getSourceInventory(),
          dspace: this.adminApi.getDspaceOverview(),
          solr: this.adminApi.getSolrOverview(),
        }).pipe(
          map(({ inventory, dspace, solr }) =>
            PipelineActions.loadSucceeded({ inventory, dspace, solr }),
          ),
          catchError((error: unknown) =>
            of(
              PipelineActions.loadFailed({
                error: parseRepositoryError(
                  error,
                  'Data pipeline figures failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
