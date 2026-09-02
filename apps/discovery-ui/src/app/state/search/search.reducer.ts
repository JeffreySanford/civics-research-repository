import { createReducer, on } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';
import { SearchActions } from './search.actions';

export const searchFeatureKey = 'search';

export interface SearchState {
  readonly query: SearchQuery;
  readonly response: SearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** True only after a cursor-backed page has loaded successfully. */
  readonly cursorMode: boolean;
  /** Cursor used to enter each visited logical page. Page zero is always null. */
  readonly cursorByPage: readonly (string | null)[];
  /** Opaque continuation returned for the page after the currently displayed page. */
  readonly nextCursor: string | null;
}

export const initialSearchState: SearchState = {
  query: {
    q: '',
    page: 0,
    pageSize: 25,
  },
  response: null,
  loading: false,
  error: null,
  cursorMode: false,
  cursorByPage: [],
  nextCursor: null,
};

export const searchReducer = createReducer(
  initialSearchState,
  on(SearchActions.searchSubmitted, (state, { query }) => ({
    ...state,
    query,
    loading: true,
    error: null,
    cursorMode: false,
    cursorByPage: [],
    nextCursor: null,
  })),
  on(SearchActions.cursorSearchSubmitted, (state, { query }) => ({
    ...state,
    query: { ...query, page: 0 },
    loading: true,
    error: null,
    cursorMode: false,
    cursorByPage: [],
    nextCursor: null,
  })),
  on(SearchActions.searchPageRequested, (state, { page }) => ({
    ...state,
    query: { ...state.query, page: Math.max(0, page) },
    loading: true,
    error: null,
  })),
  on(SearchActions.searchLoaded, (state, { response }) => ({
    ...state,
    response,
    query: { ...state.query, page: response.page },
    loading: false,
    error: null,
    cursorMode: false,
    cursorByPage: [],
    nextCursor: null,
  })),
  on(SearchActions.cursorSearchLoaded, (state, { cursorPage, cursorUsed }) => {
    const logicalPage = Math.max(0, cursorPage.search.page);
    const cursorByPage = [...state.cursorByPage];
    cursorByPage[logicalPage] = logicalPage === 0 ? null : cursorUsed;

    return {
      ...state,
      response: cursorPage.search,
      query: { ...state.query, page: logicalPage },
      loading: false,
      error: null,
      cursorMode: true,
      cursorByPage,
      nextCursor: cursorPage.nextCursor,
    };
  }),
  on(SearchActions.searchFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
);
