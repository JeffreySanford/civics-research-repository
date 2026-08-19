import type {
  DspaceOverview,
  SolrOverview,
  SourceInventory,
} from 'repository-api-client';
import { PipelineActions } from './pipeline.actions';
import { initialPipelineState, pipelineReducer } from './pipeline.reducer';
import {
  selectPipelineStages,
  selectSourceProgramRows,
} from './pipeline.selectors';

const inventory = {
  checkedAt: '2026-08-17T19:36:20.535Z',
  objectCount: 176,
  programCount: 3,
  distinctFileCount: 191,
  measuredFileCount: 167,
  unreachableFileCount: 8,
  totalBytes: 1_848_988_848,
  byProgram: [
    {
      program: 'LODES',
      objectCount: 53,
      fileCount: 54,
      measuredFileCount: 50,
      unreachableFileCount: 2,
      totalBytes: 54_000_000,
    },
    {
      program: 'ACS',
      objectCount: 56,
      fileCount: 57,
      measuredFileCount: 52,
      unreachableFileCount: 5,
      totalBytes: 612_000_000,
    },
    {
      program: 'SAIPE',
      objectCount: 1,
      fileCount: 2,
      measuredFileCount: 0,
      unreachableFileCount: 1,
      totalBytes: 0,
    },
  ],
} as unknown as SourceInventory;

const dspace = {
  reachable: true,
  itemCount: 183,
  collectionCount: 1,
  lastSyncStartedAt: '2026-08-17T11:58:59.230638Z',
  lastSyncStatus: 'APPLIED',
  storedBitstreamCount: 76,
  storedBytes: 1_077_000_000,
} as unknown as DspaceOverview;

const solr = {
  indexedDocumentCount: 183,
  projectionSource: 'REPOSITORY',
  lastRebuiltAt: '2026-08-17T11:58:59.289698906Z',
} as unknown as SolrOverview;

describe('pipelineReducer', () => {
  it('stores all three stages together', () => {
    const state = pipelineReducer(
      initialPipelineState,
      PipelineActions.loadSucceeded({ inventory, dspace, solr }),
    );

    expect(state.loading).toBe(false);
    expect(state.inventory?.totalBytes).toBe(1_848_988_848);
    expect(state.dspace?.itemCount).toBe(183);
    expect(state.solr?.indexedDocumentCount).toBe(183);
  });

  /**
   * A failed refresh should not blank the panel: stale figures with a visible error say more than
   * an empty one.
   */
  it('keeps the previous figures when a refresh fails', () => {
    const loaded = pipelineReducer(
      initialPipelineState,
      PipelineActions.loadSucceeded({ inventory, dspace, solr }),
    );

    const failed = pipelineReducer(
      loaded,
      PipelineActions.loadFailed({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Pipeline figures failed to load.',
        },
      }),
    );

    expect(failed.error).toBe('Pipeline figures failed to load.');
    expect(failed.loading).toBe(false);
    expect(failed.inventory?.totalBytes).toBe(1_848_988_848);
  });
});

describe('pipeline selectors', () => {
  const loaded = pipelineReducer(
    initialPipelineState,
    PipelineActions.loadSucceeded({ inventory, dspace, solr }),
  );

  it('reports the three stages with their as-of dates', () => {
    const stages = selectPipelineStages.projector(inventory, dspace, solr);

    expect(stages.subscribedBytes).toBe(1_848_988_848);
    expect(stages.curatedItems).toBe(183);
    expect(stages.indexedDocuments).toBe(183);
    expect(stages.measuredAt).toBe('2026-08-17T19:36:20.535Z');
    expect(stages.unreachableFiles).toBe(8);
  });

  /**
   * The three tallies partition the distinct files. If they ever stop doing so, the caveat under
   * the subscribed total starts claiming more unmeasured files than the inventory contains.
   */
  it('derives the unmeasured files as the remainder of the partition', () => {
    const stages = selectPipelineStages.projector(inventory, dspace, solr);

    expect(stages.unmeasuredFiles).toBe(16);
    expect(
      stages.measuredFiles + stages.unmeasuredFiles + stages.unreachableFiles,
    ).toBe(stages.subscribedFiles);
  });

  it('never reports a negative unmeasured count', () => {
    const stages = selectPipelineStages.projector(
      { ...inventory, distinctFileCount: 0 } as typeof inventory,
      dspace,
      solr,
    );

    expect(stages.unmeasuredFiles).toBe(0);
  });

  it('reports the mirrored bytes as a share of the subscribed bytes', () => {
    const stages = selectPipelineStages.projector(inventory, dspace, solr);

    expect(stages.mirroredBytes).toBe(1_077_000_000);
    expect(stages.mirroredFiles).toBe(76);
    expect(stages.mirroredPercent).toBe(58);
  });

  /**
   * Before the mirror ran, DSpace held items and no bitstreams. That state must read as 0%, not as
   * the 1% floor that keeps a real-but-small mirror visible.
   */
  it('reports no share when nothing has been mirrored', () => {
    const stages = selectPipelineStages.projector(
      inventory,
      { ...dspace, storedBytes: 0, storedBitstreamCount: 0 },
      solr,
    );

    expect(stages.mirroredPercent).toBe(0);
  });

  it('reports zeroes rather than throwing before anything has loaded', () => {
    const stages = selectPipelineStages.projector(null, null, null);

    expect(stages.subscribedBytes).toBe(0);
    expect(stages.measuredAt).toBeNull();
  });

  it('orders programs by size and scales the bars to the largest', () => {
    const rows = selectSourceProgramRows.projector(loaded.inventory);

    expect(rows.map((row) => row.program)).toEqual(['ACS', 'LODES', 'SAIPE']);
    expect(rows[0].barPercent).toBe(100);
    // 54M against 612M is under 9%, and must still be drawn to scale rather than rounded up.
    expect(rows[1].barPercent).toBe(9);
  });

  /** A program with nothing measured gets no bar, not a misleading sliver. */
  it('draws no bar for a program with no measured bytes', () => {
    const rows = selectSourceProgramRows.projector(loaded.inventory);

    expect(rows[2].program).toBe('SAIPE');
    expect(rows[2].barPercent).toBe(0);
  });
});
