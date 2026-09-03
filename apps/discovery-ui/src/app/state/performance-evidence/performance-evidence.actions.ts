import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  RepositoryError,
  SearchPerformanceEvidence,
} from 'repository-api-client';

export const PerformanceEvidenceActions = createActionGroup({
  source: 'Search Performance Evidence',
  events: {
    'Load Requested': emptyProps(),
    'Load Succeeded': props<{ evidence: SearchPerformanceEvidence }>(),
    'Load Failed': props<{ error: RepositoryError }>(),
  },
});
