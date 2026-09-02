import { createReducer, on } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
  LodesWorkplaceOverlay,
  MapLayer,
  SaipeCountyChoropleth,
  UsgsEarthquakeOverlay,
} from 'repository-api-client';
import { MapsActions } from './maps.actions';

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
  readonly tigerVisible: boolean;
  readonly earthquakeVisible: boolean;
  readonly lodesVisible: boolean;
  readonly workplaceVisible: boolean;
  readonly hydrographyVisible: boolean;
  readonly saipeVisible: boolean;
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
  tigerVisible: false,
  earthquakeVisible: false,
  lodesVisible: false,
  workplaceVisible: false,
  hydrographyVisible: false,
  saipeVisible: false,
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
  })),
  on(MapsActions.mapDataLoaded, (state, { censusAreaBoundaries }) => ({
    ...state,
    censusAreaBoundaries,
  })),
  on(MapsActions.mapLayersLoaded, (state, { layers }) => {
    const saipeAvailable = layers.some(
      (layer) => layer.layerType === 'CENSUS_CHOROPLETH',
    );

    return {
      ...state,
      layers,
      loading: false,
      // Capability metadata owns whether SAIPE may exist for this geography. Once a newly loaded
      // area says it does not, stale visibility/data/errors from the previous area must disappear.
      saipeVisible: saipeAvailable ? state.saipeVisible : false,
      saipeChoropleth: saipeAvailable ? state.saipeChoropleth : null,
      saipeChoroplethError: saipeAvailable
        ? state.saipeChoroplethError
        : null,
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
    // Flows are per-geography. Switching from North Dakota to Texas replaces the whole set, and a
    // selection carried across would name a flow the new overlay does not contain.
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
  on(MapsActions.censusAreaSelected, (state, { geography }) => ({
    ...state,
    selectedGeography: geography,
    loading: true,
    error: null,
    // The old choropleth belongs to the old geography. Keep the user's toggle preference until
    // capability metadata lands, but never display stale SAIPE values while the new area loads.
    saipeChoropleth: null,
    saipeChoroplethError: null,
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
    // A selection that survives its layer being hidden leaves the table announcing a highlight
    // nobody can see, and the map holding one it is no longer drawing.
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
  on(MapsActions.saipeLayerToggled, (state, { visible }) => ({
    ...state,
    saipeVisible: visible,
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
