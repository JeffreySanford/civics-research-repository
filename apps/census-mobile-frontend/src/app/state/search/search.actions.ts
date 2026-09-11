import { createActionGroup, props } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';

export const MobileSearchActions = createActionGroup({
  source: 'Mobile Repository Search',
  events: {
    'Search Submitted': props<{ query: SearchQuery }>(),
    'Page Requested': props<{ page: number }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Search Failed': props<{ message: string }>(),
  },
});
