import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  DspaceOverview,
  RepositoryError,
  SolrOverview,
  SourceInventory,
} from 'repository-api-client';

/**
 * The three stages of the data pipeline, loaded together.
 *
 * What the repository subscribes to, what it has curated into DSpace, and what Solr is serving are
 * only meaningful side by side: each number explains the next one's gap.
 */
export const PipelineActions = createActionGroup({
  source: 'Data Pipeline',
  events: {
    'Load Requested': emptyProps(),
    'Load Succeeded': props<{
      inventory: SourceInventory;
      dspace: DspaceOverview;
      solr: SolrOverview;
    }>(),
    'Load Failed': props<{ error: RepositoryError }>(),
  },
});
