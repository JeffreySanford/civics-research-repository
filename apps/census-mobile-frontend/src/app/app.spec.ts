import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';
import type { SearchResponse } from 'repository-api-client';
import { App } from './app';
import { MobileSearchActions } from './state/search/search.actions';
import { mobileSearchReducer } from './state/search/search.reducer';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        StoreModule.forRoot({ mobileSearch: mobileSearchReducer }),
      ],
      declarations: [App],
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
    expect(compiled.querySelector('.search-form__hint')?.textContent).toContain(
      'Enter a question or keywords.',
    );
  });

  it('replaces the empty-search helper with the query that produced results', () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(Store);
    const query = 'Where are people migrating from North Dakota to?';
    const response: SearchResponse = {
      resultSource: 'REPOSITORY',
      query,
      page: 0,
      pageSize: 10,
      totalResults: 644,
      results: [],
      facets: [],
    };

    store.dispatch(
      MobileSearchActions.searchSubmitted({
        query: { q: query, page: 0, pageSize: 10 },
      }),
    );
    store.dispatch(MobileSearchActions.searchLoaded({ response }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.search-form__hint')).toBeNull();
    expect(compiled.querySelector('.results__query')?.textContent).toContain(
      `Results for “${query}”`,
    );
    expect(compiled.querySelector('#results-title')?.textContent).toContain(
      '644 matching records',
    );
  });

  it('labels a completed empty search as repository browsing', () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(Store);
    const response: SearchResponse = {
      resultSource: 'REPOSITORY',
      query: '',
      page: 0,
      pageSize: 10,
      totalResults: 644,
      results: [],
      facets: [],
    };

    store.dispatch(
      MobileSearchActions.searchSubmitted({ query: { page: 0, pageSize: 10 } }),
    );
    store.dispatch(MobileSearchActions.searchLoaded({ response }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results__query')?.textContent).toContain(
      "Browsing the repository's current discovery set.",
    );
  });
});
