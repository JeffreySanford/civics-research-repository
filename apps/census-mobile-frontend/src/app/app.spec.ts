import { A11yModule } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  Router,
  RouterModule,
} from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';
import type { SearchResponse } from 'repository-api-client';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { MobileSearchFiltersComponent } from './components/mobile-search-filters/mobile-search-filters.component';
import { MobileResearchDetailComponent } from './components/mobile-research-detail/mobile-research-detail.component';
import {
  SearchExplainabilityDialogComponent,
  SearchRankBadgeComponent,
  SearchRelevanceBadgeComponent,
} from 'shared-ui';
import { SearchSummaryComponent } from './components/search-summary/search-summary.component';
import { mobileResearchDetailReducer } from './state/research-detail/research-detail.reducer';
import { MobileSearchActions } from './state/search/search.actions';
import { mobileSearchReducer } from './state/search/search.reducer';

const visibleResult = {
  id: 'north-dakota-migration-example',
  title: 'North Dakota migration example',
  contentType: 'DATASET',
  relevance: {
    rawScore: 10,
    normalizedScore: 1,
    band: 'STRONG',
  },
  matchEvidence: [
    { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },
    {
      field: 'GEOGRAPHY',
      label: 'Geography',
      matchedTerms: ['North Dakota'],
    },
  ],
} as SearchResponse['results'][number];

const searchResponse: SearchResponse = {
  resultSource: 'REPOSITORY',
  query: 'North Dakota migration',
  page: 0,
  pageSize: 10,
  totalResults: 5881,
  results: [visibleResult],
  facets: [
    {
      field: 'type',
      label: 'Type',
      values: [
        { value: 'DATASET', label: 'Dataset', count: 4000, selected: false },
        {
          value: 'PUBLICATION',
          label: 'Publication',
          count: 1881,
          selected: false,
        },
      ],
    },
  ],
  relevanceModel: {
    engine: 'SOLR',
    normalization: 'SOLR_MAX_SCORE_RATIO_V1',
    calibrated: false,
  },
};

let routeParamMap = convertToParamMap({});
const activatedRouteStub = {
  get queryParamMap() {
    return of(routeParamMap);
  },
  snapshot: {
    get queryParamMap() {
      return routeParamMap;
    },
  },
};

