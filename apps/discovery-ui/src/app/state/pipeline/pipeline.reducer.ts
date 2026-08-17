import { createReducer, on } from '@ngrx/store';
import type {
  DspaceOverview,
  SolrOverview,
  SourceInventory,
} from 'repository-api-client';
import { PipelineActions } from './pipeline.actions';

export const pipelineFeatureKey = 'pipeline';

export interface PipelineState {
  readonly inventory: SourceInventory | null;
  readonly dspace: DspaceOverview | null;
  readonly solr: SolrOverview | null;
  readonly loading: boolean;
  /** The message, not the error object: the panel renders it, and every other feature stores it this way. */
  readonly error: string | null;
}

export const initialPipelineState: PipelineState = {
  inventory: null,
  dspace: null,
  solr: null,
  loading: false,
  error: null,
};

export const pipelineReducer = createReducer(
  initialPipelineState,
  on(PipelineActions.loadRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(PipelineActions.loadSucceeded, (state, { inventory, dspace, solr }) => ({
    ...state,
    inventory,
    dspace,
    solr,
    loading: false,
    error: null,
  })),
  // The previous figures are kept on failure: stale numbers with a visible error beat an empty
  // panel that says nothing about what the pipeline held a moment ago.
  on(PipelineActions.loadFailed, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message,
  })),
);
