import { createActionGroup, props } from '@ngrx/store';
import type { ResearchObjectDetail } from 'repository-api-client';

export const MobileResearchDetailActions = createActionGroup({
  source: 'Mobile Research Detail',
  events: {
    'Detail Opened': props<{ researchId: string }>(),
    'Detail Loaded': props<{ detail: ResearchObjectDetail }>(),
    'Detail Failed': props<{ message: string }>(),
  },
});
