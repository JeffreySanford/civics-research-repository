import { createReducer, on } from '@ngrx/store';
import type { SearchQuery, SearchResponse } from 'repository-api-client';
import { SearchActions } from './search.actions';

export const searchFeatureKey = 'search';

export interface SearchState {
  readonly query: SearchQuery;
  readonly response: SearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
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
};

export const searchReducer = createReducer(
  initialSearchState,
  on(SearchActions.searchSubmitted, (state, { query }) => ({
    ...state,
    query,
    loading: true,
    error: null,
  })),
  on(SearchActions.searchLoaded, (state, { response }) => ({
    ...state,
    response,
    loading: false,
    error: null,
  })),
  on(SearchActions.searchFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
);
