import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DiscoveryPage } from './discovery-page';
import { expectNoAxeViolations } from '../testing/axe';
import {
  initialSearchState,
  searchFeatureKey,
} from '../state/search/search.reducer';

/**
 * Accessibility of discovery in the states the browser suite does not reach.
 *
 * <p>Playwright scans this route with results on the page. A reader hitting a failed search, an
 * empty result set, or the moment before results arrive sees a different tree each time, and those
 * are the trees nothing had checked.
 */
describe('DiscoveryPage accessibility', () => {
  const renderWith = async (search: object) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DiscoveryPage],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideMockStore({
          initialState: {
            [searchFeatureKey]: { ...initialSearchState, ...search },
          },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DiscoveryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('is accessible while searching', async () => {
    const fixture = await renderWith({ loading: true });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** An alert appears and the controls around it stay operable and labelled. */
  it('is accessible when the search failed', async () => {
    const fixture = await renderWith({
      loading: false,
      error: 'Search failed to load.',
    });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** No results means no facet list and no pager: what remains must still be a coherent page. */
  it('presents server-owned rank and relevance accessibly for a real query', async () => {
    const fixture = await renderWith({
      loading: false,
      response: {
        resultSource: 'REPOSITORY',
        query: 'North Dakota migration',
        page: 0,
        pageSize: 25,
        totalResults: 1,
        results: [
          {
            id: 'north-dakota-migration',
            title: 'Migration Flows for North Dakota',
            contentType: 'DATASET',
            program: 'ACS',
            publisher: 'U.S. Census Bureau',
            summary: 'Migration research metadata for North Dakota.',
            sourceUrl: 'https://www.census.gov/',
            sourceSystem: 'DSPACE',
            origin: 'CURATED',
            relevance: { rawScore: 10, normalizedScore: 1, band: 'STRONG' },
          },
        ],
        facets: [],
        relevanceModel: {
          engine: 'SOLR',
          normalization: 'SOLR_MAX_SCORE_RATIO_V1',
          calibrated: false,
        },
      },
    });

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.search-rank-badge')?.textContent).toContain('Rank 1');
    expect(root.querySelector('.relevance-badge')?.textContent).toContain('Strong match');
    expect(root.querySelector('.results-relevance-note')?.textContent).toContain('not percentages');
    expect(root.textContent).not.toContain('100%');
    await expectNoAxeViolations(root);
  });

  it('is accessible with no results', async () => {
    const fixture = await renderWith({
      loading: false,
      response: {
        resultSource: 'REPOSITORY',
        query: 'nothing matches this',
        page: 0,
        pageSize: 25,
        totalResults: 0,
        results: [],
        facets: [],
      },
    });

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
