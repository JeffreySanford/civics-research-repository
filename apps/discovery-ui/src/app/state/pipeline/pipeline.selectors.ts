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
 * The pipeline read as four stages.
 *
 * `subscribed` is what the publishers hold, `mirrored` what the assetstore has as bitstreams,
 * `curated` what DSpace has as items, `indexed` what Solr serves. Mirroring is bounded — a per-file
 * cap and a total budget — so `mirroredBytes` is a fraction of `subscribedBytes` by design, and the
 * ratio is worth showing rather than hiding: it is the difference between a repository that
 * preserves bytes and one that only points at them.
 *
 * Both figures come from the API, which asks DSpace. Neither is derived from the mirror manifest,
 * which records what a seed run intended to stage rather than what was imported.
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
    /**
     * Files that answered but sent no Content-Length, so their bytes are absent from the total.
     *
     * Derived rather than reported, because the three tallies partition the distinct files: what
     * is neither measured nor unreachable answered without a length. Clamped at zero so a partial
     * inventory cannot render a negative count.
     */
    unmeasuredFiles: Math.max(
      0,
      (inventory?.distinctFileCount ?? 0) -
        (inventory?.measuredFileCount ?? 0) -
        (inventory?.unreachableFileCount ?? 0),
    ),
    subscribedObjects: inventory?.objectCount ?? 0,
    programCount: inventory?.programCount ?? 0,
    measuredAt: inventory?.checkedAt ?? null,
    mirroredBytes: dspace?.storedBytes ?? 0,
    mirroredFiles: dspace?.storedBitstreamCount ?? 0,
    // Share of the subscribed bytes actually held, floored at 1% so a real mirror never reads 0%.
    mirroredPercent:
      (inventory?.totalBytes ?? 0) > 0 && (dspace?.storedBytes ?? 0) > 0
        ? Math.max(
            1,
            Math.round(
              ((dspace?.storedBytes ?? 0) / (inventory?.totalBytes ?? 1)) * 100,
            ),
          )
        : 0,
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
