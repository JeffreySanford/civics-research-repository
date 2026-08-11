import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import { selectEarthquakeOverlay } from './maps.selectors';

describe('mapsReducer', () => {
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
      MapsActions.mapDataLoaded({ layers: [layer], earthquakeOverlay }),
    );

    expect(state.layers).toEqual([layer]);
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
