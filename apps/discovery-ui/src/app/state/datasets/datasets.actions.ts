import { createActionGroup, props } from '@ngrx/store';
import type {
  DatasetDetail,
  DatasetVersion,
  MapLayer,
} from 'repository-api-client';

export const DatasetsActions = createActionGroup({
  source: 'Repository Datasets',
  events: {
    'Dataset Opened': props<{ datasetId: string }>(),
    'Dataset Loaded': props<{
      detail: DatasetDetail;
      versions: DatasetVersion[];
      mapLayers: MapLayer[];
    }>(),
    'Dataset Failed': props<{ error: string }>(),
  },
});
