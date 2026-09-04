import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { SearchPerformanceEvidenceComponent } from './search-performance-evidence.component';
import {
  performanceEvidenceFeatureKey,
  type PerformanceEvidenceState,
} from '../state/performance-evidence/performance-evidence.reducer';
import type { SearchPerformanceEvidence } from 'repository-api-client';

const evidence: SearchPerformanceEvidence = {
  profile: 'FEDERATED_1M',
  capturedAt: '2026-09-03T19:06:00Z',
  scope: 'LOCAL_CERTIFIED_TOPOLOGY_ONLY',
  comparativeClaimAllowed: false,
  projectionId: 'a'.repeat(64),
  projectionObjectCount: 1_000_181,
  retainedFederatedRecords: 1_000_000,
  targetParity: true,
  claimGuardrail: 'Scoped local C2 claims only.',
  executionControls: {
    orderStrategy: 'RANDOMIZED',
    requestedStartingOrder: 'SOLR_FIRST',
    realizedFirstBatchOrder: 'OPENSEARCH_FIRST',
    seed: 20260903,
    seedApplied: true,
    batches: 6,
    measuredRunsPerBatch: 20,
    totalMeasuredRuns: 120,
    batchExecutionOrders: ['OPENSEARCH_FIRST', 'SOLR_FIRST'],
  },
  standaloneBatchEvidence: {
    available: true,
    scenario: 'FULL_TEXT_RELEVANCE',
    query: 'North Dakota workforce',
    batchCount: 6,
    apiElapsed: {
      medianDifferenceMs: 4,
      lower95Ms: 2,
      upper95Ms: 5,
      solrWinRatePercent: 100,
      excludesZero: true,
      interpretation:
        'Positive differences mean OpenSearch took longer than Solr.',
    },
    engineReported: null,
    experimentalUnit: 'One separately warmed benchmark batch.',
  },
  orderRobustness: {
    scenarioCount: 4,
    solrLeadsP50BothOrdersCount: 4,
    solrLeadsP95BothOrdersCount: 4,
    scenarios: [],
  },
  pairedWorkloads: [
    {
      scenario: 'FULL_TEXT_RELEVANCE',
      workloadClass: 'FULL_TEXT',
      executionOrder: 'SOLR_FIRST',
      solrApiP50Ms: 5,
      solrApiP95Ms: 5,
      openSearchApiP50Ms: 7,
      openSearchApiP95Ms: 11,
      solrNativeP50Ms: 3,
      solrNativeP95Ms: 3,
      openSearchNativeP50Ms: 5,
      openSearchNativeP95Ms: 8,
    },
  ],
  concurrency: [
    {
      workloadId: 'FULL_TEXT_RELEVANCE',
      workloadClass: 'FULL_TEXT',
      concurrency: 8,
      measuredComparisons: 240,
      comparisonRequestsPerSecond: 18.5,
      solrApiP50Ms: 8,
      solrApiP95Ms: 15,
      openSearchApiP50Ms: 14,
      openSearchApiP95Ms: 29,
      requestLevel: {
        medianDifferenceMs: 6,
        lower95Ms: 4,
        upper95Ms: 8,
        solrWinRatePercent: 96.5,
        excludesZero: true,
        interpretation:
          'Positive differences mean OpenSearch took longer than Solr.',
      },
      batchLevel: {
        available: true,
        batchCount: 6,
        apiElapsed: {
          medianDifferenceMs: 5,
          lower95Ms: 3,
          upper95Ms: 7,
          solrWinRatePercent: 100,
          excludesZero: true,
          interpretation:
            'Positive differences mean OpenSearch took longer than Solr.',
        },
      },
    },
  ],
  c21Adversarial: {
    capturedAt: '2026-09-04T15:23:00Z',
    openSearchTreatment: 'C2_1_OPTIMIZED_EQUIVALENT',
    workloadCellCount: 2,
    restartBlocks: 4,
    independentBatchSummariesPerCell: 16,
    solrLowerLatencyCells: 2,
    openSearchLowerLatencyCells: 0,
    tiedCells: 0,
    ciExcludesZeroFavoringSolr: 2,
    ciExcludesZeroFavoringOpenSearch: 0,
    cells: [
      {
        id: 'Q01',
        workload: 'energy',
        totalHits: 43_707,
        apiElapsed: {
          medianDifferenceMs: 8,
          lower95Ms: 8,
          upper95Ms: 8,
          solrWinRatePercent: 100,
          excludesZero: true,
          interpretation:
            'Positive differences mean OpenSearch took longer than Solr.',
        },
      },
      {
        id: 'FILTER_BROAD',
        workload: 'sourceSystem=DATA_GOV',
        totalHits: 500_000,
        apiElapsed: {
          medianDifferenceMs: 24,
          lower95Ms: 23,
          upper95Ms: 24,
          solrWinRatePercent: 100,
          excludesZero: true,
          interpretation:
            'Positive differences mean OpenSearch took longer than Solr.',
        },
      },
    ],
    claimGuardrail: 'Scoped local C2.1 claims only.',
  },
  resources: {
    captured: true,
    interpretation: 'Counters and observations remain distinct.',
    counterResetDetected: false,
    counterResetFields: [],
  },
};

describe('SearchPerformanceEvidenceComponent', () => {
  const render = async (state: PerformanceEvidenceState) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SearchPerformanceEvidenceComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({
          initialState: { [performanceEvidenceFeatureKey]: state },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchPerformanceEvidenceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('renders historical C2 and adversarial C2.1 as separate evidence layers', async () => {
    const fixture = await render({ evidence, loading: false, error: null });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Certified Solr / OpenSearch performance evidence');
    expect(text).toContain('Historical C2 baseline');
    expect(text).toContain('1,000,181');
    expect(text).toContain('4 ms');
    expect(text).toContain('2 .. 5 ms');
    expect(text).toContain('Concurrency matrix: 1 / 8 / 32 clients');
    expect(text).toContain('18.5');
    expect(text).toContain('Scoped local C2 claims only.');

    expect(text).toContain('Adversarial C2.1 validation');
    expect(text).toContain('2 / 2');
    expect(text).toContain('16');
    expect(text).toContain('C2_1_OPTIMIZED_EQUIVALENT');
    expect(text).toContain('Q01');
    expect(text).toContain('43,707');
    expect(text).toContain('8 .. 8 ms');
    expect(text).toContain('FILTER_BROAD');
    expect(text).toContain('500,000');
    expect(text).toContain('23 .. 24 ms');
    expect(text).toContain('Scoped local C2.1 claims only.');
  });

  it('keeps historical C2 visible when C2.1 evidence is unavailable', async () => {
    const fixture = await render({
      evidence: { ...evidence, c21Adversarial: null },
      loading: false,
      error: null,
    });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Historical C2 baseline');
    expect(text).not.toContain('Adversarial C2.1 validation');
  });

  it('renders the runtime guidance when evidence is unavailable', async () => {
    const fixture = await render({
      evidence: null,
      loading: false,
      error: 'Certified C2 evidence is unavailable.',
    });

    expect(fixture.nativeElement.textContent).toContain(
      'pnpm run research:c2:evidence',
    );
  });
});
