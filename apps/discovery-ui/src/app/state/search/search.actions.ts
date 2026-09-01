import { createActionGroup, props } from '@ngrx/store';
import type {
  SearchCursorPage,
  SearchQuery,
  SearchResponse,
  RepositoryError,
} from 'repository-api-client';

export const SearchActions = createActionGroup({
  source: 'Repository Search',
  events: {
    /** Existing offset-compatible search used by shared/deep-linked page URLs. */
    'Search Submitted': props<{ query: SearchQuery }>(),
    /** Starts a new cursor traversal from page zero. */
    'Cursor Search Submitted': props<{ query: SearchQuery }>(),
    /** Requests another logical page using the active traversal mode. */
    'Search Page Requested': props<{ page: number }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Cursor Search Loaded': props<{
      cursorPage: SearchCursorPage;
      cursorUsed: string | null;
    }>(),
    'Search Failed': props<{ error: RepositoryError }>(),
  },
});
