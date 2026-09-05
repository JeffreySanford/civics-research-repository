import type { MapLayer, UsgsEarthquakeOverlay } from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { initialMapsState, mapsReducer } from './maps.reducer';
import {
  selectEarthquakeError,
  selectEarthquakeOverlay,
  selectSelectedEarthquakeFeature,
} from './maps.selectors';

describe('mapsReducer', () => {
  it('defaults every map layer toggle to hidden', () => {
    expect(initialMapsState.tigerVisible).toBe(false);
    expect(initialMapsState.lodesVisible).toBe(false);
    expect(initialMapsState.saipeVisible).toBe(false);
    expect(initialMapsState.hydrographyVisible).toBe(false);
    expect(initialMapsState.earthquakeVisible).toBe(false);
  });

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
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'USGS overlay service unavailable.',
        },
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
    expect(loaded.layers.map((loadedLayer) => loadedLayer.id)).toEqual([
      'tiger-line-california-boundary',
    ]);
    expect(loaded.censusAreaBoundaries).toEqual(
      initialMapsState.censusAreaBoundaries,
    );
  });

  it('clears SAIPE state when the selected area does not advertise SAIPE', () => {
    const withSaipe = {
      ...initialMapsState,
      saipeVisible: true,
      saipeChoropleth: { geography: 'North Dakota' } as never,
      saipeChoroplethError: 'Old SAIPE warning',
    };

    const loaded = mapsReducer(
      withSaipe,
      MapsActions.mapLayersLoaded({ layers: [layer] }),
    );

    expect(loaded.saipeVisible).toBe(false);
    expect(loaded.saipeChoropleth).toBeNull();
    expect(loaded.saipeChoroplethError).toBeNull();
  });

  it('clears old SAIPE data immediately while a new geography capability loads', () => {
    const selected = mapsReducer(
      {
        ...initialMapsState,
        saipeVisible: true,
        saipeChoropleth: { geography: 'North Dakota' } as never,
        saipeChoroplethError: 'Old SAIPE warning',
      },
      MapsActions.censusAreaSelected({ geography: 'Florida' }),
    );

    expect(selected.selectedGeography).toBe('Florida');
    expect(selected.saipeVisible).toBe(true);
    expect(selected.saipeChoropleth).toBeNull();
    expect(selected.saipeChoroplethError).toBeNull();
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

/**
 * Flow selection lives in one place and both views read it, so the invariants that matter are
 * about what happens to a selection when the thing it names goes away.
 */
describe('lodes flow selection', () => {
  const overlay = (flowIds: readonly string[]) =>
    ({
      source: 'LODES',
      sourceUrl: 'https://lehd.ces.census.gov/data/',
      attribution: 'U.S. Census Bureau LEHD',
      geography: 'North Dakota',
      vintage: 2023,
      fallback: false,
      geoJson: {},
      flows: flowIds.map((id) => ({
        id,
        originLabel: `${id} origin`,
        destinationLabel: `${id} destination`,
        workerCount: 100,
        originCounty: 'Burleigh',
        destinationCounty: 'Cass',
      })),
    }) as never;

  const withFlows = (flowIds: readonly string[]) =>
    mapsReducer(
      { ...initialMapsState, lodesVisible: true },
      MapsActions.lodesFlowOverlayLoaded({
        lodesFlowOverlay: overlay(flowIds),
      }),
    );

  it('records a selection made from either view', () => {
    const state = mapsReducer(
      withFlows(['nd-1', 'nd-2']),
      MapsActions.lodesFlowSelected({ flowId: 'nd-1' }),
    );

    expect(state.selectedLodesFlowId).toBe('nd-1');
  });

  it('clears the selection explicitly', () => {
    const selected = mapsReducer(
      withFlows(['nd-1']),
      MapsActions.lodesFlowSelected({ flowId: 'nd-1' }),
    );

    const cleared = mapsReducer(
      selected,
      MapsActions.lodesFlowSelectionCleared(),
    );

    expect(cleared.selectedLodesFlowId).toBeNull();
  });

  /** A selection outliving its layer leaves the table announcing a highlight nobody can see. */
  it('drops the selection when the LODES layer is hidden', () => {
    const selected = mapsReducer(
      withFlows(['nd-1']),
      MapsActions.lodesFlowSelected({ flowId: 'nd-1' }),
    );

    const hidden = mapsReducer(
      selected,
      MapsActions.lodesLayerToggled({ visible: false }),
    );

    expect(hidden.selectedLodesFlowId).toBeNull();
  });

  /** Flows are per-geography: switching states replaces the whole set. */
  it('drops a selection the newly loaded overlay does not contain', () => {
    const selected = mapsReducer(
      withFlows(['nd-1']),
      MapsActions.lodesFlowSelected({ flowId: 'nd-1' }),
    );

    const reloaded = mapsReducer(
      selected,
      MapsActions.lodesFlowOverlayLoaded({
        lodesFlowOverlay: overlay(['tx-1', 'tx-2']),
      }),
    );

    expect(reloaded.selectedLodesFlowId).toBeNull();
  });

  it('keeps a selection the newly loaded overlay still contains', () => {
    const selected = mapsReducer(
      withFlows(['nd-1', 'nd-2']),
      MapsActions.lodesFlowSelected({ flowId: 'nd-2' }),
    );

    const reloaded = mapsReducer(
      selected,
      MapsActions.lodesFlowOverlayLoaded({
        lodesFlowOverlay: overlay(['nd-1', 'nd-2']),
      }),
    );

    expect(reloaded.selectedLodesFlowId).toBe('nd-2');
  });
});

describe('research coverage selection', () => {
  const feature = (sourceIdentifier: string) => ({
    sourceSystem: 'DATA_GOV',
    sourceIdentifier,
    title: `${sourceIdentifier} title`,
    publisher: 'Example Federal Agency',
    program: 'Climate',
    contentType: 'DATASET',
    sourceUrl: `https://catalog.data.gov/dataset/${sourceIdentifier}`,
    geometryStatus: 'VALID',
    geometry: {
      type: 'Polygon',
      coordinates: [],
    },
    renderLon: -100,
    renderLat: 40,
    renderPointMethod: 'SHAPE_BOUNDS_CENTER',
  });

  const response = (ids: readonly string[]) =>
    ({
      features: ids.map(feature),
    }) as never;

  it('records a selected Data.gov research extent', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.researchCoverageFeatureSelected({
        sourceIdentifier: 'climate-study',
      }),
    );

    expect(state.selectedResearchCoverageId).toBe('climate-study');
  });

  it('clears the research extent selection explicitly', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.researchCoverageFeatureSelected({
        sourceIdentifier: 'climate-study',
      }),
    );

    const cleared = mapsReducer(
      selected,
      MapsActions.researchCoverageSelectionCleared(),
    );

    expect(cleared.selectedResearchCoverageId).toBeNull();
  });

  it('clears the research selection when the layer is hidden', () => {
    const selected = mapsReducer(
      {
        ...initialMapsState,
        researchCoverageVisible: true,
      },
      MapsActions.researchCoverageFeatureSelected({
        sourceIdentifier: 'climate-study',
      }),
    );

    const hidden = mapsReducer(
      selected,
      MapsActions.researchCoverageLayerToggled({ visible: false }),
    );

    expect(hidden.selectedResearchCoverageId).toBeNull();
  });

  it('keeps a selection that remains in the bounded response', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.researchCoverageFeatureSelected({
        sourceIdentifier: 'climate-study',
      }),
    );

    const loaded = mapsReducer(
      selected,
      MapsActions.researchCoverageLoaded({
        response: response(['climate-study', 'water-study']),
      }),
    );

    expect(loaded.selectedResearchCoverageId).toBe('climate-study');
  });

  it('drops a selection that disappears from the bounded response', () => {
    const selected = mapsReducer(
      initialMapsState,
      MapsActions.researchCoverageFeatureSelected({
        sourceIdentifier: 'climate-study',
      }),
    );

    const loaded = mapsReducer(
      selected,
      MapsActions.researchCoverageLoaded({
        response: response(['water-study']),
      }),
    );

    expect(loaded.selectedResearchCoverageId).toBeNull();
  });
});

