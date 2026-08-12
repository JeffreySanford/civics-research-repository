import type { MapLayer, UsgsEarthquakeOverlay } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import {
  selectEarthquakeError,
  selectEarthquakeOverlay,
  selectSelectedEarthquakeFeature,
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

  const layer = {
    id: 'tiger-line-nd-boundary',
    label: '2025 TIGER/Line - Census Tracts - North Dakota',
    layerType: 'CENSUS_BOUNDARY' as const,
    sourceUrl: 'https://example.test/tiger',
    attribution: 'U.S. Census Bureau TIGER/Line',
    visibleByDefault: true,
  };

  /**
   * Boundaries and layers load separately: layers follow the selected area, so a slow boundary
   * load must not overwrite layers already fetched for an area chosen from the URL.
   */
  it('stores Census area boundaries without disturbing the layers', () => {
    const withLayers = mapsReducer(
      initialMapsState,
      MapsActions.mapLayersLoaded({ layers: [layer] }),
    );

    const state = mapsReducer(
      withLayers,
      MapsActions.mapDataLoaded({
        censusAreaBoundaries: [censusAreaBoundary],
      }),
    );

    expect(state.layers).toEqual([layer]);
    expect(state.censusAreaBoundaries).toEqual([censusAreaBoundary]);
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

  it('tracks the LODES layer toggle', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.lodesLayerToggled({ visible: false }),
    );

    expect(state.lodesVisible).toBe(false);
  });

  it('tracks selected census geography', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.censusAreaSelected({ geography: 'California' }),
    );

    expect(state.selectedGeography).toBe('California');
  });

  /** Selecting an area triggers a layer reload, so the map must read as loading until it lands. */
  it('reloads layers when the census area changes', () => {
    const selecting = mapsReducer(
      initialMapsState,
      MapsActions.censusAreaSelected({ geography: 'California' }),
    );

    expect(selecting.loading).toBe(true);

    const loaded = mapsReducer(
      selecting,
      MapsActions.mapLayersLoaded({
        layers: [
          {
            id: 'tiger-line-california-boundary',
            label: '2025 TIGER/Line - Census Tracts - California',
            layerType: 'CENSUS_BOUNDARY',
            sourceUrl: 'https://www2.census.gov/geo/tiger/TIGER2025/',
            attribution: 'U.S. Census Bureau TIGER/Line',
            visibleByDefault: true,
          },
        ] as unknown as MapLayer[],
      }),
    );

    expect(loaded.loading).toBe(false);
    expect(loaded.layers.map((layer) => layer.id)).toEqual([
      'tiger-line-california-boundary',
    ]);
    expect(loaded.censusAreaBoundaries).toEqual(
      initialMapsState.censusAreaBoundaries,
    );
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

describe('mapsReducer feature selection', () => {
  const overlay = {
    source: 'USGS',
    sourceUrl: 'https://earthquake.usgs.gov/',
    attribution: 'USGS',
    updatedAt: '2026-08-11T19:00:00Z',
    staleAfter: '2026-08-12T19:00:00Z',
    fallback: true,
    query: {
      minMagnitude: 0,
      days: 7,
      minLatitude: 45,
      maxLatitude: 49,
      minLongitude: -104,
      maxLongitude: -96,
    },
    features: [
      {
        id: 'nd-1',
        place: 'Western North Dakota',
        magnitude: 2.4,
        occurredAt: '2026-08-11T18:00:00Z',
        latitude: 47.35,
        longitude: -103.21,
      },
    ],
  } as unknown as UsgsEarthquakeOverlay;

  it('records the selected feature', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'nd-1' }),
    );

    expect(state.selectedFeatureId).toBe('nd-1');
  });

  it('clears the selection on request', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'nd-1' }),
    );

    const cleared = mapsReducer(
      selected,
      MapsActions.mapFeatureSelectionCleared(),
    );

    expect(cleared.selectedFeatureId).toBeNull();
  });

  /** A selected feature that is no longer drawn would leave map and list disagreeing. */
  it('clears the selection when the earthquake layer is hidden', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'nd-1' }),
    );

    const hidden = mapsReducer(
      selected,
      MapsActions.earthquakeLayerToggled({ visible: false }),
    );

    expect(hidden.selectedFeatureId).toBeNull();
  });

  it('keeps the selection when the layer is shown again', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'nd-1' }),
    );

    const shown = mapsReducer(
      selected,
      MapsActions.earthquakeLayerToggled({ visible: true }),
    );

    expect(shown.selectedFeatureId).toBe('nd-1');
  });

  it('keeps a selection the new overlay still contains', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'nd-1' }),
    );

    const loaded = mapsReducer(
      selected,
      MapsActions.earthquakeOverlayLoaded({ earthquakeOverlay: overlay }),
    );

    expect(loaded.selectedFeatureId).toBe('nd-1');
  });

  it('drops a selection the new overlay no longer contains', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.mapFeatureSelected({ featureId: 'gone' }),
    );

    const loaded = mapsReducer(
      selected,
      MapsActions.earthquakeOverlayLoaded({ earthquakeOverlay: overlay }),
    );

    expect(loaded.selectedFeatureId).toBeNull();
  });

  it('resolves the selected feature record', () => {
    const state = {
      ...initialMapsState,
      earthquakeOverlay: overlay,
      selectedFeatureId: 'nd-1',
    };

    expect(selectSelectedEarthquakeFeature.projector(state)?.place).toBe(
      'Western North Dakota',
    );
    expect(
      selectSelectedEarthquakeFeature.projector({
        ...state,
        selectedFeatureId: 'nope',
      }),
    ).toBeNull();
  });
});
