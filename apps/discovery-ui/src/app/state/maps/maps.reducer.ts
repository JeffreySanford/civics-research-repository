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
  on(MapsActions.mapDataLoaded, (state, { layers, censusAreaBoundaries }) => ({
    ...state,
    layers,
    censusAreaBoundaries,
    loading: false,
    error: null,
  })),
  on(MapsActions.earthquakeOverlayLoaded, (state, { earthquakeOverlay }) => ({
    ...state,
    earthquakeOverlay,
    earthquakeError: null,
  })),
  on(MapsActions.earthquakeOverlayFailed, (state, { error }) => ({
    ...state,
    earthquakeOverlay: null,
    earthquakeError: error,
  })),
  on(MapsActions.censusAreaSelected, (state, { geography }) => ({
    ...state,
    selectedGeography: geography,
  })),
  on(MapsActions.mapDataFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
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
