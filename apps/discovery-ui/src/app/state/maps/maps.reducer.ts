import { createReducer, on } from '@ngrx/store';
import type {
  CensusAreaBoundary,
  MapLayer,
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
  readonly tigerVisible: boolean;
  readonly earthquakeVisible: boolean;
  readonly lodesVisible: boolean;
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
  tigerVisible: true,
  earthquakeVisible: true,
  lodesVisible: true,
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
  })),
  // Layers arrive separately, from the selected-area load, so they are not touched here. Neither
  // is `error`: boundaries and layers load independently, and one succeeding is not evidence that
  // the other did. Errors are cleared when a new attempt starts, not when a neighbour succeeds.
  on(MapsActions.mapDataLoaded, (state, { censusAreaBoundaries }) => ({
    ...state,
    censusAreaBoundaries,
  })),
  // Layers are reloaded when the selected area changes, so only the layer list is replaced.
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
  // Hiding the layer clears the selection: a selected feature that is no longer rendered would
  // leave the list and the map disagreeing about what is selected.
  on(MapsActions.earthquakeLayerToggled, (state, { visible }) => ({
    ...state,
    earthquakeVisible: visible,
    selectedFeatureId: visible ? state.selectedFeatureId : null,
  })),
  on(MapsActions.lodesLayerToggled, (state, { visible }) => ({
    ...state,
    lodesVisible: visible,
  })),
  on(MapsActions.mapFeatureSelected, (state, { featureId }) => ({
    ...state,
    selectedFeatureId: featureId,
  })),
  on(MapsActions.mapFeatureSelectionCleared, (state) => ({
    ...state,
    selectedFeatureId: null,
  })),
  // A new overlay may not contain the previously selected feature.
  on(MapsActions.earthquakeOverlayLoaded, (state, { earthquakeOverlay }) => ({
    ...state,
    selectedFeatureId: earthquakeOverlay.features.some(
      (feature) => feature.id === state.selectedFeatureId,
    )
      ? state.selectedFeatureId
      : null,
  })),
);
