import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';
import type { SearchResponse } from 'repository-api-client';
import { App } from './app';
import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';
import { SearchSummaryComponent } from './components/search-summary/search-summary.component';
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

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),
      ],
      declarations: [
        App,
        SearchRelevanceBadgeComponent,
        SearchSummaryComponent,
      ],
    }).compileComponents();
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
          results: [{ ...visibleResult, relevance: undefined }],
        },
      }),
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results__query')?.textContent).toContain(
      "Browsing the repository's current discovery set.",
    );
    expect(compiled.querySelector('.relevance-badge')).toBeNull();
    expect(compiled.querySelector('.results__relevance-note')).toBeNull();
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
