import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, withLatestFrom } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryAdminApi,
} from 'repository-api-client';
import { SyncActions } from './sync.actions';
import { selectSelectedSyncSource } from './sync.selectors';

@Injectable()
export class SyncEffects {
  private readonly actions$ = inject(Actions);
  private readonly adminApi = inject(RepositoryAdminApi);
  private readonly store = inject(Store);

  readonly requestDryRun$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.dryRunRequested),
      withLatestFrom(this.store.select(selectSelectedSyncSource)),
      map(([, source]) =>
        SyncActions.syncRequested({ mode: 'DRY_RUN', source }),
      ),
    ),
  );

  readonly requestApply$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.applyRequested),
      withLatestFrom(this.store.select(selectSelectedSyncSource)),
      map(([, source]) => SyncActions.syncRequested({ mode: 'APPLY', source })),
    ),
  );

  readonly requestDiff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.diffRequested),
      withLatestFrom(this.store.select(selectSelectedSyncSource)),
      map(([, source]) => SyncActions.syncRequested({ mode: 'DIFF', source })),
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
                error: parseRepositoryError(
                  error,
                  'Repository sync request failed.',
                ),
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
                error: parseRepositoryError(
                  error,
                  'Repository sync history failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly runReindex$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SyncActions.reindexRequested),
      mergeMap(() =>
        this.adminApi.reindexDiscovery().pipe(
          map((projection) => SyncActions.reindexSucceeded({ projection })),
          catchError((error: unknown) =>
            of(
              SyncActions.reindexFailed({
                error: parseRepositoryError(error, 'Discovery reindex failed.'),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
