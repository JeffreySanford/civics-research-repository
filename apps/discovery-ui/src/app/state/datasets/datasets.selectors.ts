import { createFeatureSelector, createSelector } from '@ngrx/store';
import { datasetsFeatureKey, type DatasetsState } from './datasets.reducer';

export const selectDatasetsState =
  createFeatureSelector<DatasetsState>(datasetsFeatureKey);

export const selectDatasetDetail = createSelector(
  selectDatasetsState,
  (state) => state.detail,
);

export const selectDatasetVersions = createSelector(
  selectDatasetsState,
  (state) => state.versions,
);

export const selectDatasetMapLayers = createSelector(
  selectDatasetsState,
  (state) => state.mapLayers,
);

export const selectDatasetLoading = createSelector(
  selectDatasetsState,
  (state) => state.loading,
);

export const selectDatasetError = createSelector(
  selectDatasetsState,
  (state) => state.error,
);
