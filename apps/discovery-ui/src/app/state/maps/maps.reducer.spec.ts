import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import { selectEarthquakeOverlay } from './maps.selectors';

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

  it('stores map layers and overlay data', () => {
    const earthquakeOverlay = {
      source: 'USGS Earthquake Catalog GeoJSON',
      updatedAt: '2026-08-11T19:00:00Z',
      features: [],
    };
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
        earthquakeOverlay,
      }),
    );

    expect(state.layers).toEqual([layer]);
    expect(state.censusAreaBoundaries).toEqual([censusAreaBoundary]);
    expect(state.earthquakeOverlay).toEqual(earthquakeOverlay);
    expect(state.loading).toBe(false);
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
      updatedAt: '2026-08-11T19:00:00Z',
      features: [],
    };

    const selected = selectEarthquakeOverlay.projector({
      ...initialMapsState,
      earthquakeOverlay,
    });

    expect(selected).toBe(earthquakeOverlay);
  });
});
