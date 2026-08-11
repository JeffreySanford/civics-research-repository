import { createFeatureSelector, createSelector } from '@ngrx/store';
import { mapsFeatureKey, type MapsState } from './maps.reducer';

export const selectMapsState = createFeatureSelector<MapsState>(mapsFeatureKey);

export const selectMapLayers = createSelector(
  selectMapsState,
  (state) => state.layers,
);

export const selectCensusAreaBoundaries = createSelector(
  selectMapsState,
  (state) => state.censusAreaBoundaries,
);

export const selectSelectedGeography = createSelector(
  selectMapsState,
  (state) => state.selectedGeography,
);

export const selectSelectedCensusAreaBoundary = createSelector(
  selectCensusAreaBoundaries,
  selectSelectedGeography,
  (boundaries, selectedGeography) =>
    boundaries.find((boundary) => boundary.geography === selectedGeography) ??
    null,
);

export const selectEarthquakeOverlay = createSelector(
  selectMapsState,
  (state) => state.earthquakeOverlay,
);

export const selectEarthquakeError = createSelector(
  selectMapsState,
  (state) => state.earthquakeError,
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
