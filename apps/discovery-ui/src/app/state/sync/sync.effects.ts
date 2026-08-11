import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';
import { RepositoryAdminApi } from 'repository-api-client';
import { SyncActions } from './sync.actions';

@Injectable()
export class SyncEffects {
  private readonly actions$ = inject(Actions);
  private readonly adminApi = inject(RepositoryAdminApi);

  readonly requestDryRun$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.dryRunRequested),
      map(() =>
        SyncActions.syncRequested({ mode: 'DRY_RUN', source: 'TIGER_LINE' }),
      ),
    ),
  );

  readonly requestApply$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.applyRequested),
      map(() =>
        SyncActions.syncRequested({ mode: 'APPLY', source: 'TIGER_LINE' }),
      ),
    ),
  );

  readonly runSync$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.syncRequested),
      mergeMap(({ mode, source }) =>
        this.adminApi.startSync({ mode, source }).pipe(
          map((job) => SyncActions.syncSucceeded({ job })),
          catchError((error: unknown) =>
            of(
              SyncActions.syncFailed({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Repository sync request failed.',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadHistory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.historyRequested),
      mergeMap(() =>
        this.adminApi.listSyncJobs().pipe(
          map((jobs) => SyncActions.historyLoaded({ jobs })),
          catchError((error: unknown) =>
            of(
              SyncActions.syncFailed({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Repository sync history failed to load.',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
