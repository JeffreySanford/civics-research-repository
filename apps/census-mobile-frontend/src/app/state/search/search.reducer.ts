import { createReducer, on } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';
import { MobileSearchActions } from './search.actions';

export interface MobileSearchState {
  readonly query: SearchQuery;
  readonly response: SearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialMobileSearchState: MobileSearchState = {
  query: { page: 0, pageSize: 10 },
  response: null,
  loading: false,
  error: null,
};

export const mobileSearchReducer = createReducer(
  initialMobileSearchState,
  on(MobileSearchActions.searchSubmitted, (state, { query }) => ({
    ...state,
    query,
    loading: true,
    error: null,
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
    loading: false,
    error: null,
  })),
  on(MobileSearchActions.searchFailed, (state, { message }) => ({
    ...state,
    loading: false,
    error: message,
  })),
);
