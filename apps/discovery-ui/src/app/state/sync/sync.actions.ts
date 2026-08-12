import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { SyncJob, SyncMode, SyncSource } from 'repository-api-client';

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
    'Sync Failed': props<{ error: string }>(),
    'Job Selected': props<{ jobId: string }>(),
  },
});
