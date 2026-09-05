import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  concat,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import {
  parseRepositoryError,
  RepositoryMapsApi,
  type PopulationEstimateMeasure,
} from 'repository-api-client';
import { MapsActions } from './maps.actions';
import {
  selectMapLayers,
  selectPopulationEstimateMeasure,
  selectPopulationEstimateYear,
  selectSelectedGeography,
} from './maps.selectors';

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
      ofType(MapsActions.mapLayersLoaded),
      filter(({ layers }) =>
        layers.some((layer) => layer.layerType === 'CENSUS_CHOROPLETH'),
      ),
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

  /**
   * Research Coverage consumes the bounded spatial sidecar API directly. `switchMap` gives the
   * viewport the same latest-request-wins semantics as the rest of Maps: a slow request for the
   * previous pan/zoom can never overwrite the response for the current viewport.
   */
  readonly loadPopulationEstimatesForSelectedArea$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.mapLayersLoaded),
      filter(({ layers }) =>
        layers.some((layer) =>
          layer.id.startsWith('population-estimates-county-'),
        ),
      ),
      withLatestFrom(
        this.store.select(selectSelectedGeography),
        this.store.select(selectPopulationEstimateMeasure),
        this.store.select(selectPopulationEstimateYear),
      ),
      switchMap(([, geography, measure, year]) =>
        this.populationEstimatesRequest(geography, measure, year),
      ),
    ),
  );

  readonly reloadPopulationEstimatesForConfiguration$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.populationEstimatesConfigurationChanged),
      withLatestFrom(
        this.store.select(selectSelectedGeography),
        this.store.select(selectMapLayers),
      ),
      filter(([, , layers]) =>
        layers.some((layer) =>
          layer.id.startsWith('population-estimates-county-'),
        ),
      ),
      switchMap(([{ measure, year }, geography]) =>
        this.populationEstimatesRequest(geography, measure, year),
      ),
    ),
  );

  readonly loadResearchCoverage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MapsActions.researchCoverageRequested),
      switchMap(({ query, viewport }) =>
        this.mapsApi.getResearchSpatialCoverage(query, viewport).pipe(
          map((response) => MapsActions.researchCoverageLoaded({ response })),
          catchError((error: unknown) =>
            of(
              MapsActions.researchCoverageFailed({
                error: parseRepositoryError(
                  error,
                  'Repository research coverage failed to load.',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
  private populationEstimatesRequest(
    geography: string,
    measure: PopulationEstimateMeasure,
    year: number,
  ) {
    return concat(
      of(MapsActions.populationEstimatesRequested()),
      this.mapsApi
        .getPopulationEstimatesChoropleth(geography, measure, year)
        .pipe(
          map((populationEstimatesChoropleth) =>
            MapsActions.populationEstimatesLoaded({
              populationEstimatesChoropleth,
            }),
          ),
          catchError((error: unknown) =>
            of(
              MapsActions.populationEstimatesFailed({
                error: parseRepositoryError(
                  error,
                  `County population estimates for ${geography} failed to load.`,
                ),
              }),
            ),
          ),
        ),
    );
  }
}
