import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositorySearchComparisonApi,
  type DiscoveryProjectionState,
  type SearchComparisonResponse,
} from 'repository-api-client';
import { EvidencePage } from './evidence-page';
import { expectNoAxeViolations } from '../testing/axe';
import {
  evidenceFeatureKey,
  initialEvidenceState,
} from '../state/evidence/evidence.reducer';
import {
  pipelineFeatureKey,
  initialPipelineState,
} from '../state/pipeline/pipeline.reducer';
import {
  initialPerformanceEvidenceState,
  performanceEvidenceFeatureKey,
} from '../state/performance-evidence/performance-evidence.reducer';

const projection: DiscoveryProjectionState = {
  source: 'REPOSITORY',
  objectCount: 181,
  projectionId: 'a'.repeat(64),
  rebuiltAt: '2026-08-29T19:00:00Z',
};

const comparison: SearchComparisonResponse = {
  scenario: 'FACETED_SEARCH',
  projection: {
    source: 'REPOSITORY',
    objectCount: 181,
    projectionId: projection.projectionId,
    rebuiltAt: projection.rebuiltAt,
  },
  sameProjection: true,
  solr: {
    engine: 'SOLR',
    enabled: true,
    reachable: true,
    indexName: 'discovery',
    indexedDocumentCount: 181,
    elapsedMs: 12,
    engineReportedMs: 4,
    totalHits: 181,
    returnedHits: 1,
    results: [],
    facets: [],
  },
  openSearch: {
    engine: 'OPENSEARCH',
    enabled: true,
    reachable: true,
    indexName: 'discovery-comparison',
    indexedDocumentCount: 181,
    elapsedMs: 18,
    engineReportedMs: 7,
    totalHits: 181,
    returnedHits: 1,
    results: [],
    facets: [],
  },
};

/**
 * Accessibility of the evidence page in states a browser test cannot easily reach.
 *
 * <p>The Playwright suite scans this route as it normally renders: loaded, populated, healthy. The
 * states that go unscanned are the ones a reader is most likely to meet on a bad day — a spinner, a
 * failed load, an empty table — and each is a different tree with different labelling.
 *
 * <p>Driving those through a running application means failing an API on purpose and waiting; here
 * they are one store value apart.
 */
describe('EvidencePage accessibility', () => {
  const renderWith = async (evidence: object, pipeline: object) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EvidencePage],
      providers: [
        provideNoopAnimations(),
        {
          provide: RepositoryAdminApi,
          useValue: { getDiscoveryProjectionState: () => of(projection) },
        },
        {
          provide: RepositorySearchComparisonApi,
          useValue: { run: () => of(comparison) },
        },
        provideMockStore({
          initialState: {
            [evidenceFeatureKey]: { ...initialEvidenceState, ...evidence },
            [pipelineFeatureKey]: { ...initialPipelineState, ...pipeline },
            [performanceEvidenceFeatureKey]: initialPerformanceEvidenceState,
          },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EvidencePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('is accessible while loading', async () => {
    const fixture = await renderWith({ loading: true }, { loading: true });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** A failed load is an alert plus whatever stale content remains; both have to stay labelled. */
  it('is accessible when both panels failed to load', async () => {
    const fixture = await renderWith(
      { loading: false, error: 'Accessibility evidence failed to load.' },
      { loading: false, error: 'Pipeline figures failed to load.' },
    );

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** The empty state is a distinct tree: tables disappear and headings must not be left dangling. */
  it('is accessible with nothing to show', async () => {
    const fixture = await renderWith(
      { loading: false, entries: [] },
      { loading: false, inventory: null, dspace: null, solr: null },
    );

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('is accessible while showing search comparison evidence', async () => {
    const fixture = await renderWith(
      { loading: false, entries: [] },
      { loading: false, inventory: null, dspace: null, solr: null },
    );

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[role="tab"]',
      ) as NodeListOf<HTMLElement>,
    );
    const comparisonTab = tabs.find((tab) =>
      tab.textContent?.includes('Search comparison'),
    );
    expect(comparisonTab).toBeTruthy();
    comparisonTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Search comparison evidence classes',
    );
    await expectNoAxeViolations(fixture.nativeElement);
  }, 10_000);
});
