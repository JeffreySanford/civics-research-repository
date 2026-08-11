import { createActionGroup, props } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';

export const SearchActions = createActionGroup({
  source: 'Repository Search',
  events: {
    'Search Submitted': props<{ query: SearchQuery }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Search Failed': props<{ error: string }>(),
  },
});
