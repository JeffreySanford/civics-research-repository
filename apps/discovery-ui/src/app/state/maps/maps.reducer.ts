import { createReducer, on } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  CountyBusinessPatternsChoropleth,
  CountyBusinessPatternsIndustry,
  CountyBusinessPatternsMeasure,
  LodesFlowOverlay,
  LodesWorkplaceOverlay,
  MapLayer,
  PopulationEstimateMeasure,
  PopulationEstimatesChoropleth,
  ResearchSpatialCoverageResponse,
  ResearchSpatialViewport,
  SaipeCountyChoropleth,
  SearchQuery,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { MapsActions } from './maps.actions';
import { DEFAULT_USGS_TERRAIN_MODE, type UsgsTerrainMode } from './terrain';

export const mapsFeatureKey = 'maps';

export interface MapsState {
  readonly layers: readonly MapLayer[];
  readonly censusAreaBoundaries: readonly CensusAreaBoundary[];
  readonly selectedGeography: string;
  readonly earthquakeOverlay: UsgsEarthquakeOverlay | null;
  readonly earthquakeError: string | null;
  readonly lodesFlowOverlay: LodesFlowOverlay | null;
  readonly lodesFlowError: string | null;
  readonly lodesWorkplaceOverlay: LodesWorkplaceOverlay | null;
  readonly lodesWorkplaceError: string | null;
  readonly saipeChoropleth: SaipeCountyChoropleth | null;
  readonly saipeChoroplethError: string | null;
  readonly populationEstimatesChoropleth: PopulationEstimatesChoropleth | null;
  readonly populationEstimatesError: string | null;
  readonly populationEstimatesLoading: boolean;
  readonly populationEstimateMeasure: PopulationEstimateMeasure;
  readonly populationEstimateYear: number;
  readonly countyBusinessPatternsChoropleth: CountyBusinessPatternsChoropleth | null;
  readonly countyBusinessPatternsError: string | null;
  readonly countyBusinessPatternsLoading: boolean;
  readonly countyBusinessPatternsMeasure: CountyBusinessPatternsMeasure;
  readonly countyBusinessPatternsIndustry: CountyBusinessPatternsIndustry;
  readonly countyBusinessPatternsYear: number;
  readonly researchCoverageQuery: SearchQuery | null;
  readonly researchCoverageViewport: ResearchSpatialViewport | null;
  readonly researchCoverageResponse: ResearchSpatialCoverageResponse | null;
  readonly researchCoverageLoading: boolean;
  readonly researchCoverageError: string | null;
  readonly tigerVisible: boolean;
  readonly earthquakeVisible: boolean;
  readonly lodesVisible: boolean;
  readonly workplaceVisible: boolean;
  readonly hydrographyVisible: boolean;
  readonly terrainVisible: boolean;
  readonly terrainMode: UsgsTerrainMode;
  readonly saipeVisible: boolean;
  readonly populationVisible: boolean;
  readonly countyBusinessPatternsVisible: boolean;
  readonly researchCoverageVisible: boolean;
  readonly selectedResearchCoverageId: string | null;
  /** Feature shared by the map and the accessible list; either view can set it. */
  readonly selectedFeatureId: string | null;
  /** Commuting flow shared by the map and the accessible table; either view can set it. */
  readonly selectedLodesFlowId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialMapsState: MapsState = {
  layers: [],
  censusAreaBoundaries: [],
  selectedGeography: 'North Dakota',
  earthquakeOverlay: null,
  earthquakeError: null,
  lodesFlowOverlay: null,
  lodesFlowError: null,
  lodesWorkplaceOverlay: null,
  lodesWorkplaceError: null,
  saipeChoropleth: null,
  saipeChoroplethError: null,
  populationEstimatesChoropleth: null,
  populationEstimatesError: null,
  populationEstimatesLoading: false,
  populationEstimateMeasure: 'ANNUAL_GROWTH_RATE',
  populationEstimateYear: 2025,
  countyBusinessPatternsChoropleth: null,
  countyBusinessPatternsError: null,
  countyBusinessPatternsLoading: false,
  countyBusinessPatternsMeasure: 'ESTABLISHMENTS',
  countyBusinessPatternsIndustry: 'TOTAL',
  countyBusinessPatternsYear: 2023,
  researchCoverageQuery: null,
  researchCoverageViewport: null,
  researchCoverageResponse: null,
  researchCoverageLoading: false,
  researchCoverageError: null,
  tigerVisible: false,
  earthquakeVisible: false,
  lodesVisible: false,
  workplaceVisible: false,
  hydrographyVisible: false,
  terrainVisible: false,
  terrainMode: DEFAULT_USGS_TERRAIN_MODE,
  saipeVisible: false,
  populationVisible: false,
  countyBusinessPatternsVisible: false,
  researchCoverageVisible: false,
  selectedResearchCoverageId: null,
  selectedFeatureId: null,
  selectedLodesFlowId: null,
  loading: false,
  error: null,
};

export const mapsReducer = createReducer(
  initialMapsState,
  on(MapsActions.mapOpened, (state) => ({
    ...state,
    loading: true,
    error: null,
    earthquakeError: null,
    lodesFlowError: null,
    saipeChoroplethError: null,
    populationEstimatesError: null,
    countyBusinessPatternsError: null,
    researchCoverageError: null,
  })),
  on(MapsActions.mapDataLoaded, (state, { censusAreaBoundaries }) => ({
    ...state,
    censusAreaBoundaries,
  })),
  on(MapsActions.mapLayersLoaded, (state, { layers }) => {
    const saipeAvailable = layers.some((layer) =>
      layer.id.startsWith('saipe-county-poverty-'),
    );
    const populationAvailable = layers.some((layer) =>
      layer.id.startsWith('population-estimates-county-'),
    );
    const countyBusinessPatternsAvailable = layers.some((layer) =>
      layer.id.startsWith('county-business-patterns-'),
    );
    const terrainAvailable = layers.some(
      (layer) => layer.id === 'usgs-3dep-terrain',
    );

    return {
      ...state,
      layers,
      loading: false,
      saipeVisible: saipeAvailable ? state.saipeVisible : false,
      saipeChoropleth: saipeAvailable ? state.saipeChoropleth : null,
      saipeChoroplethError: saipeAvailable ? state.saipeChoroplethError : null,
      populationVisible: populationAvailable ? state.populationVisible : false,
      populationEstimatesChoropleth: populationAvailable
        ? state.populationEstimatesChoropleth
        : null,
      populationEstimatesError: populationAvailable
        ? state.populationEstimatesError
        : null,
      populationEstimatesLoading: populationAvailable
        ? state.populationEstimatesLoading
        : false,
      countyBusinessPatternsVisible: countyBusinessPatternsAvailable
        ? state.countyBusinessPatternsVisible
        : false,
      countyBusinessPatternsChoropleth: countyBusinessPatternsAvailable
        ? state.countyBusinessPatternsChoropleth
        : null,
      countyBusinessPatternsError: countyBusinessPatternsAvailable
        ? state.countyBusinessPatternsError
        : null,
      countyBusinessPatternsLoading: countyBusinessPatternsAvailable
        ? state.countyBusinessPatternsLoading
        : false,
      terrainVisible: terrainAvailable ? state.terrainVisible : false,
    };
  }),
  on(MapsActions.earthquakeOverlayLoaded, (state, { earthquakeOverlay }) => ({
    ...state,
    earthquakeOverlay,
    earthquakeError: null,
  })),
  on(MapsActions.earthquakeOverlayFailed, (state, { error }) => ({
    ...state,
    earthquakeOverlay: null,
    earthquakeError: error.message,
  })),
  on(
    MapsActions.lodesWorkplaceOverlayLoaded,
    (state, { lodesWorkplaceOverlay }) => ({
      ...state,
      lodesWorkplaceOverlay,
      lodesWorkplaceError: null,
    }),
  ),
  on(MapsActions.lodesWorkplaceOverlayFailed, (state, { error }) => ({
    ...state,
    lodesWorkplaceOverlay: null,
    lodesWorkplaceError: error.message,
  })),
  on(MapsActions.workplaceLayerToggled, (state, { visible }) => ({
    ...state,
    workplaceVisible: visible,
  })),
  on(MapsActions.lodesFlowOverlayLoaded, (state, { lodesFlowOverlay }) => ({
    ...state,
    lodesFlowOverlay,
    lodesFlowError: null,
    selectedLodesFlowId: lodesFlowOverlay.flows.some(
      (flow) => flow.id === state.selectedLodesFlowId,
    )
      ? state.selectedLodesFlowId
      : null,
  })),
  on(MapsActions.lodesFlowOverlayFailed, (state, { error }) => ({
    ...state,
    lodesFlowOverlay: null,
    lodesFlowError: error.message,
  })),
  on(MapsActions.saipeChoroplethLoaded, (state, { saipeChoropleth }) => ({
    ...state,
    saipeChoropleth,
    saipeChoroplethError: null,
  })),
  on(MapsActions.saipeChoroplethFailed, (state, { error }) => ({
    ...state,
    saipeChoropleth: null,
    saipeChoroplethError: error.message,
  })),
  on(
    MapsActions.populationEstimatesConfigurationChanged,
    (state, { measure, year }) => ({
      ...state,
      populationEstimateMeasure: measure,
      populationEstimateYear: year,
      populationEstimatesChoropleth: null,
      populationEstimatesError: null,
    }),
  ),
  on(MapsActions.populationEstimatesRequested, (state) => ({
    ...state,
    populationEstimatesLoading: true,
    populationEstimatesError: null,
  })),
  on(
    MapsActions.populationEstimatesLoaded,
    (state, { populationEstimatesChoropleth }) => ({
      ...state,
      populationEstimatesChoropleth,
      populationEstimatesLoading: false,
      populationEstimatesError: null,
    }),
  ),
  on(MapsActions.populationEstimatesFailed, (state, { error }) => ({
    ...state,
    populationEstimatesChoropleth: null,
    populationEstimatesLoading: false,
    populationEstimatesError: error.message,
  })),
  on(
    MapsActions.countyBusinessPatternsConfigurationChanged,
    (state, { measure, industry, year }) => ({
      ...state,
      countyBusinessPatternsMeasure: measure,
      countyBusinessPatternsIndustry: industry,
      countyBusinessPatternsYear: year,
      countyBusinessPatternsChoropleth: null,
      countyBusinessPatternsError: null,
    }),
  ),
  on(MapsActions.countyBusinessPatternsRequested, (state) => ({
    ...state,
    countyBusinessPatternsLoading: true,
    countyBusinessPatternsError: null,
  })),
  on(
    MapsActions.countyBusinessPatternsLoaded,
    (state, { countyBusinessPatternsChoropleth }) => ({
      ...state,
      countyBusinessPatternsChoropleth,
      countyBusinessPatternsLoading: false,
      countyBusinessPatternsError: null,
    }),
  ),
  on(MapsActions.countyBusinessPatternsFailed, (state, { error }) => ({
    ...state,
    countyBusinessPatternsChoropleth: null,
    countyBusinessPatternsLoading: false,
    countyBusinessPatternsError: error.message,
  })),
  on(MapsActions.researchCoverageRequested, (state, { query, viewport }) => ({
    ...state,
    researchCoverageQuery: query,
    researchCoverageViewport: viewport,
    researchCoverageLoading: true,
    researchCoverageResponse: null,
    researchCoverageError: null,
  })),
  on(MapsActions.researchCoverageLoaded, (state, { response }) => ({
    ...state,
    researchCoverageResponse: response,
    researchCoverageLoading: false,
    researchCoverageError: null,
    selectedResearchCoverageId: response.features.some(
      (feature) =>
        feature.sourceIdentifier === state.selectedResearchCoverageId,
    )
      ? state.selectedResearchCoverageId
      : null,
  })),
  on(MapsActions.researchCoverageFailed, (state, { error }) => ({
    ...state,
    researchCoverageResponse: null,
    researchCoverageLoading: false,
    researchCoverageError: error.message,
  })),
  on(MapsActions.censusAreaSelected, (state, { geography }) => ({
    ...state,
    selectedGeography: geography,
    loading: true,
    error: null,
    saipeChoropleth: null,
    saipeChoroplethError: null,
    populationEstimatesChoropleth: null,
    populationEstimatesError: null,
    populationEstimatesLoading: false,
    countyBusinessPatternsChoropleth: null,
    countyBusinessPatternsError: null,
    countyBusinessPatternsLoading: false,
  })),
  on(MapsActions.mapDataFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
  on(MapsActions.tigerLayerToggled, (state, { visible }) => ({
    ...state,
    tigerVisible: visible,
  })),
  on(MapsActions.earthquakeLayerToggled, (state, { visible }) => ({
    ...state,
    earthquakeVisible: visible,
    selectedFeatureId: visible ? state.selectedFeatureId : null,
  })),
  on(MapsActions.lodesLayerToggled, (state, { visible }) => ({
    ...state,
    lodesVisible: visible,
    selectedLodesFlowId: visible ? state.selectedLodesFlowId : null,
  })),
  on(MapsActions.lodesFlowSelected, (state, { flowId }) => ({
    ...state,
    selectedLodesFlowId: flowId,
  })),
  on(MapsActions.lodesFlowSelectionCleared, (state) => ({
    ...state,
    selectedLodesFlowId: null,
  })),
  on(MapsActions.hydrographyLayerToggled, (state, { visible }) => ({
    ...state,
    hydrographyVisible: visible,
  })),
  on(MapsActions.terrainLayerToggled, (state, { visible }) => ({
    ...state,
    terrainVisible: visible,
  })),
  on(MapsActions.terrainModeChanged, (state, { mode }) => ({
    ...state,
    terrainMode: mode,
  })),
  on(MapsActions.saipeLayerToggled, (state, { visible }) => ({
    ...state,
    saipeVisible: visible,
  })),
  on(MapsActions.populationLayerToggled, (state, { visible }) => ({
    ...state,
    populationVisible: visible,
  })),
  on(MapsActions.countyBusinessPatternsLayerToggled, (state, { visible }) => ({
    ...state,
    countyBusinessPatternsVisible: visible,
  })),
  on(MapsActions.researchCoverageLayerToggled, (state, { visible }) => ({
    ...state,
    researchCoverageVisible: visible,
    selectedResearchCoverageId: visible
      ? state.selectedResearchCoverageId
      : null,
  })),
  on(
    MapsActions.researchCoverageFeatureSelected,
    (state, { sourceIdentifier }) => ({
      ...state,
      selectedResearchCoverageId: sourceIdentifier,
    }),
  ),
  on(MapsActions.researchCoverageSelectionCleared, (state) => ({
    ...state,
    selectedResearchCoverageId: null,
  })),
  on(MapsActions.mapFeatureSelected, (state, { featureId }) => ({
    ...state,
    selectedFeatureId: featureId,
  })),
  on(MapsActions.mapFeatureSelectionCleared, (state) => ({
    ...state,
    selectedFeatureId: null,
  })),
  on(MapsActions.earthquakeOverlayLoaded, (state, { earthquakeOverlay }) => ({
    ...state,
    selectedFeatureId: earthquakeOverlay.features.some(
      (feature) => feature.id === state.selectedFeatureId,
    )
      ? state.selectedFeatureId
      : null,
  })),
);
