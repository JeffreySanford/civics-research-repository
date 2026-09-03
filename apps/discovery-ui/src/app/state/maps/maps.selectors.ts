import { createFeatureSelector, createSelector } from '@ngrx/store';
import { mapsFeatureKey, type MapsState } from './maps.reducer';
import { buildResearchCoverageSummary } from './research-coverage';

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

export const selectLodesFlowOverlay = createSelector(
  selectMapsState,
  (state) => state.lodesFlowOverlay,
);

export const selectLodesFlowError = createSelector(
  selectMapsState,
  (state) => state.lodesFlowError,
);

export const selectSaipeChoropleth = createSelector(
  selectMapsState,
  (state) => state.saipeChoropleth,
);

export const selectSaipeChoroplethError = createSelector(
  selectMapsState,
  (state) => state.saipeChoroplethError,
);

export const selectResearchCoverageQuery = createSelector(
  selectMapsState,
  (state) => state.researchCoverageQuery,
);

export const selectResearchCoverageViewport = createSelector(
  selectMapsState,
  (state) => state.researchCoverageViewport,
);

export const selectResearchCoverageResponse = createSelector(
  selectMapsState,
  (state) => state.researchCoverageResponse,
);

export const selectResearchCoverageLoading = createSelector(
  selectMapsState,
  (state) => state.researchCoverageLoading,
);

export const selectResearchCoverageError = createSelector(
  selectMapsState,
  (state) => state.researchCoverageError,
);

export const selectResearchCoverageSummary = createSelector(
  selectResearchCoverageResponse,
  selectResearchCoverageQuery,
  (response, query) =>
    response && query ? buildResearchCoverageSummary(response, query) : null,
);

export const selectTigerVisible = createSelector(
  selectMapsState,
  (state) => state.tigerVisible,
);

export const selectEarthquakeVisible = createSelector(
  selectMapsState,
  (state) => state.earthquakeVisible,
);

export const selectLodesVisible = createSelector(
  selectMapsState,
  (state) => state.lodesVisible,
);

export const selectHydrographyVisible = createSelector(
  selectMapsState,
  (state) => state.hydrographyVisible,
);

export const selectSaipeVisible = createSelector(
  selectMapsState,
  (state) => state.saipeVisible,
);

export const selectResearchCoverageVisible = createSelector(
  selectMapsState,
  (state) => state.researchCoverageVisible,
);

export const selectHydrographyLayer = createSelector(
  selectMapLayers,
  (layers) => layers.find((layer) => layer.layerType === 'USGS_REFERENCE'),
);

export const selectMapsLoading = createSelector(
  selectMapsState,
  (state) => state.loading,
);

export const selectMapsError = createSelector(
  selectMapsState,
  (state) => state.error,
);

/** The feature currently shared by the map and the accessible list. */
export const selectSelectedFeatureId = createSelector(
  selectMapsState,
  (state) => state.selectedFeatureId,
);

export const selectSelectedEarthquakeFeature = createSelector(
  selectMapsState,
  (state) =>
    state.earthquakeOverlay?.features.find(
      (feature) => feature.id === state.selectedFeatureId,
    ) ?? null,
);

export const selectSelectedLodesFlowId = createSelector(
  selectMapsState,
  (state) => state.selectedLodesFlowId,
);

export const selectSelectedLodesFlow = createSelector(
  selectMapsState,
  (state) =>
    state.lodesFlowOverlay?.flows.find(
      (flow) => flow.id === state.selectedLodesFlowId,
    ) ?? null,
);

export const selectLodesWorkplaceOverlay = createSelector(
  selectMapsState,
  (state) => state.lodesWorkplaceOverlay,
);

export const selectLodesWorkplaceError = createSelector(
  selectMapsState,
  (state) => state.lodesWorkplaceError,
);

export const selectWorkplaceVisible = createSelector(
  selectMapsState,
  (state) => state.workplaceVisible,
);
