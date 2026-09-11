import { createActionGroup, props } from '@ngrx/store';
import type {
  SearchCursorPage,
  SearchQuery,
  SearchResponse,
} from 'repository-api-client';

export const MobileSearchActions = createActionGroup({
  source: 'Mobile Repository Search',
  events: {
    'Search Submitted': props<{ query: SearchQuery }>(),
    'Page Requested': props<{ page: number }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Cursor Search Loaded': props<{
      cursorPage: SearchCursorPage;
      cursorUsed: string | null;
    }>(),
    'Cursor Compatibility Loaded': props<{
      response: SearchResponse;
      notice: string;
    }>(),
    'Search Failed': props<{ message: string }>(),
  },
});
