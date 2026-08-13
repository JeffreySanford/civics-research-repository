import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  AccessibilityEvidence,
  RepositoryError,
} from 'repository-api-client';

export const EvidenceActions = createActionGroup({
  source: 'Accessibility Evidence',
  events: {
    'Load Requested': emptyProps(),
    'Load Succeeded': props<{ entries: AccessibilityEvidence[] }>(),
    'Load Failed': props<{ error: RepositoryError }>(),
  },
});
