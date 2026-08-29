import { firstValueFrom, of } from 'rxjs';
import {
  RepositorySearchComparisonApi,
  type SearchComparisonRequest,
  type SearchComparisonResponse,
  type SearchComparisonScenario,
} from './search-comparison-api';

describe('RepositorySearchComparisonApi', () => {
  it('loads the typed comparison scenario catalog', async () => {
    const scenarios: SearchComparisonScenario[] = [
      {
        id: 'FACETED_SEARCH',
        label: 'Facets vs aggregations',
        description: 'Compare equivalent facet semantics.',
      },
    ];
    const http = {
      get: vi.fn(() => of(scenarios)),
      post: vi.fn(),
    };
    const api = new RepositorySearchComparisonApi(
      http as never,
      'http://api.test/api',
    );

    await expect(firstValueFrom(api.listScenarios())).resolves.toEqual(
      scenarios,
    );
    expect(http.get).toHaveBeenCalledWith(
      'http://api.test/api/search/comparison/scenarios',
    );
  });

  it('posts one normalized comparison request to the comparison endpoint', async () => {
    const request: SearchComparisonRequest = {
      scenario: 'FILTERING',
      query: 'North Dakota workforce',
      geography: 'North Dakota',
      programs: ['LODES'],
      contentType: 'DATASET',
      vintageYear: 2023,
      page: 0,
      pageSize: 10,
    };
    const response: SearchComparisonResponse = {
      scenario: 'FILTERING',
      projection: {
        source: 'REPOSITORY',
        objectCount: 181,
        projectionId:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      sameProjection: true,
      solr: {
        engine: 'SOLR',
        enabled: true,
        reachable: true,
        indexName: 'discovery',
        indexedDocumentCount: 181,
        elapsedMs: 20,
        totalHits: 3,
        returnedHits: 0,
        results: [],
        facets: [],
      },
      openSearch: {
        engine: 'OPENSEARCH',
        enabled: true,
        reachable: true,
        indexName: 'discovery-comparison',
        indexedDocumentCount: 181,
        elapsedMs: 46,
        totalHits: 3,
        returnedHits: 0,
        results: [],
        facets: [],
      },
    };
    const http = {
      get: vi.fn(),
      post: vi.fn(() => of(response)),
    };
    const api = new RepositorySearchComparisonApi(
      http as never,
      'http://api.test/api',
    );

    await expect(firstValueFrom(api.run(request))).resolves.toEqual(response);
    expect(http.post).toHaveBeenCalledWith(
      'http://api.test/api/search/comparison/run',
      request,
    );
  });
});
