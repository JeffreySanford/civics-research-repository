import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  RepositorySearchApi,
  type SearchQuery,
  type SearchResponse,
} from 'repository-api-client';
import { SearchActions } from './search.actions';
import { SearchEffects } from './search.effects';
import { initialSearchState } from './search.reducer';

const response: SearchResponse = {
  resultSource: 'REPOSITORY',
  query: 'housing',
  page: 0,
  pageSize: 20,
  totalResults: 0,
  results: [],
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
      provideMockStore({ initialState: { search: initialSearchState } }),
      { provide: RepositorySearchApi, useValue: searchApi },
    ],
  });

  return TestBed.inject(SearchEffects);
}

describe('SearchEffects', () => {
  it('loads results for a submitted query', async () => {
    const query: SearchQuery = { q: 'housing', geography: 'North Dakota' };
    const searchResearchObjects = vi.fn().mockReturnValue(of(response));
    const effects = setup(
      { searchResearchObjects } as unknown as RepositorySearchApi,
      of(SearchActions.searchSubmitted({ query })),
    );

    const emitted = await firstValueFrom(effects.submitSearch$);

    expect(searchResearchObjects).toHaveBeenCalledWith(query);
    expect(emitted).toEqual(SearchActions.searchLoaded({ response }));
  });

  it('turns API failures into serializable search state', async () => {
    const effects = setup(
      {
        searchResearchObjects: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('Gateway timeout'))),
      } as unknown as RepositorySearchApi,
      of(SearchActions.searchSubmitted({ query: { q: 'housing' } })),
    );

    const emitted = await firstValueFrom(effects.submitSearch$);

    expect(emitted).toEqual(
      SearchActions.searchFailed({
        error: { code: 'UNKNOWN', message: 'Gateway timeout' },
      }),
    );
  });
});
