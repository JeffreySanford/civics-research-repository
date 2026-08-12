import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositoryMapsApi,
  type CensusAreaBoundary,
  type MapLayer,
  type UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { MapsEffects } from './maps.effects';

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
) {
  TestBed.configureTestingModule({
    providers: [
      MapsEffects,
      provideMockActions(() => actions$),
      { provide: RepositoryMapsApi, useValue: mapsApi },
    ],
  });

  return TestBed.inject(MapsEffects);
}

describe('MapsEffects', () => {
  it('loads layers and census boundaries when the map opens', async () => {
    const effects = setup(
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(of(layers)),
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataLoaded({ layers, censusAreaBoundaries }),
    );
  });

  it('reports a map data failure', async () => {
    const effects = setup(
      {
        getDatasetMapLayers: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Layers unavailable'))),
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataFailed({ error: 'Layers unavailable' }),
    );
  });

  /**
   * HttpErrorResponse messages are noisy and leak URLs into the UI, so transport errors are
   * deliberately reported with the friendly fallback instead of `error.message`.
   */
  it('hides raw HTTP transport errors behind the fallback message', async () => {
    const effects = setup(
      {
        getDatasetMapLayers: vi.fn().mockReturnValue(
          throwError(() =>
            Object.assign(
              new Error('Http failure response for /map-layers: 500'),
              {
                status: 500,
                url: 'http://localhost:8080/api/datasets/x/map-layers',
              },
            ),
          ),
        ),
        listCensusAreaBoundaries: vi
          .fn()
          .mockReturnValue(of(censusAreaBoundaries)),
      } as unknown as RepositoryMapsApi,
      of(MapsActions.mapOpened()),
    );

    const emitted = await firstValueFrom(effects.loadMapData$);

    expect(emitted).toEqual(
      MapsActions.mapDataFailed({ error: 'Map data failed to load.' }),
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
      MapsActions.mapDataLoaded({ layers, censusAreaBoundaries }),
    );
    expect(await firstValueFrom(effects.loadEarthquakeOverlay$)).toEqual(
      MapsActions.earthquakeOverlayFailed({ error: 'USGS feed down' }),
    );
  });
});
