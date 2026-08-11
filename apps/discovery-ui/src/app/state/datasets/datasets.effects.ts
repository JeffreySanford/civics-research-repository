import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  RepositoryDatasetsApi,
  RepositoryMapsApi,
} from 'repository-api-client';
import { DatasetsActions } from './datasets.actions';

@Injectable()
export class DatasetsEffects {
  private readonly actions$ = inject(Actions);
  private readonly datasetsApi = inject(RepositoryDatasetsApi);
  private readonly mapsApi = inject(RepositoryMapsApi);

  readonly openDataset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.datasetOpened),
      switchMap(({ datasetId }) =>
        forkJoin({
          detail: this.datasetsApi.getDataset(datasetId),
          versions: this.datasetsApi.getDatasetVersions(datasetId),
          mapLayers: this.mapsApi.getDatasetMapLayers(datasetId),
        }).pipe(
          map(({ detail, versions, mapLayers }) =>
            DatasetsActions.datasetLoaded({ detail, versions, mapLayers }),
          ),
          catchError((error: unknown) =>
            of(
              DatasetsActions.datasetFailed({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Dataset detail failed to load.',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
