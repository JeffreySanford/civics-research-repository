import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  RepositoryAdminApi,
  RepositorySearchComparisonApi,
  type DiscoveryProjectionState,
  type SearchComparisonResponse,
} from 'repository-api-client';
import { expectNoAxeViolations } from '../testing/axe';
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

describe('AdminSearchProjectionComponent accessibility', () => {
  afterEach(() => TestBed.resetTestingModule());

  it(
    'is accessible while showing projection and engine parity evidence',
    async () => {
      await TestBed.configureTestingModule({
        imports: [AdminSearchProjectionComponent],
        providers: [
          {
            provide: RepositoryAdminApi,
            useValue: {
              getDiscoveryProjectionState: vi
                .fn()
                .mockReturnValue(of(projection)),
            },
          },
          {
            provide: RepositorySearchComparisonApi,
            useValue: {
              run: vi.fn().mockReturnValue(of(comparison)),
            },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(AdminSearchProjectionComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      await expectNoAxeViolations(fixture.nativeElement);
    },
    10_000,
  );
});
