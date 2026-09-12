import { createReducer, on } from '@ngrx/store';
import type {
  ResearchObjectDetail,
  ResearchArtifactVersion,
  VersionHistoryStatus,
  MapLayer,
} from 'repository-api-client';
import { DatasetsActions } from './datasets.actions';

export const datasetsFeatureKey = 'datasets';

export interface DatasetsState {
  readonly selectedDatasetId: string | null;
  readonly detail: ResearchObjectDetail | null;
  readonly versions: readonly ResearchArtifactVersion[];
  readonly versionHistoryStatus: VersionHistoryStatus | null;
  readonly mapLayers: readonly MapLayer[];
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialDatasetsState: DatasetsState = {
  selectedDatasetId: null,
  detail: null,
  versions: [],
  versionHistoryStatus: null,
  mapLayers: [],
  loading: false,
  error: null,
};

export const datasetsReducer = createReducer(
  initialDatasetsState,
  on(DatasetsActions.datasetOpened, (state, { datasetId }) => ({
    ...state,
    selectedDatasetId: datasetId,
    detail: null,
    versions: [],
    versionHistoryStatus: null,
    mapLayers: [],
    loading: true,
    error: null,
  })),
  on(DatasetsActions.researchOpened, (state) => ({
    ...state,
    selectedDatasetId: null,
    detail: null,
    versions: [],
    versionHistoryStatus: null,
    mapLayers: [],
    loading: true,
    error: null,
  })),
  on(
    DatasetsActions.datasetLoaded,
    (state, { detail, versions, versionHistoryStatus, mapLayers }) => ({
      ...state,
      detail,
      versions,
      versionHistoryStatus: versionHistoryStatus ?? null,
      mapLayers,
      loading: false,
      error: null,
    }),
  ),
  on(DatasetsActions.datasetFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
);
