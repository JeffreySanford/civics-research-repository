import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  DiscoveryProjectionState,
  RepositoryError,
  SyncJob,
  SyncMode,
  SyncSource,
} from 'repository-api-client';

export const SyncActions = createActionGroup({
  source: 'Repository Sync',
  events: {
    'Dry Run Requested': emptyProps(),
    'Diff Requested': emptyProps(),
    'Apply Requested': emptyProps(),
    'History Requested': emptyProps(),
    'History Loaded': props<{ jobs: SyncJob[] }>(),
    'Sync Requested': props<{ mode: SyncMode; source: SyncSource }>(),
    'Sync Succeeded': props<{ job: SyncJob }>(),
    'Sync Failed': props<{ error: RepositoryError }>(),
    'Reindex Requested': emptyProps(),
    'Reindex Succeeded': props<{ projection: DiscoveryProjectionState }>(),
    'Reindex Failed': props<{ error: RepositoryError }>(),
    'Job Selected': props<{ jobId: string }>(),
    'Source Selected': props<{ source: SyncSource }>(),
  },
});
