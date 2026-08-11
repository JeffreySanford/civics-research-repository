import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, forkJoin, map, mergeMap, of } from 'rxjs';
import { RepositoryMapsApi } from 'repository-api-client';
import { MapsActions } from './maps.actions';

@Injectable()
export class MapsEffects {
  private readonly actions$ = inject(Actions);
  private readonly mapsApi = inject(RepositoryMapsApi);

  readonly loadMapData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened),
      mergeMap(() =>
        forkJoin({
          layers: this.mapsApi.getDatasetMapLayers('tiger-line-nd'),
          earthquakeOverlay: this.mapsApi.getUsgsEarthquakeOverlay(0, 7),
        }).pipe(
          map(({ layers, earthquakeOverlay }) =>
            MapsActions.mapDataLoaded({ layers, earthquakeOverlay }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.mapDataFailed({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Map data failed to load.',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
