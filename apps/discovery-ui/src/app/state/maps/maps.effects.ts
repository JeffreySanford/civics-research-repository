import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, switchMap, withLatestFrom } from 'rxjs';
import { RepositoryMapsApi } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { selectSelectedGeography } from './maps.selectors';

/**
 * The dataset identifier the repository seeds for a Census area's TIGER/Line boundary.
 *
 * The same slug convention the backend uses to resolve a dataset back to its geography, so a new
 * area needs no change here.
 */
function datasetIdForGeography(geography: string): string {
  return `tiger-line-${geography.toLowerCase().replace(/\s+/g, '-')}-2025`;
}

@Injectable()
export class MapsEffects {
  private readonly actions$ = inject(Actions);
  private readonly mapsApi = inject(RepositoryMapsApi);
  private readonly store = inject(Store);

  readonly loadMapData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened),
      mergeMap(() =>
        this.mapsApi.listCensusAreaBoundaries().pipe(
          map((censusAreaBoundaries) =>
            MapsActions.mapDataLoaded({ censusAreaBoundaries }),
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

  /**
   * Loads the layer list for whichever Census area is selected.
   *
   * The layers used to be fetched once, alongside the boundaries, for North Dakota: selecting
   * another state moved the viewport but left every state claiming North Dakota's layers. Opening
   * the map is treated as a selection of the current area, so this is the only place layers are
   * fetched — otherwise a slower boundary load could land after a URL-supplied area and overwrite
   * it with the default. switchMap, so a fast series of selections resolves to the last one.
   */
  readonly loadLayersForSelectedArea$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened, MapsActions.censusAreaSelected),
      withLatestFrom(this.store.select(selectSelectedGeography)),
      switchMap(([, geography]) =>
        this.mapsApi.getDatasetMapLayers(datasetIdForGeography(geography)).pipe(
          map((layers) => MapsActions.mapLayersLoaded({ layers })),
          catchError((error: unknown) =>
            of(
              MapsActions.mapDataFailed({
                error: this.errorMessage(
                  error,
                  `Map layers for ${geography} failed to load.`,
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
