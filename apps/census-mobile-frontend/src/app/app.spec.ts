import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Store, StoreModule } from '@ngrx/store';
import type { SearchResponse } from 'repository-api-client';
import { App } from './app';
import { MobileSearchActions } from './state/search/search.actions';
import { mobileSearchReducer } from './state/search/search.reducer';

const visibleResult = {
  id: 'north-dakota-migration-example',
  title: 'North Dakota migration example',
  contentType: 'DATASET',
} as SearchResponse['results'][number];

const searchResponse: SearchResponse = {
  resultSource: 'REPOSITORY',
  query: 'North Dakota migration',
  page: 0,
  pageSize: 10,
  totalResults: 5881,
  results: [visibleResult],
  facets: [],
};

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
