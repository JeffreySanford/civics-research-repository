import { createActionGroup, props } from '@ngrx/store';
import type {
  ResearchObjectDetail,
  ResearchArtifactVersion,
  VersionHistoryStatus,
  MapLayer,
  RepositoryError,
} from 'repository-api-client';

export const DatasetsActions = createActionGroup({
  source: 'Repository Datasets',
  events: {
    'Dataset Opened': props<{ datasetId: string }>(),
    'Research Opened': props<{ researchId: string }>(),
    'Dataset Loaded': props<{
      detail: ResearchObjectDetail;
      versions: ResearchArtifactVersion[];
      versionHistoryStatus?: VersionHistoryStatus;
      mapLayers: MapLayer[];
    }>(),
    'Dataset Failed': props<{ error: RepositoryError }>(),
  },
});
