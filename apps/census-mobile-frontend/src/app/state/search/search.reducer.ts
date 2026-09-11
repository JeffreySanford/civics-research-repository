import { createReducer, on } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';
import { MobileSearchActions } from './search.actions';

export interface MobileSearchState {
  readonly query: SearchQuery;
  readonly response: SearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly cursorMode: boolean;
  readonly cursorByPage: readonly (string | null)[];
  readonly nextCursor: string | null;
  readonly paginationNotice: string | null;
}

export const initialMobileSearchState: MobileSearchState = {
  query: { page: 0, pageSize: 10 },
  response: null,
  loading: false,
  error: null,
  cursorMode: false,
  cursorByPage: [],
  nextCursor: null,
  paginationNotice: null,
};

export const mobileSearchReducer = createReducer(
  initialMobileSearchState,
  on(MobileSearchActions.searchSubmitted, (state, { query }) => ({
    ...state,
    query: { ...query, page: 0 },
    loading: true,
    error: null,
    cursorMode: false,
    cursorByPage: [],
    nextCursor: null,
    paginationNotice: null,
  })),
  on(MobileSearchActions.pageRequested, (state, { page }) => ({
    ...state,
    query: {
      ...state.query,
      page: Math.max(0, page),
    },
    loading: true,
    error: null,
  })),
  on(MobileSearchActions.searchLoaded, (state, { response }) => ({
    ...state,
    response,
    query: { ...state.query, page: response.page },
    loading: false,
    error: null,
    cursorMode: false,
    cursorByPage: [],
    nextCursor: null,
  })),
  on(
    MobileSearchActions.cursorSearchLoaded,
    (state, { cursorPage, cursorUsed }) => {
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
        paginationNotice: null,
      };
    },
  ),
  on(
    MobileSearchActions.cursorCompatibilityLoaded,
    (state, { response, notice }) => ({
      ...state,
      response,
      query: { ...state.query, page: response.page },
      loading: false,
      error: null,
      cursorMode: false,
      cursorByPage: [],
      nextCursor: null,
      paginationNotice: notice,
    }),
  ),
  on(MobileSearchActions.searchFailed, (state, { message }) => ({
    ...state,
    loading: false,
    error: message,
  })),
);
