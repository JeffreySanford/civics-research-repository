import { firstValueFrom, of } from 'rxjs';
import {
  RepositorySearchApi,
  type SearchCursorPage,
  type SearchResponse,
} from './repository-api-client';

const searchResponse = (page: number): SearchResponse => ({
  resultSource: 'REPOSITORY',
  query: 'North Dakota',
  page,
  pageSize: 25,
  totalResults: 80,
  results: [],
  facets: [],
});

describe('RepositorySearchApi cursor traversal', () => {
  it('sends the opaque cursor and omits offset page state', async () => {
    const page: SearchCursorPage = {
      search: searchResponse(4),
      nextCursor: 'opaque-next',
    };
    const http = {
      get: vi.fn(() => of(page)),
    };
    const api = new RepositorySearchApi(http as never, 'http://api.test/api');

    await expect(
      firstValueFrom(
        api.searchResearchObjectsWithCursor(
          {
            q: 'North Dakota',
            programs: ['TIGER_LINE', 'Office of Science'],
            publisher: 'U.S. Census Bureau',
            sourceSystem: 'CENSUS',
            geography: 'North Dakota',
            contentType: 'DATASET',
            vintageYear: 2025,
            page: 4,
            pageSize: 25,
          },
          'opaque-current',
        ),
      ),
    ).resolves.toEqual(page);

    expect(http.get).toHaveBeenCalledWith('http://api.test/api/search/cursor', {
      params: {
        q: 'North Dakota',
        program: ['TIGER_LINE', 'Office of Science'],
        publisher: 'U.S. Census Bureau',
        sourceSystem: 'CENSUS',
        geography: 'North Dakota',
        contentType: 'DATASET',
        vintageYear: 2025,
        pageSize: 25,
        cursor: 'opaque-current',
      },
    });
  });

  it('starts traversal without inventing a cursor parameter', async () => {
    const page: SearchCursorPage = {
      search: searchResponse(0),
      nextCursor: 'opaque-first-next',
    };
    const http = {
      get: vi.fn(() => of(page)),
    };
    const api = new RepositorySearchApi(http as never, 'http://api.test/api');

    await expect(
      firstValueFrom(
        api.searchResearchObjectsWithCursor({
          q: 'North Dakota',
          page: 0,
          pageSize: 25,
        }),
      ),
    ).resolves.toEqual(page);

    expect(http.get).toHaveBeenCalledWith('http://api.test/api/search/cursor', {
      params: {
        q: 'North Dakota',
        pageSize: 25,
      },
    });
  });
});
