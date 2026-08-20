import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, switchMap, withLatestFrom } from 'rxjs';
import { parseRepositoryError, RepositoryMapsApi } from 'repository-api-client';
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
                error: parseRepositoryError(error, 'Map data failed to load.'),
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
                error: parseRepositoryError(
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
                error: parseRepositoryError(
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

  readonly loadLodesWorkplaceForSelectedArea$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened, MapsActions.censusAreaSelected),
      withLatestFrom(this.store.select(selectSelectedGeography)),
      switchMap(([, geography]) =>
        this.mapsApi.getLodesWorkplaceOverlay(geography).pipe(
          map((lodesWorkplaceOverlay) =>
            MapsActions.lodesWorkplaceOverlayLoaded({ lodesWorkplaceOverlay }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.lodesWorkplaceOverlayFailed({
                error: parseRepositoryError(
                  error,
                  `LODES workplace employment for ${geography} failed to load.`,
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadLodesFlowForSelectedArea$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened, MapsActions.censusAreaSelected),
      withLatestFrom(this.store.select(selectSelectedGeography)),
      switchMap(([, geography]) =>
        this.mapsApi.getLodesFlowOverlay(geography).pipe(
          map((lodesFlowOverlay) =>
            MapsActions.lodesFlowOverlayLoaded({ lodesFlowOverlay }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.lodesFlowOverlayFailed({
                error: parseRepositoryError(
                  error,
                  `LODES commuting flows for ${geography} failed to load.`,
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadSaipeChoroplethForSelectedArea$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapOpened, MapsActions.censusAreaSelected),
      withLatestFrom(this.store.select(selectSelectedGeography)),
      switchMap(([, geography]) =>
        this.mapsApi.getSaipeCountyChoropleth(geography).pipe(
          map((saipeChoropleth) =>
            MapsActions.saipeChoroplethLoaded({ saipeChoropleth }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.saipeChoroplethFailed({
                error: parseRepositoryError(
                  error,
                  `SAIPE choropleth for ${geography} failed to load.`,
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
