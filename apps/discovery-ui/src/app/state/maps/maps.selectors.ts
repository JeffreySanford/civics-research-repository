import { createFeatureSelector, createSelector } from '@ngrx/store';
import { mapsFeatureKey, type MapsState } from './maps.reducer';

export const selectMapsState = createFeatureSelector<MapsState>(mapsFeatureKey);

export const selectMapLayers = createSelector(
  selectMapsState,
  (state) => state.layers,
);

export const selectEarthquakeOverlay = createSelector(
  selectMapsState,
  (state) => state.earthquakeOverlay,
);

export const selectTigerVisible = createSelector(
  selectMapsState,
  (state) => state.tigerVisible,
);

export const selectEarthquakeVisible = createSelector(
  selectMapsState,
  (state) => state.earthquakeVisible,
);

export const selectMapsLoading = createSelector(
  selectMapsState,
  (state) => state.loading,
);

export const selectMapsError = createSelector(
  selectMapsState,
  (state) => state.error,
);
