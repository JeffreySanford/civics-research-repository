import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositorySearchComparisonApi,
  type DiscoveryProjectionState,
  type SearchComparisonResponse,
} from 'repository-api-client';
import { AdminSearchProjectionComponent } from './admin-search-projection.component';

const projection: DiscoveryProjectionState = {
  source: 'REPOSITORY',
  objectCount: 181,
  projectionId:
    'e2bbaf1b9ff6c81b1c7e3f4908c9a10b8d2133451c39cf4937471bbb5cd88cac',
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
    totalHits: 181,
    returnedHits: 1,
    results: [],
    facets: [],
  },
};

function renderWith(response: SearchComparisonResponse = comparison) {
  const run = vi.fn().mockReturnValue(of(response));

  TestBed.configureTestingModule({
    imports: [AdminSearchProjectionComponent],
    providers: [
      {
        provide: RepositoryAdminApi,
        useValue: {
          getDiscoveryProjectionState: vi.fn().mockReturnValue(of(projection)),
        },
      },
      {
        provide: RepositorySearchComparisonApi,
        useValue: { run },
      },
    ],
  });

  const fixture = TestBed.createComponent(AdminSearchProjectionComponent);
  fixture.detectChanges();
  return { fixture, run };
}

describe('AdminSearchProjectionComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the normalized projection and the distinct roles of both engines', () => {
    const { fixture, run } = renderWith();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Normalize once, project many');
    expect(text).toContain('181');
    expect(text).toContain('Projection parity verified');
    expect(text).toContain('Solr');
    expect(text).toContain('Public discovery');
    expect(text).toContain('OpenSearch');
    expect(text).toContain('Comparison target');
    expect(text).toContain('discovery-comparison');
    expect(text).toContain('e2bbaf1b9ff6');

    expect(run).toHaveBeenCalledWith({
      scenario: 'FACETED_SEARCH',
      query: '',
      page: 0,
      pageSize: 1,
    });
  });

  it('keeps Solr visible and reports parity as unverified when OpenSearch is down', () => {
    const response: SearchComparisonResponse = {
      ...comparison,
      sameProjection: false,
      openSearch: {
        ...comparison.openSearch,
        reachable: false,
        indexedDocumentCount: undefined,
        warning: 'OpenSearch is not reachable.',
      },
    };
    const { fixture } = renderWith(response);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Projection parity not verified');
    expect(text).toContain('Solr');
    expect(text).toMatch(/Reachable\s+Yes/);
    expect(text).toContain('OpenSearch');
    expect(text).toMatch(/Reachable\s+No/);
    expect(text).toContain('OpenSearch is not reachable.');
  });
});
