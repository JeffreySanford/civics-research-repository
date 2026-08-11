import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import {
  selectEarthquakeError,
  selectEarthquakeOverlay,
} from './maps.selectors';

describe('mapsReducer', () => {
  const censusAreaBoundary = {
    id: 'north-dakota',
    label: 'North Dakota Census area boundary preview',
    geography: 'North Dakota',
    west: -104.0489,
    south: 45.9351,
    east: -96.5545,
    north: 49.0007,
    centerLatitude: 47.5515,
    centerLongitude: -101.002,
    defaultZoom: 6,
  };

  it('stores map layers and Census area boundaries', () => {
    const layer = {
      id: 'tiger-line-nd-boundary',
      label: '2025 TIGER/Line - Census Tracts - North Dakota',
      layerType: 'CENSUS_BOUNDARY' as const,
      sourceUrl: 'https://example.test/tiger',
      attribution: 'U.S. Census Bureau TIGER/Line',
      visibleByDefault: true,
    };

    const state = mapsReducer(
      initialMapsState,
      MapsActions.mapDataLoaded({
        layers: [layer],
        censusAreaBoundaries: [censusAreaBoundary],
      }),
    );

    expect(state.layers).toEqual([layer]);
    expect(state.censusAreaBoundaries).toEqual([censusAreaBoundary]);
    expect(state.loading).toBe(false);
  });

  it('stores earthquake overlay data independently', () => {
    const earthquakeOverlay = {
      source: 'USGS Earthquake Catalog GeoJSON',
      sourceUrl:
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
      attribution: 'U.S. Geological Survey Earthquake Hazards Program',
      updatedAt: '2026-08-11T19:00:00Z',
      staleAfter: '2026-08-12T19:00:00Z',
      fallback: false,
      query: {
        minMagnitude: 0,
        days: 7,
        minLatitude: 45.8,
        maxLatitude: 49.1,
        minLongitude: -104.2,
        maxLongitude: -96.4,
      },
      features: [],
    };

    const state = mapsReducer(
      initialMapsState,
      MapsActions.earthquakeOverlayLoaded({ earthquakeOverlay }),
    );

    expect(state.earthquakeOverlay).toEqual(earthquakeOverlay);
    expect(state.earthquakeError).toBeNull();
  });

  it('tracks earthquake overlay failures without clearing map layers', () => {
    const state = mapsReducer(
      {
        ...initialMapsState,
        layers: [
          {
            id: 'tiger-line-nd-boundary',
            label: '2025 TIGER/Line - Census Tracts - North Dakota',
            layerType: 'CENSUS_BOUNDARY',
            sourceUrl: 'https://example.test/tiger',
            attribution: 'U.S. Census Bureau TIGER/Line',
            visibleByDefault: true,
          },
        ],
        censusAreaBoundaries: [censusAreaBoundary],
      },
      MapsActions.earthquakeOverlayFailed({
        error: 'USGS overlay service unavailable.',
      }),
    );

    expect(state.layers).toHaveLength(1);
    expect(state.censusAreaBoundaries).toEqual([censusAreaBoundary]);
    expect(state.earthquakeOverlay).toBeNull();
    expect(state.earthquakeError).toBe('USGS overlay service unavailable.');
  });

  it('tracks layer visibility', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.earthquakeLayerToggled({ visible: false }),
    );

    expect(state.earthquakeVisible).toBe(false);
  });

  it('tracks selected census geography', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.censusAreaSelected({ geography: 'California' }),
    );

    expect(state.selectedGeography).toBe('California');
  });

  it('selects the earthquake overlay', () => {
    const earthquakeOverlay = {
      source: 'USGS Earthquake Catalog GeoJSON',
      sourceUrl:
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
      attribution: 'U.S. Geological Survey Earthquake Hazards Program',
      updatedAt: '2026-08-11T19:00:00Z',
      staleAfter: '2026-08-12T19:00:00Z',
      fallback: false,
      query: {
        minMagnitude: 0,
        days: 7,
        minLatitude: 45.8,
        maxLatitude: 49.1,
        minLongitude: -104.2,
        maxLongitude: -96.4,
      },
      features: [],
    };

    const selected = selectEarthquakeOverlay.projector({
      ...initialMapsState,
      earthquakeOverlay,
    });

    expect(selected).toBe(earthquakeOverlay);
  });

  it('selects the earthquake overlay error', () => {
    const selected = selectEarthquakeError.projector({
      ...initialMapsState,
      earthquakeError: 'USGS overlay service unavailable.',
    });

    expect(selected).toBe('USGS overlay service unavailable.');
  });
});
