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

  it('renders certified corpus, batch inference, concurrency and claim boundary', async () => {
    const fixture = await render({ evidence, loading: false, error: null });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(
      'Certified C2 Solr / OpenSearch performance evidence',
    );
    expect(text).toContain('1,000,181');
    expect(text).toContain('4 ms');
    expect(text).toContain('2 .. 5 ms');
    expect(text).toContain('Concurrency matrix: 1 / 8 / 32 clients');
    expect(text).toContain('18.5');
    expect(text).toContain('Scoped local C2 claims only.');
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
