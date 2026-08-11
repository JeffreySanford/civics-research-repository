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
  on(MapsActions.earthquakeLayerToggled, (state, { visible }) => ({
    ...state,
    earthquakeVisible: visible,
  })),
);
