import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositorySearchApi,
  type SearchQuery,
  type SearchResponse,
} from 'repository-api-client';
import { SearchActions } from './search.actions';
import { SearchEffects } from './search.effects';

const response: SearchResponse = {
  resultSource: 'REPOSITORY',
  query: 'tracts',
  page: 0,
  pageSize: 25,
  totalResults: 1,
  results: [
    {
      id: 'tiger-line-north-dakota-2025',
      title: '2025 TIGER/Line - Census Tracts - North Dakota',
      contentType: 'DATASET',
      program: 'TIGER_LINE',
      publisher: 'U.S. Census Bureau',
      summary: 'Tract geometry metadata.',
      geography: 'North Dakota',
      vintageYear: 2025,
      sourceUrl: 'https://www2.census.gov/geo/tiger/TIGER2025/',
    },
  ],
  facets: [],
};

function setup(
  searchApi: Partial<RepositorySearchApi>,
  actions$: Observable<unknown>,
) {
  TestBed.configureTestingModule({
    providers: [
      SearchEffects,
      provideMockActions(() => actions$),
      { provide: RepositorySearchApi, useValue: searchApi },
    ],
  });

  return TestBed.inject(SearchEffects);
}

describe('SearchEffects', () => {
  it('loads results for a submitted query', async () => {
    const query: SearchQuery = { q: 'tracts', geography: 'North Dakota' };
    const searchResearchObjects = vi.fn().mockReturnValue(of(response));
    const effects = setup(
      { searchResearchObjects } as unknown as RepositorySearchApi,
      of(SearchActions.searchSubmitted({ query })),
    );

    const emitted = await firstValueFrom(effects.submitSearch$);

    expect(searchResearchObjects).toHaveBeenCalledWith(query);
    expect(emitted).toEqual(SearchActions.searchLoaded({ response }));
  });

  it('reports the failure message when the API errors', async () => {
    const effects = setup(
      {
        searchResearchObjects: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Gateway timeout'))),
      } as unknown as RepositorySearchApi,
      of(SearchActions.searchSubmitted({ query: { q: 'tracts' } })),
    );

    const emitted = await firstValueFrom(effects.submitSearch$);

    expect(emitted).toEqual(
      SearchActions.searchFailed({ error: 'Gateway timeout' }),
    );
  });

  it('falls back to a readable message for a non-Error failure', async () => {
    const effects = setup(
      {
        searchResearchObjects: vi
          .fn()
          .mockReturnValue(throwError(() => ({ status: 500 }))),
      } as unknown as RepositorySearchApi,
      of(SearchActions.searchSubmitted({ query: { q: 'tracts' } })),
    );

    const emitted = await firstValueFrom(effects.submitSearch$);

    expect(emitted).toEqual(
      SearchActions.searchFailed({ error: 'Search results failed to load.' }),
    );
  });

  it('keeps the effect alive after a failure so later searches still run', async () => {
    const searchResearchObjects = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Gateway timeout')))
      .mockReturnValueOnce(of(response));
    const effects = setup(
      { searchResearchObjects } as unknown as RepositorySearchApi,
      of(
        SearchActions.searchSubmitted({ query: { q: 'first' } }),
        SearchActions.searchSubmitted({ query: { q: 'second' } }),
      ),
    );

    const emitted: unknown[] = [];
    effects.submitSearch$.subscribe((action) => emitted.push(action));

    expect(emitted).toEqual([
      SearchActions.searchFailed({ error: 'Gateway timeout' }),
      SearchActions.searchLoaded({ response }),
    ]);
  });
});
