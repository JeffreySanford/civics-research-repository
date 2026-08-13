import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';
import { ErrorSnackbarService } from 'shared-material';
import { DatasetsActions } from '../datasets/datasets.actions';
import { MapsActions } from '../maps/maps.actions';
import { SearchActions } from '../search/search.actions';
import { SyncActions } from '../sync/sync.actions';

@Injectable()
export class ErrorNotificationEffects {
  private readonly actions$ = inject(Actions);
  private readonly snackbars = inject(ErrorSnackbarService);

  readonly notifySearchFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SearchActions.searchFailed),
        tap(({ error }) => this.snackbars.show(error)),
      ),
    { dispatch: false },
  );

  readonly notifyDatasetFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DatasetsActions.datasetFailed),
        tap(({ error }) => this.snackbars.show(error)),
      ),
    { dispatch: false },
  );

  readonly notifySyncFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SyncActions.syncFailed),
        tap(({ error }) => this.snackbars.show(error)),
      ),
    { dispatch: false },
  );

  readonly notifyMapFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(MapsActions.mapDataFailed, MapsActions.earthquakeOverlayFailed),
        tap(({ error }) => this.snackbars.show(error)),
      ),
    { dispatch: false },
  );

  readonly notifyReindexFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SyncActions.reindexFailed),
        tap(({ error }) => this.snackbars.show(error)),
      ),
    { dispatch: false },
  );
}
