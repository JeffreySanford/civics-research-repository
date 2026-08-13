import { createReducer, on } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  LodesFlowOverlay,
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
  readonly saipeChoropleth: SaipeCountyChoropleth | null;
  readonly saipeChoroplethError: string | null;
  readonly tigerVisible: boolean;
  readonly earthquakeVisible: boolean;
  readonly lodesVisible: boolean;
  readonly hydrographyVisible: boolean;
  readonly saipeVisible: boolean;
  /** Feature shared by the map and the accessible list; either view can set it. */
  readonly selectedFeatureId: string | null;
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
  saipeChoropleth: null,
  saipeChoroplethError: null,
  tigerVisible: true,
  earthquakeVisible: true,
  lodesVisible: true,
  hydrographyVisible: false,
  saipeVisible: true,
  selectedFeatureId: null,
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
  on(MapsActions.mapLayersLoaded, (state, { layers }) => ({
    ...state,
    layers,
    loading: false,
  })),
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
  on(MapsActions.lodesFlowOverlayLoaded, (state, { lodesFlowOverlay }) => ({
    ...state,
    lodesFlowOverlay,
    lodesFlowError: null,
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
