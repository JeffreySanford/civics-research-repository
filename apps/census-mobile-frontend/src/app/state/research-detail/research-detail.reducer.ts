import { createReducer, on } from '@ngrx/store';
import type { ResearchObjectDetail } from 'repository-api-client';
import { MobileResearchDetailActions } from './research-detail.actions';

export interface MobileResearchDetailState {
  readonly researchId: string | null;
  readonly detail: ResearchObjectDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialMobileResearchDetailState: MobileResearchDetailState = {
  researchId: null,
  detail: null,
  loading: false,
  error: null,
};

export const mobileResearchDetailReducer = createReducer(
  initialMobileResearchDetailState,
  on(MobileResearchDetailActions.detailOpened, (state, { researchId }) => ({
    ...state,
    researchId,
    detail: null,
    loading: true,
    error: null,
  })),
  on(MobileResearchDetailActions.detailLoaded, (state, { detail }) => ({
    ...state,
    detail,
    loading: false,
    error: null,
  })),
  on(MobileResearchDetailActions.detailFailed, (state, { message }) => ({
    ...state,
    detail: null,
    loading: false,
    error: message,
  })),
);