describe('population estimates state', () => {
  const populationLayer = {
    id: 'population-estimates-county-north-dakota',
    label: 'Vintage 2025 county Population Estimates - North Dakota',
    layerType: 'CENSUS_CHOROPLETH',
    sourceUrl: 'https://example.test/population.csv',
    attribution: 'U.S. Census Bureau Population Estimates Program',
    visibleByDefault: false,
  } as unknown as MapLayer;

  it('defaults to latest annual growth while leaving the layer hidden', () => {
    expect(initialMapsState.populationVisible).toBe(false);
    expect(initialMapsState.populationEstimateMeasure).toBe(
      'ANNUAL_GROWTH_RATE',
    );
    expect(initialMapsState.populationEstimateYear).toBe(2025);
    expect(initialMapsState.populationEstimatesLoading).toBe(false);
  });

  it('tracks measure and year as explicit configuration', () => {
    const state = mapsReducer(
      initialMapsState,
      MapsActions.populationEstimatesConfigurationChanged({
        measure: 'POPULATION',
        year: 2024,
      }),
    );

    expect(state.populationEstimateMeasure).toBe('POPULATION');
    expect(state.populationEstimateYear).toBe(2024);
  });

  it('tracks request, success, and failure independently', () => {
    const requested = mapsReducer(
      initialMapsState,
      MapsActions.populationEstimatesRequested(),
    );

    expect(requested.populationEstimatesLoading).toBe(true);

    const choropleth = {
      geography: 'North Dakota',
      measure: 'ANNUAL_GROWTH_RATE',
      year: 2025,
    } as never;

    const loaded = mapsReducer(
      requested,
      MapsActions.populationEstimatesLoaded({
        populationEstimatesChoropleth: choropleth,
      }),
    );

    expect(loaded.populationEstimatesLoading).toBe(false);
    expect(loaded.populationEstimatesChoropleth).toBe(choropleth);

    const failed = mapsReducer(
      loaded,
      MapsActions.populationEstimatesFailed({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Population service unavailable.',
        },
      }),
    );

    expect(failed.populationEstimatesChoropleth).toBeNull();
    expect(failed.populationEstimatesLoading).toBe(false);
    expect(failed.populationEstimatesError).toBe(
      'Population service unavailable.',
    );
  });

  it('keeps SAIPE and Population Estimates capability independent', () => {
    const loaded = mapsReducer(
      {
        ...initialMapsState,
        saipeVisible: true,
        populationVisible: true,
      },
      MapsActions.mapLayersLoaded({
        layers: [populationLayer],
      }),
    );

    expect(loaded.saipeVisible).toBe(false);
    expect(loaded.populationVisible).toBe(true);
  });

  it('clears population data when the new area lacks the capability', () => {
    const loaded = mapsReducer(
      {
        ...initialMapsState,
        populationVisible: true,
        populationEstimatesChoropleth: {
          geography: 'North Dakota',
        } as never,
      },
      MapsActions.mapLayersLoaded({
        layers: [],
      }),
    );

    expect(loaded.populationVisible).toBe(false);
    expect(loaded.populationEstimatesChoropleth).toBeNull();
  });
});
