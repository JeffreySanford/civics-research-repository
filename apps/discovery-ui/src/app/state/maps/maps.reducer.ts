import { createReducer, on } from '@ngrx/store';
import type { MapLayer, UsgsEarthquakeOverlay } from 'repository-api-client';
import { MapsActions } from './maps.actions';

export const mapsFeatureKey = 'maps';

export interface MapsState {
  readonly layers: readonly MapLayer[];
  readonly earthquakeOverlay: UsgsEarthquakeOverlay | null;
  readonly tigerVisible: boolean;
  readonly earthquakeVisible: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialMapsState: MapsState = {
  layers: [],
  earthquakeOverlay: null,
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
  })),
  on(MapsActions.mapDataLoaded, (state, { layers, earthquakeOverlay }) => ({
    ...state,
    layers,
    earthquakeOverlay,
    loading: false,
    error: null,
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
