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
