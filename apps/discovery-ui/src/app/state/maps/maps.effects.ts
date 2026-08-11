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
          layers: this.mapsApi.getDatasetMapLayers(
            'tiger-line-north-dakota-2025',
          ),
          censusAreaBoundaries: this.mapsApi.listCensusAreaBoundaries(),
        }).pipe(
          map(({ layers, censusAreaBoundaries }) =>
            MapsActions.mapDataLoaded({
              layers,
              censusAreaBoundaries,
            }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.mapDataFailed({
                error: this.errorMessage(error, 'Map data failed to load.'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadEarthquakeOverlay$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened),
      mergeMap(() =>
        this.mapsApi.getUsgsEarthquakeOverlay(0, 7).pipe(
          map((earthquakeOverlay) =>
            MapsActions.earthquakeOverlayLoaded({ earthquakeOverlay }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.earthquakeOverlayFailed({
                error: this.errorMessage(
                  error,
                  'USGS earthquake overlay failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  private errorMessage(error: unknown, fallback: string): string {
    if (this.isHttpError(error)) {
      return fallback;
    }

    return error instanceof Error ? error.message : fallback;
  }

  private isHttpError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'url' in error
    );
  }
}
