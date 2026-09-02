import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import {
  firstValueFrom,
  lastValueFrom,
  of,
  throwError,
  toArray,
  type Observable,
} from 'rxjs';
import {
  RepositoryMapsApi,
  type CensusAreaBoundary,
  type MapLayer,
  type UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { MapsEffects } from './maps.effects';
import { selectSelectedGeography } from './maps.selectors';

const layers = [
  {
    id: 'tiger-boundary',
    label: 'North Dakota TIGER/Line preview',
    layerType: 'CENSUS_BOUNDARY',
    sourceUrl: 'https://www2.census.gov/geo/tiger/TIGER2025/',
    attribution: 'U.S. Census Bureau TIGER/Line',
    visibleByDefault: true,
  },
] as unknown as MapLayer[];

const saipeLayer = {
  id: 'saipe-county-poverty-north-dakota',
  label: '2023 SAIPE county poverty - North Dakota',
  layerType: 'CENSUS_CHOROPLETH',
  sourceUrl:
    'https://www.census.gov/data/datasets/2023/demo-saipe/2023-state-and-county.html',
  attribution: 'U.S. Census Bureau Small Area Income and Poverty Estimates',
  visibleByDefault: true,
} as unknown as MapLayer;

const censusAreaBoundaries = [
  {
    id: 'north-dakota',
    label: 'North Dakota',
    geography: 'North Dakota',
    west: -104.05,
    south: 45.93,
    east: -96.55,
    north: 49,
    centerLatitude: 47.45,
    centerLongitude: -100.3,
    defaultZoom: 6,
  },
] as unknown as CensusAreaBoundary[];

const earthquakeOverlay = {
  source: 'USGS Earthquake Catalog',
  sourceUrl: 'https://earthquake.usgs.gov/',
  attribution: 'USGS',
  updatedAt: '2026-08-11T19:00:00Z',
  staleAfter: '2026-08-12T19:00:00Z',
  fallback: true,
  query: {
    minMagnitude: 0,
    days: 7,
    minLatitude: 45.93,
    maxLatitude: 49,
    minLongitude: -104.05,
    maxLongitude: -96.55,
  },
  features: [],
} as unknown as UsgsEarthquakeOverlay;

function setup(
  mapsApi: Partial<RepositoryMapsApi>,
  actions$: Observable<unknown>,
  selectedGeography = 'North Dakota',
) {
  TestBed.configureTestingModule({
    providers: [
      MapsEffects,
      provideMockActions(() => actions$),
      provideMockStore({
        selectors: [
          { selector: selectSelectedGeography, value: selectedGeography },
        ],
      }),
      { provide: RepositoryMapsApi, useValue: mapsApi },
    ],
  });

  return TestBed.inject(MapsEffects);
}

describe('MapsEffects', () => {
  it('loads the census boundaries when the map opens', async () => {
    const effects = setup(
      {
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataLoaded({ censusAreaBoundaries }),
    );
  });

  /**
   * Opening the map counts as selecting the current area, so the layers come from the same effect
   * as a later selection. A separate load here could land after a URL-supplied area and replace
   * its layers with the default ones.
   */
  it('loads the layers for the current area when the map opens', async () => {
    const getDatasetMapLayers = vi.fn().mockReturnValue(of(layers));
    const effects = setup(
      { getDatasetMapLayers } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
      'Texas',
    );

    const emitted = await firstValueFrom(effects.loadLayersForSelectedArea$);

    expect(getDatasetMapLayers).toHaveBeenCalledWith('tiger-line-texas-2025');
    expect(emitted).toEqual(MapsActions.mapLayersLoaded({ layers }));
  });

  it('reports a map data failure', async () => {
    const effects = setup(
      {
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(
            throwError(() => new Error('Boundaries unavailable')),
          ),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataFailed({
        error: { code: 'UNKNOWN', message: 'Boundaries unavailable' },
      }),
    );
  });

  /**
   * HttpErrorResponse messages are noisy and leak URLs into the UI, so transport errors are
   * deliberately reported with the friendly fallback instead of `error.message`.
   */
  it('hides raw HTTP transport errors behind the fallback message', async () => {
    const effects = setup(
      {
        listCensusAreaBoundaries: vi.fn().mockReturnValue(
          throwError(() =>
            Object.assign(
              new Error('Http failure response for /maps/census-areas: 500'),
              {
                status: 500,
                url: 'http://localhost:8080/api/maps/census-areas',
              },
            ),
          ),
        ),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataFailed({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Map data failed to load.',
        },
      }),
    );
  });

  it('requests the default earthquake overlay window when the map opens', async () => {
    const getUsgsEarthquakeOverlay = vi
      .fn()
      .mockReturnValue(of(earthquakeOverlay));
    const effects = setup(
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(of(layers)),
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
        getUsgsEarthquakeOverlay,
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadEarthquakeOverlay$);

    expect(getUsgsEarthquakeOverlay).toHaveBeenCalledWith(0, 7);
    expect(emitted).toEqual(
      MapsActions.earthquakeOverlayLoaded({ earthquakeOverlay }),
    );
  });

  /**
   * The layer list used to be fetched once, for North Dakota, so every other state was described
   * by North Dakota's layers.
   */
  it('reloads the layers for the newly selected Census area', async () => {
    const getDatasetMapLayers = vi.fn().mockReturnValue(of(layers));
    const effects = setup(
      { getDatasetMapLayers } as unknown as RepositoryMapsApi,
      of(MapsActions.censusAreaSelected({ geography: 'District of Columbia' })),
      'District of Columbia',
    );

    const emitted = await firstValueFrom(effects.loadLayersForSelectedArea$);

    expect(getDatasetMapLayers).toHaveBeenCalledWith(
      'tiger-line-district-of-columbia-2025',
    );
    expect(emitted).toEqual(MapsActions.mapLayersLoaded({ layers }));
  });

  it('names the area whose layers failed to load', async () => {
    const effects = setup(
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(
          throwError(() =>
            Object.assign(new Error('Http failure response: 503'), {
              status: 503,
              url: 'http://localhost:8080/api/datasets/x/map-layers',
            }),
          ),
        ),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.censusAreaSelected({ geography: 'California' })),
      'California',
    );

    expect(await firstValueFrom(effects.loadLayersForSelectedArea$)).toEqual(
      MapsActions.mapDataFailed({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Map layers for California failed to load.',
        },
      }),
    );
  });

  it('loads SAIPE only after the selected area advertises that capability', async () => {
    const saipeChoropleth = { geography: 'North Dakota' } as never;
    const getSaipeCountyChoropleth = vi
      .fn()
      .mockReturnValue(of(saipeChoropleth));
    const effects = setup(
      { getSaipeCountyChoropleth } as unknown as RepositoryMapsApi,
      of(MapsActions.mapLayersLoaded({ layers: [...layers, saipeLayer] })),
    );

    const emitted = await firstValueFrom(
      effects.loadSaipeChoroplethForSelectedArea$,
    );

    expect(getSaipeCountyChoropleth).toHaveBeenCalledWith('North Dakota');
    expect(emitted).toEqual(
      MapsActions.saipeChoroplethLoaded({ saipeChoropleth }),
    );
  });

  it('does not request SAIPE when the selected area does not advertise it', async () => {
    const getSaipeCountyChoropleth = vi.fn();
    const effects = setup(
      { getSaipeCountyChoropleth } as unknown as RepositoryMapsApi,
      of(MapsActions.mapLayersLoaded({ layers })),
      'Florida',
    );

    const emitted = await lastValueFrom(
      effects.loadSaipeChoroplethForSelectedArea$.pipe(toArray()),
    );

    expect(emitted).toEqual([]);
    expect(getSaipeCountyChoropleth).not.toHaveBeenCalled();
  });

  /** The Census layers must survive an overlay outage; the two effects are independent. */
  it('fails the overlay independently of the census map data', async () => {
    const effects = setup(
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(of(layers)),
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
        getUsgsEarthquakeOverlay: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('USGS feed down'))),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    expect(await firstValueFrom(effects.loadMapData$)).toEqual(
      MapsActions.mapDataLoaded({ censusAreaBoundaries }),
    );
    expect(await firstValueFrom(effects.loadEarthquakeOverlay$)).toEqual(
      MapsActions.earthquakeOverlayFailed({
        error: { code: 'UNKNOWN', message: 'USGS feed down' },
      }),
    );
  });
});
