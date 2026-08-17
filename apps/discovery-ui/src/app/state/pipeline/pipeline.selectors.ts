import { createFeatureSelector, createSelector } from '@ngrx/store';
import { pipelineFeatureKey, type PipelineState } from './pipeline.reducer';

export const selectPipelineState =
  createFeatureSelector<PipelineState>(pipelineFeatureKey);

export const selectSourceInventory = createSelector(
  selectPipelineState,
  (state) => state.inventory,
);

export const selectPipelineDspace = createSelector(
  selectPipelineState,
  (state) => state.dspace,
);

export const selectPipelineSolr = createSelector(
  selectPipelineState,
  (state) => state.solr,
);

export const selectPipelineLoading = createSelector(
  selectPipelineState,
  (state) => state.loading,
);

export const selectPipelineError = createSelector(
  selectPipelineState,
  (state) => state.error,
);

/**
 * Per-program rows for the chart and its table, largest first, with the bar width each one needs.
 *
 * The width is a share of the largest program rather than of the total: the largest program is
 * roughly a third of the corpus, so scaling to the total would leave every bar short and the
 * differences between the small programs invisible.
 */
export const selectSourceProgramRows = createSelector(
  selectSourceInventory,
  (inventory) => {
    const programs = [...(inventory?.byProgram ?? [])].sort(
      (left, right) => right.totalBytes - left.totalBytes,
    );
    const largest = programs[0]?.totalBytes ?? 0;

    return programs.map((program) => ({
      ...program,
      // A measured-but-tiny program still gets a visible sliver rather than nothing at all.
      barPercent:
        largest > 0 && program.totalBytes > 0
          ? Math.max(1, Math.round((program.totalBytes / largest) * 100))
          : 0,
    }));
  },
);

/**
 * The pipeline read as three stages.
 *
 * `subscribed` is what the publishers hold, `curated` what DSpace has as items, `indexed` what
 * Solr serves. `mirrored` is deliberately absent: the repository stores metadata and links, so the
 * assetstore holds none of those bytes, and inventing a number for it would misdescribe the design.
 */
export const selectPipelineStages = createSelector(
  selectSourceInventory,
  selectPipelineDspace,
  selectPipelineSolr,
  (inventory, dspace, solr) => ({
    subscribedBytes: inventory?.totalBytes ?? 0,
    subscribedFiles: inventory?.distinctFileCount ?? 0,
    measuredFiles: inventory?.measuredFileCount ?? 0,
    unreachableFiles: inventory?.unreachableFileCount ?? 0,
    subscribedObjects: inventory?.objectCount ?? 0,
    programCount: inventory?.programCount ?? 0,
    measuredAt: inventory?.checkedAt ?? null,
    curatedItems: dspace?.itemCount ?? 0,
    curatedCollections: dspace?.collectionCount ?? 0,
    curatedReachable: dspace?.reachable ?? false,
    lastSyncAt: dspace?.lastSyncStartedAt ?? null,
    lastSyncStatus: dspace?.lastSyncStatus ?? null,
    indexedDocuments: solr?.indexedDocumentCount ?? 0,
    indexedSource: solr?.projectionSource ?? null,
    indexedAt: solr?.lastRebuiltAt ?? null,
  }),
);