describe('App', () => {
  beforeEach(async () => {
    routeParamMap = convertToParamMap({});
    await TestBed.configureTestingModule({
      imports: [
        A11yModule,
        RouterModule.forRoot([]),
        StoreModule.forRoot({
          mobileSearch: mobileSearchReducer,
          researchDetail: mobileResearchDetailReducer,
        }),
        SearchExplainabilityDialogComponent,
        SearchRankBadgeComponent,
        SearchRelevanceBadgeComponent,
      ],
      declarations: [
        App,
        MobileSearchFiltersComponent,
        MobileResearchDetailComponent,
        SearchSummaryComponent,
      ],
      providers: [
        {
        provide: ActivatedRoute,
        useValue: activatedRouteStub,
      },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the mobile-first Census search shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Find Census research',
    );
    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe(
      '#main-content',
    );
    expect(compiled.querySelector('form[role="search"]')).not.toBeNull();
    expect(compiled.querySelector('#research-query')).not.toBeNull();
    expect(compiled.querySelector('.status-card')?.textContent).toContain(
      'Search is ready.',
    );
    expect(compiled.querySelector('.search-form__hint')).not.toBeNull();
  });

  it('hydrates a shareable query and supported filter from the URL', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=North%20Dakota%20migration&type=DATASET');

    const store = TestBed.inject(Store);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '#research-query',
    ) as HTMLInputElement;
    expect(input.value).toBe('North Dakota migration');
    expect(dispatch).toHaveBeenCalledWith(
      MobileSearchActions.searchSubmitted({
        query: {
          q: 'North Dakota migration',
          contentType: 'DATASET',
          page: 0,
          pageSize: 10,
        },
      }),
    );
  });

  it('shows the query that produced the current ranked result set', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.search-form__hint')).toBeNull();
    expect(compiled.querySelector('.results__query')?.textContent).toContain(
      'Results for “North Dakota migration”',
    );
  });

  it('shows query-relative relevance without presenting it as a percentage', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('.relevance-badge');

    expect(badge?.textContent).toContain('Strong match');
    expect(badge?.getAttribute('aria-label')).toContain(
      'Query-relative search match strength',
    );
    expect(
      compiled.querySelector('.results__relevance-note')?.textContent,
    ).toContain('not percentages');
    expect(compiled.textContent).not.toContain('100%');
  });

  it('passes API-owned search evidence into the shared explainability dialog', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const explainability = compiled.querySelector(
      'lib-search-explainability-dialog',
    );
    const trigger = explainability?.querySelector('.explainability-trigger');

    expect(trigger?.getAttribute('aria-label')).toBe(
      'Why this result matched: North Dakota migration example',
    );
    expect(explainability?.textContent).toContain('Rank 1');
    expect(explainability?.textContent).toContain('Strong');
    expect(explainability?.textContent).toContain('Title');
    expect(explainability?.textContent).toContain('migration');
    expect(explainability?.textContent).toContain('North Dakota');
    expect(explainability?.textContent).toContain('not calibrated');
  });

  it('summarizes query-wide result types rather than only the visible page', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summary = compiled.querySelector('app-search-summary');
    expect(summary?.textContent).toContain('Result type mix');
    expect(summary?.textContent).toContain('4000 · 68%');
    expect(summary?.textContent).toContain('all records matching this search');
  });

  it('shows the submitted question while the repository is loading', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);
    const query = 'Where are people migrating from North Dakota to?';

    store.dispatch(
      MobileSearchActions.searchSubmitted({
        query: { q: query, page: 0, pageSize: 10 },
      }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.search-form__hint')).toBeNull();
    expect(compiled.querySelector('.status-card')?.textContent).toContain(
      `Searching for “${query}”`,
    );
  });

  it('opens filters as a modal dialog and returns focus to the trigger', async () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    store.dispatch(
      MobileSearchActions.searchSubmitted({
        query: { q: 'North Dakota migration', page: 0, pageSize: 10 },
      }),
    );
    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector(
      '.filter-trigger',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="dialog"]')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const close = compiled.querySelector(
      '.filter-drawer__close',
    ) as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('writes an immediate facet selection into the shareable URL and active chips', () => {
    const store = TestBed.inject(Store);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    store.dispatch(
      MobileSearchActions.searchSubmitted({
        query: { q: 'North Dakota migration', page: 0, pageSize: 10 },
      }),
    );
    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '.filter-trigger',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const datasetButton = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.facet-option'),
    ).find((element) => element.textContent?.includes('Dataset'));
    datasetButton?.click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRouteStub,
      replaceUrl: true,
      queryParams: {
        q: 'North Dakota migration',
        program: null,
        publisher: null,
        sourceSystem: null,
        geography: null,
        type: 'DATASET',
        vintageYear: null,
      },
    });
    expect(compiled.querySelector('.active-filters')?.textContent).toContain(
      'Dataset',
    );
  });

  it('labels a completed empty search as repository browsing without relevance claims', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({
        response: {
          ...searchResponse,
          query: '',
          totalResults: 644,
          relevanceModel: undefined,
          results: [
            {
              ...visibleResult,
              relevance: undefined,
              matchEvidence: undefined,
            },
          ],
        },
      }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results__query')?.textContent).toContain(
      "Browsing the repository's current discovery set.",
    );
    expect(compiled.querySelector('.relevance-badge')).toBeNull();
    expect(compiled.querySelector('.search-rank-badge')).toBeNull();
    expect(compiled.querySelector('.results__relevance-note')).toBeNull();
    expect(
      compiled.querySelector('lib-search-explainability-dialog'),
    ).toBeNull();
  });

  it('shows result range and pagination after results load', () => {
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(App);

    store.dispatch(
      MobileSearchActions.searchLoaded({ response: searchResponse }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results__range')?.textContent).toContain(
      'Showing 1–10',
    );
    expect(compiled.querySelector('.results__range')?.textContent).toContain(
      'Page 1 of 589',
    );
    expect(
      compiled.querySelector('nav[aria-label="Search result pages"]'),
    ).not.toBeNull();
  });
});
