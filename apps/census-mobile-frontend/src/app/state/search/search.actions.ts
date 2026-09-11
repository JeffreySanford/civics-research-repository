import { createActionGroup, props } from '@ngrx/store';
import type {
  RepositoryError,
  SearchQuery,
  SearchResponse,
} from 'repository-api-client';

export const SearchActions = createActionGroup({
  source: 'Mobile Repository Search',
  events: {
    'Search Submitted': props<{ query: SearchQuery }>(),
    'Search Page Requested': props<{ page: number }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Search Failed': props<{ error: RepositoryError }>(),
  },
});
