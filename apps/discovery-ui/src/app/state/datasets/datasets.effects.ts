import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  parseRepositoryError,
  RepositoryDatasetsApi,
  RepositoryMapsApi,
  type ResearchObjectDetail,
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
            DatasetsActions.datasetLoaded({
              detail,
              versions,
              versionHistoryStatus:
                versions.length > 1
                  ? 'HISTORY_AVAILABLE'
                  : 'OBSERVED_CURRENT_ONLY',
              mapLayers,
            }),
          ),
          catchError((error: unknown) =>
            of(
              DatasetsActions.datasetFailed({
                error: parseRepositoryError(
                  error,
                  'Dataset detail failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly openResearch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.researchOpened),
      switchMap(({ researchId }) =>
        this.datasetsApi.getResearchObject(researchId).pipe(
          switchMap((detail) =>
            this.loadResearchEnrichments(detail, researchId),
          ),
          catchError((error: unknown) =>
            of(
              DatasetsActions.datasetFailed({
                error: parseRepositoryError(
                  error,
                  'Research detail failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  private loadResearchEnrichments(
    detail: ResearchObjectDetail,
    researchId: string,
  ) {
    const history$ = this.datasetsApi.getResearchObjectVersions(researchId);

    if (detail.source === 'FEDERATED') {
      return history$.pipe(
        map((history) =>
          DatasetsActions.datasetLoaded({
            detail,
            versions: history.versions,
            versionHistoryStatus: history.status,
            mapLayers: [],
          }),
        ),
      );
    }

    return forkJoin({
      history: history$,
      mapLayers: this.mapsApi.getDatasetMapLayers(detail.id),
    }).pipe(
      map(({ history, mapLayers }) =>
        DatasetsActions.datasetLoaded({
          detail,
          versions: history.versions,
          versionHistoryStatus: history.status,
          mapLayers,
        }),
      ),
    );
  }
}
